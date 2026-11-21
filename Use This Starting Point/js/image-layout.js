(function () {
    'use strict';

    const targetAspect = 2.4;
    const rowBudgets = [30, 26, 22, 18, 14];
    const cardWidth = 350;
    const minSheetWidths = [720, 900, 1150];

    function measureCard(element) {
        const body = element.querySelector('tbody');
        const rows = [...body.rows];
        const height = element.getBoundingClientRect().height;
        return {
            element,
            rows,
            height,
            captionHeight: Math.ceil(height - body.getBoundingClientRect().height),
            rowHeights: rows.map(row => row.getBoundingClientRect().height),
        };
    }

    function planCard(card, heightLimit) {
        if (card.height <= heightLimit) return [{ card, height: card.height }];

        const parts = [];
        for (let start = 0; start < card.rows.length;) {
            let end = start + 1;
            let height = card.captionHeight + card.rowHeights[start];
            while (end < card.rows.length && height + card.rowHeights[end] <= heightLimit) {
                height += card.rowHeights[end];
                end++;
            }
            parts.push({ card, start, end, height });
            start = end;
        }
        return parts;
    }

    function packColumns(cards, heightLimit, gap) {
        const plans = new Array(cards.length + 1);
        plans[cards.length] = { columns: 0, height: 0 };

        // Keep reading order while minimizing column count, then balance their heights.
        for (let start = cards.length - 1; start >= 0; start--) {
            let height = 0;
            for (let end = start; end < cards.length; end++) {
                height += Math.ceil(cards[end].height) + (end === start ? 0 : gap);
                if (end > start && height > heightLimit) break;
                const tail = plans[end + 1];
                const plan = { next: end + 1, columns: tail.columns + 1, height: Math.max(height, tail.height) };
                const best = plans[start];
                if (!best || plan.columns < best.columns ||
                    (plan.columns === best.columns && plan.height <= best.height)) {
                    plans[start] = plan;
                }
            }
        }

        const columns = [];
        for (let start = 0; start < cards.length; start = plans[start].next) {
            columns.push(cards.slice(start, plans[start].next));
        }
        return { columns, height: plans[0].height };
    }

    function planGroup(group, heightLimit, cardGap) {
        const availableHeight = heightLimit - group.overhead;
        const cards = group.cards.flatMap(card => planCard(card, availableHeight));
        const { columns, height } = packColumns(cards, availableHeight, cardGap);
        return {
            group, columns,
            width: columns.length * cardWidth + (columns.length - 1) * cardGap + group.padding,
            height: height + group.overhead,
        };
    }

    function measureBands(bands, gap) {
        return {
            bands,
            width: Math.max(...bands.map(band =>
                band.reduce((sum, group) => sum + group.width, 0) + (band.length - 1) * gap)),
            height: bands.reduce((sum, band) => sum + Math.max(...band.map(group => group.height)), 0) +
                (bands.length - 1) * gap,
        };
    }

    function* arrangeBands(groups, gap) {
        const sensation = groups.findIndex(({ group }) => group.element.dataset.imageGroup === 'sensation-impact');
        const companions = ['body-fluids', 'partner-preferences', 'relationships-communication'];
        if (sensation >= 0 && groups.slice(sensation + 1).some(({ group }) =>
            companions.includes(group.element.dataset.imageGroup))) {
            const bands = sensation > 0 ? [groups.slice(0, sensation), groups.slice(sensation)] : [groups];
            yield measureBands(bands, gap);
            return;
        }

        yield measureBands([groups], gap);
        for (let split = 1; split < groups.length; split++) {
            yield measureBands([groups.slice(0, split), groups.slice(split)], gap);
        }
    }

    function placeBand(groups) {
        const band = document.createElement('div');
        band.className = 'image-board-band';
        for (const { group, columns, width } of groups) {
            const stacks = columns.map(parts => {
                const column = document.createElement('div');
                column.className = 'image-board-column';
                for (const { card, start, end } of parts) {
                    const element = start ? card.element.cloneNode(true) : card.element;
                    if (end !== undefined) {
                        const body = element.querySelector('tbody');
                        body.classList.toggle('image-stripes-reversed', start % 2 === 1);
                        body.replaceChildren(...card.rows.slice(start, end));
                    }
                    column.append(element);
                }
                return column;
            });
            group.container.replaceChildren(...stacks);
            group.container.style.setProperty('--image-column-count', columns.length);
            group.element.style.flexBasis = width + 'px';
            group.element.style.flexGrow = columns.length;
            band.append(group.element);
        }
        return band;
    }

    function resizeSheet(sheet, width) {
        sheet.style.width = width + 'px';
        sheet.style.left = -width + 'px';
        sheet.classList.toggle('image-sheet-narrow', width <= 1100);
    }

    DBList.layoutImageSheet = function (sheet) {
        const board = sheet.querySelector('.image-board-export');
        if (!board) return;

        const sheetStyles = getComputedStyle(sheet);
        const sheetPadding = parseFloat(sheetStyles.paddingLeft) + parseFloat(sheetStyles.paddingRight);
        const boardStyles = getComputedStyle(board);
        const gap = parseFloat(boardStyles.columnGap);
        const cardGap = parseFloat(boardStyles.getPropertyValue('--image-card-gap'));
        const headingGap = parseFloat(boardStyles.getPropertyValue('--image-heading-gap'));
        const rowHeight = parseFloat(boardStyles.getPropertyValue('--image-row-height'));
        board.style.setProperty('--image-card-width', cardWidth + 'px');

        const groups = [...board.children].map(element => {
            const heading = element.querySelector('.image-group-band');
            const container = element.querySelector('.image-board-columns');
            const styles = getComputedStyle(element);
            return {
                element, container,
                overhead: headingGap + Math.ceil(heading.getBoundingClientRect().height) +
                    parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom),
                padding: parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight),
                cards: [...container.children].map(measureCard),
            };
        });

        const headerHeights = new Map();
        let best;
        for (const rows of rowBudgets) {
            const planned = groups.map(group => planGroup(group, rows * rowHeight, cardGap));
            const area = planned.reduce((sum, group) => sum + group.width * group.height, 0);
            for (const layout of arrangeBands(planned, gap)) {
                const widths = new Set(minSheetWidths.map(minimum => Math.max(minimum, layout.width + sheetPadding)));
                for (const width of widths) {
                    if (!headerHeights.has(width)) {
                        resizeSheet(sheet, width);
                        headerHeights.set(width, sheet.offsetHeight - board.offsetHeight);
                    }
                    const height = layout.height + headerHeights.get(width);
                    const aspectError = Math.abs(Math.log(width / height / targetAspect));
                    const unused = 1 - area / ((width - sheetPadding) * layout.height);
                    const score = aspectError + .35 * unused + .15 * (1 - rows / rowBudgets[0]);
                    if (!best || score < best.score) best = { ...layout, width, score };
                }
            }
        }

        resizeSheet(sheet, best.width);
        board.classList.add('image-board-packed');
        board.replaceChildren(...best.bands.map(placeBand));
    };
})();
