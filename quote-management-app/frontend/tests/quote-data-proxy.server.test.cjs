'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');
const createServer = require('../server');
const createQuoteDataProxy = require('../quote-data-proxy');

// All credentials, keys, tokens and records in this file are synthetic and process-local.
const username = 'fixture-' + crypto.randomUUID();
const password = crypto.randomBytes(32).toString('base64url');
const clientId = 'client +' + crypto.randomUUID();
const clientSecret = crypto.randomBytes(32).toString('base64') + '&=+%';
const scope = 'synthetic.read synthetic.write';
const tenantId = crypto.randomUUID();
const ssoClientId = crypto.randomUUID();
const quoteRoute = '/api/quotedata/v1/quote';
const completionRoute = quoteRoute + '/synthetic-quote/complete';
let signingFixture;

async function keys() {
    if (!signingFixture) {
        signingFixture = import('jose').then(async jose => {
            const pair = await jose.generateKeyPair('RS256', { extractable: true });
            const jwk = { ...await jose.exportJWK(pair.publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
            return { jose, ...pair, jwks: jose.createLocalJWKSet({ keys: [jwk] }) };
        });
    }
    return signingFixture;
}

async function identity(overrides = {}, options = {}) {
    const { jose, privateKey } = await keys();
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        sub: 'synthetic-user', tid: tenantId, iat: now, exp: now + 3600,
        iss: 'https://login.microsoftonline.com/' + tenantId + '/v2.0',
        aud: ssoClientId, ...overrides
    };
    for (const [key, value] of Object.entries(claims)) {
        if (value === undefined) {
            delete claims[key];
        }
    }
    return new jose.SignJWT(claims).setProtectedHeader({
        alg: options.alg || 'RS256', kid: 'fixture-key'
    }).sign(options.key || privateKey);
}

function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function listen(t, server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
    }));
    return { server, port: server.address().port };
}

async function upstream(t, options = {}) {
    const state = { tokenCalls: [], backendCalls: [], issued: [] };
    const app = await listen(t, http.createServer((req, res) => {
        (async () => {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const call = {
                method: req.method, url: req.url, headers: req.headers,
                raw: Buffer.concat(chunks).toString('utf8')
            };
            if (req.url === '/oauth/token') {
                state.tokenCalls.push(call);
                if (options.token) {
                    return options.token(req, res, state, call);
                }
                const token = crypto.randomBytes(32).toString('base64url');
                state.issued.push(token);
                return json(res, 200, { access_token: token, token_type: 'Bearer', expires_in: 100 });
            }
            state.backendCalls.push(call);
            if (options.backend) {
                return options.backend(req, res, state, call);
            }
            return json(res, 200, { quoteRequestId: 'synthetic-quote', state: 'NEW' });
        })().catch(() => res.destroy());
    }));
    return { ...app, ...state };
}

function localEnvironment(factory, enabled = true) {
    const values = {
        NODE_ENV: 'development',
        LOCAL_LOGIN_USERNAME: enabled ? username : undefined,
        LOCAL_LOGIN_PASSWORD: enabled ? password : undefined
    };
    const previous = {};
    for (const name of Object.keys(values)) {
        previous[name] = process.env[name];
        if (values[name] === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = values[name];
        }
    }
    try {
        return factory();
    } finally {
        for (const name of Object.keys(values)) {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        }
    }
}

async function start(t, backend, options = {}) {
    const environment = {
        QUOTEDATA_CLIENT_ID: clientId, QUOTEDATA_CLIENT_SECRET: clientSecret, QUOTEDATA_SCOPE: scope,
        QUOTEDATA_TOKEN_URL: 'http://127.0.0.1:' + backend.port + '/oauth/token',
        QUOTEDATA_BASE_URL: 'http://127.0.0.1:' + backend.port + '/quotedata/v1',
        SSO_CLIENT_ID: ssoClientId, SSO_TENANT_ID: tenantId,
        ...options.environment
    };
    const server = localEnvironment(() => createServer({
        now: options.now,
        proxy: { allowLoopbackHttp: true, ...options.proxy, environment }
    }), options.local !== false).server;
    return listen(t, server);
}

function request(app, pathname, options = {}) {
    const method = options.method || 'GET';
    const headers = { host: '127.0.0.1:' + app.port };
    if (method === 'POST' && options.origin !== false) {
        headers.origin = 'http://127.0.0.1:' + app.port;
    }
    const body = options.body === undefined ? options.raw : JSON.stringify(options.body);
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        if (!options.chunked) {
            headers['content-length'] = Buffer.byteLength(body);
        }
    }
    Object.assign(headers, options.headers);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1', port: app.port, path: pathname, method, headers, agent: false
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('error', reject);
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve({
                    status: res.statusCode, headers: res.headers, text,
                    body: /^application\/json/.test(res.headers['content-type']) && text ? JSON.parse(text) : null
                });
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('Synthetic request timed out')));
        if (options.chunked && body) {
            req.write(body.slice(0, 100));
            req.end(body.slice(100));
        } else {
            req.end(body);
        }
    });
}

async function login(app) {
    const response = await request(app, '/auth/local/login', {
        method: 'POST', body: { username, password }
    });
    assert.equal(response.status, 200);
    return response.headers['set-cookie'][0].split(';')[0];
}

function check(response, status, code) {
    assert.equal(response.status, status);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['content-type'], /^application\/json/);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
    assert.ok(response.headers.trackingid);
    if (code) {
        assert.equal(response.body.code, code);
        assert.equal(response.body.trackingId, response.headers.trackingid);
        assert.equal(response.text.includes(clientSecret), false);
        assert.equal(response.text.includes(password), false);
    }
}

test('local session accesses fixed proxy routes with service-only authorization and encoded token form', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend);
    const cookie = await login(app);
    const response = await request(app, quoteRoute + '?quoteRequestId=synthetic-quote', {
        headers: { cookie, trackingId: 'fixture-tracking' }
    });
    check(response, 200);
    assert.deepEqual(response.body, { quoteRequestId: 'synthetic-quote', state: 'NEW' });
    assert.equal(response.headers.trackingid, 'fixture-tracking');
    assert.equal(backend.tokenCalls.length, 1);
    const tokenCall = backend.tokenCalls[0];
    assert.equal(tokenCall.method, 'POST');
    assert.equal(tokenCall.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.fromEntries(new URLSearchParams(tokenCall.raw)), {
        grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope
    });
    assert.equal(tokenCall.headers.cookie, undefined);
    assert.equal(tokenCall.headers.authorization, undefined);
    const call = backend.backendCalls[0];
    assert.equal(call.url, '/quotedata/v1/quote?quoteRequestId=synthetic-quote');
    assert.equal(call.headers.authorization, 'Bearer ' + backend.issued[0]);
    assert.equal(call.headers.trackingid, 'fixture-tracking');
    assert.equal(call.headers.cookie, undefined);
    assert.equal(call.headers.origin, undefined);
    assert.equal(response.text.includes(backend.issued[0]), false);
    for (const pathname of ['/auth/local/token', '/auth/local/credentials', '/api/token', '/quote-data-proxy.js']) {
        assert.equal((await request(app, pathname, { headers: { cookie } })).status, 404);
    }
    const session = await request(app, '/auth/local/session', { headers: { cookie } });
    assert.equal(session.body.authenticated, true);
    assert.equal(session.body.access_token, undefined);
    assert.equal(session.text.includes(backend.issued[0]), false);
});

test('anonymous, forged, duplicate, expired and logged-out local sessions never obtain service tokens', async t => {
    let timestamp = Date.now();
    const backend = await upstream(t);
    const app = await start(t, backend, { now: () => timestamp });
    const cookie = await login(app);
    for (const headers of [
        {}, { cookie: 'qm_local_session=forged' }, { cookie: cookie + '; ' + cookie },
        { 'x-user': username }, { authorization: 'Bearer arbitrary-decoded-user' },
        { authorization: 'Basic arbitrary' }
    ]) {
        check(await request(app, quoteRoute, { headers }), 401, 'SIGN_IN_REQUIRED');
    }
    timestamp += 3600000;
    check(await request(app, quoteRoute, { headers: { cookie } }), 401, 'SIGN_IN_REQUIRED');
    const newCookie = await login(app);
    await request(app, '/auth/local/logout', { method: 'POST', headers: { cookie: newCookie } });
    check(await request(app, quoteRoute, { headers: { cookie: newCookie } }), 401, 'SIGN_IN_REQUIRED');
    assert.equal(backend.tokenCalls.length, 0);
    assert.equal(backend.backendCalls.length, 0);
});

test('SSO requires real RS256 verification, trusted issuer/audience/tenant and required unexpired claims', async t => {
    const { jose, jwks } = await keys();
    const backend = await upstream(t);
    const app = await start(t, backend, { local: false, proxy: { jwks } });
    const valid = await identity();
    check(await request(app, quoteRoute, { headers: { authorization: 'Bearer ' + valid } }), 200);
    assert.notEqual(backend.backendCalls[0].headers.authorization, 'Bearer ' + valid);
    assert.equal(backend.backendCalls[0].headers.cookie, undefined);
    assert.equal(backend.tokenCalls[0].raw.includes(valid), false);
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
        { iss: 'https://untrusted.invalid/' }, { aud: crypto.randomUUID() }, { tid: crypto.randomUUID() },
        { exp: now - 1 }, { exp: undefined }, { iat: undefined }, { iat: now + 600 },
        { sub: undefined }, { sub: '' }, { tid: undefined }
    ]) {
        check(await request(app, quoteRoute, {
            headers: { authorization: 'Bearer ' + await identity(claims) }
        }), 401, 'SIGN_IN_REQUIRED');
    }
    const wrongPair = await jose.generateKeyPair('RS256');
    for (const invalid of [
        await identity({}, { key: wrongPair.privateKey }),
        await identity({}, { alg: 'HS256', key: crypto.randomBytes(32) }),
        valid.split('.').slice(0, 2).join('.') + '.'
    ]) {
        check(await request(app, quoteRoute, {
            headers: { authorization: 'Bearer ' + invalid }
        }), 401, 'SIGN_IN_REQUIRED');
    }
    assert.equal(backend.backendCalls.length, 1);
    assert.equal(backend.tokenCalls.length, 1);
});

test('SSO completion preserves the request body across asynchronous identity verification', async t => {
    const { jwks } = await keys();
    const backend = await upstream(t);
    const app = await start(t, backend, { local: false, proxy: { jwks } });
    check(await request(app, completionRoute, {
        method: 'POST', headers: { authorization: 'Bearer ' + await identity() },
        body: { resolutionNote: ' Synthetic resolution ' }
    }), 200);
    assert.equal(backend.backendCalls.length, 1);
    assert.equal(backend.backendCalls[0].method, 'POST');
    assert.deepEqual(JSON.parse(backend.backendCalls[0].raw), { resolutionNote: 'Synthetic resolution' });
});

test('missing SSO configuration rejects bearer callers explicitly but local sessions still work', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend, { environment: { SSO_CLIENT_ID: undefined, SSO_TENANT_ID: undefined } });
    check(await request(app, quoteRoute, {
        headers: { authorization: 'Bearer ' + await identity() }
    }), 503, 'SSO_AUTH_NOT_CONFIGURED');
    assert.equal(backend.tokenCalls.length, 0);
    check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }), 200);
});

test('service token caching honors expiry/skew and deduplicates concurrent acquisition', async t => {
    let timestamp = Date.now();
    const backend = await upstream(t, {
        token: async (req, res, state) => {
            await new Promise(resolve => setTimeout(resolve, 25));
            const token = crypto.randomBytes(32).toString('base64url');
            state.issued.push(token);
            json(res, 200, { access_token: token, token_type: 'bearer', expires_in: '100' });
        }
    });
    const app = await start(t, backend, { now: () => timestamp });
    const headers = { cookie: await login(app) };
    const batch = async () => {
        const results = await Promise.all(Array.from({ length: 8 }, () => request(app, quoteRoute, { headers })));
        results.forEach(response => check(response, 200));
    };
    await batch();
    assert.equal(backend.tokenCalls.length, 1);
    timestamp += 89999;
    check(await request(app, quoteRoute, { headers }), 200);
    assert.equal(backend.tokenCalls.length, 1);
    timestamp++;
    await batch();
    assert.equal(backend.tokenCalls.length, 2);
    assert.equal(backend.backendCalls.at(-1).headers.authorization, 'Bearer ' + backend.issued[1]);
});

test('GET unauthorized refreshes once; a final upstream 401 becomes 502 without personal sign-in loops', async t => {
    for (const alwaysUnauthorized of [false, true]) {
        const backend = await upstream(t, {
            backend: (req, res, state) => {
                const unauthorized = alwaysUnauthorized || state.backendCalls.length === 1;
                json(res, unauthorized ? 401 : 200, unauthorized ? { secret: clientSecret } : { content: [] });
            }
        });
        const app = await start(t, backend);
        const result = await request(app, quoteRoute, { headers: { cookie: await login(app) } });
        check(result, alwaysUnauthorized ? 502 : 200, alwaysUnauthorized ? 'UPSTREAM_UNAUTHORIZED' : undefined);
        assert.equal(backend.tokenCalls.length, 2);
        assert.equal(backend.backendCalls.length, 2);
        assert.notEqual(backend.backendCalls[0].headers.authorization, backend.backendCalls[1].headers.authorization);
    }
});

test('completion is never replayed on upstream 401 and the rejected token is invalidated', async t => {
    const backend = await upstream(t, { backend: (req, res) => json(res, 401, { secret: clientSecret }) });
    const app = await start(t, backend);
    const headers = { cookie: await login(app) };
    for (let count = 1; count <= 2; count++) {
        check(await request(app, completionRoute, {
            method: 'POST', headers, body: { resolutionNote: 'Synthetic completion' }
        }), 502, 'UPSTREAM_UNAUTHORIZED');
        assert.equal(backend.tokenCalls.length, count);
        assert.equal(backend.backendCalls.length, count);
    }
});

test('meaningful backend statuses are sanitized, not replaced with successful empty results', async t => {
    for (const [upstreamStatus, expectedStatus, code] of [
        [404, 404, 'QUOTE_NOT_FOUND'], [403, 403, 'UPSTREAM_FORBIDDEN'], [409, 409, 'QUOTE_CONFLICT'],
        [400, 400, 'UPSTREAM_BAD_REQUEST'], [429, 429, 'UPSTREAM_RATE_LIMITED'], [500, 502, 'UPSTREAM_FAILED']
    ]) {
        const backend = await upstream(t, {
            backend: (req, res) => json(res, upstreamStatus, { error: clientSecret, access_token: 'synthetic-private-value' })
        });
        const app = await start(t, backend);
        const result = await request(app, quoteRoute, { headers: { cookie: await login(app) } });
        check(result, expectedStatus, code);
        assert.equal(result.text.includes('synthetic-private-value'), false);
        assert.equal(backend.backendCalls.length, 1);
    }
});

test('lookup identifier queries are forwarded exactly and missing identifiers return safe actionable 400', async t => {
    const backend = await upstream(t, {
        backend: (req, res) => {
            const params = new URL(req.url, 'http://127.0.0.1').searchParams;
            const lookup = ['quoteRequestId', 'externalId', 'proposalId'].some(key => params.has(key));
            json(res, lookup ? 404 : 400, {
                errors: [{
                    code: lookup ? 'QUOTE_NOT_FOUND' : 'MISSING_PARAMETER',
                    message: clientSecret
                }]
            });
        }
    });
    const app = await start(t, backend);
    const headers = { cookie: await login(app) };
    const missing = await request(app, quoteRoute + '?page=0&size=1&sort=createdAt,desc', { headers });
    check(missing, 400, 'MISSING_PARAMETER');
    assert.equal(missing.body.message, 'At least one of quoteRequestId, externalId, or proposalId is required.');
    for (const key of ['quoteRequestId', 'externalId', 'proposalId']) {
        const query = '?' + key + '=synthetic%20value%2B1';
        check(await request(app, quoteRoute + query, { headers }), 404, 'QUOTE_NOT_FOUND');
        assert.equal(backend.backendCalls.at(-1).url, '/quotedata/v1/quote' + query);
    }
    assert.equal(backend.tokenCalls.length, 1);
    assert.equal(backend.backendCalls.length, 4);
});

test('backend 400 details are strictly bounded and unknown or malformed errors stay generic', async t => {
    for (const body of [
        { errors: [{ code: 'UNTRUSTED_ERROR', message: clientSecret }] },
        { errors: [{ code: 'SIGN_IN_REQUIRED', message: clientSecret }] },
        { errors: [{ code: 'MISSING_PARAMETER', message: clientSecret }], padding: 'x'.repeat(16384) },
        null
    ]) {
        const backend = await upstream(t, { backend: (req, res) => json(res, 400, body) });
        const app = await start(t, backend);
        check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }),
            400, 'UPSTREAM_BAD_REQUEST');
    }
    const backend = await upstream(t, {
        backend: (req, res) => { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{'); }
    });
    const app = await start(t, backend);
    check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }),
        400, 'UPSTREAM_BAD_REQUEST');
});

test('missing or unsafe service configuration does not break login and returns actionable 503', async t => {
    const backend = await upstream(t);
    for (const environment of [
        { QUOTEDATA_CLIENT_ID: undefined }, { QUOTEDATA_CLIENT_SECRET: '' }, { QUOTEDATA_SCOPE: ' ' },
        { QUOTEDATA_TOKEN_URL: '' }, { QUOTEDATA_TOKEN_URL: 'http://untrusted.invalid/token' },
        { QUOTEDATA_TOKEN_URL: 'https://user:password@untrusted.invalid/token' },
        { QUOTEDATA_TOKEN_URL: 'https://untrusted.invalid/token?query=1' },
        { QUOTEDATA_BASE_URL: 'https://untrusted.invalid/quotedata/v1#fragment' }
    ]) {
        const app = await start(t, backend, { environment });
        check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }),
            503, 'SERVICE_AUTH_NOT_CONFIGURED');
    }
    const app = await start(t, backend, { proxy: { allowLoopbackHttp: false } });
    check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }),
        503, 'SERVICE_AUTH_NOT_CONFIGURED');
    assert.equal(backend.tokenCalls.length, 0);
});

test('token endpoint failures and malformed responses are bounded sanitized 502s and can recover', async t => {
    for (const token of [
        (req, res) => json(res, 401, { error_description: clientSecret }),
        (req, res) => json(res, 500, { error_description: clientSecret }),
        (req, res) => json(res, 200, { access_token: 'synthetic', token_type: 'MAC', expires_in: 100 }),
        (req, res) => json(res, 200, { token_type: 'Bearer', expires_in: 100 }),
        (req, res) => json(res, 200, { access_token: 'bad\r\nvalue', token_type: 'Bearer', expires_in: 100 }),
        (req, res) => json(res, 200, { access_token: 'synthetic', token_type: 'Bearer', expires_in: 0 }),
        (req, res) => json(res, 200, { access_token: 'synthetic', token_type: 'Bearer', expires_in: 'not-a-lifetime' }),
        (req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{'); },
        (req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(clientSecret); },
        (req, res) => json(res, 200, { content: 'x'.repeat(65537) }),
        (req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write(' '.repeat(65537)); res.end(); },
        (req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); res.destroy(); },
        () => {}
    ]) {
        const backend = await upstream(t, { token });
        const app = await start(t, backend, { proxy: { tokenTimeoutMs: 100 } });
        const headers = { cookie: await login(app) };
        check(await request(app, quoteRoute, { headers }), 502, 'SERVICE_TOKEN_FAILED');
        assert.equal(backend.backendCalls.length, 0);
    }
    const backend = await upstream(t, {
        token: (req, res, state) => json(res, state.tokenCalls.length === 1 ? 500 : 200,
            { access_token: 'synthetic-recovered', token_type: 'Bearer', expires_in: 100 })
    });
    const app = await start(t, backend);
    const headers = { cookie: await login(app) };
    check(await request(app, quoteRoute, { headers }), 502, 'SERVICE_TOKEN_FAILED');
    check(await request(app, quoteRoute, { headers }), 200);
    assert.equal(backend.tokenCalls.length, 2);
});

test('neither token nor backend redirects are followed, even to another loopback origin', async t => {
    const destination = await upstream(t);
    for (const stage of ['token', 'backend']) {
        const backend = await upstream(t, {
            [stage]: (req, res) => {
                res.writeHead(307, { Location: 'http://127.0.0.1:' + destination.port + '/stolen' });
                res.end();
            }
        });
        const app = await start(t, backend);
        check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }),
            502, stage === 'token' ? 'SERVICE_TOKEN_FAILED' : 'UPSTREAM_FAILED');
        assert.equal(backend.tokenCalls.length, 1);
    }
    assert.equal(destination.tokenCalls.length, 0);
    assert.equal(destination.backendCalls.length, 0);
});

test('unknown routes, methods and malformed or unbounded queries never reach upstream', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend);
    const headers = { cookie: await login(app) };
    for (const pathname of [
        '/api/quotedata/v1/token', quoteRoute + '/id/retry', quoteRoute + '/id',
        quoteRoute + '/%2e%2e/complete', quoteRoute + '/id%2fother/complete', '/api/http://untrusted.invalid'
    ]) {
        check(await request(app, pathname, { headers }), 404, 'NOT_FOUND');
    }
    for (const [pathname, method] of [[quoteRoute, 'POST'], [quoteRoute, 'DELETE'], [completionRoute, 'GET']]) {
        check(await request(app, pathname, { method, headers }), 405, 'METHOD_NOT_ALLOWED');
    }
    for (const query of [
        '?url=https%3A%2F%2Funtrusted.invalid', '?page=1&page=2', '?search=%ZZ', '?search=%0A',
        '?search=' + 'x'.repeat(1025), '?search=' + 'x'.repeat(4097), '?search=one?two', '?search=one#two'
    ]) {
        check(await request(app, quoteRoute + query, { headers }), 400, 'INVALID_REQUEST');
    }
    check(await request(app, quoteRoute, { headers, raw: '{}' }), 400, 'INVALID_REQUEST');
    check(await request(app, completionRoute + '?page=1', {
        method: 'POST', headers, body: { resolutionNote: 'Synthetic completion' }
    }), 400, 'INVALID_REQUEST');
    assert.equal(backend.tokenCalls.length, 0);
    const query = '?ticketNumber=synthetic%20ticket&page=0&size=25&sort=createdAt%2Cdesc&state=NEW' +
        '&designStatus=PENDING&category=synthetic&channelType=synthetic&createdFrom=2025-01-01&createdTo=2025-02-01&search=a%2Bb';
    check(await request(app, quoteRoute + query, { headers }), 200);
    assert.equal(backend.backendCalls[0].url, '/quotedata/v1/quote' + query);
});

test('Host, Origin, fetch metadata and POST origin requirements prevent cross-site proxy use', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend);
    const cookie = await login(app);
    for (const headers of [
        { host: 'untrusted.invalid:' + app.port }, { host: '127.0.0.1.untrusted.invalid:' + app.port },
        { host: 'localhost:1' }, { origin: 'https://untrusted.invalid' }, { origin: 'null' },
        { origin: 'http://localhost:' + app.port }, { 'sec-fetch-site': 'cross-site' },
        { 'sec-fetch-site': 'same-site' }
    ]) {
        for (const method of ['GET', 'POST']) {
            check(await request(app, method === 'POST' ? completionRoute : quoteRoute, {
                method, headers: { cookie, ...headers }, ...(method === 'POST' ? { body: { resolutionNote: 'Synthetic' } } : {})
            }), 403, 'REQUEST_FORBIDDEN');
        }
    }
    check(await request(app, completionRoute, {
        method: 'POST', origin: false, headers: { cookie }, body: { resolutionNote: 'Synthetic' }
    }), 403, 'REQUEST_FORBIDDEN');
    assert.equal(backend.tokenCalls.length, 0);
});

test('non-loopback clients cannot bypass the proxy using forwarding headers', async () => {
    const middleware = createQuoteDataProxy({ environment: {} });
    const headers = {};
    const response = new (require('node:events').EventEmitter)();
    const result = new Promise(resolve => { response.end = value => resolve(JSON.parse(value)); });
    response.setHeader = (key, value) => { headers[key.toLowerCase()] = value; };
    const request = new (require('node:events').EventEmitter)();
    Object.assign(request, {
        url: quoteRoute, method: 'GET', pause() {}, resume() {},
        headers: { host: 'localhost:8081', 'x-forwarded-for': '127.0.0.1', authorization: 'Bearer fake' },
        socket: { remoteAddress: '192.0.2.1', localPort: 8081 }
    });
    middleware(request, response);
    assert.equal((await result).code, 'REQUEST_FORBIDDEN');
    assert.equal(response.statusCode, 403);
    assert.equal(headers['cache-control'], 'no-store');
});

test('completion validates JSON, note bounds, body size and encoding before service-token acquisition', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend);
    const headers = { cookie: await login(app) };
    for (const body of [
        null, [], {}, { resolutionNote: 1 }, { resolutionNote: '' }, { resolutionNote: '   ' },
        { resolutionNote: 'x'.repeat(1001) }, { resolutionNote: 'Synthetic', url: 'https://untrusted.invalid' }
    ]) {
        check(await request(app, completionRoute, { method: 'POST', headers, body }), 400, 'INVALID_REQUEST');
    }
    for (const options of [
        { raw: '{' }, { raw: '{}' }, { raw: '{}', headers: { 'content-type': 'text/plain' } },
        { raw: '{}', headers: { 'content-encoding': 'gzip' } }
    ]) {
        check(await request(app, completionRoute, {
            method: 'POST', ...options, headers: { ...headers, ...options.headers }
        }), 400, 'INVALID_REQUEST');
    }
    for (const chunked of [true, false]) {
        check(await request(app, completionRoute, {
            method: 'POST', headers, raw: ' '.repeat(8193), chunked
        }), 413, 'REQUEST_TOO_LARGE');
    }
    assert.equal(backend.tokenCalls.length, 0);
    for (const note of ['x', 'x'.repeat(1000), '界'.repeat(1000)]) {
        check(await request(app, completionRoute, {
            method: 'POST', headers, body: { resolutionNote: note }, chunked: true
        }), 200);
    }
});

test('large JSON successes and 204 completion work, but oversized or broken backend bodies fail safely', async t => {
    for (const [handler, status] of [
        [(req, res) => json(res, 200, { payload: 'x'.repeat(1024 * 1024 + 1) }), 200],
        [(req, res) => { res.writeHead(204); res.end(); }, 204],
        [(req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 20 * 1024 * 1024 + 1 });
            res.end('{}');
        }, 502],
        [(req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{'); }, 502],
        [(req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(clientSecret); }, 502],
        [(req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); res.destroy(); }, 502],
        [() => {}, 502]
    ]) {
        const backend = await upstream(t, { backend: handler });
        const app = await start(t, backend, { proxy: { upstreamTimeoutMs: 100 } });
        const result = await request(app, status === 204 ? completionRoute : quoteRoute, {
            headers: { cookie: await login(app) }, ...(status === 204 ?
                { method: 'POST', body: { resolutionNote: 'Synthetic completion' } } : {})
        });
        check(result, status, status === 502 ? 'UPSTREAM_FAILED' : undefined);
        if (status === 200) {
            assert.equal(result.body.payload.length, 1024 * 1024 + 1);
        }
        if (status === 204) {
            assert.equal(result.text, '');
        }
    }
});

test('a stalled completion body times out before token acquisition', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend, { proxy: { bodyTimeoutMs: 50 } });
    const cookie = await login(app);
    const result = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1', port: app.port, method: 'POST', path: completionRoute, agent: false,
            headers: {
                origin: 'http://127.0.0.1:' + app.port, cookie,
                'content-type': 'application/json', 'content-length': 100
            }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
                req.destroy();
            });
        });
        req.on('error', reject);
        req.write('{');
    });
    assert.equal(result.status, 408);
    assert.equal(result.body.code, 'REQUEST_TIMEOUT');
    assert.equal(backend.tokenCalls.length, 0);
});

test('client disconnect cancels backend reads rather than replaying a completion', async t => {
    let backendStarted;
    const started = new Promise(resolve => { backendStarted = resolve; });
    let backendClosed;
    const closed = new Promise(resolve => { backendClosed = resolve; });
    const backend = await upstream(t, {
        backend: (req, res) => {
            res.on('close', backendClosed);
            backendStarted();
        }
    });
    const app = await start(t, backend);
    const cookie = await login(app);
    const body = JSON.stringify({ resolutionNote: 'Synthetic completion' });
    const req = http.request({
        hostname: '127.0.0.1', port: app.port, path: completionRoute, method: 'POST', agent: false,
        headers: {
            origin: 'http://127.0.0.1:' + app.port, cookie,
            'content-type': 'application/json', 'content-length': Buffer.byteLength(body)
        }
    });
    req.on('error', () => {});
    req.end(body);
    await started;
    req.destroy();
    await closed;
    assert.equal(backend.backendCalls.length, 1);
    assert.equal(backend.tokenCalls.length, 1);
});

test('plain HTTP QuoteData base URLs require the explicit QUOTEDATA_ALLOW_HTTP opt-in', async t => {
    const backend = await upstream(t);
    const httpBase = 'http://quotedata.invalid/quotedata/v1';
    let app = await start(t, backend, { environment: { QUOTEDATA_BASE_URL: httpBase }, proxy: { allowLoopbackHttp: false } });
    check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }), 503, 'SERVICE_AUTH_NOT_CONFIGURED');
    app = await start(t, backend, { environment: { QUOTEDATA_TOKEN_URL: 'http://token.invalid/token', QUOTEDATA_ALLOW_HTTP: 'true' }, proxy: { allowLoopbackHttp: false } });
    check(await request(app, quoteRoute, { headers: { cookie: await login(app) } }), 503, 'SERVICE_AUTH_NOT_CONFIGURED');
    assert.equal(backend.tokenCalls.length, 0);
});

const retryRoute = quoteRoute + '/synthetic-quote/steps/42/retry';

test('step retry is unavailable (501) unless QUOTEDATA_RETRY_ENABLED=true, without contacting QuoteData', async t => {
    for (const flag of [undefined, 'false', 'TRUE', '1']) {
        const backend = await upstream(t);
        const app = await start(t, backend, { environment: { QUOTEDATA_RETRY_ENABLED: flag } });
        check(await request(app, retryRoute, { method: 'POST', headers: { cookie: await login(app) } }),
            501, 'RETRY_NOT_AVAILABLE');
        assert.equal(backend.tokenCalls.length, 0);
        assert.equal(backend.backendCalls.length, 0);
    }
});

test('enabled step retry forwards one bodiless POST with service authorization and tracking ID', async t => {
    const backend = await upstream(t, { backend: (req, res) => json(res, 202, { status: 'ACCEPTED' }) });
    const app = await start(t, backend, { environment: { QUOTEDATA_RETRY_ENABLED: 'true' } });
    const result = await request(app, retryRoute, {
        method: 'POST', headers: { cookie: await login(app), trackingid: 'TRACE-RETRY' }
    });
    check(result, 202);
    assert.deepEqual(result.body, { status: 'ACCEPTED' });
    assert.equal(result.headers.trackingid, 'TRACE-RETRY');
    assert.equal(backend.backendCalls.length, 1);
    const call = backend.backendCalls[0];
    assert.equal(call.method, 'POST');
    assert.equal(call.url, '/quotedata/v1/quote/synthetic-quote/steps/42/retry');
    assert.equal(call.raw, '');
    assert.equal(call.headers['content-length'], '0');
    assert.equal(call.headers.trackingid, 'TRACE-RETRY');
    assert.equal(call.headers.authorization, 'Bearer ' + backend.issued[0]);
    assert.equal(call.headers.cookie, undefined);
});

test('step retry rejects bodies, wrong methods, malformed IDs, queries and cross-origin callers', async t => {
    const backend = await upstream(t);
    const app = await start(t, backend, { environment: { QUOTEDATA_RETRY_ENABLED: 'true' } });
    const cookie = await login(app);
    check(await request(app, retryRoute, { method: 'POST', headers: { cookie }, body: { force: true } }), 400, 'INVALID_REQUEST');
    check(await request(app, retryRoute, { headers: { cookie } }), 405, 'METHOD_NOT_ALLOWED');
    check(await request(app, retryRoute + '?force=1', { method: 'POST', headers: { cookie } }), 400, 'INVALID_REQUEST');
    for (const path of [quoteRoute + '/synthetic-quote/steps/4.2/retry', quoteRoute + '/synthetic-quote/steps//retry',
        quoteRoute + '/synthetic-quote/steps/' + 'x'.repeat(65) + '/retry', quoteRoute + '/synthetic-quote/steps/42/retry/now']) {
        check(await request(app, path, { method: 'POST', headers: { cookie } }), 404, 'NOT_FOUND');
    }
    check(await request(app, retryRoute, { method: 'POST', origin: false, headers: { cookie } }), 403, 'REQUEST_FORBIDDEN');
    check(await request(app, retryRoute, { method: 'POST', headers: { cookie, origin: 'https://outside.invalid' } }), 403, 'REQUEST_FORBIDDEN');
    check(await request(app, retryRoute, { method: 'POST' }), 401, 'SIGN_IN_REQUIRED');
    assert.equal(backend.backendCalls.length, 0);
});

test('step retry is never replayed on upstream 401 and maps conflict, not found and forbidden', async t => {
    for (const [upstreamStatus, expectedStatus, code] of [
        [401, 502, 'UPSTREAM_UNAUTHORIZED'], [409, 409, 'QUOTE_CONFLICT'], [404, 404, 'QUOTE_NOT_FOUND'],
        [403, 403, 'UPSTREAM_FORBIDDEN'], [500, 502, 'UPSTREAM_FAILED']
    ]) {
        const backend = await upstream(t, { backend: (req, res) => json(res, upstreamStatus, { secret: clientSecret }) });
        const app = await start(t, backend, { environment: { QUOTEDATA_RETRY_ENABLED: 'true' } });
        check(await request(app, retryRoute, { method: 'POST', headers: { cookie: await login(app) } }), expectedStatus, code);
        assert.equal(backend.backendCalls.length, 1);
    }
});

test('the request log line names the tracking ID, route and status without secrets', async t => {
    const lines = [];
    const backend = await upstream(t);
    const app = await start(t, backend, { proxy: { log: line => lines.push(line) } });
    check(await request(app, quoteRoute + '?quoteRequestId=Q-1', { headers: { cookie: await login(app), trackingid: 'TRACE-LOG' } }), 200);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /TRACE-LOG GET \/api\/quotedata\/v1\/quote\?quoteRequestId=Q-1 -> 200 \(\d+ ms\)$/);
    assert.equal(lines[0].includes(clientSecret), false);
    assert.equal(lines[0].includes(password), false);
});
