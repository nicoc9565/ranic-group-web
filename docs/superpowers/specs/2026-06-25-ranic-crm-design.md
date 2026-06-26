# RANIC GROUP CRM — Diseño (Fase 1)

**Fecha:** 2026-06-25
**Estado:** Aprobado por el usuario
**Repo:** `ranic-web` (reconstruido de cero)
**Dominio:** ranicgroup.com (Vercel + Namecheap, ya conectados)

---

## 1. Resumen

CRM web para RANIC GROUP LLC, un negocio de Amazon FBA wholesale. La herramienta gestiona
proveedores, secuencias de follow-up, generación de emails y prospectos de Expo West 2026.
Dos usuarios (Nico en Argentina, César en New Jersey) con sincronización en tiempo real.

Este spec cubre **solo la Fase 1 (CRM)**. El rediseño de la web pública de marketing es una
fase posterior con su propio spec.

## 2. Stack y arquitectura

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS.
- **Backend / datos:** Firebase nuevo (proyecto propio de RANIC):
  - **Firebase Auth** (email/password) para login.
  - **Cloud Firestore** para datos, con sincronización en tiempo real (`onSnapshot`).
- **Deploy:** Vercel ya conectado al repo `ranic-web`; el dominio ranicgroup.com queda intacto.
- **Config:** claves de Firebase vía variables de entorno (`NEXT_PUBLIC_FIREBASE_*`) en Vercel.
- **Repo:** se borra el contenido público actual (index.html, privacy, terms, img, etc.) y se
  reconstruye como proyecto Next con un commit limpio. El historial git viejo se conserva.

### Decisiones de stack
- Se eligió Next.js sobre Vite/React y TS vanilla porque cubre tanto el CRM (`/admin`,
  client-side con Firebase) como el futuro rediseño de la web pública (SSG + SEO) en un solo
  proyecto coherente, con deploy nativo en Vercel.
- La web pública actual no está en uso (es solo fachada), así que puede quedar caída durante la
  Fase 1. La home queda como placeholder mínimo hasta el rediseño.

## 3. Rutas

- `/` — placeholder mínimo ("RANIC GROUP LLC" centrado). El rediseño público es Fase 2.
- `/admin` — login (si no hay sesión) o el CRM (si hay sesión).
- El CRM es una sola área autenticada con navegación interna que alterna entre vistas:
  Dashboard, Proveedores, Follow-ups, Generador de emails, Blacklist, Expo West.

### Autenticación
- Protección client-side con un `AuthProvider` (React Context + `onAuthStateChanged`):
  si no hay sesión, se muestra el login; si hay sesión, se renderiza el CRM.
- La sesión persiste hasta logout manual (persistencia local de Firebase Auth).
- La **barrera real de seguridad** son las reglas de Firestore: lectura/escritura solo si
  `request.auth != null`. Sin login no se puede leer ni escribir nada.
- Nico y César se crean a mano en la consola de Firebase Auth. No hay colección `users`;
  el mapeo email → nombre para mostrar en la UI va en una constante del código.

## 4. Modelo de datos (Firestore)

### Colección `providers`
| Campo | Tipo | Notas |
|---|---|---|
| `company` | string | Nombre de la empresa |
| `contact` | string | Nombre del contacto |
| `email` | string | |
| `category` | string | Fragancias & Beauty / Health & Personal Care / Pet Products / Home Products / Entertainment & Toys / General Merchandise |
| `status` | string | Contactado / Esperando respuesta / En negociación / Aprobado / Descartado |
| `website` | string | URL |
| `blacklisted` | boolean | Si está en true, nunca aparece en recomendaciones |
| `firstContactDate` | date | Fecha del primer email; base de la secuencia de follow-up |
| `lastEmailDate` | date | Fecha del último email enviado |
| `followUpStep` | number (0–3) | Índice del último email de la secuencia enviado |
| `notes` | array `{date, text}` | Log cronológico solo-append (no se edita el pasado) |
| `createdAt` / `updatedAt` | timestamp | |

### Colección `blacklist`
- Documentos simples `{ name }`. Precargada con las 25 empresas (ver §9).
- Al crear/editar un proveedor, se chequea el nombre contra esta lista y se avisa si coincide.

### Colección `expoProspects`
| Campo | Tipo |
|---|---|
| `company` | string |
| `brands` | string |
| `category` | string |
| `city` | string |
| `state` | string |
| `website` | string |
| `email` | string |
| `mailSent` | boolean |
| `dateSent` | date |
| `response` | string |
| `notes` | string |

- Importados desde los dos Excel en `C:\Nico-Archivos\ClaudeCode\Ranic-Group\`
  (`Expo West 2026 - Beauty & Personal Care.xlsx` y `Expo West 2026_ Exhibitors.xlsx`).
- Filtro: Cosmetics & Personal Care / Pet Products / Home Products, solo US → ~103 registros.
- Lo realiza Antigravity con un script de seed/import (tarea del plan de implementación).

## 5. Lógica de follow-up

- Secuencia de días **[1, 4, 7, 12]** medida desde `firstContactDate`:
  - Día 1: email inicial
  - Día 4: follow-up corto
  - Día 7: follow-up urgente
  - Día 12: último intento
- Estado inicial: un proveedor sin ningún email enviado tiene `followUpStep = -1` (o `null`) y
  sin `firstContactDate`. No genera cálculo de follow-up hasta el primer "marcar como enviado".
- Próximo follow-up = `firstContactDate + secuencia[followUpStep + 1]`.
- **Fin de secuencia:** cuando `followUpStep == 3` (ya se envió el último intento, día 12),
  `followUpStep + 1` cae fuera de la secuencia → no hay más follow-ups. El proveedor deja de
  aparecer en alertas/follow-ups pendientes (la secuencia se agotó; el próximo paso es manual).
- "Marcar como enviado" (desde el generador de emails):
  - avanza `followUpStep` (de -1 a 0 en el primer contacto, luego 0→1→2→3),
  - actualiza `lastEmailDate`,
  - en el primer contacto, fija `firstContactDate`.
- El dashboard colorea según hoy vs. próximo follow-up:
  - **rojo** = vencido/urgente
  - **amarillo** = vence hoy
  - **verde** = en fecha

## 6. Vistas del CRM

### 6.1 Dashboard (pantalla inicial tras login)
- Cards de métricas: total proveedores, aprobados, en proceso, follow-ups pendientes hoy.
- Sección de alertas: proveedores que necesitan follow-up hoy o vencidos, con código de color.

### 6.2 Proveedores
- CRUD completo: agregar, editar, eliminar.
- Vista de tabla + vista de detalle por proveedor.
- Filtros por estado y categoría; búsqueda por nombre o contacto.
- Notas como log cronológico solo-append `{date, text}`, mostrado en orden cronológico.

### 6.3 Follow-up tracker
- Calcula automáticamente la próxima fecha de follow-up según `firstContactDate` y `followUpStep`.
- Muestra los vencidos de forma prominente.
- "Marcar como enviado" actualiza `lastEmailDate` y avanza la secuencia.

### 6.4 Generador de emails
- Dropdown de proveedor + tipo de email:
  - First contact (short)
  - First contact (long)
  - Follow-up day 4
  - Follow-up day 7 (urgency)
  - Last attempt day 12
  - Request catalog with UPCs
  - Reply to approval (thank + ask for price list with UPCs)
  - Clarification request
- Auto-rellena el nombre del contacto desde el registro del proveedor.
- Genera el email en inglés, listo para copiar.
- **Copiar = texto plano** al clipboard (Clipboard API).
- "Marcar como enviado" actualiza `lastEmailDate` y `status`, y avanza la secuencia.

#### Reglas de email (forzadas siempre)
- Primer contacto empieza con "Dear [Name]," — nunca "Hi" (solo "Hi" en hilos ya iniciados).
- Nunca mencionar Amazon salvo que el proveedor lo haya mencionado; usar "online retailer".
- Nunca incluir EIN, Resale Certificate ni Tax ID salvo que el proveedor lo pida explícitamente.
- Siempre cerrar con la firma:
  ```
  Nicolas Conti
  Managing Member | RANIC GROUP LLC
  nicolas.conti@ranicgroup.com
  www.ranicgroup.com
  +1 (201) 572-1383
  ```
- La frase "recurring monthly orders" aparece en los emails de primer contacto.
- Presentarse como "online retailer based in Summit, NJ" — nunca como wholesaler/distributor.

#### Templates base
**Short first contact:**
```
Dear [Contact],
My name is Nicolas Conti, Managing Member of RANIC GROUP LLC, an online retailer based in Summit, NJ.
We are actively looking to add [Company] products to our catalog and place recurring monthly orders.
Could you please send us your wholesale price list (with UPCs) and minimum order requirements?
We are ready to move quickly on an initial order.
Best regards, [signature]
```

**Long first contact:**
```
Dear [Contact],
My name is Nicolas Conti, Managing Member of RANIC GROUP LLC, an online retail company operating out of Summit, NJ.
We specialize in wholesale purchasing and currently carry several brands across Health, Grocery, and Home categories. We are looking to add [Company] products to our active inventory with an initial order in the $500–$1,500 range, with the intention of placing recurring monthly orders as we scale.
Could you please share your wholesale price list (ideally with UPCs) and any account opening requirements? We have all standard documentation ready and can move forward immediately upon approval.
Thank you — I look forward to connecting.
Best regards, [signature]
```

**Catalog request with UPCs:**
```
Dear [Contact],
Thank you for approving our account. We have reviewed your catalog and are ready to move forward.
Could you please share your wholesale price list in Excel or CSV format, including UPC codes and unit prices? This will allow us to conduct a proper product analysis before placing our first order.
Thank you and looking forward to hearing from you.
Best regards, [signature]
```

Los demás tipos (follow-up day 4/7, last attempt day 12, reply to approval, clarification) se
derivan de estos respetando las reglas de email; Antigravity los redacta en la implementación.

### 6.5 Blacklist
- Vista de las 25 empresas blacklisteadas; no se pueden contactar ni recomendar.

### 6.6 Expo West 2026
- Tabla de prospectos con filtros por categoría.
- Acciones masivas: marcar como contactado.
- Export de la lista filtrada a CSV.

## 7. Diseño visual

- Color primario: **verde oliva `#556B2F`** (variable Tailwind, ajustable).
- Estética dashboard SaaS limpia, minimal y profesional.
- Responsive: **sidebar en desktop, bottom nav en mobile.**
- Idioma: **español** para labels de UI, **inglés** para todo el contenido de emails.

## 8. Datos precargados — proveedores activos

Cargar en el primer seed:

| # | Company | Email | Contacto | Categoría | Status | Last email | Notas |
|---|---|---|---|---|---|---|---|
| 1 | FragranceX | support@fragrancex.com | Ces | Fragancias & Beauty | Aprobado | 2026-06-01 | Account approved. Catalog has no UPCs — requested Excel with UPCs. |
| 2 | SN International | info@snillc.com | Sales Team | General Merchandise | En negociación | 2026-06-10 | Requested catalog sample before paying commercial membership. |
| 3 | Perfume Center / Worldwide | elina@perfumeworldwide.com | Elina | Fragancias & Beauty | En negociación | 2026-06-12 | Sister company confirmed. Requested catalog, ordering process and payment methods. |
| 4 | Alliance Entertainment | randy.martin@aent.com | Randy Martin | Entertainment & Toys | En negociación | 2026-06-20 | Spreadsheet received. Requested WebAMI access reactivation to verify stock. |
| 5 | EE Distribution | eedadmin@eedistribution.com | Sales Team | General Merchandise | Contactado | 2026-06-15 | Registration form completed. |
| 6 | TPS Wholesale | info@tps-wholesale.com | Sales Team | Fragancias & Beauty | Contactado | 2026-06-08 | Form completed with Resale Certificate. |
| 7 | BD Distributors | info@bddistributors.com | Sales Team | Fragancias & Beauty | Contactado | 2026-06-08 | Form completed. |
| 8 | Goodbye Inventory | contact@goodbyeinventory.com | Sales Team | Fragancias & Beauty | Contactado | 2026-06-25 | Requested price list in Excel with UPCs. |
| 9 | WholesalePet | service@wholesalepet.com | Sales Team | Pet Products | Contactado | 2026-06-18 | Requested price list with UPCs. |

## 9. Datos precargados — blacklist

ESM Trading LLC, Econzeller, Upsellwholesale, Nation Distributor (Nashville), Nexus Wholesale,
Premier Products Co. US, ZG Distribution, Swanson Distribution, Artext Wholesale / Artext LLC,
Flo Distribution, EN Distribution / EN Wholesale LLC, Royal Wholesale INC, GABA Distribution,
Prime Pallet Wholesale Deals / Source Buys Inc, Supply Leader, B2B Wholesale LLC, Tsubaki-us,
Palletfly, Century Wholesalers LLC (Wyoming), Jefferson Wholesale, Reliable Distribuidor LLC,
VITAL DISTRIBUTIONS (Texas), Petco Wholesale, Medcare LLC, Miami Trading Zone.

## 10. Variables de entorno (Vercel)

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 11. Fuera de alcance (Fase 1)

- Rediseño de la web pública de marketing (Fase 2, spec propio).
- Roles/permisos más allá de "usuario autenticado" (ambos usuarios son admin).
- Notificaciones por email/push de follow-ups (el dashboard es el recordatorio).
