import { mkdir, writeFile } from 'node:fs/promises';
import { modes } from '../js/questions.js';
import { roles } from '../js/roles.js';

const weightsText = weights => Object.entries(weights)
    .map(([role, weight]) => `${roles[role][0]} ${weight > 0 ? '+' : '−'}${Math.abs(weight)}`)
    .join(', ');

function questionsTable(items) {
    return [
        '| ID | Statement | Scoring weights | Reasoning |',
        '| --- | --- | --- | --- |',
        ...items.map(({ id, text, weights, reason }) => `| ${id} | ${text} | ${weightsText(weights)} | ${reason} |`),
    ].join('\n');
}

function coverage(role, items) {
    return items.filter(({ weights }) => Object.hasOwn(weights, role)).map(({ id }) => id).join(', ');
}

const standard = modes.standard.items;
const advanced = modes.advanced.items;
const markdown = [
    '# BDSM Quiz question bank',
    '',
    'Rate each statement on a 1–5 agreement scale. Assume that everyone involved is an adult who freely agrees and can stop at any time.',
    '',
    '| Rating | Meaning |',
    '| --- | --- |',
    '| 1 | Strongly disagree |',
    '| 2 | Disagree |',
    '| 3 | Neither agree nor disagree |',
    '| 4 | Agree |',
    '| 5 | Strongly agree |',
    '',
    '## Scoring',
    '',
    '- **+3** is a direct question about the category.',
    '- **+2** is a distinct context, behavior, or follow-up for the category.',
    '- **+1** is a supporting signal from a question primarily about a closely related category.',
    '- **−2** is a reverse-scored follow-up. A rating of 5 is treated as 1 for that category, and a rating of 1 is treated as 5.',
    '',
    'For each category, convert a positive item to `(rating − 1) / 4` or a reverse item to `(5 − rating) / 4`. Compute the weighted average of those values using the absolute item weights, multiply by 100, and round once at the end. For example, ratings of 5 on a +3 item and 3 on a +2 item produce `100 × (3 × 1 + 2 × 0.5) / 5 = 80%`.',
    '',
    'Skipped items are excluded from both the numerator and the denominator. A category with no rated items shows **Unrated**. The report displays the number of rated items contributing to each score. Categories are scored independently, so a person can score high on both Dominant and Submissive. Switch measures explicit interest in changing roles.',
    '',
    'Advanced mode asks all 30 standard items and adds 39 follow-ups. Each category receives at least one added item. The extra items sample more contexts and help distinguish related interests. The weights and scores are unvalidated design judgments.',
    '',
    '## Standard mode · Q01–Q30',
    '',
    questionsTable(standard),
    '',
    '## Advanced mode additions · Q31–Q69',
    '',
    questionsTable(advanced.slice(standard.length)),
    '',
    '## Coverage by category',
    '',
    '| Category | Standard items | Advanced additions |',
    '| --- | --- | --- |',
    ...Object.entries(roles).map(([id, [label]]) => `| ${label} | ${coverage(id, standard)} | ${coverage(id, advanced.slice(standard.length))} |`),
    '',
    'The questionnaire source is `js/questions.js`. Run `npm run questions` after editing the item bank to regenerate this reference.',
    '',
].join('\n');

const docs = new URL('../docs/', import.meta.url);
await mkdir(docs, { recursive: true });
await writeFile(new URL('question-bank.md', docs), markdown);
