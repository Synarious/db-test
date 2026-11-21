import { modes } from './questions.js';
import { newDraft, normalizeDraft } from './quiz-state.js';
import { decodeResults } from './shared-results.js';

export const themes = Object.freeze({
    graphite: 'Graphite',
    'blood-velvet': 'Blood Velvet',
    'violet-nocturne': 'Violet Nocturne',
    rosewater: 'Rosewater',
    porcelain: 'Porcelain',
    plum: 'Plum',
    ocean: 'Ocean',
    forest: 'Forest',
    ember: 'Ember',
});

export const defaultTheme = 'graphite';

const activeKey = 'db-quiz.active-profile.v1';
const profilePrefix = 'db-quiz.profile.v1.';
const themeKey = 'db-quiz.guest-theme.v1';
const backupFormat = 'deviant-bound-quiz-profile';

function normalizeTheme(value) {
    return typeof value === 'string' && Object.hasOwn(themes, value) ? value : defaultTheme;
}

function cleanText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeProfile(value) {
    const age = value.details?.age;
    const importedResults = value.importedResults;
    return {
        name: cleanText(value.name, 80),
        theme: normalizeTheme(value.theme),
        details: {
            displayName: cleanText(value.details?.displayName, 60),
            age: Number.isInteger(age) && age >= 18 && age <= 999 ? age : null,
            role: cleanText(value.details?.role, 60),
        },
        drafts: Object.fromEntries(Object.keys(modes).map(mode => [
            mode, normalizeDraft(value.drafts?.[mode], mode),
        ])),
        ...(decodeResults(importedResults) ? { importedResults } : {}),
    };
}

export function readProfile(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) return null;
    try {
        const value = JSON.parse(localStorage.getItem(profilePrefix + id));
        if (!cleanText(value?.name, 80)) return null;
        return { id, ...normalizeProfile(value) };
    } catch {
        return null;
    }
}

export function activeProfile() {
    try {
        return readProfile(localStorage.getItem(activeKey));
    } catch {
        return null;
    }
}

export function listProfiles() {
    const profiles = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(profilePrefix)) continue;
        const profile = readProfile(key.slice(profilePrefix.length));
        if (profile) profiles.push(profile);
    }
    return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

function writeProfile(id, value) {
    const profile = normalizeProfile(value);
    if (!profile.name) throw new Error('Enter a profile name.');
    localStorage.setItem(profilePrefix + id, JSON.stringify(profile));
    return { id, ...profile };
}

export function createProfile(value) {
    const random = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    return writeProfile(id, value);
}

export function updateProfile(id, changes) {
    const profile = readProfile(id);
    if (!profile) throw new Error('This profile is no longer available.');
    return writeProfile(id, { ...profile, ...changes });
}

export function selectProfile(id) {
    if (id === null) {
        localStorage.removeItem(activeKey);
        return;
    }
    if (!readProfile(id)) throw new Error('This profile is no longer available.');
    localStorage.setItem(activeKey, id);
}

export function removeProfile(id) {
    if (!readProfile(id)) throw new Error('This profile is no longer available.');
    localStorage.removeItem(profilePrefix + id);
}

export function loadProfileDraft(id, mode) {
    return readProfile(id)?.drafts[mode] ?? newDraft();
}

export function saveProfileDraft(id, mode, draft) {
    const profile = readProfile(id);
    if (!profile) return false;
    try {
        profile.drafts[mode] = draft;
        writeProfile(id, profile);
        return true;
    } catch {
        return false;
    }
}

export function savedTheme() {
    try {
        return activeProfile()?.theme ?? normalizeTheme(localStorage.getItem(themeKey));
    } catch {
        return defaultTheme;
    }
}

export function saveAppearance(id, theme, details) {
    if (id) updateProfile(id, { theme, details });
    else localStorage.setItem(themeKey, normalizeTheme(theme));
}

export function isProfileChange(key, id) {
    return key === null || key === activeKey || (id ? key === profilePrefix + id : key.startsWith(profilePrefix));
}

export function isAppearanceChange(key) {
    return key === themeKey || isProfileChange(key, activeProfile()?.id);
}

export function exportProfile(profile) {
    return JSON.stringify({ format: backupFormat, version: 1, profile: normalizeProfile(profile) }, null, 2);
}

export function importProfile(text) {
    let backup;
    try {
        backup = JSON.parse(text);
    } catch {
        throw new Error('This file could not be read as JSON.');
    }
    const profile = backup?.profile;
    if (backup?.format !== backupFormat || backup.version !== 1 || !cleanText(profile?.name, 80)) {
        throw new Error('Choose a Deviant Bound quiz profile backup.');
    }
    for (const mode of Object.keys(modes)) {
        const draft = profile.drafts?.[mode];
        if (!draft?.responses || typeof draft.responses !== 'object' || Array.isArray(draft.responses)) {
            throw new Error('The backup is missing quiz progress data.');
        }
    }
    return normalizeProfile(profile);
}
