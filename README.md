# KUBI dashboard

La web de solo lectura de [KUBI](https://github.com/francogalluu/kubi), el
asistente de voz personal de Franco. KUBI (el dispositivo) solo graba y
contesta por voz -- a propósito no muestra ni lee las notas en pantalla.
Todo lo guardado (notas, tareas, gastos, check-ins) se consulta acá, desde
el celu o la compu.

PWA instalable: **https://francogalluu.github.io/kubi-dashboard/**

## Qué es

HTML/CSS/JS estático, sin build ni framework. `app.js` habla directo con
Supabase usando `@supabase/supabase-js` (CDN) -- no pasa por el servidor
FastAPI del repo principal para nada de lectura.

- **Login**: Supabase Auth (email + contraseña), con recuperación de
  contraseña. Es un mecanismo aparte del que usa el dispositivo
  (`X-KUBI-Key` fijo) -- acá hay una cuenta real de Supabase (single-user,
  es solo Franco).
- **Datos**: lee las tablas `notes`, `tasks`, `expenses`, `checkins`,
  `routines`, `routine_logs` con la
  anon/publishable key, permitido por políticas RLS `for select to
  authenticated using (true)` en cada tabla (sin scoping por usuario).
  No hay políticas de insert/update/delete: la web es de solo lectura by
  design, las escrituras las hace el servidor con la service role key.
- **PWA**: `manifest.json` + `sw.js` para poder "instalarla" en la
  pantalla de inicio del celu.

## Proyecto de Supabase

`SUPABASE_URL` y la anon key están hardcodeadas en `app.js`, apuntando al
mismo proyecto Supabase que usa `server/.env` en el repo principal
(actualmente `KUBI-sa-east-1`, región `sa-east-1` -- se migró ahí desde un
proyecto original en `us-east-1` por latencia). **Si se vuelve a migrar de
proyecto, hay que actualizar `app.js` acá también**, o la web va a mostrar
datos viejos o fallar el login directamente.

## Deploy

GitHub Pages, build "legacy" desde `master`, raíz del repo. Sin pipeline:
cada push a `master` se publica solo en menos de un minuto. Para cambiar
algo, se edita `index.html`/`app.js`/`style.css` acá y se pushea.

Más contexto (por qué es un repo separado, decisiones de diseño, la
limitación de ser solo lectura) está documentado en
[`WEB_DASHBOARD.md`](https://github.com/francogalluu/kubi/blob/master/WEB_DASHBOARD.md)
del repo principal de KUBI.
