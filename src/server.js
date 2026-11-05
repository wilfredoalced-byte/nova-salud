// =====================================================
//  Nova Salud - Servidor web (Node.js + Express)
// =====================================================
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { verificarToken } = require('./middleware/auth');
const { suscribir } = require('./eventos');

const app = express();
// Cabeceras HTTP de seguridad (OWASP). Se desactiva upgrade-insecure-requests para poder
// acceder por la red local (http://IP:3000) desde celulares y tablets; en producción usar HTTPS.
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use(express.json({ limit: '100kb' }));  // Limita el tamaño de las peticiones
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas públicas
app.use('/api/auth', require('./routes/auth'));

// Rutas protegidas con JWT
app.get('/api/eventos', verificarToken, suscribir);
app.use('/api/productos', verificarToken, require('./routes/productos'));
app.use('/api/ventas', verificarToken, require('./routes/ventas'));
app.use('/api/clientes', verificarToken, require('./routes/clientes'));
app.use('/api/dashboard', verificarToken, require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

// Manejo centralizado de errores (no expone detalles internos)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`✔ Nova Salud ejecutándose en http://localhost:${PORT}`));
}
module.exports = app;
