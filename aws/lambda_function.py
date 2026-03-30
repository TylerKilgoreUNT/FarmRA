import psycopg2, os, json, boto3, datetime
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
            sensor_data = json.loads(record['body'])

            # Take time from sqs and convert to timestampz format for psql
            attributes = record['attributes']
            sent_timestamp_ms = int(attributes['SentTimestamp'])
            timestampz = datetime.datetime.fromtimestamp((sent_timestamp_ms / 1000.0), tz=datetime.timezone.utc)

            node_name = sensor_data['deviceName']
            gateway_id = sensor_data['gatewayId']
            temperature = sensor_data['data']['temp']
            moisture = sensor_data['data']['moisture']
            light = sensor_data['data']['light']
            #battery = sensor_data['data']['battery']

            # Finds the node ID from the nodes table that matches the gateway id and node name from sensors
            cursor.execute("SELECT d_nodeId FROM node_data.devices WHERE d_gatewayId = %s AND d_nodeName = %s", (gateway_id, node_name))
            result = cursor.fetchone()
            if result:
                node_id = result[0]
            else:
                raise ValueError(f"No node found for gateway_id={gateway_id} and node_name='{node_name}'")

            # Define sql query parameters 
            sql_insert = "INSERT INTO node_data.measurements (m_time, m_nodeID, m_temperature, m_moist, m_light) VALUES (%s, %s, %s, %s, %s)"
            sql_data = (timestampz, node_id, temperature, moisture, light)

            # Insert into PostgreSQL
            cursor.execute(sql_insert, sql_data)
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