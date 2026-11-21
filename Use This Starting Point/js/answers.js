(function () {
    'use strict';

    const { categories, visibleCategories } = DBList;

    const ratings = [
        ['favorite', 'Favorite'],
        ['like', 'Like'],
        ['willing-to-try', 'Willing to try'],
        ['maybe', 'Let’s talk about it'],
        ['not-interested', 'I’d rather skip this'],
        ['limit', 'Off the table'],
    ];
    const ratingOptions = [...ratings, ['', 'Left blank']];
    const labels = Object.fromEntries(ratingOptions);

    function ratingLabel(value, group) {
        return value === 'limit' && group === 'partner' ? 'Dealbreaker for me' : labels[value];
    }

    const answersKey = DBListThemes.storageKey;
    const defaultProfileId = 'original';
    const profileNameLimit = 80;
    const backupFormat = 'deviant-bound-checklist';
    const backupVersion = 2;
    const perAnswerKey = id => 'db-list.answer.' + id;
    const legacyKey = (id, rating) => 'r_' + id + '-' + rating;

    const choices = categories.flatMap(({ group, topics }) => topics.flatMap(({ choices }) =>
        choices.map(choice => ({ ...choice, group }))));
    const choiceMeanings = new Map(choices.map(({ id, group, prompt }) =>
        [id, { group, prompt }]));
    const revisedIds = new Set(choices.filter(choice => choice.legacyPrompt && choice.legacyPrompt !== choice.prompt).map(choice => choice.id));
    const choiceIds = new Set(choiceMeanings.keys());
    const visibleChoices = visibleCategories.flatMap(({ topics }) => topics.flatMap(({ choices }) => choices));
    if (choiceIds.size !== choices.length) throw new Error('Duplicate rating IDs in the checklist catalog.');
    const detailFields = ['name', 'role', 'age', 'imageTheme'];
    const legacyDetailFields = ['kink', 'partnerMinAge', 'partnerMaxAge'];
    const genderLabels = { female: 'Female', male: 'Male', another: 'Another gender' };
    const partnerLabels = { female: 'Female partners', male: 'Male partners', anyone: 'Anyone' };
    const questionPreferenceOptions = {
        gender: ['unspecified', ...Object.keys(genderLabels)],
        partnerGender: Object.keys(partnerLabels),
        shareGender: ['yes', 'no'],
        mode: ['standard', 'advanced'],
        fantasy: ['0', '1'],
    };
    const questionPreferenceFields = Object.keys(questionPreferenceOptions);
    const profileFields = [...detailFields, ...legacyDetailFields, ...questionPreferenceFields];
    // These are the published v1 rating meanings. Keep them when relabeling a rating.
    const v1Labels = {
        favorite: 'Favorite', like: 'Like', maybe: 'Open to discussing',
        'not-interested': 'I’d rather skip this', limit: 'Off the table',
    };
    // The order matches the original results page's precedence for conflicting legacy answers.
    const legacyRatings = Object.keys(v1Labels).reverse();

    function backupRatingLabel(value, group) {
        // Backups keep the published label even when the displayed wording changes.
        return value === 'maybe' ? v1Labels.maybe : ratingLabel(value, group);
    }
    const mergedChoices = choices.filter(choice => choice.mergedIds);
    const mergedIds = new Set(mergedChoices.flatMap(choice => choice.mergedIds));
    const splitAnswers = new Map(
        ['vanilla', 'cuddling', 'kissing', 'sexting', 'voicesex', 'webcamsex', 'fantasyrp', 'roleplay']
            .map(id => ['shared-' + id, [id + '-r', id + '-g']])
    );
    // The original Giving column used "-r" for these rows, and Receiving used "-g".
    // Only the original radio keys need to be flipped. Newer keys use the current prompts.
    const originalRadioIds = new Map([...splitAnswers.values()].flatMap(([receive, give]) => [
        [receive, give], [give, receive],
    ]));
    const retiredIds = new Set([
        'rating-taller', 'rating-average', 'rating-livingnearby', 'shared-inperson', 'inperson-r', 'inperson-g',
        'paddle-r', 'rating-paddle', 'masculation-r', 'masculation-g', 'gimpfullbody-r', 'gimpfullbody-g',
        'analtoys', 'analtoys-r', 'analtoys-g', 'buttplug-r', 'buttplug-g',
        'adv-detail-barebacking-self', 'adv-detail-barebacking-partner',
        'adv-detail-excessive-precum', 'adv-detail-excessive-semen', 'adv-detail-sloppy-seconds', 'adv-detail-thick-sticky-cum',
    ]);
    const oldIds = new Set([
        ...mergedIds, ...splitAnswers.keys(), ...retiredIds,
        ...choices.flatMap(choice => [choice.id, ...(choice.previousIds ?? [])]),
    ]);

    function isKnownChoice(id) {
        return choiceIds.has(id) || mergedIds.has(id) || splitAnswers.has(id) || retiredIds.has(id);
    }

    function isRating(value) {
        return typeof value === 'string' && Object.hasOwn(labels, value);
    }

    function isRecord(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function readOldAnswer(storage, id, previousIds) {
        const saved = storage.getItem(perAnswerKey(id));
        if (saved !== null) return isRating(saved) ? saved : '';

        if (previousIds) {
            const [first, second] = previousIds.map(previous => readOldAnswer(storage, previous));
            return first === second ? first : '';
        }

        const radioId = originalRadioIds.get(id) ?? id;
        for (const rating of legacyRatings) {
            const legacy = storage.getItem(legacyKey(radioId, rating));
            try {
                if (JSON.parse(legacy)?.checked === true) return rating;
            } catch {
                // Ignore malformed legacy entries and check the next rating.
            }
        }
        return '';
    }

    function readOldAnswers(storage) {
        const answers = Object.create(null);
        for (const { id, previousIds } of choices) {
            if (revisedIds.has(id) || ['rating-lightimpact', 'rating-heavyimpact'].includes(id)) continue;
            const value = readOldAnswer(storage, id, previousIds);
            if (value) answers[id] = value;
        }
        for (const id of [...mergedIds, ...splitAnswers.keys()]) {
            const value = readOldAnswer(storage, id);
            if (value) answers[id] = value;
        }
        return migrateAnswers(answers);
    }

    function migrateAnswers(answers) {
        for (const { id, mergedIds } of mergedChoices) {
            const ratings = new Set(mergedIds.map(oldId => answers[oldId]).filter(Boolean));
            if (!answers[id] && ratings.size === 1) [answers[id]] = ratings;
            for (const oldId of mergedIds) delete answers[oldId];
        }
        for (const oldId of splitAnswers.keys()) {
            if (!answers[oldId]) continue;
            // A shared answer does not establish either directional preference.
            delete answers[oldId];
        }
        for (const id of retiredIds) delete answers[id];
        return answers;
    }

    function cleanProfile(data) {
        if (!isRecord(data)) throw new Error('Profile details must be an object.');
        const profile = {};
        if (typeof data.imageTheme === 'string' && Object.hasOwn(DBListThemes.options, data.imageTheme)) {
            profile.imageTheme = data.imageTheme;
        }
        for (const [key, options] of Object.entries(questionPreferenceOptions)) {
            if (options.includes(data[key])) profile[key] = data[key];
        }
        for (const key of ['name', 'role', 'kink']) {
            const value = data[key];
            if (value === undefined || value === '') continue;
            if (typeof value !== 'string' || value.length > 60 || /[\r\n]/.test(value)) {
                throw new Error('Profile text must fit on one line and be 60 characters or fewer.');
            }
            if (value.trim()) profile[key] = value.trim();
        }
        for (const key of ['age', 'partnerMinAge', 'partnerMaxAge']) {
            const value = data[key];
            if (value === undefined) continue;
            if (!Number.isSafeInteger(value) || value < 18) throw new Error('Enter ages as whole numbers of 18 or older.');
            profile[key] = value;
        }
        if (profile.partnerMinAge > profile.partnerMaxAge) {
            throw new Error('The minimum partner age must be at or below the maximum.');
        }
        return profile;
    }

    function readProfilePatch(data, duplicateKeys) {
        const profile = {};
        let skipped = 0;
        if (!isRecord(data)) return { profile, skipped: data === undefined ? 0 : 1 };
        for (const [key, value] of Object.entries(data)) {
            if (duplicateKeys?.has(key) || !profileFields.includes(key)) {
                skipped++;
                continue;
            }
            try {
                const field = cleanProfile({ [key]: value });
                if (Object.hasOwn(field, key)) profile[key] = field[key];
                else skipped++;
            } catch {
                skipped++;
            }
        }
        if (profile.partnerMinAge > profile.partnerMaxAge) {
            delete profile.partnerMinAge;
            delete profile.partnerMaxAge;
            skipped += 2;
        }
        return { profile, skipped };
    }

    function profileLines({ name, role, age, gender, partnerGender, shareGender }) {
        return [
            name && 'Name: ' + name,
            role && 'BDSM role: ' + role,
            shareGender === 'yes' && genderLabels[gender] && 'Gender: ' + genderLabels[gender],
            shareGender === 'yes' && partnerLabels[partnerGender] && 'Interested in: ' + partnerLabels[partnerGender],
            age && 'Age: ' + age,
        ].filter(Boolean);
    }

    function questionContext({ gender = 'unspecified', partnerGender = 'anyone' } = {}) {
        const defaults = { male: 'penis', female: 'vulva' };
        return {
            selfGender: gender,
            partnerGender,
            selfAnatomy: partnerGender === 'anyone' ? 'all' : defaults[gender] ?? 'all',
            partnerAnatomy: defaults[partnerGender] ?? 'all',
        };
    }

    function isChoiceApplicable({ requirements }, context) {
        if (!requirements) return true;
        const { exclude = {}, ...required } = requirements;
        return Object.entries(exclude).every(([field, value]) => context[field] !== value) &&
            Object.entries(required).every(([field, value]) =>
                context[field] === value || context[field] === 'all' || context[field] === 'anyone');
    }

    function checklistProgress(answers, context = questionContext()) {
        const choices = visibleChoices.filter(choice => isChoiceApplicable(choice, context));
        return { total: choices.length, rated: choices.filter(({ id }) => answers[id]).length };
    }

    function readChecklist(storage = localStorage, saved = storage.getItem(answersKey)) {
        if (saved === null) return { answers: readOldAnswers(storage), profile: {} };
        return cleanSavedChecklist(JSON.parse(saved));
    }

    function cleanSavedChecklist(data) {
        if (!isRecord(data)) throw new Error('Invalid saved answers.');
        const wrapped = Object.hasOwn(data, 'answers');
        const savedAnswers = wrapped ? data.answers : data;
        if (!isRecord(savedAnswers)) throw new Error('Invalid saved answers.');
        const answers = Object.create(null);
        for (const [id, value] of Object.entries(savedAnswers)) {
            if (data.questionVersion !== 2 && revisedIds.has(id)) continue;
            if (!wrapped && ['rating-lightimpact', 'rating-heavyimpact'].includes(id)) continue;
            if (value && isKnownChoice(id) && isRating(value)) answers[id] = value;
        }
        const profile = wrapped ? readProfilePatch(data.profile).profile : {};
        return { answers: migrateAnswers(answers), profile };
    }

    function defaultProfile(id, createdAt) {
        return { id, name: 'My Profile', createdAt };
    }

    function readProfileState(saved) {
        try {
            const data = JSON.parse(saved);
            if (Array.isArray(data?.savedProfiles)) {
                return { activeId: data.activeProfileId, profiles: data.savedProfiles };
            }
        } catch {
            // The existing backup recovery flow can replace an unreadable checklist.
        }
        const legacyMode = localStorage.getItem(DBList.checklistModeKey);
        const hasLegacyData = saved !== null || legacyMode !== null ||
            Object.keys(readOldAnswers(localStorage)).length > 0;
        return { activeId: defaultProfileId, profiles: hasLegacyData ? [defaultProfile(defaultProfileId, null)] : [], legacyMode };
    }

    function getSavedProfiles() {
        const saved = localStorage.getItem(answersKey);
        const state = readProfileState(saved);
        const profiles = state.profiles.map(profile => {
            const { id, name, createdAt } = profile;
            let answerCount = null;
            try {
                const { answers } = readProfileChecklist(saved, state, profile);
                answerCount = Object.keys(answers).length;
            } catch {
                // Keep the profile listed if its checklist is unreadable.
            }
            return { id, name, createdAt, answerCount };
        });
        return { activeId: state.activeId, profiles };
    }

    function readSavedChecklist(id) {
        const saved = localStorage.getItem(answersKey);
        const state = readProfileState(saved);
        const selected = state.profiles.find(profile => profile.id === id);
        if (!selected) throw new Error('This profile is no longer available.');
        return readProfileChecklist(saved, state, selected);
    }

    function readProfileChecklist(saved, { activeId, legacyMode }, profile) {
        if (profile.id !== activeId) return cleanSavedChecklist({ ...profile.checklist, questionVersion: 2 });

        const checklist = readChecklist(localStorage, saved);
        if (legacyMode === 'advanced') checklist.profile.mode ??= legacyMode;
        return checklist;
    }

    function activeProfileId(saved = localStorage.getItem(answersKey)) {
        try {
            return JSON.parse(saved)?.activeProfileId ?? defaultProfileId;
        } catch {
            return defaultProfileId;
        }
    }

    function writeProfileState(checklist, { activeId, profiles }) {
        // Keep the active checklist in its existing format for view and theme initialization.
        localStorage.setItem(answersKey, JSON.stringify({
            ...checklist, questionVersion: 2, activeProfileId: activeId, savedProfiles: profiles,
        }));
    }

    function writeChecklist(checklist, saved) {
        const state = readProfileState(saved);
        if (!state.profiles.length) state.profiles.push(defaultProfile(state.activeId, new Date().toISOString()));
        if (state.legacyMode === 'advanced') checklist.profile.mode ??= state.legacyMode;
        writeProfileState(checklist, state);
        if (saved === null) removeOldAnswers(localStorage);
    }

    function editSavedProfiles(edit) {
        return updateAnswers(() => {
            const saved = localStorage.getItem(answersKey);
            const state = readProfileState(saved);
            const checklist = readChecklist(localStorage, saved);
            if (state.legacyMode === 'advanced') checklist.profile.mode ??= state.legacyMode;
            writeProfileState(edit(state, checklist), state);
            if (saved === null) removeOldAnswers(localStorage);
            DBListThemes.sync();
        });
    }

    function profileName(value) {
        const name = value.trim();
        if (!name || name.length > profileNameLimit) throw new Error('Enter a profile name of up to 80 characters.');
        return name;
    }

    function newProfileId() {
        return Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
    }

    function useSavedProfile(state, profile) {
        const checklist = profile?.checklist ?? { answers: {}, profile: {} };
        if (profile) delete profile.checklist;
        state.activeId = profile?.id ?? newProfileId();
        return checklist;
    }

    function addSavedProfile(name, { answers = {}, profile = {} } = {}) {
        name = profileName(name);
        return editSavedProfiles((state, checklist) => {
            const active = state.profiles.find(profile => profile.id === state.activeId);
            if (active) active.checklist = checklist;
            const created = { id: newProfileId(), name, createdAt: new Date().toISOString() };
            state.profiles.push(created);
            state.activeId = created.id;
            return { answers, profile };
        });
    }

    function selectSavedProfile(id) {
        return editSavedProfiles((state, checklist) => {
            if (state.activeId === id) return checklist;
            const selected = state.profiles.find(profile => profile.id === id);
            if (!selected) throw new Error('This profile is no longer available.');
            state.profiles.find(profile => profile.id === state.activeId).checklist = checklist;
            return useSavedProfile(state, selected);
        });
    }

    function renameSavedProfile(id, name) {
        name = profileName(name);
        return editSavedProfiles((state, checklist) => {
            const selected = state.profiles.find(profile => profile.id === id);
            if (!selected) throw new Error('This profile is no longer available.');
            selected.name = name;
            return checklist;
        });
    }

    function removeSavedProfile(id) {
        return editSavedProfiles((state, checklist) => {
            state.profiles = state.profiles.filter(profile => profile.id !== id);
            return state.activeId === id ? useSavedProfile(state, state.profiles[0]) : checklist;
        });
    }

    function readAnswers() {
        return readChecklist().answers;
    }

    function removeOldAnswers(storage) {
        for (const id of oldIds) {
            storage.removeItem(perAnswerKey(id));
            for (const rating of legacyRatings) storage.removeItem(legacyKey(id, rating));
        }
    }

    async function updateAnswers(update) {
        // Keep the read and write together when multiple tabs edit the checklist.
        if (navigator.locks) return navigator.locks.request(answersKey, update);
        return update();
    }

    function editChecklist(edit) {
        const expectedProfile = activeProfileId();
        return updateAnswers(() => {
            const storage = localStorage;
            const saved = storage.getItem(answersKey);
            if (activeProfileId(saved) !== expectedProfile) throw new Error('The active profile changed.');
            const checklist = readChecklist(storage, saved);
            edit(checklist);
            writeChecklist(checklist, saved);
        });
    }

    function saveAnswer(id, value) {
        return editChecklist(({ answers }) => {
            if (!choiceIds.has(id) || !isRating(value)) throw new Error('Invalid rating.');
            if (value) answers[id] = value;
            else delete answers[id];
        });
    }

    function saveProfileFields(profile, fields) {
        const cleaned = cleanProfile(profile);
        return editChecklist(checklist => {
            for (const key of fields) {
                if (Object.hasOwn(cleaned, key)) checklist.profile[key] = cleaned[key];
                else delete checklist.profile[key];
            }
        });
    }

    function saveProfile(profile) {
        return saveProfileFields(profile, detailFields).then(DBListThemes.sync);
    }

    function saveQuestionPreference(key, value) {
        if (!questionPreferenceFields.includes(key)) throw new Error('Invalid question preference.');
        return saveProfileFields({ [key]: value }, [key]);
    }

    function saveQuestionPreferences(preferences) {
        return saveProfileFields(preferences, Object.keys(preferences).filter(key => questionPreferenceFields.includes(key)));
    }

    function importChecklist(patch, confirmRecovery, expectedProfile = activeProfileId()) {
        return updateAnswers(() => {
            const storage = localStorage;
            const saved = storage.getItem(answersKey);
            if (activeProfileId(saved) !== expectedProfile) throw new Error('The active profile changed.');
            let checklist;
            try {
                checklist = readChecklist(storage, saved);
            } catch (error) {
                if (saved === null || !confirmRecovery) throw error;
                if (!confirmRecovery()) return null;
                checklist = { answers: Object.create(null), profile: {} };
            }
            const report = { added: 0, matching: 0, conflicts: 0, skipped: patch.skipped };

            function fill(target, key, value) {
                if (!Object.hasOwn(target, key)) {
                    target[key] = value;
                    report.added++;
                } else if (target[key] === value) report.matching++;
                else report.conflicts++;
            }

            for (const [id, value] of Object.entries(patch.answers)) fill(checklist.answers, id, value);
            const min = checklist.profile.partnerMinAge ?? patch.profile.partnerMinAge;
            const max = checklist.profile.partnerMaxAge ?? patch.profile.partnerMaxAge;
            const wouldExposeLocalPreference = ['gender', 'partnerGender'].some(key =>
                Object.hasOwn(checklist.profile, key) && checklist.profile[key] !== patch.profile[key]);
            for (const [key, value] of Object.entries(patch.profile)) {
                if (key === 'shareGender' && value === 'yes' && checklist.profile.shareGender !== 'yes' &&
                    wouldExposeLocalPreference) report.conflicts++;
                else if ((key === 'partnerMinAge' || key === 'partnerMaxAge') &&
                    !Object.hasOwn(checklist.profile, key) && min > max) report.conflicts++;
                else fill(checklist.profile, key, value);
            }
            if (report.added) {
                writeChecklist(checklist, saved);
                DBListThemes.sync();
            }
            return report;
        });
    }

    function clearAnswers() {
        return updateAnswers(() => {
            const storage = localStorage;
            removeOldAnswers(storage);
            storage.removeItem(answersKey);
            storage.removeItem(DBList.checklistModeKey);
            DBListThemes.sync();
        });
    }

    function createAnswerBackup(profileId) {
        const { answers, profile } = profileId === undefined ? readChecklist() : readSavedChecklist(profileId);
        if (profileId === undefined && DBList.advancedMode) profile.mode ??= 'advanced';
        if (profileId === undefined && DBList.showFantasy) profile.fantasy ??= '1';
        includeRatedSections(answers, profile);
        profile.mode ??= 'standard';
        profile.fantasy ??= '0';
        const entries = Object.entries(answers).map(([id, value]) => {
            const { group, prompt } = choiceMeanings.get(id);
            return { id, value, group, prompt, label: backupRatingLabel(value, group) };
        });
        return JSON.stringify({ format: backupFormat, version: backupVersion, profile, answers: entries }, null, 2) + '\n';
    }

    // Track duplicate members at their JSON paths after JSON.parse has validated the syntax.
    function findDuplicateMembers(text, root) {
        const duplicates = new WeakMap();
        const stack = [];
        const tokens = /("(?:[^"\\]|\\.)*")\s*(:)?|[{}\[\]]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
        for (const [token, key, colon] of text.matchAll(tokens)) {
            const parent = stack.at(-1);
            if (colon) {
                const name = JSON.parse(key);
                if (parent.seen.has(name) && isRecord(parent.value)) {
                    if (!duplicates.has(parent.value)) duplicates.set(parent.value, new Set());
                    duplicates.get(parent.value).add(name);
                }
                parent.seen.add(name);
                parent.key = name;
            } else if (token === '}' || token === ']') {
                stack.pop();
            } else {
                const value = parent && parent.value && Object.hasOwn(parent.value, parent.key)
                    ? parent.value[parent.key] : parent ? undefined : root;
                if (Array.isArray(parent?.value)) parent.key++;
                if (token === '{' || token === '[') {
                    stack.push({ value, key: 0, seen: new Set() });
                }
            }
        }
        return duplicates;
    }

    function parseAnswerBackup(text) {
        let backup;
        try {
            backup = JSON.parse(text);
        } catch {
            throw new Error('This file could not be read as JSON. Choose a MyList backup.');
        }
        if (backup?.format !== backupFormat) throw new Error('Choose a JSON backup exported from MyList.');
        const legacy = backup.version === 1;
        if (!Number.isSafeInteger(backup.version) || backup.version < 1 ||
            !(legacy ? isRecord(backup.answers) : Array.isArray(backup.answers))) {
            throw new Error('This backup uses an unsupported format or is missing its answers.');
        }

        const duplicateMembers = findDuplicateMembers(text, backup);
        const duplicateEnvelope = duplicateMembers.get(backup);
        if (duplicateEnvelope?.has('format') || duplicateEnvelope?.has('version') || duplicateEnvelope?.has('answers')) {
            throw new Error('This backup repeats its format, version, or answer list.');
        }
        const { profile, skipped: invalidProfile } = duplicateEnvelope?.has('profile')
            ? { profile: {}, skipped: 1 }
            : readProfilePatch(backup.profile, duplicateMembers.get(backup.profile));
        const answers = Object.create(null);
        const seen = new Set();
        const duplicates = new Set(duplicateMembers.get(backup.answers));
        let skipped = invalidProfile;

        const entries = legacy ? Object.entries(backup.answers).map(([id, value]) => {
            const [group, prompt] = Object.hasOwn(DBList.backupV1Choices, id) ? DBList.backupV1Choices[id] : [];
            const label = value === 'limit' && group === 'partner' ? 'Dealbreaker for me' :
                typeof value === 'string' ? v1Labels[value] : undefined;
            return { id, value, group, prompt, label };
        }) : backup.answers;

        for (const entry of entries) {
            if (typeof entry?.id !== 'string') continue;
            if (seen.has(entry.id)) duplicates.add(entry.id);
            seen.add(entry.id);
        }
        for (const entry of entries) {
            const { id, value, group, prompt, label } = isRecord(entry) ? entry : {};
            const current = choiceMeanings.get(id);
            if (duplicateMembers.has(entry) || duplicates.has(id) || !current || current.group !== group ||
                prompt !== current.prompt ||
                !value || !isRating(value) || label !== backupRatingLabel(value, group)) {
                skipped++;
                continue;
            }
            answers[id] = value;
        }
        includeRatedSections(answers, profile);
        return { answers, profile, skipped };
    }

    function includeRatedSections(answers, profile) {
        // Older backups did not record the view needed to see these ratings.
        for (const category of categories) {
            for (const topic of category.topics) {
                if (!topic.choices.some(choice => answers[choice.id])) continue;
                if (category.advanced) profile.mode ??= 'advanced';
                if (topic.fantasy) profile.fantasy ??= '1';
            }
        }
    }

    function isAnswerStorageEvent(event) {
        const { key, storageArea } = event;
        if (key === answersKey || key === null) return storageArea === localStorage;
        return (key.startsWith('db-list.answer.') || key.startsWith('r_')) &&
            storageArea === localStorage && localStorage.getItem(answersKey) === null;
    }

    function isProfileSelectionEvent(event) {
        return event.storageArea === localStorage && (event.key === null ||
            (event.key === answersKey && activeProfileId(event.oldValue) !== activeProfileId(event.newValue)));
    }

    Object.assign(DBList, {
        ratingOptions, ratingLabel, readAnswers, readChecklist, checklistProgress, saveAnswer, clearAnswers,
        cleanProfile, readProfilePatch, saveProfile, profileLines, importChecklist, questionContext, isChoiceApplicable,
        saveQuestionPreference, saveQuestionPreferences, questionPreferenceFields,
        createAnswerBackup, parseAnswerBackup, includeRatedSections, isAnswerStorageEvent,
        getSavedProfiles, readSavedChecklist, addSavedProfile, selectSavedProfile, renameSavedProfile, removeSavedProfile,
        activeProfileId, isProfileSelectionEvent,
    });
})();
