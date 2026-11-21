DBList.categories.push(
    {
        id: 'advanced-restraints', group: 'self', title: 'Restraints and sensory gear', advanced: true,
        directions: ['I wear', 'They wear'],
        topics: [
            topic('Padded Cuffs', ['adv-padded-cuffs-self', 'I wear padded cuffs', 'I wear'], ['adv-padded-cuffs-partner', 'My partner wears padded cuffs', 'They wear']),
            topic('Handcuffs', ['adv-handcuffs-self', 'I wear handcuffs', 'I wear'], ['adv-handcuffs-partner', 'My partner wears handcuffs', 'They wear']),
            topic('Blindfold', ['adv-blindfold-self', 'I wear a blindfold', 'I wear'], ['adv-blindfold-partner', 'My partner wears a blindfold', 'They wear']),
            topic('Sound-dampening Headphones', ['adv-headphones-self', 'I wear sound-dampening headphones during play', 'I wear'], ['adv-headphones-partner', 'My partner wears sound-dampening headphones during play', 'They wear']),
        ],
    },
    {
        id: 'advanced-sensations', group: 'self', title: 'Sensation play', advanced: true,
        directions: ['Receive', 'Give'],
        topics: [
            topic('Feather Touch', ['adv-feather-receive', 'Receiving light feather touch', 'Receive'], ['adv-feather-give', 'Giving light feather touch', 'Give']),
            topic('Soft Brushes', ['adv-brush-receive', 'Experiencing the touch of a soft brush', 'Receive'], ['adv-brush-give', 'Using a soft brush on my partner', 'Give']),
            topic('Cool Sensations', ['adv-cool-receive', 'Receiving cool sensations during play', 'Receive'], ['adv-cool-give', 'Giving cool sensations during play', 'Give']),
            topic('Warm Sensations', ['adv-warm-receive', 'Receiving warm sensations during play', 'Receive'], ['adv-warm-give', 'Giving warm sensations during play', 'Give']),
        ],
    },
    {
        id: 'advanced-toys', group: 'self', title: 'Toys and accessories', advanced: true,
        directions: ['On me', 'On partner'],
        topics: [
            topic('Vibrators', ['adv-vibrator-self', 'Using a vibrator on me', 'On me'], ['adv-vibrator-partner', 'Using a vibrator on my partner', 'On partner']),
            topic('Wand Vibrators', ['adv-wand-self', 'Using a wand vibrator on me', 'On me'], ['adv-wand-partner', 'Using a wand vibrator on my partner', 'On partner']),
            topic('Remote-controlled Toys', ['adv-remote-self', 'Using a remote-controlled toy on me', 'On me'], ['adv-remote-partner', 'Using a remote-controlled toy on my partner', 'On partner']),
            topic('Butt Plugs', ['adv-plug-self', 'I wear a butt plug', 'I wear'], ['adv-plug-partner', 'My partner wears a butt plug', 'They wear']),
            topic('Anal Beads', ['adv-beads-self', 'Using anal beads on me', 'On me'], ['adv-beads-partner', 'Using anal beads on my partner', 'On partner']),
        ],
    },
    {
        id: 'advanced-roles', group: 'self', title: 'Power exchange styles', advanced: true,
        directions: ['My role', 'Partner role'],
        topics: [
            topic('Gentle Dominance', ['adv-gentle-dom-self', 'Taking a nurturing, gentle dominant role', 'My role'], ['adv-gentle-dom-partner', 'Playing with a partner in a nurturing, gentle dominant role', 'Partner role']),
            topic('Service-oriented Submission', ['adv-service-sub-self', 'Taking a submissive role centered on acts of service', 'My role'], ['adv-service-sub-partner', 'Playing with a partner in a service-oriented submissive role', 'Partner role']),
            topic('Switching Within a Scene', ['adv-switch-scene', 'Changing roles during the same agreed scene']),
        ],
    },
    {
        id: 'advanced-scenarios', group: 'self', title: 'Roleplay scenarios', advanced: true,
        subtitle: 'Fictional scenarios played by consenting adults.',
        topics: [
            fantasyTopic('Meeting as Strangers', ['adv-strangers', 'Roleplaying two adults meeting for the first time']),
            fantasyTopic('Masquerade', ['adv-masquerade', 'Roleplaying a masquerade with invented identities']),
            fantasyTopic('Fantasy Adventure', ['adv-fantasy-adventure', 'Playing characters on a fantasy adventure']),
            fantasyTopic('Science Fiction', ['adv-science-fiction', 'Playing characters in a science-fiction setting']),
            fantasyTopic('Friendly Rivals', ['adv-rivals', 'Roleplaying friendly rivals in an invented contest']),
        ],
    },
    {
        id: 'advanced-lifestyle', group: 'partner', title: 'Lifestyle and compatibility', advanced: true,
        topics: [
            topic('Shared Hobbies', ['adv-shared-hobbies', 'Having hobbies in common with a partner']),
            topic('Similar Social Energy', ['adv-social-energy', 'Having a partner who enjoys a similar amount of social time']),
            topic('Smoke-free Lifestyle', ['adv-smoke-free', 'Having a partner who prefers a smoke-free lifestyle']),
            topic('Sober Play', ['adv-sober-play', 'Playing with a partner who prefers to stay sober during scenes']),
            topic('Community Events', ['adv-community-events', 'Having a partner who enjoys attending community events together']),
        ],
    },
    {
        id: 'advanced-connection', group: 'relationship', title: 'Communication and aftercare', advanced: true,
        topics: [
            topic('In-person Planning', ['adv-plan-in-person', 'Discussing a scene in person beforehand']),
            topic('Text Planning', ['adv-plan-text', 'Discussing a scene by text beforehand']),
            topic('Voice Planning', ['adv-plan-voice', 'Discussing a scene on a voice call beforehand']),
            topic('Revisiting Agreements', ['adv-revisit-agreements', 'Setting aside time to revisit our agreements together']),
            topic('Quiet Time Together', ['adv-aftercare-together', 'Spending quiet time together after a scene']),
            topic('Space to Decompress', ['adv-aftercare-space', 'Taking some time alone after a scene']),
            topic('Next-day Check-in', ['adv-next-day-check-in', 'Checking in with each other the day after a scene']),
        ],
    },
);

DBList.compactShareRoute = {
    prefix: '#~',
    advancedFlag: 1,
    fantasyFlag: 2,
    flags(hash) {
        if (!hash.startsWith(this.prefix)) return 0;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const index = alphabet.indexOf(hash[this.prefix.length] ?? '~');
        return index < 0 ? 0 : index;
    },
};

DBList.checklistView = function (hash = location.hash, search = location.search) {
    const params = new URLSearchParams(search);
    const route = DBList.compactShareRoute;
    const flags = route.flags(hash);
    const legacy = hash.startsWith('#list=');
    let profile = {};
    let oldMode;
    if (!legacy && !hash.startsWith(route.prefix)) {
        try {
            const saved = JSON.parse(localStorage.getItem('db-list.answers.v1'));
            profile = saved?.profile ?? {};
            if (!saved?.savedProfiles) oldMode = localStorage.getItem(DBList.checklistModeKey);
        } catch {
            // Explicit URL options still work when storage is unreadable.
        }
    }
    return {
        advanced: params.has('mode') ? params.get('mode') === 'advanced' : (legacy || Boolean(flags & route.advancedFlag) || (profile.mode ?? oldMode) === 'advanced'),
        fantasy: params.has('fantasy') ? params.get('fantasy') === '1' : (legacy || Boolean(flags & route.fantasyFlag) || profile.fantasy === '1'),
    };
};

DBList.checklistModeKey = 'db-list.checklist-mode';
const { advanced: advancedView, fantasy: fantasyView } = DBList.checklistView();
DBList.advancedMode = advancedView;
DBList.showFantasy = fantasyView;

DBList.checklistQuery = function ({ advanced = DBList.advancedMode, fantasy = DBList.showFantasy, shareHash = '' } = {}) {
    const defaults = DBList.checklistView(shareHash, '');
    const params = new URLSearchParams();
    if (advanced || advanced !== defaults.advanced) params.set('mode', advanced ? 'advanced' : 'standard');
    if (fantasy || fantasy !== defaults.fantasy) params.set('fantasy', fantasy ? '1' : '0');
    const query = params.toString();
    return query ? '?' + query : '';
};

const advancedGroups = [
    {
        id: 'roles-dynamics', title: 'Roles and dynamics',
        sections: ['roles', 'advanced-roles', 'advanced-role-styles', 'advanced-discipline', 'communication', 'advanced-adult-media'],
    },
    { id: 'intimacy-positions', title: 'Intimacy and positions', sections: ['intimacy', 'advanced-closeness', 'advanced-common-touch', 'advanced-intimate-contexts', 'advanced-penis-preferences', 'advanced-vulva-preferences', 'advanced-anal-preferences', 'advanced-positions'] },
    { id: 'clothing-toys', title: 'Clothing, toys, and restraints', sections: ['gear', 'advanced-wardrobe', 'advanced-presentation', 'advanced-restraints', 'advanced-restraint-types', 'advanced-toys', 'advanced-toy-types'] },
    { id: 'sensation-impact', title: 'Sensation and impact', sections: ['activities', 'advanced-sensations', 'advanced-sensory-details', 'advanced-impact-types', 'advanced-scene-language', 'advanced-body-senses'] },
    { id: 'scenarios-fantasy', title: 'Scenarios and fantasy', sections: ['advanced-scenarios', 'advanced-scene-settings', 'advanced-fantasy-worlds', 'advanced-fantasy-changes'] },
    { id: 'body-fluids', title: 'Body and fluid preferences', sections: ['advanced-bodily-fluids', 'advanced-placement', 'advanced-fluid-fantasies'] },
    { id: 'partner-preferences', title: 'Partner preferences', sections: ['partner-traits', 'advanced-lifestyle', 'advanced-build', 'advanced-hair', 'advanced-features', 'advanced-adult-ages', 'advanced-partner-fit'] },
    { id: 'relationships-communication', title: 'Relationships and communication', sections: ['relationship-style', 'advanced-connection', 'advanced-group-settings', 'advanced-connections', 'advanced-roles-with-others', 'advanced-communication-channels', 'advanced-apps'] },
];

const categoriesById = new Map(DBList.categories.map(category => [category.id, category]));
const navigationGroups = DBList.advancedMode ? advancedGroups.map(({ sections, ...group }) => ({
    ...group,
    categories: sections.map(id => categoriesById.get(id)),
})) : DBList.groups.map(group => ({
    ...group,
    categories: DBList.categories.filter(category => !category.advanced && category.group === group.id),
}));
DBList.navigationGroups = navigationGroups.map(group => ({
    ...group,
    categories: group.categories.map(category => ({
        ...category,
        topics: category.topics.filter(topic => DBList.showFantasy || !topic.fantasy),
    })).filter(category => category.topics.length),
})).filter(group => group.categories.length);
DBList.visibleCategories = DBList.navigationGroups.flatMap(group => group.categories);
