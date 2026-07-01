# Finanzas — Ordenar movimientos por columna

## 1. Objetivo

Permitir ordenar la tabla de Movimientos en `/admin/finanzas` haciendo click en los headers de columna (Fecha, Tipo, Descripción, Categoría, Quién, Monto), en vez del orden fijo actual (siempre por fecha descendente).

## 2. Alcance

**Dentro de alcance:**
- `components/TransactionTable.tsx` pasa a manejar su propio estado de orden (columna + dirección)
- Headers clickeables con indicador visual (flecha) de la columna/dirección activa
- `app/admin/(crm)/finanzas/page.tsx` deja de pre-ordenar y le pasa la lista cruda al componente

**Fuera de alcance:**
- Persistir la preferencia de orden entre sesiones (vuelve a Fecha descendente al recargar la página)
- Multi-columna (ordenar por más de un campo a la vez)
- Cambios a Egresos por categoría ni a las métricas

## 3. Comportamiento

- Click en un header no activo: ordena por esa columna, dirección por defecto según tipo de dato — `Fecha` y `Monto` arrancan descendente (más reciente / más alto primero); `Tipo`, `Descripción`, `Categoría`, `Quién` arrancan ascendente (A→Z).
- Click en el header ya activo: invierte la dirección.
- El header activo muestra una flecha (▲ ascendente / ▼ descendente) junto al nombre.
- Orden por defecto al cargar la página: Fecha descendente (igual que el comportamiento actual).
- "Categoría" ordena por el valor mostrado (`incomeSource` o `expenseCategory` según el tipo, ya resuelto por el helper `categoryLabel` existente).
- "Quién" ordena por `payer`.

## 4. Archivos afectados

| Acción | Archivo |
|---|---|
| Modificar | `components/TransactionTable.tsx` |
| Modificar | `app/admin/(crm)/finanzas/page.tsx` |
