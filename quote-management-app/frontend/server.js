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
        root: options.root || path.join(__dirname, 'dist'),
        cache: -1,
        showDir: 'false',
        before: [localAuth, quoteDataProxy, spaRoutes]
    });
}

// Loads KEY=VALUE lines from a local properties file into process.env.
// Real environment variables win. The committed file holds placeholders only.
function loadProperties(file, env = process.env) {
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
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || value === '' || /^<.*>$/.test(value) || env[key] !== undefined) return;
        env[key] = value;
        loaded.push(key);
    });
    // Local login needs both values; drop a half-filled pair instead of failing startup.
    const pair = ['LOCAL_LOGIN_USERNAME', 'LOCAL_LOGIN_PASSWORD'];
    if (pair.filter(key => env[key] !== undefined).length === 1) {
        pair.filter(key => loaded.includes(key)).forEach(key => {
            delete env[key];
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
    const server = createServer({ proxy: { log: console.log } });
    server.server.on('error', function(error) {
        console.error('Could not start the frontend server: ' + error.message);
        process.exitCode = 1;
    });
    const host = process.env.QM_HOST || '127.0.0.1';
    const port = Number(process.env.QM_PORT || 8081);
    const external = createLocalAuth.publicOrigin();
    if (process.env.QM_PUBLIC_ORIGIN && !external) {
        console.warn('QM_PUBLIC_ORIGIN must be an origin such as https://quotes.example.com; it is ignored.');
    }
    if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !external) {
        console.warn('QM_HOST=' + host + ' without QM_PUBLIC_ORIGIN: browsers on other machines will be refused.');
    }
    server.listen(port, host, function() {
        console.log('Quote Management: ' + (external ? external.origin : 'http://127.0.0.1:' + port) +
            '/ (listening on ' + host + ':' + port + ', Ctrl+C to stop)');
    });
}

module.exports = createServer;
module.exports.loadProperties = loadProperties;
