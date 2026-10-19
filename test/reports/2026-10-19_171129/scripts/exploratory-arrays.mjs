// Contract assertions intentionally fail on the frozen tested version; do not invert them.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const variants={esm:await import('../../../../dist/esm/index.js'),cjs:require('../../../../dist/cjs/index.js')}
if(process.env.QA_SOURCE) variants.source=await import('../../../../src/index.ts')
const results=[]
const save=()=>writeFileSync(new URL(`../evidence/${process.env.QA_SOURCE?'exploratory-arrays-source':'exploratory-arrays'}.json`,import.meta.url),JSON.stringify(results,null,2))
for(const [format,api]of Object.entries(variants))for(const mode of ['reflect-number','reflect-string','strict-assignment','outer-batch']){
 test(`D04 ${format} ${mode}: failed array truncation must notify actual partial changes`,()=>{
  const {reactive,effect,watch,computed,storage,batch}=api
  const raw=[10,20,30,40];Object.defineProperty(raw,'1',{configurable:false})
  const state=reactive(raw),observed=[],watched=[],derived=computed(()=>`${state.length}:${state[3]}`)
  const stop=effect(()=>observed.push([state.length,state[3]??null])),stopWatch=watch(()=>state.length,(n,o)=>watched.push([n,o]))
  let disk;const writes=[];storage(state,{name:`qa:20261019:D04:${format}:${mode}`,adapter:{getItem(){return null},setItem(k,v){disk=v;writes.push(v)}}})
  assert.equal(derived.value,'4:40')
  let returned,error
  const truncate=()=>{if(mode==='strict-assignment')state.length=0;else returned=Reflect.set(state,'length',mode==='reflect-string'?'0':0)}
  try{if(mode==='outer-batch')batch(truncate);else truncate()}catch(e){error={name:e.name,message:e.message}}
  const row={format,mode,returned,error,actual:{length:state.length,hasTail:Object.hasOwn(state,'3'),observed:structuredClone(observed),watched:structuredClone(watched),derived:derived.value,disk,writes:[...writes]},expected:{length:2,hasTail:false,observed:[[4,40],[2,null]],watched:[[2,4]],derived:'2:undefined',disk:'[10,20]'}}
  // Recovery writes and no-change failure controls are recorded separately.
  Reflect.set(state,'length',3)
  row.recovery={length:state.length,observed:structuredClone(observed),watched:structuredClone(watched),derived:derived.value,disk}
  results.push(row);save();stop();stopWatch()
  assert.equal(row.actual.length,2);assert.equal(row.actual.hasTail,false)
  if(mode==='strict-assignment')assert.equal(error?.name,'TypeError');else assert.equal(returned,false)
  assert.deepEqual(row.actual.observed,row.expected.observed,'Actual length and deleted indices changed even though Reflect.set returned false')
  assert.deepEqual(row.actual.watched,row.expected.watched)
  assert.equal(row.actual.derived,row.expected.derived)
  assert.equal(row.actual.disk,row.expected.disk)
 })
 test(`CONTROL ${format} ${mode}: nonwritable length with no mutations must not notify`,()=>{
  const raw=[1,2];Object.defineProperty(raw,'length',{writable:false})
  const s=api.reactive(raw),seen=[];const stop=api.effect(()=>seen.push(s.length))
  assert.equal(Reflect.set(s,'length',0),false);assert.deepEqual(seen,[2]);stop()
 })
}
