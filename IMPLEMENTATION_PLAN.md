### **Action Plan: Integrating Libraries into SOUP Tours**

This document outlines a step-by-step plan to integrate modern, lightweight libraries into the SOUP Tours application. The goal is to improve performance, code maintainability, and features while respecting the project's minimalist, dependency-free spirit.

### **Phase 0: Setup**

1.  **Add Libraries via CDN:** Modify `index.html` to include the libraries from a CDN. This is the simplest method and requires no build tools. Add these lines in the `<head>` section:

    ```html
    <!-- Add near the top, after the stylesheet -->
    <script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/frappe-charts@1.6.2/dist/frappe-charts.min.iife.js"></script>
    <script type="module">
      // Import lit-html functions and make them globally available
      import { html, render } from 'https://cdn.jsdelivr.net/npm/lit-html@2/lit-html.js';
      window.lit = { html, render };
    </script>
    ```

### **Phase 1: Integrate `Day.js` (Low-Impact Changes)**

The goal here is to replace all manual date handling with `Day.js` for better formatting and reliability.

1.  **Update Show Rendering & Sorting:** In the `renderShows` function, use `dayjs()` to format the displayed date and to provide a more robust sorting comparison.
2.  **Update Show Form:** In `openShowForm`, use `dayjs().format('YYYY-MM-DD')` to set the default value for the date input to the current day for new shows.
3.  **Test:** Verify that dates are formatted correctly, sorting is accurate, and the "New Show" form defaults to today's date.

### **Phase 2: Refactor UI with `lit-html` (Core Refactoring)**

This phase is the most significant. We will convert the `render` functions one by one to use `lit-html`.

1.  **Refactor `renderShows`:** Convert the manual string building into a `lit-html` template. Use `@click` for declarative event handlers. Replace the `view.innerHTML = ...` call with `window.lit.render(template, view)`.
2.  **Refactor `renderCash` and `renderHome`:** Repeat the process for the other two main views.
3.  **Refactor Modals:** Modify the `open()` function to accept and render a `lit-html` template. Convert the forms in `openShowForm`, `openMoveForm`, etc., into templates. This will dramatically improve the readability of form creation logic.

### **Phase 3: Add Financial Chart with `Frappe Charts`**

The goal is to add a visual overview of finances to the home screen.

1.  **Add Chart Container:** In the `renderHome` function's `lit-html` template, add a container for the chart, like `<div id="home-chart" class="card"></div>`.
2.  **Prepare Data:** In `renderHome`, after rendering the template, process `STATE.moves` to create a data object suitable for Frappe Charts. A good starting point is to show total expenses per category.
    ```javascript
    // Example data structure
    const chartData = {
      labels: ["Merch", "Transporte", "Comida", "Alojamiento"],
      datasets: [{
        name: "Gastos",
        values: [15000, 25000, 12000, 18000]
      }]
    };
    ```
3.  **Initialize Chart:** Create a new chart instance attached to the container.
    ```javascript
    const chartContainer = document.getElementById('home-chart');
    if (chartContainer) {
      new frappe.Chart(chartContainer, {
        title: "Gastos por Categoría",
        data: chartData,
        type: 'donut', // or 'bar', 'pie'
        height: 250,
        colors: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0']
      });
    }
    ```

### **Phase 4: Final Verification**

1.  **Manual Testing:** Thoroughly click through the entire application. Ensure all buttons, forms, filters, charts, and actions work as expected.
2.  **Automated Testing:** Run the existing test suite via the "Correr Tests" button. The core data logic tests should still pass. If any fail, debug and fix them.
