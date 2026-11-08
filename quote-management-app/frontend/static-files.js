'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');

// Minimal static file handler for the built app (dist/). GET and HEAD only, no directory
// listings, no dotfiles, no access outside the root, and revalidation caching with ETag.
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

// Navigation routes the single-page app answers itself. Missing assets and API paths must stay 404s.
const APP_ROUTE = /^\/(?:login|support-tickets|quotes(?:\/[^/.\\]+)?)\/?$/;
const FONT_CACHE = 'public, max-age=604800';

function send(res, status, message, headers = {}) {
    res.statusCode = status;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    Object.keys(headers).forEach(name => res.setHeader(name, headers[name]));
    res.end(message);
}

function createStaticHandler({ root }) {
    const base = path.resolve(root);

    function resolveFile(pathname) {
        if (APP_ROUTE.test(pathname)) {
            return path.join(base, 'index.html');
        }
        if (pathname === '/') {
            return path.join(base, 'index.html');
        }
        const parts = pathname.split('/').filter(Boolean);
        if (!parts.length || parts.some(part => part.startsWith('.') || part.includes('\\') || part.includes('\0'))) {
            return null;
        }
        const target = path.resolve(base, ...parts);
        return target.startsWith(base + path.sep) ? target : null;
    }

    return function serveStatic(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return send(res, 405, 'Method not allowed.', { Allow: 'GET, HEAD' });
        }
        let pathname;
        try {
            pathname = decodeURIComponent(req.url.split('?')[0]);
        } catch (error) {
            return send(res, 400, 'Bad request.');
        }
        const file = resolveFile(pathname);
        if (!file) {
            return send(res, 404, 'Not found.');
        }
        fs.stat(file, (error, stats) => {
            if (error || !stats.isFile()) {
                return send(res, 404, 'Not found.');
            }
            const etag = 'W/"' + stats.size.toString(16) + '-' + Math.floor(stats.mtimeMs).toString(16) + '"';
            const lastModified = stats.mtime.toUTCString();
            res.setHeader('ETag', etag);
            res.setHeader('Last-Modified', lastModified);
            res.setHeader('Cache-Control', pathname.startsWith('/vendor/fonts/') ? FONT_CACHE : 'no-cache');
            const none = req.headers['if-none-match'];
            const since = Date.parse(req.headers['if-modified-since'] || '');
            if ((none && none.split(',').map(value => value.trim()).includes(etag)) ||
                (!none && !Number.isNaN(since) && Math.floor(stats.mtimeMs / 1000) * 1000 <= since)) {
                res.statusCode = 304;
                return res.end();
            }
            res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
            res.setHeader('Content-Length', stats.size);
            if (req.method === 'HEAD') {
                return res.end();
            }
            pipeline(fs.createReadStream(file), res, () => {});
        });
    };
}

module.exports = createStaticHandler;
