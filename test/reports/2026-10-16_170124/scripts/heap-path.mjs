import {readFileSync,writeFileSync} from 'node:fs'
const data=JSON.parse(readFileSync(new URL('../evidence/heap-clean-retained.heapsnapshot',import.meta.url),'utf8'))
const nf=data.snapshot.meta.node_fields,ef=data.snapshot.meta.edge_fields,nw=nf.length,ew=ef.length,nt=data.snapshot.meta.node_types[0],et=data.snapshot.meta.edge_types[0]
const ni=Object.fromEntries(nf.map((n,i)=>[n,i])),ei=Object.fromEntries(ef.map((n,i)=>[n,i])),rev=new Map(),payloads=[]
const describe=n=>({offset:n,type:nt[data.nodes[n+ni.type]],name:data.strings[data.nodes[n+ni.name]],id:data.nodes[n+ni.id]})
let e=0
for(let n=0;n<data.nodes.length;n+=nw){for(let j=0;j<data.nodes[n+ni.edge_count];j++,e+=ew){const type=et[data.edges[e+ei.type]],v=data.edges[e+ei.name_or_index],name=['element','hidden'].includes(type)?String(v):data.strings[v],to=data.edges[e+ei.to_node];if(name==='qaComputedCanary')payloads.push(n);if(type==='weak')continue;let list=rev.get(to);if(!list)rev.set(to,list=[]);list.push({from:n,to,type,name})}}
const captured=payloads.filter(n=>(rev.get(n)??[]).some(e=>e.type==='context'&&e.name==='payload'));const target=captured[0],queue=[{node:target,path:[]}],seen=new Set([target]);let found
for(let i=0;i<queue.length&&i<300000;i++){const {node,path}=queue[i];if(node===0){found=path;break}for(const edge of rev.get(node)??[]){if(seen.has(edge.from))continue;seen.add(edge.from);queue.push({node:edge.from,path:[edge,...path]})}}
const output={canaryObjects:payloads.length,capturedPayloads:captured.length,target:describe(target),strongRetainingPath:found?.map(x=>({from:describe(x.from),edge:{type:x.type,name:x.name},to:describe(x.to)})),note:'Weak edges excluded. WeakMap ephemeron table edges are displayed as V8 labels; liveness is independently verified by dropping the source and collecting again.'}
writeFileSync(new URL('../evidence/computed-retaining-path.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2))
