from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
import requests
import os
import psycopg2
from functools import wraps

app = Flask(__name__)
CORS(app)  # Enable CORS for your web app to connect
app.secret_key = "71b2ccf76d017e8637de631de8d5127f1e026c00e7ddb445b81f27c6c5408957"

# Database access function
def db_access(): 
    return psycopg2.connect( 
        dbname="farmra", 
        user="user", 
        password="yourpassword", 
        host="localhost", 
        port=5432 
    )

# Checks if user exists and gets role
def get_user_role(email):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

# User helpers
def get_user_by_email(email):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_id, u_f_name, u_l_name, u_email, u_role
        FROM user_data.users
        WHERE u_email = %s
    """, (email,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "u_id": row[0],
        "first_name": row[1],
        "last_name": row[2],
        "email": row[3],
        "role": row[4],
    }

def insert_user(first_name, last_name, email, role="user"):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO user_data.users (u_f_name, u_l_name, u_email, u_role)
        VALUES (%s, %s, %s, %s)
        RETURNING u_id
    """, (first_name, last_name, email, role))
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

def require_admin(role):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if session.get("role") != role:
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.before_request
def load_user(): 
    #public_paths = [
    #    "/login",
    #    "/login.html",
    #    "/oidc/callback",
    #    "/api/route_user"
    #]
 
    # Allow public pages
    #if request.path in public_paths:
        #return
    
    user_email = request.headers.get("X-User-Email") 
    user_name = request.headers.get("X-User-Name")
    #user_picture = request.headers.get("X-User-Picture")

    if not user_email: 
        return redirect("/login.html") 
    
    session["email"] = user_email 
    session["name"] =  user_name
    #session["picture"] = user_picture

    # Check DB for user + role
    #role = get_user_role(email)
    #if not role:
        #session.clear()
        #return redirect("/login.html?error=not_registered")

    #session["role"] = role

# Basic user info
@app.route("/api/me", methods=["GET"])
@require_login
def me():
    return jsonify({
        "email": session.get("email"),
        "u_id": session.get("u_id"),
        "name": session.get("name"),
        "role": session.get("role"),
    })

# Post-OIDC Routing Endpoint
#@app.route("/api/route_user")
#def route_user():
#    email = request.headers.get("X-User-Email")
#    name = request.headers.get("X-User-Name")
#
#    if not email:
#        return redirect("/login.html")
#
#    role = get_user_role(email)
#
#    if not role:
#        return redirect("/login.html?error=not_registered")
#
#    if role == "admin":
#        return redirect("/admin.html")
#
#    if role == "user":
#        return redirect("/index.html")
#
#    return redirect("/login.html?error=invalid_role")

#@app.route("/logout") 
#def logout(): 
#    session.clear() 
#    return redirect("/oidc/callback?logout=https://farmra.net/login.html")

# -------------------------------------------------
# User CRUD (Admin Only)
# -------------------------------------------------

# CREATE user
@app.route("/api/users", methods=["POST"])
@require_admin("admin")
def create_user():
    data = request.get_json() or {}
    first = data.get("first_name")
    last = data.get("last_name")
    email = data.get("email")
    role = data.get("role", "user")

    if not (first and last and email):
        return jsonify({"error": "Missing required fields"}), 400

    if get_user_by_email(email):
        return jsonify({"error": "User already exists"}), 400

    u_id = insert_user(first, last, email, role)
    return jsonify({"message": "User created", "u_id": u_id}), 201

# READ all users
@app.route("/api/users", methods=["GET"])
@require_admin("admin")
def list_users():
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_id, u_f_name, u_l_name, u_email, u_role
        FROM user_data.users
        ORDER BY u_id
    """)
    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {
            "u_id": r[0],
            "first_name": r[1],
            "last_name": r[2],
            "email": r[3],
            "role": r[4],
        }
        for r in rows
    ])

# READ single user
@app.route("/api/users/<int:u_id>", methods=["GET"])
@require_admin("admin")
def get_user(u_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT u_id, u_f_name, u_l_name, u_email, u_role
        FROM user_data.users
        WHERE u_id = %s
    """, (u_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "u_id": row[0],
        "first_name": row[1],
        "last_name": row[2],
        "email": row[3],
        "role": row[4],
    })

# UPDATE user
@app.route("/api/users/<int:u_id>", methods=["PUT"])
@require_admin("admin")
def update_user(u_id):
    data = request.get_json() or {}

    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        UPDATE user_data.users
        SET u_f_name = %s,
            u_l_name = %s,
            u_email = %s,
            u_role = %s
        WHERE u_id = %s
    """, (
        data.get("first_name"),
        data.get("last_name"),
        data.get("email"),
        data.get("role"),
        u_id
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "User updated"})

# DELETE user
@app.route("/api/users/<int:u_id>", methods=["DELETE"])
@require_admin("admin")
def delete_user(u_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM user_data.users
        WHERE u_id = %s
    """, (u_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "User deleted"})

# -------------------------------------------------
# Gateways + Nodes (Read-only)
# -------------------------------------------------

@app.route("/api/users/<int:u_id>/gateways", methods=["GET"])
@require_login
def get_user_gateways(u_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT g_id
        FROM node_data.gateways
        WHERE u_id_fk = %s
    """, (u_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([r[0] for r in rows])

@app.route("/api/gateways/<g_id>/nodes", methods=["GET"])
@require_login
def get_gateway_nodes(g_id):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT n_id, n_name
        FROM node_data.nodes
        WHERE g_id_fk = %s
    """, (g_id,))
    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {"node_id": r[0], "node_name": r[1]}
        for r in rows
    ])

# -------------------------------------------------
# Measurements (Read-only, TimescaleDB optimized)
# -------------------------------------------------

@app.route("/api/measurements/node/<int:n_id>", methods=["GET"])
@require_login
def get_node_measurements(n_id):
    limit = request.args.get("limit", 50)

    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT m_time, m_temperature, m_moist, m_light, m_batt
        FROM node_data.measurements
        WHERE n_id_fk = %s
        ORDER BY m_time DESC
        LIMIT %s
    """, (n_id, limit))

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

@app.route("/api/measurements/gateway/<g_id>", methods=["GET"])
@require_login
def get_gateway_measurements(g_id):
    limit = request.args.get("limit", 100)

    conn = db_access()
    cur = conn.cursor()
    cur.execute("""
        SELECT m.m_time, m.m_temperature, m.m_moist, m.m_light, m.m_batt,
               n.n_id, n.n_name
        FROM node_data.measurements m
        JOIN node_data.nodes n ON m.n_id_fk = n.n_id
        WHERE n.g_id_fk = %s
        ORDER BY m.m_time DESC
        LIMIT %s
    """, (g_id, limit))

    rows = cur.fetchall()
    conn.close()

    return jsonify([
        {
            "timestamp": r[0],
            "temperature": r[1],
            "moisture": r[2],
            "light": r[3],
            "battery": r[4],
            "node_id": r[5],
            "node_name": r[6]
        }
        for r in rows
    ])

# Admin API Example
#@app.route("/api/admin/users", methods=["GET"])
#@require_admin
#def list_users():
#    conn = db_access()
#    cur = conn.cursor()
#    cur.execute("SELECT email, name, role FROM users")
#    rows = cur.fetchall()
#    conn.close()
#
#    return jsonify([
#        {"email": r[0], "name": r[1], "role": r[2]}
#        for r in rows
#    ])

# Root redirect
@app.route("/")
def root():
    return redirect("/index.html")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)