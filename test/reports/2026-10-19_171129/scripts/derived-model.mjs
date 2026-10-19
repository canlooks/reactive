import assert from 'node:assert/strict'
import {test} from 'node:test'
import {writeFileSync} from 'node:fs'
import {reactive,computed,effect,batch} from '../../../../dist/esm/index.js'
test('EXP-DERIVED 100 seeds x 1000 nested batches with conditional computed DAGs',()=>{
 let operations=0,reads=0
 for(let seed=1;seed<=100;seed++){
  let r=seed;const random=()=>{r^=r<<13;r^=r>>>17;r^=r<<5;return r>>>0}
  const raw={a:0,b:1,c:2,f0:true,f1:false,f2:true},model={...raw},s=reactive(raw),nodes=[],specs=[],sequence=[]
  const keys=['a','b','c'],flags=['f0','f1','f2']
  for(let i=0;i<12;i++){
   const spec={flag:flags[random()%3],key:keys[random()%3],parent:i?random()%i:-1,other:i?random()%i:-1};specs.push(spec)
   nodes.push(computed(()=>((s[spec.flag]?(spec.parent<0?7:nodes[spec.parent].value)+s[spec.key]:(spec.other<0?3:nodes[spec.other].value)-s[spec.key]))%101))
  }
  const expected=i=>{const spec=specs[i];return (model[spec.flag]?(spec.parent<0?7:expected(spec.parent))+model[spec.key]:(spec.other<0?3:expected(spec.other))-model[spec.key])%101}
  let last;const stop=effect(()=>{last=nodes[11].value})
  try{for(let step=0;step<1000;step++){
   const group=[];sequence.push(group)
   batch(()=>{for(let j=0;j<1+random()%6;j++){
    const key=random()%3===0?flags[random()%3]:keys[random()%3],value=key[0]==='f'?!!(random()%2):random()%20
    group.push({key,value});const mutate=()=>{s[key]=value;model[key]=value;operations++}
    if(j%2)batch(mutate);else mutate()
    const pick=random()%12;assert.equal(nodes[pick].value,expected(pick));reads++
   }})
   assert.equal(nodes[11].value,expected(11),`final seed=${seed} step=${step}`)
   assert.equal(last,expected(11),`observer seed=${seed} step=${step}`)
  }}catch(e){writeFileSync(new URL('../evidence/derived-model-failure.json',import.meta.url),JSON.stringify({seed,specs,sequence,error:String(e)},null,2));throw e}finally{stop()}
 }
 const result={seeds:100,outerBatches:100000,computedNodesPerSeed:12,operations,intermediateReads:reads,status:'passed'}
 writeFileSync(new URL('../evidence/derived-model.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
})
