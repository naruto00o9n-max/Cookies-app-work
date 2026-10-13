import assert from 'node:assert/strict';
const root=process.env.COOKIES_TEST_API_URL||'http://localhost:3000';
assert.equal((await fetch(root+'/api/mobile/state')).status,401);
assert.equal((await fetch(root+'/api/auth/mobile/demo',{method:'POST'})).status,403);
assert.equal((await fetch(root+'/api/auth/demo',{method:'POST'})).status,403);
assert.equal((await fetch(root+'/api/mobile/jobs')).status,401);
console.log('Unauthenticated access and sample-login rejection passed. No team data was modified.');
