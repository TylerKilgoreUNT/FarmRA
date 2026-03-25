from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
import psycopg2, os
from functools import wraps
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)
app.secret_key = "71b2ccf76d017e8637de631de8d5127f1e026c00e7ddb445b81f27c6c5408957"

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = int(os.getenv("DB_PORT"))

# Database Connection
def db_access():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )

# User Helpers
def get_user_role(email):
    """Return boolean u_isAdmin or None."""
    conn = db_access()
    cur = conn.cursor()
    cur.execute("SELECT u_isAdmin FROM testing_grounds.users WHERE u_email = %s", (email,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def get_user_by_id(user_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_userId, u_fName, u_lName, u_email, u_isAdmin
        FROM testing_grounds.users
        WHERE u_userId = %s
    """, (user_id,))
    row = cur.fetchone()
    conn.close()
    return row

def get_user_by_email(email):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_userId, u_fName, u_lName, u_email, u_isAdmin
        FROM testing_grounds.users
        WHERE u_email = %s
    """, (email,))
    row = cur.fetchone()
    conn.close()
    return row

def insert_user(first_name, last_name, email, is_admin=False):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO testing_grounds.users (u_fName, u_lName, u_email, u_isAdmin)
        VALUES (%s, %s, %s, %s)
        RETURNING u_userId
    """, (first_name, last_name, email, is_admin))
    new_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return new_id

# Decorators
def require_login(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "email" not in session:
            return jsonify({"error": "Not authenticated"}), 401
        return f(*args, **kwargs)
    return wrapper

def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return wrapper

# Before Request
@app.before_request
def load_user():
    public_paths = [
        "/login",
        "/login.html",
        "/oidc/callback",
        "/route_user"
    ]

    if request.path in public_paths:
        return

    user_email = request.headers.get("X-User-Email")
    user_name = request.headers.get("X-User-Name")

    if not user_email:
        return redirect("/login.html")

    session["email"] = user_email
    session["name"] = user_name

    is_admin = get_user_role(user_email)
    if is_admin is None:
        session.clear()
        return redirect("/oidc/callback?logout=https://farmra.net/login.html?error=not_registered")

    session["is_admin"] = is_admin

# Basic User Info
@app.route("/me", methods=["GET"])
@require_login
def me():
    return jsonify({
        "email": session.get("email"),
        "name": session.get("name"),
        "is_admin": session.get("is_admin")
    })

@app.route("/route_user")
def route_user():
    email = request.headers.get("X-User-Email")
    if not email:
        return redirect("/login.html")

    is_admin = get_user_role(email)
    if is_admin is None:
        return redirect("/oidc/callback?logout=https://farmra.net/login.html?error=not_registered")

    return redirect("/admin.html" if is_admin else "/index.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/oidc/callback?logout=https://farmra.net/login.html")

# ---------------------------------------------------------
# USER CRUD (Admin Only)
# ---------------------------------------------------------
@app.route("/users", methods=["POST"])
@require_admin
def create_user():
    data = request.get_json() or {}

    first = str(data.get("first_name") or data.get("firstName") or "").strip()
    last = str(data.get("last_name") or data.get("lastName") or "").strip()
    email = str(data.get("email") or "").strip()
    is_admin = bool(data.get("is_admin", data.get("isAdmin", False)))

    if not (first and last and email):
        return jsonify({"error": "Missing required fields"}), 400

    if get_user_by_email(email):
        return jsonify({"error": "User already exists"}), 400

    try:
        new_id = insert_user(first, last, email, is_admin)
        return jsonify({"message": "User created", "user_id": new_id}), 201
    except psycopg2.Error as error:
        app.logger.exception("Failed to create user")
        return jsonify({"error": f"Unable to create user: {error.pgerror or error}"}), 500

@app.route("/users", methods=["GET"])
@require_admin
def list_users():
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_userId, u_fName, u_lName, u_email
        FROM testing_grounds.users
        ORDER BY u_userId
    """)
    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {
            "user_id": r[0],
            "first_name": r[1],
            "last_name": r[2],
            "email": r[3],
        }
        for r in rows
    ])

@app.route("/users/<int:user_id>", methods=["GET"])
@require_admin
def get_user(user_id):
    row = get_user_by_id(user_id)
    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user_id": row[0],
        "first_name": row[1],
        "last_name": row[2],
        "email": row[3],
        "is_admin": row[4]
    })

@app.route("/users/<int:user_id>", methods=["PUT"])
@require_admin
def update_user(user_id):
    data = request.get_json() or {}

    if not get_user_by_id(user_id):
        return jsonify({"error": "User not found"}), 404

    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        UPDATE testing_grounds.users
        SET u_fName = %s,
            u_lName = %s,
            u_email = %s,
            u_isAdmin = %s
        WHERE u_userId = %s
    """, (
        data.get("first_name"),
        data.get("last_name"),
        data.get("email"),
        data.get("is_admin"),
        user_id
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "User updated"})

@app.route("/users/<int:user_id>", methods=["DELETE"])
@require_admin
def delete_user(user_id):
    if not get_user_by_id(user_id):
        return jsonify({"error": "User not found"}), 404

    conn = db_access()
    cur = conn.cursor()
    cur.execute("DELETE FROM testing_grounds.users WHERE u_userId = %s", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "User deleted"})

# ---------------------------------------------------------
# DEVICE CRUD (Admin Only)
# ---------------------------------------------------------
@app.route("/devices", methods=["POST"])
@require_admin
def create_device():
    data = request.get_json() or {}

    gateway_id = str(data.get("gateway_id") or data.get("gatewayId") or "").strip()
    user_email = str(data.get("user_email") or data.get("userEmail") or "").strip()
    node_name = str(data.get("node_name") or data.get("nodeName") or "").strip()
    gps_long = data.get("gps_long", data.get("gpsLong"))
    gps_lat = data.get("gps_lat", data.get("gpsLat"))

    if not (gateway_id and user_email and node_name):
        return jsonify({"error": "Missing required fields"}), 400

    user_row = get_user_by_email(user_email)
    if not user_row:
        return jsonify({"error": "Assigned user does not exist"}), 400
    user_id = user_row[0]
    
    conn = None
    cur = None

    try:
        conn = db_access()
        cur = conn.cursor()

        cur.execute("""
            SELECT 1 FROM testing_grounds.devices
            WHERE d_gatewayId = %s AND d_nodeName = %s
        """, (gateway_id, node_name))
        if cur.fetchone():
            return jsonify({"error": "Device name already exists for this gateway"}), 400

        cur.execute("""
            INSERT INTO testing_grounds.devices (d_gatewayId, d_userId, d_nodeName, d_gpsLong, d_gpsLat)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING d_nodeId
        """, (gateway_id, user_id, node_name, gps_long, gps_lat))

        new_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"message": "Device created", "node_id": new_id}), 201
    except psycopg2.Error as error:
        if conn:
            conn.rollback()
        app.logger.exception("Failed to create device")
        return jsonify({"error": f"Unable to create device: {error.pgerror or error}"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route("/devices", methods=["GET"])
@require_admin
def list_devices():
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT d_nodeId, d_gatewayId, d_userId, d_nodeName, d_gpsLong, d_gpsLat
        FROM testing_grounds.devices
        ORDER BY d_nodeId
    """)
    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {
            "node_id": r[0],
            "gateway_id": r[1],
            "user_id": r[2],
            "node_name": r[3],
            "gps_long": r[4],
            "gps_lat": r[5]
        }
        for r in rows
    ])

@app.route("/devices/<int:node_id>", methods=["GET"])
@require_admin
def get_device(node_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT d_nodeId, d_gatewayId, d_userId, d_nodeName, d_gpsLong, d_gpsLat
        FROM testing_grounds.devices
        WHERE d_nodeId = %s
    """, (node_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Device not found"}), 404

    return jsonify({
        "node_id": row[0],
        "gateway_id": row[1],
        "user_id": row[2],
        "node_name": row[3],
        "gps_long": row[4],
        "gps_lat": row[5]
    })

@app.route("/devices/<int:node_id>", methods=["PUT"])
@require_admin
def update_device(node_id):
    data = request.get_json() or {}

    conn = db_access()
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM testing_grounds.devices WHERE d_nodeId = %s", (node_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Device not found"}), 404

    if data.get("user_id") and not get_user_by_id(data.get("user_id")):
        conn.close()
        return jsonify({"error": "Assigned user does not exist"}), 400

    cur.execute("""
        UPDATE testing_grounds.devices
        SET d_gatewayId = %s,
            d_userId = %s,
            d_nodeName = %s,
            d_gpsLong = %s,
            d_gpsLat = %s
        WHERE d_nodeId = %s
    """, (
        data.get("gateway_id"),
        data.get("user_id"),
        data.get("node_name"),
        data.get("gps_long"),
        data.get("gps_lat"),
        node_id
    ))

    conn.commit()
    conn.close()

    return jsonify({"message": "Device updated"})

@app.route("/devices/<int:node_id>", methods=["DELETE"])
@require_admin
def delete_device(node_id):
    conn = db_access()
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM testing_grounds.devices WHERE d_nodeId = %s", (node_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Device not found"}), 404

    cur.execute("DELETE FROM testing_grounds.devices WHERE d_nodeId = %s", (node_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Device deleted"})

# ---------------------------------------------------------
# List User Nodes
# ---------------------------------------------------------
@app.route("/nodes", methods=["GET"])
@require_login
def get_user_nodes():
    conn = db_access()
    cur = conn.cursor()

    cur.execute("""
        SELECT u_userId
        FROM testing_grounds.users
        WHERE u_email = %s
    """, (session.get("email"),))
    user_row = cur.fetchone()

    if not user_row:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    user_id = user_row[0]

    cur.execute("""
        SELECT d_nodeId, d_nodeName
        FROM testing_grounds.devices
        WHERE d_userId = %s
        ORDER BY d_nodeId
    """, (user_id,))

    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {"node_id": r[0], "node_name": r[1]}
        for r in rows
    ])

# ---------------------------------------------------------
# Measurements (Read-only)
# ---------------------------------------------------------
@app.route("/measurements/node/<int:node_id>", methods=["GET"])
@require_login
def get_node_measurements(node_id):
    limit = request.args.get("limit", 50)

    conn = db_access()
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM testing_grounds.devices WHERE d_nodeId = %s", (node_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Node not found"}), 404

    cur.execute("""
        SELECT m_time, m_temperature, m_moist, m_light, m_batt
        FROM testing_grounds.live_measurements
        WHERE m_nodeId = %s
        ORDER BY m_time DESC
        LIMIT %s
    """, (node_id, limit))

    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {
            "timestamp": r[0],
            "temperature": r[1],
            "moisture": r[2],
            "light": r[3],
            "battery": r[4]
        }
        for r in rows
    ])

# Root
@app.route("/")
def root():
    return redirect("/index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

