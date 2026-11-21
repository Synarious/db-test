(function () {
    'use strict';

    const {
        createAnswerBackup, parseAnswerBackup, importChecklist, clearAnswers, downloadFile,
        checklistShareHash, parseChecklistShareHash, bindChecklistShareUrl,
        mountAdultPage, isAnswerStorageEvent, comparisonBackupKey,
        getSavedProfiles, addSavedProfile, selectSavedProfile, renameSavedProfile, removeSavedProfile,
    } = DBList;
    const maxBackupBytes = 1024 * 1024;
    const app = document.querySelector('#app');
    document.querySelector('.skip-link').addEventListener('click', event => {
        event.preventDefault();
        document.querySelector('#main').focus();
    });

    function refreshAfterImport() {
        refreshProfiles();
        const { profile } = DBList.readChecklist();
        const query = DBList.checklistQuery({
            advanced: profile.mode ? profile.mode === 'advanced' : DBList.advancedMode,
            fantasy: profile.fantasy ? profile.fantasy === '1' : DBList.showFantasy,
        });
        DBList.updateSiteNav(query);
    }

    function bindSavedProfiles() {
        const list = document.querySelector('#saved-profile-list');
        const row = document.querySelector('#saved-profile-row');
        const empty = document.querySelector('#no-saved-profiles');
        const addForm = document.querySelector('#add-profile');
        const editDialog = document.querySelector('#edit-profile-dialog');
        const shareDialog = document.querySelector('#share-profile-dialog');
        const renameForm = document.querySelector('#rename-profile');
        const newName = document.querySelector('#new-profile-name');
        const savedName = document.querySelector('#saved-profile-name');
        const editRatings = document.querySelector('#edit-profile-ratings');
        const activate = document.querySelector('#activate-profile');
        const remove = document.querySelector('#remove-profile');
        const status = document.querySelector('#saved-profile-status');
        const editStatus = document.querySelector('#edit-profile-status');
        const fields = [...addForm.elements, ...renameForm.elements, editRatings, activate, remove];
        const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
        const countFormat = new Intl.NumberFormat();
        let previousState;
        let state;
        let editingId;
        let sharingId;
        let updating = false;
        const refreshShareUrl = bindChecklistShareUrl(() => DBList.createChecklistShareUrl(sharingId));

        function focusRow(id, action = 'edit') {
            const item = Array.from(list.children).find(item => item.dataset.profileId === id);
            (item?.querySelector(`[data-action="${action}"]`) ?? newName).focus();
        }

        function refresh() {
            state = getSavedProfiles();
            const snapshot = JSON.stringify(state);
            if (snapshot === previousState) return;
            previousState = snapshot;
            const focused = document.activeElement;
            const focusedId = list.contains(focused) && focused.closest('li').dataset.profileId;
            list.replaceChildren(...state.profiles.map(profile => {
                const item = row.content.firstElementChild.cloneNode(true);
                item.dataset.profileId = profile.id;
                item.querySelector('h3').textContent = profile.name;
                item.querySelector('.profile-active').hidden = profile.id !== state.activeId;
                const created = profile.createdAt
                    ? 'Created ' + dateFormat.format(new Date(profile.createdAt)) : 'Original date unknown';
                const { answerCount } = profile;
                const answered = answerCount === null ? 'Answer count unavailable'
                    : countFormat.format(answerCount) + (answerCount === 1 ? ' question answered' : ' questions answered');
                item.querySelector('.profile-meta').textContent = created + ' · ' + answered;
                for (const action of item.querySelectorAll('[data-action]')) {
                    action.setAttribute('aria-label', action.textContent + ' ' + profile.name);
                }
                item.querySelector('[data-action="compare"]').href = 'compare.html?' + new URLSearchParams({ profile: profile.id });
                return item;
            }));
            list.hidden = !state.profiles.length;
            empty.hidden = !list.hidden;
            if (focusedId) focusRow(focusedId, focused.dataset.action);
            activate.hidden = editingId === state.activeId;
        }

        function refreshActiveView() {
            const url = new URL(location.href);
            url.searchParams.delete('mode');
            url.searchParams.delete('fantasy');
            history.replaceState(history.state, '', url);
            const { advanced, fantasy } = DBList.checklistView('', '');
            DBList.advancedMode = advanced;
            DBList.showFantasy = fantasy;
            DBList.updateSiteNav();
        }

        async function update(change, message, feedback = status) {
            if (updating) return false;
            updating = true;
            for (const field of fields) field.disabled = true;
            const previousId = state?.activeId;
            try {
                await change();
                refresh();
                if (state.activeId !== previousId) refreshActiveView();
                status.textContent = message;
                return true;
            } catch (error) {
                feedback.textContent = error.message || 'Could not update saved profiles.';
                return false;
            } finally {
                updating = false;
                for (const field of fields) field.disabled = false;
            }
        }

        addForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (await update(() => addSavedProfile(newName.value), 'Profile added and selected.')) {
                addForm.reset();
                focusRow(state.activeId);
            }
        });
        list.addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');
            if (!button || updating) return;
            const { profileId } = button.closest('li').dataset;
            const profile = state.profiles.find(profile => profile.id === profileId);
            status.textContent = '';
            if (button.dataset.action === 'edit') {
                editingId = profileId;
                savedName.value = profile.name;
                editStatus.textContent = '';
                activate.hidden = profileId === state.activeId;
                editDialog.showModal();
            } else if (button.dataset.action === 'share') {
                sharingId = profileId;
                shareDialog.querySelector('h2').textContent = 'Share ' + profile.name;
                refreshShareUrl();
                shareDialog.showModal();
            } else {
                try {
                    const backup = createAnswerBackup(profileId);
                    downloadFile(new Blob([backup], { type: 'application/json' }), 'deviant-bound-mylist-backup.json');
                    status.textContent = 'Backup download requested for “' + profile.name + '”.';
                } catch {
                    status.textContent = 'Could not export this profile. Check your browser storage and download settings.';
                }
            }
        });
        shareDialog.addEventListener('close', () => {
            if (!shareDialog.open) shareDialog.querySelector('#share-link').value = '';
        });
        renameForm.addEventListener('submit', async event => {
            event.preventDefault();
            const id = editingId;
            if (await update(() => renameSavedProfile(id, savedName.value), 'Profile renamed.', editStatus)) {
                editDialog.close();
                focusRow(id);
            } else if (editDialog.open) savedName.focus();
        });
        activate.addEventListener('click', async () => {
            const id = editingId;
            if (await update(() => selectSavedProfile(id), 'Active profile switched.', editStatus)) {
                editDialog.close();
                focusRow(id);
            }
        });
        editRatings.addEventListener('click', async () => {
            const id = editingId;
            if (await update(() => selectSavedProfile(id), '', editStatus)) location.assign('index.html');
        });
        remove.addEventListener('click', async () => {
            const profile = state.profiles.find(profile => profile.id === editingId);
            if (!profile || !window.confirm('Remove “' + profile.name + '” and its saved ratings and settings?')) return;
            if (await update(() => removeSavedProfile(profile.id), 'Profile removed.', editStatus)) {
                editDialog.close();
                focusRow(state.activeId);
            }
        });

        return function refreshProfiles() {
            const previousId = state?.activeId;
            try {
                refresh();
                if (previousId !== undefined && state.activeId !== previousId) refreshActiveView();
                if (shareDialog.open) refreshShareUrl();
                if (editDialog.open && !state.profiles.some(profile => profile.id === editingId)) {
                    editDialog.close();
                    status.textContent = 'This profile is no longer available.';
                    focusRow(state.activeId);
                }
            } catch {
                status.textContent = 'Could not load saved profiles. Check your browser storage settings.';
            }
        };
    }

    const refreshProfiles = bindSavedProfiles();

    function importReport({ added, matching, conflicts, skipped }) {
        return 'Added ' + added + ' · Already matched ' + matching + ' · Conflicts kept ' + conflicts + ' · Skipped ' + skipped;
    }

    function bindImports() {
        const dialog = document.querySelector('#import-dialog');
        const heading = document.querySelector('#import-review-heading');
        const close = document.querySelector('#close-import');
        const summary = document.querySelector('#import-summary');
        const form = document.querySelector('#confirm-import');
        const destination = form.elements.destination;
        const activeLabel = document.querySelector('#import-active-label');
        const nameField = document.querySelector('#import-name-field');
        const name = document.querySelector('#import-profile-name');
        const status = document.querySelector('#import-status');
        const viewList = document.querySelector('#view-imported-list');
        const backup = document.querySelector('#import-answers');
        const fileInput = document.querySelector('#answer-backup-file');
        const urlForm = document.querySelector('#import-share-url');
        const urlInput = document.querySelector('#import-url-value');
        let review;
        let saving = false;

        function updateDestination() {
            const creating = destination.value === 'new';
            nameField.hidden = !creating;
            name.required = creating;
            status.textContent = '';
        }

        function readTarget() {
            const { activeId, profiles } = getSavedProfiles();
            const active = profiles.find(profile => profile.id === activeId);
            activeLabel.textContent = active ? 'Fill blank fields in “' + active.name + '”' : 'Fill blank fields in MyList';
            return activeId;
        }

        function startReview(source, hash) {
            review = { source, hash };
            heading.textContent = 'Review import';
            summary.textContent = '';
            form.reset();
            form.hidden = true;
            viewList.hidden = true;
            updateDestination();
            return review;
        }

        function setPreview(checklist) {
            const count = Object.keys(checklist.answers).length + Object.keys(checklist.profile).length;
            if (!count) {
                summary.textContent = 'No compatible entries found. Skipped ' + checklist.skipped + '.';
                return;
            }
            review.target = readTarget();
            review.checklist = checklist;
            summary.textContent = count + (count === 1 ? ' compatible entry.' : ' compatible entries.') +
                ' Skipped ' + checklist.skipped + '.';
            form.hidden = false;
        }

        function showReview() {
            if (dialog.open) heading.focus();
            else dialog.showModal();
        }

        function removeImportHash(hash) {
            if (!hash || checklistShareHash(location.hash) !== hash) return;
            const url = new URL(location.href);
            url.hash = '';
            history.replaceState(history.state, '', url);
        }

        function closeReview() {
            if (saving) return;
            removeImportHash(review?.hash);
            review = undefined;
            dialog.close();
        }

        close.addEventListener('click', closeReview);
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            closeReview();
        });

        backup.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file) return;

            const reading = startReview('backup');
            if (file.size > maxBackupBytes) {
                summary.textContent = 'This file is too large. Choose a MyList backup of 1 MB or less.';
                showReview();
                return;
            }

            summary.textContent = 'Reading backup…';
            showReview();
            try {
                const text = await file.text();
                if (review !== reading) return;
                try {
                    setPreview(parseAnswerBackup(text));
                } catch (error) {
                    summary.textContent = error.message;
                }
            } catch {
                if (review === reading) summary.textContent = 'Could not read the selected file.';
            }
        });

        function reviewShare(hash, source) {
            startReview(source, source === 'link' ? hash : undefined);
            try {
                if (!hash) throw new Error('Paste a MyList share URL.');
                const checklist = parseChecklistShareHash(hash);
                // Sharing permissions belong to the sender's link.
                delete checklist.profile.shareGender;
                DBList.includeRatedSections(checklist.answers, checklist.profile);
                setPreview(checklist);
            } catch (error) {
                summary.textContent = error.message;
            }
            showReview();
        }

        urlForm.addEventListener('submit', event => {
            event.preventDefault();
            let hash = '';
            try {
                hash = checklistShareHash(new URL(urlInput.value.trim(), location.href).hash);
            } catch {
                // Missing or invalid URLs use the same message.
            }
            reviewShare(hash, 'paste');
        });

        form.addEventListener('change', event => {
            if (event.target.name === 'destination') updateDestination();
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (saving || !review?.checklist) return;
            const newName = destination.value === 'new' ? name.value.trim() : null;
            if (newName === '') {
                status.textContent = 'Enter a profile name.';
                name.focus();
                return;
            }

            const { checklist, source, target, hash } = review;
            saving = true;
            close.disabled = true;
            for (const field of form.elements) field.disabled = true;
            status.textContent = '';
            try {
                let result;
                if (newName !== null) {
                    await addSavedProfile(newName, checklist);
                    result = 'Imported into “' + newName + '” and made it active.';
                } else {
                    const confirmRecovery = source === 'backup' ? () => window.confirm(
                        'Your saved MyList data is unreadable. Replace it with the compatible entries from this backup?') : undefined;
                    const report = await importChecklist(checklist, confirmRecovery, target);
                    if (!report) {
                        status.textContent = 'Recovery canceled.';
                        return;
                    }
                    result = importReport(report);
                }

                refreshAfterImport();
                removeImportHash(hash);
                if (source === 'paste') urlForm.reset();
                review = undefined;
                form.hidden = true;
                heading.textContent = 'Import complete';
                status.textContent = result;
                viewList.hidden = false;
                viewList.focus();
            } catch (error) {
                if (newName === null && error.message === 'The active profile changed.') {
                    review.target = readTarget();
                    status.textContent = 'The active profile changed. Check the destination before importing.';
                } else {
                    status.textContent = 'Could not save the import. Check your browser storage settings.';
                }
            } finally {
                for (const field of form.elements) field.disabled = false;
                close.disabled = false;
                saving = false;
            }
        });

        return function showSharedImport() {
            if (app.hidden || saving) return;
            const hash = checklistShareHash(location.hash);
            if (hash && hash !== review?.hash) reviewShare(hash, 'link');
            else if (!hash && review?.hash) closeReview();
        };
    }

    const clearButton = document.querySelector('#clear-answers');
    const clearStatus = document.querySelector('#clear-status');
    clearButton.addEventListener('click', async () => {
        if (!window.confirm('Delete all saved MyList profiles, ratings, settings, and your age-gate choice from this browser? Downloaded files and existing share links are separate copies.')) {
            clearStatus.textContent = 'Deletion canceled.';
            return;
        }
        clearButton.disabled = true;
        try {
            sessionStorage.removeItem(comparisonBackupKey);
            await clearAnswers();
            refreshProfiles();
            clearAgeSelection();
            clearStatus.textContent = 'MyList data cleared from this browser.';
        } catch {
            clearStatus.textContent = 'Could not clear saved data. Check your browser storage settings.';
        } finally {
            clearButton.disabled = false;
        }
    });

    const showSharedImport = bindImports();
    window.addEventListener('hashchange', showSharedImport);
    window.addEventListener('storage', event => {
        if (!app.hidden && isAnswerStorageEvent(event)) {
            refreshProfiles();
        }
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted && !app.hidden) {
            refreshProfiles();
        }
    });
    const clearAgeSelection = mountAdultPage(() => {
        refreshProfiles();
        queueMicrotask(showSharedImport);
    });
    clearButton.disabled = false;
})();
