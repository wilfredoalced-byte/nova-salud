const router = require('express').Router();
const db = require('../db');
const { soloRol } = require('../middleware/auth');
const { emitir } = require('../eventos');

const SELECT = `SELECT p.*, c.nombre AS categoria,
  CAST(julianday(p.fecha_vencimiento) - julianday('now','localtime') AS INTEGER) AS dias_vencer
  FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id`;

function validar(b) {
  const errores = [];
  if (!b.codigo || !String(b.codigo).trim()) errores.push('El código es obligatorio');
  if (!b.nombre || !String(b.nombre).trim()) errores.push('El nombre es obligatorio');
  if (!(Number(b.precio_venta) >= 0)) errores.push('Precio de venta inválido');
  if (!(Number.isInteger(Number(b.stock)) && Number(b.stock) >= 0)) errores.push('Stock inválido');
  if (!(Number.isInteger(Number(b.stock_minimo)) && Number(b.stock_minimo) >= 0)) errores.push('Stock mínimo inválido');
  return errores;
}

// Listar / buscar productos
router.get('/', (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const rows = db.prepare(`${SELECT} WHERE p.activo = 1 AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.laboratorio LIKE ?)
    ORDER BY p.nombre`).all(q, q, q);
  res.json(rows);
});

router.get('/categorias', (req, res) => res.json(db.prepare('SELECT * FROM categorias ORDER BY nombre').all()));

router.get('/alertas', (req, res) => {
  res.json(db.prepare(`SELECT a.*, CAST(julianday(a.fecha_vencimiento) - julianday('now','localtime') AS INTEGER) dias_vencer
    FROM v_alertas a ORDER BY CASE tipo_alerta WHEN 'agotado' THEN 0 WHEN 'stock_bajo' THEN 1 ELSE 2 END, a.stock`).all());
});

router.get('/:id/kardex', (req, res) => {
  res.json(db.prepare(`SELECT m.*, u.nombre usuario FROM movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.producto_id = ? ORDER BY m.id DESC`).all(req.params.id));
});

// Crear producto (solo administrador)
router.post('/', soloRol('admin'), (req, res) => {
  const b = req.body;
  const errores = validar(b);
  if (errores.length) return res.status(400).json({ error: errores.join('. ') });
  try {
    const r = db.prepare(`INSERT INTO productos (codigo,nombre,presentacion,laboratorio,categoria_id,precio_compra,precio_venta,
      stock,stock_minimo,lote,fecha_vencimiento,requiere_receta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(b.codigo.trim(), b.nombre.trim(), b.presentacion || null, b.laboratorio || null, b.categoria_id || null,
        Number(b.precio_compra) || 0, Number(b.precio_venta), Number(b.stock), Number(b.stock_minimo),
        b.lote || null, b.fecha_vencimiento || null, b.requiere_receta ? 1 : 0);
    db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id) VALUES (?,?,?,?,?,?)')
      .run(r.lastInsertRowid, 'entrada', Number(b.stock), Number(b.stock), 'Alta de producto', req.usuario.id);
    emitir('stock', { producto_id: r.lastInsertRowid });
    res.status(201).json(db.prepare(`${SELECT} WHERE p.id = ?`).get(r.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un producto con ese código' });
    throw e;
  }
});

// Editar producto (el stock solo se modifica mediante movimientos)
router.put('/:id', soloRol('admin'), (req, res) => {
  const b = req.body;
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Producto no encontrado' });
  const errores = validar({ ...b, stock: actual.stock });
  if (errores.length) return res.status(400).json({ error: errores.join('. ') });
  db.prepare(`UPDATE productos SET codigo=?,nombre=?,presentacion=?,laboratorio=?,categoria_id=?,precio_compra=?,precio_venta=?,
    stock_minimo=?,lote=?,fecha_vencimiento=?,requiere_receta=? WHERE id=?`)
    .run(b.codigo.trim(), b.nombre.trim(), b.presentacion || null, b.laboratorio || null, b.categoria_id || null,
      Number(b.precio_compra) || 0, Number(b.precio_venta), Number(b.stock_minimo), b.lote || null,
      b.fecha_vencimiento || null, b.requiere_receta ? 1 : 0, req.params.id);
  emitir('stock', { producto_id: Number(req.params.id) });
  res.json(db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id));
});

// Registrar entrada de mercadería (reposición) o ajuste de inventario
router.post('/:id/movimiento', soloRol('admin'), (req, res) => {
  const { tipo, cantidad, motivo } = req.body;
  const cant = Number(cantidad);
  if (!['entrada', 'ajuste'].includes(tipo) || !Number.isInteger(cant) || cant === 0)
    return res.status(400).json({ error: 'Movimiento inválido' });
  const p = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const nuevo = p.stock + (tipo === 'entrada' ? Math.abs(cant) : cant);
  if (nuevo < 0) return res.status(400).json({ error: 'El stock no puede quedar negativo' });
  db.transaction(() => {
    db.prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevo, p.id);
    db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id) VALUES (?,?,?,?,?,?)')
      .run(p.id, tipo, tipo === 'entrada' ? Math.abs(cant) : cant, nuevo, motivo || null, req.usuario.id);
  })();
  emitir('stock', { producto_id: p.id, stock: nuevo });
  res.json({ ok: true, stock: nuevo });
});

// Baja lógica (no se borra para conservar el historial)
router.delete('/:id', soloRol('admin'), (req, res) => {
  db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(req.params.id);
  emitir('stock', { producto_id: Number(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
