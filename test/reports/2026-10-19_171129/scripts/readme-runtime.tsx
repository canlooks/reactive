import '../../../dom.js'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {act,createElement} from 'react'
import {createRoot} from 'react-dom/client'
import localforage from 'localforage'
import {createRequire} from 'node:module'
const stopStorage=createRequire(import.meta.url)('../../../../dist/cjs/storage.js').stopStorage
const records=new Map();localforage.getItem=(async(k:any)=>records.get(k)??null) as any;localforage.setItem=(async(k:any,v:any)=>{records.set(k,v);return v}) as any
globalThis.fetch=(async()=>({ok:true,status:200,json:async()=>({name:'测试用户'})})) as any
const index=JSON.parse(readFileSync(new URL('./readme-examples/index.json',import.meta.url),'utf8')),results:any[]=[]
function input(el:any,value:string){Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}))}
async function mount(component:any,props:any,run:any){const c=document.createElement('div');document.body.append(c);const root=createRoot(c);try{await act(async()=>root.render(createElement(component,props)));await run(c,root)}finally{await act(async()=>root.unmount());c.remove()}}
for(const row of index.filter((x:any)=>x.file)){
 try{const m=await import(new URL(`./readme-examples/${row.file}`,import.meta.url).href);const q=m.qa??m.default;await new Promise(r=>setImmediate(r))
 switch(row.id){
 case 1:break;case 2:assert.equal(Object.keys(q).length,6);break
 case 3:assert.equal(q.state.count,6);assert.equal(q.double.value,12);break
 case 5:assert.equal(q.state.profile.name,'Carol');break
 case 6:assert.equal(q.state.b,20);break
 case 7:assert.equal(q.label.value,'double: 4');break
 case 8:assert.equal(q.state.count,4);assert.equal(q.state.double,8);break
 case 9:assert.equal(q.result,3);assert.equal(q.state.message,'hi');break
 case 10:assert.equal(q.state.count,3);break
 case 11:assert.equal(q.state.profile.name,'Bob');assert.equal(q.state.count,2);assert.equal(q.draft[1],'second');break
 case 12:assert.equal(q.state.count,1);assert.equal(JSON.parse(q.records.get('counter')).count,1);break
 case 13:q.state.count++;await new Promise(r=>setImmediate(r));assert.ok(records.size>0);break
 case 14:await mount(q.Settings,{},async(c:any)=>{const i=c.querySelector('input');await act(async()=>input(i,'改名'));assert.equal(q.settings.name,'改名')});break
 case 16:await mount(q.Counter,{count:5},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.match(c.textContent,/5 \/ 1/)});break
 case 17:await mount(q.Counter,{},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.equal(c.textContent,'1 / 1')});break
 case 18:await mount(q.Example,{},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.equal(c.textContent,'1')});break
 case 19:await mount(q.View,{count:1},async(c:any,root:any)=>{await act(async()=>root.render(createElement(q.View,{count:2})))});break
 case 20:await mount(q.Index,{},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.match(c.textContent,/A: 2B: 2/)});break
 case 21:await mount(q.Delayed,{},async(c:any)=>{assert.equal(c.textContent,'HelloHelloHello')});break
 case 22:await mount(q.Form,{},async(c:any)=>{await act(async()=>input(c.querySelector('input'),'中文'));assert.match(c.textContent,/中文: false/)});break
 case 23:await mount(q.Quantity,{},async(c:any)=>{await act(async()=>input(c.querySelector('input'),'3'));assert.equal(c.querySelector('input').value,'3')});break
 case 24:await mount(q.UserLoader,{},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.match(c.textContent,/测试用户/)});break
 case 25:await mount(q.DataLoader,{},async(c:any)=>{await act(async()=>c.querySelector('button').click());assert.match(c.textContent,/测试用户 \/ 进行中：0/)});break
 case 27:assert.equal(q.store.count,3);assert.equal(q.Store.count,3);break
 case 28:await q.pending;assert.equal(q.state.count,4);break
 case 29:assert.equal(q.list.length,3);assert.equal(q.list[2],undefined);break
 }
 for(const value of Object.values(q))if(value!==null&&typeof value==='object')stopStorage(value)
 results.push({...row,status:'passed'});console.log(`README ${row.id} line ${row.line}: passed`)
 }catch(e){results.push({...row,status:'failed',error:String(e)});console.error(`README ${row.id}`,e);process.exitCode=1}
}
writeFileSync(new URL('../evidence/readme-results.json',import.meta.url),JSON.stringify(results,null,2))
