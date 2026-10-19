import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import v8 from 'node:v8'
const base=process.env.QA_BENCH_BEFORE?'../evidence/performance-before-dist/esm/':'../../../../dist/esm/'
const {reactive,effect,watch,computed,batch,storage}=await import(base+'index.js')
const {stopStorage}=await import(base+'storage.js')
const turn=()=>new Promise(r=>setImmediate(r))
const results={benchmarks:[],stress:[],gc:{},notes:['Timing is a first baseline on this machine, not an SLA or version regression comparison.']}
function measure(name,fn){const samples=[];for(let i=0;i<13;i++){const start=performance.now();const metrics=fn();const ms=performance.now()-start;if(i>=3)samples.push({ms,...metrics})}const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b);results.benchmarks.push({name,warmups:3,samples,medianMs:(sorted[4]+sorted[5])/2,p95Ms:sorted[9]})}
for(const size of [1000,10000]) measure(`proxy/deep fields=${size}`,()=>{const s=reactive(Object.fromEntries(Array.from({length:size},(_,i)=>['k'+i,{n:i}])));let total=0;for(const k of Object.keys(s)){const first=s[k];assert.equal(first,s[k]);total+=first.n}assert.equal(total,size*(size-1)/2);return {fields:size}})
measure('computed 100000 cached reads',()=>{const s=reactive({n:1});let getterCalls=0;const c=computed(()=>{getterCalls++;return s.n*2});assert.equal(getterCalls,0);for(let i=0;i<100000;i++)assert.equal(c.value,2);assert.equal(getterCalls,1);return {getterCalls}})
for(const batched of [false,true])measure(`10000 writes batch=${batched}`,()=>{const s=reactive({n:0});let notifications=0;const stop=effect(()=>{void s.n;notifications++});notifications=0;const change=()=>{for(let i=1;i<=10000;i++)s.n=i};if(batched)batch(change);else change();stop();assert.equal(notifications,batched?1:10000);return {notifications}})
measure('QUAL-008 sparse length=1e9 own indices=3',()=>{const raw=[];raw.length=1000000000;raw[1]=1;raw[500000000]=2;raw[999999999]=3;const s=reactive(raw);let calls=0;const stop=effect(()=>{void s[999999999];calls++});s.length=3;assert.equal(s.length,3);assert.equal(calls,2);stop();return {indices:3}})
for(const depth of [100,1000])measure(`QUAL-008 depth=${depth}`,()=>{const raw={n:0};let p=raw;for(let i=0;i<depth;i++)p=p.child={n:i};const s=reactive(raw);let q=s;for(let i=0;i<depth;i++)q=q.child;assert.equal(q.n,depth-1);let bytes=0;const saved=storage(raw,{name:'depth',adapter:{getItem(){return null},setItem(k,v){bytes=Buffer.byteLength(v)}}});assert.ok(bytes>0);stopStorage(saved);return {depth,bytes}})
for(const shared of [false,true])measure(`JSON shared graph=${shared}`,()=>{const child={a:'x'.repeat(100),b:1};const raw={items:Array.from({length:100},()=>shared?child:{...child})};let bytes=0;const s=storage(raw,{name:'shared',adapter:{getItem(){return null},setItem(k,v){bytes=Buffer.byteLength(v)}}});stopStorage(s);return {uniqueChildren:shared?1:100,bytes}})
const output=process.argv[2]??'benchmark-clean';assert.match(output,/^[a-z0-9-]+$/)
writeFileSync(new URL(`../evidence/${output}.json`,import.meta.url),JSON.stringify(results,null,2))

console.log(JSON.stringify(results.benchmarks.map(({name,medianMs,p95Ms})=>({name,medianMs,p95Ms})),null,2))
