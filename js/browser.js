import './site.js';
import './site-language.js';

// The build includes these page modules in the same classic script.
const pages = {
    home: () => import('./home.js'),
    quiz: () => import('./quiz.js'),
    results: () => import('./results-page.js'),
    profiles: () => import('./profiles-page.js'),
};

pages[document.currentScript.dataset.page]?.();
