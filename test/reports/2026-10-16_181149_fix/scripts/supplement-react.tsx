// Runtime negative cases deliberately pass inputs outside the public TypeScript types.
import '../../../dom.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import v8 from 'node:v8'
import { act, Component, Fragment, Suspense, createElement, createRef, memo, forwardRef, lazy, useEffect, useState } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { renderToString } from 'react-dom/server'
import { reactive, effect, computed, watch, storage, batch } from '../../../../src/index.js'
import { stopStorage } from '../../../../src/storage.js'
import { RC, RFC, RCC, Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip, Model, defineModel, useLoading, useModel, useWatch, loading } from '../../../../src/react/index.js'
const turn=()=>new Promise<void>(r=>setImmediate(r))
const deferred=()=>{let resolve!: (x?:any)=>void,reject!: (e:any)=>void;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
async function mounted(run:any){const container=document.createElement('div');document.body.append(container);const root=createRoot(container);try{await run(root,container)}finally{await act(async()=>root.unmount());container.remove()}}
function input(el:any,value:string){Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}))}
function ssr(el:any){const win=globalThis.window;Reflect.deleteProperty(globalThis,'window');try{return renderToString(el)}finally{globalThis.window=win}}
test('REACT-001 external wrappers and invalid categories matrix',()=>{
 for(const value of [memo(()=>null),forwardRef(()=>null),lazy(async()=>({default:()=>null})),async()=>null,null,undefined,1,{}])assert.throws(()=>RC(value as any),TypeError)
 const f=()=>null;assert.equal(RC(f),RFC(f));assert.equal(RC(RC(f)),RC(f))
})
test('REACT-002 memo object and function identity changes',async()=>{
 const s=reactive({n:0});let renders=0;const V=RC((p:any)=>{renders++;return <b>{p.o.n+s.n+p.fn()}</b>});const o={n:1},fn=()=>1
 await mounted(async(root:any,c:any)=>{await act(async()=>root.render(<V o={o} fn={fn}/>));assert.equal(renders,1);await act(async()=>root.render(<V o={o} fn={fn}/>));assert.equal(renders,1);await act(async()=>root.render(<V o={{n:2}} fn={fn}/>));assert.equal(renders,2);await act(async()=>root.render(<V o={o} fn={()=>3}/>));assert.equal(renders,3);await act(async()=>{s.n=2});assert.equal(c.textContent,'6')})
})
test('REACT-035 ordinary class methods and getters do not batch or cache',async()=>{
 let inst:any;let getterCalls=0;class V extends Component{n=0;get double(){getterCalls++;return this.n*2} change(){this.n++;this.n++}render(){inst=this;return <b>{this.n}</b>}}const C=RCC(V)
 await mounted(async(root:any)=>{await act(async()=>root.render(<C/>));const seen:any[]=[];const stop=effect(()=>seen.push(inst.n));await act(async()=>inst.change());assert.deepEqual(seen,[0,1,2]);await act(async()=>batch(()=>inst.change()));assert.deepEqual(seen,[0,1,2,4]);void inst.double;void inst.double;assert.equal(getterCalls,2);stop()})
})
test('UI-001 factory identities conditional list mounting and stable keys',async()=>{
 let calls=0,mounts=0,unmounts=0;function Child(){useEffect(()=>{mounts++;return()=>{unmounts++}},[]);return <b>child</b>}
 const factories=[chip,strictChip,asyncChip,asyncStrictChip],types=[Chip,Chip.Strict,AsyncChip,AsyncChip.Strict]
 for(let i=0;i<4;i++){const element=factories[i](()=>{calls++;return <Child/>});assert.equal(element.type,types[i])}assert.equal(calls,0)
 await mounted(async(root:any)=>{const make=()=>factories.map((factory,i)=><Fragment key={i}>{factory(()=> <Child/>)}</Fragment>);await act(async()=>root.render(<>{true&&make()}</>));assert.equal(mounts,4);await act(async()=>root.render(<>{make()}</>));assert.equal(mounts,4);assert.equal(unmounts,0);await act(async()=>root.render(null));assert.equal(unmounts,4)})
})
test('UI-009 legal synchronous nodes and custom thenable rejection',()=>{
 for(const result of [null,'text',<Fragment>x</Fragment>,[<b key="x">x</b>]])ssr(<Chip>{()=>result}</Chip>)
 assert.throws(()=>ssr(<Chip>{(()=>({then(){}})) as any}</Chip>),TypeError)
})
test('UI-019 UI-020 Model DOM events target every property and setter once',async()=>{
 const sym=Symbol('value');const s:any=reactive({nested:{x:'a'},list:['a'],[sym]:'a','':'a',back:'a',get name(){return this.back},set name(v){sets++;this.back=v}});let sets=0
 const cases=[()=>s.nested.x,()=>s.list[0],()=>s[sym],()=>s[''],()=>s.missing,()=>s.name]
 for(let i=0;i<cases.length;i++)await mounted(async(root:any,c:any)=>{await act(async()=>root.render(<Model source={cases[i]}><input/></Model>));await act(async()=>input(c.querySelector('input'),`中文😀${i}`));assert.equal(cases[i](),`中文😀${i}`)})
 assert.equal(sets,1)
})
test('UI-022 all invalid element shapes portal file and valueProp',()=>{
 const s=reactive({n:'a'});const container=document.createElement('div');for(const child of [null,'x',[],[<input key="a"/>,<input key="b"/>],<Fragment/>,createPortal(<input/>,container),<input type="file"/>])assert.throws(()=>ssr(<Model source={()=>s.n}>{child as any}</Model>),TypeError)
 const accepted:any[]=[];for(const v of ['foo',null,1]){try{ssr(<Model source={()=>s.n} valueProp={v as any}><input/></Model>);accepted.push(v)}catch(e){assert.ok(e instanceof TypeError)}}assert.deepEqual(accepted,[],'Invalid valueProp accepted (null currently defaults silently)')
 assert.match(ssr(<Model source={()=>s.n}><input/></Model>),/value="a"/)
})
test('UI-024 Model server values side effects and hydrate input',async()=>{
 let sets=0,callbacks=0;const s=reactive({back:'A',checked:true,selected:'b',get name(){return this.back},set name(v){sets++;this.back=v}})
 const V=()=> <><Model source={()=>s.name}><input id="ssr-text" onChange={()=>callbacks++}/></Model><Model source={()=>s.checked}><input type="checkbox"/></Model><Model source={()=>s.selected}><select><option value="a">A</option><option value="b">B</option></select></Model></>
 const html=ssr(<V/>);assert.match(html,/value="A"/);assert.match(html,/checked/);assert.match(html,/selected/);assert.equal(sets,0);assert.equal(callbacks,0)
 const c=document.createElement('div');c.innerHTML=html;document.body.append(c);const warnings:any[]=[];const old=console.error;console.error=(...x)=>warnings.push(x);let root:any
 try{await act(async()=>{root=hydrateRoot(c,<V/>)});await act(async()=>input(c.querySelector('#ssr-text'),'中文'));assert.equal(s.name,'中文');assert.equal(sets,1);assert.equal(callbacks,1);assert.deepEqual(warnings,[])}finally{await act(async()=>root?.unmount());console.error=old;c.remove()}
})
test('UI-025 genuine cross-document events currentTarget priority and target fallback',async()=>{
 const other=new JSDOM('<input id="a" value="current"><input id="b" value="target">');let model:any;const C=RC(()=>{model=useModel<any>('');return null})
 try{await mounted(async(root:any)=>{await act(async()=>root.render(<C/>));const a=other.window.document.querySelector('#a')!,b=other.window.document.querySelector('#b')!
 await act(async()=>{const e=new other.window.Event('input');Object.defineProperty(e,'currentTarget',{value:a});Object.defineProperty(e,'target',{value:b});model.onChange(e)});assert.equal(model.value,'current')
 await act(async()=>{const e=new other.window.Event('input');Object.defineProperty(e,'target',{value:b});model.onChange(e)});assert.equal(model.value,'target')
 const data={target:b};await act(async()=>model.onChange(data));assert.equal(model.value.target,b)
 let seen:any; b.addEventListener('input',e=>{seen=e;model.onChange(e)});await act(async()=>b.dispatchEvent(new other.window.Event('input',{bubbles:true})));assert.equal(model.value,'target');assert.equal(seen.currentTarget,null)
 })}finally{other.window.close()}
})
test('UI-026 defineModel class protocol children keys and stable mount',async()=>{
 const s=reactive({n:1});let mounts=0,unmounts=0;const args:any[]=[];class Control extends Component<any>{componentDidMount(){mounts++}componentWillUnmount(){unmounts++}render(){return <button onClick={()=>this.props.onChange(7,'kg')}>{this.props.label}:{this.props.value}:{this.props.children}</button>}}
 const M=defineModel(Control,(n:any,unit:any)=>{assert.equal(unit,'kg');return n});await mounted(async(root:any,c:any)=>{const make=(key:string)=><M key={key} refer={()=>s.n} label="mass" onChange={(...a:any[])=>args.push(a)}>child</M>;await act(async()=>root.render(make('a')));assert.equal(c.textContent,'mass:1:child');await act(async()=>c.querySelector('button').click());assert.equal(s.n,7);assert.deepEqual(args,[[7,'kg']]);await act(async()=>root.render(make('a')));assert.equal(mounts,1);await act(async()=>root.render(make('b')));assert.equal(mounts,2);assert.equal(unmounts,1)})
})
test('LOAD-014 invalid fn all numeric edges uncommitted handle and MAX_SAFE_INTEGER',async()=>{
 for(const n of [-1,.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1]){const C=()=>{useLoading(()=>1,n);return null};assert.throws(()=>ssr(<C/>),TypeError)}
 for(const fn of [null,undefined,1,{}]){const C=()=>{useLoading(fn as any);return null};assert.throws(()=>ssr(<C/>),TypeError)}
 const C=()=>{const l=useLoading(()=>1,Number.MAX_SAFE_INTEGER);assert.equal(l.loading,Number.MAX_SAFE_INTEGER);assert.equal(l.stacksCount,0);return null};ssr(<C/>);
 let handle:any,calls=0;const pending=deferred();const S=RC(()=>{handle=useLoading(()=>calls++);throw pending.promise});await mounted(async(root:any)=>{await act(async()=>root.render(<Suspense fallback="pending"><S/></Suspense>));await assert.rejects(handle.load());assert.equal(calls,0)});await act(async()=>pending.resolve())
})
test('LOAD-032 same class instance rejects constructor/render then accepts committed event',async()=>{
 let inst:any,calls=0;const rejected:Promise<any>[]=[];let rendered=false;class V extends Component{busy=false;constructor(p:any){super(p);inst=this;rejected.push(this.run().catch(e=>e))}@loading((s:V)=>s.busy)async run(){calls++;return 7}render(){if(!rendered){rendered=true;rejected.push(this.run().catch(e=>e))}return <b>{String(this.busy)}</b>}}const C=RC(V)
 await mounted(async(root:any)=>{await act(async()=>root.render(<C/>));const errors=await Promise.all(rejected);assert.equal(errors.length,2);assert.ok(errors.every(e=>e instanceof Error));assert.equal(calls,0);await act(async()=>assert.equal(await inst.run(),7));assert.equal(calls,1);assert.equal(inst.busy,false)})
})
test('QUAL-014 integrated Model watch computed concurrent load persist reload unmount',async()=>{
 let json:any=null;const writes:any[]=[];const adapter={getItem(){return json},setItem(k:any,v:any){json=v;writes.push(v)}};const s=storage({name:'A',count:1,mirror:'A'},{name:'e2e',adapter});const double=computed(()=>s.count*2);let load:any;const seen:any[]=[];const d=[deferred(),deferred()]
 const C=RC(()=>{useWatch(()=>s.name,(n,o)=>{seen.push([n,o]);s.mirror=n});load=useLoading((i:number)=>d[i].promise);return <><Model source={()=>s.name}><input/></Model><b>{s.name}/{s.count}/{double.value}/{s.mirror}/{load.stacksCount}</b></>})
 await mounted(async(root:any,c:any)=>{await act(async()=>root.render(<C/>));await act(async()=>input(c.querySelector('input'),'中文'));await act(async()=>batch(()=>{s.count=2;s.count=3}));let p:any,q:any;await act(async()=>{p=load.load(0);q=load.load(1).catch((e:any)=>e)});assert.equal(load.stacksCount,2);const E=Error('business');await act(async()=>{d[1].reject(E);assert.equal(await q,E)});await act(async()=>{d[0].resolve('ok');assert.equal(await p,'ok')});assert.equal(c.querySelector('b').textContent,'中文/3/6/中文/0');assert.deepEqual(seen,[['中文','A']]);assert.deepEqual(JSON.parse(json),{name:'中文',count:3,mirror:'中文'})})
 s.count=4;assert.equal(JSON.parse(json).count,4);stopStorage(s);const reloaded=storage({name:'A',count:1,mirror:'A'},{name:'e2e',adapter});assert.equal(reloaded.count,4);assert.equal(reloaded.name,'中文');stopStorage(reloaded)
})
test('QUAL-010 1000 RC Chip Model loading mount/unmount cycles',async()=>{
 const snap=(name:string)=>v8.writeHeapSnapshot(fileURLToPath(new URL(`../evidence/react-${name}.heapsnapshot`,import.meta.url)));snap('before');const samples:any[]=[];for(let i=0;i<1000;i++){const s=reactive({n:'a'});let callbacks=0,publications=0,handle:any,oldHandler:any;const d=deferred();const Control=(p:any)=>{oldHandler=p.onChange;return <input {...p}/>};const C=RC(()=>{handle=useLoading(()=>d.promise);useWatch(()=>s.n,()=>callbacks++);return <><Chip>{()=>s.n}</Chip><Model source={()=>s.n}><Control/></Model>{String(handle.loading)}</>});let stop:any;
 await mounted(async(root:any)=>{await act(async()=>root.render(<C/>));stop=effect(()=>{void handle.loading;publications++});let p:any;await act(async()=>{p=handle.load()});await act(async()=>{d.resolve(i);await p})});const before=[callbacks,publications];s.n='after';oldHandler('stale');await assert.rejects(handle.load());assert.equal(s.n,'after');assert.deepEqual([callbacks,publications],before);stop();if(i%100===99){global.gc?.();samples.push({cycle:i+1,heapUsed:process.memoryUsage().heapUsed})}if(i===499||i===999)snap(String(i+1))}
 writeFileSync(new URL('../evidence/react-lifecycle.json',import.meta.url),JSON.stringify(samples,null,2))
})
test('QUAL-015 50 recovery rounds with multiple RC stores watchers and adapter failures',async()=>{
 const bad=reactive({n:0}),good=reactive({n:0});let broken=false;const E=Error('callback');let valid=0;const stopBad=watch(()=>bad.n,()=>{if(broken)throw E});const stopGood=watch(()=>good.n,()=>valid++);const A=RC(()=> <b>{bad.n}</b>),B=RC(()=> <i>{good.n}</i>)
 try{await mounted(async(root:any,c:any)=>{await act(async()=>root.render(<><A/><B/></>));for(let i=1;i<=50;i++){await act(async()=>{broken=true;assert.throws(()=>{bad.n=i*2-1},e=>e===E);good.n=i*2-1});assert.equal(c.querySelector('i').textContent,String(i*2-1));await act(async()=>{broken=false;bad.n=i*2;good.n=i*2});assert.equal(c.querySelector('b').textContent,String(i*2));assert.equal(c.querySelector('i').textContent,String(i*2))}});assert.equal(valid,100)}finally{stopBad();stopGood()}
})
