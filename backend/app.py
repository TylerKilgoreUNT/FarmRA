from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
import requests
import os
import psycopg2
from functools import wraps

app = Flask(__name__)
CORS(app)  # Enable CORS for your web app to connect
app.secret_key = "71b2ccf76d017e8637de631de8d5127f1e026c00e7ddb445b81f27c6c5408957"

def db_access(): 
    return psycopg2.connect( 
        dbname="farmra", 
        user="user", 
        password="yourpassword", 
        host="localhost", 
        port=5432 
    )

def get_user_role(email):
    conn = db_access()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

# -----------------------------
# Admin Decorator
# -----------------------------
#def require_admin(f):
#    @wraps(f)
#    def wrapper(*args, **kwargs):
#        if session.get("role") != "admin":
#            return jsonify({"error": "Forbidden"}), 403
#        return f(*args, **kwargs)
#    return wrapper

def user_exists(email): 
    conn = db_access() 
    cur = conn.cursor() 
    cur.execute("SELECT * FROM users WHERE email = %s", (email,)) 
    result = cur.fetchone() 
    conn.close() 
    return result is not None

@app.before_request
def load_user(): 
    # Allow public login page 
    #if request.path in ["/login", "/login.html"]: 
    #    return 
    
    user_email = request.headers.get("X-User-Email") 
    #user_name = request.headers.get("X-User-Name")

    if not user_email: 
        return redirect("/login.html") 
    
    # Store user info in Flask session 
    session["email"] = user_email 
    #session["name"] =  user_name

    # Check if user exists in PostgreSQL 
    #if not user_exists(user_email): 
    #    return "Access denied: email not registered", 403

@app.route("/me")
def me():
    return jsonify({
        "email": session.get("email")
    })

# -----------------------------
# Before Request: Auth + Role Check
# -----------------------------
#@app.before_request
#def load_user():
#    public_paths = [
#        "/login",
#        "/login.html",
#        "/oidc/callback",
#        "/api/route_user"
#    ]
#
#    # Allow public pages
#    if request.path in public_paths:
#        return
#
#    # Apache injects these headers after OIDC login
#    email = request.headers.get("X-User-Email")
#    name = request.headers.get("X-User-Name")
#
#    if not email:
#        return redirect("/login.html")
#
#    session["email"] = email
#    session["name"] = name
#
#    # Check DB for user + role
#    role = get_user_role(email)
#    if not role:
#        session.clear()
#        return redirect("/login.html?error=not_registered")
#
#    session["role"] = role

@app.route("/") 
def root(): 
    return redirect("/index")

# -----------------------------
# Post-OIDC Routing Endpoint
# -----------------------------
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

# Sample data (replace with database later)
items = [
    {"id": 1, "name": "Item 1", "description": "First item"},
    {"id": 2, "name": "Item 2", "description": "Second item"}
]

# GET all items
@app.route('/api/items', methods=['GET'])
def get_items():
    return jsonify(items)

# GET single item
@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = next((item for item in items if item['id'] == item_id), None)
    if item:
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

# POST new item
@app.route('/api/items', methods=['POST'])
def create_item():
    new_item = request.get_json()
    new_item['id'] = len(items) + 1
    items.append(new_item)
    return jsonify(new_item), 201

# PUT update item
@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    item = next((item for item in items if item['id'] == item_id), None)
    if item:
        data = request.get_json()
        item.update(data)
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

# DELETE item
@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    global items
    items = [item for item in items if item['id'] != item_id]
    return jsonify({"message": "Item deleted"}), 200

# -----------------------------
# Admin API Example
# -----------------------------
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)