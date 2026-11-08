'use strict';

// Same suite as karma.conf.js, plus an istanbul coverage report in coverage/ui.
const base = require('./karma.conf.js');

module.exports = function(config) {
    base(config);
    config.set({
        preprocessors: { 'src/app/**/*.js': ['coverage'] },
        reporters: ['progress', 'coverage'],
        coverageReporter: {
            dir: 'coverage/ui',
            reporters: [{ type: 'html', subdir: 'html' }, { type: 'text-summary' }, { type: 'text', file: 'summary.txt', subdir: '.' }, { type: 'json', subdir: '.', file: 'coverage.json' }]
        }
    });
};
