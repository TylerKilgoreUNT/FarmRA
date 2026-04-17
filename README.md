# FarmRA

FarmRA is a web-based monitoring system for agricultural sensor nodes. It combines a static frontend, a Flask API, PostgreSQL/TimescaleDB storage, Grafana dashboards, and an AWS Lambda ingest path so users can log in, view their assigned devices, and inspect recent sensor readings.

## Tech Stack

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![TimescaleDB](https://img.shields.io/badge/TimescaleDB-FDB515?style=flat&logo=timescale&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=flat&logo=awslambda&logoColor=white)
![Apache](https://img.shields.io/badge/Apache-D22128?style=flat&logo=apache&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=flat&logo=grafana&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)

## What This Repository Contains

This repository holds the main application code for the FarmRA platform:

- A public-facing frontend for authenticated users to view node dashboards and maps
- An admin interface for managing users and sensor nodes
- A Flask backend that handles session-aware API requests and CRUD operations
- An AWS Lambda function that writes incoming sensor messages into PostgreSQL
- SQL scripts for schema creation, test data, and Grafana queries
- Deployment files for Apache, Gunicorn, and a simple pull-and-copy deployment flow

## System Overview

At a high level, the system works like this:

1. A user accesses `farmra.net`.
2. Apache serves the static frontend and protects pages with Google OpenID Connect.
3. Apache forwards authenticated API traffic from `/farmra-api` to the Flask app.
4. Flask reads the authenticated user's email from request headers, loads the user role from PostgreSQL, and serves user or admin data.
5. Sensor data arrives separately through AWS, where a Lambda function consumes messages, resolves the target node, and inserts measurements into the database.
6. The frontend embeds Grafana panels to visualize the stored data.

## Architecture

### Frontend

The frontend is a static site served by Apache from the `frontend/` directory.

- `login.html` is the entry page for authentication.
- `index.html` is the main user dashboard.
- `admin.html` is the admin setup and management page.
- `map.html` is the map-oriented user view.
- `js/main.js` loads the logged-in user, fetches the nodes assigned to that user, and swaps embedded Grafana panels.
- `js/admin.js` calls the backend admin APIs to create users and devices and list existing users.

The frontend expects API requests to be available at `/farmra-api`, which matches the Apache reverse proxy configuration.

### Backend API

The backend is a Flask application in `backend/app.py`.

Key responsibilities:

- Load database connection settings from environment variables
- Read an encryption key from AWS Secrets Manager
- Trust authenticated user identity forwarded by Apache headers
- Store session state for the current user
- Enforce login and admin authorization
- Manage users and devices
- Return node and measurement data for authenticated users

Main API routes:

- `GET /me`: current user profile and admin flag
- `GET /route_user`: redirect a user to the correct page based on role
- `GET /logout`: clear the Flask session and redirect to OIDC logout
- `POST /users`: create a user (admin only)
- `GET /users`: list users (admin only)
- `GET /users/<user_id>`: fetch one user (admin only)
- `PUT /users/<user_id>`: update a user (admin only)
- `DELETE /users/<user_id>`: delete a user (admin only)
- `POST /devices`: create a device/node assignment (admin only)
- `GET /devices`: list devices (admin only)
- `GET /devices/<node_id>`: fetch one device (admin only)
- `PUT /devices/<node_id>`: update a device (admin only)
- `DELETE /devices/<node_id>`: delete a device (admin only)
- `GET /nodes`: list the nodes assigned to the logged-in user
- `GET /measurements/node/<node_id>`: return recent measurements for a node

### Data Ingest

The AWS Lambda entry point is `aws/lambda_function.py`.

That function:

- Reads database credentials from AWS Secrets Manager
- Connects to PostgreSQL with `psycopg2`
- Processes incoming event records, expected to contain sensor payloads
- Extracts `deviceName`, `gatewayId`, and sensor values such as temperature, moisture, and light
- Converts the SQS sent timestamp into a PostgreSQL `TIMESTAMPTZ`
- Resolves the device ID from the `node_data.devices` table
- Inserts the measurement into `node_data.measurements`

## Database Design

The schema is defined in `database/FarmRA Tables.sql`.

Main database objects:

- `user_data.users`: application users and admin flag
- `node_data.devices`: sensor nodes mapped to users and gateway IDs
- `node_data.measurements`: time-series sensor measurements

The measurements table is converted to a hypertable, which indicates the system is designed for TimescaleDB-style time-series workloads.

The SQL script also sets up role-based grants for separate consumers:

- `user_lambda` for Lambda inserts
- `user_grafana` for dashboard reads
- `user_flask` for the application backend

## Authentication And Access Control

Authentication is handled in Apache, not directly in Flask.

The SSL virtual host in `deploy/farmra.net-le-ssl.conf` shows that the deployed site uses:

- Google OpenID Connect via `mod_auth_openidc`
- Header forwarding of `X-User-Email` and `X-User-Name`
- Apache reverse proxying from `/farmra-api` to the Flask app on `127.0.0.1:5000`

Flask then uses those forwarded headers to:

- Create a session for the authenticated user
- Look up whether the user exists in the application database
- Determine whether the user is an admin
- Redirect unknown users back through logout with an error marker

## Deployment Model

The deployment files in `deploy/` describe a simple server-hosted setup:

- Apache serves the static frontend and handles TLS plus OIDC
- Gunicorn runs the Flask app as a systemd service
- A deploy script pulls the latest repository changes and copies files into the web and backend directories

Relevant files:

- `deploy/deploy.sh`: pulls from GitHub, copies frontend and backend files, restarts services
- `deploy/farmra.service`: Gunicorn service definition for the Flask app
- `deploy/farmra.net-le-ssl.conf`: Apache SSL site configuration and reverse proxy rules

Based on the checked-in deployment files, production currently assumes directories similar to:

- `~/FarmRA` for the repository checkout
- `~/FarmRA-Backend` for the deployed backend runtime
- `/var/www/html/farmra.net` for the static site

## Repository Layout

```text
aws/
  lambda_function.py          AWS Lambda ingestion logic
  libraries/                 Bundled Python dependencies for Lambda
backend/
  app.py                     Flask API and session/authorization logic
database/
  FarmRA Tables.sql          Database schema and grants
  FarmRA Test Data & Queries.sql
  Grafana Queries.sql
deploy/
  deploy.sh                  Deployment helper script
  farmra.net-le-ssl.conf     Apache SSL/OIDC/reverse-proxy config
  farmra.service             systemd service for Gunicorn
frontend/
  index.html                 User dashboard
  admin.html                 Admin interface
  login.html                 Login page
  map.html                   Map view
  js/                        Frontend behavior
  style/                     Stylesheets
  assets/                    Images and static assets
```

## Local Development Notes

This repository does not currently include a pinned dependency manifest such as `requirements.txt` or `pyproject.toml`, so local setup must be inferred from the code.

The backend depends on at least:

- `Flask`
- `flask-cors`
- `python-dotenv`
- `cryptography`
- `boto3`
- `psycopg2`
- `gunicorn` for production serving

The Flask app expects these environment variables:

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_PORT`

It also expects access to AWS Secrets Manager for at least:

- `myapp/fernet` for the Fernet encryption key used by the backend
- `lambda_to_db_secret` for Lambda database credentials

If you want to run the backend locally, you will also need:

- A PostgreSQL database matching the schema in `database/FarmRA Tables.sql`
- AWS credentials or mocked secrets for the backend and Lambda code paths
- A way to provide the same authenticated headers that Apache normally injects in production
