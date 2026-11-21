import { modes } from './questions.js';
import { isRating, missedQuestionsMessage, requestedMode } from './quiz-state.js';
import { sampleScores } from './sample-report.js';
import { scoreQuiz } from './scoring.js';
import { renderScores } from './score-list.js';
import { defaultProfile, isAgeSelectionChange, isDefaultDraftChange, loadAgeSelection, saveAgeSelection } from './session.js';
import { activeProfile, downloadProfileBackup, isProfileChange, readProfile } from './profile-store.js';
import { defaultProfileRef, localProfilePrefix, localResultLink, sharedResultLink } from './result-links.js';
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
const report = scoreList.closest('.report');
const reportLinks = document.querySelector('#result-actions');
const resultGate = document.querySelector('#saved-result-gate');
const recovery = document.querySelector('#result-recovery');
const resultHeading = document.querySelector('#results-heading');
const resultIntro = document.querySelector('#result-intro');
const reportDate = document.querySelector('#report-date');
const reportDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const saveBackup = document.querySelector('#save-report-backup');
const nativeShare = document.querySelector('#share-result-link');
let reportBackup = null;
let shareRequested = new URLSearchParams(location.search).get('share') === '1';

function openShareDialog() {
    shareStatus.textContent = '';
    share.showModal();
}

function finishedQuiz(profile, selected) {
    const candidates = selected ? [selected] : Object.keys(modes);
    return candidates.map(mode => ({ mode, ...profile.drafts[mode] }))
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
    const active = activeProfile();
    const age = loadAgeSelection();
    const hash = location.hash;
    const sharedScores = decodeResults(hash);
    const hasShare = hash.startsWith('#results=');
    const isPreview = hash === '#preview';
    const pinned = hash.startsWith(localProfilePrefix);
    const profileRef = pinned ? hash.slice(localProfilePrefix.length) : null;
    const profile = !pinned ? active : profileRef === defaultProfileRef ? null : readProfile(profileRef);
    const showLocal = !isPreview && !hasShare && (!pinned || profileRef === defaultProfileRef || Boolean(profile));
    const localProfile = showLocal ? profile ?? defaultProfile() : null;
    const mode = requestedMode();
    const showImported = new URLSearchParams(location.search).get('report') === 'imported';
    const completed = localProfile && !showImported ? finishedQuiz(localProfile, mode) : null;
    const importedScores = showImported || (!mode && !completed) ? decodeResults(localProfile?.importedResults) : null;
    const hasReport = Boolean(completed || sharedScores || importedScores);
    const needsAge = hasReport && age === null;
    const unavailable = !hasReport && !isPreview && (hasShare || pinned || Boolean(mode) || showImported);
    const hideReport = needsAge || unavailable || (hasReport && age === 'no');
    const shared = Boolean(sharedScores);
    const imported = Boolean(importedScores);
    const scoresOnly = shared || imported;
    if (!pinned && (completed || imported)) {
        history.replaceState(history.state, '', localResultLink(completed?.mode, profile?.id));
    }

    resultGate.hidden = !needsAge;
    recovery.hidden = !unavailable;
    report.hidden = reportLinks.hidden = hideReport;
    const missed = document.querySelector('#missed-questions');
    const heading = unavailable ? 'Results unavailable' : completed ? 'Your results'
        : shared ? 'Shared results' : imported ? 'Imported results' : 'Results preview';
    document.title = `${heading} · Deviant Bound`;
    resultHeading.textContent = heading;
    if (hideReport) {
        reportBackup = null;
        missed.hidden = true;
        scoreList.replaceChildren();
        for (const dialog of [share, statistics, details]) if (dialog.open) dialog.close();
        resultIntro.textContent = unavailable
            ? (hasShare ? 'This results link is invalid or uses an unsupported format.'
                : 'This report is unavailable in this browser. Check your saved profiles or import a backup.')
            : needsAge ? 'Confirm you are 18 or older to open this report.'
                : 'You must be 18 or older to view this report.';
        return;
    }

    const settings = completed ? modes[completed.mode] : null;
    missed.textContent = completed ? missedQuestionsMessage(settings.items, completed.responses) : '';
    missed.hidden = !missed.textContent;
    const scores = settings ? scoreQuiz(settings.items, completed.responses)
        : shared ? sharedScores : imported ? importedScores : sampleScores;
    resultIntro.textContent = completed
        ? `${profile ? `Profile · ${profile.name}. ` : ''}Open More info to see how many questions contributed to each score.`
        : shared ? 'These role scores were shared by someone who took the quiz.'
            : imported ? `These role scores were imported into ${profile.name} from a share link.`
                : 'This example profile shows how role scores will appear.';
    document.querySelector('#report-heading').textContent = completed ? settings.label : scoresOnly ? 'Quiz scores' : 'Example profile';
    const completionDate = new Date(completed?.completedAt);
    const date = Number.isNaN(completionDate.getTime()) ? new Date() : completionDate;
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
    document.querySelector('#statistics-title').textContent = hasReport ? 'Quiz statistics' : 'Preview statistics';
    document.querySelector('#share-description').textContent = hasReport
        ? 'Anyone with the results link can view your role scores.' : 'The share link opens the example profile.';
    const linkLabel = hasReport ? 'Results link' : 'Preview link';
    document.querySelector('#share-link-label').textContent = linkLabel;
    document.querySelector('#copy-link').textContent = `Copy ${linkLabel.toLowerCase()}`;
    shareLink.value = sharedResultLink(hasReport ? encodeResults(scores) : '#preview');
    nativeShare.hidden = typeof navigator.share !== 'function';
    reportBackup = completed || imported ? localProfile : null;
    saveBackup.hidden = document.querySelector('#backup-description').hidden = !reportBackup;
    const canReview = completed && profile?.id === active?.id;
    quizLink.href = canReview ? `quiz.html?mode=${completed.mode}` : completed ? 'profiles.html' : 'quiz.html';
    quizLink.textContent = canReview ? 'Review answers' : completed ? 'Manage profiles' : 'Take the BDSM Test';
    document.querySelector('#save-default-result').hidden = !completed || Boolean(profile);
    const importLink = document.querySelector('#import-shared-result');
    importLink.hidden = !shared;
    importLink.href = shared ? `profiles.html${hash}` : 'profiles.html';
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

    if (shareRequested && hasReport) {
        shareRequested = false;
        const url = new URL(location.href);
        url.searchParams.delete('share');
        history.replaceState(history.state, '', url);
        openShareDialog();
    }
}

document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#main').focus();
});
document.querySelector('#open-statistics').addEventListener('click', () => statistics.showModal());
document.querySelector('#open-share').addEventListener('click', openShareDialog);
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
nativeShare.addEventListener('click', async () => {
    shareStatus.textContent = '';
    try {
        await navigator.share({ url: shareLink.value });
    } catch (error) {
        if (error.name !== 'AbortError') shareStatus.textContent = 'Could not open sharing. Use Copy link to share your results.';
    }
});
saveBackup.addEventListener('click', () => {
    if (!reportBackup) return;
    try {
        downloadProfileBackup(reportBackup);
        shareStatus.textContent = 'Backup download started.';
    } catch {
        shareStatus.textContent = 'Could not download the backup. Try again.';
    }
});
document.querySelector('#print-report').addEventListener('click', () => window.print());
const saveImage = document.querySelector('#save-report-image');
saveImage.addEventListener('click', async () => {
    saveImage.disabled = true;
    shareStatus.textContent = 'Preparing image…';
    try {
        await saveReportImage(report);
        shareStatus.textContent = 'PNG download started.';
    } catch {
        shareStatus.textContent = 'Could not save the image. Try again or use Print / save PDF.';
    } finally {
        saveImage.disabled = false;
    }
});
document.querySelector('#confirm-result-age').addEventListener('click', () => {
    saveAgeSelection('yes');
    refreshResults();
    resultHeading.tabIndex = -1;
    if (!share.open) resultHeading.focus();
});
document.querySelector('#report-tools').hidden = false;
document.addEventListener('quizprofilechange', refreshResults);
window.addEventListener('storage', event => {
    if (isAgeSelectionChange(event.key) || isProfileChange(event.key) || isDefaultDraftChange(event.key)) refreshResults();
});
window.addEventListener('hashchange', refreshResults);
window.addEventListener('pageshow', event => {
    if (event.persisted) refreshResults();
});
refreshResults();
