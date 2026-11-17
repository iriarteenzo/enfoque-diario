# Enfoque Diario — PWA de Tareas y Rutinas

Aplicación web progresiva (PWA) ligera, accesible y *offline-first* para la gestión de tareas diarias, prioridades críticas ("Sapos") y seguimiento semanal de hábitos.

## Características Principales

* **100% Offline-First:** Almacenamiento persistente en **IndexedDB** sin límites de 5 MB y caché inteligente mediante **Service Worker**.
* **UX/UI Accesible (WCAG AA/AAA):** Paleta calibrada en modo oscuro y claro, modales nativos `<dialog>` con atrapamiento de foco y áreas táctiles de `44x44px` en la tabla de rutinas.
* **Portabilidad y Seguridad:** Exportación e importación de copias de seguridad en `.json` con sanitización estricta contra XSS.
* **Nube Gratuita Opcional:** Preparada para sincronizar con el plan gratuito de Supabase sin servidores propios.

## Prueba Local

Al utilizar módulos ES6 (`type="module"`), ejecútala mediante un servidor HTTP local:

```bash
# Con Python 3
python3 -m http.server 8080

# O con Node.js
npx serve -p 8080
```

Luego abre `http://localhost:8080` en tu navegador.
