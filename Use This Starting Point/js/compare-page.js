(function () {
    'use strict';

    const {
        mountAdultPage, readChecklist, isAnswerStorageEvent, ratingLabel, ratingIcon, compareChecklists,
        parseAnswerBackup, checklistShareHash, parseChecklistShareHash, createExampleComparison,
        bindComparisonInput, comparisonBackupKey, getSavedProfiles, readSavedChecklist,
    } = DBList;
    const app = document.querySelector('#app');
    const compareDialog = document.querySelector('#compare-dialog');
    const openCompare = document.querySelector('#open-compare');
    const input = document.querySelector('#compare-link');
    const profileForm = document.querySelector('#compare-profile-form');
    const profileSelect = document.querySelector('#compare-profile');
    const profileId = new URLSearchParams(location.search).get('profile');
    openCompare.addEventListener('click', () => compareDialog.showModal());
    const clear = document.querySelector('#compare-clear');
    const current = document.querySelector('#compare-current');
    const localStatus = document.querySelector('#compare-local-status');
    const editMyList = document.querySelector('#compare-edit-mylist');
    const status = document.querySelector('#compare-import-status');
    const loaded = document.querySelector('#compare-loaded');
    const comparison = document.querySelector('#comparison');
    const heading = document.querySelector('#comparison-heading');
    const answerCounts = document.querySelector('#compare-answer-counts');
    const strictness = document.querySelector('#compare-strictness');
    const strictnessControl = document.querySelector('#compare-strictness-control');
    const modeNote = document.querySelector('#compare-mode-note');
    const donut = document.querySelector('#compare-donut');
    const chartTotal = document.querySelector('#compare-chart-total');
    const coverage = document.querySelector('#compare-coverage');
    const categoryGrid = document.querySelector('#compare-category-grid');
    const details = document.querySelector('#compare-details');
    const matchScore = document.querySelector('#compare-match-score');
    const matchCount = document.querySelector('#compare-match-count');
    const conflictScore = document.querySelector('#compare-conflict-score');
    const conflictCount = document.querySelector('#compare-conflict-count');
    const modes = [
        ['strict', 'Strict', 'Only identical ratings match.'],
        ['standard', 'Standard', 'Ratings up to one step apart match. Hard limits are handled separately.'],
        ['relaxed', 'Relaxed', 'Favorite, Like, Willing to try, and Let’s talk about it count as yes. Skip and Off the table count as no.'],
    ];
    const groups = [
        ['limits', 'Potential limit conflicts', 'One person marked this off the table and the other showed interest or openness. Respect the stated limit.', true],
        ['unansweredLimits', 'Limits with an unanswered counterpart', 'One person set a limit. The corresponding answer is blank.', true],
        ['contextualLimits', 'Limits and dealbreakers to verify', 'These ratings depend on traits, roles, or circumstances. Check which ones apply to your situation.', true],
        ['differences', 'Different preferences', 'The ratings differ under the selected strictness.'],
        ['matches', 'Compatible ratings', 'The ratings align under the selected strictness.'],
        ['boundaries', 'Shared boundaries', 'Both people would skip the option or have marked it off the table.'],
        ['unanswered', 'Other unanswered pairs', 'Only one person rated this option or the corresponding role.'],
        ['partner', 'Partner preferences to check', 'These answers describe what each person looks for. Check which traits and dealbreakers apply to each other.'],
        ['context', 'Scenarios to review', 'These options depend on the people and roles involved. Review the individual ratings together.'],
    ];
    let imported;
    let localAnswers;
    let localName;
    let currentHash = '';
    let hasMounted = false;

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function answerCell(choice, rating, group, directional) {
        const cell = element('td');
        const value = element('span', '', 'compare-rating');
        value.dataset.rating = rating;
        value.append(ratingIcon(rating, 15), element('span', ratingLabel(rating, group)));
        cell.append(value);
        if (directional) cell.append(element('small', choice.short || choice.prompt));
        return cell;
    }

    function renderRows([kind, title, description, open], rows, openStates, people) {
        const section = element('details', '', 'panel compare-detail');
        section.dataset.kind = kind;
        section.open = openStates.get(kind) ?? Boolean(open);
        const summary = element('summary');
        summary.id = 'compare-group-' + kind;
        const label = element('span', '', 'compare-group-label');
        label.append(element('span', title), element('span', String(rows.length), 'compare-group-count'));
        summary.append(label);

        const table = element('table', '', 'compare-table');
        table.setAttribute('aria-labelledby', summary.id);
        const header = table.createTHead().insertRow();
        for (const columnTitle of ['Topic', ...people]) {
            const column = element('th', columnTitle);
            column.scope = 'col';
            header.append(column);
        }
        const body = table.createTBody();
        for (const row of rows) {
            const topic = element('th', row.title);
            topic.scope = 'row';
            topic.append(element('small', row.category + (row.fantasy ? ' · Fantasy' : '')));
            const directional = row.own.id !== row.other.id;
            body.insertRow().append(topic,
                answerCell(row.own, row.ownRating, row.group, directional),
                answerCell(row.other, row.otherRating, row.group, directional));
        }
        section.append(summary, element('p', description, 'note'), table);
        return section;
    }

    function countText(count, singular, plural = singular + 's') {
        return count + ' ' + (count === 1 ? singular : plural);
    }

    function renderCategoryGrid(rows, mode) {
        const unscored = [
            ...(mode === 'relaxed' ? [] : rows.boundaries),
            ...rows.unanswered, ...rows.unansweredLimits, ...rows.contextualLimits, ...rows.partner, ...rows.context,
        ];
        const results = [
            ['match', [...rows.matches, ...(mode === 'relaxed' ? rows.boundaries : [])], 'compatible'],
            ['difference', rows.differences, 'different'],
            ['limit', rows.limits, 'limit conflicts'],
            ['unscored', unscored, 'unscored'],
        ];
        const categories = new Map(DBList.categories.map(({ id }) => [id, {}]));
        for (const [result, items] of results) {
            for (const { categoryId } of items) {
                const counts = categories.get(categoryId);
                counts[result] = (counts[result] ?? 0) + 1;
            }
        }

        const visibleIds = new Set(DBList.visibleCategories.map(({ id }) => id));
        const displayed = DBList.categories.filter(({ id }) =>
            visibleIds.has(id) || Object.keys(categories.get(id)).length);
        categoryGrid.replaceChildren(...displayed.map(({ id, title }) => {
            const category = element('li', '', 'compare-category');
            const markers = element('span', '', 'compare-category-markers');
            markers.setAttribute('aria-hidden', 'true');
            const counts = categories.get(id);
            const summary = results.map(([result, , label]) => {
                const count = counts[result] ?? 0;
                for (let i = 0; i < count; i++) {
                    const marker = element('span', '', 'compare-category-marker');
                    marker.dataset.result = result;
                    markers.append(marker);
                }
                return count + ' ' + label;
            });
            const description = markers.childElementCount ? summary.join(', ') : 'No rated pairs';
            category.title = title + ' — ' + description;
            if (markers.childElementCount) {
                markers.style.setProperty('--marker-count', markers.childElementCount);
            } else {
                markers.textContent = '—';
            }
            category.append(
                element('span', title, 'compare-category-name'),
                element('span', description, 'compare-visually-hidden'),
                markers,
            );
            return category;
        }));
        return unscored.length;
    }

    function readLocalAnswers() {
        editMyList.hidden = true;
        profileForm.hidden = true;
        localName = '';
        try {
            const { activeId, profiles } = getSavedProfiles();
            const selected = profiles.find(profile => profile.id === profileId);
            if (profileId !== null && !selected) {
                localStatus.textContent = 'This saved profile is no longer available.';
                editMyList.href = 'profiles.html';
                editMyList.textContent = 'Open Profiles';
                editMyList.hidden = false;
                return {};
            }
            const alternatives = profiles.filter(profile => profile.id !== (profileId ?? activeId));
            const previous = profileSelect.value;
            profileSelect.replaceChildren(new Option('Choose a profile', ''),
                ...alternatives.map(profile => new Option(profile.name, profile.id)));
            profileSelect.value = alternatives.some(profile => profile.id === previous) ? previous : '';
            profileForm.hidden = !alternatives.length;

            localName = selected?.name ?? '';
            const { answers } = selected ? readSavedChecklist(selected.id) : readChecklist();
            const count = Object.keys(answers).length;
            editMyList.hidden = count > 0;
            if (selected) {
                editMyList.href = 'profiles.html';
                editMyList.textContent = 'Open Profiles to edit ratings';
            }
            localStatus.textContent = count || selected ? (localName || 'MyList') + ' has ' + countText(count, 'saved rating') + '.' :
                'Save ratings in MyList to compare with another person.';
            return answers;
        } catch {
            localStatus.textContent = 'Could not load your saved answers. Check your browser storage settings.';
            return {};
        }
    }

    function render() {
        const exampleAnswers = imported?.ownAnswers;
        current.hidden = !imported;
        comparison.hidden = true;
        details.replaceChildren();
        heading.textContent = exampleAnswers ? 'Example compatibility overview' : 'Compatibility overview';
        loaded.textContent = '';
        if (exampleAnswers) {
            loaded.textContent = 'Generated two fictional sets of ratings.';
        } else if (imported) {
            const name = imported.savedName ?? imported.profile.name;
            loaded.textContent = (name ? 'Loaded results for ' + name : 'Loaded results') + ' · ' +
                countText(Object.keys(imported.answers).length, 'rating') +
                (imported.skipped ? ' · ' + countText(imported.skipped, 'unrecognized entry', 'unrecognized entries') + ' skipped' : '');
        }
        const myListAnswers = readLocalAnswers();
        localAnswers = exampleAnswers ?? myListAnswers;
        if (!imported || !Object.keys(localAnswers).length) return;

        const ownCount = Object.keys(localAnswers).length;
        const otherCount = Object.keys(imported.answers).length;
        answerCounts.textContent = exampleAnswers
            ? 'Sample data · ' + countText(ownCount, 'rating') + ' for Example A · ' +
                countText(otherCount, 'rating') + ' for Example B'
            : (localName || 'MyList') + ' · ' + countText(ownCount, 'rating') + ' · ' + (imported.savedName ?? 'Loaded ratings') + ' · ' +
                countText(otherCount, 'rating');
        renderComparison();
        comparison.hidden = false;
    }

    function renderComparison() {
        const [mode, label, explanation] = modes[strictness.valueAsNumber];
        strictnessControl.dataset.mode = mode;
        strictness.setAttribute('aria-valuetext', label);
        modeNote.textContent = explanation;

        const { rows, matches, total } = compareChecklists(localAnswers, imported.answers, mode);
        const matchPercent = total ? Math.round(100 * matches / total) : 0;
        matchScore.textContent = total ? matchPercent + '%' : '—';
        matchCount.textContent = countText(matches, 'compatible pair');
        conflictScore.textContent = total ? (100 - matchPercent) + '%' : '—';
        conflictCount.textContent = countText(rows.limits.length, 'limit conflict') + ' · ' +
            countText(rows.differences.length, 'other difference');
        chartTotal.textContent = total;
        donut.dataset.empty = String(!total);
        donut.style.setProperty('--match-angle', (total ? 360 * matches / total : 0) + 'deg');
        const scoreSummary = total
            ? countText(total, 'scored pair') + ' · ' + matchScore.textContent + ' compatible · ' + conflictScore.textContent + ' incompatible'
            : 'No pairs to score in this mode';
        const unscored = renderCategoryGrid(rows, mode);
        coverage.textContent = scoreSummary + ' · ' + countText(unscored, 'unscored pair');

        const openStates = new Map(Array.from(details.children, section => [section.dataset.kind, section.open]));
        const people = imported.ownAnswers ? ['Example A', 'Example B'] : [localName || 'You', imported.savedName ?? 'Other person'];
        details.replaceChildren();
        for (const group of groups) {
            const items = rows[group[0]];
            if (items.length) details.append(renderRows(group, items, openStates, people));
        }
    }

    strictness.addEventListener('input', () => {
        if (!comparison.hidden) renderComparison();
    });

    function clearShareHash() {
        if (!checklistShareHash(location.hash)) return;
        const url = new URL(location.href);
        url.hash = '';
        history.replaceState(history.state, '', url);
        currentHash = '';
    }

    function loadComparison(checklist, fromLocation = false) {
        if (!Object.keys(checklist.answers).length) {
            const skipped = checklist.skipped ? ' ' + countText(checklist.skipped, 'entry', 'entries') + ' skipped.' : '';
            throw new Error('These results contain no usable ratings.' + skipped);
        }
        if (!fromLocation) clearShareHash();
        imported = checklist;
        input.value = '';
        status.textContent = '';
        render();
        if (!comparison.hidden) {
            compareDialog.close();
            if (!fromLocation) heading.focus();
        }
    }

    function showLocationShare() {
        const hash = checklistShareHash(location.hash);
        if (hash === currentHash) return;
        currentHash = hash;
        cancelComparisonInput();
        imported = undefined;
        status.textContent = '';
        if (!hash) {
            render();
            return;
        }
        try {
            loadComparison(parseChecklistShareHash(hash), true);
        } catch (error) {
            render();
            status.textContent = error.message;
        }
    }

    const cancelComparisonInput = bindComparisonInput(compareDialog, (checklist, { example }) => {
        loadComparison(example ? createExampleComparison() : checklist);
    });
    compareDialog.addEventListener('close', cancelComparisonInput);
    profileForm.addEventListener('submit', event => {
        event.preventDefault();
        cancelComparisonInput();
        status.textContent = '';
        try {
            const { activeId, profiles } = getSavedProfiles();
            const other = profiles.find(profile => profile.id === profileSelect.value && profile.id !== (profileId ?? activeId));
            if (!other) throw new Error('Choose another saved profile.');
            loadComparison({ ...readSavedChecklist(other.id), savedName: other.name });
        } catch (error) {
            status.textContent = error.message;
        }
    });

    function loadPendingComparison() {
        const url = new URL(location.href);
        const source = url.searchParams.get('source');
        if (!source) return;
        url.searchParams.delete('source');
        history.replaceState(history.state, '', url);
        try {
            if (source === 'example') loadComparison(createExampleComparison());
            if (source === 'backup') {
                const backup = sessionStorage.getItem(comparisonBackupKey);
                sessionStorage.removeItem(comparisonBackupKey);
                if (!backup) throw new Error('Choose the JSON backup again to start the comparison.');
                loadComparison(parseAnswerBackup(backup));
            }
        } catch (error) {
            status.textContent = error.message;
        }
    }

    clear.addEventListener('click', () => {
        cancelComparisonInput();
        clearShareHash();
        imported = undefined;
        status.textContent = '';
        render();
        input.focus();
    });
    window.addEventListener('storage', event => {
        if (!app.hidden && isAnswerStorageEvent(event)) render();
    });
    window.addEventListener('hashchange', () => {
        if (!app.hidden) showLocationShare();
    });

    mountAdultPage(() => {
        render();
        showLocationShare();
        loadPendingComparison();
        if (hasMounted) return;
        hasMounted = true;
        queueMicrotask(() => {
            if (!app.hidden && comparison.hidden && !compareDialog.open) compareDialog.showModal();
        });
    });
})();
