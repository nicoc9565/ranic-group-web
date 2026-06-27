# RANIC GROUP — CRM (ranic-web)

CRM web para **RANIC GROUP LLC**, un negocio de Amazon FBA wholesale. Gestiona proveedores,
secuencias de follow-up, generación de emails, blacklist y prospectos de Expo West 2026.
Dos usuarios: **Nico** (Argentina) y **César** (New Jersey), con sincronización en tiempo real.

El repo está conectado a **Vercel** y al dominio **ranicgroup.com**. El sitio público anterior era
solo fachada y se reemplazó por completo: este repo se reconstruyó de cero como proyecto Next.js.

## Documentos rectores — leelos antes de tocar código

**Fase 1 — CRM (`/admin`), ya en producción:**
- **Spec de diseño:** `docs/superpowers/specs/2026-06-25-ranic-crm-design.md`
- **Plan de implementación:** `docs/superpowers/plans/2026-06-25-ranic-crm.md`
- **Guía visual:** `docs/design-guidelines.md`

**Fase 2 — Sitio público (`/`, `/privacy`, `/terms`), en curso:**
- **Spec de diseño:** `docs/superpowers/specs/2026-06-26-ranic-public-site-design.md`
- **Plan de implementación:** `docs/superpowers/plans/2026-06-26-ranic-public-site.md`
- **Guía visual:** `docs/design-guidelines-public-site.md`

Cada plan tiene tareas en orden, con archivos exactos, interfaces, pasos y verificación.
**Ejecutá tarea por tarea, en orden**, con un commit al final de cada tarea. No saltees tareas ni
improvises alcance: si algo es ambiguo, preguntá antes. La Fase 2 no toca nada de `/admin`
(Fase 1, ya en producción) — son rutas y componentes completamente separados.

## Cómo trabajamos

- El **diseño y el plan ya están cerrados y aprobados**. Tu trabajo es implementarlos fielmente.
- **TDD donde el plan lo marca** (Task 4: lógica de follow-up; Task 5: generador de emails):
  test que falla → implementación mínima → test verde. Esa lógica es pura (sin React/Firebase) y
  vive en `lib/` justamente para ser testeable.
- **Commits frecuentes y atómicos**, uno por tarea como mínimo, con mensajes en el estilo del plan
  (`feat:`, `chore:`, `docs:`).
- **DRY / YAGNI:** no agregues features que no estén en el spec. Lista de "fuera de alcance" en §11
  del spec.
- Después de cambios verificables en el navegador, **verificá vos mismo** (build + preview), no le
  pidas a Nico que pruebe a mano.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Sin otros frameworks de UI.
- **Firebase:** Auth (email/password) + Cloud Firestore (tiempo real con `onSnapshot`).
- **Deploy:** Vercel (auto-deploy desde `main`). Dominio ranicgroup.com ya apuntando.

## Estructura

- `app/` — rutas. `/` = placeholder; `/admin` = login + CRM autenticado en `(crm)/`.
- `lib/` — lógica e integración: `firebase.ts`, `auth.tsx`, `types.ts`, `providers.ts`,
  `blacklist.ts`, `expo.ts`, `followup.ts` (puro), `emails.ts` (puro).
- `components/` — UI reutilizable. `scripts/` — `seed.ts` e `import-expo.ts`.
- `lib/__tests__/` — tests de la lógica pura.
- Un archivo = una responsabilidad. Mantené chicos y enfocados los archivos.

## Reglas de dominio — NO negociables

### Emails (forzar siempre, ver §6.4 del spec)
- Primer contacto empieza con **"Dear [Name],"** — nunca "Hi" (solo "Hi" en hilos ya iniciados).
- **Nunca mencionar Amazon** salvo que el proveedor lo haya mencionado → usar "online retailer".
- **Nunca incluir EIN, Resale Certificate ni Tax ID** salvo pedido explícito del proveedor.
- La frase **"recurring monthly orders"** aparece en los emails de primer contacto.
- Presentarse como **"online retailer based in Summit, NJ"** — nunca wholesaler/distributor.
- Todo email cierra con esta firma exacta:
  ```
  Nicolas Conti
  Managing Member | RANIC GROUP LLC
  nicolas.conti@ranicgroup.com
  www.ranicgroup.com
  +1 (201) 572-1383
  ```
- Los 3 templates textuales (short/long first contact, catalog with UPCs) van **tal cual** el spec.
- Copiar al portapapeles = **texto plano**.

### Follow-up
- Secuencia de días **[1, 4, 7, 12]** desde `firstContactDate`. `followUpStep` arranca en `-1`.
- Próximo = `firstContactDate + FOLLOWUP_DAYS[followUpStep + 1]`; si la secuencia se agotó
  (`followUpStep >= 3`) o no hay `firstContactDate` → no hay follow-up.
- Colores: rojo = vencido, amarillo = vence hoy, verde = en fecha.

### Datos precargados (seed)
- **9 proveedores activos** exactos (§8 del spec).
- **25 empresas de blacklist** exactas (§9 del spec).

## Diseño / UI

- Color primario: **verde oliva `#556B2F`** (token Tailwind `olive`).
- **Idioma: español** en labels de UI, **inglés** en todo el contenido de emails.
- **Responsive:** sidebar en desktop, bottom nav en mobile.
- Estética dashboard SaaS limpia, minimal, profesional.

## Seguridad

- Las claves de Firebase van en **env vars** (`NEXT_PUBLIC_FIREBASE_*`), nunca hardcodeadas.
- `.env.local` está **gitignored** — nunca lo commitees ni pongas secretos en el repo.
- La barrera real de seguridad son las **reglas de Firestore** (`request.auth != null`).
  Sin login no se lee ni escribe nada.

## Tareas que dependen de Nico (avisale cuando llegues)

- **Firebase (Task 2):** Nico crea el proyecto, habilita Auth + Firestore y crea los usuarios.
  Él te pasa las 6 claves `NEXT_PUBLIC_FIREBASE_*` y los emails de login de Nico y César
  (para el mapa `USER_NAMES`).
- **Import Expo West (Task 15):** los dos Excel están en
  `C:\Nico-Archivos\ClaudeCode\Ranic-Group\` (`Expo West 2026 - Beauty & Personal Care.xlsx` y
  `Expo West 2026_ Exhibitors.xlsx`). Filtrar a Cosmetics & Personal Care / Pet Products /
  Home Products, solo US; reportar el conteo real (esperado ~103).
- **Deploy (Task 16):** Nico carga las env vars en Vercel; vos confirmás que el build y el deploy
  pasan en producción.

## Fuera de alcance (Fase 1)

- Roles más allá de "usuario autenticado" (ambos son admin).
- Notificaciones por email/push (el dashboard es el recordatorio).

## Fuera de alcance (Fase 2)

- Formulario de contacto propio / captura de leads con backend (el CTA es `mailto:`).
- Blog, casos de éxito, testimonios, logos de marcas reales.
- Cualquier cambio a `/admin` (Fase 1).
- SEO avanzado / contenido extenso para tráfico orgánico.
