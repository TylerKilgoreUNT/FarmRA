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

