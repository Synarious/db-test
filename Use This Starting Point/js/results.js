(function () {
    'use strict';

    const {
        mountAdultPage, ratingLabel, ratingOptions, readChecklist, saveAnswer, checklistProgress, profileLines, questionContext, isChoiceApplicable,
        visibleCategories: categories, navigationGroups, advancedMode, showFantasy, checklistQuery,
        ratingIcon, createRatingField, checklistRatingOptions, fillRatingKey, fantasyLabel, createImageSheet, layoutImageSheet,
        bindChecklistShareUrl, downloadFile, isAnswerStorageEvent, checklistShareHash, parseChecklistShareHash,
        bindComparisonInput, comparisonBackupKey,
    } = DBList;

    const summary = document.querySelector('#summary');
    const finish = document.querySelector('#finish-missing');
    const finishFields = document.querySelector('#finish-fields');
    const finishCount = document.querySelector('#finish-count');
    const finishStatus = document.querySelector('#finish-status');
    const finishKey = document.querySelector('#finish-rating-key');
    fillRatingKey(finishKey, 15, checklistRatingOptions);
    const status = document.querySelector('#status');
    const tools = document.querySelector('.results-tools');
    const shareOptions = document.querySelector('#share-url-options');
    const progressGroup = document.querySelector('.page-progress');
    const progress = document.querySelector('#results-progress');
    const progressIcon = progressGroup.querySelector('.results-progress-icon');
    const meter = document.querySelector('#results-meter');
    const imageButton = document.querySelector('#download-image');
    const textButton = document.querySelector('#download-text');
    const excludeUnrated = document.querySelector('#exclude-unrated');
    const pageHeading = document.querySelector('#app-heading');
    const title = document.querySelector('#summary-heading');
    const profileList = document.querySelector('#results-profile');
    const notice = document.querySelector('#example-notice');
    const exampleMessage = document.querySelector('#example-message');
    const viewOwn = document.querySelector('#view-own-results');
    const sharedPanel = document.querySelector('#shared-results');
    const sharedStatus = document.querySelector('#shared-results-status');
    const capture = document.querySelector('#capture');
    const profilesLink = document.querySelector('#profiles-link');
    const editAnswers = document.querySelector('#edit-answers');
    const compareResults = document.querySelector('#compare-results');
    const openCompare = document.querySelector('#open-compare');
    const compareDialog = document.querySelector('#compare-dialog');
    openCompare.addEventListener('click', () => compareDialog.showModal());
    const cancelCompareInput = bindComparisonInput(compareDialog, (checklist, { hash, backup, example }) => {
        if (checklist && !Object.keys(checklist.answers).length) {
            throw new Error('These results contain no usable ratings.');
        }
        const url = new URL('compare.html' + checklistQuery({ shareHash: hash }), location.href);
        if (hash) url.hash = hash;
        if (backup) {
            sessionStorage.setItem(comparisonBackupKey, backup);
            url.searchParams.set('source', 'backup');
        }
        if (example) url.searchParams.set('source', 'example');
        compareDialog.close();
        location.assign(url);
    });
    compareDialog.addEventListener('close', cancelCompareInput);
    const checklistUrl = 'index.html' + checklistQuery();
    document.querySelector('#own-results').href = 'results.html' + checklistQuery();
    for (const link of document.querySelectorAll('a[href="index.html"]')) link.href = checklistUrl;
    const consent = document.querySelector('#consent-note');
    const consentNote = consent.textContent;
    const exampleNote = 'This example uses fictional ratings and profile details.';
    const exampleProfile = { name: 'Alex', role: 'Switch', age: 30 };
    const exampleRatings = ratingOptions.map(([value]) => value).filter(Boolean);
    const minimumRatingsForOwnResults = 10;
    const maxImageExportScale = 2;
    const maxImageExportWidth = 6_669;
    const maxImageExportHeight = 4_150;
    const imagePixelBudget = 24_000_000;
    let text = '';
    let imageData;
    let viewOwnResults = false;
    let exporting = false;
    let activeShareHash = '';
    let shared;

    const textRating = { favorite: '*', like: '+', 'willing-to-try': '~', maybe: '?', 'not-interested': '-', limit: 'X', '': '.' };


    function formatTextExport(heading, details, ratedCategories) {
        const lines = [
            heading,
            '* Favorite  + Like  ~ Willing to try  ? Let’s talk about it  - Skip  X Limit  . Blank',
            'Pairs follow MyList order. X means dealbreaker for partner traits.',
        ];
        if (ratedCategories.some(category => category.topics.some(topic =>
            topic.choices.some(choice => choice.value) && topic.choices.some(choice => !choice.applicable)))) {
            lines.push('N/A = direction skipped by question preferences.');
        }
        lines.push(...details);
        let body = '';
        for (const category of ratedCategories) {
            let prefix = '\n' + category.title + '\n';
            for (const topic of category.topics) {
                if (!topic.choices.some(choice => choice.value)) continue;
                const ratings = topic.choices.map(choice => choice.applicable ? textRating[choice.value] : 'N/A').join(' ');
                const title = topic.fantasy ? topic.title + ' [Fantasy]' : topic.title;
                const row = prefix + title + ' ' + ratings + '\n';
                body += row;
                prefix = '';
            }
        }
        if (!body) return [heading, ...details].join('\n') + '\n\nNo ratings yet.\n';
        return lines.join('\n') + '\n' + body;
    }

    function renderMissing(answers, context) {
        finish.hidden = Boolean(shared);
        finishFields.replaceChildren();
        if (shared) return;

        for (const { group, title, topics } of categories) {
            const missing = topics.map(topic => ({
                title: topic.title,
                fantasy: topic.fantasy,
                choices: topic.choices.filter(choice => !answers[choice.id] && isChoiceApplicable(choice, context)),
            })).filter(topic => topic.choices.length);
            if (!missing.length) continue;
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.textContent = title;
            const grid = document.createElement('div');
            grid.className = 'topic-grid';
            for (const topic of missing) {
                const card = document.createElement('fieldset');
                const legend = document.createElement('legend');
                legend.textContent = topic.title;
                if (topic.fantasy) legend.append(fantasyLabel());
                card.append(legend);
                for (const choice of topic.choices) {
                    card.append(createRatingField(choice, group, { nativeTooltips: true }));
                }
                grid.append(card);
            }
            section.append(heading, grid);
            finishFields.append(section);
        }
        updateFinishSummary();
    }

    function updateFinishSummary() {
        const count = finishFields.querySelectorAll('.rating-field').length;
        finishCount.textContent = count + ' unrated';
        finish.hidden = count === 0;
    }

    document.querySelector('#rate-next').addEventListener('click', () => {
        finishFields.querySelector('input:checked')?.focus();
    });

    finishFields.addEventListener('keydown', event => {
        const { target, key } = event;
        const editor = target.closest('.rating-field');
        if (!editor || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const forward = key === 'ArrowRight' || key === 'ArrowDown';
        const backward = key === 'ArrowLeft' || key === 'ArrowUp';
        if (!forward && !backward) return;

        // Let keyboard users browse the ratings before committing one with Space.
        event.preventDefault();
        const radios = [...editor.querySelectorAll('input:enabled')];
        const index = radios.indexOf(target);
        radios[(index + (forward ? 1 : -1) + radios.length) % radios.length]?.focus();
    });

    finishFields.addEventListener('change', async ({ target: radio }) => {
        if (!radio.value) return;
        const editor = radio.closest('.rating-field');
        const otherRadios = editor.querySelectorAll('input:not(:checked)');
        for (const input of otherRadios) input.disabled = true;
        try {
            await saveAnswer(radio.name, radio.value);
        } catch {
            editor.querySelector('input[value=""]').checked = true;
            for (const input of otherRadios) input.disabled = false;
            finishStatus.textContent = 'Could not save this rating. Check browser storage and select the rating again to retry.';
            return;
        }
        const moveFocus = editor.contains(document.activeElement);
        const editors = [...finishFields.querySelectorAll('.rating-field')];
        const next = editors[editors.indexOf(editor) + 1];
        const editorAttached = finishFields.contains(editor);
        if (editorAttached) {
            const card = editor.closest('fieldset');
            const section = card.closest('section');
            editor.remove();
            if (!card.querySelector('.rating-field')) card.remove();
            if (!section.querySelector('.rating-field')) section.remove();
            updateFinishSummary();
        }
        viewOwnResults = true;
        renderResults({ refreshMissing: !editorAttached });
        finishStatus.textContent = 'Rating saved.';
        if (moveFocus) {
            const target = finish.hidden ? pageHeading :
                (next?.querySelector('input:checked') ?? finishFields.querySelector('input:checked') ?? finish.querySelector('summary'));
            target.focus();
        }
    });

    function renderResults({ refreshMissing = true } = {}) {

        const expanded = new Set(Array.from(summary.querySelectorAll('details[open]'), detail => detail.id));
        const sections = [];
        try {
            const { answers, profile } = shared ?? readChecklist();
            const context = questionContext(shared ? undefined : profile);
            if (refreshMissing) renderMissing(answers, context);
            const { rated, total } = checklistProgress(answers, context);
            const example = !shared && rated < minimumRatingsForOwnResults && !viewOwnResults;
            shareOptions.hidden = Boolean(shared || example);
            refreshShareUrl();
            openCompare.hidden = Boolean(shared || example || !rated);
            compareResults.hidden = !openCompare.hidden || Boolean(shared && !Object.keys(answers).length);
            const displayProfile = example ? exampleProfile : shared ? profile : { ...profile, shareGender: 'yes' };
            const displayContext = example ? questionContext() : context;
            const heading = example ? 'Example · MyList' : 'MyList';
            const details = profileLines(displayProfile);
            const note = example ? exampleNote : consentNote;
            pageHeading.textContent = shared ? 'Shared results' : example ? 'Example results' : 'Your results';
            title.textContent = heading;
            consent.textContent = note;
            profileList.replaceChildren(...details.map(detail => {
                const item = document.createElement('li');
                item.textContent = detail;
                return item;
            }));
            profileList.hidden = !details.length;
            notice.hidden = !example;
            if (example) {
                exampleMessage.textContent = 'You’ve rated ' + rated + ' of ' + total +
                    ' options. Review results opens your own results once you’ve rated ' + minimumRatingsForOwnResults + ' options.';
            }
            let exampleIndex = 0;
            const ratedCategories = categories.map(category => ({
                ...category,
                topics: category.topics.map(topic => ({
                    ...topic,
                    choices: topic.choices.map(choice => {
                        const applicable = isChoiceApplicable(choice, displayContext);
                        return {
                            ...choice, applicable,
                            value: example ? exampleRatings[exampleIndex++ % exampleRatings.length] :
                                (applicable ? (answers[choice.id] ?? '') : ''),
                        };
                    }),
                })).filter(topic => topic.choices.some(choice => choice.applicable)),
            }));
            const ratedById = new Map(ratedCategories.map(category => [category.id, category]));
            const groups = navigationGroups.map(group => ({
                ...group,
                categories: group.categories.map(category => ratedById.get(category.id)),
            }));
            imageData = { groups, details, example };
            text = formatTextExport(heading, details, ratedCategories);
            const complete = !shared && total > 0 && rated === total;
            progressGroup.hidden = example;
            progress.textContent = complete ? 'All ' + total + ' options rated.' : rated + ' of ' + total + ' options rated.';
            progressIcon.hidden = !complete;
            meter.hidden = complete;
            meter.max = total || 1;
            meter.value = rated;
            for (const group of groups) {
                const groupSection = document.createElement('section');
                groupSection.className = 'results-group';
                const groupHeading = document.createElement('h3');
                groupHeading.textContent = group.title;
                groupHeading.id = 'results-' + group.id;
                groupHeading.tabIndex = -1;
                groupSection.setAttribute('aria-labelledby', groupHeading.id);
                const grid = document.createElement('div');
                grid.className = 'results-categories';
                groupSection.append(groupHeading, grid);
                sections.push(groupSection);
                for (const category of group.categories) {
                    const section = document.createElement('details');
                    section.className = 'result-category';
                    section.id = 'result-' + category.id;
                    section.setAttribute('name', 'result-category');
                    section.open = expanded.has(section.id);
                    const heading = document.createElement('summary');
                    const headingText = document.createElement('span');
                    headingText.textContent = category.title;
                    const count = document.createElement('span');
                    count.className = 'result-count';
                    const choices = category.topics.flatMap(topic => topic.choices).filter(choice => choice.applicable);
                    const rated = choices.filter(choice => choice.value).length;
                    count.dataset.complete = String(rated === choices.length);
                    count.textContent = rated === choices.length ? 'Complete · ' + rated + ' rated' :
                        rated + ' of ' + choices.length + ' rated';
                    heading.append(headingText, count);
                    if (category.subtitle) {
                        const subtitle = document.createElement('span');
                        subtitle.className = 'category-subtitle note';
                        subtitle.textContent = category.subtitle;
                        heading.append(subtitle);
                    }
                    const list = document.createElement('dl');
                    list.className = 'result-topics';

                    for (const topic of category.topics) {
                        const item = document.createElement('div');
                        const term = document.createElement('dt');
                        term.textContent = topic.title;
                        if (topic.fantasy) term.append(fantasyLabel());
                        item.append(term);
                        for (const { id, value, prompt, applicable } of topic.choices) {
                            if (!applicable) continue;
                            const description = ratingLabel(value, category.group);
                            const detail = document.createElement('dd');
                            detail.dataset.rating = value;
                            const promptText = document.createElement(example || shared ? 'span' : 'a');
                            if (!example && !shared) {
                                promptText.href = checklistUrl + '#prompt-' + id;
                                promptText.setAttribute('aria-label', 'Edit rating for ' + topic.title + '. ' + prompt);
                            }
                            promptText.textContent = prompt;
                            const badge = document.createElement('span');
                            badge.className = 'result-rating';
                            badge.append(ratingIcon(value, 18), description);
                            promptText.className = 'result-edit';
                            detail.append(badge, promptText);
                            item.append(detail);
                        }
                        list.append(item);
                    }

                    section.append(heading, list);
                    grid.append(section);
                }
            }
        } catch {
            shareOptions.hidden = true;
            refreshShareUrl();
            summary.replaceChildren();
            openCompare.hidden = true;
            finish.hidden = true;
            progressGroup.hidden = true;
            progress.textContent = '';
            text = '';
            imageData = null;
            notice.hidden = true;
            profileList.hidden = true;
            pageHeading.textContent = 'Your results';
            title.textContent = 'MyList';
            consent.textContent = consentNote;
            textButton.disabled = true;
            imageButton.disabled = true;
            status.textContent = 'Could not load saved answers. Check browser storage or restore a backup.';
            return;
        }
        summary.replaceChildren(...sections);
        if (!expanded.size && !shared) {
            const target = document.getElementById(location.hash.slice(1));
            if (target?.matches('.result-category')) target.open = true;
        }
        textButton.disabled = false;
        imageButton.disabled = exporting;
        status.textContent = '';
    }

    function openSharedSection() {
        if (!shared) return;
        const hash = location.hash;
        const id = new URLSearchParams(hash.slice(1)).get('section');
        if (!id) return;
        const section = document.getElementById(id);
        if (!section?.matches('.result-category')) return;
        section.open = true;
        requestAnimationFrame(() => {
            if (location.hash === hash && section.isConnected) section.scrollIntoView();
        });
    }

    function showResults() {
        activeShareHash = checklistShareHash(location.hash);
        shared = null;
        sharedPanel.hidden = !activeShareHash;
        shareOptions.hidden = Boolean(activeShareHash);
        editAnswers.textContent = activeShareHash ? 'MyList' : 'Edit answers';
        if (activeShareHash) {
            try {
                shared = parseChecklistShareHash(activeShareHash);
                sharedStatus.textContent = '';
                if (shared.skipped) sharedStatus.textContent = 'Skipped ' + shared.skipped + ' incompatible entries.';
            } catch (error) {
                sharedStatus.textContent = error.message;
            }
        }

        const invalidLink = Boolean(activeShareHash && !shared);
        profilesLink.href = 'profiles.html' + location.search + (shared ? activeShareHash : '');
        profilesLink.hidden = !shared;
        compareResults.hidden = invalidLink || Boolean(shared && !Object.keys(shared.answers).length);
        openCompare.hidden = true;
        compareResults.href = 'compare.html' + checklistQuery({ shareHash: activeShareHash }) + activeShareHash;
        compareResults.textContent = shared ? 'Compare with mine' : 'Compare results';
        capture.hidden = invalidLink;
        editAnswers.hidden = invalidLink;
        tools.hidden = invalidLink;
        if (invalidLink) {
            notice.hidden = true;
            finish.hidden = true;
            progressGroup.hidden = true;
            pageHeading.textContent = 'Shared results';
            status.textContent = '';
            refreshShareUrl();
            return;
        }
        renderResults();
        if (!shared && location.hash === '#finish-missing' && !finish.hidden) {
            finish.open = true;
            requestAnimationFrame(() => {
                finish.querySelector('summary').focus({ preventScroll: true });
                finish.scrollIntoView();
            });
        }
        openSharedSection();
    }

    viewOwn.addEventListener('click', () => {
        viewOwnResults = true;
        renderResults();
        title.focus();
    });

    textButton.addEventListener('click', () => {
        const name = imageData.example ? 'mylist-example.txt' : 'mylist.txt';
        downloadFile(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
        status.textContent = 'Text download requested.';
    });

    async function renderImage(sheet, { width, height }, scale) {
        const canvas = await window.html2canvas(sheet, {
            scale,
            width,
            height,
            windowWidth: width,
            windowHeight: height,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDocument, clonedSheet) => {
                clonedSheet.style.left = '0';
                // The renderer loads each SVG as a standalone image without the page stylesheet.
                for (const icon of clonedSheet.querySelectorAll('.rating-icon')) {
                    icon.style.color = clonedDocument.defaultView.getComputedStyle(icon).color;
                }
            },
        });
        try {
            const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!image) throw new Error('Empty image');
            return { image, width: canvas.width, height: canvas.height };
        } finally {
            canvas.width = 0;
        }
    }

    imageButton.addEventListener('click', async () => {
        exporting = true;
        imageButton.disabled = true;
        excludeUnrated.disabled = true;
        status.textContent = 'Preparing image…';
        const data = imageData;
        const ratedOnly = excludeUnrated.checked;
        let sheet;
        try {
            let groups = data.groups;
            if (ratedOnly) {
                groups = groups.map(group => ({
                    ...group,
                    categories: group.categories.map(category => ({
                        ...category,
                        topics: category.topics.filter(topic => topic.choices.some(choice => choice.value)),
                    })).filter(category => category.topics.length),
                })).filter(group => group.categories.length);
            }
            sheet = createImageSheet({ ...data, groups, ratedOnly });
            document.body.append(sheet);
            layoutImageSheet(sheet);
            const bounds = sheet.getBoundingClientRect();
            const size = { width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
            const scale = Math.min(
                maxImageExportScale,
                maxImageExportWidth / size.width,
                maxImageExportHeight / size.height,
                Math.sqrt(imagePixelBudget / (size.width * size.height))
            );
            let png;
            try {
                png = await renderImage(sheet, size, scale);
            } catch (error) {
                if (scale <= 1) throw error;
                png = await renderImage(sheet, size, 1);
            }
            const name = data.example ? 'mylist-example' : 'mylist';
            downloadFile(png.image, name + '.png');
            status.textContent = 'Image download requested (' + png.width + ' × ' + png.height + ' px).';
        } catch {
            status.textContent = 'The image could not be created. You can download the text or use the screenshot guide.';
        } finally {
            sheet?.remove();
            exporting = false;
            excludeUnrated.disabled = false;
            imageButton.disabled = !text;
        }
    });

    const refreshShareUrl = bindChecklistShareUrl();
    const app = document.querySelector('#app');
    window.addEventListener('hashchange', () => {
        const { advanced, fantasy } = DBList.checklistView();
        if (advanced !== advancedMode || fantasy !== showFantasy) {
            location.reload();
            return;
        }
        if (app.hidden) return;
        if (checklistShareHash(location.hash) !== activeShareHash) showResults();
        else openSharedSection();
    });
    window.addEventListener('storage', event => {
        if (!app.hidden && !activeShareHash && isAnswerStorageEvent(event)) renderResults();
    });
    mountAdultPage(showResults);
})();
