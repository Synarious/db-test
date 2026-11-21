import { roles } from './roles.js';

const prefix = '#results=v1.';
const categories = Object.values(roles);
const unrated = 255;

export function encodeResults(scores) {
    const byRole = new Map(scores.map(({ role, score }) => [role, score]));
    const bytes = categories.map(([role]) => byRole.get(role) ?? unrated);
    const payload = btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    return prefix + payload;
}

export function decodeResults(hash) {
    if (!hash.startsWith(prefix)) return null;
    const payload = hash.slice(prefix.length);
    if (payload.length !== Math.ceil(categories.length * 4 / 3) || !/^[\w-]+$/.test(payload)) return null;

    const bytes = Array.from(atob(payload.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
    if (bytes.length !== categories.length || bytes.some(value => value > 100 && value !== unrated)) return null;
    return categories.map(([role, description], index) => ({
        role, description, score: bytes[index] === unrated ? null : bytes[index],
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
