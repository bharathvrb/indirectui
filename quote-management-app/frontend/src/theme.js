(function(window, document) {
    'use strict';
    var preference = 'light';
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var textSize = 'auto';

    function valid(value) {
        return ['light', 'dark', 'system'].indexOf(value) !== -1;
    }

    function apply() {
        var resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.setAttribute('data-bs-theme', resolved);
    }

    function validSize(value) {
        return ['auto', 'compact', 'normal', 'large'].indexOf(value) !== -1;
    }

    // "Auto" picks compact text on narrower viewports (laptops, or screens running at
    // 125-150% OS scaling, where the same CSS pixels look larger) and normal otherwise.
    function resolveSize() {
        if (textSize !== 'auto') return textSize;
        return window.innerWidth < 1600 ? 'compact' : 'normal';
    }

    function applySize() {
        document.documentElement.setAttribute('data-text-size', resolveSize());
    }

    try {
        var savedSize = window.localStorage.getItem('omw-text-size');
        if (validSize(savedSize)) textSize = savedSize;
    } catch (error) {
        console.warn('Text size storage is unavailable; using automatic text size.', error.name);
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
        },
        getTextSize: function() { return textSize; },
        getResolvedTextSize: resolveSize,
        setTextSize: function(value) {
            if (!validSize(value)) throw new Error('Unsupported text size.');
            textSize = value;
            applySize();
            try {
                window.localStorage.setItem('omw-text-size', textSize);
            } catch (error) {
                console.warn('Text size changed for this session but could not be saved.', error.name);
            }
        }
    };
    media.addEventListener('change', apply);
    window.addEventListener('resize', function() { if (textSize === 'auto') applySize(); });
    apply();
    applySize();
}(window, document));
