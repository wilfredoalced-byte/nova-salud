// Middleware de seguridad: verifica el token JWT y el rol del usuario
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';

function verificarToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloRol(...roles) {
  return (req, res, next) =>
    roles.includes(req.usuario.rol) ? next() : res.status(403).json({ error: 'No autorizado para esta acción' });
}

module.exports = { verificarToken, soloRol, SECRET };
