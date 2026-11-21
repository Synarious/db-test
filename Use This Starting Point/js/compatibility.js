(function () {
    'use strict';

    const rolePairs = [
        ['rating-dominate', 'rating-submissive'],
        ['rating-sadist', 'rating-masochist'],
        ['rating-petowner', 'rating-pet'],
        ['rating-mastermistress', 'rating-slave'],
        ['rating-rigger', 'rating-ropebunny'],
        ['rating-caregiver', 'rating-little'],
        ['rating-brattamer', 'rating-brat'],
        ['rating-teacher', 'rating-learner'],
    ];
    const counterparts = new Map(rolePairs.flatMap(([first, second]) => [[first, second], [second, first]]));
    const pairs = DBList.categories.flatMap(({ id, title, group, topics }) => {
        const roleTopics = new Map(topics.map(topic => [topic.choices[0].id, topic]));
        return topics.flatMap(({ title: topic, fantasy, choices }) => choices.map((own, index) => {
            const otherRole = roleTopics.get(counterparts.get(own.id));
            // Two-choice activity rows describe the same interaction from opposite perspectives.
            const other = otherRole?.choices[0] ?? (choices.length === 2 ? choices[1 - index] : own);
            const name = otherRole ? topic + ' / ' + otherRole.title : topic;
            const kind = group === 'partner' ? 'partner' :
                id === 'advanced-roles-with-others' || own.requirements?.partnerGender ? 'context' : '';
            return { title: name, category: title, categoryId: id, group, fantasy: fantasy || otherRole?.fantasy, own, other, kind };
        }));
    });

    const declined = new Set(['not-interested', 'limit']);
    const ratings = DBList.ratingOptions.map(([rating]) => rating).filter(Boolean);
    const ratingRank = new Map(ratings.map((rating, index) => [rating, index]));

    function randomIndex(length) {
        return Math.floor(Math.random() * length);
    }

    function createExampleComparison() {
        const choiceIds = new Set(DBList.categories.flatMap(({ topics }) =>
            topics.flatMap(({ choices }) => choices.map(({ id }) => id))));
        const ownAnswers = Object.create(null);
        const answers = Object.create(null);

        for (const id of choiceIds) {
            ownAnswers[id] = ratings[randomIndex(ratings.length)];
            answers[id] = ratings[randomIndex(ratings.length)];
        }
        return { ownAnswers, answers };
    }

    function compareRatings(own, other, mode) {
        if (!own || !other) return (own || other) === 'limit' ? 'unansweredLimits' : 'unanswered';
        const ownDeclines = declined.has(own);
        const otherDeclines = declined.has(other);
        if (ownDeclines && otherDeclines) return 'boundaries';
        if (own === 'limit' || other === 'limit') return 'limits';
        if (mode === 'relaxed') return ownDeclines === otherDeclines ? 'matches' : 'differences';

        const maxGap = mode === 'strict' ? 0 : 1;
        const gap = Math.abs(ratingRank.get(own) - ratingRank.get(other));
        return gap <= maxGap ? 'matches' : 'differences';
    }

    function compareChecklists(ownAnswers, otherAnswers, mode = 'standard') {
        const rows = {
            limits: [], unansweredLimits: [], contextualLimits: [], differences: [], matches: [],
            boundaries: [], unanswered: [], partner: [], context: [],
        };
        for (const pair of pairs) {
            const own = ownAnswers[pair.own.id] ?? '';
            const other = otherAnswers[pair.other.id] ?? '';
            if (!own && !other) continue;
            const kind = pair.kind && (own === 'limit' || other === 'limit') ? 'contextualLimits' :
                pair.kind || compareRatings(own, other, mode);
            rows[kind].push({ ...pair, ownRating: own, otherRating: other });
        }
        const matches = rows.matches.length + (mode === 'relaxed' ? rows.boundaries.length : 0);
        const conflicts = rows.limits.length + rows.differences.length;
        return { rows, matches, conflicts, total: matches + conflicts };
    }

    Object.assign(DBList, { compareChecklists, createExampleComparison });
})();
