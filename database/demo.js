// Genera ventas de ejemplo de los últimos 6 días (opcional: npm run demo)
const db = require('../src/db');
if (db.prepare('SELECT COUNT(*) c FROM ventas').get().c > 0) { console.log('Ya existen ventas, no se generan datos demo.'); process.exit(); }

const plan = [ // [días atrás, [[producto_id, cantidad], ...], cliente, pago]
  [6, [[1, 2], [8, 4]], 1, 'efectivo'], [6, [[6, 1], [11, 2]], null, 'yape'],
  [5, [[3, 1], [1, 1]], 2, 'tarjeta'], [5, [[14, 3]], null, 'efectivo'], [5, [[9, 2], [13, 1]], 3, 'plin'],
  [4, [[5, 2], [11, 1]], null, 'efectivo'],
  [3, [[1, 3], [6, 2], [8, 5]], 1, 'yape'], [3, [[10, 1]], 2, 'tarjeta'], [3, [[14, 2]], null, 'efectivo'],
  [2, [[3, 2], [13, 1]], 3, 'efectivo'], [2, [[1, 2]], null, 'plin'],
  [1, [[6, 3], [11, 2], [8, 6]], 2, 'yape'], [1, [[5, 1], [1, 2]], null, 'efectivo'], [1, [[9, 1], [14, 2]], 1, 'tarjeta'],
];
let n = 0;
const fecha = (d, h) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, (n * 17) % 60, 0);
  const p = v => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:00`; };

db.transaction(() => {
  for (const [dias, items, cli, pago] of plan) {
    n++;
    const f = fecha(dias, 9 + (n % 9));
    const lineas = items.map(([id, c]) => ({ p: db.prepare('SELECT * FROM productos WHERE id=?').get(id), c }));
    const total = Math.round(lineas.reduce((s, l) => s + l.p.precio_venta * l.c, 0) * 100) / 100;
    const sub = Math.round(total / 1.18 * 100) / 100;
    const numero = 'B001-' + String(n).padStart(6, '0');
    const v = db.prepare('INSERT INTO ventas (numero,cliente_id,usuario_id,subtotal,igv,total,metodo_pago,fecha) VALUES (?,?,?,?,?,?,?,?)')
      .run(numero, cli, 2, sub, Math.round((total - sub) * 100) / 100, total, pago, f);
    for (const { p, c } of lineas) {
      db.prepare('INSERT INTO detalle_ventas (venta_id,producto_id,cantidad,precio_unitario,importe) VALUES (?,?,?,?,?)')
        .run(v.lastInsertRowid, p.id, c, p.precio_venta, Math.round(p.precio_venta * c * 100) / 100);
      db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?').run(c, p.id);
      db.prepare('INSERT INTO movimientos (producto_id,tipo,cantidad,stock_final,motivo,usuario_id,fecha) VALUES (?,?,?,?,?,?,?)')
        .run(p.id, 'salida', -c, p.stock - c, 'Venta ' + numero, 2, f);
    }
  }
})();
console.log(`✔ ${n} ventas de demostración generadas.`);
