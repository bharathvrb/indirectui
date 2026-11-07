'use strict';

const fs = require('fs');
const path = require('path');

if (!process.env.CHROME_BIN && process.platform === 'win32') {
    const roots = [
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
        process.env.LOCALAPPDATA
    ].filter(Boolean);
    const browsers = [
        ['Google', 'Chrome', 'Application', 'chrome.exe'],
        ['Microsoft', 'Edge', 'Application', 'msedge.exe']
    ];
    for (const browser of browsers) {
        const executable = roots.map(root => path.join(root, ...browser)).find(file => fs.existsSync(file));
        if (executable) {
            process.env.CHROME_BIN = executable;
            break;
        }
    }
}

module.exports = function(config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        files: [
            'node_modules/angular/angular.js',
            'node_modules/angular-route/angular-route.js',
            'node_modules/angular-sanitize/angular-sanitize.js',
            'node_modules/angular-animate/angular-animate.js',
            'node_modules/angular-mocks/angular-mocks.js',
            'src/config.js',
            'src/theme.js',
            'src/app/app.js',
            'src/app/services/**/*.js',
            'src/app/components/**/*.js',
            { pattern: 'src/app/**/*.html', included: false, served: true },
            'tests/**/*.spec.js'
        ],
        exclude: [
            'src/**/bootstrap.js'
        ],
        browsers: ['ChromeHeadless'],
        reporters: ['progress'],
        hostname: '127.0.0.1',
        listenAddress: '127.0.0.1',
        singleRun: true,
        autoWatch: false
    });
};
