import { modes } from './questions.js';
import {
    isRating, missedQuestionsMessage, newDraft, normalizeDraft, ratingStep, requestedMode, responseOptions,
} from './quiz-state.js';
import { scoreQuiz } from './scoring.js';
import { renderScores } from './score-list.js';
import {
    clearDraft, defaultProfile, isAgeSelectionChange, isDefaultDraftChange, loadAgeSelection, loadDraft, saveAgeSelection, saveDraft,
} from './session.js';
import { activeProfile, downloadProfileBackup, isProfileChange } from './profile-store.js';
import { localResultLink } from './result-links.js';
import { encodeResults } from './shared-results.js';

const gate = document.querySelector('#age-gate');
const ageStatus = document.querySelector('#age-status');
const ageActions = document.querySelector('#age-actions');
const acceptAge = document.querySelector('#accept-age');
const declineAge = document.querySelector('#decline-age');
const picker = document.querySelector('#mode-picker');
const modeButtons = picker.querySelectorAll('[data-mode]');
const quiz = document.querySelector('#quiz');
const form = document.querySelector('#response-form');
const questionList = document.querySelector('#question-list');
const pageSize = 5;
const progress = document.querySelector('#progress');
const progressLabel = document.querySelector('#progress-label');
const pageList = document.querySelector('#quiz-pages');
const next = document.querySelector('#next');
const storageStatus = document.querySelector('#storage-status');
const reset = document.querySelector('#reset-dialog');
const localReport = document.querySelector('#local-report');
const profileContext = document.querySelector('#quiz-profile');

let ageSelection;
let profile = activeProfile();
let mode = null;
let storageScope = 'local';
const drafts = new Map();

function getDraft(key) {
    if (!drafts.has(key)) drafts.set(key, loadDraft(key, profile?.id));
    return drafts.get(key);
}

function persistDraft(draft) {
    draft.updatedAt = Date.now();
    const saved = saveDraft(mode, draft, profile?.id);
    if (saved && profile) profile.drafts[mode] = normalizeDraft(draft, mode);
    return saved;
}

function showStorageState(scope = storageScope) {
    storageScope = scope;
    storageStatus.textContent = scope === 'local' ? '' : scope === 'session'
        ? 'Progress is saved for this tab. Keep it open to finish the quiz.'
        : 'Browser storage is unavailable. Keep this page open to finish the quiz.';
}

function renderProgress(draft, items) {
    const isAnswered = ({ id }) => isRating(draft.responses[id]);
    const allAnswered = items.every(isAnswered);
    let total = 0;
    let available = true;
    for (let page = 0; page < pageList.children.length; page += 1) {
        const start = page * pageSize;
        const questions = items.slice(start, start + pageSize);
        const recorded = questions.filter(({ id }) => Object.hasOwn(draft.responses, id)).length;
        const answered = questions.filter(isAnswered).length;
        let status = recorded ? 'unanswered' : 'not started';
        let marker = '•';
        if (allAnswered) {
            status = 'complete';
            marker = '✓';
        } else if (answered === questions.length) {
            status = 'all questions answered';
            marker = '●';
        } else if (answered) {
            status = 'in progress';
            marker = '◐';
        }
        const button = pageList.children[page].firstElementChild;
        button.dataset.status = status;
        button.setAttribute('aria-label', `Page ${page + 1}, ${status}`);
        button.disabled = !available;
        button.lastElementChild.textContent = marker;
        available &&= recorded === questions.length;
        total += recorded;
    }
    progress.value = total;
}

function renderPagination(draft, itemCount, currentStart) {
    const pages = [];
    for (let start = 0; start < itemCount; start += pageSize) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = String(start / pageSize + 1);
        const marker = document.createElement('span');
        marker.className = 'quiz-page-status';
        marker.setAttribute('aria-hidden', 'true');
        button.append(marker);
        if (start === currentStart) button.setAttribute('aria-current', 'page');
        else button.addEventListener('click', () => goToPage(draft, start));
        item.append(button);
        pages.push(item);
    }
    pageList.replaceChildren(...pages);
}

function goToPage(draft, index) {
    draft.index = index;
    showStorageState(persistDraft(draft));
    showStep(true);
}

function questionControl(item, index, draft) {
    const row = document.createElement('div');
    row.className = 'question-row';
    const heading = document.createElement('label');
    heading.className = 'question-prompt';
    const number = document.createElement('span');
    number.className = 'question-number';
    number.textContent = `${index + 1}. `;
    const statement = document.createElement('span');
    statement.textContent = item.text;
    heading.append(number, statement);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `rating-${item.id}`;
    slider.min = '1';
    slider.max = '5';
    slider.step = String(ratingStep);
    heading.htmlFor = slider.id;

    function updateDisplay(rating) {
        slider.style.setProperty('--rating-position', (slider.valueAsNumber - 1) / 4);
        slider.classList.toggle('unrated', rating == null);
        const label = responseOptions[Math.round(rating) - 1];
        slider.setAttribute('aria-valuetext', rating == null
            ? 'Unrated. Press Space to select neutral, or use arrow keys to adjust.'
            : `${rating}, ${label}. Press Delete to return to unrated.`);
    }

    function saveRating(rating) {
        slider.value = String(rating ?? 3);
        updateDisplay(rating);
        if (draft.responses[item.id] === rating) return;
        draft.responses[item.id] = rating;
        draft.completedAt = null;
        renderProgress(draft, modes[mode].items);
        showStorageState(persistDraft(draft));
    }

    slider.value = String(draft.responses[item.id] ?? 3);
    updateDisplay(draft.responses[item.id]);
    const commitRating = () => saveRating(slider.valueAsNumber);
    slider.addEventListener('input', commitRating);
    slider.addEventListener('change', commitRating);
    slider.addEventListener('click', commitRating);
    slider.addEventListener('keydown', event => {
        if (event.key === 'Delete') {
            event.preventDefault();
            if (draft.responses[item.id] != null) saveRating(null);
            return;
        }
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        commitRating();
    });

    const track = document.createElement('div');
    track.className = 'rating-track';
    const scale = document.createElement('div');
    scale.className = 'rating-scale';
    for (const label of ['Disagree', 'Neutral', 'Agree']) {
        const tick = document.createElement('span');
        tick.textContent = label;
        scale.append(tick);
    }
    track.append(slider, scale);
    row.append(heading, track);
    return row;
}

function showStep(moveFocus = false) {
    const { items, label } = modes[mode];
    const draft = getDraft(mode);
    const start = Math.floor(draft.index / pageSize) * pageSize;
    const end = Math.min(start + pageSize, items.length);
    const heading = document.querySelector('#quiz-heading');
    heading.textContent = label;
    progressLabel.textContent = `Questions ${start + 1}–${end} of ${items.length}`;
    progress.max = items.length;
    renderPagination(draft, items.length, start);
    renderProgress(draft, items);
    questionList.replaceChildren(...items.slice(start, end).map((item, i) => questionControl(item, start + i, draft)));
    next.textContent = end === items.length ? 'See results' : 'Next page';
    if (moveFocus) heading.focus();
}

function showAgeSelection(moveFocus = false) {
    ageSelection = loadAgeSelection();
    const accepted = ageSelection === 'yes';
    const declined = ageSelection === 'no';
    gate.hidden = accepted;
    picker.hidden = !accepted || Boolean(mode);
    quiz.hidden = !accepted || !mode;
    profileContext.hidden = !accepted || !profile;
    profileContext.firstElementChild.textContent = profile ? `Active profile · ${profile.name}` : '';
    localReport.hidden = true;
    if (!accepted && reset.open) reset.close();
    ageActions.hidden = declined;
    document.querySelector('#age-intro').hidden = declined;
    ageStatus.textContent = declined ? 'You must be 18 or older to continue.' : '';

    if (accepted && mode) {
        showStep(moveFocus);
        showStorageState();
    } else if (accepted) {
        for (const button of modeButtons) {
            const key = button.dataset.mode;
            const draft = getDraft(key);
            const action = Object.keys(draft.responses).length ? 'Resume' : 'Start';
            button.textContent = `${action} ${modes[key].label}`;
        }
        if (moveFocus) document.querySelector('#mode-heading').focus();
    } else if (declined && moveFocus) {
        ageStatus.focus();
    }
}

function chooseAge(value) {
    saveAgeSelection(value);
    showAgeSelection(true);
}

function setMode(value) {
    mode = value;
    const url = new URL(location.href);
    if (value) url.searchParams.set('mode', value);
    else url.searchParams.delete('mode');
    history.replaceState(value ? null : { choosingMode: true }, '', url);
}

function chooseMode(value) {
    setMode(value);
    showAgeSelection(true);
}

function restoreMode() {
    mode = requestedMode();
    if (mode || history.state?.choosingMode) return;

    const latest = Object.keys(modes)
        .map(key => ({ key, draft: getDraft(key) }))
        .filter(({ draft }) => !draft.completedAt && Object.keys(draft.responses).length)
        .sort((a, b) => (b.draft.updatedAt ?? 0) - (a.draft.updatedAt ?? 0))[0];
    if (latest) setMode(latest.key);
}

function advance() {
    const draft = getDraft(mode);
    const { items } = modes[mode];
    const start = Math.floor(draft.index / pageSize) * pageSize;
    const end = Math.min(start + pageSize, items.length);
    for (const { id } of items.slice(start, end)) draft.responses[id] ??= null;
    if (end < items.length) {
        goToPage(draft, end);
        return;
    }

    draft.completedAt = Date.now();
    const scope = persistDraft(draft);
    if (scope === 'local') {
        location.assign(localResultLink(mode, profile?.id));
        return;
    }
    showStorageState(scope);
    const scores = scoreQuiz(items, draft.responses);
    renderScores(document.querySelector('#local-scores'), scores);
    document.querySelector('#local-share-result').href = `results.html${encodeResults(scores)}`;
    document.querySelector('#local-backup-status').textContent = '';
    const missed = document.querySelector('#local-missed-questions');
    missed.textContent = missedQuestionsMessage(items, draft.responses);
    missed.hidden = !missed.textContent;
    quiz.hidden = true;
    localReport.hidden = false;
    document.querySelector('#local-report-heading').focus();
}

acceptAge.disabled = false;
declineAge.disabled = false;
acceptAge.addEventListener('click', () => chooseAge('yes'));
declineAge.addEventListener('click', () => chooseAge('no'));
for (const button of modeButtons) button.addEventListener('click', () => chooseMode(button.dataset.mode));
document.querySelector('#change-mode').addEventListener('click', () => chooseMode(null));
document.querySelector('#return-to-quiz').addEventListener('click', () => showAgeSelection(true));
document.querySelector('#save-local-backup').addEventListener('click', () => {
    const backup = profile ?? defaultProfile();
    const status = document.querySelector('#local-backup-status');
    try {
        downloadProfileBackup({ ...backup, drafts: { ...backup.drafts, ...Object.fromEntries(drafts) } });
        status.textContent = 'Backup download started.';
    } catch {
        status.textContent = 'Could not download the backup. Try again.';
    }
});

form.addEventListener('submit', event => {
    event.preventDefault();
    advance();
});

document.querySelector('#open-reset').addEventListener('click', () => {
    reset.returnValue = '';
    document.querySelector('#reset-description').textContent =
        `This clears the ${modes[mode].label} answers and result for ${profile?.name ?? 'Default'}.`;
    reset.showModal();
});
reset.addEventListener('close', () => {
    if (reset.returnValue !== 'reset' || profile?.id !== activeProfile()?.id) return;
    const draft = newDraft();
    drafts.set(mode, draft);
    showStorageState(profile ? persistDraft(draft) : clearDraft(mode));
    showStep(true);
});

window.addEventListener('storage', event => {
    if (isAgeSelectionChange(event.key)) {
        if (loadAgeSelection() !== ageSelection) showAgeSelection();
        return;
    }
    const defaultChanged = !profile && isDefaultDraftChange(event.key);
    if (!defaultChanged && !isProfileChange(event.key, profile?.id)) return;
    const current = activeProfile();
    const switched = profile?.id !== current?.id;
    const updatedDrafts = !switched && current && JSON.stringify(profile.drafts) !== JSON.stringify(current.drafts);
    const renamed = !switched && profile?.name !== current?.name;
    profile = current;
    if (switched && reset.open) reset.close();
    if (switched || updatedDrafts || defaultChanged) {
        drafts.clear();
        storageScope = 'local';
        showAgeSelection();
    } else if (renamed) {
        profileContext.firstElementChild.textContent = `Active profile · ${profile.name}`;
    }
});

window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const current = activeProfile();
    if (storageScope !== 'local' && profile?.id === current?.id) {
        if (loadAgeSelection() !== ageSelection) showAgeSelection();
        return;
    }
    profile = current;
    drafts.clear();
    storageScope = 'local';
    restoreMode();
    showAgeSelection();
});

restoreMode();
showAgeSelection();
