// Run: node scripts/verify-access-jwt.mjs (from the repo root)
//
// Proves the verifyAccessJwt parameter choices (issuer + audience) actually
// reject the things they must. Uses jose directly with a locally served JWKS,
// because the real Access endpoint is unreachable from here.
import * as jose from '../workers/node_modules/jose/dist/webapi/index.js';
import http from 'node:http';

const TEAM = 'localhost:9443';
const AUD = 'aud-tag-for-this-application';
const ISSUER = `https://${TEAM}`;

const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
const jwk = await jose.exportJWK(publicKey);
jwk.kid = 'test-key';
jwk.alg = 'RS256';

// Serve the JWKS the way Access does.
const server = http.createServer((req, res) => {
  if (req.url === '/cdn-cgi/access/certs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(9443, r));

const jwks = jose.createRemoteJWKSet(new URL(`http://${TEAM}/cdn-cgi/access/certs`));

const sign = (claims, opts = {}) =>
  new jose.SignJWT({ email: 'friend@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUD)
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);

async function check(label, token, { issuer = ISSUER, audience = AUD } = {}) {
  try {
    const { payload } = await jose.jwtVerify(token, jwks, { issuer, audience });
    console.log(`  ACCEPTED  ${label}  -> ${payload.email}`);
    return true;
  } catch (e) {
    console.log(`  REJECTED  ${label}  -> ${e.code || e.message.slice(0, 52)}`);
    return false;
  }
}

console.log('Access JWT verification:');
const results = {};
results.valid = await check('valid token', await sign({}));
results.wrongAud = await check(
  'token for a DIFFERENT Access application',
  await sign({}, { audience: 'some-other-apps-aud' })
);
results.wrongIssuer = await check(
  'token from a DIFFERENT team domain',
  await sign({}, { issuer: 'https://attacker.cloudflareaccess.com' })
);
results.expired = await check('expired token', await sign({}, { exp: '-5m' }));
results.unsigned = await check(
  'unsigned (alg=none style) garbage',
  'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImF0dGFja2VyQGV4YW1wbGUuY29tIn0.'
);
results.noEmail = await (async () => {
  const t = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt().setIssuer(ISSUER).setAudience(AUD).setExpirationTime('1h')
    .sign(privateKey);
  const { payload } = await jose.jwtVerify(t, jwks, { issuer: ISSUER, audience: AUD });
  const ok = typeof payload.email === 'string' && payload.email.length > 0;
  console.log(`  ${ok ? 'ACCEPTED' : 'REJECTED'}  token with no email claim -> handled by our own check`);
  return ok;
})();

server.close();

const expected = { valid: true, wrongAud: false, wrongIssuer: false, expired: false, unsigned: false, noEmail: false };
const bad = Object.entries(expected).filter(([k, v]) => results[k] !== v);
console.log(bad.length ? `\nFAIL: ${bad.map(([k]) => k).join(', ')}` : '\nAll six behaved correctly.');
process.exit(bad.length ? 1 : 0);
