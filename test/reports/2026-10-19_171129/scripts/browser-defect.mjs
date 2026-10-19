import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import http from 'node:http'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {chromium,firefox,webkit} from '../.runtime/node_modules/playwright-core/index.mjs'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runtime=resolve(report,'.runtime'),root=resolve(report,'../../..'),req=createRequire(resolve(root,'package.json'))
const bundles={};const rows=[]
const app=`import React from 'react';import {createRoot} from 'react-dom/client';import {reactive,effect,watch,computed,storage} from '@canlooks/reactive';import {RC} from '@canlooks/reactive/react';
const raw=[10,20,30,40];Object.defineProperty(raw,'1',{configurable:false});const state=reactive(raw),c=computed(()=>state.length),seen=[];effect(()=>seen.push(state.length));let disk;storage(state,{name:'qa:D04:browser',adapter:{getItem(){return null},setItem(k,v){disk=v}}});
const View=RC(()=>React.createElement('p',{id:'actual'},state.length+':'+String(state[3])+':'+c.value));createRoot(document.getElementById('app')).render(React.createElement(View));window.qa={run(){const success=Reflect.set(state,'length',0);return {success,actualLength:state.length,tailPresent:Object.hasOwn(state,'3'),computed:c.value,seen:[...seen],disk}},reactVersion:React.version};`
for(const major of [18,19]){
 const path=resolve(runtime,`defect-${major}.js`)
 if(process.env.QA_PREBUILT)bundles[major]=readFileSync(path,'utf8')
 else{const b=await build({stdin:{contents:app,loader:'js',resolveDir:runtime},bundle:true,format:'esm',platform:'browser',write:false,define:{'process.env.NODE_ENV':'"development"'},plugins:major===19?[{name:'react-19',setup(b){b.onResolve({filter:/^(react|react-dom)(\/.*)?$/},a=>({path:req.resolve(a.path)}))}}]:[]});bundles[major]=b.outputFiles[0].text;writeFileSync(path,bundles[major])}
}
const server=http.createServer((request,response)=>{const url=new URL(request.url,'http://localhost');if(url.pathname==='/bundle.js'){response.setHeader('Content-Type','text/javascript');response.end(bundles[url.searchParams.get('major')]);return}response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><script type="module" src="/bundle.js?major='+url.searchParams.get('major')+'"></script>')})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`
try{for(const [engine,type]of Object.entries({chromium,firefox,webkit})){
 if(process.env.QA_BROWSER&&engine!==process.env.QA_BROWSER)continue
 if(!process.env.QA_BROWSER&&engine==='firefox')continue
 const browser=await type.launch({headless:true});try{for(const major of [18,19]){
  const page=await browser.newPage();await page.goto(origin+'/?major='+major);await page.waitForFunction(()=>document.querySelector('#actual')?.textContent==='4:40:4')
  const actual=await page.evaluate(()=>window.qa.run());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));actual.dom=await page.locator('#actual').textContent()
  const row={engine,browserVersion:browser.version(),major,actual,expected:{success:false,actualLength:2,tailPresent:false,computed:2,seen:[4,2],disk:'[10,20]',dom:'2:undefined:2'}}
  try{assert.deepEqual(actual,row.expected);row.status='passed'}catch(e){row.status='failed';row.assertion=e.message}
  rows.push(row);await page.screenshot({path:resolve(report,'evidence',`D04-${engine}-${major}.png`)});await page.close();console.log(engine,major,row.status,JSON.stringify(actual))
 }}finally{await browser.close()}
}}finally{server.close();writeFileSync(resolve(report,'evidence',process.env.QA_BROWSER==='firefox'?'browser-defect-firefox.json':'browser-defect.json'),JSON.stringify(rows,null,2))}
if(rows.some(r=>r.status==='failed'))process.exitCode=1
