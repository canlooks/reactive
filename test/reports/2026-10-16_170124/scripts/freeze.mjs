import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
const report = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(report, '../../..')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const files = git(['ls-files', '--cached', '--others', '--exclude-standard']).split(/\r?\n/).filter(f => f && !f.startsWith('test/reports/') && !f.startsWith('test/evidence/'))
const hashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(resolve(root, f))).digest('hex')]))
const versions = Object.fromEntries(['react', 'react-dom', '@types/react', '@types/react-dom', 'tsx', 'typescript', 'jsdom', 'localforage', 'esbuild'].map(n => [n, JSON.parse(readFileSync(resolve(root, 'node_modules', n, 'package.json'))).version]))
writeFileSync(resolve(report, 'evidence/source-sha256.json'), JSON.stringify(hashes, null, 2))
writeFileSync(resolve(report, 'evidence/worktree.diff'), git(['diff', '--binary', 'HEAD']))
writeFileSync(resolve(report, 'evidence/git-status.txt'), git(['status', '--short']))
writeFileSync(resolve(report, 'evidence/environment.json'), JSON.stringify({ started: new Date().toISOString(), timezone: 'Asia/Shanghai', root, head: git(['rev-parse', 'HEAD']).trim(), platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus(), ramBytes: os.totalmem(), node: process.version, versions }, null, 2))
console.log(`Frozen ${files.length} files; ${root}`)
