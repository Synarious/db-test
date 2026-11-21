import { downloadFile } from './file-download.js';
import iconTexture from '../img/icon-texture.png';

async function drawTexture(context, width, height, accent) {
    const image = new Image();
    image.src = iconTexture;
    try {
        await image.decode();
    } catch {
        return;
    }

    const tile = document.createElement('canvas');
    tile.width = image.naturalWidth;
    tile.height = image.naturalHeight;
    const tint = tile.getContext('2d');
    tint.drawImage(image, 0, 0);
    tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = accent;
    tint.fillRect(0, 0, tile.width, tile.height);

    const pattern = context.createPattern(tile, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(.5));
    context.save();
    context.globalAlpha = .14;
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
    context.restore();
}

function fillRoundedRect(context, x, y, width, height, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
}

export async function saveReportImage(report) {
    const rows = [...report.querySelectorAll('.score-row')].map(row => {
        const value = row.querySelector('.score-value');
        return {
            name: row.querySelector('.score-name').textContent,
            value: value.textContent,
            color: getComputedStyle(value).color,
            fraction: parseFloat(row.style.getPropertyValue('--score-size')) / 100,
        };
    });
    const subtitle = [report.querySelector('h2'), report.querySelector('.report-note')]
        .map(element => element.textContent).filter(Boolean).join(' · ');
    const profile = report.querySelector('.report-profile').textContent;
    const date = report.querySelector('.report-footer time').textContent;
    const website = report.querySelector('.report-footer a').textContent;
    const theme = getComputedStyle(report);
    const color = name => theme.getPropertyValue(name).trim();
    const palette = {
        canvas: color('--canvas'),
        inset: color('--inset'),
        border: color('--border'),
        accent: color('--accent'),
        primary: color('--primary'),
        muted: color('--muted'),
    };

    const width = 820;
    const margin = 32;
    const right = width - margin;
    const innerPadding = 22;
    const columnGap = 36;
    const columnWidth = (right - margin - innerPadding * 2 - columnGap) / 2;
    const rowsPerColumn = Math.ceil(rows.length / 2);
    const rowHeight = 38;
    const panelTop = profile ? 166 : 144;
    const panelHeight = innerPadding * 2 + rowsPerColumn * rowHeight;
    const panelBottom = panelTop + panelHeight;
    const height = panelBottom + 67;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');

    context.scale(2, 2);
    context.fillStyle = palette.canvas;
    context.fillRect(0, 0, width, height);
    await drawTexture(context, width, height, palette.accent);

    context.fillStyle = palette.accent;
    context.font = '700 14px system-ui';
    context.fillText('Deviant Bound', margin, 42);
    context.fillStyle = palette.primary;
    context.font = '750 42px system-ui';
    context.fillText('BDSM Test', margin, 87);
    context.fillStyle = palette.muted;
    context.font = '15px system-ui';
    context.fillText(subtitle, margin, 114, right - margin);
    if (profile) context.fillText(profile, margin, 136, right - margin);

    fillRoundedRect(context, margin, panelTop, right - margin, panelHeight, 18, palette.inset);
    context.strokeStyle = palette.border;
    context.stroke();
    context.fillStyle = palette.border;
    context.fillRect(width / 2, panelTop + innerPadding, 1, panelHeight - innerPadding * 2);

    context.textBaseline = 'middle';
    context.font = '650 15px system-ui';
    rows.forEach((row, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const left = margin + innerPadding + column * (columnWidth + columnGap);
        const top = panelTop + innerPadding + index % rowsPerColumn * rowHeight;
        const trackTop = top + 22;

        context.textAlign = 'left';
        context.fillStyle = palette.primary;
        context.fillText(row.name, left, top + 8, columnWidth - 75);
        context.textAlign = 'right';
        context.fillStyle = row.color;
        context.fillText(row.value, left + columnWidth, top + 8);

        fillRoundedRect(context, left, trackTop, columnWidth, 5, 2.5, palette.border);
        if (row.fraction > 0) {
            fillRoundedRect(context, left, trackTop, columnWidth * row.fraction, 5, 2.5, row.color);
        }
    });

    context.font = '14px system-ui';
    context.textAlign = 'left';
    context.fillStyle = palette.muted;
    context.fillText(date, margin, panelBottom + 32);
    context.textAlign = 'right';
    context.fillStyle = palette.accent;
    context.fillText(website, right, panelBottom + 32);

    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG export failed');
        downloadFile(blob, 'deviant-bound-results.png');
    } finally {
        canvas.width = canvas.height = 0;
    }
}
