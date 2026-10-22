import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [
  ...readdirSync(join(root, 'plugins')).map((name) => join(root, 'plugins', name)),
  join(root, 'examples', 'hello'),
].filter((dir) => statSync(dir).isDirectory());

const manifests = dirs.map((dir) => ({
  dir,
  manifest: JSON.parse(readFileSync(join(dir, 'qwen-mod.json'), 'utf8')),
}));

test('every module has a valid manifest', () => {
  assert.ok(manifests.length >= 4);
  for (const { dir, manifest } of manifests) {
    const where = relative(root, dir);
    assert.match(manifest.id, /^[a-z][a-z0-9-]{0,63}$/, `${where}: invalid id`);
    assert.equal(manifest.apiVersion, 1, `${where}: apiVersion`);
    assert.equal(typeof manifest.name, 'string', `${where}: name`);
    assert.ok(manifest.name.length > 0, `${where}: name is empty`);
    const entry = resolve(dir, manifest.entry);
    assert.ok(entry.startsWith(dir + '/'), `${where}: entry escapes the module directory`);
    assert.ok(existsSync(entry), `${where}: entry ${manifest.entry} does not exist`);
    assert.match(entry, /\.m?js$/, `${where}: entry must be .mjs or .js`);
  }
});

test('manifest ids are unique', () => {
  const ids = manifests.map(({ manifest }) => manifest.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids in ${ids.join(', ')}`);
});

test('every entry exports register(api)', async () => {
  for (const { dir, manifest } of manifests) {
    const mod = await import(pathToFileURL(resolve(dir, manifest.entry)).href);
    assert.equal(typeof mod.register, 'function', `${manifest.id}: register is not exported`);
  }
});

test('modules import only what ships with Node or the repository', () => {
  for (const { dir, manifest } of manifests) {
    const source = readFileSync(resolve(dir, manifest.entry), 'utf8');
    for (const match of source.matchAll(/^import\s.*?from\s+['"]([^'"]+)['"]/gm)) {
      const spec = match[1];
      assert.ok(
        spec.startsWith('./') || spec.startsWith('node:'),
        `${manifest.id}: imports ${spec}. Qwen supplies React and Ink through api.ui, so add no npm dependencies.`,
      );
    }
  }
});
