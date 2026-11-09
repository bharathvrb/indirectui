'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadProperties } = require('../server');

function file(t, text) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-properties-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const target = path.join(dir, 'server.properties');
    fs.writeFileSync(target, text);
    return target;
}

test('loads KEY=VALUE lines, skipping comments, blanks, invalid keys and empty values', t => {
    const env = {};
    const loaded = loadProperties(file(t, [
        '# comment', '', '  QUOTEDATA_CLIENT_ID = synthetic-client  ', 'QUOTEDATA_SCOPE=a:b=c',
        'lower_case=ignored', '=novalue', 'NO_EQUALS', 'EMPTY_VALUE='
    ].join('\n')), env);
    assert.deepEqual(loaded, ['QUOTEDATA_CLIENT_ID', 'QUOTEDATA_SCOPE']);
    assert.deepEqual(env, { QUOTEDATA_CLIENT_ID: 'synthetic-client', QUOTEDATA_SCOPE: 'a:b=c' });
});

test('real environment variables win over the file', t => {
    const env = { QUOTEDATA_SCOPE: 'from-environment' };
    assert.deepEqual(loadProperties(file(t, 'QUOTEDATA_SCOPE=from-file\nSSO_TENANT_ID=tenant\n'), env), ['SSO_TENANT_ID']);
    assert.equal(env.QUOTEDATA_SCOPE, 'from-environment');
});

test('unfilled <placeholder> values are ignored', t => {
    const env = {};
    assert.deepEqual(loadProperties(file(t, 'QUOTEDATA_CLIENT_SECRET=<client_secret from the requirement document>\nA_B=<x>y\n'), env), ['A_B']);
    assert.equal(env.QUOTEDATA_CLIENT_SECRET, undefined);
});

test('a half-filled local login pair is dropped with a warning instead of failing startup', t => {
    const warnings = [];
    t.mock.method(console, 'warn', message => warnings.push(message));
    const env = {};
    assert.deepEqual(loadProperties(file(t, 'LOCAL_LOGIN_USERNAME=bharath\nLOCAL_LOGIN_PASSWORD=<choose a password>\nSSO_CLIENT_ID=id\n'), env), ['SSO_CLIENT_ID']);
    assert.deepEqual(env, { SSO_CLIENT_ID: 'id' });
    assert.equal(warnings.length, 1);
    const complete = {};
    assert.deepEqual(loadProperties(file(t, 'LOCAL_LOGIN_USERNAME=bharath\nLOCAL_LOGIN_PASSWORD=secret\n'), complete),
        ['LOCAL_LOGIN_USERNAME', 'LOCAL_LOGIN_PASSWORD']);
    const fromEnvironment = { LOCAL_LOGIN_PASSWORD: 'env-secret' };
    loadProperties(file(t, 'LOCAL_LOGIN_USERNAME=bharath\n'), fromEnvironment);
    assert.deepEqual(fromEnvironment, { LOCAL_LOGIN_PASSWORD: 'env-secret', LOCAL_LOGIN_USERNAME: 'bharath' });
});

test('a missing file loads nothing, Windows line endings work, and the committed file holds no real secret', t => {
    assert.deepEqual(loadProperties(path.join(os.tmpdir(), 'qm-missing-' + Date.now()), {}), []);
    const env = {};
    loadProperties(file(t, 'QUOTEDATA_SCOPE=s\r\nSSO_CLIENT_ID=c\r\n'), env);
    assert.deepEqual(env, { QUOTEDATA_SCOPE: 's', SSO_CLIENT_ID: 'c' });
    const committed = fs.readFileSync(path.join(__dirname, '..', 'server.properties'), 'utf8');
    assert.match(committed, /^QUOTEDATA_CLIENT_SECRET=<[^>]+>$/m);
    assert.match(committed, /^LOCAL_LOGIN_PASSWORD=<[^>]+>$/m);
});

// ---- Static hosting and SPA route fallback ----
const http = require('node:http');
const { once } = require('node:events');
const createServer = require('../server');

async function staticServer(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-dist-'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>QM</title>');
    fs.writeFileSync(path.join(root, 'app.js'), 'window.ok = true;');
    const app = createServer({ root }).server;
    app.listen(0, '127.0.0.1');
    await once(app, 'listening');
    t.after(() => { app.close(); app.closeAllConnections(); fs.rmSync(root, { recursive: true, force: true }); });
    return app.address().port;
}

function get(port, pathname, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method, agent: false }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end();
    });
}

test('case links and app routes serve the single-page app; assets, unknown and API paths do not', async t => {
    const port = await staticServer(t);
    for (const route of ['/', '/login', '/search', '/search/', '/quotes', '/quotes/', '/support-tickets', '/quotes/PARTNER-QUOTE-1?tab=errors']) {
        const response = await get(port, route);
        assert.equal(response.status, 200, route);
        assert.match(response.text, /<title>QM<\/title>/, route);
    }
    assert.equal((await get(port, '/quotes/Q-1', 'HEAD')).status, 200);
    assert.equal((await get(port, '/app.js')).text, 'window.ok = true;');
    for (const route of ['/missing.js', '/quotes/a/b', '/quotes/file.js', '/unknown', '/%E0%A4%A']) {
        const response = await get(port, route);
        assert.notEqual(response.status, 200, route);
    }
    assert.equal((await get(port, '/quotes/Q-1', 'POST')).status !== 200, true);
});
