import { modes } from './questions.js';
import { isRating, requestedMode } from './quiz-state.js';
import { sampleScores } from './sample-report.js';
import { scoreQuiz } from './scoring.js';
import { renderScores } from './score-list.js';
import { loadAgeSelection, loadDraft, saveAgeSelection } from './session.js';
import { activeProfile, isProfileChange } from './profile-store.js';

const statistics = document.querySelector('#statistics-dialog');
const statisticsList = document.querySelector('#statistics-list');
const details = document.querySelector('#details-dialog');
const share = document.querySelector('#share-dialog');
const shareLink = document.querySelector('#share-link');
const shareStatus = document.querySelector('#share-status');
const quizLink = document.querySelector('#quiz-link');
const scoreList = document.querySelector('#result-scores');
const resultGate = document.querySelector('#saved-result-gate');
const resultHeading = document.querySelector('#results-heading');

shareLink.value = new URL('results.html#preview', location.href).href;

function finishedQuiz(profile) {
    if (location.hash === '#preview') return null;
    const selected = requestedMode();
    const candidates = selected ? [selected] : Object.keys(modes);
    return candidates.map(mode => ({ mode, ...(profile?.drafts[mode] ?? loadDraft(mode)) }))
        .filter(draft => draft.completedAt)
        .sort((a, b) => b.completedAt - a.completedAt)[0] ?? null;
}

function displayDetails(entry) {
    document.querySelector('#detail-title').textContent = entry.role;
    document.querySelector('#detail-text').textContent = entry.description;
    const coverage = document.querySelector('#detail-coverage');
    coverage.hidden = entry.total === undefined;
    coverage.textContent = coverage.hidden ? '' : `${entry.answered} of ${entry.total} contributing questions rated.`;
    details.showModal();
}

function refreshResults() {
    const profile = activeProfile();
    const age = loadAgeSelection();
    const candidate = age === 'yes' || (age === null && profile) ? finishedQuiz(profile) : null;
    const completed = age === 'yes' ? candidate : null;
    resultGate.hidden = age !== null || !candidate;
    const settings = completed ? modes[completed.mode] : null;
    const scores = settings ? scoreQuiz(settings.items, completed.responses) : sampleScores;

    const heading = completed ? 'Your results' : 'Results preview';
    document.title = `${heading} · Deviant Bound`;
    resultHeading.textContent = heading;
    document.querySelector('#result-intro').textContent = completed
        ? `${profile ? `Active profile · ${profile.name}. ` : ''}Open More info to see how many questions contributed to each score.`
        : 'This example profile shows how role scores will appear.';
    document.querySelector('#report-heading').textContent = completed ? `${settings.label} quiz` : 'Example profile';
    const profileLine = document.querySelector('#report-profile');
    const { displayName, age: profileAge, role } = completed && profile ? profile.details : {};
    profileLine.textContent = [displayName, profileAge ? `Age ${profileAge}` : '', role].filter(Boolean).join(' · ');
    profileLine.hidden = !profileLine.textContent;
    document.querySelector('#report-note').textContent = completed
        ? `${settings.items.length} questions · Weighted agreement`
        : 'Illustrative scores';
    document.querySelector('#statistics-title').textContent = completed ? 'Quiz statistics' : 'Preview statistics';
    document.querySelector('#share-description').textContent = completed
        ? 'Print or save a PDF of your scores. The share link opens the example profile.'
        : 'The share link opens the example profile.';
    quizLink.href = completed ? `quiz.html?mode=${completed.mode}` : 'quiz.html';
    quizLink.textContent = completed ? 'Review answers' : 'Take the quiz';
    document.querySelector('#save-guest-result').hidden = !completed || Boolean(profile);
    scoreList.setAttribute('aria-label', completed ? 'Your quiz scores' : 'Example role scores');
    renderScores(scoreList, scores, displayDetails);

    const rated = scores.filter(entry => entry.score !== null);
    const high = rated.length ? `${Math.max(...rated.map(entry => entry.score))}%` : 'Unrated';
    const metrics = completed
        ? [
            ['Questions answered', Object.values(completed.responses).filter(isRating).length],
            ['Questions skipped', Object.values(completed.responses).filter(value => value === null).length],
            ['Categories scored', `${rated.length} of ${scores.length}`],
            ['Highest score', high],
        ]
        : [['Example roles', scores.length], ['Highest example score', high]];

    statisticsList.replaceChildren(...metrics.map(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        row.append(term, description);
        return row;
    }));
}

document.querySelector('#open-statistics').addEventListener('click', () => statistics.showModal());
document.querySelector('#open-share').addEventListener('click', () => {
    shareStatus.textContent = '';
    share.showModal();
});
document.querySelector('#copy-link').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareLink.value);
        shareStatus.textContent = 'Preview link copied.';
    } catch {
        shareLink.focus();
        shareLink.select();
        shareStatus.textContent = 'Use your browser’s copy command to copy the selected link.';
    }
});
document.querySelector('#print-report').addEventListener('click', () => window.print());
document.querySelector('#confirm-result-age').addEventListener('click', () => {
    if (!saveAgeSelection('yes')) {
        document.querySelector('#result-age-status').textContent = 'Could not save your age choice. Check browser storage and try again.';
        return;
    }
    refreshResults();
    resultHeading.tabIndex = -1;
    resultHeading.focus();
});
document.querySelector('#report-tools').hidden = false;
document.addEventListener('quizprofilechange', refreshResults);
window.addEventListener('storage', event => {
    if (isProfileChange(event.key)) refreshResults();
});
window.addEventListener('hashchange', refreshResults);
window.addEventListener('pageshow', event => {
    if (event.persisted) refreshResults();
});
refreshResults();
