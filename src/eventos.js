// Server-Sent Events: notifica en tiempo real los cambios de stock a todos los navegadores conectados
const clientes = new Set();

function suscribir(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('event: conectado\ndata: {}\n\n');
  clientes.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clientes.delete(res); });
}

function emitir(evento, datos) {
  const msg = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  clientes.forEach(res => res.write(msg));
}

module.exports = { suscribir, emitir };
