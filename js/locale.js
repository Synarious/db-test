export const languages = {
    en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
    pt: 'Português', it: 'Italiano', ja: '日本語', ar: 'العربية',
};

export function supportedLanguage(tag) {
    const code = typeof tag === 'string' ? tag.trim().toLowerCase().split('-')[0] : '';
    return Object.hasOwn(languages, code) ? code : null;
}

// Time zones only provide a suggestion when language preferences are inconclusive.
const zoneHints = {
    'Europe/Madrid': 'es', 'Europe/Paris': 'fr', 'Europe/Berlin': 'de',
    'Europe/Lisbon': 'pt', 'Europe/Rome': 'it', 'America/Sao_Paulo': 'pt',
    'Asia/Tokyo': 'ja', 'Asia/Riyadh': 'ar', 'Africa/Cairo': 'ar',
    'Europe/London': 'en', 'America/Mexico_City': 'es',
};

export function detectLanguage(preferences, browserLanguage, locale, timeZone) {
    const primary = preferences[0] || browserLanguage;
    const preferred = supportedLanguage(primary);
    if (preferred) return { language: preferred, suggest: false };

    const secondary = [...preferences.slice(1), browserLanguage, locale]
        .map(supportedLanguage).find(Boolean);
    return {
        language: secondary || (Object.hasOwn(zoneHints, timeZone) ? zoneHints[timeZone] : 'en'),
        suggest: true,
    };
}
