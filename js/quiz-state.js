import { modes } from './questions.js';

export const responseOptions = [
    'Strongly disagree',
    'Disagree',
    'Neither agree nor disagree',
    'Agree',
    'Strongly agree',
];

export const ratingStep = 0.01;

export function isRating(value) {
    return Number.isFinite(value) && value >= 1 && value <= responseOptions.length
        && Number(value.toFixed(2)) === value;
}

export function missedQuestionsMessage(items, responses) {
    const missed = items.filter(({ id }) => !isRating(responses[id])).length;
    return missed ? `You left ${missed} ${missed === 1 ? 'question' : 'questions'} unanswered.` : '';
}

export function newDraft() {
    return { index: 0, responses: {}, completedAt: null };
}

export function normalizeDraft(value, mode) {
    if (!value || typeof value !== 'object') return newDraft();

    const items = modes[mode].items;
    const responses = {};
    for (const { id } of items) {
        const response = value.responses?.[id];
        if (response === null || isRating(response)) responses[id] = response;
    }

    const firstUnfinished = items.findIndex(({ id }) => !Object.hasOwn(responses, id));
    const lastAvailable = firstUnfinished < 0 ? items.length - 1 : firstUnfinished;
    const finished = firstUnfinished === -1 && Number.isSafeInteger(value.completedAt) && value.completedAt > 0;
    const draft = {
        index: Number.isInteger(value.index) ? Math.min(Math.max(value.index, 0), lastAvailable) : 0,
        responses,
        completedAt: finished ? value.completedAt : null,
    };
    if (Number.isSafeInteger(value.updatedAt) && value.updatedAt > 0) draft.updatedAt = value.updatedAt;
    return draft;
}

export function requestedMode() {
    const mode = new URLSearchParams(location.search).get('mode');
    return Object.hasOwn(modes, mode) ? mode : null;
}
