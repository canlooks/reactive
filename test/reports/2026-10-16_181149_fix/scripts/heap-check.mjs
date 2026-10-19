import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../evidence/heap-clean-retained.heapsnapshot', import.meta.url), 'utf8'))
const nf = data.snapshot.meta.node_fields, ef = data.snapshot.meta.edge_fields
const ni = Object.fromEntries(nf.map((name, i) => [name, i])), ei = Object.fromEntries(ef.map((name, i) => [name, i]))
const nodeTypes = data.snapshot.meta.node_types[0], edgeTypes = data.snapshot.meta.edge_types[0]
const payloads = new Set(), receivers = new Set(), captured = new Set()
let edge = 0
for (let node = 0; node < data.nodes.length; node += nf.length) {
    for (let j = 0; j < data.nodes[node + ni.edge_count]; j++, edge += ef.length) {
        const type = edgeTypes[data.edges[edge + ei.type]]
        const name = data.strings[data.edges[edge + ei.name_or_index]]
        if (type === 'property' && nodeTypes[data.nodes[node + ni.type]] === 'object') {
            if (name === 'qaComputedCanary') payloads.add(node)
            if (name === 'qaGetterCanary') receivers.add(node)
        }
        if (type === 'context' && name === 'payload') captured.add(data.edges[edge + ei.to_node])
    }
}
const result = { computedCanaryObjects: payloads.size, getterCanaryObjects: receivers.size,
    capturedComputedPayloads: [...payloads].filter(node => captured.has(node)).length,
    incoming: [],
    note: 'Source remains reachable. The report originally showed 1000 captured computed payloads; the fixed snapshot contains none.' }
edge = 0
for (let node = 0; node < data.nodes.length; node += nf.length) {
    for (let j = 0; j < data.nodes[node + ni.edge_count]; j++, edge += ef.length) {
        const to = data.edges[edge + ei.to_node]
        if (!payloads.has(to) && !receivers.has(to)) continue
        result.incoming.push({ to, from: data.strings[data.nodes[node + ni.name]],
            type: edgeTypes[data.edges[edge + ei.type]], name: data.strings[data.edges[edge + ei.name_or_index]] })
    }
}
writeFileSync(new URL('../evidence/heap-canaries.json', import.meta.url), JSON.stringify(result, null, 2))
assert.equal(result.capturedComputedPayloads, 0)
for (const node of [...payloads, ...receivers]) {
    const incoming = result.incoming.filter(edge => edge.to === node)
    assert.ok(incoming.length > 0 && incoming.every(edge => edge.type === 'internal'
        && edge.from === 'system / AllocationSite' && edge.name === 'transition_info'), 'Only V8 allocation templates may remain')
}
console.log(JSON.stringify(result, null, 2))
