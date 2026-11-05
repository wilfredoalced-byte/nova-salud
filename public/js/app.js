// =====================================================
//  Nova Salud - Lógica del frontend (SPA en JavaScript)
// =====================================================
const TOKEN = sessionStorage.getItem('ns_token');
const USER = JSON.parse(sessionStorage.getItem('ns_user') || 'null');
if (!TOKEN || !USER) location.href = '/';
const ES_ADMIN = USER && USER.rol === 'admin';

const $ = (s, el = document) => el.querySelector(s);
const content = $('#content');
const soles = n => 'S/ ' + Number(n || 0).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaCorta = f => f ? new Date(f.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '';

// ---------- API con token JWT ----------
async function api(url, opts = {}) {
  const r = await fetch('/api' + url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (r.status === 401) { sessionStorage.clear(); location.href = '/'; return; }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}

function toast(msg, tipo = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function abrirModal(titulo, html) {
  $('#modalTitle').textContent = titulo;
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
}
const cerrarModal = () => { $('#modal').hidden = true; };

function estadoStock(p) {
  if (p.stock === 0) return '<span class="pill agotado">Agotado</span>';
  if (p.stock <= p.stock_minimo) return '<span class="pill bajo">Stock bajo</span>';
  if (p.dias_vencer != null && p.dias_vencer <= 60) return `<span class="pill vence">Vence en ${p.dias_vencer} d</span>`;
  return '<span class="pill ok">Disponible</span>';
}

// ---------- Usuario y navegación ----------
$('#userName').textContent = USER.nombre;
$('#userRol').textContent = USER.rol;
$('#avatar').textContent = USER.nombre[0];
$('#btnSalir').onclick = () => { sessionStorage.clear(); location.href = '/'; };
$('#btnMenu').onclick = () => $('#sidebar').classList.toggle('open');

const VISTAS = {
  dashboard: ['Panel de control', vistaDashboard],
  pos: ['Punto de venta', vistaPOS],
  inventario: ['Inventario de productos', vistaInventario],
  alertas: ['Alertas de reposición y vencimiento', vistaAlertas],
  ventas: ['Historial de ventas', vistaVentas],
  clientes: ['Clientes', vistaClientes]
};
let vistaActual = '';
function navegar() {
  const v = (location.hash || '#dashboard').slice(1);
  const [titulo, fn] = VISTAS[v] || VISTAS.dashboard;
  vistaActual = v;
  $('#viewTitle').textContent = titulo;
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
  $('#sidebar').classList.remove('open');
  fn();
}
window.addEventListener('hashchange', navegar);

// ---------- Tiempo real (Server-Sent Events) ----------
async function actualizarBadge() {
  const a = await api('/productos/alertas');
  $('#badgeAlertas').textContent = a.length;
  $('#badgeAlertas').hidden = a.length === 0;
  return a;
}
function conectarTiempoReal() {
  const es = new EventSource('/api/eventos?token=' + encodeURIComponent(TOKEN));
  es.addEventListener('conectado', () => $('#liveStatus').classList.remove('off'));
  es.addEventListener('stock', async () => {
    const antes = Number($('#badgeAlertas').textContent);
    const alertas = await actualizarBadge();
    if (alertas.length > antes) toast(`⚠ Nueva alerta de stock: ${alertas.length} productos requieren atención`, 'warn');
    if (['inventario', 'alertas', 'dashboard'].includes(vistaActual)) VISTAS[vistaActual][1]();
  });
  es.onerror = () => $('#liveStatus').classList.add('off');
}

// ================= DASHBOARD =================
async function vistaDashboard() {
  const d = await api('/dashboard');
  const n = t => (d.alertas.find(a => a.tipo_alerta === t) || {}).n || 0;
  const max = Math.max(...d.ultimos7.map(x => x.total), 1);
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  content.innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="ico" style="background:#ccfbf1">💰</div><div><small>Ventas de hoy</small><b>${soles(d.hoy.total)}</b><small>${d.hoy.n} boletas emitidas</small></div></div>
      <div class="card kpi"><div class="ico" style="background:#dbeafe">📅</div><div><small>Ventas del mes</small><b>${soles(d.mes.total)}</b></div></div>
      <div class="card kpi"><div class="ico" style="background:#f1f5f9">💊</div><div><small>Productos activos</small><b>${d.productos.n}</b><small>Valor: ${soles(d.productos.valor)}</small></div></div>
      <div class="card kpi"><div class="ico" style="background:#fee2e2">🔔</div><div><small>Alertas activas</small><b>${n('agotado') + n('stock_bajo') + n('por_vencer')}</b>
        <small>${n('agotado')} agotados · ${n('stock_bajo')} bajos · ${n('por_vencer')} por vencer</small></div></div>
    </div>
    <div class="grid-2">
      <div class="card"><h3>Ventas de los últimos 7 días</h3>
        <div class="chart">${d.ultimos7.map(x => `<div class="bar-col"><span class="val">${x.total ? soles(x.total) : ''}</span>
          <div class="bar" style="height:${(x.total / max) * 100}%"></div></div>`).join('')}</div>
        <div class="chart-labels">${d.ultimos7.map(x => `<span>${dias[new Date(x.fecha + 'T12:00').getDay()]} ${x.fecha.slice(8)}</span>`).join('')}</div>
      </div>
      <div class="card"><h3>Productos más vendidos</h3>
        ${d.top.length ? `<table><tr><th>Producto</th><th class="num">Unid.</th><th class="num">Importe</th></tr>
          ${d.top.map(t => `<tr><td>${esc(t.nombre)}</td><td class="num">${t.unidades}</td><td class="num">${soles(t.importe)}</td></tr>`).join('')}</table>`
          : '<div class="empty">Aún no hay ventas registradas</div>'}
        <div style="margin-top:14px"><a class="btn btn-primary btn-sm" href="#pos">🛒 Nueva venta</a> <a class="btn btn-secondary btn-sm" href="#alertas">Ver alertas</a></div>
      </div>
    </div>`;
}

// ================= PUNTO DE VENTA =================
let carrito = [];
let metodoPago = 'efectivo';
let productosPOS = [];
async function vistaPOS() {
  const clientes = await api('/clientes');
  content.innerHTML = `
    <div class="pos">
      <div class="card">
        <div class="toolbar"><input id="buscarPOS" placeholder="🔍 Buscar por nombre, código o laboratorio..." autofocus></div>
        <div class="prod-grid" id="prodGrid"></div>
      </div>
      <div class="card">
        <h3>Detalle de la venta</h3>
        <label>Cliente
          <select id="clienteVenta"><option value="">Cliente varios (sin DNI)</option>
          ${clientes.map(c => `<option value="${c.id}">${esc(c.dni || '')} - ${esc(c.nombre)}</option>`).join('')}</select>
        </label>
        <div id="cartLines"></div>
        <div class="totales" id="totales"></div>
        <div class="pagos">${['efectivo', 'tarjeta', 'yape', 'plin'].map(m => `<button data-action="pago" data-m="${m}" class="${m === metodoPago ? 'sel' : ''}">${m}</button>`).join('')}</div>
        <button class="btn btn-primary btn-block" data-action="cobrar">✔ Registrar venta y emitir boleta</button>
      </div>
    </div>`;
  $('#buscarPOS').addEventListener('input', e => cargarProductosPOS(e.target.value));
  await cargarProductosPOS('');
  pintarCarrito();
}
async function cargarProductosPOS(q) {
  productosPOS = await api('/productos?q=' + encodeURIComponent(q));
  $('#prodGrid').innerHTML = productosPOS.map(p => `
    <button class="prod" data-action="agregar" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
      <b>${esc(p.nombre)}</b><small>${esc(p.presentacion || '')} · ${esc(p.laboratorio || '')}</small>
      <div class="precio">${soles(p.precio_venta)} <small>Stock: ${p.stock}</small></div>
      ${p.requiere_receta ? '<small style="color:#b45309">℞ Requiere receta</small>' : ''}
    </button>`).join('') || '<div class="empty">Sin resultados</div>';
}
function pintarCarrito() {
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const sub = total / 1.18;
  $('#cartLines').innerHTML = carrito.length ? carrito.map((i, k) => `
    <div class="cart-line"><div><b>${esc(i.nombre)}</b><br><small class="muted">${soles(i.precio)} c/u</small></div>
      <div class="qty"><button data-action="menos" data-k="${k}">−</button><span>${i.cantidad}</span><button data-action="mas" data-k="${k}">+</button></div>
      <b class="num">${soles(i.precio * i.cantidad)}</b><button class="btn-icon" data-action="quitar" data-k="${k}">🗑</button></div>`).join('')
    : '<div class="empty">Seleccione productos de la lista para agregarlos</div>';
  $('#totales').innerHTML = `<div><span>Op. gravada</span><span>${soles(sub)}</span></div>
    <div><span>IGV (18%)</span><span>${soles(total - sub)}</span></div>
    <div class="total"><span>TOTAL</span><span>${soles(total)}</span></div>`;
}

// ================= INVENTARIO =================
async function vistaInventario() {
  const q = $('#buscarInv')?.value || '';
  if (!$('#buscarInv')) {
    content.innerHTML = `<div class="card">
      <div class="toolbar"><input id="buscarInv" placeholder="🔍 Buscar producto..."><span class="spacer"></span>
        ${ES_ADMIN ? '<button class="btn btn-primary" data-action="nuevo-producto">＋ Nuevo producto</button>' : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th class="hide-sm">Categoría</th><th class="hide-sm">Laboratorio</th>
        <th class="num">P. venta</th><th class="num">Stock</th><th class="num hide-sm">Mín.</th><th class="hide-sm">Vence</th><th>Estado</th><th></th></tr></thead>
        <tbody id="tbInv"></tbody></table></div></div>`;
    $('#buscarInv').addEventListener('input', vistaInventario);
  }
  const rows = await api('/productos?q=' + encodeURIComponent(q));
  $('#tbInv').innerHTML = rows.map(p => `<tr>
    <td>${esc(p.codigo)}</td><td><b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.presentacion || '')}</small></td>
    <td class="hide-sm">${esc(p.categoria || '')}</td><td class="hide-sm">${esc(p.laboratorio || '')}</td>
    <td class="num">${soles(p.precio_venta)}</td><td class="num"><b>${p.stock}</b></td><td class="num hide-sm">${p.stock_minimo}</td>
    <td class="hide-sm">${esc(p.fecha_vencimiento || '')}</td><td>${estadoStock(p)}</td>
    <td><div class="acciones"><button class="btn btn-secondary btn-sm" data-action="kardex" data-id="${p.id}">Kardex</button>
      ${ES_ADMIN ? `<button class="btn btn-secondary btn-sm" data-action="entrada" data-id="${p.id}">＋ Stock</button>
      <button class="btn btn-secondary btn-sm" data-action="editar" data-id="${p.id}">Editar</button>` : ''}</div></td></tr>`).join('')
    || '<tr><td colspan="10" class="empty">No se encontraron productos</td></tr>';
  window._inv = rows;
}
async function formProducto(p = {}) {
  const cats = await api('/productos/categorias');
  abrirModal(p.id ? 'Editar producto' : 'Nuevo producto', `
    <form id="formProd" class="form-grid">
      <label>Código de barras<input name="codigo" required value="${esc(p.codigo || '')}"></label>
      <label>Categoría<select name="categoria_id">${cats.map(c => `<option value="${c.id}" ${c.id === p.categoria_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label class="full">Nombre del producto<input name="nombre" required value="${esc(p.nombre || '')}"></label>
      <label>Presentación<input name="presentacion" value="${esc(p.presentacion || '')}"></label>
      <label>Laboratorio<input name="laboratorio" value="${esc(p.laboratorio || '')}"></label>
      <label>Precio de compra (S/)<input name="precio_compra" type="number" step="0.01" min="0" value="${p.precio_compra ?? ''}"></label>
      <label>Precio de venta (S/)<input name="precio_venta" type="number" step="0.01" min="0" required value="${p.precio_venta ?? ''}"></label>
      <label>Stock inicial<input name="stock" type="number" min="0" required value="${p.stock ?? 0}" ${p.id ? 'disabled' : ''}></label>
      <label>Stock mínimo (alerta)<input name="stock_minimo" type="number" min="0" required value="${p.stock_minimo ?? 10}"></label>
      <label>Lote<input name="lote" value="${esc(p.lote || '')}"></label>
      <label>Fecha de vencimiento<input name="fecha_vencimiento" type="date" value="${esc(p.fecha_vencimiento || '')}"></label>
      <label class="full" style="display:flex;gap:8px;align-items:center"><input name="requiere_receta" type="checkbox" style="width:auto;margin:0" ${p.requiere_receta ? 'checked' : ''}> Requiere receta médica</label>
      <div class="form-actions full">${p.id ? `<button type="button" class="btn btn-danger" data-action="eliminar" data-id="${p.id}">Dar de baja</button><span class="spacer" style="flex:1"></span>` : ''}
        <button type="button" class="btn btn-secondary" data-action="cerrar-modal">Cancelar</button><button class="btn btn-primary">Guardar</button></div>
    </form>`);
  $('#formProd').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.requiere_receta = !!f.requiere_receta;
    if (p.id) f.stock = p.stock;
    try {
      await api('/productos' + (p.id ? '/' + p.id : ''), { method: p.id ? 'PUT' : 'POST', body: f });
      cerrarModal(); toast('Producto guardado correctamente', 'ok'); vistaInventario();
    } catch (ex) { toast(ex.message, 'err'); }
  };
}
function formEntrada(p) {
  abrirModal('Registrar entrada de mercadería', `
    <p><b>${esc(p.nombre)}</b> — stock actual: <b>${p.stock}</b> (mínimo ${p.stock_minimo})</p>
    <form id="formMov" class="form-grid">
      <label>Tipo<select name="tipo"><option value="entrada">Entrada (compra a proveedor)</option><option value="ajuste">Ajuste (+/−)</option></select></label>
      <label>Cantidad<input name="cantidad" type="number" required value="${Math.max(p.stock_minimo * 2 - p.stock, 1)}"></label>
      <label class="full">Motivo / N° guía o factura<input name="motivo" placeholder="Ej. Factura F001-2345 Distribuidora Química Suiza"></label>
      <div class="form-actions full"><button type="button" class="btn btn-secondary" data-action="cerrar-modal">Cancelar</button><button class="btn btn-primary">Registrar</button></div>
    </form>`);
  $('#formMov').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(`/productos/${p.id}/movimiento`, { method: 'POST', body: { ...f, cantidad: Number(f.cantidad) } });
      cerrarModal(); toast(`Stock actualizado: ${r.stock} unidades`, 'ok');
    } catch (ex) { toast(ex.message, 'err'); }
  };
}
async function verKardex(id) {
  const p = window._inv?.find(x => x.id == id) || {};
  const m = await api(`/productos/${id}/kardex`);
  abrirModal('Kardex · ' + (p.nombre || ''), `<div class="table-wrap"><table><tr><th>Fecha</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Saldo</th><th>Motivo</th><th>Usuario</th></tr>
    ${m.map(x => `<tr><td>${fechaCorta(x.fecha)}</td><td>${x.tipo}</td><td class="num">${x.cantidad > 0 ? '+' : ''}${x.cantidad}</td><td class="num"><b>${x.stock_final}</b></td>
    <td>${esc(x.motivo || '')}</td><td>${esc(x.usuario || '')}</td></tr>`).join('')}</table></div>`);
}

// ================= ALERTAS =================
async function vistaAlertas() {
  const a = await actualizarBadge();
  const etiqueta = { agotado: ['Agotado', 'agotado'], stock_bajo: ['Stock bajo', 'bajo'], por_vencer: ['Próximo a vencer', 'vence'] };
  content.innerHTML = `<div class="card">
    <p class="muted" style="margin-top:0">El sistema genera alertas automáticamente cuando el stock llega al mínimo configurado o el producto vence en 60 días o menos. Se actualiza en tiempo real.</p>
    ${a.map(x => `<div class="alert-row ${x.tipo_alerta}">
      <span class="pill ${etiqueta[x.tipo_alerta][1]}">${etiqueta[x.tipo_alerta][0]}</span>
      <div class="info"><b>${esc(x.nombre)}</b><small>Código ${esc(x.codigo)} · Stock ${x.stock} / mínimo ${x.stock_minimo}
        ${x.fecha_vencimiento ? ` · Vence ${x.fecha_vencimiento} (${x.dias_vencer} días)` : ''}</small></div>
      ${x.tipo_alerta !== 'por_vencer' ? `<b>Sugerido reponer: ${Math.max(x.stock_minimo * 2 - x.stock, 1)} u.</b>` : '<b>Priorizar su venta</b>'}
      ${ES_ADMIN ? `<button class="btn btn-primary btn-sm" data-action="entrada" data-id="${x.id}">Reponer</button>` : ''}
    </div>`).join('') || '<div class="empty">✅ No hay alertas. Todo el inventario está en niveles óptimos.</div>'}
  </div>`;
  window._inv = (await api('/productos'));
}

// ================= VENTAS =================
async function vistaVentas() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (!$('#vDesde')) {
    content.innerHTML = `<div class="card"><div class="toolbar">
      <label style="margin:0">Desde<input type="date" id="vDesde" value="${hoy.slice(0, 8)}01"></label>
      <label style="margin:0">Hasta<input type="date" id="vHasta" value="${hoy}"></label>
      <span class="spacer"></span><div id="vResumen" class="muted"></div></div>
      <div class="table-wrap"><table><thead><tr><th>N° boleta</th><th>Fecha</th><th>Cliente</th><th class="hide-sm">Vendedor</th><th class="hide-sm">Pago</th>
      <th class="num">Unid.</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody id="tbVentas"></tbody></table></div></div>`;
    $('#vDesde').onchange = $('#vHasta').onchange = vistaVentas;
  }
  const v = await api(`/ventas?desde=${$('#vDesde').value}&hasta=${$('#vHasta').value}`);
  const tot = v.filter(x => x.estado === 'emitida').reduce((s, x) => s + x.total, 0);
  $('#vResumen').innerHTML = `${v.length} comprobantes · Total vendido: <b>${soles(tot)}</b>`;
  $('#tbVentas').innerHTML = v.map(x => `<tr><td><b>${x.numero}</b></td><td>${fechaCorta(x.fecha)}</td><td>${esc(x.cliente || 'Cliente varios')}</td>
    <td class="hide-sm">${esc(x.vendedor)}</td><td class="hide-sm" style="text-transform:capitalize">${x.metodo_pago}</td><td class="num">${x.unidades}</td>
    <td class="num"><b>${soles(x.total)}</b></td><td>${x.estado === 'emitida' ? '<span class="pill ok">Emitida</span>' : '<span class="pill anulada">Anulada</span>'}</td>
    <td><div class="acciones"><button class="btn btn-secondary btn-sm" data-action="boleta" data-id="${x.id}">Ver</button>
    ${ES_ADMIN && x.estado === 'emitida' ? `<button class="btn btn-danger btn-sm" data-action="anular" data-id="${x.id}">Anular</button>` : ''}</div></td></tr>`).join('')
    || '<tr><td colspan="9" class="empty">No hay ventas en el rango seleccionado</td></tr>';
}
async function verBoleta(id) {
  const v = await api('/ventas/' + id);
  abrirModal('Boleta de venta electrónica', `<div class="boleta">
    <div class="c"><b>BOTICA NOVA SALUD S.A.C.</b><br>RUC 20601234567<br>Av. Comercio 123 - Lima<br><hr>
    <b>BOLETA DE VENTA ELECTRÓNICA<br>${v.numero}</b></div><hr>
    Fecha: ${fechaCorta(v.fecha)}<br>Cliente: ${esc(v.cliente || 'Cliente varios')}${v.dni ? '<br>DNI: ' + v.dni : ''}<br>Atendido por: ${esc(v.vendedor)}<hr>
    <table style="width:100%"><tr><th>Cant</th><th>Descripción</th><th class="num">Importe</th></tr>
    ${v.items.map(i => `<tr><td>${i.cantidad}</td><td>${esc(i.nombre)}<br><small>${soles(i.precio_unitario)} c/u</small></td><td class="num">${soles(i.importe)}</td></tr>`).join('')}</table><hr>
    <table style="width:100%"><tr><td>Op. gravada</td><td class="num">${soles(v.subtotal)}</td></tr><tr><td>IGV 18%</td><td class="num">${soles(v.igv)}</td></tr>
    <tr><td><b>TOTAL</b></td><td class="num"><b>${soles(v.total)}</b></td></tr><tr><td>Pago</td><td class="num" style="text-transform:capitalize">${v.metodo_pago}</td></tr></table><hr>
    <div class="c">${v.estado === 'anulada' ? '<b>*** ANULADA ***</b><br>' : ''}¡Gracias por su compra!<br>Cuide su salud, consulte a su médico.</div></div>
    <div class="form-actions"><button class="btn btn-secondary" data-action="imprimir">🖨 Imprimir</button></div>`);
}

// ================= CLIENTES =================
async function vistaClientes() {
  const c = await api('/clientes');
  content.innerHTML = `<div class="card"><div class="toolbar"><span class="muted">${c.length} clientes registrados</span><span class="spacer"></span>
    <button class="btn btn-primary" data-action="nuevo-cliente">＋ Nuevo cliente</button></div>
    <div class="table-wrap"><table><tr><th>DNI</th><th>Nombre</th><th class="hide-sm">Teléfono</th><th class="hide-sm">Correo</th><th class="num">Compras</th><th class="num">Total comprado</th></tr>
    ${c.map(x => `<tr><td>${esc(x.dni || '')}</td><td><b>${esc(x.nombre)}</b></td><td class="hide-sm">${esc(x.telefono || '')}</td><td class="hide-sm">${esc(x.email || '')}</td>
    <td class="num">${x.compras}</td><td class="num">${soles(x.total_comprado)}</td></tr>`).join('')}</table></div></div>`;
}
function formCliente() {
  abrirModal('Nuevo cliente', `<form id="formCli" class="form-grid">
    <label>DNI<input name="dni" maxlength="8" pattern="\\d{8}" placeholder="8 dígitos"></label>
    <label>Teléfono<input name="telefono" maxlength="15"></label>
    <label class="full">Nombres y apellidos<input name="nombre" required></label>
    <label class="full">Correo electrónico<input name="email" type="email"></label>
    <div class="form-actions full"><button type="button" class="btn btn-secondary" data-action="cerrar-modal">Cancelar</button><button class="btn btn-primary">Guardar</button></div></form>`);
  $('#formCli').onsubmit = async e => {
    e.preventDefault();
    try { await api('/clientes', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      cerrarModal(); toast('Cliente registrado', 'ok'); if (vistaActual === 'clientes') vistaClientes(); }
    catch (ex) { toast(ex.message, 'err'); }
  };
}

// ---------- Delegación de eventos (sin JavaScript en línea, compatible con CSP) ----------
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const { action, id, k } = b.dataset;
  const prod = () => (window._inv || []).find(x => x.id == id);
  try {
    switch (action) {
      case 'cerrar-modal': cerrarModal(); break;
      case 'agregar': {
        const p = productosPOS.find(x => x.id == id);
        const linea = carrito.find(i => i.id === p.id);
        if (linea) { if (linea.cantidad < p.stock) linea.cantidad++; else toast('No hay más stock disponible', 'warn'); }
        else carrito.push({ id: p.id, nombre: p.nombre, precio: p.precio_venta, cantidad: 1, stock: p.stock });
        pintarCarrito(); break;
      }
      case 'mas': if (carrito[k].cantidad < carrito[k].stock) carrito[k].cantidad++; else toast('Stock máximo alcanzado', 'warn'); pintarCarrito(); break;
      case 'menos': if (--carrito[k].cantidad === 0) carrito.splice(k, 1); pintarCarrito(); break;
      case 'quitar': carrito.splice(k, 1); pintarCarrito(); break;
      case 'pago': metodoPago = b.dataset.m; document.querySelectorAll('.pagos button').forEach(x => x.classList.toggle('sel', x === b)); break;
      case 'cobrar': {
        if (!carrito.length) return toast('Agregue al menos un producto', 'warn');
        const v = await api('/ventas', { method: 'POST', body: {
          items: carrito.map(i => ({ producto_id: i.id, cantidad: i.cantidad })), cliente_id: $('#clienteVenta').value || null, metodo_pago: metodoPago } });
        carrito = []; toast(`Venta ${v.numero} registrada: ${soles(v.total)}`, 'ok');
        await cargarProductosPOS($('#buscarPOS').value); pintarCarrito(); verBoleta(v.id); break;
      }
      case 'nuevo-producto': formProducto(); break;
      case 'editar': formProducto(prod()); break;
      case 'entrada': formEntrada(prod()); break;
      case 'kardex': verKardex(id); break;
      case 'eliminar': await api('/productos/' + id, { method: 'DELETE' }); cerrarModal(); toast('Producto dado de baja', 'ok'); vistaInventario(); break;
      case 'boleta': verBoleta(id); break;
      case 'anular': await api(`/ventas/${id}/anular`, { method: 'POST' }); toast('Venta anulada y stock devuelto', 'ok'); vistaVentas(); break;
      case 'imprimir': window.print(); break;
      case 'nuevo-cliente': formCliente(); break;
    }
  } catch (ex) { toast(ex.message, 'err'); }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarModal(); });

// ---------- Inicio ----------
actualizarBadge();
conectarTiempoReal();
navegar();
