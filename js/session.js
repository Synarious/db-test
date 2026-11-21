import { normalizeDraft, newDraft } from './quiz-state.js';
import { loadProfileDraft, saveProfileDraft } from './profile-store.js';

const ageKey = 'db-quiz.age.v1';
const draftPrefix = 'db-quiz.responses.v1.';
const draftKey = mode => draftPrefix + mode;

function read(storage, key) {
    try {
        return globalThis[storage].getItem(key);
    } catch {
        return null;
    }
}

function writeSession(key, value) {
    try {
        if (value === null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function loadAgeSelection() {
    const value = read('sessionStorage', ageKey);
    return value === 'yes' || value === 'no' ? value : null;
}

export function saveAgeSelection(value) {
    return writeSession(ageKey, value);
}

export function loadDraft(mode, profileId = null) {
    if (profileId) return loadProfileDraft(profileId, mode);
    const key = draftKey(mode);
    const saved = read('localStorage', key);
    const legacy = saved === null ? read('sessionStorage', key) : null;
    try {
        const draft = normalizeDraft(JSON.parse(saved ?? legacy), mode);
        if (legacy !== null) saveDraft(mode, draft);
        return draft;
    } catch {
        return newDraft();
    }
}

export function saveDraft(mode, draft, profileId = null) {
    if (profileId) return saveProfileDraft(profileId, mode, draft);
    const key = draftKey(mode);
    const value = JSON.stringify(draft);
    try {
        localStorage.setItem(key, value);
    } catch {
        // A session-only copy can be restored as long as no local copy takes precedence.
        return read('localStorage', key) === null && writeSession(key, value);
    }
    writeSession(key, null);
    return true;
}

export function clearDraft(mode) {
    // Keep an empty local draft so an older session copy cannot restore answers.
    return saveDraft(mode, newDraft());
}

export function isDefaultDraftChange(key) {
    return key === null || key.startsWith(draftPrefix);
}
