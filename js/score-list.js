function scoreColor(score) {
    if (score === null) return 'var(--muted)';
    if (score >= 80) return 'var(--score-high)';
    if (score >= 60) return 'var(--score-upper-mid)';
    if (score >= 40) return 'var(--score-mid)';
    if (score >= 20) return 'var(--score-lower-mid)';
    return 'var(--score-low)';
}

export function renderScores(list, scores, showDetails) {
    const rows = scores.map(entry => {
        const row = document.createElement('li');
        row.className = 'score-row';
        row.style.setProperty('--score-color', scoreColor(entry.score));
        row.style.setProperty('--score-size', `${entry.score ?? 0}%`);

        const name = document.createElement('span');
        name.className = 'score-name';
        name.textContent = entry.role;

        const track = document.createElement('span');
        track.className = 'score-track';
        track.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'score-fill';
        track.append(fill);

        const value = document.createElement('span');
        value.className = 'score-value';
        value.textContent = entry.score === null ? 'Unrated' : `${entry.score}%`;
        row.append(name, track, value);

        if (showDetails) {
            const info = document.createElement('button');
            info.type = 'button';
            info.className = 'text-button score-info';
            info.textContent = 'More info';
            info.setAttribute('aria-label', `More info about ${entry.role}`);
            info.setAttribute('aria-haspopup', 'dialog');
            info.addEventListener('click', () => showDetails(entry));
            row.classList.add('has-details');
            row.append(info);
        }
        return row;
    });
    list.replaceChildren(...rows);
    list.hidden = false;
}
