import psycopg2
from psycopg2 import sql

conn = psycopg2.connect(
    "host=ec2-54-163-26-24.compute-1.amazonaws.com " \
    "port=5432 " \
    "dbname=farmra " \
    "user=developer " \
    "password=password"
)
cursor = conn.cursor()

cursor.execute("SELECT * FROM user_data.users")
records = cursor.fetchall()

print(records)