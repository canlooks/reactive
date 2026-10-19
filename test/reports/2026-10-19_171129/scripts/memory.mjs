import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import v8 from 'node:v8'
import {reactive,computed,storage} from '../../../../dist/esm/index.js'
const turn=()=>new Promise(r=>setImmediate(r)),collect=async()=>{for(let i=0;i<12;i++){await turn();global.gc()}}
const snapshot=n=>v8.writeHeapSnapshot(fileURLToPath(new URL(`../evidence/${n}.heapsnapshot`,import.meta.url)))
let source=reactive({n:0});const refs=[],getterRefs=[]
function one(){const payload={qaComputedCanary:true,buffer:new Array(200).fill(7)};refs.push(new WeakRef(payload));const c=computed(()=>source.n+payload.buffer[0]);assert.equal(c.value,7)}
function getterOne(){const r=reactive({qaGetterCanary:true,get derived(){return source.n+1}});getterRefs.push(new WeakRef(r));assert.equal(r.derived,1)}
await collect();snapshot('heap-clean-before')
for(let i=0;i<1000;i++){one();getterOne()}
await collect();snapshot('heap-clean-retained')
const retained={computed:refs.filter(r=>r.deref()).length,getters:getterRefs.filter(r=>r.deref()).length}
await turn();source=null;await collect();snapshot('heap-clean-released')
const released={computed:refs.filter(r=>r.deref()).length,getters:getterRefs.filter(r=>r.deref()).length}
const shared=reactive({n:0});const storageRefs=[];function makeStorage(i){const r=storage({child:shared},{name:`weak-${i}`,adapter:{getItem(){return null},setItem(){}}});storageRefs.push(new WeakRef(r))}
for(let i=0;i<1000;i++)makeStorage(i);await collect();const storageAlive=storageRefs.filter(r=>r.deref()).length
const completions=[],asyncRefs=[];function makePending(i){const r=storage({n:0},{name:`pending-${i}`,adapter:{getItem(){return Promise.resolve(null)},setItem(){return new Promise(r=>completions.push(r))}}});asyncRefs.push(new WeakRef(r))}
for(let i=0;i<1000;i++)makePending(i);await turn();while(completions.length)completions.shift()();await collect();const asyncStorageAlive=asyncRefs.filter(r=>r.deref()).length
const data={gcRoundsPerPhase:12,computedCreated:1000,getterRootsCreated:1000,retained,released,storageCreated:1000,storageAlive,asyncStorageCreated:1000,asyncStorageAlive,expected:'Unused derivations and their payloads should not be retained solely by a live source; storage is a weak-lifecycle control.'}
writeFileSync(new URL('../evidence/memory.json',import.meta.url),JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));assert.equal(retained.computed,0,'Unused computed payloads retained by dependency graph')

assert.equal(retained.getters,0,'Unused getter receivers retained by dependency graph');assert.equal(released.computed,0);assert.equal(released.getters,0);assert.equal(storageAlive,0);assert.equal(asyncStorageAlive,0)
