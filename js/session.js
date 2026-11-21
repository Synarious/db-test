import { modes } from './questions.js';
import { normalizeDraft, newDraft } from './quiz-state.js';
import { loadProfileDraft, saveProfileDraft, savedTheme } from './profile-store.js';

const ageKey = 'db-quiz.age.v1';
const draftPrefix = 'db-quiz.responses.v1.';
const draftKey = mode => draftPrefix + mode;
let pageAgeSelection = null;

function read(storage, key) {
    try {
        return globalThis[storage].getItem(key);
    } catch {
        return null;
    }
}

function write(storage, key, value) {
    try {
        const store = globalThis[storage];
        if (value === null) store.removeItem(key);
        else store.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function isAgeSelection(value) {
    return value === 'yes' || value === 'no';
}

export function loadAgeSelection() {
    const saved = read('localStorage', ageKey);
    if (isAgeSelection(saved)) return saved;

    const session = read('sessionStorage', ageKey);
    if (!isAgeSelection(session)) return pageAgeSelection;
    saveAgeSelection(session);
    return session;
}

export function saveAgeSelection(value) {
    if (!isAgeSelection(value)) return false;
    if (write('localStorage', ageKey, value)) {
        pageAgeSelection = null;
        write('sessionStorage', ageKey, null);
        return true;
    }

    const saved = write('sessionStorage', ageKey, value);
    pageAgeSelection = saved ? null : value;
    return saved;
}

export function isAgeSelectionChange(key) {
    return key === ageKey;
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
    if (profileId) return saveProfileDraft(profileId, mode, draft) ? 'local' : false;
    const key = draftKey(mode);
    const value = JSON.stringify(draft);
    if (!write('localStorage', key, value)) {
        // A session-only copy can be restored as long as no local copy takes precedence.
        return read('localStorage', key) === null && write('sessionStorage', key, value) ? 'session' : false;
    }
    write('sessionStorage', key, null);
    return 'local';
}

export function defaultProfile() {
    return {
        name: 'Default',
        theme: savedTheme(null),
        drafts: Object.fromEntries(Object.keys(modes).map(mode => [mode, loadDraft(mode)])),
    };
}

export function clearDraft(mode) {
    // Keep an empty local draft so an older session copy cannot restore answers.
    return saveDraft(mode, newDraft());
}

export function isDefaultDraftChange(key) {
    return key === null || key.startsWith(draftPrefix);
}
