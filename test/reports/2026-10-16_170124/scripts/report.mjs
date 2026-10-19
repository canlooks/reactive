import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(report,'../../..'),evidence=resolve(report,'evidence')
const read=p=>readFileSync(resolve(report,p),'utf8'),json=p=>JSON.parse(read(p)),link=(text,path)=>`[${text}](${path})`
const env=json('evidence/environment.json'),bench=json('evidence/benchmark-clean.json'),resource=json('evidence/resources.json'),memory=json('evidence/memory.json')
const browser=[...json('evidence/browser-results.json').results,...json('evidence/browser-results-linux-firefox.json').results]
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const before=json('evidence/source-sha256.json'),changed=Object.entries(before).filter(([p,h])=>!existsSync(resolve(root,p))||hash(resolve(root,p))!==h).map(([p])=>p)
writeFileSync(resolve(evidence,'source-integrity.json'),JSON.stringify({checkedAt:new Date().toISOString(),files:Object.keys(before).length,changed},null,2))
if(changed.length)throw Error('Tested source changed: '+changed.join(','))
const started=new Date(env.started).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),ended=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
const tarballHash=hash(resolve(evidence,'canlooks-reactive-5.0.0.tgz'))
const modNames={core:'核心响应式',storage:'持久化',react:'React 基础',ui:'Chip / Model',loading:'加载状态',package:'类型与发布',quality:'兼容与质量'}
const supplemental={
 'CORE-069':'对象结果可修改且同次缓存保留引用；函数/undefined 原样返回；解构值保持旧快照。',
 'CORE-070':'raw 写入、in/Object.keys/for...in 不触发结构订阅；代理字段写入正常通知。',
 'CORE-071':'空键、中文、emoji、symbol、false/0、空数组和跨根共享 child 身份及批内回退通过。',
 'CORE-072':'null/undefined/数字分别置于 source/callback 均拒绝；stop 幂等，回调返回函数未执行。',
 'STORE-037':'合法 JSON 的 count="eight" 和未知字段按数据恢复；adapter 显式迁移后为数字 8。',
 'STORE-038':'非法 get 返回值报告 decode；非法同步 set 报告 set；this 为 adapter，then getter 各读取一次。',
 'STORE-039':'三危险键 × 根/嵌套/数组元素 × 编码/解码共 18 组；继承 setter 独立进程测试无执行及半恢复。',
 'STORE-040':'中文/emoji/换行、±Infinity→null、数组命名属性忽略；删除默认字段后重载补回且纯恢复不写回。',
 'REACT-001':'真实 memo/forwardRef/lazy、async、null/undefined/数字/对象全部拒绝；重复本库包装保持身份。',
 'REACT-002':'相同对象与函数引用跳过渲染；替换引用、store 更新正确显示；React 18/19 补充复测通过。',
 'REACT-035':'普通方法两次写入通知两次，显式 batch 一次；getter 重读两次求值，18/19 一致。',
 'UI-001':'四工厂调用时零 children 执行；条件/列表挂载各一次，相同 key 重渲染不重挂载。',
 'UI-009':'null/text/Fragment/array 同步 ReactNode 可用；自定义 thenable 被 TypeError 拒绝。',
 'UI-019':'nested、数组 0、symbol、空键、缺失字段的真实 DOM input 事件均写到正确位置。',
 'UI-020':'Model DOM 输入触发可写 getter 的 setter 恰好一次，backing 字段正确。',
 'UI-022':'元素形状与非 null 非法 valueProp 拒绝；valueProp=null 被静默当作缺省，严格负例失败（D03，契约待确认）。',
 'UI-024':'SSR input/checkbox/select 输出正确，setter/callback 零执行；匹配 hydrate 后输入调用各一次，无 warning。',
 'UI-025':'第二个 jsdom Window 的真实 Event：有效 currentTarget 优先，否则使用 target；结束后 currentTarget=null 不影响已取值；普通对象保留为数据。',
 'UI-026':'defineModel 类控件保留 label/children/onChange(7,"kg")；相同 key 不重挂，换 key 按 React 重建。',
 'LOAD-014':'所有非法数值及非函数拒绝，MAX_SAFE_INTEGER 初值接受；首次 Suspense 未提交句柄拒绝且业务次数零。',
 'LOAD-032':'同一类实例构造/render 调用拒绝；成功提交后相同方法返回 7，busy 正常归零。',
 'PKG-015':'逐段提取 README 的 26 个可执行代码块，严格类型和运行断言全部通过；fetch/localforage 示例用可控夹具。',
 'PKG-016':'真实 tarball 的 require/import 深路径均 ERR_PACKAGE_PATH_NOT_EXPORTED；内部符号未公开，90 文件白名单通过。',
 'QUAL-001':'三引擎 × React 18/19 × dev/prod 常规表单、Unicode/emoji、Chip、乱序 loading 已执行；未操作原生 OS 中文 IME，也未验证系统剪贴板真实粘贴，整行阻塞。',
 'QUAL-002':'原生 local/session 同页刷新、独立新标签、关闭原标签后重开；local 共享且 session 隔离；跨页修改不自动同步内存。',
 'QUAL-003':'真实浏览器环境注入 SecurityError / QuotaExceededError，内存可继续编辑，恢复后写入成功；没有实际填满磁盘或修改用户浏览器权限。',
 'QUAL-004':'强制 asyncStorage/IndexedDB 驱动，保存 JSON 字符串、纯刷新恢复、迟到读取与本地编辑冲突、写失败恢复及 maxActive=1 通过。',
 'QUAL-005':'Node HTTP SSR 独立 A/B 请求；浏览器等待提交后 hydrate 更新及启用 storage；匹配无错误，不匹配负对照产生预期错误。SSR 夹具为 React 19 的简单 p 元素，18/19 客户端均验证；既有包级 SSR 在各自 React major 内执行。',
 'QUAL-006':'Windows 与 Ubuntu/WSL Node 24 全基线命令通过；同一 Windows tarball 在 Linux 消费成功；esbuild dev/prod 和原生浏览器 ESM 使用默认浏览器入口。macOS/Safari 未验证。',
 'QUAL-007':'3 次预热 + 10 次计时；computed 100k 读取只求值 1 次；10k 写入普通/batch 通知 10000/1；10k 无关订阅只有目标字段 1 次通知。',
 'QUAL-008':'length=1e9、3 个自有索引截断通过；深度 100/1000 代理与 JSON 存储通过，未推导无限深度支持。',
 'QUAL-009':'1k/10k 字段 × 同步批量/同步逐次/异步在途 × 5 轮，每轮 10k 编辑；写入数 1/10000/2，异步 maxActive=1，最终 JSON 正确。',
 'QUAL-010':'effect/watch stop 1000 轮及 React 18/19 各 1000 轮 RC/Chip/Model/loading 卸载行为通过，各保留 3 份堆快照；扩展 derived 生命周期测试发现 1000 个弃用 computed 和 getter 根持续保留（D02）。',
 'QUAL-011':'两组各 1000 个 storage 根：共享 child 保留/异步 I/O 完成后，多轮 GC 均 0 根存活；仅作诊断证据，不承诺 GC 时限。',
 'QUAL-012':'种子 1～100 × 1000 外层批次，实际 300040 个 set/delete 操作，嵌套 batch、NaN、±0、属性存在性及简单数组全部与独立 JS 模型一致。',
 'QUAL-013':'18 组危险键编码/解码与继承 setter、会抛错的 logger，修复后正常保存；多 store 错误隔离对照通过。',
 'QUAL-014':'Model 中文编辑、watch mirror、count 2→3 / computed 6、两任务乱序成功/失败、落盘重载和卸载后继续持久化通过。',
 'QUAL-015':'50 轮 adapter/watch 错误与恢复，以及 React 18/19 多 RC 与多 watch 并行对照；正常实例无漏更新，原 callback 错误保真。',
 'QUAL-016':'文档校验通过，Linux 干净 npm ci 和隔离消费可复现；要求的“未参与开发的独立测试人员”交付演练无法由本代理代签，整行阻塞。'
}
const cases=[]
for(const mod of Object.keys(modNames))for(const line of readFileSync(resolve(root,`test/cases/${mod}.md`),'utf8').split(/\r?\n/)){
 if(!/^\| (CORE|STORE|REACT|UI|LOAD|PKG|QUAL)-\d+ \|/.test(line))continue
 const cells=line.split(/(?<!\\)\|/).slice(1,-1).map(s=>s.trim());if(cells.length!==7)throw Error('Unexpected case columns: '+line)
 const [id,priority,title,preconditions,steps,expected,mapping]=cells
 let status=['UI-022','QUAL-010'].includes(id)?'失败':['QUAL-001','QUAL-016'].includes(id)?'阻塞':'通过'
 let logs=mod==='package'?['npm-test.log','dist.log','package-archived.log']:['npm-test.log']
 if(supplemental[id])logs=mod==='core'||mod==='storage'?['supplement-core-final.log']:['react','ui','loading'].includes(mod)?['supplement-react-complete.log','supplement-react18.log']:id==='PKG-015'?['readme-types-2.log','readme-runtime-final.log']:id==='PKG-016'?['package-archived.log']:[]
 if(id.startsWith('QUAL-')){
 const n=Number(id.slice(-3));logs=n<=5?['browsers-complete.log','linux-firefox.log']:n===6?['linux-test.log','linux-build.log','linux-dist.log','linux-package.log','linux-tarball-core.log']:n===7?['benchmark.log','supplement-core-final.log']:n===8?['benchmark.log']:n===9?['resources.log']:n===10?['supplement-react-complete.log','supplement-react18.log','memory-confirm.log']:n===11?['memory-confirm.log']:n===12||n===13?['supplement-core-final.log']:n===14?['supplement-react-complete.log','supplement-react18.log']:n===15?['supplement-core-final.log','supplement-react-complete.log','supplement-react18.log']:['docs.log','linux-ci.log']
 }
 const actual=supplemental[id]??'本轮完整自动化及对应类型/产物检查通过；按原 A 映射直接断言判定，未把其他环境或探索场景自动计入通过。'
 cases.push({id,mod,priority,title,preconditions,steps,expected,mapping,status,actual,logs,defects:id==='UI-022'?['D03']:id==='QUAL-010'?['D02']:[]})
}
if(cases.length!==240)throw Error('Case count mismatch')
const counts=Object.fromEntries(['通过','失败','阻塞'].map(s=>[s,cases.filter(c=>c.status===s).length]))
const moduleRows=Object.keys(modNames).map(m=>{const c=cases.filter(x=>x.mod===m);return[modNames[m],c.length,...['通过','失败','阻塞'].map(s=>c.filter(x=>x.status===s).length)]})
const commandNames=['npm-test','build','dist','package','package-archived','supplement-core-final','supplement-react-complete','supplement-react18','readme-types-2','readme-runtime-final','resources','benchmark','memory-confirm','browsers-complete','docs']
const commandRows=commandNames.map(n=>{const r=json(`evidence/${n}.result.json`);return[n,r.exitCode,(r.durationMs/1000).toFixed(3)+' s',link('完整日志',`evidence/${n}.log`)]})
const browserRows=browser.map(b=>[b.engine,b.browserVersion,b.engine==='firefox'?'Ubuntu 26.04 / WSL':'Windows 10.0.26300',b.reactVersion,b.mode,b.status==='passed'?'常规场景通过':'失败',b.crossRealm?.isRaw&&b.crossRealm.seen?.length===1?'D01 复现（漏通知）':'未复现'])
const defects=[{
 id:'D02',level:'S1',kind:'已确认缺陷',title:'弃用 computed / 自动 getter 被长生命周期源永久保留',location:'src/effect.ts:194–201；src/computed.ts:18–20；src/reactive.ts:66–73',
 conditions:'在长期存活的 store 上重复创建、读取后丢弃 computed；或创建读取该 store 的 getter 对象并丢弃。无需保留外壳，也无需活动 effect。',
 expected:'业务已不再持有的派生对象及捕获载荷可以回收；依赖图不应让每次临时派生无限累积。',
 actual:'专用进程 12 轮跨事件循环 GC：1000/1000 computed 载荷、1000/1000 getter 根仍存活；释放唯一共享源后均变为 0。同条件 storage 两组各 1000 个根均回收为 0。两轮独立资源诊断均复现。',
 cause:'trackDep 将 computed 的 EffectNode 强引用加入源属性 Dep Set；节点强持有 fn/闭包。自动 getter 的 fn 还捕获 receiver，反向保留整个对象。WeakMap 以活跃源为 key 并不能释放它的强引用 value 图。堆路径为 source proxy → raw → targetDeps Map → Dep Set → EffectNode.fn → Context.payload。',
 fix:'优先调整派生节点的生命周期：源到无外部拥有者的 computed 节点使用可清扫弱引用；活跃 computed 外壳及真实消费者继续保证节点存活。自动 getter 同步采用该机制。不要只在 finalizer 的 holding 中强持有 fn/receiver；不要简单在最后 effect.stop 后清空所有 deps，这会使仍存活但暂时无消费者的缓存失效失灵。也可评估显式 scope/dispose，但这属于公共契约设计变更。',
 workaround:'复用有限数量的 computed，避免在循环/重复渲染中临时创建并读取；需要手工生命周期时直接使用可 stop 的 effect/watch，或确保整个源及其派生图一起释放。',
 regression:'保留源、丢弃外壳/最后消费者的 GC 与堆保留链；getter receiver 回收；仍活跃 computed 的惰性失效；分支回退、菱形依赖、stop、异常及 Suspense 的全部原用例。',
 evidence:['memory-confirm.log','memory.json','computed-retaining-path.json','heap-clean-retained.heapsnapshot','heap-clean-released.heapsnapshot'],
 code:"import { reactive, computed } from './dist/esm/index.js'\nconst source = reactive({ n: 0 })\nfunction temporary() {\n  const payload = { large: new Array(1000).fill(1) }\n  const weak = new WeakRef(payload)\n  const c = computed(() => source.n + payload.large[0])\n  void c.value\n  return weak\n}\nconst refs = Array.from({ length: 1000 }, temporary)\n// 跨多轮 setImmediate + global.gc() 后，源仍存活时全部载荷保留。\n// 可直接执行 scripts/memory.mjs 获取三份堆快照和释放源的对照。"
},{
 id:'D01',level:'S2',kind:'已确认缺陷',title:'跨 realm 普通对象被误判为内建实例，静默失去响应式',location:'src/reactive.ts:35–44、181；storage 同类判定点 src/storageSnapshot.ts:11',
 conditions:'将 iframe.contentWindow 创建的普通对象，或 Node vm.runInNewContext 返回的普通对象传给 reactive。',
 expected:'普通对象得到代理；effect 首次值 0，随后经返回值写入 1 应同步收到 1。已声明边界只排除 Map/Date 等依赖内部槽的内建对象，没有排除另一个 realm 的普通对象。',
 actual:'reactive(raw) === raw；effect 序列仅 [0]，实际值已变为 1。Node vm 两轮补充测试及 Chromium/Firefox/WebKit × React 18/19 × dev/prod 共 12 个 iframe 场景全部复现。',
 cause:'外部 realm 的 Object 构造函数与当前 Object 引用不同，ctor !== Object 成立；随后 isBuiltinConstructor 将它认作 native 并拒绝代理。isStorageRoot 也只比较当前 realm 的 Object.prototype，因此同类数据入口应一起审视。',
 fix:'加入不执行用户 getter 的 realm 安全普通对象/原型判定，识别外部 Object.prototype；不要只按 constructor.name 放行。对原生内部槽类仍保留拒绝代理策略，并统一 storage 的普通数据对象识别策略。',
 workaround:'在当前 realm 将可序列化的数据克隆/重建后再 reactive；克隆会改变身份及部分类型，不能对任意对象机械 JSON 往返。',
 regression:'Node vm + 真实 iframe 的普通对象/嵌套对象/用户类；同 realm 对照；Array、null 原型；Map/Set/Date/URL/Headers 仍原样返回；身份缓存和危险键防护。',
 evidence:['supplement-core-final.log','browser-results.json','browser-results-linux-firefox.json'],
 code:"import vm from 'node:vm'\nimport { reactive, effect } from '@canlooks/reactive'\nconst raw = vm.runInNewContext('({ count: 0 })')\nconst state = reactive(raw)\nconst seen = []\nconst stop = effect(() => seen.push(state.count))\nstate.count = 1\nstop()\nconsole.log(state === raw, seen) // 当前 true, [0]；预期 false, [0, 1]"
},{
 id:'D03',level:'S3',kind:'契约差异，待维护者确认',title:'Model 的 valueProp=null 静默回退，非法参数负例未拒绝',location:'src/react/model.ts:84–85',
 conditions:'JavaScript 调用或运行时数据绕过类型约束，将 null 作为 valueProp；不是正常 TypeScript 正例。',
 expected:'测试计划 UI-022 要求非法 valueProp 拒绝；公开类型只允许 value/checked 或省略。本轮将 null 纳入非法值边界。',
 actual:'"foo"、数字 1 均 TypeError，null 不抛错并按模型类型自动选择受控属性；React 18 与 19 均复现。无数据丢失证据。',
 cause:'使用 valueProp ?? default 后才校验 field；null 在校验前被折叠为默认值。README 没有单独明确 null 的运行时语义，所以此项不与已确认的两项实现缺陷混为一谈。',
 fix:'若遵循当前严格参数契约，先校验 valueProp !== undefined 且值不在 value/checked 时抛 TypeError，再计算默认属性；若产品希望接受 null，明确写入类型、README 和测试计划，经契约确认后再更新负例。',
 workaround:'仅传 "value" / "checked"，或真正省略该属性。',
 regression:'undefined、null、空字符串、错误字符串、数字、合法两值；input/checkbox/custom control；SSR/hydration 和失败后合法绑定。',
 evidence:['supplement-react-complete.log','supplement-react18.log'],
 code:"const state = reactive({ name: 'A' })\n// 在 JS/运行时数据层，以下 valueProp 为 null：\nrenderToString(<Model source={() => state.name} valueProp={null}>\n  <input />\n</Model>)\n// 当前输出受控 input；严格非法值策略应抛 TypeError。"
}]
const sections=[]
const add=(id,title,paragraphs=[],tables=[],codes=[])=>sections.push({id,title,paragraphs,tables,codes})
add('conclusion','1. 测试结论',[
 '**当前工作区存在可复现 BUG，不满足 TEST_PLAN.md 的全范围发布退出条件。** 已确认 2 项缺陷：派生节点资源保留（S1）和跨 realm 普通对象漏更新（S2）；另登记 1 项 Model 参数契约差异（S3，待确认）。本轮只测试、分析并给出建议，没有修改生产实现或原有测试断言。',
 `240 条计划用例按本轮范围判定：**${counts['通过']} 通过、${counts['失败']} 失败、${counts['阻塞']} 阻塞**。执行率 ${(238/240*100).toFixed(2)}%，执行项通过率 ${(236/238*100).toFixed(2)}%。阻塞项没有计入通过；没有擅自将任何条目设为“不适用”。D01 是额外跨 realm 探索缺陷，不伪装成原有用例的同一输入。`,
 '原有 181 项行为测试（核心/存储 105、React 76）、类型、构建、产物与隔离 tarball 全部通过。这说明现有回归集没有捕获上述问题，不代表库无缺陷。29 个新增 node:test 声明（核心 14、React 15）中，各有 1 个失败；React 补充在 18/19 各执行一次，不能重复累计独立用例数。',
 '完成三引擎 × 两个 React major × 开发/生产构建的 12 组浏览器常规检查；这 12 组的跨 realm 附加探针均复现 D01。26 段 README 可执行示例全部通过；固定种子模型执行 300040 个底层操作。未采集行/分支覆盖率，不把用例执行率当作代码覆盖率。'
],[{headers:['模块','计划数','通过','失败','阻塞'],rows:moduleRows}])
add('baseline','2. 被测版本、环境与完整性',[
 `运行编号：2026-10-16_170124。开始：${started}；报告生成：${ended}（Asia/Shanghai）。执行者：Codex 自动化测试与代码审查；维护者/发布负责人尚未签收。`,
 `对象为 @canlooks/reactive@5.0.0 当前脏工作区，HEAD ${env.head}。这不是该提交的干净检出。冻结并结束复核 ${Object.keys(before).length} 份已有文件，源码、原有测试、配置和文档散列无变化。${link('原始差异','evidence/worktree.diff')}、${link('源文件 SHA-256','evidence/source-sha256.json')}、${link('冻结源快照','evidence/source-snapshot/package.json')}、${link('结束完整性检查','evidence/source-integrity.json')}可追溯。`,
 `本轮 Windows tarball SHA-256：${tarballHash}。${link('tarball','evidence/canlooks-reactive-5.0.0.tgz')}含 90 个预期文件；Linux 另安装了这份同一 tarball 验证混合入口。未执行 npm publish。`,
 'Linux 完整基线在 WSL 的独立源快照和 npm ci 环境执行；不是用 Windows node_modules 代替。浏览器使用专用 127.0.0.1 origin、独立 context 和 qa: 前缀 key，测试后只删除本轮数据。'
],[{headers:['维度','实测配置 / 范围'],rows:[
 ['Windows',`${env.release} ${env.arch}；Node ${env.node}；npm 11.19.0`],
 ['机器',`${env.cpus[0].model}，${env.cpus.length} 逻辑 CPU，${(env.ramBytes/1024**3).toFixed(1)} GiB RAM；平衡电源计划`],
 ['Linux','Ubuntu 26.04 LTS / WSL2 6.6.87.2；Node 24.14.1；npm 11.11.0'],
 ['工具',`TypeScript ${env.versions.typescript}，tsx ${env.versions.tsx}，jsdom ${env.versions.jsdom}，esbuild ${env.versions.esbuild}，localforage ${env.versions.localforage}；Playwright Core 1.62.0`],
 ['React 19','react/react-dom/@types/react/@types/react-dom 19.3.0'],
 ['React 18','react/react-dom 18.3.1；@types/react 18.3.31，@types/react-dom 18.3.7'],
 ['锁与元数据',link('React18 lock','evidence/react-18-package-lock.json')+'；'+link('React19 lock','evidence/react-19-package-lock.json')+'；'+link('core-only lock','evidence/core-only-package-lock.json')+'；'+link('完整环境','evidence/environment.json')],
 ['未证明范围','原生 OS IME/系统剪贴板粘贴；macOS 与 Safari 真机；移动浏览器；其他 Node 版本；完整浏览器最低版本支持承诺。']
 ]}])
add('execution','3. 执行结果与判定口径',[
 '退出码 1 的补充测试保留原始失败断言，属于报告中的缺陷证据；没有修改预期或生产代码来强行通过。原有命令、补充脚本与多环境重跑分层统计。包脚本内部的 full suite / 构建复跑不重复计入独立 181 项。',
 'Windows 初次 package 成功后会清除消费者，因此追加 package-archived.mjs：只改变证据保留、根路径定位并补上真实安装包深导入负例，保存消费者 lock/版本/完整 React 输出；原脚本没有被修改。',
 '首次运行中的夹具问题与产品缺陷分开：React 补充文件不在原 tsconfig include 内导致 JSX/装饰器转译错误，改为报告内独立配置；已卸载 Suspense 的测试 Promise 改用 act 结算。浏览器夹具改为等待真实提交/绘制边界，并只标识故意不匹配 hydration 的预期警告。README 示例按独立场景清理同名 storage 绑定。所有首次日志仍保留，D01/D02/D03 没有被这些夹具修正消除。',
 'Windows Firefox 首次 spawn UNKNOWN，记录为平台启动阻塞；在 Linux/WSL 安装匹配的 Firefox 后完成相同常规矩阵。该替代没有证明 Windows Firefox 可运行。最初 Linux shell PATH 引号与 /tmp 生命周期问题也保留为环境日志，不归因于库。'
],[{headers:['检查','退出码','耗时','证据'],rows:commandRows},{headers:['Linux 检查','退出码','证据'],rows:['ci','test','build','dist','package','tarball-install','tarball-core','firefox'].map(n=>[n,read(`evidence/linux-${n}.exit.txt`).trim(),link('日志',`evidence/linux-${n}.log`)])}])
add('browsers','4. 浏览器、持久化与 SSR',[
 '每组常规链路覆盖 Unicode/emoji 输入及 insertText、checkbox、单/多选、数字清空显式转换、Chip 局部刷新、两个加载任务乱序成功/失败、local/session 刷新与标签页边界、受控存储异常、IndexedDB 实际驱动、hydration 正/负对照、原生 ESM。包的浏览器构建解析记录证明没有选中 dist/node.js 或 dist/node-react.js。',
 'IndexedDB 使用独立 localforage 数据库，强制并检查驱动 asyncStorage；缓存值确为 JSON 字符串。adapter 日志证明纯恢复、迟到读取下本地优先、写失败后恢复、maxActiveWrites=1。受控异常来自专用页面注入，不声称已经填满真实用户存储空间。',
 'SSR 服务对 A/B HTTP 请求分别创建 store，纯渲染无 useWatch 回调；等待 hydration 提交后才接入 storage。浏览器 fixture 的 SSR 简单 p 元素由 React 19 生成，18/19 客户端验证一致输出；各 React major 自身的完整 SSR 行为另外由隔离包套件验证。复杂跨版本 SSR 互操作不在本结论内。',
 `${link('Windows 浏览器结构化结果','evidence/browser-results.json')}、${link('Linux Firefox 结构化结果','evidence/browser-results-linux-firefox.json')}保存版本、事件、I/O、预期 warning、负对照错误和跨 realm 探针。截图只是辅助，断言日志才是通过依据。原生 IME 与真实剪贴板未执行，因此 QUAL-001 整行阻塞。`
],[{headers:['引擎','浏览器版本','OS','React','模式','常规断言','附加探针'],rows:browserRows}])
add('performance','5. 压力、性能和资源',[
 '性能组固定当前机器、3 次预热和 10 次测量；P95 为最近秩法的第 10 个样本。独占于本轮其他测试结束后的短基准保存在 benchmark-clean.json；数值包含脚本断言开销，仅建立当前版本基线，没有与历史已接受版本比较，不能据此认定 20% 回归。',
 '存储压力每个组合 5 轮、每轮 10000 次编辑。10k 字段的逐次修改需要反复扫描/编码整图，约 56 秒/轮；这是大对象高频使用的成本观察，不是既定 SLA 失败。建议业务合并同步批次，后续可评估增量快照；同时保持最终 JSON 和错误恢复语义。',
 'React 18/19 各 1000 轮挂载/卸载：旧 Model handler 不写入，遗留 load 拒绝，watch/公开 loading 不再发布；每 100 轮记录 heap，前/500/1000 轮取堆快照。堆采样有波动，不能把一次增长当泄漏。单独的 computed/getter 诊断通过多轮 GC、释放源对照和强保留路径确认 D02。',
 'storage 两组各 1000 个根在完成 I/O/丢弃根后均可回收，保留共享 child 不阻止回收。早期综合脚本中最后一个循环局部引用及 WeakRef 同 job 保活造成的 1 个存活样本，已用独立工厂函数和事件循环边界排除；最终专用证据为 memory.json。'
],[{headers:['短基准','中位数 ms','P95 ms'],rows:bench.benchmarks.map(b=>[b.name,b.medianMs.toFixed(3),b.p95Ms.toFixed(3)])},{headers:['字段数','模式','每轮编辑','每轮 set 次数','maxActive','5轮中位耗时 ms'],rows:resource.stress.map(s=>[s.fields,s.mode,10000,s.samples.map(x=>x.writes).join('/'),s.maxActive,[...s.samples.map(x=>x.ms)].sort((a,b)=>a-b)[2].toFixed(2)])},{headers:['资源对照','创建数','源保留时存活','释放源/完成 I/O 后存活'],rows:[['computed 捕获载荷',1000,memory.retained.computed,memory.released.computed],['自动 getter 根',1000,memory.retained.getters,memory.released.getters],['storage 共享 child',1000,'不保留根',memory.storageAlive],['storage 异步 I/O',1000,'等待完成',memory.asyncStorageAlive]]}])
add('limits','6. 未完成项、已声明边界与发布门槛',[
 'QUAL-001：需要具备原生中文输入法和系统剪贴板的人工桌面交互，记录 compositionstart/update/end、粘贴、最终 model/DOM 与转换次数。当前工具运行的 headless 自动输入不能代替该证据。',
 'QUAL-016：需要未参与开发的独立测试人员，在干净 Node 24 环境按交付材料演练和签收。本轮已做自动化文档校验和独立 Linux 安装，但不会自称完成独立人工验收。',
 '没有把明确不支持的 raw 写通知、结构枚举追踪、defineProperty 通知、核心 #private、跨 await 事务、Map 内部变化、storage flush/dispose/跨页自动同步、loading 取消/最后请求胜出等判为 BUG。macOS/Safari 与完整 OS 最低版本声明仍需维护者确定发布范围。',
 '优先修复 D02，再修复 D01；D03 先决定 null 的公开语义。修复后先复跑最小复现和资源对照，再按计划对核心、存储、React 18/19、类型、dist、tarball 及浏览器全面回归。不得以本报告的旧源码散列作为修复版本证据。'
],[{headers:['退出标准','本轮判定'],rows:[['全部适用 P0/P1 与参数通过','未满足：UI-022、QUAL-010 失败；QUAL-001 阻塞'],['基础自动化/类型/构建/tarball','满足：Windows/Linux 完整命令退出 0'],['公开导出/混合模块/无 React 核心','满足：六/十九导出、90 文件白名单、核心隔离通过'],['状态/JSON/竞态','本轮常规用例满足；跨 realm 扩展场景有 D01'],['卸载/资源','常规组件清理通过；D02 为 S1 资源缺陷'],['真实浏览器和控制台','三引擎常规链路通过；原生 IME 与 Windows Firefox 启动环境仍未验证'],['未关闭 S0/S1 = 0','未满足：D02 未修复'],['性能/资源/可追溯签收','已有基线与证据；QUAL-016 独立人工签收未完成']]}])
add('reproduce','7. 复现与证据使用',[
 '从项目根目录执行下列命令。测试对象必须与 source-sha256.json 一致。报告内脚本为额外测试夹具，不属于发布包；正式回归仍以原 npm scripts 为入口。失败脚本应在原代码上保留非零退出码。',
 'scripts/freeze.mjs、run-command.mjs 保存版本/命令证据；scripts/supplement-core.mjs 与 supplement-react.tsx 为补充场景；scripts/memory.mjs 与 heap-path.mjs 为保留链诊断；scripts/browser.mjs/browser-app.tsx 为浏览器矩阵；scripts/readme-extract.mjs/readme-runtime.tsx 为逐例验证；scripts/report.mjs 从同一数据生成两种报告。',
 '浏览器依赖在 .runtime 内隔离，未修改根 package.json/lock；可使用该目录 package-lock.json 重建。实际依赖包括 Playwright Core 1.62.0、React/DOM 18.3.1、本轮 tarball，React19 从工作区解析。浏览器二进制需匹配 Playwright 的 revision；Linux shell 使用专用临时/缓存路径。',
 'evidence/ 包含首轮和最终日志、消费者 lock、源快照/散列、tarball、构建解析记录、浏览器截图、GC/性能原始样本及堆快照。堆快照可用 Chromium DevTools Memory 面板加载；computed-retaining-path.json 提供已提取的保留路径。'
],[],[{language:'powershell',text:"npm test\nnpm run build\nnpm run test:dist\nnpm run test:package\nnode --test --test-reporter=tap test/reports/2026-10-16_170124/scripts/supplement-core.mjs\nnode node_modules/tsx/dist/cli.mjs --tsconfig test/reports/2026-10-16_170124/scripts/tsconfig.json --test --test-reporter=tap test/reports/2026-10-16_170124/scripts/supplement-react.tsx\nnode --expose-gc test/reports/2026-10-16_170124/scripts/memory.mjs\nnode test/validate-docs.mjs"}])
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const inline=s=>escape(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>')
const mdCell=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>')
const mdTable=t=>`| ${t.headers.map(mdCell).join(' | ')} |\n| ${t.headers.map(()=> '---').join(' | ')} |\n${t.rows.map(r=>'| '+r.map(mdCell).join(' | ')+' |').join('\n')}\n`
const htmlTable=t=>`<div class="table-wrap"><table><thead><tr>${t.headers.map(h=>`<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
let md=`# @canlooks/reactive 完整测试报告\n\n运行：2026-10-16_170124 · Asia/Shanghai · 当前工作区\n\n`
let body=''
for(const s of sections){md+=`## ${s.title}\n\n`+s.paragraphs.join('\n\n')+'\n\n'+s.tables.map(mdTable).join('\n')+'\n'+s.codes.map(c=>'```'+c.language+'\n'+c.text+'\n```\n').join('\n');body+=`<section id="${s.id}"><h2>${escape(s.title)}</h2>${s.paragraphs.map(p=>`<p>${inline(p)}</p>`).join('')}${s.tables.map(htmlTable).join('')}${s.codes.map(c=>`<pre><code>${escape(c.text)}</code></pre>`).join('')}</section>`}
md+='\n## 8. 缺陷详情与修复建议\n\n';body+='<section id="defects"><h2>8. 缺陷详情与修复建议</h2>'
for(const d of defects){const rows=[['类别 / 等级',`${d.kind} / ${d.level}`],['定位',d.location],['触发条件',d.conditions],['预期',d.expected],['实际',d.actual],['根因',d.cause],['修复建议',d.fix],['临时规避',d.workaround],['修复后回归',d.regression],['证据',d.evidence.map(p=>link(p,`evidence/${p}`)).join('；')]];md+=`### ${d.id} · ${d.title}\n\n`+mdTable({headers:['项目','内容'],rows})+`\n最小复现：\n\n\`\`\`js\n${d.code}\n\`\`\`\n\n`;body+=`<article class="defect" id="${d.id}"><div class="defect-top"><span class="badge fail">${d.level}</span><span>${d.kind}</span></div><h3>${escape(d.id+' · '+d.title)}</h3>${htmlTable({headers:['项目','内容'],rows})}<h4>最小复现</h4><pre><code>${escape(d.code)}</code></pre></article>`}body+='</section>'
md+='## 9. 240 条用例逐项执行记录\n\n以下状态以完整用例行判定。A 项依原有自动化映射，本轮完整套件重新执行；P/M 项用补充证据填实。原始前置、步骤、期望均保留。失败与阻塞没有被相关子项的通过覆盖。\n\n'
body+='<section id="cases"><h2>9. 240 条用例逐项执行记录</h2><p>点击测试点可展开原始前置、步骤、期望与自动化映射。筛选只改变视图，打印包含完整记录。</p><div class="filters"><label>搜索 <input id="case-search" type="search" placeholder="编号、模块、测试点或缺陷"></label><label>状态 <select id="case-status"><option value="">全部</option><option>通过</option><option>失败</option><option>阻塞</option></select></label><span id="shown">240 / 240</span></div>'
for(const mod of Object.keys(modNames)){
 md+=`### ${modNames[mod]}\n\n`+mdTable({headers:['ID / 优先级','测试点','前置/数据','步骤','预期','本轮实际 / 状态','证据'],rows:cases.filter(c=>c.mod===mod).map(c=>[c.id+' / '+c.priority,c.title,c.preconditions,c.steps,c.expected,`**${c.status}**：${c.actual}`,c.mapping+'；'+c.logs.map(p=>link(p,`evidence/${p}`)).join('；')])})+'\n'
 body+=`<h3>${modNames[mod]}</h3><div class="table-wrap"><table class="case-table"><thead><tr><th>用例 / 优先级</th><th>测试点与原始要求</th><th>结果</th><th>本轮实际与证据</th></tr></thead><tbody>${cases.filter(c=>c.mod===mod).map(c=>`<tr data-case="${c.id}" data-status="${c.status}"><td><strong>${c.id}</strong><br><small>${c.priority}</small></td><td><details><summary>${escape(c.title)}</summary><dl><dt>前置 / 数据</dt><dd>${escape(c.preconditions)}</dd><dt>步骤</dt><dd>${escape(c.steps)}</dd><dt>预期</dt><dd>${escape(c.expected)}</dd><dt>原映射</dt><dd>${escape(c.mapping)}</dd></dl></details></td><td><span class="badge ${c.status==='通过'?'pass':c.status==='失败'?'fail':'blocked'}">${c.status}</span></td><td>${escape(c.actual)}<div class="case-links">${c.logs.map(p=>`<a href="evidence/${p}">${escape(p)}</a>`).join(' · ')}</div></td></tr>`).join('')}</tbody></table></div>`
}
body+='</section>'
const priorityRows=['P0','P1','P2'].map(p=>{const list=cases.filter(c=>c.priority===p);return[p,list.length,...['通过','失败','阻塞'].map(s=>list.filter(c=>c.status===s).length)]})
md+='\n## 10. 统计与证据索引\n\n'+mdTable({headers:['优先级','总数','通过','失败','阻塞'],rows:priorityRows})+'\n执行率 = (通过 + 失败) / 240；通过率 = 通过 / (通过 + 失败)。需求—用例映射完整性由 validate-docs 验证，不等于需求所有环境均已通过。\n\n'+link('原始测试计划','../../TEST_PLAN.md')+' · '+link('自动化索引','../../AUTOMATION.md')+' · '+link('机器可读结果','results.json')+' · '+link('证据清单','evidence/manifest.json')+'\n'
body+='<section id="index"><h2>10. 统计与证据索引</h2>'+htmlTable({headers:['优先级','总数','通过','失败','阻塞'],rows:priorityRows})+'<p>'+inline(link('原始测试计划','../../TEST_PLAN.md')+' · '+link('自动化索引','../../AUTOMATION.md')+' · '+link('机器可读结果','results.json')+' · '+link('证据清单','evidence/manifest.json')+' · '+link('Markdown 报告','report.md'))+'</p><p>本报告是当前版本的测试与缺陷记录，尚未取得全范围发布验收签收。</p></section>'
const nav=[...sections.map(s=>[s.id,s.title]),['defects','8. 缺陷与建议'],['cases','9. 逐项记录'],['index','10. 证据索引']]
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>@canlooks/reactive · 完整测试报告</title><style>
:root{--ink:#18243a;--muted:#56657a;--line:#dce3eb;--accent:#315bd4;--paper:#fff;--bg:#f3f6fa}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:28px}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.8 "Segoe UI","Microsoft YaHei",sans-serif}a{color:#2451bd;text-decoration:none}a:hover{text-decoration:underline}aside{position:fixed;inset:0 auto 0 0;width:230px;padding:30px 20px;background:#17243b;color:#fff;overflow:auto}aside strong{display:block;font-size:18px;line-height:1.4;margin-bottom:10px}aside small{color:#b7c5df}nav{margin-top:28px}nav a{display:block;color:#d9e3f4;padding:9px 10px;border-radius:6px;font-size:13px;line-height:1.5}nav a:hover{background:#2a3b59;text-decoration:none}main{max-width:1480px;margin-left:230px;padding:36px 40px 72px}.hero{background:linear-gradient(120deg,#17243b,#274d83);padding:35px 38px;border-radius:16px;color:#fff}.eyebrow{font-size:12px;letter-spacing:.15em;color:#d0ddf2}.hero h1{font-size:31px;margin:10px 0 8px;line-height:1.4}.hero p{margin:0;color:#d7e3f6}.hero .outcome{display:inline-block;margin-top:20px;padding:5px 12px;border-radius:6px;background:#ffe9ce;color:#6c3f00;font-weight:600}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0}.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 20px}.card b{display:block;font-size:29px;line-height:1.2}.card small{color:var(--muted)}.meter{display:flex;height:9px;border-radius:6px;overflow:hidden;margin:12px 0 25px}.meter span:first-child{background:#23856a}.meter span:nth-child(2){background:#cd4550}.meter span:last-child{background:#d89a2d}section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:26px 30px;margin:20px 0}h2{font-size:22px;margin:0 0 20px;border-bottom:1px solid var(--line);padding-bottom:14px}h3{font-size:18px;margin:28px 0 12px}h4{margin:20px 0 8px}p{margin:13px 0;overflow-wrap:anywhere}.table-wrap{overflow-x:auto;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.7}th{background:#eef2f8;color:#3d4e68;text-align:left;font-weight:600}th,td{padding:11px 13px;border:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fafbfd}code{font-family:Consolas,monospace;font-size:.92em;background:#eef2f7;border-radius:3px;padding:2px 4px}pre{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#162237;color:#e0eafa;border-radius:8px;padding:20px;line-height:1.65}pre code{background:none;padding:0;font-size:12px}.badge{display:inline-block;padding:2px 8px;border-radius:5px;font-size:12px;font-weight:600;white-space:nowrap}.pass{background:#e1f4ec;color:#13674c}.fail{background:#fce5e6;color:#9d2833}.blocked{background:#fff0d4;color:#825900}.defect{border-left:4px solid #cf5960;padding:18px 22px;background:#fffafa;margin:22px 0}.defect-top{display:flex;gap:10px;align-items:center;color:var(--muted);font-size:13px}.defect h3{margin-top:10px}.defect td:first-child{width:130px;white-space:nowrap}.filters{display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:14px;background:#eff3fa;border-radius:8px;position:sticky;top:0;z-index:2}.filters input,.filters select{border:1px solid #bcc9dc;border-radius:5px;padding:9px;background:#fff;color:var(--ink);font:inherit}.filters input{width:310px}#shown{color:var(--muted);font-size:13px}.case-table th:first-child{width:110px}.case-table th:nth-child(2){width:30%}.case-table th:nth-child(3){width:70px}.case-links{margin-top:9px;font-size:11px}.case-table summary{cursor:pointer;line-height:1.7}.case-table details[open] summary{font-weight:600;margin-bottom:12px}dl{font-size:12px;color:#4f5f76}dt{font-weight:700}dd{margin:3px 0 12px}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.actions a,.actions button{background:#fff;border:0;border-radius:6px;color:#244d9b;font:inherit;font-size:13px;padding:7px 13px;cursor:pointer;white-space:nowrap}footer{font-size:12px;color:var(--muted);padding:10px 4px}tr[hidden]{display:none}
@media(max-width:1000px){aside{display:none}main{margin:0;padding:20px}.hero{padding:25px}.hero h1{font-size:25px}section{padding:20px}.cards{gap:8px}.card{padding:15px}.card b{font-size:24px}}@media(max-width:600px){main{padding:12px}.cards{grid-template-columns:repeat(2,1fr)}.hero h1{font-size:22px}section{padding:17px}h2{font-size:19px}.case-table{min-width:730px}.filters input{width:210px}.defect{padding:12px}}
@media print{aside,.filters,.actions{display:none}main{margin:0;padding:0;max-width:none}body{background:white;font-size:10pt}.hero{background:#eef2f8;color:#162237;padding:20px}.hero p,.eyebrow{color:#3d4e68}.cards{margin:12px 0}section{border:0;padding:10px 0;margin:10px 0;break-before:auto}h2,h3{break-after:avoid}.table-wrap{overflow:visible}table{font-size:8pt}th,td{padding:6px}tr{break-inside:avoid}tr[hidden]{display:table-row}.case-table details>dl{display:block!important}pre{color:#111;background:#f4f4f4}.defect{break-before:page}.badge{border:1px solid currentColor}}
</style></head><body><aside><strong>@canlooks/reactive</strong><small>QA REPORT · v5.0.0<br>2026-10-16_170124</small><nav>${nav.map(([id,title])=>`<a href="#${id}">${escape(title)}</a>`).join('')}</nav></aside><main><header class="hero"><div class="eyebrow">ENGINEERING QUALITY REVIEW</div><h1>@canlooks/reactive 完整测试报告</h1><p>当前工作区 · Windows / Linux · React 18 / 19 · 三浏览器引擎</p><div class="outcome">发布退出条件未满足：2 项确认缺陷 + 1 项契约差异</div><div class="actions"><a href="report.md">Markdown 版本</a><a href="#defects">查看修复建议</a><button type="button" onclick="window.print()">打印报告</button></div></header><div class="cards"><div class="card"><b>240</b><small>计划用例</small></div><div class="card"><b style="color:#218065">236</b><small>通过</small></div><div class="card"><b style="color:#bb3947">2</b><small>失败条目</small></div><div class="card"><b style="color:#9b6c14">2</b><small>阻塞条目</small></div></div><div class="meter" aria-label="236通过，2失败，2阻塞"><span style="width:98.333%"></span><span style="width:.833%"></span><span style="width:.834%"></span></div>${body}<footer>生成时间 ${escape(ended)} · Asia/Shanghai · 原有 78 份文件散列一致 · 生产实现未修改</footer></main><script>
const search=document.querySelector('#case-search'),status=document.querySelector('#case-status'),rows=[...document.querySelectorAll('tr[data-case]')];function filter(){const q=search.value.trim().toLowerCase();let shown=0;for(const row of rows){row.hidden=!!((status.value&&row.dataset.status!==status.value)||(q&&!row.textContent.toLowerCase().includes(q)));if(!row.hidden)shown++}document.querySelector('#shown').textContent=shown+' / '+rows.length}search.addEventListener('input',filter);status.addEventListener('change',filter);
</script></body></html>`
writeFileSync(resolve(report,'report.md'),md);writeFileSync(resolve(report,'report.html'),html)
writeFileSync(resolve(report,'results.json'),JSON.stringify({run:'2026-10-16_170124',started,ended,timezone:'Asia/Shanghai',head:env.head,sourceIntegrity:{files:Object.keys(before).length,changed},tarballHash,counts,uniqueExistingTests:181,uniqueSupplementalNodeTests:29,browser,defects,cases},null,2))
function inventory(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const path=resolve(dir,e.name),name=prefix+e.name;return e.isDirectory()?inventory(path,name+'/'):name==='manifest.json'?[]:[{file:name,bytes:statSync(path).size,sha256:hash(path)}]})}
writeFileSync(resolve(evidence,'manifest.json'),JSON.stringify(inventory(evidence),null,2))
console.log(JSON.stringify({report,counts,cases:cases.length,sourceChanged:changed,tarballHash,generated:ended},null,2))
