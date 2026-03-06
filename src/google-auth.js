'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// In-memory token cache: key → { token, expiresAt }
const tokenCache = new Map();
const MAX_CACHE_SIZE = 10;
const JWT_EXPIRY_SECONDS = 3600;

/**
 * Generate a Google Access Token using a Service Account JSON file.
 * Tokens are cached for their lifetime (minus a 60s buffer).
 */
async function getAccessToken(credPath, scopes) {
  const cacheKey = `${path.resolve(credPath)}::${[...scopes].sort().join(',')}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }
  
  const creds = JSON.parse(fs.readFileSync(path.resolve(credPath), 'utf8'));
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: creds.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + JWT_EXPIRY_SECONDS,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  signer.end();
  
  const signature = signer.sign(creds.private_key, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google Auth Failed: ${data.error_description || data.error}`);

  // Prevent unbounded cache growth
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenCache.keys().next().value;
    tokenCache.delete(firstKey);
  }

  // Cache for the token's lifetime minus 60s buffer
  const ttl = (data.expires_in || JWT_EXPIRY_SECONDS) - 60;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttl * 1000 });

  return data.access_token;
}

module.exports = { getAccessToken };
