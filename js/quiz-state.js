import { modes } from './questions.js';

export const responseOptions = [
    'Strongly disagree',
    'Disagree',
    'Neither agree nor disagree',
    'Agree',
    'Strongly agree',
];

export function isRating(value) {
    return Number.isInteger(value) && value >= 1 && value <= responseOptions.length;
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
    return {
        index: Number.isInteger(value.index) ? Math.min(Math.max(value.index, 0), lastAvailable) : 0,
        responses,
        completedAt: finished ? value.completedAt : null,
    };
}

export function requestedMode() {
    const mode = new URLSearchParams(location.search).get('mode');
    return Object.hasOwn(modes, mode) ? mode : null;
}
