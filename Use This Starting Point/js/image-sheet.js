(function () {
    'use strict';

    const { advancedMode, ratingLabel, ratingIcon, fillRatingKey, fantasyLabel } = DBList;

    function textElement(tag, text) {
        const element = document.createElement(tag);
        element.textContent = text;
        return element;
    }

    const columnLabels = {
        activities: ['Receive', 'Give'],
        gear: ['I wear', 'Partner wears'],
        intimacy: ['Receive', 'Give'],
        communication: ['Receive', 'Give'],
    };

    function categoryTable({ id, title, subtitle, topics, group, directions = columnLabels[id] }, { interactive, ratedOnly }) {
        const hasPairedRows = topics.some(topic => topic.choices.length > 1);

        const table = document.createElement('table');
        const caption = table.createCaption();
        const heading = document.createElement('div');
        heading.className = 'image-category-heading';
        heading.append(textElement('strong', title));
        if (subtitle) heading.append(textElement('span', subtitle));
        const directionsBar = document.createElement('div');
        directionsBar.className = 'image-directions-bar';
        const columns = document.createElement('div');
        columns.className = 'image-column-labels';
        const labels = directions ?? ['Rating'];
        for (const label of labels) {
            columns.append(textElement('span', label === 'Partner wears' ? 'They wear' : label));
        }
        directionsBar.append(columns);
        caption.append(heading, directionsBar);
        if (hasPairedRows) table.classList.add('image-paired-table');

        const body = table.createTBody();
        for (const topic of topics) {
            const row = body.insertRow();
            const heading = textElement('th', topic.title);
            heading.scope = 'row';
            if (topic.fantasy) heading.append(fantasyLabel());
            const paired = topic.choices.length > 1;
            if (paired && topic.choices.some((choice, index) => choice.short !== directions?.[index])) {
                heading.append(textElement('span', topic.choices.map(choice => choice.short).join(' / ')));
            }
            if (interactive) {
                const help = textElement('button', topic.title);
                help.type = 'button';
                help.className = 'share-topic-help';
                help.setAttribute('aria-expanded', 'false');
                const description = textElement('div', DBList.topicDescriptions[topic.choices[0].id] ??
                    topic.choices.map(choice => choice.prompt).join(' · '));
                description.className = 'share-topic-description';
                description.id = 'about-' + topic.choices[0].id;
                description.hidden = true;
                help.setAttribute('aria-controls', description.id);
                heading.firstChild.replaceWith(help);
                heading.append(description);
            }
            const cell = row.insertCell();
            row.append(heading);
            if (interactive) {
                heading.id = 'image-topic-' + topic.choices[0].id;
                cell.headers = heading.id;
            }
            if (paired) cell.className = 'image-paired-ratings';

            for (const { value, applicable, short } of topic.choices) {
                const rating = document.createElement('div');
                rating.className = 'image-rating';
                if (applicable === false) {
                    rating.classList.add('image-not-applicable');
                    rating.textContent = 'N/A';
                } else if (value || !ratedOnly) {
                    if (!value) rating.classList.add('image-unanswered');
                    rating.append(ratingIcon(value, 38));
                    if (interactive) {
                        rating.setAttribute('role', 'img');
                        rating.setAttribute('aria-label', [short, ratingLabel(value, group)].filter(Boolean).join(', '));
                    }
                }
                cell.append(rating);
            }
        }
        const panel = document.createElement('div');
        panel.className = 'image-category-panel';
        panel.append(table);

        const column = document.createElement('div');
        column.className = 'image-category-column';
        column.append(panel);
        return column;
    }

    function imageBoard(groups, { interactive, ratedOnly }) {
        const board = document.createElement('div');
        board.className = 'image-board';
        if (!interactive) board.classList.add('image-board-export');
        for (const { id, title, categories } of groups) {
            const group = document.createElement('section');
            group.className = 'image-board-group';
            group.dataset.imageGroup = id;
            const heading = textElement('h3', title);
            heading.className = 'image-group-band';
            group.append(heading);
            const cards = document.createElement('div');
            cards.className = 'image-board-columns';
            if (interactive) {
                // Budget for the caption and direction labels as well as the rating rows.
                const rowCounts = categories.map(({ topics }) => topics.length + 2);
                const rowsPerColumn = Math.max(20, ...rowCounts);
                const totalRows = rowCounts.reduce((sum, count) => sum + count, 0);
                cards.style.setProperty('--share-column-limit', Math.min(4, Math.ceil(totalRows / rowsPerColumn)));
            }
            group.append(cards);
            for (const category of categories) {
                const card = document.createElement('div');
                card.className = 'image-board-card';
                card.append(categoryTable(category, { interactive, ratedOnly }));
                cards.append(card);
            }
            board.append(group);
        }
        return board;
    }

    DBList.createImageSheet = function ({ groups, details, example, ratedOnly, interactive = false }) {
        const sheet = document.createElement('div');
        sheet.className = 'image-sheet';
        if (advancedMode) sheet.classList.add('image-sheet-advanced');
        if (!interactive) sheet.dataset.imageTheme = DBListThemes.savedTheme();
        if (!interactive) sheet.setAttribute('aria-hidden', 'true');
        else sheet.classList.add('share-sheet');

        const legend = document.createElement('ul');
        legend.className = 'image-legend';
        fillRatingKey(legend, 24);

        const brand = textElement('p', example ? 'MyList · Deviant Bound · Example' : 'MyList · Deviant Bound');
        brand.className = 'image-brand';
        const title = document.createElement('div');
        const intro = textElement('p', 'Make your own at ');
        const site = textElement('a', 'kinklist.deviantbound.com');
        site.href = 'https://kinklist.deviantbound.com/';
        intro.append(site);
        intro.className = 'image-intro';
        title.append(brand);
        if (details.length) {
            const profile = document.createElement('ul');
            profile.className = 'image-profile';
            profile.append(...details.map(detail => textElement('li', detail)));
            title.append(profile);
        }
        title.append(intro);
        if (ratedOnly) {
            const scope = textElement('p', 'Unrated selections excluded');
            scope.className = 'image-scope';
            title.append(scope);
        }

        const hasSkippedDirections = groups.some(group => group.categories.some(category =>
            category.topics.some(topic => topic.choices.some(choice => choice.applicable === false))));
        const legendNote = textElement('p', 'Read paired ratings left to right using the labels above the icons. Use the labels under a topic name when provided. In partner preferences, ' +
            'the stop symbol means “' + ratingLabel('limit', 'partner') + '.”' +
            (hasSkippedDirections ? ' N/A marks a direction skipped in question preferences.' : ''));
        legendNote.className = 'image-legend-note';
        const key = document.createElement('div');
        const rubric = textElement('h3', 'Rating rubric');
        rubric.className = 'image-rubric-heading';
        key.append(rubric, legend, legendNote);

        const header = document.createElement('header');
        header.className = 'image-header';
        header.append(title, key);
        sheet.append(header);
        if (groups.length) {
            sheet.append(imageBoard(groups, { interactive, ratedOnly }));
        } else {
            sheet.style.width = '960px';
            sheet.classList.add('image-sheet-narrow');
            const empty = textElement('p', 'No rated topics in this export.');
            empty.className = 'image-empty-note';
            sheet.append(empty);
        }
        return sheet;
    };
})();
