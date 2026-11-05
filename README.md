# Nova Salud: sistema web de inventario y ventas para botica

Trabajo final del curso **Fullstack Developer Software** (SENATI).
Autor: Alcedo Santiago Wilfredo · ID 1634197

Aplicación web *full stack* para la botica "Nova Salud". Con ella se gestionan el inventario, las ventas y la atención al cliente. El stock se actualiza en tiempo real y el sistema genera alertas automáticas de reposición.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3 responsive, JavaScript (Fetch API, EventSource) |
| Backend | Node.js 22 + Express 5 (API REST) |
| Base de datos | SQLite (better-sqlite3) |
| Seguridad | JWT, bcrypt, Helmet, rate-limit, roles |
| Tiempo real | Server-Sent Events |

---

## GUÍA PASO A PASO (para reproducirlo y tomar tus propias capturas)

> En Windows, para tomar una captura usa **Win + Shift + S** (recorte) o **Impr Pant**. Pega cada captura en la hoja "DIBUJO / ESQUEMA / DIAGRAMA" del formato, en lugar de la evidencia que tenga el mismo número.

### Paso 1. Instalar las herramientas (Evidencia 5)
1. Instala **Node.js 22 LTS** desde https://nodejs.org (con la opción por defecto se instala también npm).
2. Instala **Visual Studio Code** (https://code.visualstudio.com) y **Git** (https://git-scm.com).
3. Abre una terminal (PowerShell o la terminal de VS Code) y verifica las versiones:
   ```
   node -v
   npm -v
   git --version
   ```
   📸 **Captura:** la terminal con las tres versiones.

### Paso 2. Abrir el proyecto e instalar dependencias (Evidencias 5 y 6)
1. Descomprime `nova-salud.zip` en, por ejemplo, `C:\Proyectos\nova-salud`.
2. Abre la carpeta en VS Code (**Archivo → Abrir carpeta**).
3. En la terminal de VS Code ejecuta:
   ```
   npm install
   ```
   📸 **Captura:** la salida de `npm install` ("found 0 vulnerabilities").
   📸 **Captura:** el panel Explorador de VS Code con las carpetas `database`, `public`, `src` y `tests` desplegadas.

> Si quieres crearlo desde cero, ejecuta `npm init -y` y después
> `npm install express better-sqlite3 bcryptjs jsonwebtoken helmet express-rate-limit dotenv`.
> Luego copia los archivos de cada carpeta.

### Paso 3. Revisar el código (Evidencias 7, 8 y 11 a 16)
Abre en VS Code y toma una captura de cada uno:
| Evidencia | Archivo | Qué mostrar |
|---|---|---|
| 7 | `database/schema.sql` | Tablas con CHECK, UNIQUE y FOREIGN KEY |
| 8 | `database/schema.sql` (final) | Índices y la vista `v_alertas` |
| 11 | `src/server.js` | Helmet y rutas protegidas |
| 12 | `src/middleware/auth.js` | Verificación del JWT y de los roles |
| 13 | `src/routes/auth.js` | Login con bcrypt y rate-limit |
| 14 | `src/routes/ventas.js` | Venta dentro de una transacción e IGV |
| 15 | `src/routes/productos.js` | Entrada de mercadería y kardex |
| 16 | `src/eventos.js` | Server-Sent Events |

### Paso 4. Configurar y ejecutar (Evidencia 17)
```
copy .env.example .env        (en Linux/Mac: cp .env.example .env)
npm run demo                  (crea la BD y carga ventas de ejemplo)
npm start
```
📸 **Captura:** el mensaje `✔ Nova Salud ejecutándose en http://localhost:3000`.

> La base de datos `database/novasalud.db` se crea sola la primera vez.
> Para empezar de cero, detén el servidor (Ctrl + C), borra los archivos `database/novasalud.db*` y vuelve a ejecutar los comandos.

### Paso 5. Probar el sistema en el navegador (Evidencias 18 a 35)
Abre **http://localhost:3000** en Chrome.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123*` | Administrador |
| `vendedor` | `Venta123*` | Vendedor |

Sigue este orden y toma una captura en cada paso:
1. **(18)** La pantalla de inicio de sesión.
2. **(19)** Escribe `admin` y una contraseña incorrecta: aparece el mensaje de error.
3. **(20)** Inicia sesión como `admin`: verás el Panel de control.
4. **(21)** Abre el menú **Inventario**.
5. **(22)** En el buscador escribe `amoxi`.
6. **(23)** Pulsa **＋ Nuevo producto** y llena el formulario: código `7750015`, nombre "Naproxeno sódico 550 mg", precio de venta `12.90`, stock `8`, stock mínimo `10` y vencimiento `2027-12-31`.
7. **(24)** Pulsa **Guardar**: el producto aparece como "Stock bajo" y llega la notificación de alerta.
8. **(25)** Abre el menú **Alertas**.
9. **(26)** En "Omeprazol" (agotado) pulsa **Reponer**, escribe el motivo (por ejemplo "Factura F001-2345") y registra la entrada.
10. **(27)** En Inventario, busca "omeprazol" y pulsa **Kardex**.
11. **(28)** Abre **Punto de venta**, agrega 2 Paracetamol, 1 Vitamina C y 2 Suero oral, elige un cliente y el pago **Yape**.
12. **(29)** Pulsa **Registrar venta y emitir boleta**.
13. **(30)** *Tiempo real:* abre una **ventana de incógnito** e inicia sesión como `vendedor` en el menú Alertas. Desde la ventana del admin, vende 22 unidades de "Diclofenaco gel". La ventana del vendedor mostrará la alerta al instante.
14. **(31)** En la ventana del vendedor abre **Inventario**: no aparecen los botones "Editar" ni "＋ Stock" (control de roles).
15. **(32)** Abre **Historial de ventas**.
16. **(33)** En **Clientes** pulsa **＋ Nuevo cliente** y llena el formulario.
17. **(34)** Guarda el cliente: aparece en el listado.
18. **(35)** Vuelve al **Panel de control**: los indicadores ya están actualizados.

### Paso 6. Probar en el celular (Evidencia 36)
- **Opción A:** en Chrome pulsa **F12**, luego el ícono de celular (Ctrl + Shift + M) y elige "iPhone 12 Pro".
- **Opción B:** conecta el celular al mismo Wi-Fi. En la PC ejecuta `ipconfig` y anota tu IPv4 (por ejemplo `192.168.1.20`). En el celular abre `http://192.168.1.20:3000`. Si no carga, permite Node.js en el Firewall de Windows.

📸 **Captura:** el login, el punto de venta y el menú abierto.

### Paso 7. Pruebas automatizadas (Evidencia 37)
```
npm test
```
📸 **Captura:** "pass 10, fail 0".

### Paso 8. Probar la API (Evidencia 38)
Ejecuta estos comandos en **CMD** (Símbolo del sistema), no en PowerShell, para que las comillas funcionen bien:
```
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"usuario\":\"admin\",\"password\":\"Admin123*\"}"
curl -i http://localhost:3000/api/productos
```
El primer comando devuelve un **token**. El segundo responde **401** porque no envía token.

### Paso 9. Ver la base de datos (Evidencias 9, 10 y 39)
1. Instala **DB Browser for SQLite** (https://sqlitebrowser.org) y abre `database/novasalud.db`.
2. En **Estructura de la base de datos** verás las 7 tablas y la vista (Ev. 9).
3. En **Hojas de datos** elige `productos` (Ev. 10) y luego `usuarios`: las contraseñas aparecen cifradas.
4. En **Ejecutar SQL** escribe `SELECT * FROM v_alertas;` (Ev. 39).

---

## Estructura del proyecto
```
nova-salud/
├── database/  schema.sql · demo.js · novasalud.db
├── public/    index.html · app.html · css/styles.css · js/login.js · js/app.js
├── src/       server.js · db.js · eventos.js · middleware/auth.js · routes/*.js
├── tests/     api.test.js
├── .env.example
└── package.json
```

## Endpoints principales de la API
| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | /api/auth/login | Inicia sesión y devuelve el JWT | público |
| GET | /api/productos?q= | Lista y busca productos | todos |
| POST/PUT/DELETE | /api/productos[/:id] | Crea, edita o da de baja | admin |
| POST | /api/productos/:id/movimiento | Registra una entrada o un ajuste | admin |
| GET | /api/productos/alertas | Lista las alertas de stock y vencimiento | todos |
| GET | /api/productos/:id/kardex | Muestra el kardex | todos |
| POST | /api/ventas | Registra una venta | todos |
| GET | /api/ventas, /api/ventas/:id | Muestra el historial y el detalle | todos |
| POST | /api/ventas/:id/anular | Anula la venta | admin |
| GET/POST | /api/clientes | Lista y registra clientes | todos |
| GET | /api/dashboard | Devuelve los indicadores | todos |
| GET | /api/eventos | Canal de tiempo real (SSE) | todos |

## Problemas comunes
- **Aparece un aviso al instalar `better-sqlite3`:** no es un problema. Es una dependencia opcional; si no se compila, el sistema usa automáticamente el SQLite integrado en Node.js (versión 22.13 o superior). En ese caso verás el aviso "ExperimentalWarning: SQLite", que es normal.
- **El puerto 3000 está ocupado:** cambia `PORT=3001` en `.env`.
- **Volver a los datos iniciales:** detén el servidor, borra `database/novasalud.db*` y ejecuta `npm run demo`.
  Repositorio: https://github.com/wilfredoalced-byte/nova-salud
