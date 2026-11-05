const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND v.estado='emitida') compras,
      (SELECT IFNULL(SUM(total),0) FROM ventas v WHERE v.cliente_id = c.id AND v.estado='emitida') total_comprado
    FROM clientes c WHERE c.nombre LIKE ? OR c.dni LIKE ? ORDER BY c.nombre`).all(q, q));
});

router.post('/', (req, res) => {
  const { dni, nombre, telefono, email } = req.body || {};
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (dni && !/^\d{8}$/.test(dni)) return res.status(400).json({ error: 'El DNI debe tener 8 dígitos' });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido' });
  try {
    const r = db.prepare('INSERT INTO clientes (dni,nombre,telefono,email) VALUES (?,?,?,?)')
      .run(dni || null, nombre.trim(), telefono || null, email || null);
    res.status(201).json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
    throw e;
  }
});

module.exports = router;
