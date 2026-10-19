import { spawn } from 'node:child_process'
import { createWriteStream, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const report = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(report, '../../..')
const [name, command, ...args] = process.argv.slice(2)
mkdirSync(resolve(report, 'evidence'), { recursive: true })
const out = createWriteStream(resolve(report, 'evidence', `${name}.log`))
const started = new Date().toISOString()
let executable = command, argv = args
if (command === 'npm') {
  executable = process.execPath
  const cli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
  if (!existsSync(cli)) throw new Error(`Missing npm CLI: ${cli}`)
  argv = [cli, ...args]
}
if (command === 'node') executable = process.execPath
out.write(`START ${started}\nCWD ${root}\nCOMMAND ${command} ${args.join(' ')}\n\n`)
const child = spawn(executable, argv, { cwd: root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, windowsHide: true })
child.stdout.on('data', d => { out.write(d); process.stdout.write(d) })
child.stderr.on('data', d => { out.write(d); process.stderr.write(d) })
child.on('error', e => { out.write(String(e)); process.stderr.write(String(e)) })
child.on('close', (code, signal) => {
  const ended = new Date().toISOString()
  const result = { name, command, args, cwd: root, started, ended, durationMs: Date.parse(ended) - Date.parse(started), exitCode: code, signal }
  writeFileSync(resolve(report, 'evidence', `${name}.result.json`), JSON.stringify(result, null, 2))
  out.end(`\nEND ${ended} EXIT ${code}\n`)
  process.exitCode = code ?? 1
})
