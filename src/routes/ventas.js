const router = require('express').Router();
const db = require('../db');
const { soloRol } = require('../middleware/auth');
const { emitir } = require('../eventos');

const IGV = 0.18;
const r2 = n => Math.round(n * 100) / 100;

// Registrar una venta: valida stock, descuenta inventario y genera boleta en una sola transacción
router.post('/', (req, res) => {
  const { items, cliente_id, metodo_pago } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'La venta no tiene productos' });
  if (!['efectivo', 'tarjeta', 'yape', 'plin'].includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });

  const getProd = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1');
  try {
    const venta = db.transaction(() => {
      let total = 0;
      const lineas = items.map(it => {
        const cant = Number(it.cantidad);
        const p = getProd.get(it.producto_id);
        if (!p) throw { status: 400, msg: `Producto ${it.producto_id} no existe` };
        if (!Number.isInteger(cant) || cant <= 0) throw { status: 400, msg: `Cantidad inválida para ${p.nombre}` };
        if (p.stock < cant) throw { status: 409, msg: `Stock insuficiente de ${p.nombre} (disponible: ${p.stock})` };
        const importe = r2(p.precio_venta * cant);
        total += importe;
        return { p, cant, importe };
      });
      total = r2(total);
      const subtotal = r2(total / (1 + IGV));
      const igv = r2(total - subtotal);
      const correlativo = (db.prepare('SELECT COUNT(*) c FROM ventas').get().c + 1).toString().padStart(6, '0');
      const numero = `B001-${correlativo}`;
      const v = db.prepare('INSERT INTO ventas (numero,cliente_id,usuario_id,subtotal,igv,total,metodo_pago) VALUES (?,?,?,?,?,?,?)')
        .run(numero, cliente_id || null, req.usuario.id, subtotal, igv, total, metodo_pago);

      const insDet = db.prepare('INSERT INTO detalle_ventas (venta_id,producto_id,cantidad,precio_unitario,importe) VALUES (?,?,?,?,?)');
      const updStock = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?');
      const insMov = db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id) VALUES (?,?,?,?,?,?)');
      lineas.forEach(({ p, cant, importe }) => {
        insDet.run(v.lastInsertRowid, p.id, cant, p.precio_venta, importe);
        updStock.run(cant, p.id);
        insMov.run(p.id, 'salida', -cant, p.stock - cant, `Venta ${numero}`, req.usuario.id);
      });
      return { id: v.lastInsertRowid, numero, subtotal, igv, total };
    })();
    emitir('stock', { venta: venta.numero });
    res.status(201).json(venta);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.msg });
    throw e;
  }
});

router.get('/', (req, res) => {
  const desde = req.query.desde || '2000-01-01';
  const hasta = req.query.hasta || '2999-12-31';
  res.json(db.prepare(`SELECT v.*, c.nombre cliente, u.nombre vendedor,
      (SELECT SUM(cantidad) FROM detalle_ventas d WHERE d.venta_id = v.id) unidades
    FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id JOIN usuarios u ON u.id = v.usuario_id
    WHERE date(v.fecha) BETWEEN ? AND ? ORDER BY v.id DESC`).all(desde, hasta));
});

router.get('/:id', (req, res) => {
  const v = db.prepare(`SELECT v.*, c.nombre cliente, c.dni, u.nombre vendedor FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id JOIN usuarios u ON u.id = v.usuario_id WHERE v.id = ?`).get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  v.items = db.prepare(`SELECT d.*, p.nombre, p.presentacion FROM detalle_ventas d JOIN productos p ON p.id = d.producto_id
    WHERE d.venta_id = ?`).all(v.id);
  res.json(v);
});

// Anular venta y devolver el stock (solo administrador)
router.post('/:id/anular', soloRol('admin'), (req, res) => {
  const v = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  if (v.estado === 'anulada') return res.status(400).json({ error: 'La venta ya está anulada' });
  db.transaction(() => {
    db.prepare("UPDATE ventas SET estado = 'anulada' WHERE id = ?").run(v.id);
    db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(v.id).forEach(d => {
      db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?').run(d.cantidad, d.producto_id);
      const s = db.prepare('SELECT stock FROM productos WHERE id = ?').get(d.producto_id).stock;
      db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id) VALUES (?,?,?,?,?,?)')
        .run(d.producto_id, 'anulacion', d.cantidad, s, `Anulación ${v.numero}`, req.usuario.id);
    });
  })();
  emitir('stock', { anulada: v.numero });
  res.json({ ok: true });
});

module.exports = router;
