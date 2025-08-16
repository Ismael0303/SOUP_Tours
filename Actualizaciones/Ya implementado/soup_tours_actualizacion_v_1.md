# SOUP Tours — Actualización v1

## Estado actual (base v0)

- **Arquitectura:** vanilla JS, HTML, CSS sin dependencias externas.
- **Funcionalidades:** alta de miembros, shows, movimientos; persistencia LocalStorage; export/import JSON; UI móvil con tabs y FAB; modales con `<dialog>`.
- **Limitaciones:** sin filtros, búsqueda, edición/eliminación, totales en Caja, balances por show, validaciones claras, CSV, presets de monto, duplicar show, PIN.

---

## Mejoras v1 (día 1 — alto impacto, bajo riesgo)

### 1. Filtros en Caja + Totales

**Objetivo:** facilitar lectura y análisis rápido.

- Chips: `Todos | Común | Personal | [integrantes]`.
- Totales visibles: `Ingresos: $X • Gastos: $Y • Neto: $Z`.
- Filtrar movimientos antes de renderizar.

### 2. Balance por show

**Objetivo:** ver rentabilidad por evento.

- Función `showBalance(showId)` que suma movimientos asociados.
- Mostrar en tarjeta: `Movs.: $<balance>`.

### 3. Validaciones visibles

**Objetivo:** evitar datos incompletos.

- Helper `must(value, msg)`.
- Usar en alta de shows/movimientos.

### 4. Deshacer último cambio

**Objetivo:** corregir errores rápidamente.

- Snapshot previo a mutaciones.
- Botón “Deshacer” en topbar.

### 5. Editar / Eliminar

**Objetivo:** mantener datos limpios.

- Movimientos y shows con menú `⋯` para editar o eliminar.

### 6. Exportar CSV

**Objetivo:** análisis externo.

- Encabezado: `fecha_iso,tipo,scope,integrante,monto,nota,show`.
- Abrible en Excel/Sheets.

### 7. Búsqueda por texto

**Objetivo:** localizar rápido.

- Input en topbar para filtrar por nota/ciudad/venue.

### 8. Presets de monto

**Objetivo:** agilizar carga.

- Botones \$2.000, \$5.000, \$10.000 en form de movimientos.

### 9. Duplicar show

**Objetivo:** ahorrar carga repetitiva.

- Precargar ciudad, venue y cache.

### 10. PIN simple

**Objetivo:** privacidad básica.

- Configurable en ajustes minimal.

---

## Mejoras v2 (día 2 — opcionales y escalables)

### A) PWA mínima

**Objetivo:** uso offline y modo instalable.

- `manifest.json` básico.
- `service-worker.js` que cachee `index.html`, `styles.css`, `app.js`.

### B) IndexedDB en vez de LocalStorage

**Objetivo:** mayor robustez.

- ObjectStore `state` con clave única `root`.
- Métodos `getState` y `setState` asíncronos.

### C) Rider por show

**Objetivo:** logística de equipo.

- Campo `requerimientos` por show.
- Exportable a texto/PDF.

### D) Modo multi‑banda simple

**Objetivo:** separar datos si hay más de una banda.

- Selector inicial de banda.
- Estado y persistencia separados por banda.

---

## Guidelines generales

- **Mantener stack:** HTML/CSS/JS plano.
- **Persistencia:** conservar compatibilidad con datos previos.
- **UX móvil:** elementos táctiles grandes (min. 44×44px), contraste AA, inputs optimizados.
- **Modularidad:** cada nueva función aislada y reutilizable.
- **Sin dependencias:** solo código nativo.

---

## Prompt para agente IA — Implementar v1 + v2

```
Actuá como Senior Frontend dev. Partiendo de SOUP Tours actual (vanilla JS, HTML, CSS), implementá:
- Mejoras v1 (puntos 1–10) en orden.
- Mejoras v2 (A–D) si hay tiempo.

Restricciones:
- No agregar dependencias ni build tools.
- Mantener estructura y datos existentes.
- Persistencia LocalStorage o IndexedDB (si se implementa v2.B).
- UI optimizada para móvil.

Entregables:
- index.html actualizado.
- styles.css con estilos mínimos para nuevas UI (chips, botones, inputs).
- app.js con funciones nuevas y hooks a render().
- manifest.json y service-worker.js (si v2.A).
- Datos seed para pruebas.

Criterios de aceptación:
- Filtros y búsqueda funcionan y combinan entre sí.
- Totales correctos en Caja.
- Balance por show visible.
- Edición/eliminación/deshacer operativos.
- Exportar CSV correcto.
- PWA instala y funciona offline (v2.A).
- IndexedDB persiste datos (v2.B).
```

