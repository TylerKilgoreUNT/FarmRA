import psycopg2
import os
import boto3
from botocore.exceptions import ClientError


def lambda_handler(event, context):

    conn = psycopg2.connect(
        host="172.31.30.160",
        port="5432",
        dbname="farmra",
        user="user_lambda",
        password="smilingfriends3"
    )
    
    try: 
        cursor = conn.cursor()

        for record in event['Records']:
            body = record['body']
            # Insert into PostgreSQL
            cursor.execute("INSERT INTO testing_grounds.lambda_test (text_field) VALUES (%s)", (body,))
        conn.commit()

    except (Exception, psycopg2.Error) as error:
        print("Error while connecting to PostgreSQL", error)
        if conn:
            conn.rollback()
        raise

    finally:
        if cursor: 
            cursor.close() 
        if conn: 
            conn.close()

    return {"status": "success"}