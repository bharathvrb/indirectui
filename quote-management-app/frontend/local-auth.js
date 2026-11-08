'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = 'qm_local_session';
const SESSION_SECONDS = 3600;
const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_ENTRIES = 256;
const MAX_PENDING_LOGINS = 8;

function credentialsFromEnvironment() {
    const username = process.env.LOCAL_LOGIN_USERNAME;
    const password = process.env.LOCAL_LOGIN_PASSWORD;
    if (username === undefined && password === undefined) {
        return { enabled: false };
    }
    if (username === undefined || password === undefined ||
        !username.length || username.length > 128 ||
        !password.length || password.length > 1024) {
        throw new Error('Local login requires both LOCAL_LOGIN_USERNAME (1–128 characters) ' +
            'and LOCAL_LOGIN_PASSWORD (1–1024 characters).');
    }
    const salt = crypto.randomBytes(32);
    return {
        enabled: true,
        username,
        salt,
        digest: crypto.scryptSync(JSON.stringify([username, password]), salt, 64)
    };
}

function isLoopback(address) {
    if (address === '::1') {
        return true;
    }
    const ipv4 = (address || '').replace(/^::ffff:/i, '');
    return net.isIP(ipv4) === 4 && ipv4.startsWith('127.');
}

// QM_PUBLIC_ORIGIN (e.g. https://quotes.example.com) opens the app to other machines. Without it,
// only browsers on this machine are accepted. Either way requests must come from the app's own origin.
function publicOrigin() {
    const value = process.env.QM_PUBLIC_ORIGIN;
    if (!value) {
        return null;
    }
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
            url.pathname !== '/' || url.search || url.hash) {
            return null;
        }
        return url;
    } catch (error) {
        return null;
    }
}

function matchesPublicOrigin(req) {
    const url = publicOrigin();
    return !!url && typeof req.headers.host === 'string' && req.headers.host.toLowerCase() === url.host.toLowerCase() ? url : null;
}

function isLocalRequest(req) {
    const fetchSite = req.headers['sec-fetch-site'];
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        return false;
    }
    const origin = req.headers.origin;
    const configured = matchesPublicOrigin(req);
    if (configured) {
        return (origin === undefined && req.method !== 'POST') || origin === configured.origin;
    }
    if (!isLoopback(req.socket.remoteAddress)) {
        return false;
    }
    const host = req.headers.host;
    if (typeof host !== 'string' ||
        !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[1-9]\d{0,4})?$/i.test(host)) {
        return false;
    }
    let expectedOrigin;
    try {
        const protocol = req.socket.encrypted ? 'https:' : 'http:';
        const url = new URL(protocol + '//' + host);
        const port = Number(url.port || (req.socket.encrypted ? 443 : 80));
        if (port !== req.socket.localPort) {
            return false;
        }
        expectedOrigin = url.origin;
    } catch (error) {
        return false;
    }
    return (origin === undefined && req.method !== 'POST') || origin === expectedOrigin;
}

function json(res, status, value) {
    res.statusCode = status;
    res.end(JSON.stringify(value));
}

function isSecure(req) {
    const configured = matchesPublicOrigin(req);
    return configured ? configured.protocol === 'https:' : !!req.socket.encrypted;
}

function cookie(req, token, maxAge, cookiePath = '/') {
    return COOKIE_NAME + '=' + token + '; Path=' + cookiePath + '; Max-Age=' + maxAge +
        '; HttpOnly; SameSite=Strict' + (isSecure(req) ? '; Secure' : '');
}

function sessionHashes(req) {
    return (req.headers.cookie || '').split(';')
        .map(part => part.trim())
        .filter(part => part.startsWith(COOKIE_NAME + '='))
        .map(part => {
            const token = part.slice(COOKIE_NAME.length + 1);
            return /^[A-Za-z0-9_-]{43}$/.test(token) ?
                crypto.createHash('sha256').update(token).digest('hex') : null;
        });
}

function sessionHash(req) {
    const hashes = sessionHashes(req);
    return hashes.length === 1 ? hashes[0] : null;
}

function sessionCookies(req, token, maxAge) {
    // Retire the old scoped cookie so browsers never send ambiguous session cookies.
    return [cookie(req, token, maxAge), cookie(req, '', 0, '/auth/local')];
}

function requestError(status, message) {
    return Object.assign(new Error(message), { status });
}

function readBody(req) {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') ||
        (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
        return Promise.reject(requestError(400, 'A JSON request body is required.'));
    }
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
        return Promise.reject(requestError(413, 'Request body is too large.'));
    }
    return new Promise((resolve, reject) => {
        let chunks = [];
        let size = 0;
        const timer = setTimeout(() => finish(requestError(408, 'Request timed out.')), 10000);
        timer.unref();

        function finish(error, value) {
            clearTimeout(timer);
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            req.removeListener('aborted', onAborted);
            req.removeListener('error', onError);
            chunks = [];
            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        }
        function onData(chunk) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                finish(requestError(413, 'Request body is too large.'));
            } else {
                chunks.push(chunk);
            }
        }
        function onEnd() {
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (!body || Array.isArray(body) ||
                    typeof body.username !== 'string' || typeof body.password !== 'string' ||
                    body.username.length > 128 || body.password.length > 1024) {
                    throw new Error('Invalid body');
                }
                finish(null, body);
            } catch (error) {
                finish(requestError(400, 'Invalid sign-in request.'));
            }
        }
        function onAborted() {
            finish(requestError(400, 'Request was interrupted.'));
        }
        function onError() {
            finish(requestError(400, 'Request could not be read.'));
        }
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('aborted', onAborted);
        req.once('error', onError);
    });
}

function createLocalAuth(options = {}) {
    const credentials = credentialsFromEnvironment();
    const now = options.now || Date.now;
    const sessions = new Map();
    const attempts = new Map();
    let pendingLogins = 0;

    function state(expiresAt = null) {
        return {
            enabled: credentials.enabled,
            authenticated: expiresAt !== null,
            user: expiresAt === null ? null : {
                name: credentials.username,
                username: credentials.username,
                authType: 'local'
            },
            expiresAt
        };
    }

    function cleanup() {
        const timestamp = now();
        for (const [hash, expiresAt] of sessions) {
            if (expiresAt <= timestamp) {
                sessions.delete(hash);
            }
        }
        for (const [address, attempt] of attempts) {
            if (attempt.resetAt <= timestamp && attempt.pending === 0) {
                attempts.delete(address);
            }
        }
    }

    function throttled(res, seconds) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(seconds))));
        json(res, 429, { message: 'Too many sign-in attempts. Try again later.' });
    }

    async function login(req, res) {
        const address = req.socket.remoteAddress;
        let attempt = attempts.get(address);
        if (attempt && attempt.failures + attempt.pending >= MAX_FAILURES) {
            return throttled(res, (attempt.resetAt - now()) / 1000);
        }
        if (pendingLogins >= MAX_PENDING_LOGINS ||
            (!attempt && attempts.size >= MAX_ENTRIES)) {
            return throttled(res, 1);
        }
        if (!attempt) {
            attempt = { failures: 0, pending: 0, resetAt: now() + RATE_WINDOW_MS };
            attempts.set(address, attempt);
        }
        attempt.pending++;
        pendingLogins++;
        let successful = false;
        try {
            const body = await readBody(req);
            const digest = await scrypt(JSON.stringify([body.username, body.password]), credentials.salt, 64);
            const matches = crypto.timingSafeEqual(digest, credentials.digest);
            digest.fill(0);
            if (!matches) {
                return json(res, 401, { message: 'Incorrect username or password.' });
            }
            if (res.destroyed || res.writableEnded) {
                return;
            }
            cleanup();
            sessionHashes(req).forEach(hash => sessions.delete(hash));
            if (sessions.size >= MAX_ENTRIES) {
                sessions.delete(sessions.keys().next().value);
            }
            const token = crypto.randomBytes(32).toString('base64url');
            const hash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = now() + SESSION_SECONDS * 1000;
            sessions.set(hash, expiresAt);
            successful = true;
            res.setHeader('Set-Cookie', sessionCookies(req, token, SESSION_SECONDS));
            json(res, 200, state(expiresAt));
        } catch (error) {
            json(res, error.status || 500, {
                message: error.status ? error.message : 'Local sign-in is unavailable.'
            });
        } finally {
            attempt.pending--;
            pendingLogins--;
            if (!successful) {
                attempt.failures++;
            }
        }
    }

    function localAuth(req, res) {
        const pathname = req.url.split('?')[0];
        if (pathname !== '/auth/local' && !pathname.startsWith('/auth/local/')) {
            return res.emit('next');
        }
        // Union buffers requests by default. Disable it before reading the native stream.
        req.buffer = false;
        const request = req.request || req;
        const response = res.response || res;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        if (!isLocalRequest(request)) {
            return json(response, 403, { message: 'Local authentication request is not allowed.' });
        }
        cleanup();
        const method = {
            '/auth/local/session': 'GET',
            '/auth/local/login': 'POST',
            '/auth/local/logout': 'POST'
        }[pathname];
        if (!method) {
            return json(response, 404, { message: 'Not found.' });
        }
        if (request.method !== method) {
            response.setHeader('Allow', method);
            return json(response, 405, { message: 'Method not allowed.' });
        }
        const hash = sessionHash(request);
        if (pathname === '/auth/local/session') {
            return json(response, 200, state(sessions.get(hash) || null));
        }
        if (pathname === '/auth/local/logout') {
            sessionHashes(request).forEach(value => sessions.delete(value));
            response.setHeader('Set-Cookie', sessionCookies(request, '', 0));
            return json(response, 200, state());
        }
        if (!credentials.enabled) {
            return json(response, 404, { message: 'Local sign-in is unavailable.' });
        }
        return login(request, response);
    }

    localAuth.getUser = function(req) {
        const request = req.request || req;
        if (!credentials.enabled || !isLocalRequest(request)) {
            return null;
        }
        cleanup();
        const expiresAt = sessions.get(sessionHash(request));
        return expiresAt ? state(expiresAt).user : null;
    };
    return localAuth;
}

module.exports = createLocalAuth;
module.exports.isLocalRequest = isLocalRequest;
module.exports.publicOrigin = publicOrigin;
