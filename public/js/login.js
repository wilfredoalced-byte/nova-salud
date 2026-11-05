document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginError');
  err.hidden = true;
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario.value, password: password.value })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    sessionStorage.setItem('ns_token', data.token);
    sessionStorage.setItem('ns_user', JSON.stringify(data.usuario));
    location.href = '/app.html';
  } catch (ex) {
    err.textContent = ex.message || 'No se pudo iniciar sesión';
    err.hidden = false;
  }
});
