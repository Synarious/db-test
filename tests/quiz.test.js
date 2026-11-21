import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modes } from '../js/questions.js';
import { normalizeDraft } from '../js/quiz-state.js';
import { roles } from '../js/roles.js';
import { scoreQuiz } from '../js/scoring.js';
import { decodeResults, encodeResults, resultsHashFromLink } from '../js/shared-results.js';
import { clearDraft, loadAgeSelection, loadDraft, saveAgeSelection, saveDraft } from '../js/session.js';
import {
    activeProfile, createProfile, exportProfile, importProfile, listProfiles, removeProfile,
    saveAppearance, savedTheme, selectProfile, updateProfile,
} from '../js/profile-store.js';

const { standard, advanced } = modes;

function mockStorage(t, name) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    const values = new Map();
    const storage = {
        get length() { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        clear: () => values.clear(),
    };
    Object.defineProperty(globalThis, name, { configurable: true, value: storage });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else delete globalThis[name];
    });
    return storage;
}

test('shared results round-trip scores and unrated categories without answers', () => {
    const scores = scoreQuiz(standard.items, { Q01: 5, Q02: 1, Q03: 3.72 });
    const hash = encodeResults(scores);
    assert.match(hash, /^#results=v1\.[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeResults(hash), scores.map(({ role, description, score }) => ({ role, description, score })));
    assert.equal(decodeResults(hash.slice(0, -1)), null);
    assert.equal(decodeResults('#preview'), null);
});

test('results link imports require a valid score payload', () => {
    const hash = encodeResults(scoreQuiz(standard.items, { Q01: 5 }));
    const base = 'https://bdsmtest.deviantbound.com/results.html';
    assert.equal(resultsHashFromLink(`  ${base}${hash}\n`), hash);
    assert.equal(resultsHashFromLink(hash), hash);
    for (const link of [
        base, `${base}#preview`, `${base}${hash.slice(0, -1)}`, hash.replace('v1.', 'v2.'),
        `data:text/plain,results${hash}`, 'wrong link',
    ]) {
        assert.equal(resultsHashFromLink(link), null, link);
    }
});

test('both modes cover the requested categories with unique, reasoned items', () => {
    assert.equal(Object.keys(roles).length, 29);
    assert.equal(standard.items.length, 30);
    assert.equal(advanced.items.length, 69);
    assert.deepEqual(advanced.items.slice(0, standard.items.length), standard.items);
    assert.equal(new Set(advanced.items.map(item => item.id)).size, 69);
    for (const item of advanced.items) {
        assert.ok(item.text && item.reason);
        assert.ok(Object.values(item.weights).some(weight => Math.abs(weight) >= 2));
        for (const [role, weight] of Object.entries(item.weights)) {
            assert.ok(Object.hasOwn(roles, role));
            assert.ok([1, 2, 3, -2].includes(weight));
        }
    }
    for (const role of Object.keys(roles)) {
        assert.ok(standard.items.some(({ weights }) => weights[role] === 3), role);
        assert.ok(advanced.items.slice(30).some(({ weights }) => Math.abs(weights[role]) === 2), role);
    }
});

test('shares weights correctly, reverses negative weights, and separates skips from neutral', () => {
    const scores = scoreQuiz(advanced.items, { Q01: 5, Q02: 4, Q09: 1, Q31: 3, Q06: 4, Q34: 1, Q35: 3, Q36: null });
    const result = name => scores.find(entry => entry.role === name);
    assert.equal(result('Dominant').score, 67);
    assert.equal(result('Master / Mistress').score, 0);
    assert.equal(result('Submissive').score, 75);
    assert.equal(result('Masochist').score, 85);
    assert.equal(result('Pet Owner').score, 50);
    assert.equal(result('Pet').score, null);
    assert.equal(result('Pet').answered, 0);
    assert.equal(result('Switch').score, null);
    assert.ok(scores.at(-1).score === null);
});

test('requires a valid rating or explicit skip for each item before marking a mode complete', () => {
    const responses = Object.fromEntries(standard.items.map(({ id }) => [id, null]));
    assert.equal(normalizeDraft({ index: 99, responses, completedAt: 100 }, 'standard').completedAt, 100);
    assert.equal(normalizeDraft({ index: 99, responses, completedAt: 100 }, 'advanced').completedAt, null);
    assert.deepEqual(normalizeDraft({
        index: 17, responses: { Q01: 5, Q02: '5', Q31: 4 }, completedAt: 100,
    }, 'standard'), { index: 1, responses: { Q01: 5 }, completedAt: null });
});

test('preserves fractional ratings and uses their exact values for scoring', () => {
    const draft = normalizeDraft({ responses: { Q02: 3.72, Q03: 4.125 } }, 'standard');
    assert.deepEqual(draft.responses, { Q02: 3.72 });
    const result = scoreQuiz(standard.items, draft.responses).find(entry => entry.role === 'Submissive');
    assert.equal(result.answered, 1);
    assert.equal(result.score, 68);
});

test('Default drafts keep ratings, skips, and position across tab sessions', t => {
    const session = mockStorage(t, 'sessionStorage');
    mockStorage(t, 'localStorage');
    const draft = {
        index: 5, responses: { Q01: 4.25, Q02: null, Q03: 2, Q04: null, Q05: null },
        completedAt: null, updatedAt: 100,
    };
    const completed = {
        index: 65, responses: Object.fromEntries(advanced.items.map(({ id }) => [id, 3])),
        completedAt: 200,
    };

    assert.ok(saveAgeSelection('yes'));
    assert.ok(saveDraft('standard', draft));
    assert.ok(saveDraft('advanced', completed));
    session.clear();

    assert.deepEqual(loadDraft('standard'), draft);
    assert.deepEqual(loadDraft('advanced'), completed);
    assert.equal(loadAgeSelection(), null);
});

test('existing session progress migrates and stale tabs cannot restore reset answers', t => {
    const session = mockStorage(t, 'sessionStorage');
    mockStorage(t, 'localStorage');
    const key = 'db-quiz.responses.v1.standard';
    const draft = { index: 0, responses: { Q01: 5 }, completedAt: null };
    session.setItem(key, JSON.stringify(draft));
    assert.deepEqual(loadDraft('standard'), draft);
    assert.equal(session.getItem(key), null);
    assert.deepEqual(loadDraft('standard'), draft);

    assert.ok(clearDraft('standard'));
    session.setItem(key, JSON.stringify(draft));
    assert.deepEqual(loadDraft('standard').responses, {});
});

test('Default still saves in the tab when browser-wide storage is blocked', t => {
    mockStorage(t, 'sessionStorage');
    const local = mockStorage(t, 'localStorage');
    local.setItem = () => { throw new Error('Storage unavailable'); };
    const draft = { index: 0, responses: { Q01: 5 }, completedAt: null };
    assert.ok(saveDraft('standard', draft));
    assert.deepEqual(loadDraft('standard'), draft);
    assert.ok(clearDraft('standard'));
    assert.deepEqual(loadDraft('standard').responses, {});
});

test('guest progress and profile progress stay independent across profile switches', t => {
    mockStorage(t, 'sessionStorage');
    mockStorage(t, 'localStorage');

    const answer = rating => ({ index: 0, responses: { Q01: rating }, completedAt: null });
    assert.ok(saveDraft('standard', answer(5)));
    saveAppearance(null, 'porcelain');
    const first = createProfile({ name: 'First', drafts: { standard: loadDraft('standard') } });
    const second = createProfile({ name: 'Second', theme: 'forest' });
    selectProfile(first.id);
    assert.equal(activeProfile().id, first.id);
    assert.equal(loadDraft('standard', first.id).responses.Q01, 5);
    assert.ok(saveDraft('advanced', answer(1), first.id));
    saveAppearance(first.id, 'ocean', { displayName: 'Nickname', age: 35 });
    updateProfile(first.id, { name: 'Renamed' });
    assert.equal(savedTheme(), 'ocean');
    assert.equal(loadDraft('advanced', first.id).responses.Q01, 1);
    selectProfile(second.id);
    assert.equal(savedTheme(), 'forest');
    assert.deepEqual(loadDraft('standard', second.id).responses, {});
    removeProfile(second.id);
    assert.equal(activeProfile(), null);
    assert.equal(savedTheme(), 'porcelain');
    assert.equal(loadDraft('standard').responses.Q01, 5);
    assert.equal(saveDraft('standard', answer(3), second.id), false);

    const backup = importProfile(exportProfile(listProfiles()[0]));
    assert.equal(backup.name, 'Renamed');
    assert.equal(backup.details.displayName, 'Nickname');
    assert.deepEqual(backup.drafts.advanced, answer(1));
    const reset = updateProfile(first.id, { drafts: {} });
    assert.deepEqual(loadDraft('standard', first.id).responses, {});
    assert.deepEqual(loadDraft('advanced', first.id).responses, {});
    assert.equal(reset.name, backup.name);
    assert.equal(reset.theme, backup.theme);
    assert.deepEqual(reset.details, backup.details);
    assert.equal(loadDraft('standard').responses.Q01, 5);
    assert.throws(() => importProfile('{"format":"unknown","version":1}'), /quiz profile backup/);
});

test('imported scores survive profile edits, quiz progress, and backups as a separate report', t => {
    mockStorage(t, 'localStorage');
    const current = createProfile({ name: 'Current' });
    selectProfile(current.id);
    const importedResults = encodeResults(scoreQuiz(standard.items, { Q01: 5 }));
    const imported = createProfile({ name: 'Import', importedResults });

    assert.equal(activeProfile().id, current.id);
    assert.deepEqual(imported.drafts.standard.responses, {});
    assert.equal(imported.drafts.standard.completedAt, null);
    assert.equal(imported.drafts.advanced.completedAt, null);
    selectProfile(imported.id);
    updateProfile(imported.id, { name: 'Renamed' });
    assert.ok(saveDraft('standard', { responses: { Q01: 3.72 } }, imported.id));

    const backup = importProfile(exportProfile(activeProfile()));
    assert.equal(backup.importedResults, importedResults);
    assert.deepEqual(backup.drafts.standard.responses, { Q01: 3.72 });
    assert.equal(updateProfile(imported.id, { drafts: {}, importedResults: null }).importedResults, undefined);
    assert.equal(createProfile({ name: 'Invalid', importedResults: '#preview' }).importedResults, undefined);
});
