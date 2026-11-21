import { modes } from './questions.js';
import { isRating } from './quiz-state.js';
import { loadDraft } from './session.js';
import {
    activeProfile, createProfile, exportProfile, importProfile, isProfileChange, listProfiles,
    readProfile, removeProfile, savedTheme, selectProfile, themes, updateProfile,
} from './profile-store.js';

const manager = document.querySelector('#profile-manager');
const list = document.querySelector('#profile-list');
const template = document.querySelector('#profile-card');
const createForm = document.querySelector('#create-form');
const copyProgress = document.querySelector('#copy-progress-option');
const importButton = document.querySelector('#import-profile');
const backupFile = document.querySelector('#backup-file');
const status = document.querySelector('#profile-status');
const noProfiles = document.querySelector('#no-profiles');
const useGuest = document.querySelector('#use-guest');
const rename = document.querySelector('#rename-dialog');
const renameForm = document.querySelector('#rename-form');
const renameStatus = document.querySelector('#rename-status');
const deletion = document.querySelector('#delete-dialog');
const deleteStatus = document.querySelector('#delete-status');
let editingId = null;

function guestDrafts() {
    return Object.fromEntries(Object.keys(modes).map(mode => [mode, loadDraft(mode)]));
}

function showStatus(message, focus = false) {
    status.textContent = message;
    if (focus) status.focus();
}

function profileCard(profile, selected) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.profileId = profile.id;
    card.classList.toggle('is-active', selected);
    card.querySelector('h3').textContent = profile.name;
    card.querySelector('.profile-badge').hidden = !selected;
    card.querySelector('.profile-theme').textContent = themes[profile.theme];
    card.querySelector('[data-action="activate"]').hidden = selected;
    for (const button of card.querySelectorAll('[data-action]')) {
        button.setAttribute('aria-label', `${button.textContent} ${profile.name}`);
    }

    const progress = card.querySelector('.profile-progress');
    for (const [mode, settings] of Object.entries(modes)) {
        const draft = profile.drafts[mode];
        const ratings = Object.values(draft.responses);
        const rated = ratings.filter(isRating).length;
        const row = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = `${settings.label} quiz`;
        const summary = document.createElement('dd');
        summary.textContent = draft.completedAt ? 'Complete' : `${rated} / ${settings.items.length} rated`;
        if (selected && ratings.length) {
            const link = document.createElement('a');
            link.href = `${draft.completedAt ? 'results' : 'quiz'}.html?mode=${mode}`;
            link.textContent = draft.completedAt ? 'View results' : 'Resume';
            link.setAttribute('aria-label', `${link.textContent} for the ${settings.label.toLowerCase()} quiz`);
            summary.append(link);
        }
        row.append(label, summary);
        progress.append(row);
    }
    return card;
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

    document.querySelector('#current-profile-label').textContent = active ? 'Active profile' : 'Current session';
    document.querySelector('#current-profile-heading').textContent = active?.name ?? 'Guest';
    document.querySelector('#current-profile-description').textContent = active
        ? `Quiz progress is saved in this browser. ${themes[active.theme]} theme.`
        : 'Guest quiz progress stays in this tab.';
    useGuest.hidden = !active;
    noProfiles.hidden = profiles.length > 0;
    noProfiles.textContent = available ? 'Your saved profiles will appear here.' : 'Browser storage is unavailable.';
    list.hidden = profiles.length === 0;
    list.replaceChildren(...profiles.map(profile => profileCard(profile, profile.id === active?.id)));
    copyProgress.hidden = !Object.values(guestDrafts()).some(draft => Object.keys(draft.responses).length);
    createForm.querySelector('button[type="submit"]').disabled = !available;
    importButton.disabled = !available;
}

function profilesChanged(message) {
    document.dispatchEvent(new Event('quizprofilechange'));
    showStatus(message, true);
}

useGuest.addEventListener('click', () => {
    try {
        selectProfile(null);
    } catch {
        showStatus('Could not switch to guest. Check browser storage and try again.');
        return;
    }
    profilesChanged('Switched to guest.');
});

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
        profile = createProfile({ name, theme: savedTheme(), drafts: copy ? guestDrafts() : undefined });
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
    const file = new Blob([exportProfile(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deviant-bound-quiz-profile.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus(`Backup downloaded for ${profile.name}.`);
}

list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const profile = readProfile(button.closest('[data-profile-id]').dataset.profileId);
    if (!profile) {
        profilesChanged('This profile is no longer available.');
        return;
    }
    switch (button.dataset.action) {
        case 'activate':
            try {
                selectProfile(profile.id);
            } catch {
                showStatus('Could not activate the profile. Check browser storage and try again.');
                return;
            }
            profilesChanged(`${profile.name} is now active.`);
            break;
        case 'rename':
            editingId = profile.id;
            renameForm.elements.name.value = profile.name;
            renameStatus.textContent = '';
            rename.showModal();
            break;
        case 'export':
            downloadProfile(profile);
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

renameForm.addEventListener('submit', event => {
    if (event.submitter?.formMethod === 'dialog') return;
    event.preventDefault();
    const name = renameForm.elements.name.value.trim();
    if (!name) {
        renameStatus.textContent = 'Enter a profile name.';
        return;
    }
    try {
        updateProfile(editingId, { name });
    } catch {
        renameStatus.textContent = 'Could not rename the profile. Check that it is still available.';
        return;
    }
    rename.close();
    profilesChanged(`Profile renamed to ${name}.`);
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

document.addEventListener('quizprofilechange', renderProfiles);
window.addEventListener('storage', event => {
    if (isProfileChange(event.key)) renderProfiles();
});
window.addEventListener('pageshow', event => {
    if (event.persisted) renderProfiles();
});

renderProfiles();
manager.hidden = false;
if (location.hash === '#create-profile') {
    createForm.elements.copyProgress.checked = !copyProgress.hidden;
    createForm.elements.name.focus();
}
