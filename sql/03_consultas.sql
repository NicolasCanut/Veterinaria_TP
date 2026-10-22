-- Consultas de lectura para estudiar el tablero.
-- :veterinario y :consulta son parámetros, no texto concatenado.
-- En lib/panel.mjs estas consultas incorporan filtros con ? y bind.

-- 1. Indicadores globales.
SELECT COUNT(*) AS total,
  SUM(CASE WHEN estado='atendida' THEN 1 ELSE 0 END) AS atendidas,
  SUM(CASE WHEN estado='ausente' THEN 1 ELSE 0 END) AS ausentes,
  SUM(CASE WHEN estado='programada' THEN 1 ELSE 0 END) AS programadas,
  SUM(CASE WHEN estado='cancelada' THEN 1 ELSE 0 END) AS canceladas,
  ROUND(SUM(importe_pesos),2) AS cobrado_pesos,
  COUNT(DISTINCT mascota_id) AS mascotas_distintas
FROM consultas;

-- 2. Nivel 1. Resumen de cada veterinario.
SELECT v.id, v.nombre, COUNT(*) AS total,
  SUM(CASE WHEN c.estado='atendida' THEN 1 ELSE 0 END) AS atendidas,
  SUM(CASE WHEN c.estado='ausente' THEN 1 ELSE 0 END) AS ausentes,
  ROUND(SUM(c.importe_pesos),2) AS cobrado_pesos
FROM consultas c
JOIN veterinarios v ON v.id=c.veterinario_id
GROUP BY v.id, v.nombre
ORDER BY v.id;

-- 3. Nivel 2. Consultas de un veterinario.
SELECT c.id, c.fecha, m.nombre AS mascota,
  d.nombre AS dueno, c.tipo, c.estado, c.importe_pesos
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
WHERE c.veterinario_id=:veterinario
ORDER BY c.fecha DESC;

-- 4. Nivel 3. Una consulta reúne las cuatro entidades.
SELECT c.id, c.fecha, c.tipo, c.motivo, c.estado,
  c.importe_pesos, m.nombre AS mascota, m.especie,
  d.nombre AS dueno, d.telefono,
  v.nombre AS veterinario, v.matricula
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
JOIN veterinarios v ON v.id=c.veterinario_id
WHERE c.veterinario_id=:veterinario AND c.id=:consulta;

-- 5. Agrupar consultas por mascota.
SELECT m.id, m.nombre, m.especie, d.nombre AS dueno,
  COUNT(*) AS consultas,
  SUM(CASE WHEN c.estado='atendida' THEN 1 ELSE 0 END) AS atendidas,
  ROUND(SUM(c.importe_pesos),2) AS cobrado_pesos
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
GROUP BY m.id, m.nombre, m.especie, d.nombre;

-- 6. Agrupar consultas por dueño sin repetir mascotas.
SELECT d.id, d.nombre, COUNT(DISTINCT m.id) AS mascotas,
  COUNT(*) AS consultas, ROUND(SUM(c.importe_pesos),2) AS cobrado_pesos
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
GROUP BY d.id, d.nombre;

-- 7. Consultas por mes, según fecha del turno.
SELECT substr(fecha,1,7) AS mes, COUNT(*) AS consultas
FROM consultas
GROUP BY substr(fecha,1,7)
ORDER BY mes;

-- 8. Proporción atendida; evita dividir por cero.
SELECT ROUND(100.0 *
  SUM(CASE WHEN estado='atendida' THEN 1 ELSE 0 END) /
  NULLIF(SUM(CASE WHEN estado IN ('atendida','ausente')
    THEN 1 ELSE 0 END),0),1) AS porcentaje_atendido
FROM consultas;

-- 9. Usuario para validar el acceso. El hash se compara en el servidor.
SELECT id, nombre, email, password_hash, salt
FROM usuarios
WHERE email=:email AND activo=1;

-- 10. Nivel 1 por tipo: resumen. GROUP BY construye los grupos.
SELECT tipo, COUNT(*) AS consultas, ROUND(SUM(importe_pesos),2) AS cobrado_pesos
FROM consultas
GROUP BY tipo
ORDER BY consultas DESC, tipo;

-- 11. Nivel 2 por tipo: vacunaciones. WHERE selecciona sus registros.
-- Cambiar el literal para consultar Control, Urgencia o Consulta general.
SELECT c.id, c.fecha, m.nombre AS mascota, d.nombre AS dueno,
       v.nombre AS veterinario, c.estado, c.importe_pesos
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
JOIN veterinarios v ON v.id=c.veterinario_id
WHERE c.tipo='Vacunación'
ORDER BY c.fecha DESC, c.id;

-- 12. Nivel 2 por dueño: todas las atenciones de sus mascotas.
-- Cambiar 1 por el ID del dueño seleccionado.
SELECT c.id, c.fecha, m.nombre AS mascota, v.nombre AS veterinario,
       c.tipo, c.estado, c.importe_pesos
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN veterinarios v ON v.id=c.veterinario_id
WHERE m.dueno_id=1
ORDER BY c.fecha DESC, c.id;

-- 13. Nivel 2 por mascota: sólo sus consultas. Cambiar el ID 1.
SELECT c.id, c.fecha, c.tipo, v.nombre AS veterinario, c.estado, c.importe_pesos
FROM consultas c
JOIN veterinarios v ON v.id=c.veterinario_id
WHERE c.mascota_id=1
ORDER BY c.fecha DESC, c.id;

-- 14. Nivel 3: detalle de una consulta con sus relaciones.
-- Cambiar el ID 1; los filtros siguientes prueban que pertenece al tipo elegido.
SELECT c.id, c.fecha, c.tipo, c.motivo, c.estado, c.importe_pesos,
       m.nombre AS mascota, m.especie, d.nombre AS dueno, d.telefono,
       v.nombre AS veterinario, v.matricula
FROM consultas c
JOIN mascotas m ON m.id=c.mascota_id
JOIN duenos d ON d.id=m.dueno_id
JOIN veterinarios v ON v.id=c.veterinario_id
WHERE c.id=1 AND c.tipo='Vacunación';
-- Para el recorrido por dueño: reemplazar c.tipo='Vacunación' por d.id=1.
-- Para el recorrido por mascota: reemplazarlo por m.id=1.
-- Para conservar mes/estado, añadir antes del punto y coma:
-- AND substr(c.fecha,1,7)='2026-07' AND c.estado='atendida'
-- Drill up: volver al SELECT del nivel anterior conservando esos filtros.
