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