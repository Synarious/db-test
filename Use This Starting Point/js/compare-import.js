(function () {
    'use strict';

    const comparisonBackupKey = 'db-list.pending-comparison';

    function bindComparisonInput(container, apply) {
        const form = container.querySelector('#compare-link-form');
        const input = container.querySelector('#compare-link');
        const fileInput = container.querySelector('#compare-file');
        const linkStatus = container.querySelector('#compare-link-status');
        const status = container.querySelector('#compare-import-status');
        const missingLink = 'Paste the full MyList share link from Results → Share URL (Copy).';
        let request = 0;

        function clearLinkError() {
            linkStatus.textContent = '';
            input.removeAttribute('aria-invalid');
        }

        input.addEventListener('input', clearLinkError);
        form.addEventListener('submit', event => {
            event.preventDefault();
            request++;
            clearLinkError();
            status.textContent = '';
            let hash;
            try {
                hash = DBList.checklistShareHash(new URL(input.value.trim(), location.href).hash);
            } catch {
                // Invalid URLs and URLs without a MyList hash get the same directions.
            }
            try {
                if (!hash) throw new Error(missingLink);
                apply(DBList.parseChecklistShareHash(hash), { hash });
            } catch (error) {
                input.setAttribute('aria-invalid', 'true');
                linkStatus.textContent = error.message;
            }
        });

        container.querySelector('#compare-example').addEventListener('click', () => {
            request++;
            clearLinkError();
            status.textContent = '';
            try {
                apply(undefined, { example: true });
            } catch (error) {
                status.textContent = error.message;
            }
        });

        container.querySelector('#compare-backup').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            const selection = ++request;
            clearLinkError();
            if (file.size > 1024 * 1024) {
                status.textContent = 'Choose a MyList backup of 1 MB or less.';
                return;
            }
            status.textContent = '';
            let backup;
            try {
                backup = await file.text();
            } catch {
                if (selection === request) status.textContent = 'Could not read the selected file.';
                return;
            }
            if (selection !== request) return;
            try {
                apply(DBList.parseAnswerBackup(backup), { backup });
            } catch (error) {
                status.textContent = error.message;
            }
        });
        return () => {
            request++;
            clearLinkError();
        };
    }

    Object.assign(DBList, { bindComparisonInput, comparisonBackupKey });
})();
