import React, { useEffect } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { reactive, computed, effect, batch, storage } from '@canlooks/reactive'
import { RC, Model, Chip, useLoading, useWatch } from '@canlooks/reactive/react'
import localforage from 'localforage'
const query=new URLSearchParams(location.search), run=query.get('run')||'qa', prefix=`qa:${run}:`
const events:any[]=[], renders={parent:0,a:0,b:0}, state=reactive({text:'A',checked:false,one:'a',many:[] as string[],num:1,a:0,b:0,mirror:'A'})
const tasks:any[]=[];let loading:any
const App=RC(()=>{renders.parent++;loading=useLoading(()=>new Promise((resolve,reject)=>tasks.push({resolve,reject})));useWatch(()=>state.text,(next,old)=>{events.push({type:'watch',next,old});state.mirror=next});return <>
 <Model source={()=>state.text}><input id="text" onChange={(e:any)=>events.push({type:'change',value:e.currentTarget.value})}/></Model>
 <Model source={()=>state.checked}><input id="check" type="checkbox"/></Model>
 <Model source={()=>state.one}><select id="one"><option value="a">A</option><option value="b">B</option></select></Model>
 <Model source={()=>state.many}><select id="many" multiple><option value="a">A</option><option value="b">B</option><option value="c">C</option></select></Model>
 <Model source={()=>state.num} postValue={(e:any)=>e.currentTarget.value===''?null:Number(e.currentTarget.value)}><input id="number" type="number"/></Model>
 <Chip>{()=>{renders.a++;return <span id="chip-a">{state.a}</span>}}</Chip><Chip>{()=>{renders.b++;return <span id="chip-b">{state.b}</span>}}</Chip>
 <button id="load" onClick={()=>void loading.load().then((v:any)=>events.push({type:'success',v}), (e:any)=>events.push({type:'failure',error:String(e)}))}>load</button>
 <Chip>{()=> <span id="loading">{String(loading.loading)}/{loading.stacksCount}</span>}</Chip>
 </>})
const root=createRoot(document.querySelector('#app')!);root.render(<App/>);
const nativeLocal=storage({n:0},{name:prefix+'local'}),nativeSession=storage({n:0},{name:prefix+'session',type:'sessionStorage'})
const lf=localforage.createInstance({name:prefix+'indexeddb',storeName:'states',driver:localforage.INDEXEDDB})
const io:any[]=[];let lfState:any,active=0,maxActive=0,failNext=false,releaseRead:any
const track=(kind:string,p:Promise<any>)=>{const row:any={kind,status:'pending'};io.push(row);return p.then(v=>{row.status='ok';return v},e=>{row.status='failed';throw e})}
const qa:any={state,events,renders,nativeLocal,nativeSession,prefix,io,ready:false,reactVersion:React.version,
 finish(i:number,fail=false){if(fail)tasks[i].reject(Error('qa-failure'));else tasks[i].resolve('done'+i)},
 snapshot(){return {state:JSON.parse(JSON.stringify(state)),renders:{...renders},loading:loading?{loading:loading.loading,count:loading.stacksCount}:null,local:nativeLocal.n,session:nativeSession.n}},
 unmount(){root.unmount()},
 async initIndexedDB(delay=false){await lf.ready();if(lf.driver()!==localforage.INDEXEDDB)throw Error('not IndexedDB');const adapter={getItem(k:string){const p=lf.getItem<string>(k);return track('get',delay?new Promise(resolve=>{releaseRead=async()=>resolve(await p)}):p)},setItem(k:string,v:string){active++;maxActive=Math.max(maxActive,active);const p=failNext?(failNext=false,Promise.reject(Error('qa-set-failure'))):lf.setItem(k,v);return track('set',p.then(()=>{},e=>{throw e}).finally(()=>active--))}};lfState=storage({n:0},{name:'data',adapter});return lf.driver()},
 editIndexedDB(n:number){lfState.n=n},releaseRead(){releaseRead()},failNext(){failNext=true},
 async indexedDB(){return {driver:lf.driver(),disk:await lf.getItem('data'),state:lfState?.n,maxActive,io}},
 async cleanup(){await lf.dropInstance();localStorage.removeItem(prefix+'local');sessionStorage.removeItem(prefix+'session');localStorage.removeItem(prefix+'hydration')},
 attachHydrationStorage(){return storage(qa.hydration.s,{name:prefix+'hydration'})},
 faultStorage(){const logs:any[]=[];const old=console.warn;console.warn=(...x)=>logs.push(x);const own=Object.getOwnPropertyDescriptor(window,'localStorage');try{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('denied','SecurityError')}});const s=storage({n:0},{name:prefix+'access'});s.n=1;if(s.n!==1)throw Error('memory failed')}finally{if(own)Object.defineProperty(window,'localStorage',own);else delete (window as any).localStorage;console.warn=old}let fail=true;const adapter={getItem(){return null},setItem(){if(fail)throw new DOMException('quota','QuotaExceededError')}};console.warn=(...x)=>logs.push(x);try{const s=storage({n:0},{name:prefix+'quota',adapter});s.n=1;fail=false;s.n=2;return {phases:logs.map(x=>x[1].phase),names:logs.map(x=>x[1].error.name),n:s.n}}finally{console.warn=old}},
 crossRealm(){
  const frame=document.createElement('iframe');document.body.append(frame)
  const realm=frame.contentWindow as any,stops:(()=>void)[]=[]
  const check=(ok:boolean,message:string)=>{if(!ok)throw Error('cross-realm: '+message)}
  try{
   const raw=realm.eval('({n:0,child:{n:0},nil:Object.assign(Object.create(null),{n:0}),list:[0]})')
   const s=reactive(raw),seen:number[]=[],nested:number[][]=[]
   stops.push(effect(()=>seen.push(s.n)),effect(()=>nested.push([s.child.n,s.nil.n,s.list.length])))
   batch(()=>{s.n++;s.child.n++;s.nil.n++;s.list.push(1)})
   check(reactive(raw)===s&&reactive(s)===s&&s.child===s.child,'proxy identity')
   check(JSON.stringify(nested)==='[[0,0,1],[1,1,2]]','nested notifications')
   const user=reactive(realm.eval('new (class User {n=1; get doubled(){return this.n*2}})'))
   const values:number[]=[];stops.push(effect(()=>values.push(user.doubled)));user.n++
   check(JSON.stringify(values)==='[2,4]','user class getter')
   const builtins=realm.eval('[new Map(),new Set(),new Date(),Promise.resolve(),/x/,new Uint8Array(2),new URL("https://example.com"),new Headers(),new (class extends Date {})()]')
   check(builtins.every((v:any)=>reactive(v)===v&&reactive({value:v}).value===v),'built-in identity')
   const data=realm.eval('({n:0,child:{n:1}})'),writes:string[]=[]
   const saved=storage(data,{name:'iframe',adapter:{getItem(){return '{"n":3}'},setItem(_key,value){writes.push(value)}}})
   check(saved===reactive(data)&&saved.n===3&&writes.length===0,'storage restore')
   saved.child.n=2;check(writes[0]==='{"child":{"n":2},"n":3}','storage deep write')
   let getterCalls=0
   Object.defineProperty(data,Symbol.toStringTag,{get(){getterCalls++;throw Error('tag')}})
   const tagged=realm.eval('({n:0})');Object.defineProperty(tagged,Symbol.toStringTag,{get(){getterCalls++;throw Error('tag')}})
   check(reactive(tagged)!==tagged,'tagged plain object');check(getterCalls===0,'tag accessor executed')
   let rejected=0
   for(const bad of [realm.eval('new (class User {})()'),...builtins]){
    try{storage(bad,{name:'invalid',adapter:{getItem(){return null},setItem(){}}})}catch(e){if(e instanceof TypeError)rejected++;else throw e}
   }
   check(rejected===builtins.length+1,'storage accepted branded root')
   return {isRaw:s===raw,seen,nested,classValues:values,builtins:builtins.length,storageWrites:writes,accessorCalls:getterCalls,rejected}
  }finally{stops.forEach(stop=>stop());frame.remove()}
 },
 hydrate(initial:string,mismatch=false){const box=document.createElement('div');box.innerHTML=qa.ssrHtml;document.body.append(box);const s=reactive({name:initial});let callbacks=0;const C=RC(()=>{useWatch(()=>s.name,()=>callbacks++);useEffect(()=>{token.ready=true},[]);return <p>{s.name}</p>});const errors:any[]=[];const r=hydrateRoot(box,<C/>,{onRecoverableError:e=>errors.push(String(e))});const token={s,errors,ready:false,get text(){return box.textContent},get callbacks(){return callbacks},unmount(){r.unmount();box.remove()}};qa.hydration=token;return true}
};(window as any).qa=qa;requestAnimationFrame(()=>qa.ready=true)
