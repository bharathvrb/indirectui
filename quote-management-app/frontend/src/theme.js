(function(window, document) {
    'use strict';
    var preference = 'light';
    var media = window.matchMedia('(prefers-color-scheme: dark)');

    function valid(value) {
        return ['light', 'dark', 'system'].indexOf(value) !== -1;
    }

    function apply() {
        var resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.setAttribute('data-bs-theme', resolved);
    }

    try {
        var saved = window.localStorage.getItem('omw-theme');
        if (valid(saved)) preference = saved;
    } catch (error) {
        console.warn('Theme preference storage is unavailable; using the default theme.', error.name);
    }

    window.QuoteTheme = {
        getPreference: function() { return preference; },
        setPreference: function(value) {
            if (!valid(value)) throw new Error('Unsupported theme preference.');
            preference = value;
            apply();
            try {
                window.localStorage.setItem('omw-theme', preference);
            } catch (error) {
                console.warn('Theme changed for this session but could not be saved.', error.name);
            }
        }
    };
    media.addEventListener('change', apply);
    apply();
}(window, document));
