'use strict';

function identityError(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

function createSsoIdentity(options = {}) {
    const environment = options.environment || process.env;
    const clientId = environment.SSO_CLIENT_ID;
    const tenantId = environment.SSO_TENANT_ID;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const configured = uuid.test(clientId || '') && uuid.test(tenantId || '');
    const issuer = 'https://login.microsoftonline.com/' + tenantId + '/v2.0';
    const now = options.now || Date.now;
    let verifier;

    return async function verifyIdentity(token) {
        if (!configured) {
            throw identityError(503, 'SSO_AUTH_NOT_CONFIGURED',
                'Configure server SSO_CLIENT_ID and SSO_TENANT_ID to match the approved frontend registration.');
        }
        try {
            if (!verifier) {
                verifier = import('jose').then(jose => ({
                    jwtVerify: jose.jwtVerify,
                    jwks: options.jwks || jose.createRemoteJWKSet(
                        new URL('https://login.microsoftonline.com/' + tenantId + '/discovery/v2.0/keys'),
                        { timeoutDuration: 10000, cooldownDuration: 30000, cacheMaxAge: 600000 })
                }));
            }
            const { jwtVerify, jwks } = await verifier;
            const { payload } = await jwtVerify(token, jwks, {
                issuer, audience: clientId, algorithms: ['RS256'],
                requiredClaims: ['sub', 'tid', 'exp', 'iat'],
                currentDate: new Date(now())
            });
            if (payload.tid !== tenantId || typeof payload.sub !== 'string' || !payload.sub.length ||
                !Number.isFinite(payload.iat) || payload.iat > now() / 1000 + 60 ||
                !Number.isFinite(payload.exp) || payload.exp <= payload.iat) {
                throw new Error('Invalid identity claims');
            }
            return { subject: payload.sub, authType: 'sso' };
        } catch (error) {
            throw identityError(401, 'SIGN_IN_REQUIRED', 'Sign in again to access QuoteData.');
        }
    };
}

module.exports = createSsoIdentity;
