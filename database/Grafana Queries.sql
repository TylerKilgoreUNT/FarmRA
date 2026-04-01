--Grafana Queries
  --Light
  SELECT
    m_time AS "Time",
    m_light AS "Light Level (lx)"
  FROM
    node_data.measurements
  WHERE
    m_nodeID = $ndoe
    AND $__timeFilter(m_time)
  ORDER BY
    m_time ASC;

  --Moisture
  SELECT
    m_time AS "Time",
    m_moist AS "Moisture (0-4)"
  FROM
    node_data.measurements
  WHERE
    m_nodeID = $node
    AND $__timeFilter(m_time)
  ORDER BY
    m_time ASC;

  --Temperature
  SELECT
    m_time AS "Time",
    m_temperature AS "Temperature (°F)"
  FROM
    node_data.measurements
  WHERE
    m_nodeID = $node
    AND $__timeFilter(m_time)
  ORDER BY
    m_time ASC;

  --For tables, order by DESC instead of ASC.

  --Averages
  SELECT
    $__timeGroup(m_time, 5m) AS "Time",
    AVG(m_light) AS "Avg Light"
  FROM node_data.measurements m
  WHERE
    m.m_nodeId IN (
      SELECT d.d_nodeId
      FROM node_data.devices d
      JOIN user_data.users u ON u.u_userId = d.d_userId
      WHERE u.u_email = '$email'
    )
    AND $__timeFilter(m_time)
  GROUP BY 1
  ORDER BY 1;