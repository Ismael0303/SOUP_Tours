# Diseño Responsive y Paradigma Multipantalla para SOUP Tours

## Principios de Diseño Responsive

1. **Mobile First**\
   Diseñar primero para pantallas chicas y luego escalar.

   - Base mínima: tipografías, espaciado y layout para smartphone.
   - Escalado mediante *media queries* (`@media (min-width:720px)` ya presente en `styles.css`).

2. **Viewport adaptable**\
   Uso de `<meta name="viewport" content="width=device-width, initial-scale=1" />` para asegurar que el ancho lógico coincida con el dispositivo.

3. **Layouts flexibles**\
   Flexbox y Grid como base para que los elementos se reorganicen en distintos anchos.

4. **Unidades relativas**\
   Uso de `rem`, `%`, `vw/vh` en lugar de `px` fijos.

5. **Media Queries**\
   Adaptar progresivamente tipografías y márgenes a medida que aumenta el ancho.

6. **Imágenes fluidas**\
   `max-width:100%`, `object-fit:cover` para que se adapten al contenedor.

7. **Navegación adaptada**\
   Tabs inferiores, FAB flotante y menús simplificados en móvil.

8. **Rendimiento**\
   Cacheo con Service Worker y carga de scripts mínima.

9. **Accesibilidad**\
   Colores contrastantes, botones grandes, atributos `aria-live` y `role="status"` en toasts.

---

## Paradigma Multipantalla en Desktop

### Concepto

En lugar de “ensanchar” cada pantalla móvil para escritorio, se muestran **varias pantallas móviles lado a lado**:

- **Inicio**, **Shows**, **Caja** se renderizan como si fueran tres smartphones colocados en paralelo.
- Cada panel conserva el layout móvil, reduciendo la complejidad de CSS.

### Ventajas

- **Consistencia total** con la versión móvil.
- **Velocidad de desarrollo**: se mantiene una sola versión de cada vista.
- **Productividad en escritorio**: se pueden consultar varias secciones al mismo tiempo.

### Desafíos

- **Espacio sobrante** en monitores muy anchos.
- **Carga extra**: se renderizan las tres vistas en paralelo.
- **Accesibilidad y foco**: requiere buen orden de tabulación izquierda → derecha.

### Ejemplos similares en la web

- **Notion / Trello**: paneles paralelos que muestran diferentes espacios de trabajo.
- **Figma**: múltiples pantallas de móvil visibles a la vez en el lienzo.
- **VS Code / Replit / CodeSandbox**: interfaz con navegador de archivos, editor y terminal/chat en columnas.
- **Chrome DevTools (Device Toolbar)**: permite ver varias vistas móviles a la vez.

Estos ejemplos muestran cómo la lógica de *multi-pantalla* se aplica con éxito en entornos profesionales y colaborativos.

### Implementación sugerida

#### 1) CSS para multipantalla

```css
@media (min-width: 1200px){
  #view.desk-grid {
    display: grid;
    grid-template-columns: repeat(3, 390px);
    gap: 1rem;
    justify-content: center;
  }
  .phone-frame {
    background: #0b0b0c;
    border: 1px solid #2a2d34;
    border-radius: 24px;
    box-shadow: 0 6px 30px rgba(0,0,0,.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .phone-scroll { overflow: auto; padding: 1rem; }
  .tabs, .fab { display: none; } /* Ocultar tabs y FAB global */
}
```

#### 2) Builders de vistas

En `app.js`, extraer el HTML de cada vista en funciones puras (`buildHomeHTML`, `buildShowsHTML`, `buildCashHTML`).

#### 3) Render condicional

En `render()`:

```js
function isDesktopMulti(){ return window.matchMedia('(min-width:1200px)').matches; }

function render(){
  if(isDesktopMulti()){
    view.classList.add('desk-grid');
    view.innerHTML = `
      <section class="phone-frame"><div class="panel-header">Inicio</div><div class="phone-scroll">${buildHomeHTML()}</div></section>
      <section class="phone-frame"><div class="panel-header">Shows</div><div class="phone-scroll">${buildShowsHTML()}</div></section>
      <section class="phone-frame"><div class="panel-header">Caja</div><div class="phone-scroll">${buildCashHTML()}</div></section>`;
    return;
  }
  view.classList.remove('desk-grid');
  if(currentTab==='home') return renderHome();
  if(currentTab==='shows') return renderShows();
  renderCash();
}
```

#### 4) Ajustes UX

- FAB y Tabs se ocultan en desktop.
- Cada panel conserva sus botones “+” (Agregar).
- El modal (`<dialog>`) sigue siendo único y compartido.

---

## Conclusión

- El enfoque **mobile-first + multipantalla en desktop** equilibra simplicidad y productividad.
- Permite lanzar rápido el **PMV** manteniendo consistencia.
- A futuro se puede evaluar un modo “vista expandida” solo si aparecen necesidades específicas de escritorio (ej. tablas densas, drag & drop).

