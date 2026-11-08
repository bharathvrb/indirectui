'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { once } = require('node:events');
const createServer = require('../server');

// Starts the app over a throwaway dist/ folder (plus a secret file one level above it).
async function start(t, options = {}) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-static-'));
    const root = path.join(parent, 'dist');
    fs.mkdirSync(path.join(root, 'vendor', 'fonts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>QM</title>');
    fs.writeFileSync(path.join(root, 'app.js'), 'window.ok = true;');
    fs.writeFileSync(path.join(root, 'style.css'), 'body{}');
    fs.writeFileSync(path.join(root, 'data.bin'), 'x');
    fs.writeFileSync(path.join(root, '.env'), 'SECRET=1');
    fs.writeFileSync(path.join(root, 'vendor', 'fonts', 'a.woff2'), 'font');
    fs.writeFileSync(path.join(parent, 'outside.txt'), 'outside');
    const app = createServer({ root, ...options });
    app.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    t.after(() => { app.server.close(); app.server.closeAllConnections(); fs.rmSync(parent, { recursive: true, force: true }); });
    return app.server.address().port;
}

// Raw request so the client never normalises ".." segments.
function request(port, target, { method = 'GET', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: target, method, headers, agent: false }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end();
    });
}

test('serves files with the right type and revalidation caching, fonts for a week', async t => {
    const port = await start(t);
    const js = await request(port, '/app.js');
    assert.equal(js.status, 200);
    assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(js.headers['cache-control'], 'no-cache');
    assert.equal((await request(port, '/style.css')).headers['content-type'], 'text/css; charset=utf-8');
    assert.equal((await request(port, '/data.bin')).headers['content-type'], 'application/octet-stream');
    const font = await request(port, '/vendor/fonts/a.woff2');
    assert.equal(font.headers['content-type'], 'font/woff2');
    assert.equal(font.headers['cache-control'], 'public, max-age=604800');
});

test('ETag and Last-Modified give 304 on revalidation; HEAD sends headers only', async t => {
    const port = await start(t);
    const first = await request(port, '/app.js');
    assert.ok(first.headers.etag);
    const cached = await request(port, '/app.js', { headers: { 'If-None-Match': first.headers.etag } });
    assert.equal(cached.status, 304);
    assert.equal(cached.text, '');
    assert.equal((await request(port, '/app.js', { headers: { 'If-None-Match': 'W/"other"' } })).status, 200);
    const since = await request(port, '/app.js', { headers: { 'If-Modified-Since': first.headers['last-modified'] } });
    assert.equal(since.status, 304);
    const head = await request(port, '/app.js', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.text, '');
    assert.equal(head.headers['content-length'], String('window.ok = true;'.length));
});

test('refuses traversal, dotfiles, directories, bad encodings and unsupported methods', async t => {
    const port = await start(t);
    for (const target of ['/../outside.txt', '/%2e%2e/outside.txt', '/sub/../../outside.txt', '/..%2foutside.txt',
        '/.env', '/%2eenv', '/vendor/../.env', '/sub', '/sub/', '/vendor/fonts', '/a%00b', '/..%5coutside.txt']) {
        const response = await request(port, target);
        assert.notEqual(response.status, 200, target);
        assert.doesNotMatch(response.text, /outside|SECRET/, target);
    }
    assert.equal((await request(port, '/%E0%A4%A')).status, 400);
    const post = await request(port, '/app.js', { method: 'PUT' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
});

test('unknown paths are 404 text, never the app shell', async t => {
    const port = await start(t);
    const missing = await request(port, '/nope.js');
    assert.equal(missing.status, 404);
    assert.equal(missing.headers['cache-control'], 'no-store');
    assert.doesNotMatch(missing.text, /<title>/);
});

test('/healthz answers without authentication and is never cached', async t => {
    const port = await start(t);
    const health = await request(port, '/healthz');
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.text), { status: 'ok' });
    assert.equal(health.headers['cache-control'], 'no-store');
    const head = await request(port, '/healthz', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.text, '');
    assert.notEqual((await request(port, '/healthz', { method: 'POST' })).status, 200);
});

test('every response carries the security headers and a CSP that allows only this app and Microsoft sign-in', async t => {
    const port = await start(t);
    for (const target of ['/', '/app.js', '/healthz', '/missing', '/api/quotes']) {
        const { headers } = await request(port, target);
        assert.equal(headers['x-content-type-options'], 'nosniff', target);
        assert.equal(headers['x-frame-options'], 'DENY', target);
        assert.equal(headers['referrer-policy'], 'no-referrer', target);
        assert.match(headers['permissions-policy'], /camera=\(\)/, target);
        assert.equal(headers['cross-origin-opener-policy'], 'same-origin', target);
        assert.equal(headers['cross-origin-resource-policy'], 'same-origin', target);
        assert.equal(headers['content-security-policy'], createServer.DEFAULT_CSP, target);
        assert.equal(headers['strict-transport-security'], undefined, target);
    }
    const csp = createServer.DEFAULT_CSP;
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.doesNotMatch(csp, /unsafe-eval|script-src[^;]*unsafe-inline/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /connect-src 'self' https:\/\/login\.microsoftonline\.com/);
});

test('the CSP can be replaced or switched off, and HSTS appears only behind an https public origin', async t => {
    const custom = await start(t, { csp: "default-src 'none'" });
    assert.equal((await request(custom, '/')).headers['content-security-policy'], "default-src 'none'");
    const off = await start(t, { csp: 'off' });
    assert.equal((await request(off, '/')).headers['content-security-policy'], undefined);

    const previous = process.env.QM_PUBLIC_ORIGIN;
    t.after(() => { if (previous === undefined) delete process.env.QM_PUBLIC_ORIGIN; else process.env.QM_PUBLIC_ORIGIN = previous; });
    process.env.QM_PUBLIC_ORIGIN = 'https://quotes.example.com';
    const secure = await start(t);
    assert.match((await request(secure, '/')).headers['strict-transport-security'], /max-age=31536000/);
    process.env.QM_PUBLIC_ORIGIN = 'http://quotes.example.com';
    const plain = await start(t);
    assert.equal((await request(plain, '/')).headers['strict-transport-security'], undefined);
});
