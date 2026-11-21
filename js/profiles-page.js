import { modes } from './questions.js';
import { isRating } from './quiz-state.js';
import { clearDraft, defaultProfile, isDefaultDraftChange } from './session.js';
import { localResultLink, sharedResultLink } from './result-links.js';
import { decodeResults, resultsHashFromLink } from './shared-results.js';
import {
    activeProfile, createProfile, downloadProfileBackup, importProfile, isProfileChange, listProfiles,
    readProfile, removeProfile, savedTheme, selectProfile, themes, updateProfile,
} from './profile-store.js';

const manager = document.querySelector('#profile-manager');
const list = document.querySelector('#profile-list');
const template = document.querySelector('#profile-row');
const createForm = document.querySelector('#create-form');
const copyProgress = document.querySelector('#copy-progress-option');
const importButton = document.querySelector('#import-profile');
const backupFile = document.querySelector('#backup-file');
const importLinkButton = document.querySelector('#import-share-link');
const importDialog = document.querySelector('#import-share-dialog');
const importForm = document.querySelector('#import-share-form');
const importStatus = document.querySelector('#import-share-status');
const status = document.querySelector('#profile-status');
const storageStatus = document.querySelector('#profile-storage-status');
const editProfile = document.querySelector('#edit-profile-dialog');
const editForm = document.querySelector('#edit-profile-form');
const editStatus = document.querySelector('#edit-profile-status');
const resetProfile = document.querySelector('#reset-profile-dialog');
const resetStatus = document.querySelector('#reset-profile-status');
const deletion = document.querySelector('#delete-dialog');
const deleteStatus = document.querySelector('#delete-status');
let editingId = null;

for (const [id, label] of Object.entries(themes)) {
    editForm.elements.theme.add(new Option(label, id));
}

function showStatus(message, focus = false) {
    status.textContent = message;
    if (focus) status.focus();
}

function profileRow(profile, selected, hasDefaultProgress) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.profileId = profile.id ?? '';
    row.classList.toggle('is-active', selected);
    row.querySelector('.profile-name').textContent = profile.name;
    row.querySelector('.profile-badge').hidden = !selected;
    row.querySelector('.profile-theme').textContent = themes[profile.theme];
    row.querySelector('[data-action="activate"]').hidden = selected;
    row.querySelector('[data-action="edit"]').hidden = !profile.id;
    row.querySelector('[data-action="delete"]').hidden = !profile.id;
    row.querySelector('[data-action="export"]').hidden = !profile.id && !hasDefaultProgress;
    for (const button of row.querySelectorAll('[data-action]')) {
        button.setAttribute('aria-label', `${button.title || button.textContent} for ${profile.name}`);
    }
    renderProfileProgress(row, profile, selected);
    return row;
}

function renderProgressCell(cell, { state, summaryText, href, linkText, label, shareHref }) {
    const summary = document.createElement('span');
    summary.className = 'profile-progress-status';
    summary.dataset.state = state;
    summary.textContent = summaryText;
    cell.append(summary);
    if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = linkText;
        link.setAttribute('aria-label', `${linkText} for ${label}`);
        cell.append(link);
    }
    if (shareHref) {
        const share = document.createElement('a');
        share.className = 'button secondary profile-share';
        share.href = shareHref;
        share.textContent = 'Share results';
        share.setAttribute('aria-label', `Share results for ${label}`);
        cell.append(share);
    }
}

function renderProfileProgress(row, profile, showLinks) {
    const { id, drafts, importedResults } = profile;
    for (const [mode, settings] of Object.entries(modes)) {
        const draft = drafts[mode];
        const ratings = Object.values(draft.responses);
        const rated = ratings.filter(isRating).length;
        const state = draft.completedAt ? 'complete' : ratings.length ? 'started' : 'empty';
        const summary = draft.completedAt ? 'Complete' : ratings.length ? `${rated} of ${settings.items.length} rated` : 'Not started';
        const href = draft.completedAt ? localResultLink(mode, id) : `quiz.html?mode=${mode}`;
        const linkText = draft.completedAt ? 'View results' : ratings.length ? 'Resume' : 'Start';
        renderProgressCell(row.querySelector(`[data-progress="${mode}"]`), {
            state,
            summaryText: summary,
            href: showLinks ? href : null,
            linkText,
            label: `${profile.name} ${settings.label}`,
            shareHref: draft.completedAt ? localResultLink(mode, id, { share: true }) : null,
        });
    }
    renderProgressCell(row.querySelector('[data-progress="imported"]'), {
        state: importedResults ? 'complete' : 'empty',
        summaryText: importedResults ? 'Saved' : 'None',
        href: showLinks && importedResults ? localResultLink(null, id) : null,
        linkText: 'View report',
        label: `${profile.name} imported results`,
        shareHref: importedResults ? localResultLink(null, id, { share: true }) : null,
    });
}

function renderProfiles() {
    const active = activeProfile();
    let profiles = [];
    let available = true;
    try {
        profiles = listProfiles();
    } catch {
        available = false;
    }

    const defaults = defaultProfile();
    const hasDefaultProgress = Object.values(defaults.drafts).some(draft => Object.keys(draft.responses).length);
    list.replaceChildren(...[defaults, ...profiles].map(profile => profileRow(profile, profile.id === active?.id, hasDefaultProgress)));
    storageStatus.hidden = available;
    copyProgress.hidden = !hasDefaultProgress;
    createForm.querySelector('button[type="submit"]').disabled = !available;
    importButton.disabled = !available;
    importLinkButton.disabled = !available;
}

function profilesChanged(message) {
    document.dispatchEvent(new Event('quizprofilechange'));
    showStatus(message, true);
}

function confirmReset(profile) {
    editingId = profile?.id ?? null;
    const imported = profile?.importedResults ? ' and the imported report' : '';
    document.querySelector('#reset-profile-description').textContent =
        `Clear the answers and results for both tests${imported} in ${profile?.name ?? 'Default'}? Profile settings will be kept.`;
    resetStatus.textContent = '';
    resetProfile.showModal();
}

createForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = createForm.elements.name.value.trim();
    if (!name) {
        showStatus('Enter a profile name.');
        createForm.elements.name.focus();
        return;
    }
    let profile;
    try {
        const copy = !copyProgress.hidden && createForm.elements.copyProgress.checked;
        profile = createProfile({ name, theme: savedTheme(), drafts: copy ? defaultProfile().drafts : undefined });
    } catch {
        showStatus('Could not create the profile. Check browser storage and try again.');
        return;
    }
    createForm.reset();
    try {
        selectProfile(profile.id);
    } catch {
        profilesChanged(`${profile.name} was saved. Select Make active to use it.`);
        return;
    }
    profilesChanged(`${profile.name} is now active.`);
});

function downloadProfile(profile) {
    try {
        downloadProfileBackup(profile);
        showStatus(`Backup download started for ${profile.name}.`);
    } catch {
        showStatus(`Could not download the backup for ${profile.name}. Try again.`);
    }
}

list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { profileId } = button.closest('[data-profile-id]').dataset;
    const profile = profileId ? readProfile(profileId) : null;
    if (profileId && !profile) {
        profilesChanged('This profile is no longer available.');
        return;
    }
    switch (button.dataset.action) {
        case 'activate':
            try {
                selectProfile(profile?.id ?? null);
            } catch {
                showStatus('Could not activate the profile. Check browser storage and try again.');
                return;
            }
            profilesChanged(`${profile?.name ?? 'Default'} is now active.`);
            break;
        case 'edit':
            editingId = profile.id;
            editForm.elements.name.value = profile.name;
            editForm.elements.theme.value = profile.theme;
            editForm.elements.displayName.value = profile.details.displayName;
            editForm.elements.age.value = profile.details.age ?? '';
            editForm.elements.role.value = profile.details.role;
            editStatus.textContent = '';
            editProfile.showModal();
            editForm.elements.name.select();
            break;
        case 'reset':
            confirmReset(profile);
            break;
        case 'export':
            downloadProfile(profile ?? defaultProfile());
            break;
        case 'delete':
            editingId = profile.id;
            document.querySelector('#delete-description').textContent =
                `Delete ${profile.name} and its saved answers, results, and customization from this browser?`;
            deleteStatus.textContent = '';
            deletion.showModal();
            break;
    }
});

editForm.addEventListener('submit', event => {
    if (event.submitter?.formMethod === 'dialog') return;
    event.preventDefault();
    const fields = editForm.elements;
    const name = fields.name.value.trim();
    if (!name) {
        editStatus.textContent = 'Enter a profile name.';
        return;
    }
    try {
        updateProfile(editingId, {
            name,
            theme: fields.theme.value,
            details: { displayName: fields.displayName.value, age: fields.age.valueAsNumber, role: fields.role.value },
        });
    } catch {
        editStatus.textContent = 'Could not save the changes. Check that the profile is still available.';
        return;
    }
    editProfile.close();
    profilesChanged(`Changes saved for ${name}.`);
});

document.querySelector('#reset-profile-form').addEventListener('submit', event => {
    if (event.submitter?.formMethod === 'dialog') return;
    event.preventDefault();
    let name = 'Default';
    try {
        if (editingId) {
            name = updateProfile(editingId, { drafts: {}, importedResults: null }).name;
        } else if (!Object.keys(modes).map(clearDraft).every(Boolean)) {
            throw new Error('Could not clear Default progress.');
        }
    } catch {
        resetStatus.textContent = 'Could not fully reset progress. Check browser storage and try again.';
        return;
    }
    resetProfile.close();
    profilesChanged(`Progress reset for ${name}.`);
});

document.querySelector('#delete-form').addEventListener('submit', event => {
    if (event.submitter?.formMethod === 'dialog') return;
    event.preventDefault();
    try {
        removeProfile(editingId);
    } catch {
        deleteStatus.textContent = 'Could not delete the profile. Check that it is still available.';
        return;
    }
    deletion.close();
    profilesChanged('Profile deleted.');
});

importButton.addEventListener('click', () => backupFile.click());
backupFile.addEventListener('change', async () => {
    const file = backupFile.files[0];
    backupFile.value = '';
    if (!file) return;
    if (file.size > 128 * 1024) {
        showStatus('This file is too large to be a quiz profile backup.');
        return;
    }
    let backup;
    try {
        backup = importProfile(await file.text());
    } catch (error) {
        showStatus(error.message || 'Could not read the backup file.');
        return;
    }
    try {
        const imported = createProfile(backup);
        profilesChanged(`Imported ${imported.name}. Select Make active to use it.`);
    } catch {
        showStatus('Could not save the imported profile. Check browser storage and try again.');
    }
});

function openShareImport(link = '') {
    importForm.reset();
    importForm.elements.link.value = link;
    importStatus.textContent = '';
    importDialog.showModal();
    if (link) importForm.elements.name.focus();
}

importLinkButton.addEventListener('click', () => openShareImport());
importDialog.addEventListener('close', () => {
    if (importDialog.open) return;
    importForm.reset();
    if (decodeResults(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
});
importForm.addEventListener('submit', event => {
    if (event.submitter?.formMethod === 'dialog') return;
    event.preventDefault();
    const fields = importForm.elements;
    const importedResults = resultsHashFromLink(fields.link.value);
    if (!importedResults) {
        importStatus.textContent = 'Paste a valid Deviant Bound results link.';
        fields.link.focus();
        return;
    }
    const name = fields.name.value.trim();
    if (!name) {
        importStatus.textContent = 'Enter a profile name.';
        fields.name.focus();
        return;
    }
    let imported;
    try {
        imported = createProfile({ name, theme: savedTheme(), importedResults });
    } catch {
        importStatus.textContent = 'Could not save the imported profile. Check browser storage and try again.';
        return;
    }
    importDialog.close();
    profilesChanged(`Imported results into ${imported.name}. Select Make active to view them.`);
});

document.addEventListener('quizprofilechange', renderProfiles);
window.addEventListener('storage', event => {
    if (isProfileChange(event.key) || isDefaultDraftChange(event.key)) renderProfiles();
});
window.addEventListener('pageshow', event => {
    if (event.persisted) renderProfiles();
});

renderProfiles();
manager.hidden = false;
if (location.hash === '#create-profile') {
    createForm.elements.copyProgress.checked = !copyProgress.hidden;
    createForm.elements.name.focus();
} else if (decodeResults(location.hash) && !importLinkButton.disabled) {
    openShareImport(sharedResultLink(location.hash));
}
