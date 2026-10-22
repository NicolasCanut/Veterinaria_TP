-- Práctica inicial de SQL. Las respuestas aparecen como comentarios.

-- A. Leer sólo una tabla. Resultado: 48 filas.
SELECT id, nombre, especie FROM mascotas ORDER BY id;

-- B. Filtrar. Resultado: 16 gatos.
SELECT id, nombre FROM mascotas WHERE especie='Gato';

-- C. Contar. Resultado: 118.
SELECT COUNT(*) AS atendidas FROM consultas WHERE estado='atendida';

-- D. Unir mascota y dueño. Luna pertenece a Ana Torres.
SELECT m.nombre AS mascota, d.nombre AS dueno
FROM mascotas m JOIN duenos d ON d.id=m.dueno_id
WHERE m.id=1;

-- E. Contar consultas por veterinario. Resultado: 45 por profesional.
SELECT v.nombre, COUNT(*) AS consultas
FROM consultas c JOIN veterinarios v ON v.id=c.veterinario_id
GROUP BY v.id,v.nombre;

-- F. Sumar importes en pesos. Resultado: 2430000.
SELECT ROUND(SUM(importe_pesos),2) AS pesos FROM consultas;

-- G. Evitar repeticiones. Resultado: 48 mascotas, no 180.
SELECT COUNT(DISTINCT mascota_id) AS mascotas FROM consultas;
