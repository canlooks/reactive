import { createHash } from 'node:crypto'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const evidence = fileURLToPath(new URL('../evidence/', import.meta.url))
const before = JSON.parse(await readFile(resolve(evidence, 'before-sha256.json'), 'utf8'))
const files = [...Object.keys(before), 'test/derived-lifecycle.mjs']
const hashes = {}, changes = []
for (const path of files) {
    const data = await readFile(resolve(root, path))
    hashes[path] = createHash('sha256').update(data).digest('hex')
    if (hashes[path] !== before[path]) changes.push(path)
    const destination = resolve(evidence, 'source-snapshot', path)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(resolve(root, path), destination)
}
await writeFile(resolve(evidence, 'source-sha256.json'), JSON.stringify(hashes, null, 2))
await writeFile(resolve(evidence, 'changed-files.json'), JSON.stringify(changes, null, 2))
// validate-docs checks links to the historical baseline as well as current sources.
await cp(resolve(root, 'test/evidence'), resolve(evidence, 'source-snapshot/test/evidence'), { recursive: true })
console.log(JSON.stringify({ files: files.length, changes }, null, 2))
