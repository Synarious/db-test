(function () {
    'use strict';

    const help = document.querySelector('.site-help');
    const summary = help.querySelector('summary');
    document.addEventListener('pointerdown', event => {
        if (help.open && !help.contains(event.target)) help.open = false;
    });
    help.addEventListener('focusout', event => {
        if (event.relatedTarget && !help.contains(event.relatedTarget)) help.open = false;
    });
    help.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !help.open) return;
        event.stopPropagation();
        help.open = false;
        summary.focus();
    });

    if (typeof DBList !== 'undefined') {
        const links = document.querySelectorAll('[data-checklist-nav]');
        DBList.updateSiteNav = function (query = DBList.checklistQuery()) {
            for (const link of links) {
                link.href = link.getAttribute('href').split('?')[0] + query;
            }
        };
        DBList.updateSiteNav();

        if (document.body.matches('.checklist-page, .results-page')) {
            document.addEventListener('DOMContentLoaded', () => {
                let displayedProfile;
                try {
                    displayedProfile = DBList.activeProfileId();
                } catch {
                    return;
                }

                function refreshSelectedProfile() {
                    if (DBList.checklistShareHash(location.hash) || DBList.activeProfileId() === displayedProfile) return;
                    const url = new URL(location.href);
                    url.searchParams.delete('mode');
                    url.searchParams.delete('fantasy');
                    if (url.href === location.href) location.reload();
                    else location.replace(url);
                }

                window.addEventListener('storage', event => {
                    if (DBList.isProfileSelectionEvent(event)) refreshSelectedProfile();
                });
                window.addEventListener('pageshow', event => {
                    if (event.persisted) refreshSelectedProfile();
                });
            });
        }
    }
})();
