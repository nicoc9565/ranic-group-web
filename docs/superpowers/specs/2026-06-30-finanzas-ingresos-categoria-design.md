# Finanzas — Ingresos por categoría

## 1. Objetivo

Agregar un cuadro "Ingresos por categoría" en `/admin/finanzas`, con el mismo formato que el ya existente "Egresos por categoría", mostrando el desglose por `IncomeSource` (Venta, Aporte de Socio, Reintegro). Los dos cuadros quedan lado a lado.

## 2. Alcance

**Dentro de alcance:**
- Cálculo `byIncomeSource` en `app/admin/(crm)/finanzas/page.tsx`, mismo patrón que el `byCategory` existente
- Layout de dos columnas (`Egresos por categoría` | `Ingresos por categoría`) en desktop, apiladas en mobile
- Reutilizar el mismo markup de tabla simple que ya usa Egresos por categoría — no hace falta un componente nuevo

**Fuera de alcance:**
- Categorías de Egreso personalizadas / texto libre (eso quedó descartado — la confusión inicial era que faltaba el cuadro de Ingresos, no que faltaran categorías nuevas)
- Cambios al modelo de datos (`IncomeSource`/`INCOME_SOURCES` ya existen tal cual se necesitan)

## 3. Comportamiento

- `byIncomeSource`: igual que `byCategory`, pero arranca un `Map` con las 3 claves de `INCOME_SOURCES` en 0, y suma `t.amount` de cada `Transaction` con `t.type === "Ingreso"` según su `incomeSource`.
- Layout: los dos bloques ("Egresos por categoría" e "Ingresos por categoría") pasan a vivir dentro de un grid de 2 columnas en `sm:` y superior (`grid-cols-1 sm:grid-cols-2 gap-4`), cada uno con su propio título de sección.
- Sin cambios visuales a la tabla en sí (misma fila: nombre a la izquierda, monto en mono a la derecha).

## 4. Archivos afectados

| Acción | Archivo |
|---|---|
| Modificar | `app/admin/(crm)/finanzas/page.tsx` |
