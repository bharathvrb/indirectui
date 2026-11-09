'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const createLocalAuth = require('./local-auth');
const createQuoteDataProxy = require('./quote-data-proxy');
const createStaticHandler = require('./static-files');

// Browsers may load scripts only from this app. Microsoft sign-in is the one external service.
// Inline styles are allowed because the UI sets some element styles; scripts never run inline.
const DEFAULT_CSP = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
    "font-src 'self'", "connect-src 'self' https://login.microsoftonline.com", "frame-src https://login.microsoftonline.com",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"
].join('; ');

function securityHeaders(options) {
    const csp = options.csp !== undefined ? options.csp : process.env.QM_CSP;
    const external = createLocalAuth.publicOrigin();
    const headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin'
    };
    if (csp !== 'off') {
        headers['Content-Security-Policy'] = csp || DEFAULT_CSP;
    }
    if (external && external.protocol === 'https:') {
        headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
    return headers;
}

// Runs the request through each stage in turn; a stage hands over with res.emit('next').
function createServer(options = {}) {
    const localAuth = createLocalAuth({ now: options.now });
    const quoteDataProxy = createQuoteDataProxy({
        ...options.proxy, now: options.now, getUser: localAuth.getUser
    });
    const serveStatic = createStaticHandler({ root: options.root || path.join(__dirname, 'dist') });
    const headers = securityHeaders(options);
    const stages = [localAuth, quoteDataProxy, serveStatic];

    const server = http.createServer((req, res) => {
        Object.keys(headers).forEach(name => res.setHeader(name, headers[name]));
        const pathname = req.url.split('?')[0];
        // Liveness probe for load balancers and process managers (/health is the name Cloud Foundry apps use); reveals nothing.
        if ((pathname === '/healthz' || pathname === '/health') && (req.method === 'GET' || req.method === 'HEAD')) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
        }
        let index = 0;
        const next = () => {
            const stage = stages[index++];
            res.once('next', next);
            stage(req, res);
        };
        next();
    });
    return { server, listen: (...args) => server.listen(...args) };
}

// Cloud Foundry hands the app its port in PORT and expects it to listen on every interface, so on the
// platform (VCAP_APPLICATION is set) PORT and 0.0.0.0 win even over a server.properties that says 127.0.0.1:8081.
// Elsewhere PORT alone also opens every interface; with nothing set the server stays on 127.0.0.1:8081.
function listenSettings(env = process.env) {
    const onCloud = !!env.VCAP_APPLICATION && !!env.PORT;
    const port = Number(onCloud ? env.PORT : env.QM_PORT || env.PORT || 8081);
    return {
        port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 8081,
        host: onCloud ? '0.0.0.0' : env.QM_HOST || (env.PORT ? '0.0.0.0' : '127.0.0.1')
    };
}

// On Cloud Foundry the platform names the app's route in VCAP_APPLICATION. Use the first plain host route as
// the public https origin so QM_PUBLIC_ORIGIN need not be typed. The value comes from the platform, never from
// a request. Set QM_PUBLIC_ORIGIN yourself for a custom domain or when the app has several routes.
function cloudOrigin(env = process.env) {
    if (!env.VCAP_APPLICATION) {
        return null;
    }
    try {
        const uris = JSON.parse(env.VCAP_APPLICATION).application_uris;
        const host = Array.isArray(uris) ? uris.find(uri => typeof uri === 'string' && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(uri)) : null;
        return host ? 'https://' + host.toLowerCase() : null;
    } catch (error) {
        return null;
    }
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
    if (!process.env.QM_PUBLIC_ORIGIN) {
        const derived = cloudOrigin();
        if (derived) {
            process.env.QM_PUBLIC_ORIGIN = derived;
            console.log('Public address taken from the platform route: ' + derived);
        }
    }
    const server = createServer({ proxy: { log: console.log } });
    server.server.on('error', function(error) {
        console.error('Could not start the frontend server: ' + error.message);
        process.exitCode = 1;
    });
    const { host, port } = listenSettings();
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
    // Finish in-flight requests, then exit; force exit if something hangs.
    ['SIGINT', 'SIGTERM'].forEach(function(signal) {
        process.once(signal, function() {
            console.log(signal + ' received, shutting down.');
            server.server.close(function() { process.exit(0); });
            server.server.closeIdleConnections();
            setTimeout(function() { process.exit(1); }, 10000).unref();
        });
    });
}

module.exports = createServer;
module.exports.DEFAULT_CSP = DEFAULT_CSP;
module.exports.loadProperties = loadProperties;
module.exports.listenSettings = listenSettings;
module.exports.cloudOrigin = cloudOrigin;
