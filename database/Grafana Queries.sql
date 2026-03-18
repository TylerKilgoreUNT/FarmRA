--Initial Dashboard 11/13/2025
SELECT
  m_time AS "Time",
  m_temperature AS "Temperature (°F)"
FROM
  node_data.measurements 
WHERE
  n_id_fk = 1001
ORDER BY
  m_time DESC;

--New values 3/12/2026
SELECT
  m_time AS "Time",
  m_moist AS "Moisture (0-4)"
FROM
  testing_grounds.test_measurements
WHERE
  n_id_fk = 1
ORDER BY
  m_time DESC;

--Query variable for node
SELECT d.d_nodeId
FROM testing_grounds.devices d
WHERE d.d_userId = (
    SELECT u.u_userId
    FROM testing_grounds.users u
    WHERE u.u_email = '$email'
)
ORDER BY d.d_nodeId;

SELECT
  m.m_time AS "Time",
  m.m_moist AS "Moisture"
FROM testing_grounds.test_measurements m
WHERE m.m_nodeId IN ($node)
ORDER BY m.m_time DESC;


SELECT
  m.m_time AS "Time",
  m.m_moist AS "Moisture"
FROM testing_grounds.test_measurements m
WHERE m.m_nodeId IN ($node)
AND m.m_nodeId IN (
    SELECT d.d_nodeId
    FROM testing_grounds.devices d
    WHERE d.d_userId = (
        SELECT u.u_userId
        FROM testing_grounds.users u
        WHERE u.u_email = '$email'
    )
)
ORDER BY m.m_time DESC;