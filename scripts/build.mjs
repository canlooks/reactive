import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')
const esm = join(dist, 'esm')
const cjs = join(dist, 'cjs')
const require = createRequire(import.meta.url)
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc')

// Only generated files in this repository's dist directory may be removed.
if (relative(root, dist) !== 'dist') throw new Error('Refusing to clean outside the build directory')
await rm(dist, { recursive: true, force: true })
execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' })

const files = await readdir(esm, { recursive: true })
await build({
    entryPoints: files.filter(file => file.endsWith('.js')).map(file => join(esm, file)),
    outdir: cjs,
    outbase: esm,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2022',
    logLevel: 'info',
})

await mkdir(cjs, { recursive: true })
for (const file of files.filter(file => file.endsWith('.d.ts'))) {
    await mkdir(dirname(join(cjs, file)), { recursive: true })
    await copyFile(join(esm, file), join(cjs, file))
}
// Both .js and .d.ts files in this directory must be interpreted as CommonJS.
await writeFile(join(cjs, 'package.json'), '{"type":"commonjs"}\n')

// Node import and require share the same module state. Browser/bundler imports
// use the native ESM files through the default import condition instead.
await writeFile(join(dist, 'node.js'), [
    "import api from './cjs/index.js'",
    'export const { reactive, effect, computed, batch, watch } = api',
    '',
].join('\n'))
await writeFile(join(dist, 'node-react.js'), [
    "import api from './cjs/react/index.js'",
    'export const { ReactiveComponent, ReactiveFunctionComponent, ReactiveClassComponent, RC, RFC, RCC, useReactive, useWatch, Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip, useModel, Model, defineModel, useLoading } = api',
    '',
].join('\n'))
