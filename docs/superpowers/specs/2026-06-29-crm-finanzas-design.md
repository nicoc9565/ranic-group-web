# RANIC CRM — Módulo de Finanzas (flujo de caja)

**Fecha:** 2026-06-29
**Estado:** Aprobado por el usuario
**Repo:** `ranic-web`
**Afecta:** Solo `/admin` (CRM) — el sitio público no se toca.

---

## 1. Resumen

Nico lleva el control financiero de RANIC GROUP LLC en una planilla de Google Sheets (hoja
"Finanzas", 43 movimientos reales desde enero de 2026) y quiere reemplazarla por un módulo dentro
del CRM. Este es el primer tramo del módulo de Finanzas completo que se planeó originalmente
(flujo de caja general + rentabilidad por producto/proveedor + control de gastos): arranca por
**flujo de caja general**, con control de gastos incorporado vía categorización (la rentabilidad
por producto queda para un tramo futuro, cuando se sume la hoja "Stock" de la misma planilla).

## 2. Hallazgo clave: aportes de socio vs. ingresos por venta

La planilla mezcla, bajo el mismo tipo "Ingreso", dos cosas muy distintas:
- **Ventas reales** (depósitos de Amazon: ej. "Ventas Amazon $170.87").
- **Aportes de capital de Rafa** (socio/co-fundador que financia el negocio mientras todavía no
  genera ganancias; transferencias Zelle: ej. "Zelle Rafa $900.00").
- **Reintegros** (devoluciones de algo ya pagado, ej. "Reintegro Frontier Botella Rota $17.41").

Un balance simple (Ingresos − Egresos) no distingue "el negocio es rentable" de "Rafa lo está
financiando". El módulo separa esto explícitamente (ver §3).

## 3. Modelo de datos

Nueva colección Firestore `transactions` (independiente de `providers`/`blacklist`).

```ts
export type TransactionType = "Ingreso" | "Egreso";

export type IncomeSource = "Venta" | "Aporte de Socio" | "Reintegro";

export type ExpenseCategory =
  | "Compra a Proveedor"
  | "Suscripciones y Software"
  | "Gastos Operativos"
  | "Educación"
  | "Otros";

export type Transaction = {
  id: string;
  date: string;              // ISO yyyy-mm-dd
  type: TransactionType;
  description: string;
  amount: number;            // siempre positivo; el signo lo da `type`
  payer: string;             // "Quién" — texto libre (Nico, Rafa, Ranic Group LLC, Amazon...)
  method: string;            // "Método" — texto libre (Credit Card, Debit Card, Transferencia...)
  incomeSource: IncomeSource | null;       // solo si type === "Ingreso"
  expenseCategory: ExpenseCategory | null; // solo si type === "Egreso"
  createdAt: number;
  updatedAt: number;
};
```

`payer` y `method` quedan en texto libre (mismo criterio que el campo `contact` de `Provider`):
la lista de personas/medios de pago va a crecer con el tiempo y no vale la pena cerrarla todavía.

Categorías derivadas de los movimientos reales de la planilla (no genéricas):
- **Orígenes de Ingreso:** `Venta` (ventas en Amazon/marketplace), `Aporte de Socio` (capital
  que entra, no es ganancia), `Reintegro` (devolución de un gasto ya hecho).
- **Categorías de Egreso:** `Compra a Proveedor` (Frontier Co-op, EE Distribution, Everyday
  Supply Co...), `Suscripciones y Software` (Keepa, SmartScout, Price Checker, RevSeller, fee de
  Amazon Seller, Google Pay/Mail, Claude...), `Gastos Operativos` (dominio, LLC, línea eSIM,
  impresora y papel), `Educación` (curso Mundo Amazon), `Otros` (catch-all).

## 4. Página `/admin/finanzas`

Un solo ítem nuevo en el nav del CRM ("Finanzas"), página única con:

- **Tarjetas de métricas:**
  - Ingresos totales (suma de todo `type === "Ingreso"`).
  - Egresos totales (suma de todo `type === "Egreso"`).
  - **Balance** = Ingresos totales − Egresos totales (la misma cuenta que ya tiene la planilla).
  - **Balance Operativo** = (Venta + Reintegro) − Egresos totales, **sin contar** los Aportes de
    Socio — la métrica real de si el negocio ya se sostiene solo.
- **Egresos por categoría:** mini-tabla con el total gastado en cada una de las 5 categorías,
  para ver dónde se concentra el gasto.
- **Tabla de movimientos:** todos los `Transaction`, ordenados por fecha descendente, con
  filtros por `type`, por categoría (`incomeSource`/`expenseCategory` combinados en un solo
  filtro de "categoría") y por mes. Alta/edición/borrado de movimientos desde un form modal,
  mismo patrón de interacción que `ProviderForm`/`ProviderTable` (Modal, validación inline,
  confirmación de borrado).

## 5. Importación histórica

Fuente: `C:\Nico-Archivos\ClaudeCode\Ranic-Group\Finanzas_Ranic_Group_LLC.csv` (43 movimientos,
columnas: Fecha, Tipo, Descripción, Monto, Quién Pagó, Método, Categoría, Mes, Año — más una
caja de resumen suelta en columnas a la derecha de las primeras filas, que se ignora: son
totales ya calculados de la propia planilla, no datos de movimientos, y este módulo los
recalcula en vivo).

Reglas de mapeo:
- **Fecha** en formato `d/m/aa` (ej. `12/01/26`) → ISO `yyyy-mm-dd` (`2026-01-12`). `Mes`/`Año`
  del CSV se ignoran — se derivan de `Fecha` (una sola fuente de verdad).
- **Monto**: `"$1,749.00"` → `1749.00` (quitar `$` y comas de miles).
- **Tipo**, **Quién Pagó** → `payer`, **Método** → `method`: directo, sin transformación
  (excepto recorte de espacios).
- **Categoría** del CSV: siempre vacía en la planilla real, se ignora.
- **`incomeSource`** (solo filas Ingreso) inferido de la descripción: contiene "Rafa" →
  `Aporte de Socio`; contiene "Reintegro" → `Reintegro`; si no, default `Venta`.
- **`expenseCategory`** (solo filas Egreso) inferido de la descripción por palabras clave: "curso"
  → `Educación`; "Frontier"/"Compra"/"Proveedor" → `Compra a Proveedor`; "Keepa"/"SmartScout"/
  "Price Checker"/"RevSeller"/"Amazon Seller"/"Google"/"Claude" → `Suscripciones y Software`;
  "Dominio"/"LLC"/"eSim"/"Impresora"/"papel" → `Gastos Operativos`; si no matchea nada →
  `Otros`. Igual que la inferencia de categoría de proveedores: mejor esfuerzo, revisable a mano
  después.
- Esto corre como un script nuevo `scripts/import-transactions.ts`, calcado en estructura a los
  scripts de import ya existentes (`import-expo.ts`, `import-providers.ts`).
- **Validación cruzada:** la planilla tenía una caja de resumen congelada con Ingresos
  $3.570,31 / Egresos $8.940,41 / Balance −$5.370,10 — pero corresponde a una foto parcial
  (tomada a mediados de febrero, no a las 43 filas completas). Sirve como referencia de que la
  lógica de suma es correcta, no como el total final esperado (el total real, con las 43 filas,
  va a ser distinto).

## 6. Fuera de alcance (este tramo)

- Rentabilidad por producto/proveedor (hoja "Stock" de la misma planilla) — tramo futuro, cuando
  Nico suba ese archivo por separado.
- Gráficos/reportes visuales más allá de las tarjetas de métricas y la tabla de egresos por
  categoría.
- Conciliación bancaria o integración con ninguna cuenta/tarjeta real — todo es entrada manual,
  igual que en la planilla.
- Listas cerradas para `payer`/`method` — quedan en texto libre.
- Cualquier cambio a `/admin` fuera de la nueva sección Finanzas, o al sitio público.
