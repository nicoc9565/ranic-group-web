# Subir informes de Amazon desde la web — Diseño

## 1. Objetivo

Permitir que Nico actualice los datos de Amazon (inventario y finanzas) **subiendo los
archivos que le da Amazon directamente desde la web**, sin depender de que se corran scripts
de import a mano cada mes. El mismo import de finanzas alimenta además una vista de
**rentabilidad por producto**.

Reemplaza el flujo actual (`scripts/import-stock.ts`, `scripts/import-amazon-transactions.ts`)
por un flujo self-serve con preview y confirmación.

## 2. Alcance

**Dentro de alcance:**
- Upload del **CSV de Inventario FBA** desde la sección Stock.
- Upload del **informe de liquidación V2 (`.txt`)** desde la sección Finanzas.
- Preview con resumen antes de escribir a Firestore, en ambos casos.
- Detección de duplicados y reemplazo seguro.
- Rediseño del modelo de finanzas de Amazon: de agregado mensual a **por liquidación**
  (2 movimientos por liquidación: Ventas Amazon / Gastos Amazon).
- Vista de **rentabilidad por producto** en Stock, con filtro por liquidación.
- **Migración**: eliminar los movimientos mensuales de Amazon cargados por el import viejo.
- **Reconciliación automática** contra el `total-amount` de cada liquidación.

**Fuera de alcance:**
- Subir el CSV de Transacciones-Amazon-Seller (queda obsoleto: el informe V2 lo reemplaza con
  ventajas — trae `settlement-id`, SKU y desglose de tarifas).
- Costo de mercadería (lo que se le paga a proveedores) — se sigue cargando a mano como Egreso;
  no viene en ningún archivo de Amazon.
- Vincular SKU ↔ Proveedor.
- Edición manual de un item importado desde la web.

## 3. Fuentes de datos

### 3.1 Inventario FBA (Stock) — sin cambios respecto de hoy

`Inventario de Logística de Amazon.csv`. Ya documentado en
`2026-06-30-stock-design.md §2`. Se mantiene idéntico: 1 fila por producto, columna
`snapshot-date` común a todas las filas identifica el corte.

### 3.2 Informe de liquidación V2 (Finanzas) — fuente nueva

Archivo `.txt` **separado por tabulaciones**, 36 columnas, un archivo por liquidación.
Ejemplo real revisado: `50038020628.txt` (liquidación `26688578961`).

Estructura:

- **Fila de resumen** (la primera fila de datos): tiene `settlement-id`,
  `settlement-start-date`, `settlement-end-date`, `deposit-date`, `total-amount`, `currency`
  y el resto de columnas vacías. `total-amount` = **el depósito exacto al banco**.
- **Filas de detalle**: `transaction-type` = `Order` / `Refund` / `Subscription Fee` /
  `REVERSAL_REIMBURSEMENT` / etc. Cada pedido se parte en varias filas por concepto.

Columnas que usamos:

| Columna | Uso |
|---|---|
| `settlement-id` | Identificador único de la liquidación (dedup) |
| `settlement-start-date` / `settlement-end-date` | Período de la liquidación |
| `deposit-date` | Fecha en que entró al banco |
| `total-amount` | Neto depositado (solo en la fila de resumen) |
| `transaction-type` | Order / Refund / Subscription Fee / REVERSAL_REIMBURSEMENT / … |
| `sku` | SKU real del producto (ej. `FRONTIER-CELERY-30`) — para rentabilidad |
| `quantity-purchased` | Unidades (para contar vendidas por SKU) |
| `price-type` / `price-amount` | Principal (venta), Tax, Shipping, MarketplaceFacilitatorTax-… |
| `item-related-fee-type` / `item-related-fee-amount` | Commission, FBAPerUnitFulfillmentFee, … |
| `promotion-amount`, `direct-payment-amount`, `other-amount`, `misc-fee-amount`, `shipment-fee-amount`, `order-fee-amount` | Otros importes con signo (suscripción, reembolsos de inventario, promos, etc.) |

**Regla de oro de importe:** todas las columnas de importe llevan su propio signo. La suma de
**todos** los importes de detalle de una liquidación es igual a `total-amount`.

## 4. Modelo de datos

### 4.1 Etiquetas de origen (nuevas, en todo lo importado)

Cada documento que se escribe por un import lleva:

- `importSource`: `"amazon-inventory"` | `"amazon-settlement"`
- `importPeriod`: para Stock, la `snapshotDate`; para Finanzas, el `settlement-id`.

Los documentos cargados a mano **no** tienen estos campos, así que el reemplazo por import
nunca los toca.

### 4.2 `transactions` (Finanzas)

Se agregan campos opcionales al tipo `Transaction` existente:

```ts
importSource?: "amazon-settlement";
importPeriod?: string;        // settlement-id
```

Por cada liquidación se crean **2 documentos**:

```
Ingreso  "Ventas Amazon (liq. 10/06–24/06)"   amount = ventas   incomeSource = "Venta"
Egreso   "Gastos Amazon (liq. 10/06–24/06)"   amount = gastos   expenseCategory = "Comisión Amazon"
```

- `date` = `deposit-date` (día que entró al banco).
- Ambos comparten `importSource="amazon-settlement"` e `importPeriod=<settlement-id>`.
- Se agrega la categoría de egreso **"Comisión Amazon"** a `EXPENSE_CATEGORIES` si no existe,
  para que el cuadro "Egresos por categoría" agrupe bien.

**Cálculo (debe reconciliar exacto):**

- `ventas`  = suma de todos los importes **positivos** de las filas de detalle (money in:
  Principal, Shipping cobrado, reembolsos de inventario, promos a favor, etc.).
- `gastos`  = valor absoluto de la suma de todos los importes **negativos** (money out:
  Commission, FBAPerUnitFulfillmentFee, suscripción, reembolsos a clientes, chargebacks,
  impuestos retenidos, etc.).
- Invariante: `ventas − gastos === total-amount` (tolerancia $0.01). Si no se cumple, el
  import se **rechaza** y muestra error (ver §8).

> Nota sobre impuestos: Amazon cobra impuesto (positivo) y lo retiene (negativo); netean a ~0.
> Van incluidos en ambos lados para garantizar la reconciliación exacta; no alteran el neto.

### 4.3 `amazonSkuSales` (Rentabilidad por producto) — colección nueva

Por cada liquidación, además de los 2 movimientos, se escribe **1 documento por SKU** con lo
vendido de ese SKU en esa liquidación:

```ts
export type AmazonSkuSale = {
  id: string;
  settlementId: string;        // = importPeriod
  periodStart: string;         // yyyy-mm-dd
  periodEnd: string;           // yyyy-mm-dd
  depositDate: string;         // yyyy-mm-dd
  sku: string;
  productName: string;         // mejor nombre disponible; puede quedar "" si no viene
  unitsSold: number;           // suma de quantity-purchased (Order) − devoluciones (Refund)
  ventas: number;              // Principal + shipping cobrado del SKU (money in del SKU)
  gastosAmazon: number;        // comisiones + FBA + refunds del SKU (money out del SKU, positivo)
  neto: number;                // ventas − gastosAmazon
  importSource: "amazon-settlement";
  createdAt: number;
};
```

> `productName` **no** viene en el informe de liquidación (solo el `sku`). Se resuelve al
> momento de escribir, cruzando el SKU con `stockItems`; si no hay match, queda `""`. Por eso
> el parser (§5) devuelve la agregación por SKU **sin** `productName`.

Cada fila de detalle se atribuye a su `sku`. Las filas sin SKU (suscripción, ajustes globales)
**no** entran en `amazonSkuSales` (son costos de la cuenta, no de un producto) — pero **sí**
entran en el `gastos` de §4.2. Por eso: `suma(neto de todos los SKU) ≠ total-amount` (la
diferencia es exactamente la suscripción/ajustes sin SKU), y eso es correcto y esperado.

### 4.4 `stockItems` (Stock)

Se agregan los mismos campos de etiqueta:

```ts
importSource?: "amazon-inventory";
importPeriod?: string;        // snapshotDate
```

## 5. Parsing — lógica pura en `lib/`

Toda la extracción es lógica pura (sin React/Firebase), testeable con Vitest, para que el mismo
parser lo usen tanto el upload de la web como (si hiciera falta) un script.

- `lib/parseInventoryCsv.ts` → `parseInventoryCsv(text: string): StockItem[]`
  (extrae de `2026-06-30-stock-design.md`; ya existía dentro del script, se saca a `lib/`).
- `lib/parseSettlement.ts` → `parseSettlement(text: string): SettlementParseResult`

```ts
export type SkuSaleAgg = {
  sku: string;
  unitsSold: number;
  ventas: number;
  gastosAmazon: number;
  neto: number;
};

export type SettlementParseResult = {
  settlementId: string;
  periodStart: string;   // yyyy-mm-dd
  periodEnd: string;     // yyyy-mm-dd
  depositDate: string;   // yyyy-mm-dd
  totalAmount: number;   // del archivo
  ventas: number;
  gastos: number;
  skuSales: SkuSaleAgg[];   // sin productName (se resuelve al escribir, §4.3)
  reconciles: boolean;   // |ventas − gastos − totalAmount| <= 0.01
};
```

Casos que el parser debe cubrir (tests):
- Reconciliación exacta del ejemplo real (`50038020628.txt` → `total-amount` 216.18,
  `ventas − gastos === 216.18`).
- Suscripción de $39.99 sin SKU: entra en `gastos`, no en `skuSales`.
- `REVERSAL_REIMBURSEMENT` con SKU y `other-amount` positivo: suma a `ventas` y al SKU.
- Refund: unidades y montos restan del SKU correspondiente.
- Números con signo en cualquiera de las columnas de importe.
- Fechas ISO con tz (`2026-06-24T02:27:37+00:00`) → `yyyy-mm-dd`.

## 6. UI de upload (compartida)

Componente reutilizable `components/ImportDialog.tsx` usado por Stock y Finanzas. Recibe el
parser y el resumen a mostrar; no conoce los detalles de cada archivo.

Flujo:
1. Botón **"Subir informe"** en la página (Stock / Finanzas).
2. `<input type="file">` → se lee el archivo en el navegador (FileReader) → se parsea en cliente.
3. Se muestra el **preview** (§7).
4. **"Confirmar importación"** → escribe a Firestore (batch). Mientras escribe, botón en estado
   de carga; al terminar, mensaje de éxito y cierre.
5. Errores de parseo/reconciliación → se muestran en el diálogo, sin escribir nada (§8).

El usuario ya está autenticado (Firebase Auth), así que las escrituras pasan las reglas de
Firestore. No hay backend nuevo.

## 7. Preview

**Stock (Inventario):**
```
Archivo: Inventario de Logística de Amazon.csv
Snapshot: 30/06/2026 · 18 productos · 491 unidades · valor $4234.93

⚠ Ya existe un inventario con esta fecha. Al confirmar se reemplaza.

              [ Cancelar ]   [ Confirmar importación ]
```

**Finanzas (Liquidación):**
```
Archivo: 50038020628.txt
Liquidación 10/06 – 24/06/2026 · depósito 26/06/2026

  Ventas Amazon    +$446,60
  Gastos Amazon    −$230,42
  ───────────────────────────
  Neto             = $216,18   ✓ coincide con el total de Amazon

  22 productos vendidos

  (settlement-id 26688578961 — nuevo)

              [ Cancelar ]   [ Confirmar importación ]
```

Si la liquidación ya está importada, el preview lo indica y ofrece **reemplazar**.
Si la reconciliación falla, el preview muestra el error (§8) y deshabilita "Confirmar".

## 8. Detección de duplicados, reemplazo y errores

**Duplicados:**
- Stock: se busca si ya hay `stockItems` con esa `snapshotDate`.
- Finanzas: se busca si ya hay documentos con `importPeriod === settlement-id`.
- Si existe → aviso en el preview + opción **Reemplazar**.

**Reemplazo (transaccional por lotes):**
- Stock: borra los `stockItems` con esa `snapshotDate` (que tengan `importSource`), escribe los nuevos.
- Finanzas: borra los `transactions` **y** `amazonSkuSales` con ese `importPeriod`, escribe los nuevos.
- Nunca toca documentos sin `importSource` (los cargados a mano).

**Errores (no se escribe nada):**
- Archivo con formato inesperado (columnas faltantes, no es tab-separated, CSV equivocado).
- Reconciliación fallida (`ventas − gastos ≠ total-amount`): mensaje claro con los 3 números
  para que Nico vea la diferencia. Esto es la salvaguarda contra cargar datos mal.

## 9. Migración de datos existentes

Los movimientos de Amazon cargados por el import mensual viejo (PR #10) deben eliminarse para
no contar doble. Son ~9 documentos con descripciones tipo `"Ventas Amazon — <Mes> 2026"` y
`"Comisión Amazon — <Mes> 2026"` y **sin** `importSource`.

- Tarea de migración puntual (script con `--dry-run`, patrón ya usado): identificar esos
  movimientos por descripción, reportar el conteo (esperado 9), y borrarlos tras confirmación.
- Los movimientos cargados a mano (Running Group, aportes de socio, suscripciones sueltas
  cargadas manualmente, etc.) **no** se tocan.
- Después de migrar, Nico sube las liquidaciones una por una desde la web.

## 10. Reconciliación / verificación (checklist de aceptación)

Se verifica varias veces hasta que quede perfecto:

1. Cada liquidación importada: `Ventas − Gastos` en la app = `total-amount` del archivo = fila
   correspondiente de la tabla "Todos los extractos" de Amazon.
2. Suma de netos de todas las liquidaciones importadas = suma de "Importe del pago" de la tabla
   de Amazon (~$1.017 + el período aún no cerrado).
3. En "Egresos por categoría", "Comisión Amazon" (o "Gastos Amazon") aparece con el total
   correcto; en "Ingresos por categoría", "Venta" incluye las ventas de Amazon.
4. Rentabilidad por producto: para una liquidación, `suma(neto por SKU) + costos sin SKU` =
   neto de la liquidación.
5. No quedan movimientos duplicados ni restos del import mensual viejo.

## 11. Rentabilidad por producto (Stock)

Nueva sección en `/admin/stock`, debajo del inventario actual.

- `lib/amazonSkuSales.ts` → `subscribeAmazonSkuSales(cb)`: suscripción a la colección.
- Selector de período: **"Todo el histórico"** (default) + una opción por cada liquidación
  importada (`periodStart – periodEnd`).
- Tabla agregada por SKU según el período elegido:

```
Rentabilidad por producto            [ Todo el histórico ▾ ]

Producto             Vendido   Ingreso   Gastos Amazon   Neto
FRONTIER-CELERY-30     42       $354,48    −$164,64      $189,84
FRONTIER-ONION-40      28       $217,56    −$110,32      $107,24
…
```

- "Todo el histórico" suma todas las liquidaciones por SKU. Un período puntual filtra por
  `settlementId`.
- El nombre de producto se toma del inventario (`stockItems`) por SKU cuando existe; si no,
  del propio informe.

## 12. Archivos afectados

| Acción | Archivo |
|---|---|
| Crear | `lib/parseSettlement.ts` + tests |
| Crear | `lib/parseInventoryCsv.ts` (extraído del script) + tests |
| Crear | `lib/amazonSkuSales.ts` |
| Crear | `components/ImportDialog.tsx` |
| Modificar | `lib/types.ts` — `Transaction` (+`importSource`/`importPeriod`), `StockItem` (idem), `AmazonSkuSale`, `EXPENSE_CATEGORIES` (+"Comisión Amazon") |
| Modificar | `app/admin/(crm)/stock/page.tsx` — botón subir + sección rentabilidad |
| Modificar | `app/admin/(crm)/finanzas/page.tsx` — botón subir liquidación |
| Crear | `lib/importWrite.ts` — escritura por lotes + reemplazo (Stock y Finanzas) |
| Crear | `scripts/migrate-remove-monthly-amazon.ts` — migración puntual con `--dry-run` |
| Modificar | `package.json` — script de migración |
| Obsoletos (se pueden quitar luego) | `scripts/import-stock.ts`, `scripts/import-amazon-transactions.ts` |

## 13. Notas de implementación

- Reusar tokens y componentes existentes (`MetricCard`, tablas, `rounded-card`, etc.).
- Idioma UI español; nada de contenido de emails acá.
- Escrituras a Firestore en `writeBatch` (máx 500 ops por lote; partir si hiciera falta —
  una liquidación son ~2 + N SKUs, muy por debajo del límite).
- Firestore rechaza `undefined`: omitir campos opcionales vacíos.
