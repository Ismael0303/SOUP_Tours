function runTests() {
  console.clear();
  console.log('Starting tests...');

  const assert = (condition, message) => {
    if (!condition) {
      console.error('Assertion Failed:', message);
      throw new Error(message);
    }
    console.log('%cAssertion Passed:', 'color: green', message);
  };

  const runTestScenario = (name, testFn) => {
    console.group(`[TEST SCENARIO] ${name}`);
    try {
      testFn();
      console.log('%cScenario Passed!', 'color: lightgreen;');
    } catch (e) {
      console.error('%cScenario Failed!', 'color: red;', e);
      throw e; // Re-throw to stop further execution if a scenario fails
    } finally {
      console.groupEnd();
    }
  };

  const originalState = JSON.parse(JSON.stringify(STATE));

  try {
    // Test Scenario 1: Basic CRUD and Balances
    runTestScenario('Basic CRUD and Balances', () => {
      const testMemberId = uid('test_');
      STATE = {
        band: { name: 'Test Band', members: [{id:testMemberId, name:'Tester', role:'Drums'}], pin: null },
        shows: [],
        moves: []
      };

      // Test addMember
      addMember('New Guy', 'Triangle');
      assert(window.alive(STATE.band.members).length === 2, 'addMember should increase member count');
      assert(STATE.band.members[1].name === 'New Guy', 'addMember should add member with correct name');

      // Test addShow
      const showData = { date: '2025-12-24', city: 'Testville', venue: 'The Test Room', cache: 1000 };
      addShow(showData);
      assert(STATE.shows.length === 1, 'addShow should increase show count');
      assert(STATE.shows[0].city === 'Testville', 'addShow should add show with correct city');
      const showId = STATE.shows[0].id;

      // Test addMove
      const moveData1 = { kind: 'ingreso', scope: 'comun', amount: 500, note: 'tickets', showId: showId };
      const moveData2 = { kind: 'gasto', scope: 'personal', amount: 50, note: 'beers', memberId: testMemberId, showId: showId };
      addMove(moveData1.kind, moveData1.scope, moveData1.amount, moveData1.note, null, moveData1.showId);
      addMove(moveData2.kind, moveData2.scope, moveData2.amount, moveData2.note, moveData2.memberId, moveData2.showId);
      assert(window.alive(STATE.moves).length === 2, 'addMove should increase move count');
      assert(STATE.moves[0].amount === 50, 'addMove should add moves to the beginning of the array');

      // Test balances
      const bals = balances();
      assert(bals.comun === 500, 'balances should calculate common balance correctly');
      assert(bals.per[testMemberId] === -50, 'balances should calculate personal balance correctly');

      // Test getShowBalance
      const showBal = getShowBalance(showId);
      assert(showBal === 450, 'getShowBalance should calculate show-specific balance');

      // Test updateShow
      updateShow(showId, { city: 'New Testville' });
      assert(STATE.shows[0].city === 'New Testville', 'updateShow should modify show properties');

      // Test undo (single level)
      undo();
      assert(STATE.shows[0].city === 'Testville', 'undo should revert the last change (updateShow)');
    });

    // Test Scenario 2: Merge New Records
    runTestScenario('Merge New Records', () => {
      // Setup initial state for this scenario
      const initialMovesCount = window.alive(STATE.moves).length;
      const initialShowsCount = window.alive(STATE.shows).length;

      // 1) Crear dos movimientos locales
      const m1 = { kind:'ingreso', scope:'comun', amount:1000, note:'Mesa' };
      const m2 = { kind:'gasto', scope:'personal', memberId: STATE.band.members[0]?.id, amount:300, note:'Bebidas' };
      addMove(m1.kind, m1.scope, m1.amount, m1.note, null, null); // Use addMove with individual params
      addMove(m2.kind, m2.scope, m2.amount, m2.note, m2.memberId, null); // Use addMove with individual params

      // 2) Simular otro dispositivo exportando su JSON
      const other = JSON.parse(JSON.stringify(STATE));
      // editar el primero en "other"
      other.moves[0] = { ...other.moves[0], amount:1200, updatedAt: new Date(Date.now()+1000).toISOString() };
      // y agregar uno nuevo
      other.moves.push({ id: 'x123', ts:Date.now(), kind:'ingreso', scope:'comun', amount:500, note:'Promo', createdAt: nowIso(), updatedAt: nowIso(), originId:'dev_fake', deletedAt:null });

      // 3) Merge local + other
      const merged = mergeState(STATE, other);

      // 4) Verificar:
      // - el movimiento común debe quedar en 1200 por ser más nuevo
      // - el nuevo 'x123' debe existir
      assert(merged.moves.find(m=>m.id===STATE.moves[0].id).amount === 1200, 'LWW falló');
      assert(merged.moves.some(m=>m.id==='x123'), 'Nuevo no se incorporó');
      assert(window.alive(merged.moves).length === initialMovesCount + 3, 'Merge should add new moves'); // 2 original + 1 new
      assert(window.alive(merged.shows).length === initialShowsCount, 'Merge should not add new shows'); // No new shows in this test
    });

    // Test Scenario 3: Merge Last-Writer-Wins
    runTestScenario('Merge Last-Writer-Wins', () => {
      // Setup initial state for this scenario
      STATE = {
        band: { name: 'LWW Band', members: [{id:'m_lww', name:'LWW Tester', role:'Guitar'}], pin: null },
        shows: [],
        moves: []
      };
      const commonShowId = uid('show_lww_');
      addShow({ id: commonShowId, date: '2025-01-01', city: 'Original City', venue: 'Original Venue', cache: 100 });

      // Simulate Device A editing the show
      const stateA = JSON.parse(JSON.stringify(STATE));
      const showA = stateA.shows.find(s => s.id === commonShowId);
      showA.city = 'City A';
      showA.updatedAt = new Date(Date.now() + 1000).toISOString(); // Newer timestamp

      // Simulate Device B editing the same show
      const stateB = JSON.parse(JSON.stringify(STATE));
      const showB = stateB.shows.find(s => s.id === commonShowId);
      showB.city = 'City B';
      showB.updatedAt = new Date(Date.now() + 2000).toISOString(); // Even newer timestamp

      // Merge stateA into stateB (or vice-versa, LWW should handle)
      const merged = mergeState(stateA, stateB);
      const mergedShow = merged.shows.find(s => s.id === commonShowId);

      assert(mergedShow.city === 'City B', 'LWW: Newer edit should win');
    });

    // Test Scenario 4: Merge Tombstones (Deletions)
    runTestScenario('Merge Tombstones (Deletions)', () => {
      // Setup initial state for this scenario
      STATE = {
        band: { name: 'Tombstone Band', members: [{id:'m_tomb', name:'Tomb Tester', role:'Bass'}], pin: null },
        shows: [],
        moves: []
      };
      const memberToDeleteId = uid('member_del_');
      addMember('Member to Delete', 'Vocals'); // This will add it to STATE.band.members
      const initialMemberCount = window.alive(STATE.band.members).length;

      // Simulate Device A deleting the member
      const stateA = JSON.parse(JSON.stringify(STATE));
      const memberIndex = stateA.band.members.findIndex(m => m.name === 'Member to Delete');
      stateA.band.members[memberIndex] = markDeleted(stateA.band.members[memberIndex]);

      // Simulate Device B (no changes to this member)
      const stateB = JSON.parse(JSON.stringify(STATE));

      // Merge stateA into stateB
      const merged = mergeState(stateA, stateB);
      const mergedMember = merged.band.members.find(m => m.name === 'Member to Delete');

      assert(mergedMember.deletedAt !== null, 'Tombstone: Member should be marked as deleted');
      assert(window.alive(merged.band.members).length === initialMemberCount - 1, 'Tombstone: Alive members count should decrease');
    });

    console.log('%cAll tests passed successfully!', 'color: lightgreen; font-size: 1.2em;');

  } catch (e) {
    console.error('A test failed, stopping execution.', e);
  } finally {
    // Restore original state
    STATE = originalState;
    save();
    render();
    console.log('Tests finished. Original state restored.');
  }
}