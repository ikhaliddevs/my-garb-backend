const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

test('CLI startup fails safely for invalid configuration', async () => {
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, MONGODB_URI: 'sensitive-invalid-uri', FRONTEND_ORIGINS: 'http://localhost:3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /API startup failed/);
  assert.ok(!output.includes('sensitive-invalid-uri'));
});

test('SIGTERM drains the running process on platforms with POSIX signals', { skip: process.platform === 'win32' ? 'Windows child.kill force-terminates; graceful close is verified by database integration tests' : false, timeout: 20000 }, async () => {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, NODE_ENV: 'test', JWT_SECRET: 'b'.repeat(64), PORT: String(port), MONGODB_URI: process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mygarb_phasonable_test', FRONTEND_ORIGINS: 'http://localhost:3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exit = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      child.stdout.on('data', chunk => { if (chunk.toString().includes('API started')) resolve(); });
      child.once('exit', () => reject(new Error('Server exited before startup')));
      child.once('error', reject);
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
    assert.equal(response.status, 200);
    child.kill('SIGTERM');
    const [code, signal] = await exit;
    assert.equal(code, 0);
    assert.equal(signal, null);
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
});
