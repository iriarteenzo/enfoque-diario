# Enfoque Diario

PWA mobile-first en Vanilla JavaScript, CSS y HTML. La agenda se guarda primero en IndexedDB y funciona sin conexión después de la primera carga. Supabase es opcional y solo sincroniza cuando se configura la clave pública y existe conexión.

## Estructura

- `index.html`: vistas Hoy, Agenda semanal, Rutinas y Cuenta; formularios y visor Stories con `<dialog>`.
- `styles.css`: design system, temas claro/oscuro, foco visible y controles táctiles.
- `manifest.json`, `icon.svg`, `sw.js`: instalación PWA y caché offline.
- `js/storage.js`: IndexedDB, validación, sanitización, migración de versiones antiguas e importación/exportación.
- `js/app.js`: interfaz, agenda, rutinas, Stories y acciones.
- `js/supabase-config.js`: URL y clave pública de Supabase.
- `js/cloud-sync.js`: Magic Link, renovación de sesión y REST.
- `supabase/schema.sql`: tabla de agenda y políticas RLS.

## Ejecutar localmente

No abras `index.html` con `file://`; los módulos ES y el Service Worker necesitan HTTP/HTTPS.

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## Activar Supabase

1. En Supabase abre **Project Settings → API** y copia la **Project URL** y la clave **publishable** (o la antigua **anon public**).
2. Edita `js/supabase-config.js`:
   - `SUPABASE_URL`: URL del proyecto ya indicada.
   - `SUPABASE_ANON_KEY`: reemplaza `PEGA_AQUI_TU_SUPABASE_PUBLISHABLE_O_ANON_KEY`.
3. En **SQL Editor**, ejecuta el archivo `supabase/schema.sql`.
4. En **Authentication → URL Configuration**, añade como Site URL la URL base publicada de la PWA y permite esa misma URL en Redirect URLs. Para desarrollo local añade `http://localhost:8080/**`.
5. En **Authentication → Providers → Email**, activa Email/OTP y configura el envío de correo. Los límites del proveedor de correo de Supabase pueden aplicar.
6. Publica de nuevo la PWA y prueba el enlace desde el mismo dominio/dispositivo.

**Seguridad:** la clave publishable/anon es pública por diseño. Nunca incluyas una clave `service_role` en este repositorio ni en el navegador. La tabla `user_agendas` tiene RLS y solo permite leer/escribir la fila cuyo `user_id` coincide con `auth.uid()`.

## Persistencia y sincronización

- IndexedDB es la fuente de verdad local. Las operaciones de agenda no esperan a Supabase.
- Los cambios se envían a Supabase cuando hay sesión y conexión; al recuperar conexión se intenta sincronizar.
- Al iniciar sesión, se compara `updatedAt`: si la copia remota es más reciente se descarga; en caso contrario se publica la local.
- La sincronización actual es de **documento completo con estrategia de última actualización**. No es una fusión campo a campo; si editas la misma agenda en dos dispositivos desconectados, la última copia subida puede reemplazar la otra. Exporta copias JSON antes de cambios grandes.

## Migración de datos anteriores

En el primer arranque, `storage.js` busca claves antiguas `enfoque_diario_v9` y `enfoque_diario_v8` en localStorage y las migra a IndexedDB. Las rutinas recurrentes antiguas se expanden en ocurrencias para los próximos 14 días. Conserva también el importador JSON para restaurar una copia manual.

## Publicación gratuita

GitHub Pages: Settings → Pages → Deploy from a branch → selecciona `main` y la carpeta raíz. Cloudflare Pages puede desplegar directamente el repositorio, sin comando de build.

La aplicación no usa librerías externas ni requiere servidor propio. Supabase Free es un servicio externo con cuotas y límites sujetos a sus condiciones; no se puede garantizar disponibilidad ilimitada o coste cero permanente.
