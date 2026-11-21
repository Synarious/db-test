(function () {
    'use strict';

    const {
        mountAdultPage, checklistRatingOptions, createRatingField, saveAnswer,
        checklistProgress, cleanProfile, readChecklist, saveProfile, checklistShareHash,
        isAnswerStorageEvent, questionContext, isChoiceApplicable,
        saveQuestionPreference, saveQuestionPreferences,
        navigationGroups, advancedMode, showFantasy, checklistQuery, fillRatingKey, fantasyLabel,
    } = DBList;

    const app = document.querySelector('#app');
    const questionnaire = document.querySelector('#questionnaire');
    const skipLink = document.querySelector('.skip-link');
    const previousSection = document.querySelector('#previous-section');
    const nextSection = document.querySelector('#next-section');
    const sectionPicker = document.querySelector('#section-picker');
    const pageNumber = document.querySelector('#checklist-page-number');
    const status = document.querySelector('#status');
    const progress = document.querySelector('#checklist-progress');
    const progressLabel = document.querySelector('#checklist-progress-label');
    const reviewButton = document.querySelector('#review-results');
    const reviewDialog = document.querySelector('#review-dialog');
    const reviewCount = document.querySelector('#review-count');
    const continueToResults = document.querySelector('#continue-to-results');
    const openInstructions = document.querySelector('#open-instructions');
    const helpMenu = openInstructions.closest('details');
    const instructions = document.querySelector('#instructions-dialog');
    const customize = document.querySelector('#customize-dialog');
    const customizeForm = document.querySelector('#customize-form');
    const questionPreferencesForm = document.querySelector('#question-preferences-form');
    const modeSelect = questionPreferencesForm.elements.namedItem('mode');
    const startList = document.querySelector('#start-list');
    const setupGatedElements = document.querySelectorAll('[data-after-setup]');
    const questionPreferencesNote = document.querySelector('#question-preferences-note');
    const questionPreferenceDefaults = { gender: 'unspecified', partnerGender: 'anyone' };
    const questionPreferenceFields = Object.keys(questionPreferenceDefaults);
    const questionPreferencesStatus = document.querySelector('#question-preferences-status');
    const showSelectedImageTheme = DBListThemes.mountImageThemes(
        document.querySelector('#image-theme-picker'),
        document.querySelector('#image-theme-preview')
    );
    fillRatingKey(document.querySelector('#checklist-rating-key'), 15, checklistRatingOptions);
    const resultsUrl = 'results.html' + checklistQuery();
    continueToResults.href = resultsUrl + '#finish-missing';
    continueToResults.addEventListener('click', () => reviewDialog.close());
    const fantasyOptions = document.querySelector('#fantasy-options');
    fantasyOptions.querySelector('input[value="' + Number(showFantasy) + '"]').checked = true;
    const customizeStatus = document.querySelector('#customize-status');
    const fields = new Map();
    const tooltip = document.createElement('div');
    tooltip.className = 'checklist-tooltip';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.hidden = true;
    document.body.append(tooltip);
    let tooltipAnchor = null;
    let pages;
    let currentPage;
    let questionProfile;
    let pendingQuestionPreferenceSaves = 0;
    let activeQuestionContext = questionContext();
    let needsSetup;
    let missingRatings;

    reviewButton.addEventListener('click', () => {
        if (missingRatings > 0) {
            reviewCount.textContent = missingRatings + (missingRatings === 1 ? ' unrated option' : ' unrated options');
            reviewDialog.showModal();
        } else {
            location.assign(resultsUrl);
        }
    });

    const sectionList = sectionPicker.querySelector('ul');
    const minimumCardsPerPage = 16;
    const sections = [];
    for (const group of navigationGroups) {
        let links = sectionList;
        if (advancedMode) {
            const item = document.createElement('li');
            const heading = document.createElement('p');
            heading.className = 'section-picker-group';
            heading.textContent = group.title;
            links = document.createElement('ul');
            item.append(heading, links);
            sectionList.append(item);
        }
        for (const category of group.categories) {
            const title = advancedMode ? category.title : group.categories.length > 1
                ? group.title + ': ' + (category.sectionTitle ?? category.title) : group.title;
            const description = category.subtitle ?? (group.categories.length === 1 ? group.description : '');
            const hash = '#section-' + category.id;
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = hash;
            link.textContent = title;
            item.append(link);
            links.append(item);
            sections.push({ category, group, title, description, hash, link });
        }
    }
    sectionPicker.addEventListener('toggle', () => {
        if (!sectionPicker.open) return;
        sectionList.scrollIntoView({ block: 'nearest' });
        const currentLink = sectionList.querySelector('[aria-current]');
        if (!currentLink) return;
        const listBounds = sectionList.getBoundingClientRect();
        const linkBounds = currentLink.getBoundingClientRect();
        if (linkBounds.top < listBounds.top || linkBounds.bottom > listBounds.bottom) {
            sectionList.scrollTop += linkBounds.top - listBounds.top;
        }
    });

    function showTooltip(anchor) {
        tooltipAnchor = anchor;
        tooltip.textContent = anchor.dataset.tooltip;
        tooltip.classList.toggle('topic-tooltip', anchor.classList.contains('topic-help'));
        tooltip.hidden = false;

        const bounds = anchor.getBoundingClientRect();
        const { offsetWidth, offsetHeight } = tooltip;
        const left = bounds.left + (bounds.width - offsetWidth) / 2;
        tooltip.style.left = Math.max(8, Math.min(left, document.documentElement.clientWidth - offsetWidth - 8)) + 'px';
        const top = bounds.top >= offsetHeight + 8 ? bounds.top - offsetHeight : bounds.bottom;
        tooltip.style.top = Math.max(8, Math.min(top, window.innerHeight - offsetHeight - 8)) + 'px';
    }

    function hideTooltip() {
        tooltipAnchor = null;
        tooltip.hidden = true;
    }

    questionnaire.addEventListener('pointerover', event => {
        const anchor = event.target.closest('[data-tooltip]');
        if (event.pointerType !== 'touch' && anchor && anchor !== tooltipAnchor) showTooltip(anchor);
    });
    questionnaire.addEventListener('pointerout', event => {
        if (event.pointerType === 'touch' || !tooltipAnchor?.contains(event.target)) return;
        if (!tooltipAnchor.contains(event.relatedTarget) && event.relatedTarget !== tooltip) hideTooltip();
    });
    tooltip.addEventListener('pointerleave', event => {
        if (!tooltipAnchor?.contains(event.relatedTarget) && !tooltipAnchor?.matches(':focus-visible')) hideTooltip();
    });
    questionnaire.addEventListener('focusin', event => {
        const anchor = event.target.closest('[data-tooltip]');
        if (anchor && event.target.matches(':focus-visible')) showTooltip(anchor);
    });
    questionnaire.addEventListener('focusout', event => {
        if (tooltipAnchor?.contains(event.target)) hideTooltip();
    });
    questionnaire.addEventListener('pointerup', event => {
        const anchor = event.target.closest('[data-tooltip]');
        if (event.pointerType === 'touch' && anchor) showTooltip(anchor);
    });
    questionnaire.addEventListener('click', event => {
        const help = event.target.closest('.topic-help');
        if (help) showTooltip(help);
    });
    document.addEventListener('pointerdown', event => {
        if (!tooltipAnchor?.contains(event.target) && event.target !== tooltip) hideTooltip();
        if (!sectionPicker.contains(event.target)) sectionPicker.open = false;
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        hideTooltip();
        if (sectionPicker.open) {
            sectionPicker.open = false;
            sectionPicker.querySelector('summary').focus();
        }
    });
    sectionList.addEventListener('click', event => {
        if (!event.target.closest('a') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        sectionPicker.open = false;
        pageNumber.focus({ preventScroll: true });
    });
    window.addEventListener('scroll', hideTooltip);
    window.addEventListener('resize', hideTooltip);

    function setSetupRequired(required) {
        needsSetup = required;
        for (const element of setupGatedElements) element.inert = required;
        startList.hidden = !required;
        startList.disabled = required && !questionPreferencesForm.checkValidity();
        questionPreferencesNote.hidden = !required;
        skipLink.href = required ? '#question-preferences-heading' : currentPage?.hash ?? '#main';
        modeSelect.value = advancedMode ? 'advanced' : 'standard';
    }

    function syncQuestionPreferences(profile) {
        if (pendingQuestionPreferenceSaves) return;
        const previous = questionProfile;
        if (previous && questionPreferenceFields.every(key => previous[key] === profile[key])) return;
        questionProfile = profile;
        for (const key of questionPreferenceFields) {
            const input = questionPreferencesForm.elements.namedItem(key);
            input.value = profile[key] ?? (needsSetup ? '' : questionPreferenceDefaults[key]);
        }
        const context = questionContext(profile);
        const changed = Object.entries(context).some(([key, value]) => activeQuestionContext[key] !== value);
        activeQuestionContext = context;
        if (changed) pages = undefined;
    }

    function refreshAnswers() {
        try {
            const { answers, profile } = readChecklist();
            const hasSavedData = Object.keys(answers).length > 0 || Object.keys(profile).length > 0;
            if (needsSetup === undefined || (needsSetup && hasSavedData && !pendingQuestionPreferenceSaves)) {
                questionProfile = undefined;
                setSetupRequired(!hasSavedData);
            }
            syncQuestionPreferences(profile);
            updatePage();
            for (const [id, field] of fields) {
                const value = answers[id] ?? '';
                field.querySelector('input[value="' + value + '"]').checked = true;
            }
            const { rated, total } = checklistProgress(answers, activeQuestionContext);
            progress.max = total;
            progress.value = rated;
            const label = rated + ' of ' + total + ' options rated.';
            if (progressLabel.textContent !== label) progressLabel.textContent = label;
            missingRatings = total - rated;
            reviewButton.classList.toggle('is-complete', missingRatings === 0);
            if (missingRatings > 0) reviewButton.setAttribute('aria-haspopup', 'dialog');
            else reviewButton.removeAttribute('aria-haspopup');
            status.textContent = '';
        } catch {
            updatePage();
            progress.removeAttribute('value');
            progressLabel.textContent = 'Progress unavailable';
            missingRatings = undefined;
            reviewButton.classList.remove('is-complete');
            reviewButton.removeAttribute('aria-haspopup');
            status.textContent = 'Could not load saved answers. Check browser storage or restore a backup.';
        }
    }

    function createChecklistRatingField(choice, group) {
        const field = createRatingField(choice, group);
        fields.set(choice.id, field);
        field.addEventListener('change', async event => {
            try {
                await saveAnswer(choice.id, event.target.value);
                refreshAnswers();
            } catch {
                refreshAnswers();
                status.textContent = 'This change could not be saved. Check your browser storage settings.';
            }
        });
        return field;
    }

    function createPages() {
        const cards = sections.flatMap(section => {
            const applicableCards = section.category.topics.map(topic => ({
                section,
                topic,
                choices: topic.choices.filter(choice => isChoiceApplicable(choice, activeQuestionContext)),
            }));
            section.link.parentElement.hidden = !applicableCards.some(card => card.choices.length);
            return [
                ...applicableCards.filter(card => card.choices.length > 1),
                ...applicableCards.filter(card => card.choices.length === 1),
            ];
        });
        if (advancedMode) {
            for (const group of sectionList.children) group.hidden = !group.querySelector('li:not([hidden])');
        }

        // Spread leftover cards across the pages so the last one also has at least eight rows.
        const pageCount = Math.max(1, Math.floor(cards.length / minimumCardsPerPage));
        const cardsPerPage = Math.floor(cards.length / pageCount);
        const extraCards = cards.length % pageCount;
        let start = 0;
        return Array.from({ length: pageCount }, (_, index) => {
            const end = start + cardsPerPage + Number(index < extraCards);
            const pageCards = cards.slice(start, end);
            start = end;
            const categories = new Map();
            for (const card of pageCards) {
                if (!categories.has(card.section)) categories.set(card.section, []);
                categories.get(card.section).push(card);
            }
            return { hash: '#page-' + (index + 1), index, cards: pageCards, categories };
        });
    }

    function createTopics(cards, group) {
        const topics = document.createElement('div');
        topics.className = 'topic-grid';
        for (const { topic: { title, choices, fantasy }, choices: applicable } of cards) {
            const topic = document.createElement('fieldset');
            const legend = document.createElement('legend');
            const id = choices[0].id;
            const titleText = document.createElement('span');
            titleText.id = 'topic-title-' + id;
            titleText.textContent = title;
            if (fantasy) titleText.append(fantasyLabel());
            legend.append(titleText);
            topic.setAttribute('aria-labelledby', titleText.id);
            const description = DBList.topicDescriptions[id];
            if (description) {
                const help = document.createElement('button');
                help.type = 'button';
                help.className = 'topic-help';
                help.textContent = '?';
                help.dataset.tooltip = description;
                help.setAttribute('aria-label', 'About ' + title);
                help.setAttribute('aria-describedby', 'description-' + id);
                const accessibleDescription = document.createElement('span');
                accessibleDescription.id = 'description-' + id;
                accessibleDescription.hidden = true;
                accessibleDescription.textContent = description;
                legend.append(' ', help, accessibleDescription);
            }
            topic.append(legend, ...applicable.map(choice => createChecklistRatingField(choice, group)));
            topics.append(topic);
        }
        return topics;
    }

    function renderSection(page) {
        hideTooltip();
        fields.clear();

        const section = document.createElement('section');
        section.className = 'checklist-section';
        section.id = page.hash.slice(1);
        section.tabIndex = -1;
        section.setAttribute('aria-label', 'MyList questions');
        let previousGroup;
        for (const [entry, cards] of page.categories) {
            const category = document.createElement('section');
            category.className = 'checklist-category';
            const header = document.createElement('header');
            header.className = 'checklist-category-header';
            const title = document.createElement('h2');
            title.id = entry.hash.slice(1);
            title.tabIndex = -1;
            title.textContent = entry.title;
            category.setAttribute('aria-labelledby', title.id);
            if (advancedMode && entry.group !== previousGroup) {
                const groupTitle = document.createElement('p');
                groupTitle.className = 'checklist-group-label';
                groupTitle.textContent = entry.group.title;
                header.append(groupTitle);
            }
            header.append(title);
            if (entry.description) {
                const description = document.createElement('p');
                description.className = 'note section-description';
                description.textContent = entry.description;
                header.append(description);
            }
            category.append(header, createTopics(cards, entry.category.group));
            section.append(category);
            previousGroup = entry.group;
        }
        questionnaire.replaceChildren(section);

        const { index } = page;
        previousSection.hidden = index === 0;
        if (index > 0) previousSection.href = pages[index - 1].hash;
        const nextPage = pages[index + 1];
        nextSection.hidden = !nextPage;
        if (nextPage) nextSection.href = nextPage.hash;
        sectionPicker.open = false;
        pageNumber.textContent = 'Page ' + (index + 1) + ' of ' + pages.length;
        if (!needsSetup) skipLink.href = page.hash;
        currentPage = page;
    }

    function updatePage() {
        pages ??= createPages();
        const hash = location.hash;
        const promptId = hash.startsWith('#prompt-') ? hash.slice('#prompt-'.length) : '';
        const section = sections.find(section => section.hash === hash)
            ?? sections.find(({ category }) => !category.advanced && hash === '#section-' + category.group);
        const matchesPrompt = card => card.choices.some(choice => choice.id === promptId);
        const page = pages.find(page => page.hash === hash || page.categories.has(section) ||
            (promptId && page.cards.some(matchesPrompt)))
            ?? pages[0];
        if (currentPage !== page) renderSection(page);

        const promptSection = promptId ? page.cards.find(matchesPrompt)?.section : undefined;
        const activeSection = page.categories.has(section) ? section : promptSection ?? page.cards[0]?.section;
        const currentLink = sectionList.querySelector('[aria-current]');
        if (currentLink !== activeSection?.link) {
            currentLink?.removeAttribute('aria-current');
            activeSection?.link.setAttribute('aria-current', 'location');
        }
    }

    function showSection(moveFocus = false) {
        const previousPage = currentPage;
        refreshAnswers();
        if (needsSetup) return;

        const hash = location.hash;
        const field = hash.startsWith('#prompt-') && fields.get(hash.slice('#prompt-'.length));
        const categoryHeading = hash.startsWith('#section-') && document.getElementById(hash.slice(1));
        const target = categoryHeading || (field && field.querySelector('input:checked'));
        if (target) {
            requestAnimationFrame(() => {
                if (location.hash !== hash || !target.isConnected) return;
                target.focus({ preventScroll: true });
                (field || target).scrollIntoView({ block: field ? 'center' : 'start' });
            });
        } else if (moveFocus && previousPage !== currentPage) {
            focusPageStart({ preventScroll: true });
            window.scrollTo(0, 0);
        }
    }

    function focusPageStart(options) {
        (questionnaire.querySelector('h2') ?? questionnaire.firstElementChild).focus(options);
    }

    openInstructions.addEventListener('click', () => {
        helpMenu.open = false;
        instructions.showModal();
    });
    instructions.addEventListener('close', () => helpMenu.querySelector('summary').focus());

    function applyChecklistMode(mode, fantasy = showFantasy) {
        const advanced = mode === 'advanced';
        if (advanced === advancedMode && fantasy === showFantasy) return false;
        location.assign('index.html' + checklistQuery({ advanced, fantasy }));
        return true;
    }

    questionPreferencesForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!needsSetup || pendingQuestionPreferenceSaves) return;
        const { mode, gender, partnerGender, fantasy } = Object.fromEntries(new FormData(questionPreferencesForm));
        questionPreferencesStatus.textContent = '';
        startList.disabled = true;
        pendingQuestionPreferenceSaves++;
        let startedHere = false;
        try {
            await saveQuestionPreferences({ gender, partnerGender, mode, fantasy });
            if (!applyChecklistMode(mode, fantasy === '1')) {
                setSetupRequired(false);
                startedHere = true;
            }
        } catch {
            questionPreferencesStatus.textContent = 'Could not save your question preferences. Check browser storage.';
        } finally {
            pendingQuestionPreferenceSaves--;
            refreshAnswers();
            startList.disabled = needsSetup && !questionPreferencesForm.checkValidity();
        }
        if (startedHere) focusPageStart();
    });

    questionPreferencesForm.addEventListener('change', async event => {
        const input = event.target;
        if (needsSetup) {
            startList.disabled = Boolean(pendingQuestionPreferenceSaves) || !questionPreferencesForm.checkValidity();
            return;
        }
        if (input === modeSelect || input.name === 'fantasy') {
            try {
                const fantasy = fantasyOptions.querySelector('input:checked').value;
                await saveQuestionPreferences({ mode: modeSelect.value, fantasy });
                applyChecklistMode(modeSelect.value, fantasy === '1');
                questionPreferencesStatus.textContent = '';
            } catch {
                modeSelect.value = advancedMode ? 'advanced' : 'standard';
                fantasyOptions.querySelector('input[value="' + Number(showFantasy) + '"]').checked = true;
                questionPreferencesStatus.textContent = 'Could not save your question preferences. Check browser storage.';
            }
            return;
        }
        const value = input.value;
        if (pendingQuestionPreferenceSaves === 0) questionPreferencesStatus.textContent = '';
        pendingQuestionPreferenceSaves++;
        modeSelect.disabled = true;
        try {
            await saveQuestionPreference(input.name, value);
        } catch {
            questionProfile = undefined;
            questionPreferencesStatus.textContent = 'Could not save your question preferences. Check browser storage.';
        } finally {
            pendingQuestionPreferenceSaves--;
            if (pendingQuestionPreferenceSaves === 0) {
                modeSelect.disabled = false;
                refreshAnswers();
            }
        }
    });

    document.querySelector('#open-customize').addEventListener('click', () => {
        customizeStatus.textContent = '';
        customizeForm.reset();
        try {
            const { profile } = readChecklist();
            for (const [key, value] of Object.entries(profile)) {
                const input = customizeForm.elements.namedItem(key);
                if (input) input.value = value;
            }
        } catch {
            customizeStatus.textContent = 'Could not load saved details.';
        }
        showSelectedImageTheme();
        customize.showModal();
        customizeForm.querySelector('.customize-body').scrollTop = 0;
    });

    customize.addEventListener('close', () => DBListThemes.previewSite());

    customizeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const details = {};
        for (const [key, value] of new FormData(customizeForm)) {
            if (value !== '') details[key] = customizeForm.elements.namedItem(key).type === 'number' ? Number(value) : value;
        }
        let profile;
        try {
            profile = cleanProfile(details);
        } catch (error) {
            customizeStatus.textContent = error.message;
            return;
        }
        const submit = customizeForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            await saveProfile(profile);
            refreshAnswers();
            customize.close();
        } catch {
            customizeStatus.textContent = 'Could not save your details. Check browser storage.';
        } finally {
            submit.disabled = false;
        }
    });

    window.addEventListener('storage', event => {
        if (!app.hidden && isAnswerStorageEvent(event)) refreshAnswers();
    });
    function showChecklist(moveFocus = false) {
        const hash = checklistShareHash(location.hash);
        if (hash) {
            location.replace('profiles.html' + location.search + hash);
        } else {
            showSection(moveFocus);
        }
    }
    window.addEventListener('hashchange', () => {
        if (!app.hidden) showChecklist(true);
    });
    mountAdultPage(showChecklist);
})();
