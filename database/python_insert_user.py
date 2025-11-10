import psycopg2
from psycopg2 import sql

conn = psycopg2.connect("host=ec2-54-163-26-24.compute-1.amazonaws.com port=5432 dbname=developer user=developer password=password")
cursor = conn.cursor()

cursor.execute("INSERT INTO test_tables.tbl_users (fld_u_id_pk, fld_u_name) VALUES (3, 'Bob');")
conn.commit()