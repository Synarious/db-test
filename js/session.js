import { normalizeDraft, newDraft } from './quiz-state.js';
import { loadProfileDraft, saveProfileDraft } from './profile-store.js';

const ageKey = 'db-quiz.age.v1';
const draftKey = mode => `db-quiz.responses.v1.${mode}`;

function read(key) {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key, value) {
    try {
        if (value === null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function loadAgeSelection() {
    const value = read(ageKey);
    return value === 'yes' || value === 'no' ? value : null;
}

export function saveAgeSelection(value) {
    return write(ageKey, value);
}

export function loadDraft(mode, profileId = null) {
    if (profileId) return loadProfileDraft(profileId, mode);
    try {
        return normalizeDraft(JSON.parse(read(draftKey(mode))), mode);
    } catch {
        return newDraft();
    }
}

export function saveDraft(mode, draft, profileId = null) {
    if (profileId) return saveProfileDraft(profileId, mode, draft);
    return write(draftKey(mode), JSON.stringify(draft));
}

export function clearDraft(mode) {
    return write(draftKey(mode), null);
}
