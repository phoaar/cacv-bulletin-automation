'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate a Google Access Token using a Service Account JSON file.
 * This replaces the heavy google-auth-library.
 */
async function getAccessToken(credPath, scopes) {
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
    exp: now + 3600,
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
  
  return data.access_token;
}

module.exports = { getAccessToken };
