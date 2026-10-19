import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {reactive,storage} from '../../../../dist/esm/index.js'
const turn=()=>new Promise(r=>setImmediate(r)),collect=async()=>{for(let i=0;i<12;i++){await turn();global.gc()}}
const alive=refs=>refs.flatMap((r,i)=>r.deref()?[i]:[])
async function inline(){
 const shared=reactive({n:0}),refs=[],done=[],asyncRefs=[]
 for(let i=0;i<1000;i++){const root=storage({child:shared},{name:'inline-'+i,adapter:{getItem(){return null},setItem(){}}});refs.push(new WeakRef(root))}
 await collect();const sharedAlive=alive(refs)
 for(let i=0;i<1000;i++){const root=storage({n:0},{name:'inline-async-'+i,adapter:{getItem(){return Promise.resolve(null)},setItem(){return new Promise(r=>done.push(r))}}});asyncRefs.push(new WeakRef(root))}
 await turn();while(done.length)done.shift()();await collect()
 return {shared,refs,asyncRefs,during:{sharedAlive,asyncAlive:alive(asyncRefs)}}
}
const trial=await inline();await collect()
const result={duringCreator:trial.during,afterCreatorReturned:{sharedAlive:alive(trial.refs),asyncAlive:alive(trial.asyncRefs)},note:'A creator stack/frame or same-job WeakRef keepalive can retain a final loop local. After returning the creator, only weak root references remain; the shared child is still held.'}
writeFileSync(new URL('../evidence/storage-liveness-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
assert.deepEqual(result.afterCreatorReturned.sharedAlive,[]);assert.deepEqual(result.afterCreatorReturned.asyncAlive,[])
