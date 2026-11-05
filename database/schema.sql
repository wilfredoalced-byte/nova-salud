-- =========================================================
--  Botica "Nova Salud" - Esquema de base de datos (SQLite)
-- =========================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  usuario       TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  rol           TEXT    NOT NULL CHECK (rol IN ('admin','vendedor')),
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS productos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo            TEXT    NOT NULL UNIQUE,
  nombre            TEXT    NOT NULL,
  presentacion      TEXT,
  laboratorio       TEXT,
  categoria_id      INTEGER REFERENCES categorias(id),
  precio_compra     REAL    NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
  precio_venta      REAL    NOT NULL CHECK (precio_venta >= 0),
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo      INTEGER NOT NULL DEFAULT 10 CHECK (stock_minimo >= 0),
  lote              TEXT,
  fecha_vencimiento TEXT,
  requiere_receta   INTEGER NOT NULL DEFAULT 0,
  activo            INTEGER NOT NULL DEFAULT 1,
  creado_en         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  dni       TEXT UNIQUE,
  nombre    TEXT NOT NULL,
  telefono  TEXT,
  email     TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  numero        TEXT    NOT NULL UNIQUE,          -- B001-000001
  cliente_id    INTEGER REFERENCES clientes(id),
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  subtotal      REAL    NOT NULL,
  igv           REAL    NOT NULL,
  total         REAL    NOT NULL,
  metodo_pago   TEXT    NOT NULL CHECK (metodo_pago IN ('efectivo','tarjeta','yape','plin')),
  estado        TEXT    NOT NULL DEFAULT 'emitida' CHECK (estado IN ('emitida','anulada')),
  fecha         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS detalle_ventas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL    NOT NULL,
  importe         REAL    NOT NULL
);

-- Kardex: cada entrada/salida de stock queda registrada (trazabilidad)
CREATE TABLE IF NOT EXISTS movimientos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo        TEXT    NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','anulacion')),
  cantidad    INTEGER NOT NULL,
  stock_final INTEGER NOT NULL,
  motivo      TEXT,
  usuario_id  INTEGER REFERENCES usuarios(id),
  fecha       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha     ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_mov_producto     ON movimientos(producto_id);

-- Vista de alertas: productos con stock bajo o próximos a vencer (60 días)
CREATE VIEW IF NOT EXISTS v_alertas AS
SELECT p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, p.fecha_vencimiento,
       CASE
         WHEN p.stock = 0 THEN 'agotado'
         WHEN p.stock <= p.stock_minimo THEN 'stock_bajo'
         WHEN p.fecha_vencimiento IS NOT NULL
              AND julianday(p.fecha_vencimiento) - julianday('now','localtime') <= 60 THEN 'por_vencer'
       END AS tipo_alerta
FROM productos p
WHERE p.activo = 1
  AND ( p.stock <= p.stock_minimo
     OR (p.fecha_vencimiento IS NOT NULL
         AND julianday(p.fecha_vencimiento) - julianday('now','localtime') <= 60) );
