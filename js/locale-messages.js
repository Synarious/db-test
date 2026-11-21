import es from './locales/es.js';
import fr from './locales/fr.js';
import de from './locales/de.js';
import pt from './locales/pt.js';
import it from './locales/it.js';
import ja from './locales/ja.js';
import ar from './locales/ar.js';

const catalogs = { es, fr, de, pt, it, ja, ar };

export function message(source, language) {
    const catalog = Object.hasOwn(catalogs, language) ? catalogs[language] : undefined;
    return catalog && Object.hasOwn(catalog, source) ? catalog[source] : undefined;
}
