import { detectLanguage, languages, supportedLanguage } from './locale.js';
import { message } from './locale-messages.js';

const storageKey = 'dbt-language';
const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
const detected = detectLanguage(navigator.languages || [], navigator.language, locale, timeZone);
const automatic = detected.suggest ? 'en' : detected.language;
const initialURL = new URL(location.href);
let requested = supportedLanguage(initialURL.searchParams.get('lang'));
let preference;
try {
    const saved = localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey);
    preference = saved === 'auto' ? saved : supportedLanguage(saved);
} catch {
    // Language selection still works for the current page.
}
let language = requested || (preference === 'auto' ? automatic : preference) || automatic;

const header = document.querySelector('.site-header-inner');
const customize = header.querySelector('[data-customize]');
const controls = document.createElement('div');
controls.className = 'site-header-controls';
customize.before(controls);
controls.append(customize);

const trigger = document.createElement('button');
trigger.type = 'button';
trigger.className = 'secondary site-language';
trigger.setAttribute('aria-haspopup', 'dialog');
controls.append(trigger);

const dialog = document.createElement('dialog');
dialog.className = 'language-dialog';
dialog.setAttribute('aria-labelledby', 'language-heading');
dialog.innerHTML = `
    <h2 id="language-heading"></h2>
    <form>
        <label for="site-language-choice"></label>
        <select id="site-language-choice" autofocus></select>
        <p class="description" role="status"></p>
        <div class="actions">
            <button type="submit"></button>
            <button type="button" class="secondary"></button>
        </div>
    </form>
`;
document.body.append(dialog);

const form = dialog.querySelector('form');
const select = dialog.querySelector('select');
const status = dialog.querySelector('[role="status"]');
const autoOption = new Option('', 'auto');
select.add(autoOption);
for (const [code, name] of Object.entries(languages)) {
    const option = new Option(name, code);
    option.lang = code;
    option.dir = code === 'ar' ? 'rtl' : 'ltr';
    select.add(option);
}

const textSources = new WeakMap();
const publicCopy = new WeakMap();
const markedCopy = new WeakMap();
const attributes = ['aria-label', 'placeholder', 'title'];
const attributeSources = new WeakMap();
const originalTitle = document.title;
let translator;
let translatorPromise;
let translations = new Map();

export function translatePublic(element, source, key = source) {
    markedCopy.set(element, { source, key });
    element.textContent = source;
}

function nodesWithin(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.data.trim() || node.parentElement.closest(
                'script, style, noscript, template, input, textarea, [translate="no"]'
            )) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
}

for (const node of nodesWithin(document.body)) {
    if (!dialog.contains(node)) publicCopy.set(node, node.data.trim());
}

function translated(source, allowModel, key) {
    const bundled = message(key, language);
    if (bundled) return bundled;
    if (!allowModel || !translator || language === 'en') return source;

    if (!translations.has(source)) {
        translations.set(source, source);
        const cache = translations;
        translator.translate(source).then(value => {
            if (translations !== cache) return;
            cache.set(source, value || source);
            schedule();
        }).catch(() => {});
    }
    return translations.get(source);
}

function renderPage() {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    const separator = originalTitle.indexOf(' · ');
    const title = originalTitle.slice(0, separator);
    document.title = separator < 0 ? originalTitle : `${message(title, language) || title}${originalTitle.slice(separator)}`;

    trigger.textContent = languages[language];
    trigger.lang = language;
    trigger.setAttribute('aria-label', `${message('Language', language) || 'Language'} · ${languages[language]}`);
    dialog.querySelector('h2').textContent = message('Choose your language', language) || 'Choose your language';
    dialog.querySelector('label').textContent = message('Language', language) || 'Language';
    form.querySelector('[type=submit]').textContent = message('Apply', language) || 'Apply';
    form.querySelector('[type=button]').textContent = message('Close', language) || 'Close';
    autoOption.textContent = `${message('Automatic', language) || 'Automatic'} · ${languages[automatic]}`;
    const notice = 'Some content is available in English.';
    status.textContent = language === 'en' ? '' : message(notice, language);

    for (const node of nodesWithin(document.body)) {
        const parent = node.parentElement;
        if (dialog.contains(parent) || parent === trigger || parent.closest(
            '#quiz-profile > span, #report-profile'
        )) continue;
        const marked = markedCopy.get(parent);
        let state = textSources.get(node);
        if (!state || state.rendered !== node.data || marked && marked.source !== state.source) {
            state = { original: node.data, source: marked?.source || node.data.trim(), rendered: node.data };
            textSources.set(node, state);
        }
        const visible = !parent.closest('[hidden], dialog:not([open])');
        const canTranslate = visible && (marked || publicCopy.get(node) === state.source)
            && /[a-z]{2}/i.test(state.source) && !/^(Deviant Bound|https?:)/.test(state.source);
        const key = marked?.key ?? state.source;
        const value = translated(state.source, canTranslate, key);
        const output = state.original.replace(state.original.trim(), value);
        if (node.data !== output) node.data = output;
        state.rendered = output;
        if (marked) {
            parent.lang = value === state.source && !message(key, language) ? 'en' : language;
            parent.dir = 'auto';
        }
    }

    for (const element of document.querySelectorAll('[aria-label], [placeholder], [title]')) {
        if (dialog.contains(element) || element === trigger) continue;
        const states = attributeSources.get(element) || {};
        for (const attribute of attributes) {
            const value = element.getAttribute(attribute);
            if (value === null) continue;
            const source = states[attribute]?.rendered === value ? states[attribute].source : value;
            const rendered = message(source, language) || source;
            if (value !== rendered) element.setAttribute(attribute, rendered);
            states[attribute] = { source, rendered };
        }
        attributeSources.set(element, states);
    }
}

const observer = new MutationObserver(schedule);
const observation = {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'open', ...attributes],
};
let queued = false;
function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
        queued = false;
        observer.disconnect();
        renderPage();
        observer.observe(document.body, observation);
    });
}

function startTranslator(interactive = false) {
    if (language === 'en' || translator || translatorPromise || !globalThis.Translator) return;
    const target = language;
    const cache = translations;
    const options = { sourceLanguage: 'en', targetLanguage: target };
    translatorPromise = (async () => {
        const available = await Translator.availability(options);
        if (cache !== translations || available === 'unavailable' || available !== 'available' && !interactive) return;
        const instance = await Translator.create(options);
        if (cache !== translations) {
            instance.destroy();
            return;
        }
        translator = instance;
        schedule();
    })().catch(() => {}).finally(() => {
        if (cache === translations) translatorPromise = null;
    });
}

function openPicker() {
    if (dialog.open) return;
    select.value = requested ? language : preference || (detected.suggest ? detected.language : 'auto');
    dialog.showModal();
}

trigger.addEventListener('click', openPicker);
form.querySelector('[type=button]').addEventListener('click', () => dialog.close());
form.addEventListener('submit', event => {
    event.preventDefault();
    preference = select.value;
    try {
        localStorage.setItem(storageKey, preference);
    } catch {
        try { sessionStorage.setItem(storageKey, preference); } catch {}
    }
    if (initialURL.searchParams.has('lang')) {
        const url = new URL(location.href);
        url.searchParams.delete('lang');
        history.replaceState(history.state, '', url);
        requested = null;
    }
    const target = preference === 'auto' ? automatic : preference;
    if (language !== target) {
        translator?.destroy();
        translator = null;
        translatorPromise = null;
        translations = new Map();
        language = target;
    }
    dialog.close();
    schedule();
    startTranslator(true);
});

schedule();
startTranslator();
if (!requested && !preference && detected.suggest && detected.language !== 'en') {
    setTimeout(() => {
        if (!document.querySelector('dialog[open]')) openPicker();
    }, 0);
}
