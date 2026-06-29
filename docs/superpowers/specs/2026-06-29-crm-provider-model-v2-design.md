# RANIC CRM — Modelo de proveedores v2 + importación histórica

**Fecha:** 2026-06-29
**Estado:** Aprobado por el usuario
**Repo:** `ranic-web`
**Afecta:** Solo `/admin` (CRM, Fase 1) — el sitio público no se toca.

---

## 1. Resumen

Nico llevaba un control paralelo de proveedores en una planilla CSV (78 filas reales, registradas
desde enero de 2026) con más información y más matices de estado que el modelo actual del CRM
(que solo tiene 9 proveedores cargados manualmente para la Fase 1). Este trabajo: (1) amplía el
modelo de datos del CRM para reflejar cómo Nico realmente registra proveedores, (2) importa los
78 proveedores históricos del CSV, y (3) ajusta el Follow-up Track para que no aplique a
proveedores contactados por canales donde no corre una secuencia de emails.

## 2. Campos nuevos en `Provider`

Se agregan a `lib/types.ts`:

- `phone: string` — teléfono. Vacío si no se conoce.
- `address: string` — dirección. Vacío si no se conoce.
- `contactMethod: ContactMethod` — nuevo tipo `"Email" | "Llamada" | "Web"`. Cómo se inició el
  contacto con este proveedor.
- `score: number` — 0 a 5. Sistema de prioridad que Nico ya usa en su planilla para decidir a
  quién perseguir más. Sin valor conocido se guarda `0` (no es opcional — simplifica filtros y
  orden en la tabla).

## 3. Estados — de 5 a 8

`Status` en `lib/types.ts` pasa de:

```
Contactado | Esperando respuesta | En negociación | Aprobado | Descartado
```

a:

```
Por Contactar | Contactado | En Espera de Respuesta | En Negociación | Aprobado |
Rechazado | No Acepta Nuevos | Referido
```

Cambios y motivo:
- **`Por Contactar`** (nuevo): proveedor cargado pero todavía sin contactar — no existía un
  estado "antes del primer contacto" en el modelo viejo.
- **`Esperando respuesta` → `En Espera de Respuesta`**: renombrado para que coincida
  exactamente con cómo Nico ya lo escribe (reduce fricción al registrar a mano).
- **`En Negociación`**: se mantiene (capitalización ajustada), aunque ninguna fila del CSV la usa
  — Nico puede necesitarla a futuro.
- **`Descartado` → se separa en `Rechazado` y `No Acepta Nuevos`**: son motivos distintos en la
  práctica (la nota de Nico distingue "no encontré producto rentable / no cumplimos requisito" de
  "la empresa no acepta revendedores nuevos en general, no es algo sobre nosotros").
- **`Referido`** (nuevo): el proveedor llegó por referencia de otra empresa (ej. Convatec →
  Unfi en el CSV).
- **`Estafa` no se agrega como estado**: sigue resuelto por la colección `blacklist` ya
  existente, sin cambios — un proveedor marcado como estafa en el CSV se importa directamente a
  `blacklist`, no a `providers` (ver §5).

No se requiere migración de los 9 proveedores ya seedeados: sus estados actuales
(`Aprobado`, `En negociación`, `Contactado`) siguen siendo válidos en el nuevo set (con el ajuste
de capitalización en "En Negociación" si corresponde).

## 4. Follow-up Track condicionado al método de contacto

El Follow-up Track (día 1 → 4 → 7 → 12) asume una secuencia de emails que Nico controla. Cuando
el contacto fue por **Web** (formulario de la empresa) o **Llamada**, no hay esa secuencia
corriendo — el proveedor está esperando que la otra empresa actúe, no a que Nico reenvíe un
email. Mostrar igual el tracker generaría alertas de "vencido" falsas.

**Regla:** el cálculo y la visualización del Follow-up Track (`lib/followup.ts`, alertas del
dashboard, detalle del proveedor) solo aplican cuando `provider.contactMethod === "Email"`. Para
`Llamada` o `Web`, el proveedor no genera alertas de follow-up — su estado se actualiza
manualmente desde el CRM como hasta ahora, sin tracker.

## 5. Importación de los 78 proveedores históricos

Fuente: `C:\Nico-Archivos\ClaudeCode\Ranic-Group\Base de Datos PROVEEDORES - BASE DE DATOS.csv`
(columnas: Nombre de Proveedor, Dirección, Persona de Contacto, Email, Teléfono, Status, Fecha de
Contacto, Método de Contacto, Score, Notas, Web).

Reglas de mapeo:

- **Filas con Status = "Estafa"** (1 fila: AJ-Globals) → van a la colección `blacklist` (solo
  `name`), no a `providers`.
- **Filas completamente vacías** (sin Nombre de Proveedor) → se ignoran. El CSV tiene ~50 filas
  finales vacías (artefacto de la planilla de Google Sheets).
- **Valores placeholder** (`------------------------`, `Desconocido`, celda vacía) → se guardan
  como string vacío `""` en el campo correspondiente (`contact`, `phone`, `address`, `email`).
- **Fechas** en formato `d/m/aa` (ej. `15/1/26`) → se convierten a ISO `yyyy-mm-dd` (ej.
  `2026-01-15`) y se usan como `firstContactDate` y como fecha de la nota inicial.
- **Notas**: si la columna "Notas" no está vacía, se crea una `NoteEntry` inicial con
  `date = Fecha de Contacto convertida` y `text = Notas`. Si está vacía, `notes: []`.
- **Método de Contacto vacío** (ocurre en 1-2 filas) → se asume `"Web"` por default (es el canal
  más común entre las filas ambiguas del CSV).
- **Status del CSV → `Status` del CRM**: mapeo directo 1 a 1 usando el nuevo set de §3
  (`Aprobado→Aprobado`, `En Espera de Respuesta→En Espera de Respuesta`, `Rechazado→Rechazado`,
  `No Acepta Nuevos→No Acepta Nuevos`, `Por Contactar→Por Contactar`, `Referido→Referido`). Texto
  con espacios extra al final (ej. `"Referido "`) se recorta antes de mapear.
- **`category`**: el CSV no tiene esta columna. Se infiere de la columna "Notas" cuando hay
  pista clara de texto (ej. "Beauty and Personal Care", "Perfumes" → `Fragancias & Beauty`;
  "mascotas" → `Pet Products`; "Toys & Games" → `Entertainment & Toys`; "Tools & Home
  Improvement" → `Home Products`). Sin pista clara → default `General Merchandise`. Esta
  inferencia es de mejor esfuerzo: Nico revisa y corrige después desde el CRM las que queden mal
  categorizadas.
- **`score`**: se toma directo de la columna Score (ya viene 0-5 en el CSV).
- **`website`**: columna "Web" del CSV, directo.
- **`blacklisted`**: `false` para todas las filas importadas a `providers` (las "Estafa" no
  entran a esta colección, ver arriba).
- **`followUpStep`**: `-1` para todas (no se asume que haya una secuencia de emails en curso para
  datos históricos importados, independientemente del `contactMethod`).
- **IDs deterministas** por slug del nombre de la empresa, igual que el seed actual — permite
  re-correr el script sin duplicar.

Esto se implementa como un script nuevo `scripts/import-providers.ts`, calcado en estructura a
`scripts/import-expo.ts` y `scripts/seed.ts` ya existentes (mismo patrón de auth con SDK web +
`SEED_USER_PASSWORD`, sin Admin SDK).

## 6. Backfill de los 9 proveedores ya cargados

Los 9 proveedores del seed de la Fase 1 no tienen `phone`, `address` ni `contactMethod` (campos
nuevos). Se actualizan los 9 documentos existentes con:
- `contactMethod: "Email"` (todos se contactaron por email, según las notas del spec original).
- `phone: ""`, `address: ""` (sin dato — Nico los completa después si los tiene).
- `score: 0` (sin dato).

Esto se hace como parte del mismo `scripts/import-providers.ts` (un paso previo a la importación
del CSV) o un script separado de migración — decisión de implementación, no de diseño.

## 7. Cambios de UI

- **`ProviderForm`** (`components/ProviderForm.tsx`): agregar campos de teléfono, dirección,
  método de contacto (select) y score (select 0-5 o input numérico). El select de Status debe
  reflejar el nuevo set de 8 valores.
- **`ProviderTable`** (`components/ProviderTable.tsx`): agregar columna de score (visual simple,
  ej. número o puntos) y, si entra cómodo en el layout, método de contacto.
- **Dashboard / alertas de follow-up**: filtrar para que solo consideren proveedores con
  `contactMethod === "Email"` (ver §4).
- **`ProviderDetail`** (`components/ProviderDetail.tsx`): mostrar los campos nuevos; el
  Follow-up Track solo se renderiza si `contactMethod === "Email"`.

## 8. Fuera de alcance

- No se agrega un campo de "fuente/origen del lead" separado de `contactMethod` — `Referido` ya
  cubre ese caso como `Status`.
- No se expande `BlacklistEntry` más allá de `name` — se mantiene igual que en la Fase 1.
- No se modifica el sitio público ni `/`, `/privacy`, `/terms`.
- No se re-categorizan manualmente las filas importadas como parte de este trabajo — Nico lo hace
  después, a su ritmo, desde el CRM.
