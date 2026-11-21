import { modes } from './questions.js';
import { newDraft, normalizeDraft, requestedMode, responseOptions } from './quiz-state.js';
import { scoreQuiz } from './scoring.js';
import { renderScores } from './score-list.js';
import { clearDraft, loadAgeSelection, loadDraft, saveAgeSelection, saveDraft } from './session.js';
import { activeProfile, isProfileChange } from './profile-store.js';

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
const back = document.querySelector('#previous');
const next = document.querySelector('#next');
const storageStatus = document.querySelector('#storage-status');
const reset = document.querySelector('#reset-dialog');
const localReport = document.querySelector('#local-report');
const profileContext = document.querySelector('#quiz-profile');

let ageSelection = loadAgeSelection();
let profile = activeProfile();
let mode = requestedMode();
let storageAvailable = true;
const drafts = new Map();


function getDraft(key) {
    if (!drafts.has(key)) drafts.set(key, loadDraft(key, profile?.id));
    return drafts.get(key);
}

function persistDraft(draft) {
    const saved = saveDraft(mode, draft, profile?.id);
    if (saved && profile) profile.drafts[mode] = normalizeDraft(draft, mode);
    return saved;
}

function showStorageState(saved) {
    storageAvailable &&= saved;
    storageStatus.textContent = storageAvailable
        ? ''
        : 'Browser storage is unavailable. Keep this page open to finish the quiz.';
}

function renderProgress(draft, items) {
    progress.value = items.filter(({ id }) => Object.hasOwn(draft.responses, id)).length;
}

function questionControl(item, index, draft) {
    const row = document.createElement('fieldset');
    row.className = 'question-row';
    const heading = document.createElement('legend');
    heading.textContent = `${index + 1}. ${item.text}`;
    heading.id = `heading-${item.id}`;
    const controls = document.createElement('div');
    controls.className = 'rating-controls';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `rating-${item.id}`;
    slider.min = '1';
    slider.max = '5';
    slider.step = '1';
    slider.setAttribute('aria-labelledby', heading.id);

    const output = document.createElement('output');
    output.htmlFor = slider.id;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'text-button clear-rating';
    clear.textContent = 'Clear';
    clear.setAttribute('aria-label', `Clear rating for question ${index + 1}`);

    function update(rating) {
        slider.value = String(rating ?? 3);
        slider.style.setProperty('--rating-fill', `${(Number(slider.value) - 1) * 25}%`);
        slider.classList.toggle('unrated', rating == null);
        output.textContent = rating == null ? 'Unrated' : `${rating} · ${responseOptions[rating - 1]}`;
        slider.setAttribute('aria-valuetext', rating == null ? 'Unrated. Press Space to select 3, or use arrow keys to adjust.' : output.textContent);
        clear.hidden = rating == null;
    }

    function saveRating(rating) {
        if (draft.responses[item.id] === rating) return;
        draft.responses[item.id] = rating;
        draft.completedAt = null;
        update(rating);
        renderProgress(draft, modes[mode].items);
        showStorageState(persistDraft(draft));
    }

    update(draft.responses[item.id]);
    const select = () => saveRating(Number(slider.value));
    slider.addEventListener('input', select);
    slider.addEventListener('click', select);
    slider.addEventListener('keydown', event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        select();
    });
    clear.addEventListener('click', () => {
        saveRating(null);
        slider.focus();
    });

    const track = document.createElement('div');
    track.className = 'rating-track';
    const scale = document.createElement('div');
    scale.className = 'rating-scale';
    for (const label of ['1 · Disagree', '3 · Neutral', '5 · Agree']) {
        const tick = document.createElement('span');
        tick.textContent = label;
        scale.append(tick);
    }
    track.append(slider, scale);
    controls.append(output, clear, track);
    row.append(heading, controls);
    return row;
}

function showStep(moveFocus = false) {
    const { items, label } = modes[mode];
    const draft = getDraft(mode);
    const start = Math.floor(draft.index / pageSize) * pageSize;
    const end = Math.min(start + pageSize, items.length);
    document.querySelector('#quiz-heading').textContent = `${label} quiz`;
    progressLabel.textContent = `Questions ${start + 1}–${end} of ${items.length}`;
    progressLabel.tabIndex = -1;
    progress.max = items.length;
    renderProgress(draft, items);
    questionList.replaceChildren(...items.slice(start, end).map((item, i) => questionControl(item, start + i, draft)));
    back.disabled = start === 0;
    next.textContent = end === items.length ? 'See results' : 'Next page';
    if (moveFocus) progressLabel.focus();
}

function showAgeSelection(moveFocus = false) {
    const accepted = ageSelection === 'yes';
    const declined = ageSelection === 'no';
    gate.hidden = accepted;
    picker.hidden = !accepted || Boolean(mode);
    quiz.hidden = !accepted || !mode;
    profileContext.hidden = !accepted || !profile;
    profileContext.firstElementChild.textContent = profile ? `Active profile · ${profile.name}` : '';
    localReport.hidden = true;
    ageActions.hidden = declined;
    document.querySelector('#age-intro').hidden = declined;
    ageStatus.textContent = declined ? 'You must be 18 or older to continue.' : '';

    if (accepted && mode) {
        showStep(moveFocus);
        showStorageState(true);
    } else if (accepted) {
        for (const button of modeButtons) {
            const key = button.dataset.mode;
            const draft = getDraft(key);
            const action = Object.keys(draft.responses).length ? 'Resume' : 'Start';
            button.textContent = `${action} ${modes[key].label.toLowerCase()} quiz`;
        }
        if (moveFocus) document.querySelector('#mode-heading').focus();
    } else if (declined && moveFocus) {
        ageStatus.focus();
    }
}

function chooseAge(value) {
    ageSelection = value;
    showStorageState(saveAgeSelection(value));
    showAgeSelection(true);
}

function chooseMode(value) {
    mode = value;
    const url = new URL(location.href);
    if (value) url.searchParams.set('mode', value);
    else url.searchParams.delete('mode');
    history.replaceState(null, '', url);
    showAgeSelection(true);
}

function advance() {
    const draft = getDraft(mode);
    const { items } = modes[mode];
    const start = Math.floor(draft.index / pageSize) * pageSize;
    const end = Math.min(start + pageSize, items.length);
    for (const { id } of items.slice(start, end)) draft.responses[id] ??= null;
    if (end < items.length) {
        draft.index = end;
        showStorageState(persistDraft(draft));
        showStep(true);
        return;
    }

    draft.completedAt = Date.now();
    if (persistDraft(draft) && loadAgeSelection() === 'yes' && profile?.id === activeProfile()?.id) {
        location.assign(`results.html?mode=${mode}`);
        return;
    }
    showStorageState(false);
    renderScores(document.querySelector('#local-scores'), scoreQuiz(items, draft.responses));
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

form.addEventListener('submit', event => {
    event.preventDefault();
    advance();
});
back.addEventListener('click', () => {
    const draft = getDraft(mode);
    draft.index = Math.max(0, (Math.floor(draft.index / pageSize) - 1) * pageSize);
    showStorageState(persistDraft(draft));
    showStep(true);
});

document.querySelector('#open-reset').addEventListener('click', () => {
    reset.returnValue = '';
    document.querySelector('#reset-description').textContent = profile
        ? `This clears the ${modes[mode].label.toLowerCase()} answers and result for ${profile.name}.`
        : 'This clears the answers and result for the current mode in this tab.';
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
    if (!isProfileChange(event.key, profile?.id)) return;
    const current = activeProfile();
    const switched = profile?.id !== current?.id;
    const updatedDrafts = !switched && current && JSON.stringify(profile.drafts) !== JSON.stringify(current.drafts);
    const renamed = !switched && profile?.name !== current?.name;
    profile = current;
    if (switched && reset.open) reset.close();
    if (switched || updatedDrafts) {
        drafts.clear();
        storageAvailable = true;
        showAgeSelection();
    } else if (renamed) {
        profileContext.firstElementChild.textContent = `Active profile · ${profile.name}`;
    }
});

window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const current = activeProfile();
    if (!storageAvailable && profile?.id === current?.id) return;
    profile = current;
    ageSelection = loadAgeSelection();
    mode = requestedMode();
    drafts.clear();
    storageAvailable = true;
    showAgeSelection();
});

showAgeSelection();
