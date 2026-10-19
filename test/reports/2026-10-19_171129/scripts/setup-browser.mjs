import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runtime=resolve(report,'.runtime')
mkdirSync(runtime,{recursive:true})
writeFileSync(resolve(runtime,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{'@canlooks/reactive':'file:../evidence/canlooks-reactive-5.0.0.tgz','playwright-core':'1.62.0',react:'18.3.1','react-dom':'18.3.1',localforage:'1.10.0'}},null,2))
execFileSync(process.execPath,[resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'install','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit',windowsHide:true})
writeFileSync(resolve(report,'evidence/browser-package-lock.json'),readFileSync(resolve(runtime,'package-lock.json')))
