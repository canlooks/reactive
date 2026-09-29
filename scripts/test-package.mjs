import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run this check with npm run test:package')
const temporary = await mkdtemp(join(tmpdir(), 'reactive-package-'))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const require = createRequire(import.meta.url)
const versionOf = name => require(`${name}/package.json`).version
const run = (cwd, executable, args) => {
    try {
        return execFileSync(executable, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, NODE_PATH: '' }, maxBuffer: 8 * 1024 * 1024 })
    } catch (error) {
        process.stderr.write(error.stdout ?? '')
        process.stderr.write(error.stderr ?? '')
        throw error
    }
}
const npmRun = (cwd, args) => run(cwd, process.execPath, [npm, ...args])
const save = (cwd, name, value) => writeFile(join(cwd, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2))
const copyTypes = async (destination, react = false) => {
    const source = join(root, react ? 'test/types/react' : 'test/types')
    await mkdir(destination, { recursive: true })
    for (const name of await readdir(source)) {
        if (/\.(mts|cts|tsx)$/.test(name)) await copyFile(join(source, name), join(destination, name))
    }
    await save(destination, 'tsconfig.json', {
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true,
            strict: true, skipLibCheck: false, experimentalDecorators: true, types: [],
            ...(react ? { jsx: 'react-jsx', lib: ['ES2022', 'DOM', 'DOM.Iterable'] } : { lib: ['ES2022'] }) },
        include: ['*.mts', '*.cts', '*.tsx'],
    })
}
const setup = async (name, dependencies) => {
    const directory = join(temporary, name)
    await mkdir(directory)
    await save(directory, 'package.json', { name, private: true, type: 'module' })
    npmRun(directory, ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...dependencies])
    return directory
}
const typecheck = (directory, config) => run(directory, process.execPath, [
    join(directory, 'node_modules/typescript/bin/tsc'), '-p', config,
])

try {
    npmRun(root, ['run', 'build'])
    const [dryRun] = JSON.parse(npmRun(root, ['pack', '--dry-run', '--ignore-scripts', '--json']))
    const packedFiles = new Set(dryRun.files.map(file => file.path.replaceAll('\\', '/')))
    for (const file of ['dist/node.js', 'dist/node-react.js', 'dist/esm/index.d.ts', 'dist/cjs/index.d.ts',
        'dist/esm/react/index.js', 'dist/cjs/react/index.js', 'dist/esm/react/index.d.ts', 'dist/cjs/react/index.d.ts']) {
        assert.ok(packedFiles.has(file), `Missing package file: ${file}`)
    }
    for (const format of ['esm', 'cjs']) for (const module of ['reference', 'react/commit', 'react/chip', 'react/model', 'react/loading']) {
        for (const extension of ['js', 'd.ts']) assert.ok(packedFiles.has(`dist/${format}/${module}.${extension}`))
    }
    assert.ok([...packedFiles].every(file => /^(dist\/|README\.md$|package\.json$|LICENSE)/i.test(file)))
    assert.equal(manifest.dependencies, undefined)
    const [packed] = JSON.parse(npmRun(root, ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary]))
    const tarball = join(temporary, packed.filename)
    console.log(`Tarball contains ${packedFiles.size} expected files; both Node bridges are present.`)

    const core = await setup('core-only', [tarball, `typescript@${versionOf('typescript')}`])
    await copyFile(join(root, 'test/smoke-assertions.cjs'), join(core, 'verify.cjs'))
    await save(core, 'check.mjs', `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import * as api from '@canlooks/reactive'
import verify from './verify.cjs'
const require = createRequire(import.meta.url)
const cjs = require('@canlooks/reactive')
verify(api); verify(cjs)
for (const key of Object.keys(api)) assert.equal(api[key], cjs[key])
for (const dependency of ['react', 'react-dom', '@types/react/package.json']) {
    assert.throws(() => require.resolve(dependency), { code: 'MODULE_NOT_FOUND' })
}
`)
    run(core, process.execPath, ['check.mjs'])
    await copyTypes(join(core, 'types'))
    typecheck(core, 'types/tsconfig.json')
    console.log('Core-only consumer: import/require/watch/batch/computed and strict non-DOM declarations passed without React.')

    for (const major of [19, 18]) {
        const reactVersion = major === 19 ? versionOf('react') : '18.3.1'
        const directory = await setup(`react-${major}`, [tarball, `react@${reactVersion}`, `react-dom@${reactVersion}`,
            `@types/react@${major}`, `@types/react-dom@${major}`, `typescript@${versionOf('typescript')}`,
            `jsdom@${versionOf('jsdom')}`, `tsx@${versionOf('tsx')}`])
        await copyFile(join(root, 'test/react-smoke.mjs'), join(directory, 'verify-react.mjs'))
        await copyFile(join(root, 'test/smoke-assertions.cjs'), join(directory, 'smoke-assertions.cjs'))
        await copyFile(join(root, 'test/smoke.cjs'), join(directory, 'smoke.cjs'))
        await save(directory, 'check.mjs', `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import * as api from '@canlooks/reactive'
import * as reactApi from '@canlooks/reactive/react'
import verify from './verify-react.mjs'
const require = createRequire(import.meta.url)
const cjs = require('@canlooks/reactive')
const cjsReact = require('@canlooks/reactive/react')
for (const key of Object.keys(reactApi)) assert.equal(reactApi[key], cjsReact[key])
await verify(api, cjsReact)
await verify(cjs, reactApi)
const native = await import('./node_modules/@canlooks/reactive/dist/esm/index.js')
const nativeReact = await import('./node_modules/@canlooks/reactive/dist/esm/react/index.js')
await verify(native, nativeReact)
`)
        run(directory, process.execPath, ['check.mjs'])
        run(directory, process.execPath, ['--no-experimental-require-module', 'smoke.cjs'])
        await copyTypes(join(directory, 'types'), true)
        typecheck(directory, 'types/tsconfig.json')
        // Run the complete behavior suite against the tarball's native ESM graph,
        // including its internal coordination tests. No repository modules resolve here.
        for (const file of ['react.tsx', 'react-features.tsx']) {
            const suite = (await readFile(join(root, 'test', file), 'utf8'))
                .replaceAll("'../src/", "'./node_modules/@canlooks/reactive/dist/esm/")
            await save(directory, file, suite)
        }
        await copyFile(join(root, 'test/dom.ts'), join(directory, 'dom.ts'))
        await save(directory, 'tsconfig.json', { compilerOptions: { target: 'ES2022', module: 'NodeNext',
            moduleResolution: 'NodeNext', jsx: 'react-jsx', experimentalDecorators: true } })
        const results = run(directory, process.execPath, [join(directory, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', 'tsconfig.json', 'react.tsx'])
        assert.match(results, /(?:fail 0|# fail 0)/)
        console.log(`React ${reactVersion}: full DOM/lifecycle/Suspense/SSR suite, both formats, mixed entries and declarations passed.`)
    }
    // Only this uniquely created temporary directory is eligible for removal.
    if (dirname(resolve(temporary)) !== resolve(tmpdir()) || !basename(temporary).startsWith('reactive-package-')) {
        throw new Error('Refusing to clean an unexpected directory')
    }
    await rm(temporary, { recursive: true, force: true })
    console.log('All isolated package consumers passed.')
} catch (error) {
    console.error(`Consumer artifacts retained for diagnosis: ${temporary}`)
    throw error
}
