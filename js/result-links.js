export const localProfilePrefix = '#profile=';
export const defaultProfileRef = 'default';

export function localResultLink(mode, profileId, { share = false } = {}) {
    const query = mode ? `mode=${mode}` : 'report=imported';
    return `results.html?${query}${share ? '&share=1' : ''}${localProfilePrefix}${profileId ?? defaultProfileRef}`;
}

export function sharedResultLink(hash, page = location) {
    const base = page.protocol === 'file:' ? 'https://bdsmtest.deviantbound.com/' : page.href;
    return new URL(`results.html${hash}`, base).href;
}
