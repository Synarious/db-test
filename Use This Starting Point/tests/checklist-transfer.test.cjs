const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function openChecklist(route = 'index.html', stored = new Map()) {
    const localStorage = {
        getItem: key => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
        removeItem: key => stored.delete(key),
    };
    const context = vm.createContext({
        location: new URL(route, 'https://checklist.test/'), localStorage, navigator: {},
        URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa, crypto: webcrypto,
    });
    for (const script of ['catalog', 'advanced-expansion', 'advanced-catalog', 'image-themes', 'backup-v1', 'answers', 'share-links']) {
        const filename = path.join(__dirname, '../js', script + '.js');
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
    return vm.runInContext('DBList', context);
}

test('every rating survives a backup restore and a shared URL for every question', async () => {
    const app = openChecklist('index.html?mode=advanced&fantasy=1');
    const choices = app.visibleCategories.flatMap(category => category.topics.flatMap(topic => topic.choices));
    for (const [value] of app.ratingOptions.filter(([value]) => value)) {
        for (const choice of choices) await app.saveAnswer(choice.id, value);
        const saved = app.readAnswers();
        assert.equal(Object.keys(saved).length, choices.length);
        const backup = app.parseAnswerBackup(app.createAnswerBackup());
        assert.equal(backup.skipped, 0);
        const stored = new Map();
        await openChecklist('profiles.html', stored).importChecklist(backup);
        const restored = openChecklist('index.html', stored);
        assert.deepEqual(restored.readAnswers(), saved);
        assert.ok(restored.advancedMode && restored.showFantasy);
        const url = new URL(app.createChecklistShareUrl());
        assert.deepEqual(openChecklist(url.href).parseChecklistShareHash(url.hash).answers, saved);
    }
});

test('new share URLs include saved gender and partner preference even after a prior opt-out', async () => {
    for (const sharingPreference of [{}, { shareGender: 'no' }]) {
        const app = openChecklist();
        await app.saveQuestionPreferences({ gender: 'unspecified', partnerGender: 'anyone', ...sharingPreference });

        const url = new URL(app.createChecklistShareUrl());
        const { profile } = openChecklist(url.href).parseChecklistShareHash(url.hash);
        assert.equal(profile.gender, 'unspecified');
        assert.equal(profile.partnerGender, 'anyone');
        assert.equal(profile.shareGender, 'yes');
    }
});

test('themes survive backup and restore while retired details stay out of results and shares', async () => {
    const stored = new Map([['db-list.answers.v1', JSON.stringify({
        questionVersion: 2, answers: {}, profile: { imageTheme: 'plum', kink: 'Old detail', partnerMinAge: 25, partnerMaxAge: 40 },
    })]]);
    const app = openChecklist('index.html', stored);
    assert.equal(app.readChecklist().profile.imageTheme, 'plum');

    for (const imageTheme of ['blood-velvet', 'violet-nocturne', 'rosewater', 'porcelain']) {
        await app.saveProfile({ name: 'Alex', imageTheme });
        const { profile } = app.readChecklist();
        assert.equal(profile.imageTheme, imageTheme);
        assert.equal(profile.kink, 'Old detail');
        assert.deepEqual(Array.from(app.profileLines(profile)), ['Name: Alex']);

        const restored = openChecklist();
        const backup = restored.parseAnswerBackup(app.createAnswerBackup());
        await restored.importChecklist(backup);
        assert.equal(restored.readChecklist().profile.imageTheme, imageTheme);

        const shared = app.parseChecklistShareHash(new URL(app.createChecklistShareUrl()).hash);
        assert.deepEqual(Object.keys(shared.profile), ['name']);
    }
});

test('ambiguous old answers stay unrated and recovery requires consent', async () => {
    const key = 'db-list.answers.v1';
    const stored = new Map([[key, JSON.stringify({ 'shared-cuddling': 'like' })]]);
    const app = openChecklist('profiles.html', stored);
    assert.equal(Object.keys(app.readAnswers()).length, 0);
    const patch = { answers: { 'rating-dominate': 'like' }, profile: {}, skipped: 0 };
    stored.set(key, '{');
    assert.equal(await app.importChecklist(patch, () => false), null);
    assert.equal(stored.get(key), '{');
    await app.importChecklist(patch, () => true);
    assert.equal(app.readAnswers()['rating-dominate'], 'like');
});

test('importing into a new profile preserves the original ratings and settings', async () => {
    const source = openChecklist();
    await source.saveAnswer('rating-dominate', 'favorite');
    await source.saveProfile({ name: 'Results name', imageTheme: 'plum' });

    const stored = new Map([
        ['db-list.checklist-mode', 'advanced'],
        ['db-list.answer.rating-dominate', 'like'],
        ['db-list.answer.rating-submissive', 'maybe'],
    ]);
    const app = openChecklist('profiles.html', stored);
    const original = app.getSavedProfiles().profiles[0];
    const backup = app.parseAnswerBackup(source.createAnswerBackup());
    await app.addSavedProfile('  Imported copy  ', backup);

    const reopened = openChecklist('index.html', stored);
    const { activeId, profiles } = reopened.getSavedProfiles();
    assert.notEqual(activeId, original.id);
    assert.equal(profiles.find(profile => profile.id === activeId).name, 'Imported copy');
    assert.deepEqual(Object.entries(reopened.readAnswers()), [['rating-dominate', 'favorite']]);
    assert.equal(reopened.readChecklist().profile.name, 'Results name');
    assert.equal(reopened.readChecklist().profile.imageTheme, 'plum');

    await reopened.selectSavedProfile(original.id);
    assert.equal(reopened.readAnswers()['rating-dominate'], 'like');
    assert.equal(reopened.readAnswers()['rating-submissive'], 'maybe');
    assert.equal(reopened.readChecklist().profile.mode, 'advanced');
});

test('saved profiles keep their own data and original dates across switches and reloads', async () => {
    const stored = new Map([
        ['db-list.checklist-mode', 'advanced'],
        ['db-list.answer.rating-dominate', 'like'],
    ]);
    const app = openChecklist('profiles.html', stored);
    const original = app.getSavedProfiles().profiles[0];
    assert.equal(original.createdAt, null);

    await app.addSavedProfile('  Private name  ');
    const { activeId, profiles } = app.getSavedProfiles();
    const created = profiles.find(profile => profile.id === activeId);
    assert.equal(created.name, 'Private name');
    assert.ok(Number.isFinite(Date.parse(created.createdAt)));
    assert.equal(Object.keys(app.readAnswers()).length, 0);
    assert.equal(openChecklist('index.html', stored).advancedMode, false);
    await app.saveAnswer('rating-dominate', 'favorite');
    await app.saveProfile({ name: 'Results name', imageTheme: 'plum' });
    await app.renameSavedProfile(activeId, 'Renamed privately');

    await app.selectSavedProfile(original.id);
    assert.equal(app.readAnswers()['rating-dominate'], 'like');
    assert.equal(openChecklist('index.html', stored).advancedMode, true);
    assert.equal(app.readChecklist().profile.name, undefined);
    await app.selectSavedProfile(activeId);

    const reopened = openChecklist('index.html', stored);
    assert.equal(reopened.getSavedProfiles().activeId, activeId);
    const renamed = reopened.getSavedProfiles().profiles.find(profile => profile.id === activeId);
    assert.equal(renamed.name, 'Renamed privately');
    assert.equal(renamed.createdAt, created.createdAt);
    assert.equal(reopened.readAnswers()['rating-dominate'], 'favorite');
    assert.equal(reopened.readChecklist().profile.imageTheme, 'plum');
    assert.equal(reopened.parseAnswerBackup(reopened.createAnswerBackup()).profile.name, 'Results name');
    assert.equal(reopened.parseChecklistShareHash(new URL(reopened.createChecklistShareUrl()).hash).profile.name, 'Results name');
    assert.ok(!reopened.createAnswerBackup().includes(renamed.name));

    const scopedBackup = reopened.parseAnswerBackup(reopened.createAnswerBackup(original.id));
    assert.equal(scopedBackup.answers['rating-dominate'], 'like');
    assert.equal(scopedBackup.profile.mode, 'advanced');
    assert.equal(scopedBackup.profile.name, undefined);
    const scopedUrl = new URL(reopened.createChecklistShareUrl(original.id));
    assert.ok(openChecklist(scopedUrl.href).advancedMode);
    assert.equal(reopened.parseChecklistShareHash(scopedUrl.hash).answers['rating-dominate'], 'like');
    assert.equal(reopened.getSavedProfiles().activeId, activeId);

    await reopened.removeSavedProfile(activeId);
    assert.equal(reopened.getSavedProfiles().activeId, original.id);
    await reopened.removeSavedProfile(original.id);
    assert.equal(reopened.getSavedProfiles().profiles.length, 0);
    assert.equal(Object.keys(reopened.readAnswers()).length, 0);
    await reopened.saveAnswer('rating-dominate', 'like');
    assert.ok(Number.isFinite(Date.parse(reopened.getSavedProfiles().profiles[0].createdAt)));
    await reopened.addSavedProfile('Temporary');
    await reopened.clearAnswers();
    assert.equal(reopened.getSavedProfiles().profiles.length, 0);
    assert.equal(Object.keys(reopened.readAnswers()).length, 0);
});
