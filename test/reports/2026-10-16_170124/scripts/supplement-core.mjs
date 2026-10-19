import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { writeFileSync } from 'node:fs'
import { reactive, computed, effect, watch, batch, storage } from '../../../../dist/esm/index.js'
import { stopStorage } from '../../../../dist/esm/storage.js'
const turn = () => new Promise(r => setImmediate(r))
const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return {promise,resolve,reject} }
function captureWarnings(t) { const warnings=[]; const old=console.warn; console.warn=(...x)=>warnings.push(x); t.after(()=>console.warn=old); return warnings }
function memory(value=null) { return { value, writes:[], getItem(){return this.value}, setItem(k,v){this.writes.push(v);this.value=v} } }
test('CORE-069 computed object/function/undefined results and destructured snapshots', () => {
  const s=reactive({n:1}); const fn=()=>1; const c=computed(()=>({n:s.n, fn})); const {value:old}=c
  assert.equal(c.value,old); assert.equal(Object.isFrozen(old),false); old.n=99; assert.equal(c.value.n,99)
  s.n=2; assert.notEqual(c.value,old); assert.equal(old.n,99); assert.equal(c.value.n,2)
  assert.equal(computed(()=>fn).value,fn); assert.equal(computed(()=>undefined).value,undefined)
})
test('CORE-070 raw writes and enumeration negative controls', t => {
  const raw={x:1};const s=reactive(raw);const runs=[0,0,0,0]
  t.after(effect(()=>{runs[0]++; void ('x' in s)})); t.after(effect(()=>{runs[1]++;Object.keys(s)}))
  t.after(effect(()=>{runs[2]++;for(const k in s) void k}));t.after(effect(()=>{runs[3]++;void s.x}))
  raw.x=2;assert.deepEqual(runs,[1,1,1,1]);s.y=1;delete s.y;assert.deepEqual(runs,[1,1,1,1]);s.x=3;assert.deepEqual(runs,[1,1,1,2])
})
test('CORE-071 Unicode empty keys false zero shared identities and net rollback', t => {
  const shared={n:0}; const a=reactive({child:shared,list:[]}),b=reactive({child:shared})
  assert.equal(a.child,b.child);assert.equal(reactive(a),a);assert.deepEqual([...a.list],[])
  for(const key of ['', '中文', '🧪',Symbol('k')]) {let runs=0; const s=reactive({[key]:false});t.after(effect(()=>{runs++;void s[key]}));s[key]=0;assert.equal(runs,2);batch(()=>{s[key]=false;s[key]=0});assert.equal(runs,2)}
})
test('CORE-072 all invalid watch argument positions and ignored cleanup returns', () => {
  for(const invalid of [null,undefined,1]) {assert.throws(()=>watch(invalid,()=>{}),TypeError);assert.throws(()=>watch(()=>1,invalid),TypeError)}
  const s=reactive({n:0});let calls=0,cleanups=0;const stop=watch(()=>s.n,()=>{calls++;return ()=>cleanups++});s.n++;stop();stop();s.n++;assert.equal(calls,1);assert.equal(cleanups,0)
})
test('STORE-037 JSON restore is not schema validation; adapter migration works',t=>{
  const a=memory('{"count":"eight","extra":true}');const s=storage({count:1},{name:'schema',adapter:a});t.after(()=>stopStorage(s));assert.equal(s.count,'eight');assert.equal(s.extra,true);assert.equal(a.writes.length,0)
  const b=memory();b.getItem=()=>'{"count":8}';const v=storage({count:1},{name:'migration',adapter:b});t.after(()=>stopStorage(v));assert.equal(v.count,8)
})
test('STORE-038 invalid get/set results this binding and then access once',async t=>{
  const warnings=captureWarnings(t)
  for(const invalid of [undefined,42,{}]) {const a=memory(invalid);a.getItem=function(){assert.equal(this,a);return invalid};const s=storage({n:0},{name:'bad-get',adapter:a});assert.equal(s.n,0);assert.equal(a.writes.length,0);assert.equal(warnings.at(-1)[1].phase,'decode');s.n=1;assert.equal(a.writes.length,1);stopStorage(s)}
  const a=memory();a.setItem=function(){assert.equal(this,a);return 1};const s=storage({n:0},{name:'bad-set',adapter:a});assert.equal(warnings.at(-1)[1].phase,'set');s.n=1;assert.equal(s.n,1);stopStorage(s)
  let gets=0,sets=0;const b={getItem(){assert.equal(this,b);return {get then(){gets++;return resolve=>resolve(null)}}},setItem(){assert.equal(this,b);return {get then(){sets++;return resolve=>resolve()}}}};const v=storage({n:0},{name:'then-once',adapter:b});await turn();assert.equal(gets,1);assert.equal(sets,1);stopStorage(v)
})
test('STORE-039 QUAL-013 reserved keys 3x3 encode/decode and logger failures',t=>{
  const warnings=captureWarnings(t);let checks=0
  for(const key of ['__proto__','constructor','prototype']) for(const shape of ['root','child','array']) {
    const bad={};Object.defineProperty(bad,key,{value:{polluted:true},enumerable:true,writable:true,configurable:true})
    const data=shape==='root'?bad:shape==='child'?{child:bad}:{items:[bad]}
    const a=memory(JSON.stringify(data));const s=storage({safe:1},{name:'decode',adapter:a});assert.deepEqual(Object.keys(s),['safe']);assert.equal(a.writes.length,0);assert.equal(warnings.at(-1)[1].phase,'decode');s.safe=2;assert.equal(JSON.parse(a.value).safe,2);stopStorage(s)
    const b=memory('{"safe":1}');const v=storage({safe:1},{name:'encode',adapter:b});batch(()=>{if(shape==='root') v[key]={polluted:true};else if(shape==='child')v.child=bad;else v.items=[bad]})
    // __proto__ assignment changes the prototype instead of defining a JSON data key;
    // inject that root key with the constructor fixture before binding instead.
    if(shape==='root' && key==='__proto__') {stopStorage(v);const root=Object.assign(Object.create(null),{safe:1});Object.defineProperty(root,key,{value:bad[key],enumerable:true,writable:true,configurable:true});const q=memory('{"safe":1}');const z=storage(root,{name:'root-proto',adapter:q});assert.equal(q.writes.length,0);stopStorage(z)}
    else {assert.equal(b.writes.length,0);assert.equal(warnings.at(-1)[1].phase,'encode');delete v[shape==='root'?key:shape==='child'?'child':'items'];v.safe=2;assert.equal(JSON.parse(b.value).safe,2);stopStorage(v)}
    assert.equal({}.polluted,undefined);checks+=2
  }
  const oldWarn=console.warn;console.warn=()=>{throw Error('logger')};try { const a=memory('{bad');const s=storage({n:0},{name:'logger',adapter:a});s.n=1;assert.equal(JSON.parse(a.value).n,1);stopStorage(s) } finally {console.warn=oldWarn}
  console.log('reserved-key checks:',checks)
})
test('STORE-039 inherited setter preflight never runs or partially restores',t=>{
  captureWarnings(t);const key='qaInheritedSetter';let calls=0;const prior=Object.getOwnPropertyDescriptor(Object.prototype,key)
  Object.defineProperty(Object.prototype,key,{configurable:true,set(){calls++}})
  try {const a=memory('{"safe":2,"qaInheritedSetter":3}');const s=storage({safe:1},{name:'setter',adapter:a});assert.equal(s.safe,1);assert.equal(calls,0);assert.equal(a.writes.length,0);stopStorage(s)}finally{if(prior)Object.defineProperty(Object.prototype,key,prior);else delete Object.prototype[key]}
})
test('STORE-040 Unicode Infinity array named properties and deleted default reload',()=>{
  const a=memory();const s=storage({text:'中文😀\n',hi:Infinity,lo:-Infinity,x:1,items:[1]},{name:'json',adapter:a});s.items.named='ignored';s.text+='x';const json=JSON.parse(a.value);assert.equal(json.text,s.text);assert.equal(json.hi,null);assert.equal(json.lo,null);assert.deepEqual(json.items,[1]);delete s.x;assert.equal('x' in JSON.parse(a.value),false);stopStorage(s);const before=a.writes.length;const v=storage({x:1},{name:'json',adapter:a});assert.equal(v.x,1);assert.equal(a.writes.length,before);stopStorage(v)
})
test('QUAL-012 100 seeds x 1000 operations independent descriptor model',()=>{
  let operations=0
  for(let seed=1;seed<=100;seed++) {
    let rng=seed;const rand=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng>>>0};const values=[undefined,null,false,true,0,-0,NaN,1,2,'中文😀'];const keys=['a','b','c','0','1','2','length']
    const raw=seed%2?{a:0,b:1}: [0,1,2];const model=seed%2?{a:0,b:1}:[0,1,2];const s=reactive(raw);let runs=0;const stop=effect(()=>{runs++;for(const k of keys)void s[k]});const sequence=[]
    const snap=o=>keys.map(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?{has:true,value:d.value}:{has:false}})
    try {for(let step=0;step<1000;step++) {
      const before=snap(model),oldRuns=runs;const group=[];const count=1+rand()%5
      batch(()=>{for(let j=0;j<count;j++) {const key=keys[rand()%keys.length];const remove=rand()%4===0;let value=values[rand()%values.length];if(Array.isArray(model)&&key==='length')value=rand()%6;const op={key,remove,value};group.push(op);const apply=()=>{if(remove){assert.equal(Reflect.deleteProperty(s,key),Reflect.deleteProperty(model,key))}else{assert.equal(Reflect.set(s,key,value),Reflect.set(model,key,value))}};if(j%2)batch(apply);else apply()}})
      sequence.push(group);operations+=count;const after=snap(model);const changed=before.some((x,i)=>x.has!==after[i].has||!Object.is(x.value,after[i].value));assert.deepEqual(snap(s),after,`state seed ${seed} step ${step}`);assert.equal(runs,oldRuns+Number(changed),`notifications seed ${seed} step ${step}`)
    }}catch(e){writeFileSync(new URL('../evidence/model-failure.json',import.meta.url),JSON.stringify({seed,sequence},null,2));throw e}finally{stop()}
  }
  console.log(JSON.stringify({seeds:100,outerBatches:100000,operations}))
})
test('QUAL-015 50 repeated storage/watch failures isolate healthy instances',t=>{
  captureWarnings(t);let fail=false;const bad=memory(),good=memory();const original=bad.setItem;const E=Error('set-failure');bad.setItem=function(k,v){if(fail)throw E;return original.call(this,k,v)}
  const a=storage({n:0},{name:'bad',adapter:bad}),b=storage({n:0},{name:'good',adapter:good});let calls=0;const F=Error('watch-failure');const stop=watch(()=>a.n,()=>{if(fail)throw F});const stopGood=watch(()=>b.n,()=>calls++)
  for(let i=1;i<=50;i++){fail=true;assert.throws(()=>{a.n=i*2-1},e=>e===F);b.n=i*2-1;fail=false;a.n=i*2;b.n=i*2;assert.equal(JSON.parse(bad.value).n,i*2);assert.equal(JSON.parse(good.value).n,i*2)}
  assert.equal(calls,100);stop();stopGood();stopStorage(a);stopStorage(b)
})
test('PKG-016 public entry and deep import rejection',async()=>{
  const require=createRequire(import.meta.url);for(const path of ['@canlooks/reactive/src/index.js','@canlooks/reactive/dist/esm/storage.js','@canlooks/reactive/package.json']){assert.throws(()=>require(path),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});await assert.rejects(import(path),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'})}
  const api=await import('@canlooks/reactive');for(const key of ['stopStorage','toRaw','captureReference'])assert.equal(key in api,false)
})
test('QUAL-007 10000 unrelated subscriptions produce one changed-field notification',()=>{
 const s=reactive(Object.fromEntries(Array.from({length:10000},(_,i)=>['k'+i,0])));let calls=0;const stops=Object.keys(s).map(k=>effect(()=>{void s[k];calls++}));calls=0;s.k0=1;assert.equal(calls,1);stops.forEach(stop=>stop())
})
test('EXPLORATORY cross-realm plain object gets reactive updates',()=>{
  const raw=runInNewContext('({count:0})');const s=reactive(raw);const seen=[];const stop=effect(()=>seen.push(s.count));s.count++;stop();assert.deepEqual(seen,[0,1])
})
