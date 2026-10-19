import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const report = fileURLToPath(new URL('../', import.meta.url))
const evidence = resolve(report, 'evidence')
const readJson = async name => JSON.parse(await readFile(resolve(evidence, name), 'utf8'))
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex')
const source = await readJson('source-sha256.json')
const before = await readJson('before-sha256.json')
for (const [path, expected] of Object.entries(source)) assert.equal(await hash(resolve(root, path)), expected, `Source changed after testing: ${path}`)
const changed = Object.keys(before).filter(path => path.startsWith('src/') && before[path] !== source[path]).sort()
assert.deepEqual(changed, ['src/effect.ts', 'src/react/model.ts', 'src/react/props.ts', 'src/reactive.ts', 'src/storageSnapshot.ts'])
for (const path of ['package.json', 'package-lock.json', 'src/index.ts', 'src/react/index.ts', 'scripts/build.mjs', 'scripts/test-package.mjs']) {
    assert.equal(before[path], source[path], `Unexpected change: ${path}`)
}
const artifacts = {}
async function recordTree(directory, installed) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name)
        if (entry.isDirectory()) await recordTree(path, installed && resolve(installed, entry.name))
        else {
            const digest = await hash(path)
            artifacts[path.slice(root.length).replaceAll('\\', '/')] = digest
            if (installed) assert.equal(await hash(resolve(installed, entry.name)), digest, `Browser tarball mismatch: ${path}`)
        }
    }
}
await recordTree(resolve(root, 'dist'), resolve(report, '.runtime/node_modules/@canlooks/reactive/dist'))
for (const name of ['canlooks-reactive-5.0.0.tgz', 'react-18-package-lock.json', 'react-19-package-lock.json', 'core-only-package-lock.json']) {
    artifacts[`evidence/${name}`] = await hash(resolve(evidence, name))
}
for (const name of ['package-lock.json', ...[18, 19].flatMap(major => ['development', 'production'].map(mode => `bundle-${major}-${mode}.js`))]) {
    artifacts[`.runtime/${name}`] = await hash(resolve(report, '.runtime', name))
}
for (const path of ['esm/index.d.ts', 'cjs/index.d.ts', 'esm/react/index.d.ts', 'cjs/react/index.d.ts', 'esm/react/model.d.ts', 'cjs/react/model.d.ts']) {
    assert.equal(await hash(resolve(root, 'dist', path)), await hash(resolve(evidence, 'before/dist', path)), `Public declaration changed: ${path}`)
}
const win = await readJson('browser-results.json')
const linux = await readJson('browser-results-linux-firefox.json')
const browsers = [...win.results.filter(row => row.engine !== 'firefox'), ...linux.results]
assert.equal(browsers.length, 12)
for (const row of browsers) {
    assert.equal(row.status, 'passed')
    assert.equal(row.crossRealm.isRaw, false)
    assert.deepEqual(row.crossRealm.seen, [0, 1])
    assert.equal(row.crossRealm.builtins, 9)
    assert.equal(row.crossRealm.rejected, 10)
}
await writeFile(resolve(evidence, 'artifact-sha256.json'), JSON.stringify(artifacts, null, 2))
await writeFile(resolve(evidence, 'verification.json'), JSON.stringify({
    sourceFiles: Object.keys(source).length, productionFilesChanged: changed,
    browserTarballMatchesBuild: true, unchangedPublicDeclarations: true,
    browserMatrix: browsers.map(({ engine, browserVersion, reactVersion, major, mode, status }) => ({ engine, browserVersion, reactVersion, major, mode, status })),
    tarballSha256: artifacts['evidence/canlooks-reactive-5.0.0.tgz'],
}, null, 2))
console.log('Verified source hashes, exactly five production changes, unchanged public declarations, browser tarball bytes and all 12 browser variants.')
