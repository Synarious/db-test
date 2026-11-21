import { roles } from './roles.js';
import { isRating } from './quiz-state.js';

export function scoreQuiz(items, responses) {
    const results = Object.fromEntries(Object.entries(roles).map(([id, [role, description]]) => [
        id, { role, description, total: 0, answered: 0, weightedSum: 0, ratedWeight: 0 },
    ]));

    for (const { id, weights } of items) {
        const rating = responses[id];
        for (const [role, weight] of Object.entries(weights)) {
            const result = results[role];
            result.total += 1;
            if (!isRating(rating)) continue;

            const magnitude = Math.abs(weight);
            const points = weight > 0 ? rating - 1 : 5 - rating;
            result.answered += 1;
            result.weightedSum += magnitude * points;
            result.ratedWeight += magnitude;
        }
    }

    return Object.values(results).map(({ weightedSum, ratedWeight, ...entry }) => ({
        ...entry,
        score: ratedWeight ? Math.round(100 * weightedSum / (4 * ratedWeight)) : null,
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
