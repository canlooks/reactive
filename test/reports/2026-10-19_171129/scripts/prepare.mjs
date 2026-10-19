import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(report,'../../..')
const hashes=JSON.parse(readFileSync(resolve(report,'evidence/source-sha256.json'),'utf8'))
const prior=JSON.parse(readFileSync(resolve(root,'test/reports/2026-10-16_181149_fix/evidence/source-sha256.json'),'utf8'))
for(const file of Object.keys(hashes)){
 const destination=resolve(report,'evidence/source-snapshot',file)
 mkdirSync(dirname(destination),{recursive:true});copyFileSync(resolve(root,file),destination)
}
cpSync(resolve(root,'test/evidence'),resolve(report,'evidence/source-snapshot/test/evidence'),{recursive:true})
const changes=Object.keys(hashes).filter(file=>hashes[file]!==prior[file])
writeFileSync(resolve(report,'evidence/changes-since-fix.json'),JSON.stringify({compared:Object.keys(hashes).length,changes,removed:Object.keys(prior).filter(file=>!(file in hashes))},null,2))
for(const name of ['package-archived.mjs','browser.mjs']){
 const file=resolve(report,'scripts',name)
 let s=readFileSync(file,'utf8').replaceAll('2026-10-16_181149_fix','2026-10-19_171129')
 if(name==='package-archived.mjs')s=s.replace('const npm = process.env.npm_execpath',"const npm = process.env.npm_execpath ?? resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')")
 writeFileSync(file,s)
}
for(const name of ['readme-extract.mjs','readme-runtime.tsx'])copyFileSync(resolve(root,'test/reports/2026-10-16_170124/scripts',name),resolve(report,'scripts',name))
console.log(JSON.stringify({snapshotFiles:Object.keys(hashes).length,changes},null,2))
