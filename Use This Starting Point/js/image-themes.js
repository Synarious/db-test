const DBListThemes = (() => {
    'use strict';

    const storageKey = 'db-list.answers.v1';
    const defaultTheme = 'graphite';
    const options = {
        graphite: 'Graphite',
        'blood-velvet': 'Blood Velvet',
        'violet-nocturne': 'Violet Nocturne',
        rosewater: 'Rosewater',
        porcelain: 'Porcelain',
        plum: 'Plum',
        ocean: 'Ocean',
        forest: 'Forest',
        ember: 'Ember',
    };

    let previewTheme;

    function savedTheme() {
        try {
            const theme = JSON.parse(localStorage.getItem(storageKey))?.profile?.imageTheme;
            if (typeof theme === 'string' && Object.hasOwn(options, theme)) return theme;
        } catch {
            // The default also covers unavailable storage and unreadable profiles.
        }
        return defaultTheme;
    }

    function sync() {
        if (typeof document !== 'undefined') document.documentElement.dataset.theme = previewTheme ?? savedTheme();
    }

    if (typeof window !== 'undefined') {
        sync();
        window.addEventListener('pageshow', sync);
        window.addEventListener('storage', event => {
            if (event.key === storageKey || event.key === null) sync();
        });
    }

    function previewSite(theme) {
        previewTheme = theme;
        sync();
    }

    function mountImageThemes(picker, preview) {
        const heading = document.createElement('strong');
        heading.textContent = 'MyList';
        const category = document.createElement('span');
        category.className = 'theme-preview-category';
        category.textContent = 'My Kinks';
        preview.append(heading, category);
        for (const [topic, rating] of [['Dominant', 'favorite'], ['Switch', 'like'], ['Submissive', 'maybe']]) {
            const row = document.createElement('span');
            row.className = 'theme-preview-row';
            row.append(topic, DBList.ratingIcon(rating, 16));
            preview.append(row);
        }

        function showSelectedTheme() {
            preview.dataset.imageTheme = picker.querySelector('input:checked').value;
        }

        for (const [theme, name] of Object.entries(options)) {
            const label = document.createElement('label');
            label.dataset.imageTheme = theme;
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'imageTheme';
            input.value = theme;
            input.defaultChecked = theme === defaultTheme;
            const swatch = document.createElement('span');
            swatch.className = 'image-theme-swatch';
            swatch.setAttribute('aria-hidden', 'true');
            label.append(input, swatch, name);
            label.addEventListener('pointerenter', event => {
                if (event.pointerType === 'mouse') preview.dataset.imageTheme = theme;
            });
            label.addEventListener('pointerleave', event => {
                if (event.pointerType === 'mouse') showSelectedTheme();
            });
            picker.append(label);
        }
        picker.addEventListener('change', event => {
            showSelectedTheme();
            previewSite(event.target.value);
        });
        showSelectedTheme();
        return showSelectedTheme;
    }

    return { storageKey, options, sync, savedTheme, previewSite, mountImageThemes };
})();
