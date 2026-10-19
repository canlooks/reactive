import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(report,'../../..'),evidence=resolve(report,'evidence')
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const baseline=JSON.parse(readFileSync(resolve(evidence,'source-sha256.json'),'utf8'))
const changes=Object.entries(baseline).filter(([p,h])=>!existsSync(resolve(root,p))||hash(resolve(root,p))!==h).map(([p])=>p)
assert.deepEqual(changes,[])
const md=readFileSync(resolve(report,'report.md'),'utf8'),html=readFileSync(resolve(report,'report.html'),'utf8'),results=JSON.parse(readFileSync(resolve(report,'results.json'),'utf8'))
assert.equal((html.match(/data-case="/g)||[]).length,240)
for(const c of results.cases){assert.ok(md.includes(c.id+' / '+c.priority));assert.ok(html.includes(`data-case="${c.id}"`))}
const broken=[];for(const m of md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){if(!/^https?:|^#/.test(m[1])&&!existsSync(resolve(report,m[1])))broken.push(m[1])}assert.deepEqual(broken,[])
writeFileSync(resolve(evidence,'final-check.json'),JSON.stringify({completed:new Date().toISOString(),timezone:'Asia/Shanghai',sourceFiles:Object.keys(baseline).length,sourceChanges:changes,caseRows:240,counts:results.counts,reportSha256:{markdown:hash(resolve(report,'report.md')),html:hash(resolve(report,'report.html'))},markdownBrokenLinks:broken,cacheCleanup:{status:'retained',reason:'Automatic approval review rejected recursive cleanup of task-local Linux browser/Node caches: blocked by policy. No cleanup was performed; .runtime is ignored by the report-local .gitignore.'}},null,2))
function scan(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=resolve(dir,e.name),n=prefix+e.name;return e.isDirectory()?scan(p,n+'/'):n==='manifest.json'?[]:[{file:n,bytes:statSync(p).size,sha256:hash(p)}]})}
const files=scan(evidence);writeFileSync(resolve(evidence,'manifest.json'),JSON.stringify(files,null,2))
console.log(JSON.stringify({sourceFiles:Object.keys(baseline).length,sourceChanges:changes,caseRows:240,evidenceFiles:files.length,htmlBytes:Buffer.byteLength(html),markdownBytes:Buffer.byteLength(md),brokenLinks:broken},null,2))
