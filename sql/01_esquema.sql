PRAGMA foreign_keys = ON;

-- Las cuatro entidades del negocio.
CREATE TABLE duenos (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE mascotas (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  especie TEXT NOT NULL CHECK(especie IN ('Perro','Gato')),
  dueno_id INTEGER NOT NULL REFERENCES duenos(id),
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE veterinarios (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE consultas (
  id INTEGER PRIMARY KEY,
  mascota_id INTEGER NOT NULL REFERENCES mascotas(id),
  veterinario_id INTEGER NOT NULL REFERENCES veterinarios(id),
  fecha TEXT NOT NULL,
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('Control','Vacunación','Urgencia','Consulta general')),
  estado TEXT NOT NULL CHECK(estado IN ('atendida','ausente','programada','cancelada')),
  importe_pesos NUMERIC NOT NULL CHECK(typeof(importe_pesos) IN ('integer','real') AND importe_pesos >= 0 AND importe_pesos <= 1000000000 AND abs(importe_pesos*100-round(importe_pesos*100)) < 0.0001),
  CHECK(estado = 'atendida' OR importe_pesos = 0),
  UNIQUE(veterinario_id, fecha),
  UNIQUE(mascota_id, fecha)
);
CREATE INDEX consultas_fecha ON consultas(fecha);
CREATE INDEX consultas_veterinario_fecha ON consultas(veterinario_id, fecha);
CREATE INDEX consultas_mascota ON consultas(mascota_id);
CREATE INDEX mascotas_dueno ON mascotas(dueno_id);

-- Tablas de apoyo para el acceso. No cuentan como entidades de negocio.
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  vence INTEGER NOT NULL
);
