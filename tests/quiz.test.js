import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modes } from '../js/questions.js';
import { normalizeDraft } from '../js/quiz-state.js';
import { roles } from '../js/roles.js';
import { scoreQuiz } from '../js/scoring.js';
import { loadDraft, saveDraft } from '../js/session.js';
import {
    activeProfile, createProfile, exportProfile, importProfile, listProfiles, removeProfile,
    saveAppearance, savedTheme, selectProfile, updateProfile,
} from '../js/profile-store.js';

const { standard, advanced } = modes;

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

test('guest progress and profile progress stay independent across profile switches', t => {
    for (const name of ['sessionStorage', 'localStorage']) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, name);
        const values = new Map();
        Object.defineProperty(globalThis, name, {
            configurable: true,
            value: {
                get length() { return values.size; },
                key: index => [...values.keys()][index] ?? null,
                getItem: key => values.get(key) ?? null,
                setItem: (key, value) => values.set(key, String(value)),
                removeItem: key => values.delete(key),
            },
        });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, name, previous);
            else delete globalThis[name];
        });
    }

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
    assert.throws(() => importProfile('{"format":"unknown","version":1}'), /quiz profile backup/);
});
