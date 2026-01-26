import psycopg2
import os
import json
import boto3
from botocore.exceptions import ClientError


def lambda_handler(event, context):

    secret_name = "lambda_to_db_secret"
    region_name = "us-east-1"

    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise e
    print(get_secret_value_response)

    secret = get_secret_value_response['SecretString']
    creds = json.loads(secret)

    conn = psycopg2.connect(
        host=creds["host"],
        port=creds["port"],
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"]
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