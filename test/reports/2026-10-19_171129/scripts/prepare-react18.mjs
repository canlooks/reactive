import {readFileSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runtime=resolve(report,'.runtime')
const source=readFileSync(resolve(report,'scripts/supplement-react.tsx'),'utf8')
 .replaceAll("'../../../../src/","'./node_modules/@canlooks/reactive/dist/esm/")
 .replaceAll('../evidence/react-','../evidence/react18-')
writeFileSync(resolve(runtime,'supplement-react.tsx'),source)
writeFileSync(resolve(runtime,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',jsx:'react-jsx',experimentalDecorators:true},include:['*.tsx']},null,2))
