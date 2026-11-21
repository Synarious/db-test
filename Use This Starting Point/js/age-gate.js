(function () {
    'use strict';

    const key = 'db-list.age-selection';

    function mountAdultPage(render) {
        const gate = document.querySelector('#age-gate');
        const app = document.querySelector('#app');
        const accept = document.querySelector('#accept-age');
        const decline = document.querySelector('#decline-age');
        const status = document.querySelector('#age-status');
        const note = gate.querySelector('.age-gate-note');
        let pageSelection;

        function savedSelection() {
            if (pageSelection !== undefined) return pageSelection;
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        }

        function showSelection(selection, moveFocus = false) {
            if (selection === 'yes') {
                render();
                gate.hidden = true;
                app.hidden = false;
                if (moveFocus) document.querySelector('#app-heading').focus();
                return;
            }

            const declined = selection === 'no';
            app.hidden = true;
            gate.hidden = false;
            accept.parentElement.hidden = declined;
            gate.querySelector('.age-gate-intro').hidden = declined;
            status.textContent = declined ? 'You must be 18 or older to use MyList.' : '';
            if (moveFocus && declined) status.focus();
        }

        function choose(selection) {
            try {
                localStorage.setItem(key, selection);
            } catch {
                pageSelection = selection;
                note.textContent = 'Your browser could not save this choice for future visits.';
            }
            showSelection(selection, true);
        }

        accept.addEventListener('click', () => choose('yes'));
        decline.addEventListener('click', () => choose('no'));
        status.textContent = '';
        status.tabIndex = -1;
        accept.disabled = false;
        decline.disabled = false;

        window.addEventListener('pageshow', () => showSelection(savedSelection()));
        window.addEventListener('storage', event => {
            if ((event.key === key || event.key === null) && event.storageArea === localStorage) {
                pageSelection = undefined;
                showSelection(savedSelection());
            }
        });

        return function clearAgeSelection() {
            localStorage.removeItem(key);
            pageSelection = undefined;
            showSelection(null);
        };
    }

    Object.assign(DBList, { mountAdultPage });
})();
