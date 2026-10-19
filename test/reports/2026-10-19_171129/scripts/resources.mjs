import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import v8 from 'node:v8'
import { reactive, effect, watch, computed, batch, storage } from '../../../../dist/esm/index.js'
import { stopStorage } from '../../../../dist/esm/storage.js'
const turn=()=>new Promise(r=>setImmediate(r))
const results={benchmarks:[],stress:[],gc:{},notes:['Timing is a first baseline on this machine, not an SLA or version regression comparison.']}
function measure(name,fn){const samples=[];for(let i=0;i<13;i++){const start=performance.now();const metrics=fn();const ms=performance.now()-start;if(i>=3)samples.push({ms,...metrics})}const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);results.benchmarks.push({name,warmups:3,samples,medianMs:(sorted[4]+sorted[5])/2,p95Ms:sorted[9]})}
for(const size of [1000,10000]) measure(`proxy/deep fields=${size}`,()=>{const s=reactive(Object.fromEntries(Array.from({length:size},(_,i)=>['k'+i,{n:i}])));let total=0;for(const k of Object.keys(s)){const first=s[k];assert.equal(first,s[k]);total+=first.n}assert.equal(total,size*(size-1)/2);return {fields:size}})
measure('computed 100000 cached reads',()=>{const s=reactive({n:1});let getterCalls=0;const c=computed(()=>{getterCalls++;return s.n*2});assert.equal(getterCalls,0);for(let i=0;i<100000;i++)assert.equal(c.value,2);assert.equal(getterCalls,1);return {getterCalls}})
for(const batched of [false,true])measure(`10000 writes batch=${batched}`,()=>{const s=reactive({n:0});let notifications=0;const stop=effect(()=>{void s.n;notifications++});notifications=0;const change=()=>{for(let i=1;i<=10000;i++)s.n=i};if(batched)batch(change);else change();stop();assert.equal(notifications,batched?1:10000);return {notifications}})
measure('QUAL-008 sparse length=1e9 own indices=3',()=>{const raw=[];raw.length=1000000000;raw[1]=1;raw[500000000]=2;raw[999999999]=3;const s=reactive(raw);let calls=0;const stop=effect(()=>{void s[999999999];calls++});s.length=3;assert.equal(s.length,3);assert.equal(calls,2);stop();return {indices:3}})
for(const depth of [100,1000])measure(`QUAL-008 depth=${depth}`,()=>{const raw={n:0};let p=raw;for(let i=0;i<depth;i++)p=p.child={n:i};const s=reactive(raw);let q=s;for(let i=0;i<depth;i++)q=q.child;assert.equal(q.n,depth-1);let bytes=0;const saved=storage(raw,{name:'depth',adapter:{getItem(){return null},setItem(k,v){bytes=Buffer.byteLength(v)}}});assert.ok(bytes>0);stopStorage(saved);return {depth,bytes}})
for(const shared of [false,true])measure(`JSON shared graph=${shared}`,()=>{const child={a:'x'.repeat(100),b:1};const raw={items:Array.from({length:100},()=>shared?child:{...child})};let bytes=0;const s=storage(raw,{name:'shared',adapter:{getItem(){return null},setItem(k,v){bytes=Buffer.byteLength(v)}}});stopStorage(s);return {uniqueChildren:shared?1:100,bytes}})
writeFileSync(new URL('../evidence/resources.json',import.meta.url),JSON.stringify(results,null,2))
// Fixed five rounds, each with 10000 edits, both synchronous and deferred adapters.
for(const size of [1000,10000])for(const mode of ['sync-batch','sync-unbatched','async-pending']){
  let disk,active=0,maxActive=0,writes=0;const completions=[]
  const a={getItem(){return null},setItem(k,v){writes++;if(mode!=='async-pending'){disk=v;return}active++;maxActive=Math.max(maxActive,active);return new Promise(resolve=>completions.push(()=>{disk=v;active--;resolve()}))}}
  const s=storage(Object.fromEntries(Array.from({length:size},(_,i)=>['k'+i,0])),{name:'stress',adapter:a})
  while(completions.length){completions.shift()();await turn()}
  const samples=[]
  for(let round=0;round<5;round++){
    const start=performance.now(),before=writes,heapBefore=process.memoryUsage().heapUsed
    const change=()=>{for(let j=0;j<10000;j++)s.k0++}
    if(mode==='sync-batch')batch(change);else change()
    const during=writes-before;if(mode==='async-pending')assert.equal(during,1)
    while(completions.length){completions.shift()();await turn()}
    assert.equal(JSON.parse(disk).k0,(round+1)*10000)
    assert.equal(writes-before,mode==='sync-batch'?1:mode==='async-pending'?2:10000)
    samples.push({round,ms:performance.now()-start,writes:writes-before,during,heapBefore,heapAfter:process.memoryUsage().heapUsed,bytes:Buffer.byteLength(disk)})
  }
  stopStorage(s);assert.ok(maxActive<=1);results.stress.push({fields:size,mode,maxActive,samples});console.log('QUAL-009',size,mode,JSON.stringify(samples.map(s=>({ms:s.ms,writes:s.writes}))));writeFileSync(new URL('../evidence/resources.json',import.meta.url),JSON.stringify(results,null,2))
}
for(let i=0;i<1000;i++){const s=reactive({n:0});let calls=0;const a=effect(()=>{void s.n;calls++}),b=watch(()=>s.n,()=>calls++);s.n++;a();b();const before=calls;s.n++;assert.equal(calls,before)}
async function collect(){for(let i=0;i<8;i++){await turn();global.gc?.()}}
const shared=reactive({n:0}), refs=[]
for(let i=0;i<1000;i++){const root=storage({child:shared},{name:`gc-${i}`,adapter:{getItem(){return null},setItem(){}}});refs.push(new WeakRef(root))}
await collect();results.gc.storageSharedChildAlive=refs.filter(r=>r.deref()).length;shared.n++
const asyncRefs=[],done=[]
for(let i=0;i<1000;i++){const root=storage({n:0},{name:`async-gc-${i}`,adapter:{getItem(){return Promise.resolve(null)},setItem(){return new Promise(r=>done.push(r))}}});asyncRefs.push(new WeakRef(root))}
await turn();while(done.length)done.shift()();await collect();results.gc.storageAfterIoAlive=asyncRefs.filter(r=>r.deref()).length
// Weak-reference and heap-retainer investigation; counters are diagnostic, not a GC SLA.
let source=reactive({n:0});const payloadRefs=[];let evaluations=0
function createDiscardedComputed(){const payload={qaComputedCanary:true,buffer:new Array(200).fill(7)};payloadRefs.push(new WeakRef(payload));const c=computed(()=>{evaluations++;return source.n+payload.buffer[0]});assert.equal(c.value,7)}
await collect();v8.writeHeapSnapshot(new URL('../evidence/heap-before.heapsnapshot',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))
for(let i=0;i<1000;i++)createDiscardedComputed()
await collect();results.gc.computedPayloadsAliveWithSource=payloadRefs.filter(r=>r.deref()).length;source.n++;assert.equal(evaluations,1000)
v8.writeHeapSnapshot(new URL('../evidence/heap-retained.heapsnapshot',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))
source=null;await collect();results.gc.computedPayloadsAliveAfterSourceDropped=payloadRefs.filter(r=>r.deref()).length
v8.writeHeapSnapshot(new URL('../evidence/heap-after-release.heapsnapshot',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))
writeFileSync(new URL('../evidence/resources.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results.gc,null,2))
