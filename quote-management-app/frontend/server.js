'use strict';

const fs = require('fs');
const path = require('path');
const httpServer = require('http-server');
const createLocalAuth = require('./local-auth');
const createQuoteDataProxy = require('./quote-data-proxy');

function spaRoutes(req, res) {
    let pathname;
    try {
        pathname = decodeURIComponent(req.url.split('?')[0]);
    } catch (error) {
        return res.emit('next');
    }

    // Restrict fallback to navigation routes; assets and API failures must stay visible.
    if ((req.method === 'GET' || req.method === 'HEAD') &&
        /^\/(?:login|support-tickets|quotes(?:\/[^/.\\]+)?)\/?$/.test(pathname)) {
        req.url = '/index.html';
    }
    res.emit('next');
}

function createServer(options = {}) {
    const localAuth = createLocalAuth({ now: options.now });
    const quoteDataProxy = createQuoteDataProxy({
        ...options.proxy, now: options.now, getUser: localAuth.getUser
    });
    return httpServer.createServer({
        root: path.join(__dirname, 'dist'),
        cache: -1,
        showDir: 'false',
        before: [localAuth, quoteDataProxy, spaRoutes]
    });
}

// Loads KEY=VALUE lines from a local properties file into process.env.
// Real environment variables win. The committed file holds placeholders only.
function loadProperties(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const loaded = [];
    text.split(/\r?\n/).forEach(function(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index < 1) return;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        // Skip unfilled placeholders such as <client secret> so a missing value is reported clearly.
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || value === '' || /^<.*>$/.test(value) || process.env[key] !== undefined) return;
        process.env[key] = value;
        loaded.push(key);
    });
    // Local login needs both values; drop a half-filled pair instead of failing startup.
    const pair = ['LOCAL_LOGIN_USERNAME', 'LOCAL_LOGIN_PASSWORD'];
    if (pair.filter(key => process.env[key] !== undefined).length === 1) {
        pair.filter(key => loaded.includes(key)).forEach(key => {
            delete process.env[key];
            loaded.splice(loaded.indexOf(key), 1);
        });
        console.warn('Local sign-in is off: set both LOCAL_LOGIN_USERNAME and LOCAL_LOGIN_PASSWORD in ' + path.basename(file) + '.');
    }
    return loaded;
}

if (require.main === module) {
    const propertiesFile = process.env.QM_PROPERTIES_FILE || path.join(__dirname, 'server.properties');
    const loaded = loadProperties(propertiesFile);
    if (loaded.length) console.log('Loaded ' + loaded.length + ' setting(s) from ' + path.basename(propertiesFile) + ': ' + loaded.join(', '));
    const server = createServer();
    server.server.on('error', function(error) {
        console.error('Could not start the frontend server: ' + error.message);
        process.exitCode = 1;
    });
    server.listen(8081, '127.0.0.1', function() {
        console.log('QuoteData workspace: http://127.0.0.1:8081/ (Ctrl+C to stop)');
    });
}

module.exports = createServer;
