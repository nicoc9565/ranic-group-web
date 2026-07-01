# Sección Stock — CRM RANIC GROUP

## 1. Objetivo

Agregar una sección "Stock" al CRM que muestre el snapshot más reciente del inventario en depósitos de Amazon (FBA), con historial guardado en Firestore para comparar meses a futuro. La carga del CSV mensual es manual (script), no hay upload desde la web todavía — mismo patrón que se decidió para el import de Amazon Seller en Finanzas.

## 2. Fuente de datos

`C:\Nico-Archivos\ClaudeCode\Ranic-Group\Inventario de Logística de Amazon.csv` — reporte estándar de Amazon Seller ("FBA Inventory Health" / "Restock Recommendations"). 18 filas de producto + header, ~95 columnas; usamos un subconjunto:

| Columna CSV | Uso |
|---|---|
| `snapshot-date` | Fecha del corte (todas las filas del archivo comparten la misma) |
| `sku` | Identificador único de producto |
| `asin` | ASIN de Amazon |
| `product-name` | Nombre del producto (completo, sin truncar en este archivo) |
| `available` | Unidades disponibles para vender |
| `units-shipped-t7` / `t30` / `t60` / `t90` | Unidades vendidas en los últimos 7/30/60/90 días |
| `days-of-supply` | Días que dura el stock actual al ritmo de venta actual |
| `your-price` | Precio de venta actual |
| `fba-inventory-level-health-status` | Healthy / Low stock / Excess / vacío |
| `alert` | Low traffic / Low conversion / vacío |

## 3. Modelo de datos — colección `stockItems`

```ts
export type StockItem = {
  id: string;
  snapshotDate: string;   // yyyy-mm-dd, igual para todas las filas de un mismo import
  sku: string;
  asin: string;
  productName: string;
  available: number;
  unitsShipped30: number;
  unitsShipped90: number;
  daysOfSupply: number | null;   // null si el CSV trae el campo vacío
  price: number;
  healthStatus: string;   // valor crudo del CSV: "Healthy" | "Low stock" | "Excess" | ""
  alert: string;          // valor crudo del CSV: "Low traffic" | "Low conversion" | ""
  createdAt: number;
};
```

Se guarda **historial completo** (cada import agrega filas nuevas con su propio `snapshotDate`, no se sobrescribe nada). La UI v1 solo muestra el snapshot más reciente; el resto queda disponible en Firestore para una futura vista de tendencia.

## 4. lib/stock.ts

```ts
export function subscribeStock(cb: (items: StockItem[]) => void): () => void
```

Suscripción a toda la colección `stockItems` (sin filtrar por fecha — el filtro al snapshot más reciente se hace en la página, igual que otros módulos resuelven sus combinaciones en el cliente).

## 5. Página /admin/stock

**Layout:**

```
STOCK
Snapshot: 30/06/2026

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Unidades     │ Valor de     │ Vendido      │ Vendido      │
│ disponibles  │ inventario   │ (30 días)    │ (90 días)    │
│    491       │  $4234.93    │    74        │    ~250      │
└──────────────┴──────────────┴──────────────┴──────────────┘

Tabla de productos (snapshot más reciente):
SKU | Producto | Disponible | Vendido 30d | Días de stock | Precio | Estado
```

**Métricas (4 tarjetas, mismo componente `MetricCard` reutilizado):**
- **Unidades disponibles:** suma de `available` de todas las filas del snapshot más reciente
- **Valor de inventario:** suma de `available × price` de todas las filas
- **Vendido (30 días):** suma de `unitsShipped30`
- **Vendido (90 días):** suma de `unitsShipped90`

**Tabla:** una fila por producto del snapshot más reciente, columnas SKU, Producto, Disponible, Vendido 30d, Días de stock, Precio, Estado. "Estado" se muestra como badge de color:
- Healthy → verde (`status-ontrack`)
- Low stock → rojo (`status-overdue`)
- Excess → amarillo (`status-today`)
- vacío → gris, sin badge (texto "—")

Sin filtros, sin búsqueda, sin paginado — son ~18 filas, una tabla simple alcanza para v1.

## 6. Nav

Nuevo ítem "Stock" en `components/Nav.tsx`, entre "Finanzas" y el final de la lista (o donde tenga más sentido visualmente — al final, después de Finanzas). Ícono nuevo estilo line-art (ej. una caja/paquete), siguiendo el mismo patrón SVG `viewBox="0 0 24 24"` que el resto.

## 7. Import — scripts/import-stock.ts

Mismo patrón que `scripts/import-amazon-transactions.ts`: Firebase Web SDK + `SEED_USER_PASSWORD`, flag `--dry-run`, parseo con `csv-parse/sync` usando `columns: true` (los headers de este CSV son estables y no chocan con cajas de resumen sueltas, a diferencia del CSV de Finanzas de la planilla).

Cada fila del CSV → un documento `StockItem`. Campos numéricos vacíos (`''`) se parsean como `0` (cantidades) o `null` (`days-of-supply`, que puede venir vacío para productos sin ventas recientes).

## 8. Fuera de alcance

- Upload del CSV desde la web (queda para una fase futura, igual que con Finanzas)
- Vista de tendencia/histórico en la UI (los datos quedan guardados para eso, pero no se construye la vista todavía)
- Edición manual de un `StockItem` desde la web
- Vincular `StockItem` con `Provider` (relación producto↔proveedor) — no hay ese dato en el CSV de Amazon

## 9. Archivos afectados

| Acción | Archivo |
|---|---|
| Modificar | `lib/types.ts` — agregar `StockItem` |
| Crear | `lib/stock.ts` |
| Crear | `app/admin/(crm)/stock/page.tsx` |
| Modificar | `components/Nav.tsx` — nuevo ítem + ícono |
| Crear | `scripts/import-stock.ts` |
| Modificar | `package.json` — script npm `import-stock` |
