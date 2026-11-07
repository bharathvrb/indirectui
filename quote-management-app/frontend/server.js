'use strict';

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

if (require.main === module) {
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
