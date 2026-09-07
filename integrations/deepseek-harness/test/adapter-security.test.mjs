import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const libRoot = path.resolve(here, '..', 'lib');

test('host-loaded adapter code does not open a second execution, network, credential, or telemetry surface', () => {
  const files = fs.readdirSync(libRoot).filter((name) => name.endsWith('.js'));
  assert.ok(files.length > 0, 'adapter lib is missing');
  const source = files.map((name) => fs.readFileSync(path.join(libRoot, name), 'utf8')).join('\n');
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /node:child_process/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /node:http|node:https|node:net|node:dgram/);
  assert.doesNotMatch(source, /telemetry|opentelemetry|otlp/i);
  assert.doesNotMatch(source, /credentials|DEEPSEEK_API_KEY|process\.env\.\w*TOKEN/);
  assert.doesNotMatch(source, /setInterval|setTimeout|Worker|cluster/);
  assert.doesNotMatch(source, /archify_render|archify_deliver|tools\.register/);
});

test('package resolution failures fail loud instead of returning a guessed Skill root', async () => {
  const { resolveArchifySkillRoot } = await import('../lib/resolve-skill-root.js');
  assert.throws(() => resolveArchifySkillRoot('file:///tmp/archify-dsh-missing-profile/'));
  assert.throws(() => resolveArchifySkillRoot(''));
});

// Exercise the actual adapter entry with an isolated filesystem-provider peer.
// The repository contract suite must not need host dependencies installed.
test('adapter preserves the public provider Config and delegates apply exactly once', async () => {
  const os = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-adapter-contract-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    fs.cpSync(libRoot, path.join(root, 'lib'), { recursive: true });
    const peer = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-skill-filesystem');
    fs.mkdirSync(peer, { recursive: true });
    fs.writeFileSync(path.join(peer, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-skill-filesystem', type: 'module', exports: './index.js' }));
    fs.writeFileSync(path.join(peer, 'index.js'), 'export const Config = {}; export const calls = []; export function apply(ctx, config) { calls.push([ctx, config]); return ctx.receipt; }');
    const provider = await import(pathToFileURL(path.join(peer, 'index.js')));
    const adapter = await import(pathToFileURL(path.join(root, 'lib/index.js')));
    const ctx = { receipt: {} }, config = { providerName: 'archify-plugin' };
    assert.equal(adapter.Config, provider.Config);
    assert.deepEqual(adapter.inject, ['skills']);
    assert.equal(adapter.apply(ctx, config), ctx.receipt);
    assert.deepEqual(provider.calls, [[ctx, config]]);
    assert.equal(typeof adapter.resolveArchifySkillRoot, 'function');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
