function runHotfixTests() {
  console.group('[TEST] Hotfix UI/UX');

  try {
    // Test 1: Verificación de la Barra de Navegación
    console.group('[TEST] Navbar');
    const btnMore = document.getElementById('btn-more');
    console.assert(btnMore, 'El botón "Más" (⋯) existe.');

    const oldButtons = ['btn-csv', 'btn-exp-liq', 'btn-export'];
    oldButtons.forEach(id => {
      const btn = document.getElementById(id);
      console.assert(!btn, `El botón con id "${id}" ha sido eliminado.`);
    });
    console.groupEnd();

    // Test 2: Verificación del Menú de Acciones
    console.group('[TEST] Actions Menu');
    if (btnMore) {
      btnMore.click();
      const modal = document.getElementById('modal');
      console.assert(modal.open, 'El modal de acciones se abre al hacer clic en "Más".');
      
      const actionButtons = modal.querySelectorAll('.menu button');
      const expectedActions = ['Exportar CSV (Movimientos)', 'Exportar CSV (Liquidación)', 'Exportar Backup JSON', 'Correr Tests'];
      expectedActions.forEach(text => {
        const found = Array.from(actionButtons).some(btn => btn.textContent.includes(text));
        console.assert(found, `El botón de acción "${text}" existe en el modal.`);
      });

      // Cierra el modal para el siguiente test
      modal.close();
    }
    console.groupEnd();

    // Test 3: Verificación del Comportamiento de Modales
    console.group('[TEST] Modal Behavior');
    // Abre un modal de prueba simple
    open('<form method="dialog" class="card"><h3>Test Modal</h3><menu><button value="cancel">Cerrar</button></menu></form>');
    const testModal = document.getElementById('modal');
    console.assert(document.body.style.overflow === 'hidden', 'El scroll del body se oculta cuando el modal está abierto.');

    testModal.close();
    // Se necesita un pequeño delay para que el evento 'close' se complete
    setTimeout(() => {
      console.assert(document.body.style.overflow === '', 'El scroll del body se restaura al cerrar el modal.');
      console.groupEnd(); // End Modal Behavior Test

      console.log('✅ Todos los tests de hotfix pasaron con éxito.');
      console.groupEnd(); // End Hotfix UI/UX Test
      toast('Tests de hotfix pasaron.', 'success');
    }, 100);

  } catch (error) {
    console.error('❌ Falló un test de hotfix:', error);
    console.groupEnd();
    toast('Falló un test de hotfix. Revisa la consola.');
  }
}
