import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import notes from './case-notes.mjs'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(report,'../../..'),evidence=resolve(report,'evidence')
const read=p=>readFileSync(resolve(report,p),'utf8'),json=p=>JSON.parse(read(p)),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const link=(label,path)=>`[${label}](${path})`,ev=(name,label=name)=>link(label,`evidence/${name}`)
const env=json('evidence/environment.json'),frozen=json('evidence/source-sha256.json'),resources=json('evidence/resources.json'),memory=json('evidence/memory.json')
const changed=Object.entries(frozen).filter(([p,h])=>!existsSync(resolve(root,p))||hash(resolve(root,p))!==h).map(([p])=>p)
assert.deepEqual(changed,[])
assert.equal(resources.stress.length,6,'Full 1k/10k stress matrix must finish before generating conclusions')
const browser=[...json('evidence/browser-results.json').results,...json('evidence/browser-results-linux-firefox.json').results]
const browserDefects=[...json('evidence/browser-defect.json'),...json('evidence/browser-defect-firefox.json')]
assert.equal(browser.filter(r=>r.status==='passed').length,12);assert.equal(browserDefects.length,6)
const date=d=>new Date(d).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
const started=date(env.started),ended=date(new Date()),tarballHash=hash(resolve(evidence,'canlooks-reactive-5.0.0.tgz'))
writeFileSync(resolve(evidence,'source-integrity.json'),JSON.stringify({checkedAt:new Date().toISOString(),files:Object.keys(frozen).length,changed},null,2))
const names={core:'核心响应式',storage:'持久化',react:'React 基础',ui:'Chip / Model',loading:'加载状态',package:'类型与发布',quality:'兼容性与质量'}
const caseRows=[]
for(const mod of Object.keys(names))for(const line of readFileSync(resolve(root,`test/cases/${mod}.md`),'utf8').split(/\r?\n/)){
 if(!/^\| (CORE|STORE|REACT|UI|LOAD|PKG|QUAL)-\d+ \|/.test(line))continue
 const cells=line.split(/(?<!\\)\|/).slice(1,-1).map(x=>x.trim());assert.equal(cells.length,7)
 const [id,priority,title,preconditions,steps,expected,mapping]=cells
 let status=['CORE-037','STORE-007'].includes(id)?'失败':['QUAL-001','QUAL-006','QUAL-016'].includes(id)?'未执行':'通过'
 let logs=mod==='package'?['npm-test.log','dist.log','package-archived.log']:['npm-test.log']
 if(notes[id])logs=['core','storage'].includes(mod)?['supplement-core.log']:['react','ui','loading'].includes(mod)?['supplement-react.log','supplement-react18.log']:id==='PKG-015'?['readme-types.log','readme-runtime-final.log']:id==='PKG-016'?['package-archived.log']:[]
 if(mod==='quality'){
  const n=Number(id.slice(-3));logs=n<=5?['browser-results.json','browser-results-linux-firefox.json']:n===6?['linux-test.log','linux-build.log','linux-dist.log','linux-package.log','linux-tarball-core.log']:n===7?['benchmark-after-1.json','benchmark-after-2.json','supplement-core.log']:n===8?['benchmark-after-2.json']:n===9?['resources.json']:n===10?['supplement-react.log','supplement-react18.log','gc-esm.log','gc-cjs.log','memory.json']:n===11?['memory.json','heap-canaries.json']:n===12?['supplement-core.log','derived-model.json']:n===13?['supplement-core.log']:n===14?['supplement-react.log','supplement-react18.log']:n===15?['supplement-core.log','supplement-react.log','supplement-react18.log']:['docs.log','linux-ci.log']
 }
 let actual=notes[id]??'本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。'
 if(id==='CORE-037'||id==='STORE-007'){actual='计划原始普通数组步骤通过；扩展到不可删除索引时，length 写入失败但数组部分截断，通知与持久化遗漏（D04）。为防止掩盖同一功能的已知失败，本行整体记失败。';logs=['npm-test.log','exploratory-arrays-source.log','exploratory-arrays-source.json','browser-defect.json','browser-defect-firefox.json']}
 if(id==='QUAL-006')actual+=' 本行保守记未执行：Windows/Linux 子项已通过，macOS 子项未完成；不代表已执行环境失败。'
 if(id==='CORE-073'||id==='STORE-041')logs=['npm-test.log','browser-results.json','browser-results-linux-firefox.json','package-archived.log']
 if(id==='CORE-074')logs=['npm-test.log','gc-esm.log','gc-cjs.log','memory.json']
 caseRows.push({id,mod,priority,title,preconditions,steps,expected,mapping,status,actual,logs,defects:['CORE-037','STORE-007'].includes(id)?['D04']:[]})
}
assert.equal(caseRows.length,242);assert.equal(new Set(caseRows.map(c=>c.id)).size,242)
const counts=Object.fromEntries(['通过','失败','未执行'].map(s=>[s,caseRows.filter(c=>c.status===s).length]))
const priorities=Object.fromEntries(['P0','P1','P2'].map(p=>[p,caseRows.filter(c=>c.priority===p).length]))
const commands=readdirSync(evidence).filter(n=>n.endsWith('.result.json')).map(n=>json('evidence/'+n)).sort((a,b)=>a.started.localeCompare(b.started))
const benchmarkRounds=[1,2].map(n=>({before:json(`evidence/benchmark-before-${n}.json`).benchmarks,after:json(`evidence/benchmark-after-${n}.json`).benchmarks}))
const derivedRounds=[1,2].map(n=>json(`evidence/derived-isolated-${n}.json`))
const exceeds=(a,b)=>b>a*1.2&&b-a>2
const comparisons=benchmarkRounds[0].after.map((a,i)=>({name:a.name,rounds:benchmarkRounds.map(r=>({before:r.before[i],after:r.after[i]}))}))
const derivedNames=[...new Set(derivedRounds[0].map(r=>r.name))]
const derivedComparison=derivedNames.map(name=>({name,rounds:derivedRounds.map(rows=>({before:rows.find(r=>r.name===name&&r.variant==='before'),after:rows.find(r=>r.name===name&&r.variant==='after')}))}))
const flagged=rows=>rows.filter(row=>['medianMs','p95Ms'].some(metric=>row.rounds.every(r=>exceeds(r.before[metric],r.after[metric])))).map(r=>r.name)
const benchmarkFlagged=flagged(comparisons),derivedFlagged=flagged(derivedComparison)
const fmt=n=>Number(n).toFixed(3)
const sections=[]
const section=(id,title)=>{const s={id,title,blocks:[]};sections.push(s);return s}
const p=(s,text)=>s.blocks.push({kind:'p',text}),table=(s,headers,rows)=>s.blocks.push({kind:'table',headers,rows}),code=(s,lang,text)=>s.blocks.push({kind:'code',lang,text}),list=(s,items)=>s.blocks.push({kind:'list',items})

let s=section('conclusion','1. 测试结论与发布判断')
p(s,'当前项目存在 1 项本轮新确认的 S1 功能缺陷 D04，尚未修复：数组部分截断后漏发通知，导致派生缓存、watch、React DOM 和 storage 记录与内存状态不一致。187 项已有主测试全部通过仍不足以判定无 BUG。本轮不满足测试计划的发布退出标准。')
p(s,'被测 79 份源码、测试、配置及文档与 2026-10-16 修复后快照逐字节一致；本轮发现的是旧用例未覆盖的问题，不是本轮修改引入的回归。生产代码、依赖声明、锁文件及原有测试均未改动。新增脚本、原始日志、快照和报告均位于本轮目录；dist 按测试计划重新构建。')
table(s,['结果口径','本轮结论'],[
 ['已有主测试','110 项核心/存储 + 77 项 React = 187/187；fail/cancelled/skipped/todo 均为 0。'],
 ['补充与 GC','核心补充 14/14；React 补充 15/15（19 源码、18 实际包各执行一次）；GC ESM/CJS 各 9/9；新增 computed 模型测试 1/1。'],
 ['真实浏览器常规矩阵','Chromium / WebKit（Windows）、Firefox（Linux/WSL），React 18/19 × dev/prod 共 12/12 通过。Windows Firefox 启动阻塞。'],
 ['D04 探索复现','源码/ESM/CJS × 4 种调用共 12 个独立组合失败；三引擎 × React 18/19 共 6 个页面组合失败。同一根因，不计成 18 个 BUG。'],
 ['计划 242 条逐行账本',`${counts.通过} 通过、${counts.失败} 失败、${counts.未执行} 未执行（部分子项已执行）。原 A 映射为 203 条，P/M 补充为 39 条；不等同于独立 node:test 数量。`],
 ['历史问题','D01 跨 realm、D02 派生回收、D03 valueProp=null 三项修复保持有效。R01 高频 computed 性能风险继续记录，不能据主测试通过关闭。']
])
p(s,'计数规则：ESM/CJS/React 18/19/Linux 的重复执行是环境验证，不累计为新增功能用例。D04 与 CORE-037 / STORE-007 关联，原始普通数组步骤通过，但扩展边界失败，因此这两行整体记失败。未执行项不计通过。')

s=section('baseline','2. 被测版本、环境与可复现证据')
table(s,['项目','记录'],[
 ['执行时间',`${started} 至 ${ended}，Asia/Shanghai`],['测试对象','@canlooks/reactive@5.0.0 当前未提交工作区'],['Git HEAD',env.head],
 ['Windows',`${env.release} ${env.arch}；Node ${env.node}；npm 11.19.0`],['Linux','Ubuntu 26.04 / WSL2；Node v24.14.1；npm 11.11.0'],
 ['硬件',`${env.cpus[0].model}；${env.cpus.length} 逻辑处理器；${(env.ramBytes/1024**3).toFixed(2)} GiB RAM`],
 ['开发依赖',Object.entries(env.versions).map(([k,v])=>`${k} ${v}`).join('；')],
 ['隔离 React 18','react/react-dom 18.3.1；@types/react 18.3.31；@types/react-dom 18.3.7'],['隔离 React 19','react/react-dom/@types 19.3.0'],
 ['包文件','90 个白名单文件；六个核心导出、十九个 React 导出；核心无 React/DOM/localforage 消费通过'],['本轮 tarball SHA-256',tarballHash]
])
p(s,[link('测试计划','../../TEST_PLAN.md'),link('上轮修复报告','../2026-10-16_181149_fix/report.md'),ev('source-sha256.json','源码指纹'),ev('source-integrity.json','结束时一致性'),ev('changes-since-fix.json','与修复快照比较'),ev('worktree.diff','已有工作区差异'),ev('git-status.txt','初始状态'),ev('environment.json','Windows 环境'),ev('linux-environment.txt','Linux 环境')].join(' · '))
p(s,[ev('core-only-package-lock.json','核心消费者 lock'),ev('react-18-package-lock.json','React 18 lock'),ev('react-19-package-lock.json','React 19 lock'),ev('browser-package-lock.json','浏览器夹具 lock'),ev('linux-same-tarball-lock.json','Linux 同包 lock'),ev('canlooks-reactive-5.0.0.tgz','实际测试包')].join(' · '))
p(s,'package-archived.mjs 是保留锁文件和 tarball 的测试脚本副本。正式 npm run test:package 也单独执行成功，因此归档操作没有替代或改写正式入口。Linux 在本轮专属缓存目录从源码快照 npm ci；同包测试另安装本轮 Windows tarball。浏览器工具与 Linux Node 复用本机已有安装，业务 bundle 和库包均来自本轮产物。')

s=section('execution','3. 实际执行结果')
table(s,['测试层','结果','证据'],[
 ['Windows npm test','187/187；3 个源码/测试类型检查通过',ev('npm-test.log')],['build / test:dist','ESM/CJS、Node 双入口、两种混用方向及声明检查通过',ev('build.log')+' / '+ev('dist.log')],
 ['正式 test:package','退出码 0；无 React 核心、React 18/19 完整 77 项行为及类型通过',ev('package.log')],['包级证据归档','实际 tarball、消费者锁及完整日志已保存',ev('package-archived.log')],
 ['补充核心/存储','14/14；300040 次独立模型操作、18 组危险键投影、50 轮异常恢复',ev('supplement-core.log')],
 ['补充 React','19 源码和 18 安装包各 15/15，包含各 1000 次挂载卸载',ev('supplement-react.log')+' / '+ev('supplement-react18.log')],
 ['新增条件 computed DAG 模型','100 seeds × 1000 外层批次 × 12 个计算节点；277936 次修改及中途读取通过',ev('derived-model.json')+' / '+ev('derived-model.log')],
 ['独立派生 GC','ESM 9/9，CJS 9/9；活动订阅保活与弃用派生释放均正常',ev('gc-esm.log')+' / '+ev('gc-cjs.log')],
 ['README','26 个可执行块类型与行为通过，fetch/localforage 示例使用受控 mock',ev('readme-types.log')+' / '+ev('readme-runtime-final.log')],
 ['Linux','npm ci / test / build / test:dist / 两种 GC / docs / test:package 均退出 0；同 Windows tarball 消费通过',ev('linux.log')+' / '+ev('linux-test.log')+' / '+ev('linux-package.log')],
 ['文档映射','11 份 Markdown、242 条详细用例、187 项主测试映射通过',ev('docs.log')],
 ['探索首次执行','16 项：8 通过、8 失败；失败均为 D04，未跳过',ev('exploratory-arrays.log')],
 ['源码补充与复验','24 项：12 通过、12 失败，包含重验 ESM/CJS；失败均为 D04',ev('exploratory-arrays-source.log')]
])
p(s,'已有套件全部通过与新增探索失败同时成立。首次失败日志完整保留，未删除断言、反转预期、修改生产代码或将失败转为跳过。README 首次运行使用了未包含提取子目录的 tsconfig，出现 React 未定义/装饰器转换错误；指定提取目录自己的配置后 26 段全部通过，详见执行异常记录。')

s=section('D04','4. D04：失败的数组 length 写入造成漏通知（S1 / P0）')
const sourceLines=readFileSync(resolve(root,'src/reactive.ts'),'utf8').split(/\r?\n/),guardLine=sourceLines.findIndex(l=>l.includes('if (success && target === toRaw(receiver))'))+1
p(s,`定位：${link('src/reactive.ts','../../../src/reactive.ts')} 第 ${guardLine-1}～${guardLine+5} 行，Proxy set trap。关联 CORE-037、CORE-058、STORE-007、STORE-006 及 React 外部 store 更新链路；逐行统计归于 CORE-037 / STORE-007。README 第 736、742 行分别承诺已成功写入仍结算、数组截断通知实际受影响属性。`)
p(s,'触发条件：数组中间有一个不可配置（不可删除）的索引，尾部还有可删除的索引，随后通过代理把 length 缩到受保护索引之前。JavaScript 会先删除高位元素，再在受保护索引处停止；Reflect.set 返回 false，但数组已变短。严格模式赋值抛 TypeError 也不能恢复已经删除的尾部。')
code(s,'js',`import { reactive, computed, effect } from '@canlooks/reactive'
const raw = [10, 20, 30, 40]
Object.defineProperty(raw, '1', { configurable: false })
const list = reactive(raw)
const size = computed(() => list.length)
const seen = []
const stop = effect(() => seen.push(list.length))
console.log(size.value) // 4：先建立缓存
console.log(Reflect.set(list, 'length', 0)) // false
console.log(list.length, Object.hasOwn(list, '3')) // 2, false
console.log(size.value, seen) // 实际 4, [4]；预期 2, [4, 2]
stop()`)
table(s,['观察项','预期','实际'],[
 ['原始数组语义','返回 false；length=2，索引 2/3 删除','符合 JS 语义，本身不是 BUG'],['effect','初始 [4,40] 后收到 [2,undefined]','只收到初始状态'],
 ['watch length','callback(2,4)','无回调；后续合法 length=3 时错误地跳过中间状态，callback(3,4)'],['computed','长度 2 / 尾元素 undefined','仍是长度 4 / 尾元素 40'],['storage','最终 JSON [10,20]','仍为 [10,20,30,40]，重新加载可能恢复已删尾部'],['React DOM','2:undefined:2','4:40:4，三引擎及 React 18/19 均复现']
])
p(s,'根因：set trap 只有在 success 为 true 时才调用 recordChange，错误地把操作失败等同于状态未变。数组 ArraySetLength 的部分失败不符合这个假设。length 与隐式删除索引的前态其实已采集，只是在返回 false 时全部丢弃，进而没有失效 computed，也没有通知 storage 的深层观察者。')
list(s,[
 '修复建议：保留 receiver 属于当前 raw target 的判断，但不以 success=true 为记录变化的前提。Reflect.set 返回后对目标属性及已采集的隐式索引逐一比较前后状态；让现有 recordChange / samePropertyState 过滤真正无变化的失败。继续返回原布尔结果，不回滚数组，也不提前额外执行 length 类型转换。',
 '不要仅在 catch 分支处理：Reflect.set 的这条路径返回 false，并不抛错；严格赋值的 TypeError 产生在代理 trap 返回之后。也不要把所有失败都强制通知，完全未变化的只读数组应保持零额外通知。',
 '最小方案见 suggested-D04.patch（仅建议草案，未应用、未经完整修复回归）。数组只含普通可删除元素时行为应保持不变；保留稀疏数组按自有索引枚举，避免扫描巨大 length。',
 '修复验收：覆盖 numeric/string length、Reflect.set/严格赋值/外层 batch；断言实际 length、已删/保留索引、effect/watch 次数和 oldValue、computed 中途读取、storage 最终 JSON、React DOM、后续合法写入。增加完全不变的只读/受保护尾项负对照及通知抛错后的队列恢复。之后执行完整 npm test、dist、package、GC 和三浏览器矩阵。',
 '临时规避：保持业务响应式数组元素可删除；确需固定元素时，在应用写入前校验截断范围，或把过滤后的新数组赋给一个可写的响应式容器属性。仅捕获 TypeError 或再写一次当前 length 无法触发缺失通知，batch 包裹也无法规避。'
])
p(s,[ev('exploratory-arrays-source.json','完整值/通知/恢复记录'),ev('browser-defect.json','Chromium/WebKit 复现'),ev('browser-defect-firefox.json','Firefox 复现'),ev('linux-partial-truncation.log','Linux 同 tarball 复现'),link('可运行最小矩阵','scripts/exploratory-arrays.mjs'),ev('suggested-D04.patch','建议补丁草案')].join(' · '))
p(s,'严重度为 S1：公开通知契约在受限但合法的数组描述符场景失效，已观察到页面与磁盘记录陈旧。没有把返回 false 或 TypeError 本身报为缺陷，也没有把未声明的 defineProperty 响应式通知列为要求；不可配置描述符在创建代理之前已设置。')

s=section('history','5. 历史缺陷复验')
table(s,['编号','复验结论','证据'],[
 ['D01 跨 realm','Node vm 与三引擎 iframe 的普通对象、嵌套/用户类通知、内建排除、storage 恢复和访问器零调用通过',ev('npm-test.log')+' / '+ev('browser-results.json')+' / '+ev('browser-results-linux-firefox.json')],
 ['D02 派生回收','存活源旁的 1000 个 computed 载荷与 1000 个 getter receiver 均回收为 0；活动 effect/watch 跨 GC 保持通知；两种模块图独立 9/9',ev('memory.json')+' / '+ev('heap-canaries.json')+' / '+ev('gc-esm.log')+' / '+ev('gc-cjs.log')],
 ['D03 valueProp=null','Model / defineModel 明确拒绝非法 null；合法省略/undefined/value/checked 及 null 模型数据通过；三个消费端类型入口通过',ev('npm-test.log')+' / '+ev('supplement-react.log')+' / '+ev('supplement-react18.log')],
 ['R01 computed 额外成本','继续评审；两轮独立微基准详见下节。保持内存修复，不能建议退回有泄漏的旧实现。',ev('derived-isolated-1.json')+' / '+ev('derived-isolated-2.json')]
])

s=section('browsers','6. 真实浏览器、安装包与平台覆盖')
table(s,['引擎 / OS','版本','React','构建','常规断言组','D04'],browser.filter(b=>b.status==='passed').map(b=>[`${b.engine} / ${b.engine==='firefox'?'Linux/WSL':'Windows'}`,b.browserVersion,b.reactVersion,b.mode,`${b.checks.length}/10 通过`,'同引擎 dev 的 18/19 均复现']))
p(s,'每个常规组合覆盖：真实输入/checkbox/select/multiple/数字空值、Chip 隔离、加载乱序、local/session 刷新与标签隔离、受控 SecurityError/QuotaExceededError 及恢复、真实强制 IndexedDB、SSR/hydration 正反例、真实 iframe 跨 realm、原生 ESM 和关闭会话后重开。每个失败注入都有对应阶段记录；常规矩阵未出现非预期 pageerror 或 console 错误。这里的 12/12 不包含 D04 的故障场景。')
p(s,'SSR 双请求夹具在 React 19 服务端生成简单 p 元素，React 18/19 客户端分别 hydrate；各 major 的包级完整套件另含其自身 SSR 验证。IndexedDB 明确确认驱动为 asyncStorage，没有把 localStorage 回退当成 IndexedDB 成功。')
const blocked=browser.filter(b=>b.status==='blocked')
p(s,`Windows Firefox 启动失败记录：${blocked.map(b=>b.error).join('；')}。Linux Firefox 成功不能代替 Windows Firefox 平台证明。macOS/Safari 未执行；WebKit 引擎通过不能表述为 Safari 真机通过。自动化 insertText 不等同系统剪贴板粘贴或原生 IME。`)
p(s,[ev('browser-results.json'),ev('browser-results-linux-firefox.json'),ev('chromium-19-development.png','Chromium 截图'),ev('webkit-19-development.png','WebKit 截图'),ev('firefox-19-development.png','Firefox 截图'),ev('D04-chromium-19.png','D04 页面截图')].join(' · '))

s=section('performance','7. 性能、压力与资源')
p(s,'固定微基准各预热 3 次、测量 10 次，中位数为中间两项均值，P95 取最近秩第 10 项。性能专用命令在大对象压力与浏览器任务结束后顺序执行；压力阶段的耗时只用于规模观察。比较基线为 10 月 16 日 D02 修复前的归档构建，用于复核历史 R01，不是把有泄漏的旧实现视为推荐版本。本轮源码与修复后基线完全一致，不能据运行噪声声称新增代码回归。')
table(s,['固定场景（第 2 轮）','修复前中位数 ms','当前中位数 ms','修复前 P95 ms','当前 P95 ms'],comparisons.map(r=>{const t=r.rounds[1];return [r.name,fmt(t.before.medianMs),fmt(t.after.medianMs),fmt(t.before.p95Ms),fmt(t.after.p95Ms)]}))
p(s,`按“同一指标连续两轮增加 >20% 且绝对增加 >2ms”的计划观察阈值，固定规模基准命中：${benchmarkFlagged.length?benchmarkFlagged.join('、'):'无'}。该阈值用于评审，不是项目承诺的绝对性能 SLA。`)
p(s,'computed 微基准规模：single 为单计算值/单消费者/10000 次写入；shared-100 为 100 消费者/100 次写入；shared-1000 为 1000 消费者/10 次写入；chain-16 为 16 层计算链/1000 次写入。计时包含订阅、写入和 stop，不包含样本间 GC。')
table(s,['computed 微基准（第 2 轮）','修复前中位数 ms','当前中位数 ms','修复前 P95 ms','当前 P95 ms'],derivedComparison.map(r=>{const t=r.rounds[1];return [r.name,fmt(t.before.medianMs),fmt(t.after.medianMs),fmt(t.before.p95Ms),fmt(t.after.p95Ms)]}))
p(s,`R01 两轮复核命中：${derivedFlagged.length?derivedFlagged.join('、'):'本轮未连续命中'}。测量在样本间跨事件循环并在计时外 GC、交替前后顺序，完整计数/结果断言通过。${derivedFlagged.length?'结果支持继续保留性能风险，需按真实业务 computed 写入频率评审。':'本轮结果不能反向抹除上轮稳定复现的性能开销；保留历史风险供业务负载复核。'} 优化应围绕弱订阅解析、登记复用和保活路径，并同时保护 D02 的回收与活动订阅语义。`)
p(s,[ev('benchmark-before-1.json'),ev('benchmark-after-1.json'),ev('benchmark-before-2.json'),ev('benchmark-after-2.json'),ev('derived-isolated-1.json'),ev('derived-isolated-2.json')].join(' · '))
table(s,['存储压力：每组 5×10000 次编辑','字段数','每轮 set 次数','maxActive','平均每轮 ms','最终 JSON 字节'],resources.stress.map(r=>[r.mode,r.fields,[...new Set(r.samples.map(x=>x.writes))].join('/'),r.maxActive,fmt(r.samples.reduce((s,x)=>s+x.ms,0)/r.samples.length),r.samples.at(-1).bytes]))
p(s,'共 300000 次压力编辑；异步在途最多 1 个 set，每轮只发首个与最后快照 2 次写入，没有积累 10000 次待写调用，最后磁盘 JSON 与最新内存一致。异步等待合并不会消除每次变更的全图扫描：一万字段逐次编辑仍有显著 CPU 成本。此为性能观察，未按缺失的 SLA 擅自判为新功能 BUG；业务事务可使用同步 batch 合并，同步段外不承诺自动批处理。')
p(s,`内存诊断：computed/getter 各创建 1000 个，源保留时存活 ${memory.retained.computed}/${memory.retained.getters}，释放源后 ${memory.released.computed}/${memory.released.getters}；保留共享 child 的 storage 根存活 ${memory.storageAlive}，异步 I/O 完成后根存活 ${memory.asyncStorageAlive}。每阶段跨 ${memory.gcRoundsPerPhase} 轮事件循环/GC，堆入边检查仅剩 V8 AllocationSite 模板，不把模板当作业务泄漏。`)
p(s,'React 18/19 各 1000 轮 RC/Chip/Model/loading 挂载卸载，旧 handler 不再写入，旧 load 拒绝，外部修改不再产生已停止回调；每 100 轮记录堆，保存 before/500/1000 三份快照。GC 时机和进程堆波动不作为单次失败标准；有限压力结果不证明任意时长或规模均无泄漏。')
p(s,'压力脚本 resources.json 的两组 storage 初次诊断各显示 1 个根存活，未隐藏该原始结果。追加对照明确定位为第 999 号（最后一次循环）局部值：创建函数尚未返回时存活，函数返回并再次跨轮 GC 后两组均为 0，且共享 child 仍保留。与独立 factory 形式的 memory.mjs 及正式 GC 套件相符，不据此误报库保留泄漏。'+ev('storage-liveness-check.json','诊断对照')+' / '+ev('storage-liveness-check.log'))
p(s,[ev('resources.json'),ev('memory.json'),ev('heap-canaries.json'),ev('react-lifecycle.json'),ev('react18-lifecycle.json'),ev('heap-clean-retained.heapsnapshot','派生源保留堆'),ev('react-1000.heapsnapshot','React 19 结束堆'),ev('react18-1000.heapsnapshot','React 18 结束堆')].join(' · '))

s=section('coverage','8. 需求与用例执行覆盖')
table(s,['模块','计划用例','通过','失败','未执行'],Object.keys(names).map(mod=>{const rows=caseRows.filter(c=>c.mod===mod);return [names[mod],rows.length,...['通过','失败','未执行'].map(v=>rows.filter(c=>c.status===v).length)]}))
p(s,`优先级分布：${Object.entries(priorities).map(([k,v])=>`${k} ${v}`).join('、')}。保守整行执行率 (通过+失败)/计划 = ${((counts.通过+counts.失败)/242*100).toFixed(2)}%；已执行整行通过率 = ${(counts.通过/(counts.通过+counts.失败)*100).toFixed(2)}%。这两个比例不是行/分支覆盖率；本轮未采集 V8 行覆盖率。`)
p(s,'未执行：QUAL-001 的系统 IME/真实剪贴板；QUAL-006 的 macOS/Safari 子项；QUAL-016 的独立人工交付演练。这些行已完成的自动化子项仍保留证据，但整行不计通过。不适用项为 0，未替维护者签署平台排除。Windows Firefox 另有明确环境阻塞。')
p(s,'每条记录的原始前置、步骤、预期和自动化映射列于下方；“通过”表示列明范围的实际断言通过。测试计划和基线文档中的 105/76、181/240 是历史数量，本轮按 validate-docs 实际得到的 110/77、187/242 统计。')

s=section('issues','9. 执行异常、限制与修复顺序')
table(s,['事项','判断与处理','证据'],[
 ['Windows Firefox spawn UNKNOWN','浏览器启动环境阻塞；原日志保留，Linux Firefox 另行完成，未覆盖为 Windows 成功',ev('browser.log')+' / '+ev('browser-results.json')],
 ['README 首次 React/装饰器报错','提取后的 .tsx 位于子目录，首次使用的 tsconfig 未包含它们；改为明确指定提取目录配置后 26/26。没有给示例塞 React 全局或修改库实现。',ev('readme-runtime.log')+' / '+ev('readme-results-initial.json')+' / '+ev('readme-runtime-final.log')],
 ['Linux D04 首次手工启动命令','跨 shell 的未引用 PATH 包含空格/括号导致 bash 解析失败；改为有完整引号的 linux-defect.sh 后正常运行并确认产品失败。与库逻辑无关。',link('修正后的脚本','scripts/linux-defect.sh')],
 ['测试边界','没有原生 IME/真实剪贴板、macOS/Safari、独立人工签收；没有最低浏览器版本和任意无限规模承诺。压力计时未记录电源模式/温度，需将机器噪声纳入评审。','见第 8 节'],
 ['BUG 状态','D04 已确认、未修复；建议优先修复并把边界用例纳入正式核心/存储/React 套件。R01 继续性能评审。','发布门槛仍未满足']
])
list(s,['先修复 D04 并回归公开入口、两种模块与三引擎；不要把失败写入统一当成无变化。','再根据真实业务写频率评审 R01 和大对象逐次扫描成本，优化时保留 GC 证据与净变化语义。','补齐系统输入、目标 macOS/Safari 与独立验收；发布负责人明确支持平台并签收所有未执行项。'])

s=section('rerun','10. 复跑入口与交付清单')
code(s,'powershell',`# 在项目根目录运行；输出写入新目录时先复制并调整报告脚本路径
npm test
npm run build
npm run test:dist
npm run test:package
node --expose-gc --test test/derived-lifecycle.mjs
node --expose-gc test/derived-lifecycle.mjs --cjs
node test/validate-docs.mjs

# 当前未修复版本应失败（D04）
node --test test/reports/2026-10-19_171129/scripts/exploratory-arrays.mjs

# 新增 computed 图模型测试
node --test test/reports/2026-10-19_171129/scripts/derived-model.mjs`)
p(s,'完整命令及参数、CWD、UTC 起止、耗时、退出码见各 *.result.json；Linux 子步骤另有 *.exit.txt。浏览器运行需要本轮 .runtime 安装及 Playwright 1.62.0 对应引擎，首次准备使用 setup-browser.mjs；Linux 脚本中的已有 Node/浏览器安装路径应在其他机器调整。不要直接复跑并覆盖历史证据目录。')
table(s,['交付','说明'],[[link('report.md','report.md'),'完整 Markdown 报告与 242 行执行账本'],[link('report.html','report.html'),'离线 HTML，支持检索/状态筛选/用例展开与打印'],[link('results.json','results.json'),'结构化结果、缺陷、环境矩阵及完整用例数据'],[ev('manifest.json'),'证据文件 SHA-256 清单'],[ev('source-snapshot/package.json','源码快照入口'),'79 文件快照 + 历史文档证据附件'],[link('scripts/run-command.mjs','scripts/run-command.mjs'),'所有执行与新增复现/模型/浏览器/报告验证脚本']])
p(s,'报告自检：242 条记录及唯一 ID、全部本地链接、失败/未执行筛选、D04 检索、详情展开、桌面/390px 移动视口及页面异常检查通过。'+ev('report-validation.json','自检结果')+' · '+ev('report-desktop.png','桌面预览')+' · '+ev('report-mobile.png','移动预览')+' · '+ev('verification.json','源文件/产物一致性与建议补丁检查'))

s=section('commands','11. 命令结果清单')
table(s,['命令标识','退出码','耗时 s','日志'],commands.map(r=>[r.name,r.exitCode,(r.durationMs/1000).toFixed(2),ev(r.name+'.log')]))
p(s,'退出码 1 的 D04 复现脚本代表真实产品断言失败；browser 的 1 来自 Windows Firefox 启动阻塞；readme-runtime 的首次 1 来自测试夹具配置，最终 readme-runtime-final 为 0。它们不能合并成一个“所有命令成功”的结论。建议补丁仅为审阅草案，不代表本报告测试对象已修复。')

// Render both formats from one structured source so conclusions cannot diverge.
const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const inline=x=>escape(x).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/`([^`]+)`/g,'<code>$1</code>')
const cell=x=>String(x).replaceAll('|','\\|').replaceAll('\n','<br>')
const mdTable=(h,rows)=>`| ${h.map(cell).join(' | ')} |\n| ${h.map(()=>'---').join(' | ')} |\n${rows.map(r=>'| '+r.map(cell).join(' | ')+' |').join('\n')}\n`
const mdBlock=b=>b.kind==='p'?b.text+'\n':b.kind==='table'?mdTable(b.headers,b.rows):b.kind==='list'?b.items.map(x=>'- '+x).join('\n')+'\n':'```'+b.lang+'\n'+b.text+'\n```\n'
const htmlTable=(h,rows)=>'<div class="table-scroll"><table><thead><tr>'+h.map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'
const htmlBlock=b=>b.kind==='p'?'<p>'+inline(b.text)+'</p>':b.kind==='table'?htmlTable(b.headers,b.rows):b.kind==='list'?'<ul>'+b.items.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>':'<pre><code>'+escape(b.text)+'</code></pre>'
const caseLinks=c=>c.logs.map(l=>ev(l)).join(' · ')
let md='# @canlooks/reactive 全面测试报告\n\n'+`运行：2026-10-19_171129 · ${ended} · Asia/Shanghai\n\n`
md+=sections.map(s=>'## '+s.title+'\n\n'+s.blocks.map(mdBlock).join('\n')).join('\n')
md+='\n## 12. 242 条用例执行账本\n\n'
for(const mod of Object.keys(names)){
 md+='### '+names[mod]+'\n\n'
 md+=mdTable(['ID / 优先级','目标 / 状态','本轮实际与证据','原自动化映射'],caseRows.filter(c=>c.mod===mod).map(c=>[c.id+' / '+c.priority,c.title+' / '+c.status,c.actual+' '+caseLinks(c),c.mapping]))
 md+='\n'
 for(const c of caseRows.filter(c=>c.mod===mod))md+=`<details><summary>${c.id} 原始前置、步骤、预期</summary>\n\n- 前置/数据：${c.preconditions}\n- 步骤：${c.steps}\n- 预期：${c.expected}\n- 计划位置：${link('test/cases/'+mod+'.md','../../cases/'+mod+'.md')}\n\n</details>\n\n`
}
const caseHtml=caseRows.map(c=>`<tr data-case="${c.id}" data-status="${c.status}"><td class="id">${c.id}<small>${c.priority} · ${names[c.mod]}</small></td><td><span class="badge ${c.status==='通过'?'ok':c.status==='失败'?'bad':'pending'}">${c.status}</span></td><td><details><summary>${escape(c.title)}</summary><dl><dt>前置 / 数据</dt><dd>${inline(c.preconditions)}</dd><dt>步骤</dt><dd>${inline(c.steps)}</dd><dt>预期</dt><dd>${inline(c.expected)}</dd><dt>原自动化映射</dt><dd>${inline(c.mapping)}</dd></dl><a href="../../cases/${c.mod}.md">原计划</a></details><p>${inline(c.actual)}</p><div class="evidence-links">${caseLinks(c).split(' · ').map(inline).join(' · ')}</div></td></tr>`).join('')
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reactive 全面测试报告 · 2026-10-19</title><style>
:root{color-scheme:light;--ink:#172d36;--muted:#61757d;--paper:#f4f7f8;--line:#d9e3e6;--teal:#087c73;--bad:#ab3444;--amber:#8b671b}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.75 "Segoe UI","Microsoft YaHei",sans-serif}a{color:#096b91;text-underline-offset:3px;overflow-wrap:anywhere}code{font-family:Consolas,monospace;overflow-wrap:anywhere}main{max-width:1250px;margin:auto;padding:44px 36px 72px}header{padding:30px 36px;background:#143942;color:#fff;border-radius:18px;position:relative;overflow:hidden}header::after{content:"";position:absolute;width:220px;height:220px;border:40px solid #ffffff08;border-radius:50%;right:-70px;top:-60px}header .eyebrow{color:#a5d9d2;font-size:12px;letter-spacing:.12em}h1{font-size:33px;line-height:1.3;letter-spacing:-.02em;margin:14px 0}header p{margin:10px 0 0;color:#d6e5e9}h2{font-size:23px;margin:0 0 20px;line-height:1.45}h3{font-size:18px}p{margin:16px 0;overflow-wrap:anywhere}section{background:white;border:1px solid var(--line);border-radius:14px;margin-top:24px;padding:28px;scroll-margin-top:20px}.alert{background:#fff1f1;border:1px solid #efc6cb;border-left:4px solid var(--bad);padding:18px 22px;margin-top:22px;border-radius:9px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px}.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 22px}.card strong{font-size:32px;display:block;line-height:1.25}.card span{font-size:13px;color:var(--muted)}.card.bad strong{color:var(--bad)}.card.ok strong{color:var(--teal)}nav{display:flex;flex-wrap:wrap;gap:8px 18px;margin:23px 0 0;padding:0 3px}nav a{font-size:13px;text-decoration:none}.table-scroll{overflow:auto;max-width:100%;margin:18px 0;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.65}th,td{border-bottom:1px solid var(--line);padding:12px 14px;text-align:left;vertical-align:top}th{background:#edf4f5;color:#35535c;font-size:12px;font-weight:600}tr:last-child td{border-bottom:0}tbody tr:hover{background:#f9fbfb}td{min-width:110px;max-width:700px;overflow-wrap:anywhere}pre{background:#152f38;color:#ddf1ed;padding:22px;border-radius:9px;overflow:auto;font-size:13px;line-height:1.7}pre code{white-space:pre;overflow-wrap:normal}li{margin:10px 0}.filters{display:flex;flex-wrap:wrap;gap:14px;align-items:end;background:#edf4f5;padding:16px;border-radius:10px}.filters label{font-size:12px;color:#46616b;display:flex;flex-direction:column;gap:5px}.filters input,.filters select{height:40px;border:1px solid #b7cbcf;border-radius:6px;background:white;padding:8px 12px;color:var(--ink);font:inherit}.filters input{width:310px;max-width:100%}#shown{color:var(--muted);font-size:13px;margin:0 0 8px}.id{white-space:nowrap;font-weight:650;min-width:125px}.id small{display:block;font-size:11px;font-weight:400;color:var(--muted)}.badge{display:inline-block;border-radius:5px;padding:2px 9px;font-size:12px;white-space:nowrap}.ok{color:var(--teal)}.badge.ok{background:#e4f4ef}.badge.bad{color:var(--bad);background:#fce8eb}.badge.pending{color:var(--amber);background:#fbf1dc}.evidence-links{font-size:11px;word-break:break-word}details{margin:0}summary{cursor:pointer;font-weight:600}dl{margin:14px 0;color:#50646c;font-size:12px}dt{font-weight:bold;margin-top:8px}dd{margin:2px 0 8px}tr[hidden]{display:none}.case-table td:nth-child(2){min-width:76px}footer{padding:28px 0;color:var(--muted);font-size:12px}.print-btn{border:0;border-radius:6px;padding:8px 12px;background:#dceeed;color:#235650;cursor:pointer}
@media(max-width:700px){main{padding:20px 12px 42px}header{padding:25px 22px}h1{font-size:25px}.cards{grid-template-columns:repeat(2,1fr);gap:8px}.card{padding:16px}.card strong{font-size:27px}section{padding:20px 15px}h2{font-size:20px}.filters input{width:235px}.table-scroll{font-size:12px}nav{gap:6px 12px}.alert{padding:15px}}@media print{body{background:white}main{max-width:none;padding:0}section{break-inside:auto;border:0;border-top:1px solid #ccc;border-radius:0}.filters,nav,.print-btn{display:none}.table-scroll{overflow:visible}header{background:white;color:#172d36;border:1px solid #ccc}header p,header .eyebrow{color:#172d36}.cards{break-inside:avoid}a{color:inherit;text-decoration:none}pre{white-space:pre-wrap}thead{display:table-header-group}}
</style></head><body><main><header><div class="eyebrow">QUALITY REVIEW · ${escape('@canlooks/reactive@5.0.0')}</div><h1>全面测试报告</h1><p>2026-10-19 · 当前工作区 · Windows / Linux · React 18 / 19</p></header><div class="alert"><strong>发布退出标准未满足</strong> — 新确认 S1 缺陷 D04：数组部分截断漏通知。历史 D01–D03 修复有效；人工输入与平台验收仍有缺口。</div><div class="cards"><div class="card ok"><strong>187 / 187</strong><span>已有主测试通过</span></div><div class="card bad"><strong>1</strong><span>已确认功能 BUG · D04</span></div><div class="card ok"><strong>12 / 12</strong><span>常规浏览器组合通过</span></div><div class="card"><strong>${counts.通过} / 242</strong><span>用例整行通过 · ${counts.失败} 失败 / ${counts.未执行} 未执行</span></div></div><nav>${sections.map(s=>'<a href="#'+s.id+'">'+escape(s.title)+'</a>').join('')}<a href="#cases">12. 用例账本</a><a href="report.md">Markdown</a><button class="print-btn" onclick="window.print()">打印 / 保存 PDF</button></nav>${sections.map(s=>'<section id="'+s.id+'"><h2>'+escape(s.title)+'</h2>'+s.blocks.map(htmlBlock).join('')+'</section>').join('')}<section id="cases"><h2>12. 242 条用例执行账本</h2><p>展开目标查看原始前置、步骤、预期和自动化映射。输入 D04 可筛出受影响的计划条目。</p><div class="filters"><label>搜索 ID、模块、目标或缺陷<input id="case-search" type="search" placeholder="例如 D04 / STORE / loading"></label><label>执行状态<select id="case-status"><option value="">全部状态</option><option>通过</option><option>失败</option><option>未执行</option></select></label><span id="shown">242 / 242</span></div><div class="table-scroll"><table class="case-table"><thead><tr><th>用例</th><th>状态</th><th>目标、实际结果与证据</th></tr></thead><tbody>${caseHtml}</tbody></table></div></section><footer>生成：${escape(ended)}（Asia/Shanghai）· 79 份受测文件前后指纹一致 · 结论适用于本报告列明的版本、参数和环境。</footer></main><script>const search=document.querySelector('#case-search'),select=document.querySelector('#case-status'),rows=[...document.querySelectorAll('tr[data-case]')];function filter(){let shown=0;const q=search.value.trim().toLowerCase();for(const row of rows){row.hidden=!!((select.value&&row.dataset.status!==select.value)||(q&&!row.textContent.toLowerCase().includes(q)));if(!row.hidden)shown++}document.querySelector('#shown').textContent=shown+' / '+rows.length}search.addEventListener('input',filter);select.addEventListener('change',filter);</script></body></html>`
const data={run:'2026-10-19_171129',started,ended,timezone:'Asia/Shanghai',head:env.head,tarballHash,sourceIntegrity:{files:79,changed},counts,priorities,cases:caseRows,defects:[{id:'D04',severity:'S1',status:'confirmed-open',title:'Failed partial array truncation drops real change notifications',source:'src/reactive.ts',line:guardLine}],benchmarkFlagged,derivedFlagged,browser,browserDefects,commands}
writeFileSync(resolve(report,'report.md'),md);writeFileSync(resolve(report,'report.html'),html);writeFileSync(resolve(report,'results.json'),JSON.stringify(data,null,2))
console.log(JSON.stringify({report,counts,benchmarkFlagged,derivedFlagged,tarballHash,sourceChanges:changed},null,2))
