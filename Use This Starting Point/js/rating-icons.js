(function () {
    'use strict';

    const namespace = 'http://www.w3.org/2000/svg';
    const symbols = {
        favorite: { path: 'M12 2.5 15 8.6 21.7 9.6 16.9 14.3 18 21 12 17.8 6 21 7.1 14.3 2.3 9.6 9 8.6Z', fill: '#ffcc35', strokeWidth: '1.35' },
        like: { path: 'M12 20.5 4.4 12.9a5.3 5.3 0 0 1 7.5-7.5L12 5.5l.1-.1a5.3 5.3 0 0 1 7.5 7.5Z' },
        'willing-to-try': { path: 'M5 12l4.5 4.5L19 7' },
        maybe: { path: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.1-1.5 2.4 M12 17.5h.01' },
        'not-interested': { path: 'M6 6l12 12 M18 6 6 18' },
        limit: { path: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z M5 19 19 5' },
        '': { path: 'M7 12h10' },
    };

    function ratingIcon(value, size = 24) {
        const { path, fill = 'none', strokeWidth = '2.1' } = symbols[value];
        const icon = document.createElementNS(namespace, 'svg');
        icon.setAttribute('class', 'rating-icon');
        icon.dataset.value = value;
        icon.setAttribute('width', size);
        icon.setAttribute('height', size);
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        const shape = document.createElementNS(namespace, 'path');
        shape.setAttribute('d', path);
        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', 'currentColor');
        shape.setAttribute('stroke-width', strokeWidth);
        shape.setAttribute('stroke-linecap', 'round');
        shape.setAttribute('stroke-linejoin', 'round');
        icon.append(shape);
        return icon;
    }

    function fillRatingKey(list, size, options = DBList.ratingOptions) {
        for (const [value, label] of options) {
            const item = document.createElement('li');
            item.append(ratingIcon(value, size), label);
            list.append(item);
        }
    }

    function fantasyLabel() {
        const label = document.createElement('small');
        label.className = 'fantasy-label';
        label.textContent = ' Fantasy';
        return label;
    }

    const discussionIndex = DBList.ratingOptions.findIndex(([value]) => value === 'maybe');
    const checklistRatingOptions = [
        ...DBList.ratingOptions.slice(0, discussionIndex), DBList.ratingOptions.at(-1), ...DBList.ratingOptions.slice(discussionIndex, -1),
    ];

    function createRatingField({ id, prompt, short }, group, { nativeTooltips = false } = {}) {
        const field = document.createElement('div');
        field.className = 'rating-field';
        field.id = 'prompt-' + id;
        field.setAttribute('role', 'radiogroup');
        field.setAttribute('aria-label', prompt);
        if (short) {
            const caption = document.createElement('p');
            caption.className = 'rating-direction';
            caption.textContent = short;
            if (nativeTooltips) caption.title = prompt;
            else caption.dataset.tooltip = prompt;
            field.append(caption);
        }

        const choices = document.createElement('div');
        choices.className = 'rating-choices';
        for (const [value] of checklistRatingOptions) {
            const label = document.createElement('label');
            label.className = value ? 'rating-choice' : 'rating-choice rating-choice-blank';
            const name = DBList.ratingLabel(value, group);
            if (nativeTooltips) label.title = name;
            else label.dataset.tooltip = name;
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = id;
            radio.value = value;
            radio.checked = value === '';
            radio.setAttribute('aria-label', name);
            const tile = document.createElement('span');
            tile.className = 'rating-tile';
            tile.append(ratingIcon(value));
            label.append(radio, tile);
            choices.append(label);
        }
        field.append(choices);
        return field;
    }

    Object.assign(DBList, { ratingIcon, fillRatingKey, fantasyLabel, checklistRatingOptions, createRatingField });
})();
