import psycopg2
import os

def lambda_handler(event, context):
    conn = psycopg2.connect(
        host="ec2-54-163-26-24.compute-1.amazonaws.com",
        port="5432",
        dbname="developer",
        user="developer",
        password="password"
    )
    cursor = conn.cursor()

#    for record in event['Records']:
#        body = record['body']
#        # Insert into PostgreSQL
#        cursor.execute("INSERT INTO test_tables.sqs_test (message_body) VALUES (%s)", (body,))
#        conn.commit()

    cursor.close()
    conn.close()
    return {"status": "success"}

