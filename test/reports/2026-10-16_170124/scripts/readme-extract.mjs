import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..'),dir=resolve(here,'readme-examples');mkdirSync(dir,{recursive:true})
const readme=readFileSync(resolve(root,'README.md'),'utf8'),blocks=[...readme.matchAll(/```(\w*)\r?\n([\s\S]*?)```/g)],index=[]
for(let id=0;id<blocks.length;id++){
 const [,lang,exact]=blocks[id];const line=readme.slice(0,blocks[id].index).split('\n').length
 if(['sh','json'].includes(lang)||id===4){index.push({id,line,lang,status:'reference',reason:lang==='sh'?'Installation/build commands covered by package suites':lang==='json'?'Compiler options configuration':'API declaration reference, no executable body'});continue}
 let text=exact,fixture=''
 if(id===18){fixture='Wrap Hook fragment in a component with local useReactive state';text=`import {useWatch,useReactive,RC} from '@canlooks/reactive/react'\nexport const Example=RC(()=>{const local=useReactive({clicks:0});\n${text}\nreturn <button onClick={()=>local.clicks++}>{local.clicks}</button>})`}
 if(id===19)text=`import {RC,useWatch} from '@canlooks/reactive/react'\n${text}`
 if(lang==='ts'&&!text.includes("from '@canlooks/reactive'"))text=`import {reactive,effect,computed,batch,watch,storage} from '@canlooks/reactive'\n${text}`
 const names=[...text.matchAll(/^(?:export )?(?:const|let|class|function) ([A-Za-z_$][\w$]*)/gm)].map(m=>m[1])
 const ext=lang==='js'?'cjs':lang==='tsx'?'tsx':'mts';const file=`example-${id}.${ext}`
 if(lang!=='js')text+=`\nexport const qa = {${names.join(',')}}\n`;else text+='\nmodule.exports = {reactive,effect,computed,batch,watch,storage}\n'
 writeFileSync(resolve(dir,file),text);index.push({id,line,lang,file,names,fixture,status:'extracted'})
}
writeFileSync(resolve(dir,'index.json'),JSON.stringify(index,null,2));writeFileSync(resolve(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',jsx:'react-jsx',experimentalDecorators:true,strict:true,noEmit:true,skipLibCheck:false},include:['*.mts','*.tsx']},null,2));console.log(`Extracted ${index.filter(x=>x.file).length} executable blocks from README`)
