'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');
const createServer = require('../server');
const createLocalAuth = require('../local-auth');

// Random synthetic fixtures are never used outside this test process.
const username = 'fixture-' + crypto.randomBytes(8).toString('hex');
const password = crypto.randomBytes(24).toString('base64url');
const validBody = { username, password };
const invalidBody = { username, password: crypto.randomBytes(24).toString('base64url') };
const signedOut = { enabled: true, authenticated: false, user: null, expiresAt: null };
const disabled = { ...signedOut, enabled: false };

function configured(factory, environment = {}) {
    const variables = ['NODE_ENV', 'LOCAL_LOGIN_USERNAME', 'LOCAL_LOGIN_PASSWORD'];
    const previous = Object.fromEntries(variables.map(name => [name, process.env[name]]));
    try {
        for (const name of variables) {
            if (environment[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = environment[name];
            }
        }
        return factory();
    } finally {
        for (const name of variables) {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        }
    }
}

const enabledEnvironment = {
    NODE_ENV: 'development',
    LOCAL_LOGIN_USERNAME: username,
    LOCAL_LOGIN_PASSWORD: password
};

async function start(t, options = {}) {
    const server = configured(() => createServer({ now: options.now, proxy: { environment: {} } }),
        options.environment || enabledEnvironment).server;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
    }));
    return { server, port: server.address().port };
}

function request(app, pathname, options = {}) {
    const method = options.method || 'GET';
    const hostname = options.hostname || '127.0.0.1';
    const headers = { host: hostname + ':' + app.port };
    if (method !== 'GET' && options.origin !== false) {
        headers.origin = 'http://' + hostname + ':' + app.port;
    }
    let body;
    if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        headers['content-type'] = 'application/json';
    } else if (options.raw !== undefined) {
        body = options.raw;
        headers['content-type'] = 'application/json';
    }
    if (body !== undefined && !options.chunked) {
        headers['content-length'] = Buffer.byteLength(body);
    }
    Object.assign(headers, options.headers);
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1', port: app.port, method, path: pathname, headers, agent: false
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('error', reject);
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    text,
                    body: /^application\/json/.test(res.headers['content-type']) && text ?
                        JSON.parse(text) : null
                });
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('Test request timed out')));
        if (body !== undefined) {
            if (options.chunked) {
                req.write(body.slice(0, 100));
                req.write(body.slice(100));
                req.end();
            } else {
                req.end(body);
            }
        } else {
            req.end();
        }
    });
}

function signIn(app, options = {}) {
    return request(app, '/auth/local/login', { method: 'POST', body: validBody, ...options });
}

function sessionCookie(response) {
    return response.headers['set-cookie'][0].split(';')[0];
}

function assertAuthResponse(response, status) {
    assert.equal(response.status, status);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['content-type'], /^application\/json/);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
}

test('username/password sign-in also works when NODE_ENV=production', async t => {
    const app = await start(t, { environment: { ...enabledEnvironment, NODE_ENV: 'production' } });
    const session = await request(app, '/auth/local/session');
    assert.equal(session.body.enabled, true);
    assertAuthResponse(await signIn(app), 200);
});

test('local login is optional and logout remains idempotent', async t => {
    for (const environment of [{}]) {
        const app = await start(t, { environment });
        const session = await request(app, '/auth/local/session');
        assertAuthResponse(session, 200);
        assert.deepEqual(session.body, disabled);
        assertAuthResponse(await signIn(app), 404);
        const logout = await request(app, '/auth/local/logout', { method: 'POST' });
        assertAuthResponse(logout, 200);
        assert.deepEqual(logout.body, disabled);
        assert.match(logout.headers['set-cookie'][0], /Max-Age=0; HttpOnly; SameSite=Strict/);
    }
});

test('incomplete or invalid configuration fails explicitly without echoing credentials', () => {
    for (const environment of [
        { LOCAL_LOGIN_USERNAME: username },
        { LOCAL_LOGIN_PASSWORD: password },
        { ...enabledEnvironment, LOCAL_LOGIN_PASSWORD: '' },
        { ...enabledEnvironment, LOCAL_LOGIN_USERNAME: '' },
        { ...enabledEnvironment, LOCAL_LOGIN_USERNAME: 'x'.repeat(129) },
        { ...enabledEnvironment, LOCAL_LOGIN_PASSWORD: 'x'.repeat(1025) }
    ]) {
        assert.throws(() => configured(createServer, environment), error => {
            assert.match(error.message, /requires both LOCAL_LOGIN_USERNAME/);
            assert.equal(error.message.includes(username), false);
            assert.equal(error.message.includes(password), false);
            return true;
        });
    }
});

test('login, reload, rotation and idempotent logout work on both supported browser hosts', async t => {
    for (const hostname of ['127.0.0.1', 'localhost']) {
        let timestamp = 1700000000000;
        const app = await start(t, { now: () => timestamp });
        assert.deepEqual((await request(app, '/auth/local/session', { hostname })).body, signedOut);
        const login = await signIn(app, {
            hostname, headers: { 'content-type': 'application/json;charset=utf-8' }
        });
        assertAuthResponse(login, 200);
        assert.deepEqual(login.body, {
            enabled: true, authenticated: true,
            user: { name: username, username, authType: 'local' },
            expiresAt: timestamp + 3600000
        });
        assert.match(login.headers['set-cookie'][0],
            /^qm_local_session=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=3600; HttpOnly; SameSite=Strict$/);
        assert.match(login.headers['set-cookie'][1], /^qm_local_session=; Path=\/auth\/local; Max-Age=0;/);
        assert.equal(login.text.includes(password), false);
        const originalCookie = sessionCookie(login);
        const reload = await request(app, '/auth/local/session', {
            hostname, headers: { cookie: originalCookie }
        });
        assertAuthResponse(reload, 200);
        assert.deepEqual(reload.body, login.body);
        timestamp++;
        const rotated = await signIn(app, { hostname, headers: { cookie: originalCookie } });
        assertAuthResponse(rotated, 200);
        const currentCookie = sessionCookie(rotated);
        assert.notEqual(currentCookie, originalCookie);
        assert.deepEqual((await request(app, '/auth/local/session', {
            hostname, headers: { cookie: originalCookie }
        })).body, signedOut);
        for (let count = 0; count < 2; count++) {
            const logout = await request(app, '/auth/local/logout', {
                hostname, method: 'POST', headers: { cookie: currentCookie }
            });
            assertAuthResponse(logout, 200);
            assert.deepEqual(logout.body, signedOut);
            assert.match(logout.headers['set-cookie'][0], /^qm_local_session=; Path=\/; Max-Age=0;/);
            assert.match(logout.headers['set-cookie'][1], /^qm_local_session=; Path=\/auth\/local; Max-Age=0;/);
        }
        assert.deepEqual((await request(app, '/auth/local/session', {
            hostname, headers: { cookie: currentCookie }
        })).body, signedOut);
    }
});

test('wrong and empty credentials have the same generic response and do not clear a valid session', async t => {
    const app = await start(t);
    const cookie = sessionCookie(await signIn(app));
    for (const body of [
        invalidBody,
        { username: 'unknown-' + username, password },
        { username: '', password: '' }
    ]) {
        const response = await signIn(app, { body, headers: { cookie } });
        assertAuthResponse(response, 401);
        assert.deepEqual(response.body, { message: 'Incorrect username or password.' });
        assert.equal(response.headers['set-cookie'], undefined);
        assert.equal(response.text.includes(username), false);
        assert.equal(response.text.includes(password), false);
    }
    assert.equal((await request(app, '/auth/local/session', { headers: { cookie } })).body.authenticated, true);
});

test('credential shapes and lengths, malformed JSON and form posts are rejected', async t => {
    let timestamp = 1700000000000;
    const app = await start(t, { now: () => timestamp });
    for (const body of [
        null, [], {}, { username: 1, password }, { username, password: {} },
        { username: 'x'.repeat(129), password }, { username, password: 'x'.repeat(1025) }
    ]) {
        timestamp += 300000;
        assertAuthResponse(await signIn(app, { body }), 400);
    }
    assertAuthResponse(await signIn(app, { body: undefined, raw: '{' }), 400);
    assertAuthResponse(await signIn(app, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
    }), 400);
    assertAuthResponse(await signIn(app, { headers: { 'content-encoding': 'gzip' } }), 400);
});

test('both declared and chunked request bodies are bounded to 4 KiB', async t => {
    const app = await start(t);
    for (const chunked of [false, true]) {
        const response = await signIn(app, {
            body: undefined, raw: ' '.repeat(4097), chunked
        });
        assertAuthResponse(response, 413);
    }
    const exact = JSON.stringify(validBody).padEnd(4096, ' ');
    assertAuthResponse(await signIn(app, { body: undefined, raw: exact, chunked: true }), 200);
});

test('invalid Host, Origin and fetch metadata cannot read or change local authentication', async t => {
    const app = await start(t);
    const cookie = sessionCookie(await signIn(app));
    for (const headers of [
        { host: 'attacker.invalid:' + app.port },
        { host: '127.0.0.1.attacker.invalid:' + app.port },
        { host: 'localhost:1' },
        { origin: 'https://attacker.invalid' },
        { origin: 'null' },
        { origin: 'http://localhost:' + app.port },
        { origin: 'http://127.0.0.1:1' },
        { 'sec-fetch-site': 'cross-site' },
        { 'sec-fetch-site': 'same-site' }
    ]) {
        assertAuthResponse(await signIn(app, { headers }), 403);
        assertAuthResponse(await request(app, '/auth/local/session', {
            headers: { cookie, ...headers }
        }), 403);
        assertAuthResponse(await request(app, '/auth/local/logout', {
            method: 'POST', headers: { cookie, ...headers }
        }), 403);
    }
    assertAuthResponse(await signIn(app, { origin: false }), 403);
    assertAuthResponse(await request(app, '/auth/local/logout', {
        method: 'POST', origin: false, headers: { cookie }
    }), 403);
    assert.equal((await request(app, '/auth/local/session', { headers: { cookie } })).body.authenticated, true);
});

test('non-loopback clients are rejected even with a spoofed local Host and forwarding headers', () => {
    const middleware = configured(createLocalAuth, enabledEnvironment);
    const headers = {};
    let payload;
    const response = {
        setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
        end: value => { payload = JSON.parse(value); }
    };
    middleware({
        url: '/auth/local/session', method: 'GET',
        headers: { host: 'localhost:8081', 'x-forwarded-for': '127.0.0.1' },
        socket: { remoteAddress: '192.0.2.1', localPort: 8081 }
    }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(headers['cache-control'], 'no-store');
    assert.deepEqual(payload, { message: 'Local authentication request is not allowed.' });
});

test('HTTPS cookies are Secure and forwarded protocol headers are not trusted', async t => {
    const middleware = configured(createLocalAuth, enabledEnvironment);
    const headers = {};
    const response = {
        setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
        end: () => {}
    };
    middleware({
        url: '/auth/local/logout', method: 'POST',
        headers: { host: 'localhost:8443', origin: 'https://localhost:8443' },
        socket: { remoteAddress: '::1', localPort: 8443, encrypted: true }
    }, response);
    assert.equal(response.statusCode, 200);
    headers['set-cookie'].forEach(value => assert.match(value, /; Secure$/));
    const app = await start(t);
    const login = await signIn(app, { headers: { 'x-forwarded-proto': 'https' } });
    assertAuthResponse(login, 200);
    assert.doesNotMatch(login.headers['set-cookie'][0], /Secure/);
});

test('session expiry is enforced server-side and sessions are isolated between server instances', async t => {
    let timestamp = 1700000000000;
    const app = await start(t, { now: () => timestamp });
    const cookie = sessionCookie(await signIn(app));
    const restarted = await start(t, { now: () => timestamp });
    assert.deepEqual((await request(restarted, '/auth/local/session', {
        headers: { cookie }
    })).body, signedOut);
    timestamp += 3599999;
    assert.equal((await request(app, '/auth/local/session', { headers: { cookie } })).body.authenticated, true);
    timestamp++;
    assert.deepEqual((await request(app, '/auth/local/session', { headers: { cookie } })).body, signedOut);
    assertAuthResponse(await signIn(app), 200);
});

test('five failed sign-ins throttle subsequent requests until the window expires', async t => {
    let timestamp = 1700000000000;
    const app = await start(t, { now: () => timestamp });
    for (let attempt = 0; attempt < 5; attempt++) {
        assertAuthResponse(await signIn(app, { body: invalidBody }), 401);
    }
    const blocked = await signIn(app);
    assertAuthResponse(blocked, 429);
    assert.equal(blocked.headers['retry-after'], '300');
    timestamp += 299001;
    const stillBlocked = await signIn(app);
    assertAuthResponse(stillBlocked, 429);
    assert.equal(stillBlocked.headers['retry-after'], '1');
    assert.deepEqual((await request(app, '/auth/local/session')).body, signedOut);
    timestamp += 999;
    assertAuthResponse(await signIn(app), 200);
});

test('parallel failed sign-ins cannot bypass rate limiting', async t => {
    const app = await start(t);
    const responses = await Promise.all(Array.from({ length: 10 },
        () => signIn(app, { body: invalidBody })));
    assert.equal(responses.filter(response => response.status === 401).length, 5);
    assert.equal(responses.filter(response => response.status === 429).length, 5);
    for (const response of responses.filter(result => result.status === 429)) {
        assert.ok(Number(response.headers['retry-after']) > 0);
    }
});

test('unsupported methods and unknown auth routes return JSON rather than static content', async t => {
    const app = await start(t);
    for (const [pathname, method, allow] of [
        ['/auth/local/session', 'POST', 'GET'],
        ['/auth/local/login', 'GET', 'POST'],
        ['/auth/local/logout', 'GET', 'POST'],
        ['/auth/local/login', 'OPTIONS', 'POST'],
        ['/auth/local/session', 'DELETE', 'GET']
    ]) {
        const response = await request(app, pathname, { method });
        assertAuthResponse(response, 405);
        assert.equal(response.headers.allow, allow);
    }
    assertAuthResponse(await request(app, '/auth/local/unknown'), 404);
    const head = await request(app, '/auth/local/session', { method: 'HEAD', origin: false });
    assertAuthResponse(head, 405);
    assert.equal(head.text, '');
    assertAuthResponse(await request(app, '/auth/local/login', {
        method: 'OPTIONS', origin: false
    }), 405);
    for (const pathname of ['/api/does-not-exist', '/quotedata/v1/quote', '/missing.js', '/not-a-route']) {
        const response = await request(app, pathname);
        assert.equal(response.status, 404);
        assert.doesNotMatch(response.text, /ng-app|<html/i);
    }
});

test('invalid, forged and duplicate session cookies never authenticate', async t => {
    const app = await start(t);
    const cookie = sessionCookie(await signIn(app));
    for (const value of [
        'qm_local_session=invalid',
        'qm_local_session=' + crypto.randomBytes(32).toString('base64url'),
        cookie + '; ' + cookie
    ]) {
        assert.deepEqual((await request(app, '/auth/local/session', {
            headers: { cookie: value }
        })).body, signedOut);
    }
});

test('successful login and logout retire scoped legacy cookies and invalidate all presented sessions', async t => {
    const app = await start(t);
    const oldCookie = sessionCookie(await signIn(app));
    const rootCookie = sessionCookie(await signIn(app));
    const migrated = await signIn(app, { headers: { cookie: oldCookie + '; ' + rootCookie } });
    assertAuthResponse(migrated, 200);
    assert.match(migrated.headers['set-cookie'][0], /; Path=\/; Max-Age=3600;/);
    assert.match(migrated.headers['set-cookie'][1], /; Path=\/auth\/local; Max-Age=0;/);
    for (const cookie of [oldCookie, rootCookie]) {
        assert.deepEqual((await request(app, '/auth/local/session', { headers: { cookie } })).body, signedOut);
    }
    const migratedCookie = sessionCookie(migrated);
    const anotherCookie = sessionCookie(await signIn(app));
    const logout = await request(app, '/auth/local/logout', {
        method: 'POST', headers: { cookie: migratedCookie + '; ' + anotherCookie }
    });
    assert.equal(logout.headers['set-cookie'].length, 2);
    logout.headers['set-cookie'].forEach(value => assert.match(value, /; Max-Age=0;/));
    for (const cookie of [migratedCookie, anotherCookie]) {
        assert.deepEqual((await request(app, '/auth/local/session', { headers: { cookie } })).body, signedOut);
    }
});


function middlewareCall(middleware, req) {
    const headers = {};
    let payload;
    const response = {
        setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
        end: value => { payload = value ? JSON.parse(value) : null; }
    };
    middleware(req, response);
    return { status: response.statusCode, headers, payload };
}

function withPublicOrigin(t, value) {
    const previous = process.env.QM_PUBLIC_ORIGIN;
    process.env.QM_PUBLIC_ORIGIN = value;
    t.after(() => {
        if (previous === undefined) {
            delete process.env.QM_PUBLIC_ORIGIN;
        } else {
            process.env.QM_PUBLIC_ORIGIN = previous;
        }
    });
}

test('with QM_PUBLIC_ORIGIN, browsers on other machines can use the app from that origin only', t => {
    withPublicOrigin(t, 'https://quotes.example.test');
    const middleware = configured(createLocalAuth, enabledEnvironment);
    const remote = { remoteAddress: '192.0.2.10', localPort: 8081 };
    const ok = middlewareCall(middleware, {
        url: '/auth/local/logout', method: 'POST', socket: remote,
        headers: { host: 'quotes.example.test', origin: 'https://quotes.example.test' }
    });
    assert.equal(ok.status, 200);
    ok.headers['set-cookie'].forEach(value => assert.match(value, /; Secure$/));
    assert.equal(middlewareCall(middleware, {
        url: '/auth/local/session', method: 'GET', socket: remote, headers: { host: 'QUOTES.example.test' }
    }).status, 200);
    for (const headers of [
        { host: 'quotes.example.test', origin: 'https://attacker.invalid' },
        { host: 'quotes.example.test', origin: 'http://quotes.example.test' },
        { host: 'quotes.example.test' },
        { host: 'other.example.test', origin: 'https://other.example.test' },
        { host: 'quotes.example.test', origin: 'https://quotes.example.test', 'sec-fetch-site': 'cross-site' }
    ]) {
        assert.equal(middlewareCall(middleware, { url: '/auth/local/logout', method: 'POST', socket: remote, headers }).status, 403);
    }
    // Local development access keeps working alongside the public origin.
    assert.equal(middlewareCall(middleware, {
        url: '/auth/local/session', method: 'GET', socket: { remoteAddress: '127.0.0.1', localPort: 8081 },
        headers: { host: '127.0.0.1:8081' }
    }).status, 200);
});

test('an http public origin does not mark cookies Secure, and invalid public origins are ignored', t => {
    withPublicOrigin(t, 'http://quotes.example.test:8081');
    const middleware = configured(createLocalAuth, enabledEnvironment);
    const result = middlewareCall(middleware, {
        url: '/auth/local/logout', method: 'POST', socket: { remoteAddress: '192.0.2.10', localPort: 8081 },
        headers: { host: 'quotes.example.test:8081', origin: 'http://quotes.example.test:8081' }
    });
    assert.equal(result.status, 200);
    result.headers['set-cookie'].forEach(value => assert.doesNotMatch(value, /Secure/));
    for (const invalid of ['quotes.example.test', 'ftp://quotes.example.test', 'https://quotes.example.test/app',
        'https://user:pw@quotes.example.test', 'https://quotes.example.test/?a=1']) {
        process.env.QM_PUBLIC_ORIGIN = invalid;
        assert.equal(createLocalAuth.publicOrigin(), null, invalid);
        assert.equal(middlewareCall(middleware, {
            url: '/auth/local/session', method: 'GET', socket: { remoteAddress: '192.0.2.10', localPort: 8081 },
            headers: { host: 'quotes.example.test' }
        }).status, 403, invalid);
    }
});
