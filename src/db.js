// Conexión a SQLite, creación del esquema y datos iniciales
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'novasalud.db');

// Se usa better-sqlite3 si está instalado; si no (p. ej. falló su compilación),
// se usa el módulo SQLite integrado en Node.js 22+ (node:sqlite) con la misma interfaz.
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
} catch {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  db.pragma = (p) => db.exec(`PRAGMA ${p}`);
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try { const r = fn(...args); db.exec('COMMIT'); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };
}
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seed() {
  const hay = db.prepare('SELECT COUNT(*) c FROM usuarios').get().c;
  if (hay > 0) return;

  const insUser = db.prepare('INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?,?,?,?)');
  insUser.run('Administrador General', 'admin', bcrypt.hashSync('Admin123*', 10), 'admin');
  insUser.run('María Torres (Caja 1)', 'vendedor', bcrypt.hashSync('Venta123*', 10), 'vendedor');

  const cats = ['Analgésicos', 'Antibióticos', 'Antigripales', 'Vitaminas', 'Gastrointestinal', 'Cuidado personal', 'Dermatológicos'];
  const insCat = db.prepare('INSERT INTO categorias (nombre) VALUES (?)');
  cats.forEach(c => insCat.run(c));

  const insProd = db.prepare(`INSERT INTO productos
    (codigo,nombre,presentacion,laboratorio,categoria_id,precio_compra,precio_venta,stock,stock_minimo,lote,fecha_vencimiento,requiere_receta)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const productos = [
    ['7750001', 'Paracetamol 500 mg', 'Caja x 100 tab', 'Medifarma', 1, 8.5, 15.0, 120, 30, 'L2301', addDays(400), 0],
    ['7750002', 'Ibuprofeno 400 mg', 'Caja x 50 tab', 'Portugal', 1, 9.0, 18.0, 18, 25, 'L2302', addDays(300), 0],
    ['7750003', 'Amoxicilina 500 mg', 'Caja x 21 cáps', 'Genfar', 2, 12.0, 24.5, 40, 15, 'L2303', addDays(220), 1],
    ['7750004', 'Azitromicina 500 mg', 'Caja x 3 tab', 'AC Farma', 2, 7.5, 16.9, 6, 10, 'L2304', addDays(500), 1],
    ['7750005', 'Panadol Antigripal', 'Caja x 12 tab', 'GSK', 3, 10.0, 19.9, 55, 20, 'L2305', addDays(45), 0],
    ['7750006', 'Vitamina C 1 g efervescente', 'Tubo x 10', 'Bayer', 4, 11.0, 21.0, 70, 15, 'L2306', addDays(600), 0],
    ['7750007', 'Omeprazol 20 mg', 'Caja x 30 cáps', 'Farmindustria', 5, 6.0, 13.5, 0, 20, 'L2307', addDays(350), 0],
    ['7750008', 'Sal de Andrews', 'Sobre x 5 g', 'GSK', 5, 0.6, 1.5, 300, 50, 'L2308', addDays(700), 0],
    ['7750009', 'Alcohol 70° 250 ml', 'Frasco', 'Alkofarma', 6, 2.8, 5.5, 45, 20, 'L2309', addDays(900), 0],
    ['7750010', 'Bloqueador solar SPF 50', 'Tubo x 60 g', 'Eucerin', 7, 38.0, 69.9, 12, 5, 'L2310', addDays(30), 0],
    ['7750011', 'Loratadina 10 mg', 'Caja x 10 tab', 'Medifarma', 3, 3.0, 7.0, 90, 20, 'L2311', addDays(420), 0],
    ['7750012', 'Complejo B inyectable', 'Ampolla 3 ml', 'Hersil', 4, 4.0, 9.5, 9, 12, 'L2312', addDays(260), 1],
    ['7750013', 'Diclofenaco gel 1%', 'Tubo x 50 g', 'Genfar', 7, 6.5, 14.0, 33, 10, 'L2313', addDays(380), 0],
    ['7750014', 'Suero oral Electrolit', 'Botella 625 ml', 'Pisa', 5, 3.8, 7.5, 64, 24, 'L2314', addDays(160), 0],
  ];
  productos.forEach(p => insProd.run(...p));

  const insMov = db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id) VALUES (?,?,?,?,?,1)');
  db.prepare('SELECT id, stock FROM productos').all()
    .forEach(p => insMov.run(p.id, 'entrada', p.stock, p.stock, 'Inventario inicial'));

  const insCli = db.prepare('INSERT INTO clientes (dni,nombre,telefono,email) VALUES (?,?,?,?)');
  insCli.run('45879632', 'Carlos Ramírez Quispe', '987654321', 'carlos.ramirez@mail.com');
  insCli.run('70125489', 'Lucía Fernández Soto', '956321478', 'lucia.fs@mail.com');
  insCli.run('41236985', 'Jorge Huamán Ríos', '912345678', null);
}
seed();

module.exports = db;
