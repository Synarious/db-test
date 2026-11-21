import { activeProfile, isAppearanceChange, saveAppearance, savedTheme, themes } from './profile-store.js';
import iconTexture from '../img/icon-texture.png';

const root = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');
root.style.setProperty('--icon-texture', `url("${iconTexture}")`);

function applyTheme(theme) {
    root.dataset.theme = theme;
    themeColor?.setAttribute('content', getComputedStyle(root).getPropertyValue('--canvas').trim());
}

applyTheme(savedTheme());

const dialog = document.createElement('dialog');
dialog.className = 'customize-dialog';
dialog.setAttribute('aria-labelledby', 'customize-heading');
dialog.innerHTML = `
    <header class="customize-header">
        <div class="dialog-heading">
            <h2 id="customize-heading">Customization</h2>
            <form method="dialog"><button class="secondary" autofocus>Close</button></form>
        </div>
        <p id="customize-context" class="description"></p>
    </header>
    <form id="customize-form">
        <div class="customize-body">
            <div class="theme-settings">
                <fieldset>
                    <legend>Theme</legend>
                    <div class="theme-options"></div>
                </fieldset>
                <figure class="appearance-example">
                    <figcaption>Results preview</figcaption>
                    <div class="appearance-preview" aria-hidden="true">
                        <strong>BDSM Test</strong>
                        <div><span>Switch</span><span class="example-score">84%</span></div>
                        <span class="example-track"><span></span></span>
                        <div><span>Dominant</span><span class="example-score">62%</span></div>
                        <span class="example-track"><span></span></span>
                    </div>
                </figure>
            </div>
            <fieldset id="customize-details">
                <legend>Optional results details</legend>
                <div class="profile-fields">
                    <label>Display name<input name="displayName" maxlength="60" autocomplete="off"></label>
                    <label>Age<input name="age" type="number" min="18" max="999" step="1" inputmode="numeric" autocomplete="off"></label>
                    <label>Role<input name="role" maxlength="60" autocomplete="off" placeholder="e.g. Switch"></label>
                </div>
                <p class="description">These details appear on your personal results and printed report.</p>
            </fieldset>
        </div>
        <div class="actions customize-actions">
            <button type="submit">Save changes</button>
            <p id="customize-status" class="status" role="status"></p>
        </div>
    </form>
`;
document.body.append(dialog);

const form = dialog.querySelector('#customize-form');
const scrollable = dialog.querySelector('.customize-body');
const details = dialog.querySelector('#customize-details');
const context = dialog.querySelector('#customize-context');
const preview = dialog.querySelector('.appearance-preview');
const options = dialog.querySelector('.theme-options');
const status = dialog.querySelector('#customize-status');
let editingId = null;

for (const [id, name] of Object.entries(themes)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'theme';
    input.value = id;
    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.dataset.palette = id;
    swatch.setAttribute('aria-hidden', 'true');
    label.append(input, swatch, name);
    options.append(label);
}

function previewTheme(theme) {
    preview.dataset.palette = theme;
    applyTheme(theme);
}

for (const button of document.querySelectorAll('[data-customize]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
        const profile = activeProfile();
        editingId = profile?.id ?? null;
        context.textContent = profile
            ? `Appearance for ${profile.name}. Your theme applies across the site.`
            : 'Default appearance. Your theme applies across the site in this browser.';
        details.hidden = !profile;
        details.disabled = !profile;
        form.elements.displayName.value = profile?.details.displayName ?? '';
        form.elements.age.value = profile?.details.age ?? '';
        form.elements.role.value = profile?.details.role ?? '';
        form.elements.theme.value = savedTheme();
        previewTheme(form.elements.theme.value);
        status.textContent = '';
        dialog.showModal();
        scrollable.scrollTop = 0;
    });
}

options.addEventListener('change', () => previewTheme(form.elements.theme.value));
dialog.addEventListener('close', () => applyTheme(savedTheme()));

form.addEventListener('submit', event => {
    event.preventDefault();
    if (editingId !== (activeProfile()?.id ?? null)) {
        dialog.close();
        return;
    }
    try {
        saveAppearance(editingId, form.elements.theme.value, {
            displayName: form.elements.displayName.value,
            age: form.elements.age.valueAsNumber,
            role: form.elements.role.value,
        });
    } catch {
        status.textContent = 'Could not save your customization. Check browser storage and try again.';
        return;
    }
    dialog.close();
    document.dispatchEvent(new Event('quizprofilechange'));
});

function syncAppearance() {
    if (dialog.open && editingId !== (activeProfile()?.id ?? null)) dialog.close();
    if (!dialog.open) applyTheme(savedTheme());
}

document.addEventListener('quizprofilechange', syncAppearance);
window.addEventListener('storage', event => {
    if (isAppearanceChange(event.key)) syncAppearance();
});
window.addEventListener('pageshow', event => {
    if (event.persisted) syncAppearance();
});
