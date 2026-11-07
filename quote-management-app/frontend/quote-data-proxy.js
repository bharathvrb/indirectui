'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const { isLocalRequest } = require('./local-auth');
const createSsoIdentity = require('./sso-identity');

const TOKEN_URL = 'https://sat-ci.codebig2.net/v2/ws/token.oauth2';
const BASE_URL = 'https://quotedata-flx.as-g8.cf.comcast.net/quotedata/v1';
const MAX_TOKEN_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_ERROR_BYTES = 16 * 1024;
const MAX_BODY_BYTES = 8192;
const QUERY_KEYS = new Set([
    'quoteRequestId', 'externalId', 'proposalId', 'ticketNumber', 'page', 'size', 'sort', 'search', 'state',
    'designStatus', 'category', 'channelType', 'createdFrom', 'createdTo'
]);

function failure(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

// Service URLs must be HTTPS. Plain HTTP is accepted only for loopback test servers or, for the
// QuoteData base URL, when QUOTEDATA_ALLOW_HTTP=true is set explicitly (internal hosts without TLS).
function configuredUrl(value, allowLoopbackHttp, allowHttp) {
    const url = new URL(value);
    const testLoopback = allowLoopbackHttp && url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !testLoopback && !(allowHttp && url.protocol === 'http:')) ||
        url.username || url.password || url.search || url.hash ||
        value.includes('?') || value.includes('#')) {
        throw new Error('Invalid service URL');
    }
    return url;
}

function serviceConfiguration(options) {
    const environment = options.environment || process.env;
    try {
        const clientId = environment.QUOTEDATA_CLIENT_ID;
        const clientSecret = environment.QUOTEDATA_CLIENT_SECRET;
        const scope = environment.QUOTEDATA_SCOPE;
        if (![clientId, clientSecret, scope].every(value =>
            typeof value === 'string' && value.trim().length && value.length <= 8192)) {
            return null;
        }
        return {
            clientId, clientSecret, scope,
            tokenUrl: configuredUrl(environment.QUOTEDATA_TOKEN_URL === undefined ?
                TOKEN_URL : environment.QUOTEDATA_TOKEN_URL, options.allowLoopbackHttp === true),
            baseUrl: configuredUrl(environment.QUOTEDATA_BASE_URL === undefined ?
                BASE_URL : environment.QUOTEDATA_BASE_URL, options.allowLoopbackHttp === true,
            environment.QUOTEDATA_ALLOW_HTTP === 'true')
        };
    } catch (error) {
        return null;
    }
}

function upstreamRequest(url, { method = 'GET', headers, body, limit, timeoutMs, signal, readErrorCode = false }) {
    return new Promise((resolve, reject) => {
        let response;
        let settled = false;
        let size = 0;
        let chunks = [];
        const transport = url.protocol === 'https:' ? https : http;
        const request = transport.request(url, { method, headers, signal, agent: false });
        const timer = setTimeout(() => finish(new Error('Upstream timeout')), timeoutMs);
        timer.unref();

        function finish(error, result) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            chunks = [];
            if (error || (result && (result.status < 200 || result.status >= 300))) {
                if (response) {
                    response.destroy();
                }
                request.destroy();
            }
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        }
        request.on('error', () => finish(new Error('Upstream request failed')));
        request.on('response', incoming => {
            response = incoming;
            response.on('error', () => finish(new Error('Upstream response failed')));
            response.on('aborted', () => finish(new Error('Upstream response interrupted')));
            const status = response.statusCode;
            const inspectError = readErrorCode && status === 400;
            const responseLimit = inspectError ? MAX_ERROR_BYTES : limit;
            // Only recognize allowlisted backend error codes; never relay raw messages or follow redirects.
            if ((status < 200 || status >= 300) && !inspectError) {
                return finish(null, { status });
            }
            if (Number(response.headers['content-length']) > responseLimit ||
                (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
                return inspectError ? finish(null, { status }) : finish(new Error('Invalid upstream response'));
            }
            response.on('data', chunk => {
                size += chunk.length;
                if (size > responseLimit) {
                    if (inspectError) {
                        finish(null, { status });
                    } else {
                        finish(new Error('Upstream response too large'));
                    }
                } else {
                    chunks.push(chunk);
                }
            });
            response.on('end', () => {
                if (settled) {
                    return;
                }
                if (status === 204) {
                    return finish(null, { status, body: null });
                }
                try {
                    if (!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(
                        response.headers['content-type'] || '')) {
                        throw new Error('JSON required');
                    }
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (inspectError) {
                        const errorCode = body && Array.isArray(body.errors) &&
                            body.errors.some(error => error && error.code === 'MISSING_PARAMETER') ?
                            'MISSING_PARAMETER' : undefined;
                        finish(null, { status, errorCode });
                    } else {
                        finish(null, { status, body });
                    }
                } catch (error) {
                    if (inspectError) {
                        finish(null, { status });
                    } else {
                        finish(new Error('Invalid upstream JSON'));
                    }
                }
            });
        });
        request.end(body);
    });
}

// Caches the service token in memory until shortly before expiry and shares one
// in-flight token request between concurrent callers.
function createTokenProvider(config, options) {
    const now = options.now || Date.now;
    const SKEW_MS = 10000;
    let cached = null;
    let pending = null;

    async function issue() {
        try {
            const form = new URLSearchParams({
                grant_type: 'client_credentials', client_id: config.clientId,
                client_secret: config.clientSecret, scope: config.scope
            }).toString();
            const response = await upstreamRequest(config.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json', 'Content-Length': Buffer.byteLength(form)
                },
                body: form, limit: MAX_TOKEN_BYTES, timeoutMs: options.tokenTimeoutMs || 10000
            });
            const body = response.body;
            const lifetime = body && /^\d+(?:\.\d+)?$/.test(String(body.expires_in)) ? Number(body.expires_in) : 0;
            if (response.status !== 200 || !body ||
                typeof body.access_token !== 'string' || body.access_token.length > 16384 ||
                !/^[A-Za-z0-9._~+/-]+=*$/.test(body.access_token) ||
                typeof body.token_type !== 'string' || body.token_type.toLowerCase() !== 'bearer' ||
                !(lifetime > 0)) {
                throw new Error('Invalid token response');
            }
            return { value: body.access_token, expiresAt: now() + lifetime * 1000 - SKEW_MS };
        } catch (error) {
            throw failure(502, 'SERVICE_TOKEN_FAILED',
                'The server could not obtain QuoteData service authorization. Contact the service administrator.');
        }
    }

    return {
        get() {
            if (cached && now() < cached.expiresAt) {
                return Promise.resolve(cached);
            }
            if (!pending) {
                pending = issue().then(token => {
                    cached = token;
                    return token;
                }).finally(() => {
                    pending = null;
                });
            }
            return pending;
        },
        invalidate(token) {
            if (cached && (!token || cached.value === token.value)) {
                cached = null;
            }
        }
    };
}

function routeFor(req) {
    const [pathname, query = ''] = req.url.split('?');
    let method;
    let suffix;
    if (pathname === '/api/quotedata/v1/quote') {
        method = 'GET';
        suffix = '/quote';
    } else if (/^\/api\/quotedata\/v1\/quote\/[A-Za-z0-9_-]{1,200}\/complete$/.test(pathname)) {
        method = 'POST';
        suffix = pathname.slice('/api/quotedata/v1'.length);
    } else {
        throw failure(404, 'NOT_FOUND', 'This API route is not available.');
    }
    if (req.method !== method) {
        throw Object.assign(failure(405, 'METHOD_NOT_ALLOWED', 'This request method is not allowed.'), { allow: method });
    }
    if (req.url.split('?').length > 2 || req.url.includes('#') || Buffer.byteLength(query) > 4096 ||
        (method === 'POST' && query)) {
        throw failure(400, 'INVALID_REQUEST', 'Invalid QuoteData query.');
    }
    try {
        if (/[\u0000-\u001f\u007f]/.test(decodeURIComponent(query))) {
            throw new Error('Invalid query characters');
        }
        const params = new URLSearchParams(query);
        const seen = new Set();
        for (const [key, value] of params) {
            if (!QUERY_KEYS.has(key) || seen.has(key) || value.length > 1024) {
                throw new Error('Invalid query parameter');
            }
            seen.add(key);
        }
    } catch (error) {
        throw failure(400, 'INVALID_REQUEST', 'Invalid QuoteData query.');
    }
    if (method === 'GET' && (req.headers['transfer-encoding'] || Number(req.headers['content-length']) > 0)) {
        throw failure(400, 'INVALID_REQUEST', 'GET requests must not contain a body.');
    }
    return suffix + (query ? '?' + query : '');
}

function readCompletion(req, signal, timeoutMs) {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') ||
        (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
        return Promise.reject(failure(400, 'INVALID_REQUEST', 'A JSON completion request is required.'));
    }
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
        return Promise.reject(failure(413, 'REQUEST_TOO_LARGE', 'The completion request is too large.'));
    }
    return new Promise((resolve, reject) => {
        let chunks = [];
        let size = 0;
        let settled = false;
        const interrupted = () => finish(failure(400, 'INVALID_REQUEST', 'The request was interrupted.'));
        const timer = setTimeout(() => finish(failure(408, 'REQUEST_TIMEOUT', 'The request timed out.')), timeoutMs);
        timer.unref();
        function finish(error, body) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            req.removeListener('error', interrupted);
            req.removeListener('aborted', interrupted);
            signal.removeEventListener('abort', interrupted);
            chunks = [];
            if (error) {
                req.resume();
                reject(error);
            } else {
                resolve(body);
            }
        }
        function onData(chunk) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                finish(failure(413, 'REQUEST_TOO_LARGE', 'The completion request is too large.'));
            } else {
                chunks.push(chunk);
            }
        }
        function onEnd() {
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (!body || Array.isArray(body) || Object.keys(body).length !== 1 ||
                    typeof body.resolutionNote !== 'string' ||
                    !body.resolutionNote.trim().length || body.resolutionNote.length > 1000) {
                    throw new Error('Invalid resolution note');
                }
                finish(null, JSON.stringify({ resolutionNote: body.resolutionNote.trim() }));
            } catch (error) {
                finish(failure(400, 'INVALID_REQUEST', 'Provide a resolutionNote of 1–1000 characters.'));
            }
        }
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('error', interrupted);
        req.once('aborted', interrupted);
        signal.addEventListener('abort', interrupted, { once: true });
        if (signal.aborted) {
            interrupted();
        } else {
            req.resume();
        }
    });
}

function backendFailure(status, errorCode) {
    if (status === 400 && errorCode === 'MISSING_PARAMETER') {
        return failure(400, 'MISSING_PARAMETER',
            'At least one of quoteRequestId, externalId, or proposalId is required.');
    }
    const known = {
        401: [502, 'UPSTREAM_UNAUTHORIZED', 'QuoteData rejected the server service authorization. Contact the service administrator.'],
        403: [403, 'UPSTREAM_FORBIDDEN', 'The service account is not permitted to access this QuoteData operation.'],
        404: [404, 'QUOTE_NOT_FOUND', 'The requested quote was not found.'],
        409: [409, 'QUOTE_CONFLICT', 'The quote state conflicts with this operation.'],
        400: [400, 'UPSTREAM_BAD_REQUEST', 'QuoteData rejected the request.'],
        429: [429, 'UPSTREAM_RATE_LIMITED', 'QuoteData is temporarily rate limited. Try again later.']
    };
    return failure(...(known[status] || [502, 'UPSTREAM_FAILED', 'QuoteData is unavailable or returned an invalid response.']));
}

function createQuoteDataProxy(options = {}) {
    const config = serviceConfiguration(options);
    const tokens = config ? createTokenProvider(config, options) : null;
    const getUser = options.getUser || (() => null);
    const verifyIdentity = createSsoIdentity({
        environment: options.environment, now: options.now, jwks: options.jwks
    });

    async function handle(req, res, trackingId, signal) {
        const suffix = routeFor(req);
        if (!isLocalRequest(req)) {
            throw failure(403, 'REQUEST_FORBIDDEN', 'Only same-origin loopback requests are allowed.');
        }
        let identity = Promise.resolve();
        if (!getUser(req)) {
            const authorization = req.headers.authorization || '';
            const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization);
            if (!match || authorization.length > 16384) {
                throw failure(401, 'SIGN_IN_REQUIRED', 'Sign in to access QuoteData.');
            }
            identity = verifyIdentity(match[1]);
        }
        // Union starts streaming after dispatch, so attach bounded body readers before awaiting SSO.
        const [, body] = await Promise.all([
            identity,
            req.method === 'POST' ? readCompletion(req, signal, options.bodyTimeoutMs || 10000) : undefined
        ]);
        if (signal.aborted) {
            return;
        }
        if (!config) {
            throw failure(503, 'SERVICE_AUTH_NOT_CONFIGURED',
                'Configure server QUOTEDATA_CLIENT_ID, QUOTEDATA_CLIENT_SECRET and QUOTEDATA_SCOPE, and valid HTTPS service URLs.');
        }
        const url = new URL(config.baseUrl.href.replace(/\/$/, '') + suffix);
        let token = await tokens.get();
        for (let attempt = 0; attempt < 2; attempt++) {
            if (signal.aborted) {
                return;
            }
            let response;
            try {
                response = await upstreamRequest(url, {
                    method: req.method,
                    headers: {
                        Authorization: 'Bearer ' + token.value, trackingId, Accept: 'application/json',
                        ...(body === undefined ? {} : {
                            'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
                        })
                    },
                    body, limit: MAX_RESPONSE_BYTES, timeoutMs: options.upstreamTimeoutMs || 30000,
                    signal, readErrorCode: true
                });
            } catch (error) {
                throw backendFailure(502);
            }
            if (response.status === 401) {
                tokens.invalidate(token);
                if (req.method === 'GET' && attempt === 0) {
                    token = await tokens.get();
                    continue;
                }
            }
            if (response.status < 200 || response.status >= 300) {
                throw backendFailure(response.status, response.errorCode);
            }
            res.statusCode = response.status;
            res.end(response.status === 204 ? undefined : JSON.stringify(response.body));
            return;
        }
    }

    return function quoteDataProxy(req, res) {
        const pathname = req.url.split('?')[0];
        if (pathname !== '/api' && !pathname.startsWith('/api/')) {
            return res.emit('next');
        }
        req.buffer = false;
        const request = req.request || req;
        const response = res.response || res;
        const suppliedTrackingId = request.headers.trackingid;
        const trackingId = typeof suppliedTrackingId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(suppliedTrackingId) ?
            suppliedTrackingId : crypto.randomUUID();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('trackingId', trackingId);
        const controller = new AbortController();
        const disconnect = () => controller.abort();
        response.once('close', disconnect);
        request.once('aborted', disconnect);
        handle(request, response, trackingId, controller.signal).catch(error => {
            if (!response.destroyed && !response.writableEnded) {
                const safe = error.code && error.status ? error : backendFailure(502);
                if (safe.allow) {
                    response.setHeader('Allow', safe.allow);
                }
                response.statusCode = safe.status;
                response.end(JSON.stringify({ code: safe.code, message: safe.message, trackingId }));
            }
        }).finally(() => {
            controller.abort();
            response.removeListener('close', disconnect);
            request.removeListener('aborted', disconnect);
            request.resume();
        });
    };
}

module.exports = createQuoteDataProxy;
