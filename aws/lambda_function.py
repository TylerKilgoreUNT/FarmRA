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

            # Find per node thresholds
            cursor.execute("SELECT d_minTemp, d_maxTemp, d_minMoist, d_maxMoist FROM node_data.devices WHERE d_nodeId = %s", (node_id,))
            thresholds = cursor.fetchone()
            if thresholds:
                min_temp, max_temp, min_moist, max_moist = thresholds
            else:
                min_temp = 32
                max_temp = 100
                min_moist = 1900
                max_moist = 2450

            # Find node state
            cursor.execute("SELECT d_alertState FROM node_data.devices WHERE d_nodeId = %s", (node_id,))
            state_row = cursor.fetchone()
            old_state = state_row[0] if state_row and state_row[0] else 'normal'

            # Define sql query parameters 
            sql_insert = "INSERT INTO node_data.measurements (m_time, m_nodeID, m_temperature, m_moist, m_light) VALUES (%s, %s, %s, %s, %s)"
            sql_data = (timestampz, node_id, temperature, moisture, light)

            # Insert into PostgreSQL
            cursor.execute(sql_insert, sql_data)

            # Lookup user email
            cursor.execute("SELECT u_email FROM user_data.users u JOIN node_data.devices d ON d.d_userId = u.u_userId WHERE d.d_nodeId = %s ", (node_id,))
            email_result = cursor.fetchone()

            if email_result:
                user_email = email_result[0]
            else:
                user_email = None

            # Build email/determine if message contains alert
            in_alert = False
            message = ""

            if temperature > max_temp:
                in_alert = True
                message += (
                    f"Alert: Temperature for {node_name} is {temperature}°F.\n"
                    f"This is above the upper threshold of {max_temp}°F.\n\n"
                )
            elif temperature < min_temp:
                in_alert = True
                message += (
                    f"Alert: Temperature for {node_name} is {temperature}°F.\n"
                    f"This is below the lower threshold of {min_temp}°F.\n\n"
                )

            if moisture > max_moist:
                in_alert = True
                message += (
                    f"Alert: Moisture for {node_name} is too high (soil too dry).\n"
                    f"Value: {moisture}\n\n"
                )
            elif moisture < min_moist:
                in_alert = True
                message += (
                    f"Alert: Moisture for {node_name} is too low (soil too wet).\n"
                    f"Value: {moisture}\n\n"
                )

            new_state = 'alert' if in_alert else 'normal'

            # Send email only if updated to alert state
            if message and user_email:
                if old_state == 'normal' and new_state == 'alert':
                    send_email(message, user_email)

            # Update state field if
            if new_state != old_state:
                cursor.execute("UPDATE node_data.devices SET d_alertState = %s WHERE d_nodeId = %s", (new_state, node_id))

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

def send_email(message, user_email):
    aws_region = 'us-east-1'
    sender_email = 'alerts@farmra.net'

    ses_client = boto3.client('ses', region_name=aws_region)

    try:
        response = ses_client.send_email(
            Destination={
                'ToAddresses': [user_email],
            },
           Message={
              'Body': {
                    'Text': {
                        'Charset': 'UTF-8',
                        'Data': message,
                    },
                },
                'Subject': {
                    'Charset': 'UTF-8',
                    'Data': 'Threshold Alert Triggered',
                },
            },
            Source=sender_email,
        )
        print("Email sent successfully! Message ID:", response['MessageId'])
    except Exception as e:
        print(f"Error sending email: {e}")