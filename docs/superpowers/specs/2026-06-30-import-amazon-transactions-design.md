# Import histórico — Transacciones Amazon Seller

## 1. Objetivo

Cargar a Finanzas el historial de ventas de Amazon Seller (`Transacciones-Amazon-Seller.csv`), complementando los movimientos ya cargados desde la planilla de Nico. Es un import de una sola vez (script), no una funcionalidad nueva en la web — la opción de subir el CSV desde el navegador queda para una fase futura.

## 2. Fuente de datos

`C:\Nico-Archivos\ClaudeCode\Ranic-Group\Transacciones-Amazon-Seller.csv` — 276 filas, columnas: `Fecha, Tipo de transacción, Id. de pedido, Detalles del producto, Cargos por producto (total), Devoluciones promocionales (total), Tarifas de Amazon, Otros ajustes, Total (USD)`. Encoding con BOM UTF-8. Fechas en formato `d/m/yyyy`.

## 3. Regla de agregación (aprobada por Nico)

No se importa fila por fila. Se agrupa **por mes** y se generan **2 movimientos por mes** (o 1 si no hubo ventas ese mes):

- **Venta (Ingreso):** suma de `Cargos por producto (total)` de todas las filas de ese mes.
- **Comisión Amazon (Egreso):** `Venta − suma(Total (USD))` de ese mes — incluye en un solo concepto todo lo que Amazon cobró por cualquier motivo (tarifas por venta, suscripción, almacenamiento, reembolsos, ajustes), ya que `Total (USD)` es lo que realmente liquidó Amazon.
- Si la Venta de un mes es `0`, no se genera el movimiento de Venta — solo el Egreso si la comisión de ese mes es distinta de `0`.
- Meses con Venta = 0 y Comisión = 0 (ej. enero en los datos de prueba) se omiten por completo.

Con los datos actuales esto da, por mes: 2026-02 (solo egreso $19.35), 2026-03, 2026-04, 2026-05, 2026-06 (par Venta/Comisión cada uno). 2026-01 se omite (todo en cero).

## 4. Mapeo a Transaction

```ts
{
  date: "<último día del mes correspondiente, yyyy-mm-dd>",
  type: "Ingreso" | "Egreso",
  description: "Ventas Amazon — <Mes año>" | "Comisión Amazon — <Mes año>",
  amount: <suma calculada, redondeada a 2 decimales>,
  payer: "Amazon",
  method: "Amazon Seller",
  incomeSource: "Venta",       // solo en el movimiento de Ingreso
  expenseCategory: "Otros",    // solo en el movimiento de Egreso — no hay categoría "Comisión Amazon" en
                                // EXPENSE_CATEGORIES hoy; se usa "Otros" para no tocar el enum existente
}
```

`date` usa el último día calendario del mes (ej. `2026-06-30`), no la fecha de una fila puntual, ya que el movimiento representa el total agregado del mes completo.

## 5. Fuera de alcance

- Subir el CSV desde la web (queda para una fase futura — Nico hace este import a mano, una vez por mes, pasándome el archivo)
- Desglose por producto (16 productos identificables en el CSV, pero no se usa en esta carga)
- Cualquier cambio a `lib/types.ts`, `app/admin/(crm)/finanzas/page.tsx`, o componentes de Finanzas — el import usa el modelo `Transaction` ya existente sin modificarlo

## 6. Archivo

| Acción | Archivo |
|---|---|
| Crear | `scripts/import-amazon-transactions.ts` |

Sigue el mismo patrón que `scripts/import-transactions.ts`: Firebase Web SDK + `SEED_USER_PASSWORD`, flag `--dry-run`, batched writes.
