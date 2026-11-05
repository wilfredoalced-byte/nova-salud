const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { SECRET, verificarToken } = require('../middleware/auth');

// Máximo 10 intentos de login cada 15 minutos por IP (protección contra fuerza bruta)
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos. Intente en 15 minutos.' } });

router.post('/login', limiteLogin, (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(String(usuario).trim());
  if (!u || !bcrypt.compareSync(password, u.password_hash))
    return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = jwt.sign({ id: u.id, nombre: u.nombre, rol: u.rol }, SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: { id: u.id, nombre: u.nombre, rol: u.rol } });
});

router.get('/perfil', verificarToken, (req, res) => res.json(req.usuario));

module.exports = router;
