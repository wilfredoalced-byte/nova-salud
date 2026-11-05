const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const hoy = db.prepare(`SELECT COUNT(*) n, IFNULL(SUM(total),0) total FROM ventas
    WHERE estado='emitida' AND date(fecha) = date('now','localtime')`).get();
  const mes = db.prepare(`SELECT IFNULL(SUM(total),0) total FROM ventas
    WHERE estado='emitida' AND strftime('%Y-%m',fecha) = strftime('%Y-%m','now','localtime')`).get();
  const productos = db.prepare('SELECT COUNT(*) n, IFNULL(SUM(stock*precio_compra),0) valor FROM productos WHERE activo=1').get();
  const alertas = db.prepare(`SELECT tipo_alerta, COUNT(*) n FROM v_alertas GROUP BY tipo_alerta`).all();
  const ultimos7 = db.prepare(`WITH RECURSIVE d(x) AS (SELECT date('now','localtime','-6 day') UNION ALL
      SELECT date(x,'+1 day') FROM d WHERE x < date('now','localtime'))
    SELECT d.x fecha, IFNULL(SUM(v.total),0) total FROM d LEFT JOIN ventas v
      ON date(v.fecha) = d.x AND v.estado='emitida' GROUP BY d.x ORDER BY d.x`).all();
  const top = db.prepare(`SELECT p.nombre, SUM(d.cantidad) unidades, SUM(d.importe) importe FROM detalle_ventas d
    JOIN ventas v ON v.id=d.venta_id AND v.estado='emitida' JOIN productos p ON p.id=d.producto_id
    GROUP BY p.id ORDER BY unidades DESC LIMIT 5`).all();
  res.json({ hoy, mes, productos, alertas, ultimos7, top });
});

module.exports = router;
