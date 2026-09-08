-- Fixture query only. Parameters are bound, not interpolated.
SELECT day, SUM(quantity) AS quantity
FROM approved_source
WHERE day >= :start_day AND day < :end_day
GROUP BY day ORDER BY day;
