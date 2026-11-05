// Pruebas de integración de la API (node:test, sin dependencias extra)
const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.DB_PATH = path.join(os.tmpdir(), `novasalud-test-${Date.now()}.db`);
const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/server');

let base, server, tokenAdmin, tokenVend;
const req = async (method, url, body, token) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};

test.before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => { server.close(); fs.rmSync(process.env.DB_PATH, { force: true }); });

test('Login rechaza credenciales incorrectas', async () => {
  const r = await req('POST', '/auth/login', { usuario: 'admin', password: 'mala' });
  assert.strictEqual(r.status, 401);
});

test('Login correcto devuelve token JWT', async () => {
  const a = await req('POST', '/auth/login', { usuario: 'admin', password: 'Admin123*' });
  const v = await req('POST', '/auth/login', { usuario: 'vendedor', password: 'Venta123*' });
  assert.strictEqual(a.status, 200); assert.ok(a.data.token);
  tokenAdmin = a.data.token; tokenVend = v.data.token;
});

test('Las rutas protegidas exigen token', async () => {
  const r = await req('GET', '/productos');
  assert.strictEqual(r.status, 401);
});

test('Lista de productos y búsqueda', async () => {
  const r = await req('GET', '/productos?q=paracetamol', null, tokenVend);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.data[0].codigo, '7750001');
});

test('El vendedor NO puede crear productos (control de roles)', async () => {
  const r = await req('POST', '/productos', { codigo: 'X1', nombre: 'Test', precio_venta: 1, stock: 1, stock_minimo: 1 }, tokenVend);
  assert.strictEqual(r.status, 403);
});

test('El administrador crea un producto con validación', async () => {
  const mal = await req('POST', '/productos', { codigo: '', nombre: '', precio_venta: -1, stock: 1, stock_minimo: 1 }, tokenAdmin);
  assert.strictEqual(mal.status, 400);
  const ok = await req('POST', '/productos', { codigo: '9990001', nombre: 'Producto de prueba', precio_venta: 10, stock: 5, stock_minimo: 3 }, tokenAdmin);
  assert.strictEqual(ok.status, 201);
});

test('Venta descuenta stock y calcula IGV', async () => {
  const antes = (await req('GET', '/productos?q=7750001', null, tokenVend)).data[0].stock;
  const v = await req('POST', '/ventas', { items: [{ producto_id: 1, cantidad: 2 }], metodo_pago: 'efectivo' }, tokenVend);
  assert.strictEqual(v.status, 201);
  assert.strictEqual(v.data.total, 30);
  assert.strictEqual(Math.round((v.data.subtotal + v.data.igv) * 100) / 100, 30);
  const despues = (await req('GET', '/productos?q=7750001', null, tokenVend)).data[0].stock;
  assert.strictEqual(despues, antes - 2);
});

test('No permite vender más que el stock disponible', async () => {
  const r = await req('POST', '/ventas', { items: [{ producto_id: 1, cantidad: 99999 }], metodo_pago: 'efectivo' }, tokenVend);
  assert.strictEqual(r.status, 409);
});

test('Alerta automática al llegar al stock mínimo', async () => {
  await req('POST', '/ventas', { items: [{ producto_id: 15, cantidad: 3 }], metodo_pago: 'yape' }, tokenVend);
  const a = await req('GET', '/productos/alertas', null, tokenVend);
  assert.ok(a.data.some(x => x.codigo === '9990001' && x.tipo_alerta === 'stock_bajo'));
});

test('Anular venta devuelve el stock (kardex)', async () => {
  const r = await req('POST', '/ventas/1/anular', null, tokenAdmin);
  assert.strictEqual(r.status, 200);
  const k = await req('GET', '/productos/1/kardex', null, tokenAdmin);
  assert.strictEqual(k.data[0].tipo, 'anulacion');
});
