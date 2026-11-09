'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { once } = require('node:events');
const createServer = require('../server');
const { listenSettings, cloudOrigin } = createServer;

test('locally the server listens on loopback 8081; PORT (set by Cloud Foundry) opens every interface', () => {
    assert.deepEqual(listenSettings({}), { port: 8081, host: '127.0.0.1' });
    assert.deepEqual(listenSettings({ PORT: '8080' }), { port: 8080, host: '0.0.0.0' });
    assert.deepEqual(listenSettings({ PORT: '8080', QM_PORT: '9000', QM_HOST: '10.0.0.5' }), { port: 9000, host: '10.0.0.5' });
    assert.deepEqual(listenSettings({ QM_PORT: '9000' }), { port: 9000, host: '127.0.0.1' });
    // On the platform, a server.properties that says 127.0.0.1:8081 must not win over the assigned port.
    assert.deepEqual(listenSettings({ VCAP_APPLICATION: '{}', PORT: '8080', QM_PORT: '8081', QM_HOST: '127.0.0.1' }), { port: 8080, host: '0.0.0.0' });
    for (const bad of ['abc', '0', '70000', '-1', '80.5']) {
        assert.equal(listenSettings({ PORT: bad }).port, 8081, bad);
    }
});

test('the public origin is taken from the platform route, only when it is a plain host name', () => {
    const vcap = uris => ({ VCAP_APPLICATION: JSON.stringify({ application_uris: uris }) });
    assert.equal(cloudOrigin(vcap(['Omw-Quote.as-g8.cf.comcast.net'])), 'https://omw-quote.as-g8.cf.comcast.net');
    assert.equal(cloudOrigin(vcap(['host.example.com/path', 'second.example.com'])), 'https://second.example.com');
    assert.equal(cloudOrigin(vcap([])), null);
    assert.equal(cloudOrigin(vcap(['bad host', 'a/b', 42, '-x.example.com'])), null);
    assert.equal(cloudOrigin({ VCAP_APPLICATION: '{not json' }), null);
    assert.equal(cloudOrigin({ VCAP_APPLICATION: '{"application_uris":"x"}' }), null);
    assert.equal(cloudOrigin({}), null);
});

test('/health answers for the platform health check without signing in', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-health-'));
    fs.writeFileSync(path.join(root, 'index.html'), '<title>QM</title>');
    const app = createServer({ root });
    app.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    t.after(() => { app.server.close(); app.server.closeAllConnections(); fs.rmSync(root, { recursive: true, force: true }); });
    const get = (target, headers = {}) => new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port: app.server.address().port, path: target, headers, agent: false }, res => {
            let text = '';
            res.on('data', chunk => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
        }).on('error', reject);
    });
    for (const target of ['/health', '/healthz']) {
        // The router's health check carries the app's public host name, which is not a loopback address.
        const response = await get(target, { host: 'omw-quote.as-g8.cf.comcast.net' });
        assert.equal(response.status, 200, target);
        assert.deepEqual(JSON.parse(response.text), { status: 'ok' });
        assert.equal(response.headers['cache-control'], 'no-store');
    }
});
