## 2. Feature Descriptions

The SOUP Tours application provides the following key features to help bands manage their tours and finances:

### 2.1. Tour Management (Shows)
*   **Add New Show:** Easily add details for upcoming shows, including date, city, venue, and expected cache (earnings).
*   **Edit Show Details:** Modify existing show information as needed.
*   **Duplicate Show:** Quickly create a new show based on an existing one, useful for recurring gigs or similar events.
*   **View Shows:** Browse a list of all shows, sorted by date.
*   **Show Status:** Each show has a status (pendiente, confirmado, realizado, cancelado) for easy tracking.
*   **Show Financials:** See the expected cache and the total financial movements associated with each show.
*   **Show Closure/Reopening:** Mark shows as 'closed' to prevent further financial movements from being added to them. Reopen if necessary.
*   **Requirements (Rider):** Add specific requirements or rider notes for each show.

### 2.2. Financial Tracking (Cash)
*   **Add New Movement:** Record financial transactions, categorizing them as 'ingreso' (income) or 'gasto' (expense).
*   **Movement Scope:** Assign movements as 'comun' (common band fund) or 'personal' (individual member expense/income).
*   **Member-Specific Movements:** For personal movements, specify the band member involved.
*   **Amount Presets:** Quick buttons for common amounts to speed up data entry.
*   **Notes:** Add descriptive notes to each movement.
*   **Show Association:** Link financial movements to specific shows.
*   **Categories & Tags:** Categorize movements (e.g., Merch, Transporte) and add tags (e.g., #peaje, #ruta) for detailed tracking.
*   **Multi-currency & FX Rates:** Record movements in different currencies and specify the exchange rate to the base currency (ARS).
*   **Receipt Photo (Optional):** Attach a photo of a receipt to a movement.
*   **Edit/Delete Movements:** Modify or remove existing financial records.
*   **Financial Overview:** View total income, expenses, and net balance for common and personal funds.
*   **Filtering:** Filter movements by scope (common/personal) or by individual band member.
*   **Search:** Search movements by note, associated show's city, or venue. Also supports searching by #tags.

### 2.3. Band Member Management
*   **Add New Member:** Register new band members with their name and role.
*   **View Members:** See a list of all registered band members.
*   **Remove Member:** Remove a band member (only if they have no associated personal financial movements).

### 2.4. Data Management & Synchronization
*   **Export Data (JSON):** Export the entire application state as a JSON file for backup or transfer.
*   **Import Data (JSON):** Import a JSON state file.
    *   **Replace:** Overwrite the current application state with the imported data.
    *   **Merge:** Intelligently combine the imported data with the current state. This uses a Last-Writer-Wins (LWW) strategy based on `updatedAt` timestamps, ensuring newer changes are preserved. Deletions (marked by `deletedAt`) are also propagated.
*   **Undo Last Change:** Revert the last state-changing action (up to 3 levels).
*   **Export CSV (Movements):** Export all financial movements to a CSV file, including detailed fields like category, tags, currency, and FX rate.
*   **Export CSV (Liquidation):** Generate a CSV report for member liquidation, calculating personal contributions, expenses, and prorated common expenses.

### 2.5. User Experience & Accessibility
*   **Mobile-First Design:** Optimized for use on mobile devices with responsive UI elements.
*   **Tabs Navigation:** Easy switching between Home, Shows, and Cash sections.
*   **Floating Action Button (FAB):** Quick access to add new shows or movements.
*   **Modals:** Clean dialogs for forms and confirmations.
*   **Toasts:** Non-intrusive feedback messages for user actions, with accessibility features (`role="status"`, `aria-live="polite"`).
*   **PIN Protection:** Optional PIN screen for securing access to the application.

### 2.6. Progressive Web App (PWA) Features
*   **Installable:** Users can "install" the application to their home screen for a native app-like experience.
*   **Offline Support:** The application can load and function even without an internet connection, thanks to Service Worker caching.

### 2.7. Debugging & Testing
*   **Debug Mode:** A `DEBUG` flag enables detailed console logging for development and troubleshooting.
*   **Automated Tests:** An embedded `runTests()` function allows developers to execute a suite of automated tests directly in the browser console to verify core functionalities and data integrity.