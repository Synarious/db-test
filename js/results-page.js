import { modes } from './questions.js';
import { isRating, missedQuestionsMessage, requestedMode } from './quiz-state.js';
import { sampleScores } from './sample-report.js';
import { scoreQuiz } from './scoring.js';
import { renderScores } from './score-list.js';
import { isDefaultDraftChange, loadAgeSelection, loadDraft, saveAgeSelection } from './session.js';
import { activeProfile, isProfileChange } from './profile-store.js';
import { decodeResults, encodeResults } from './shared-results.js';
import { saveReportImage } from './report-image.js';

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
const reportDate = document.querySelector('#report-date');
const reportDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function finishedQuiz(profile, selected) {
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
    const sharedScores = decodeResults(location.hash);
    const hasShare = location.hash.startsWith('#results=');
    const showLocal = location.hash !== '#preview' && !hasShare && age !== 'no';
    const mode = requestedMode();
    const showImported = new URLSearchParams(location.search).get('report') === 'imported';
    const candidate = showLocal && !showImported ? finishedQuiz(profile, mode) : null;
    const importedScores = showLocal && (showImported || (!mode && !candidate))
        ? decodeResults(profile?.importedResults) : null;
    const completed = age === 'yes' ? candidate : null;
    const shared = age === 'yes' && Boolean(sharedScores);
    const imported = age === 'yes' && Boolean(importedScores);
    const scoresOnly = shared || imported;
    resultGate.hidden = age !== null || !(candidate || sharedScores || importedScores);
    document.querySelector('#saved-result-heading').textContent = sharedScores ? 'View shared results' : 'View your saved results';
    document.querySelector('#result-age-description').textContent = sharedScores
        ? 'Confirm you are 18 or older to open the shared results.'
        : 'Confirm you are 18 or older to open your personal results in this tab.';
    const settings = completed ? modes[completed.mode] : null;
    const missed = document.querySelector('#missed-questions');
    missed.textContent = completed ? missedQuestionsMessage(settings.items, completed.responses) : '';
    missed.hidden = !missed.textContent;
    const scores = settings ? scoreQuiz(settings.items, completed.responses)
        : shared ? sharedScores : imported ? importedScores : sampleScores;
    const shareable = Boolean(completed || scoresOnly);

    const heading = completed ? 'Your results' : shared ? 'Shared results' : imported ? 'Imported results' : 'Results preview';
    const previewIntro = hasShare && !sharedScores
        ? 'This shared results link is invalid or unsupported. The example profile is shown below.'
        : 'This example profile shows how role scores will appear.';
    document.title = `${heading} · Deviant Bound`;
    resultHeading.textContent = heading;
    document.querySelector('#result-intro').textContent = completed
        ? `${profile ? `Active profile · ${profile.name}. ` : ''}Open More info to see how many questions contributed to each score.`
        : shared ? 'These role scores were shared by someone who took the quiz.'
            : imported ? `These role scores were imported into ${profile.name} from a share link.`
                : previewIntro;
    document.querySelector('#report-heading').textContent = completed ? settings.label : scoresOnly ? 'Quiz scores' : 'Example profile';
    const date = new Date();
    reportDate.dateTime = [
        date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
    ].join('-');
    reportDate.textContent = reportDateFormat.format(date);
    reportDate.hidden = false;
    const profileLine = document.querySelector('#report-profile');
    const { displayName, age: profileAge, role } = completed && profile ? profile.details : {};
    profileLine.textContent = [displayName, profileAge ? `Age ${profileAge}` : '', role].filter(Boolean).join(' · ');
    profileLine.hidden = !profileLine.textContent;
    document.querySelector('#report-note').textContent = completed
        ? `${settings.items.length} questions · Weighted agreement`
        : scoresOnly ? 'Weighted agreement' : 'Illustrative scores';
    document.querySelector('#statistics-title').textContent = shareable ? 'Quiz statistics' : 'Preview statistics';
    document.querySelector('#share-description').textContent = shareable
        ? 'Anyone with this link can view these role scores. Quiz answers and profile details stay out of the link.'
        : 'The share link opens the example profile.';
    const linkLabel = shareable ? 'Results link' : 'Preview link';
    document.querySelector('#share-link-label').textContent = linkLabel;
    document.querySelector('#copy-link').textContent = `Copy ${linkLabel.toLowerCase()}`;
    shareLink.value = new URL(`results.html${shareable ? encodeResults(scores) : '#preview'}`, location.href).href;
    quizLink.href = completed ? `quiz.html?mode=${completed.mode}` : 'quiz.html';
    quizLink.textContent = completed ? 'Review answers' : 'Take the BDSM Test';
    document.querySelector('#save-default-result').hidden = !completed || Boolean(profile);
    const importLink = document.querySelector('#import-shared-result');
    importLink.hidden = !shared;
    importLink.href = shared ? `profiles.html${location.hash}` : 'profiles.html';
    scoreList.setAttribute('aria-label', completed ? 'Your quiz scores' : scoresOnly ? 'Quiz role scores' : 'Example role scores');
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
        : scoresOnly ? [['Categories scored', `${rated.length} of ${scores.length}`], ['Highest score', high]]
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
        shareStatus.textContent = 'Link copied.';
    } catch {
        shareLink.focus();
        shareLink.select();
        shareStatus.textContent = 'Use your browser’s copy command to copy the selected link.';
    }
});
document.querySelector('#print-report').addEventListener('click', () => window.print());
const saveImage = document.querySelector('#save-report-image');
saveImage.addEventListener('click', async () => {
    saveImage.disabled = true;
    shareStatus.textContent = 'Preparing image…';
    try {
        await saveReportImage(scoreList.closest('.report'));
        shareStatus.textContent = 'PNG download started.';
    } catch {
        shareStatus.textContent = 'Could not save the image. Try again or use Print / save PDF.';
    } finally {
        saveImage.disabled = false;
    }
});
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
    if (isProfileChange(event.key) || isDefaultDraftChange(event.key)) refreshResults();
});
window.addEventListener('hashchange', refreshResults);
window.addEventListener('pageshow', event => {
    if (event.persisted) refreshResults();
});
refreshResults();
