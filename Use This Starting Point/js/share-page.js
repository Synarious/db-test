(function () {
    'use strict';

    const board = document.querySelector('#share-board');
    const status = document.querySelector('#share-page-status');
    const profilesLink = document.querySelector('#profiles-link');
    const compare = document.querySelector('#compare-results');
    let openHelp;

    function closeHelp() {
        if (!openHelp) return;
        openHelp.setAttribute('aria-expanded', 'false');
        document.getElementById(openHelp.getAttribute('aria-controls')).hidden = true;
        openHelp = null;
    }

    document.addEventListener('click', event => {
        const help = event.target.closest('.share-topic-help');
        if (openHelp && openHelp.parentElement.contains(event.target) && !help) return;
        const toggle = help && help !== openHelp;
        closeHelp();
        if (toggle) {
            openHelp = help;
            help.setAttribute('aria-expanded', 'true');
            document.getElementById(help.getAttribute('aria-controls')).hidden = false;
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeHelp();
    });

    function showShare() {
        closeHelp();
        board.replaceChildren();
        profilesLink.hidden = true;
        compare.hidden = true;
        const hash = DBList.checklistShareHash(location.hash);
        if (!hash) {
            status.textContent = 'Open a share URL to view ratings.';
            return;
        }
        try {
            const { answers, profile, skipped } = DBList.parseChecklistShareHash(hash);
            const groups = DBList.navigationGroups.map(group => ({
                ...group,
                categories: group.categories.map(category => ({
                    ...category,
                    topics: category.topics.map(topic => ({
                        ...topic,
                        choices: topic.choices.map(choice => ({ ...choice, value: answers[choice.id] ?? '' })),
                    })),
                })),
            }));
            board.append(DBList.createImageSheet({ groups, details: DBList.profileLines(profile), interactive: true }));
            profilesLink.href = 'profiles.html' + hash;
            profilesLink.hidden = false;
            compare.href = 'compare.html' + DBList.checklistQuery({ shareHash: hash }) + hash;
            compare.hidden = !Object.keys(answers).length;
            status.textContent = skipped ? 'Skipped ' + skipped + ' incompatible entries.' : '';
        } catch (error) {
            status.textContent = error.message;
        }
    }

    window.addEventListener('hashchange', () => {
        const { advanced, fantasy } = DBList.checklistView();
        if (advanced !== DBList.advancedMode || fantasy !== DBList.showFantasy) location.reload();
        else if (!document.querySelector('#app').hidden) showShare();
    });
    DBList.mountAdultPage(showShare);
})();
