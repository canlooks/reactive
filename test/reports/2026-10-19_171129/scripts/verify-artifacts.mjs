import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(report,'../../..'),evidence=resolve(report,'evidence')
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const walk=(dir,prefix='')=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name),prefix+e.name+'/'):[prefix+e.name])
const frozen=JSON.parse(readFileSync(resolve(evidence,'source-sha256.json'),'utf8')),changes=[]
for(const [file,h]of Object.entries(frozen)){
 if(hash(resolve(root,file))!==h)changes.push(file)
 assert.equal(hash(resolve(evidence,'source-snapshot',file)),h)
}
assert.deepEqual(changes,[])
const dist=walk(resolve(root,'dist'))
for(const file of dist)assert.equal(hash(resolve(root,'dist',file)),hash(resolve(report,'.runtime/node_modules/@canlooks/reactive/dist',file)),`Package artifact differs: ${file}`)
execFileSync('git',['diff','--check'],{cwd:root,encoding:'utf8'})
const lines=readFileSync(resolve(root,'src/reactive.ts'),'utf8').split(/\r?\n/),index=lines.findIndex(l=>l.includes('if (success && target === toRaw(receiver))'))
const patch=['diff --git a/src/reactive.ts b/src/reactive.ts','--- a/src/reactive.ts','+++ b/src/reactive.ts',`@@ -${index-2},7 +${index-2},7 @@`,...lines.slice(index-3,index).map(l=>' '+l),'-'+lines[index],'+'+lines[index].replace('success && ',''),...lines.slice(index+1,index+4).map(l=>' '+l),''].join('\n')
writeFileSync(resolve(evidence,'suggested-D04.patch'),patch)
execFileSync('git',['apply','--check',resolve(evidence,'suggested-D04.patch')],{cwd:root,encoding:'utf8'})
const result={sourceFiles:Object.keys(frozen).length,sourceChanges:changes,snapshotMatches:true,distFiles:dist.length,installedTarballMatchesDist:true,gitDiffCheck:true,suggestedPatchParses:true,suggestedPatchApplied:false,checkedAt:new Date().toISOString()}
writeFileSync(resolve(evidence,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
if(process.argv.includes('--manifest')){
 const manifest=walk(evidence).filter(file=>file!=='manifest.json').map(file=>({file,bytes:statSync(resolve(evidence,file)).size,sha256:hash(resolve(evidence,file))}))
 writeFileSync(resolve(evidence,'manifest.json'),JSON.stringify(manifest,null,2));console.log(`Manifest: ${manifest.length} evidence files`)
}
