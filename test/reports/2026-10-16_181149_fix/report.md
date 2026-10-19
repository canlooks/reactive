# D01 / D02 / D03 修复与回归记录

日期：2026-10-16（Asia/Shanghai）。依据：[原报告](../2026-10-16_170124/report.md)、[修复方案](../2026-10-16_170124/fix-plan.md)。测试对象是保留既有未提交修改的工作区，不是干净 HEAD。

## 1. 结论

三项已知缺陷的功能修复及对应回归通过。D03 按严格契约拒绝 `valueProp=null`；模型数据本身为 `null` 的行为保持不变。

本次只修改 **5 个生产文件**，增加针对性测试与验证记录，没有修改公共入口、公共声明、依赖、锁文件或构建脚本。187 项主测试、9 项独立 GC 测试、29 项补充测试，以及 React 18/19、三浏览器、Windows/Linux 的相关回归通过；没有在这些测试中发现新的功能失败。

**性能并非零代价：**原质量用例指定的固定基准没有连续两轮触发回归阈值；另外增加的高频 computed 微基准存在可复现开销，登记为 **R01，待性能评审**，详见第 5 节。因此本记录不作“没有任何回归、可以无条件发布”的结论。原生 IME/系统剪贴板、独立人工验收仍未代替人工执行。

## 2. 改动范围与实现

| 缺陷 | 生产文件 | 最小修复及保留边界 |
| --- | --- | --- |
| D01 | [reactive.ts](../../../src/reactive.ts)、[storageSnapshot.ts](../../../src/storageSnapshot.ts) | 用原型/构造器描述符识别外部 realm 的 Object.prototype。核心继续支持用户类，storage 仍只接受直接原型符合要求的普通数据；内建对象、危险键、访问器保护不放宽。 |
| D02 | [effect.ts](../../../src/effect.ts)、[react/props.ts](../../../src/react/props.ts) | 普通订阅仍强引用；computed 使用稳定弱条目，有活动普通消费者时沿依赖链保活。补齐清理、重收集、replaceDeps、批次依赖恢复、通知遍历及 props 存活判断。 |
| D03 | [react/model.ts](../../../src/react/model.ts) | 先校验 valueProp，再只对 undefined 选择默认字段。只接受省略、undefined、'value'、'checked'，其余抛原有 TypeError。 |

D02 的实现约束：

- 保持 Dep 的 Set 身份、条目顺序、computedOwners 的强 value、缓存、版本、批次净变化及错误顺序。
- 通知前生成存活节点数组；数组构建过程没有业务回调，完成后再遍历和通知。判断可达消费者时可提前结束，不能让纯 computed 环相互保活。
- finalizer holding 只含 Dep/link 的 WeakRef。登记表由以节点为 key 的 WeakMap 持有，源侧 link 不持有该表。
- 为避免每次重算创建 WeakRef/登记，复用未变化的边。每条登记使用自己的记录作 unregister token，只有实际移除的边才注销；这与方案的单一 link token 在清理粒度上不同，所有权约束相同。
- 同步重收集、批次恢复期间暂存受影响 owner，整张图恢复后刷新；依赖集合未变化时跳过保活重查。暂存集合刷新前清空，不作为长期活动节点登记表，不改变通知时机。

新增正式用例为 N68～N70、S29～S30、F30；另新增 [derived-lifecycle.mjs](../../derived-lifecycle.mjs)。同时补充 ESM/CJS 冒烟断言、三种类型入口的 null 反例、README 参数说明及用例映射。既有断言未被删除或放宽。

[修改文件清单](evidence/changed-files.json) 相对于修复前快照计算；[修复前 SHA-256](evidence/before-sha256.json)、[最终源码 SHA-256](evidence/source-sha256.json) 用于区分本次修改与原工作区修改。公共入口及 Model 声明逐字节对照通过，产物仍为 90 个预期包文件。

## 3. 缺陷前后对照

| 检查 | 修复前运行新增用例 | 最终结果 |
| --- | --- | --- |
| D01：Node vm 普通对象及 storage | 核心仍返回 raw；storage 拒绝普通根，新增用例失败 | 深层代理、共享身份、用户类 getter、持久化恢复/后续编辑及异步本地优先通过 |
| D01：真实 iframe | 原报告仅观察到代理失败 | 三引擎的 12 组均明确断言 isRaw=false、通知 [0,1]、嵌套通知正确；9 种内建对象不误代理，10 种非普通 storage 根被拒绝，访问器调用数 0 |
| D02：源存活、弃用 1000 个 computed/getter | 载荷被保留；GC 专项 4/9 失败 | 两组业务对象存活数均为 0；3 波重复创建后的源 Dep 可清空 |
| D02：活动消费者与缓存 | 原行为作为对照保留 | 未持有 disposer 的 effect/watch 跨 GC 仍通知；惰性缓存、快照待提交、换分支、stop、props 判断及整图回收通过 |
| D03：valueProp=null | 新增 F30 因没有抛 TypeError 而失败 | Model/defineModel、原生/自定义控件均严格拒绝；无事件/转换回调，模型值不被写坏；合法参数及 null 模型值、后续挂载编辑通过 |

修复前失败证据：[核心](evidence/before-node.log)、[React](evidence/before-react.log)、[GC](evidence/before-gc.log)。这些是验证新增用例能识别原缺陷的预期失败，不计入最终失败数。

修复后 [memory.json](evidence/memory.json) 记录：computed 载荷 1000→0、getter receiver 1000→0；释放源后仍为 0；共享 child 的 1000 个 storage 根及已完成 I/O 的 1000 个根均为 0。独立 GC 诊断每阶段跨 12 轮事件循环，不依赖 finalizer 在固定毫秒内触发。

另保存了修复前/源保留/源释放三个堆快照。对源保留快照的 [路径检查](evidence/heap-canaries.json) 未发现被闭包捕获的测试载荷；各一个同名模板仅由 `system / AllocationSite → transition_info` 持有，结合 WeakRef 计数可与业务实例区分。原报告的 1000 条业务载荷保留不再出现。

## 4. 最终回归结果

| 检查 | 结果与证据 |
| --- | --- |
| Windows npm test | 110 项核心/存储 + 77 项 React = **187/187**；源码、测试、React 三个类型检查通过；无跳过。[日志](evidence/final-npm-test.log) |
| build / test:dist | ESM/CJS、原生 ESM、两个 Node 混用方向、声明检查通过。[构建](evidence/final-build.log)、[dist](evidence/final-dist.log) |
| GC 独立进程 | ESM **9/9**，CJS **9/9**。包括存活源、无外部 disposer、快照、旧分支回收、整图释放和 storage 对照。[ESM](evidence/final-gc-esm.log)、[CJS](evidence/final-gc-cjs.log) |
| 补充核心/存储 | **14/14**；含 100 seeds × 1000 外层批次，共 300040 次模型操作、异常隔离、10000 无关订阅。[日志](evidence/final-supplement-core.log) |
| 补充 React | **15/15**；含 1000 次挂载/卸载、失败恢复、表单与存储联动。[日志](evidence/final-supplement-react.log) |
| Windows 真实包消费 | 原 test:package 脚本的证据归档副本通过；core-only 无 React/DOM/localforage；React 19.3.0、18.3.1 各执行完整 77 项 React、混合入口、类型与深导入拒绝检查。[总日志](evidence/package-archived.log)、[React 18](evidence/react-18-isolated-full-suite.log)、[React 19](evidence/react-19-isolated-full-suite.log) |
| Linux/WSL | 隔离 npm ci 后 npm test、build、test:dist、两种 GC、文档校验及原 npm run test:package 全部退出 0；再次安装同一个 Windows tarball 验证跨 realm/混合入口/storage。[主测试](evidence/linux-test.log)、[包](evidence/linux-package.log)、[同包消费](evidence/linux-tarball-core.log) |
| 文档一致性 | 11 份 Markdown、242 条详细用例、187 项主测试映射通过。39 条仍有额外执行要求，不能把结构校验等同 242 条全部执行。[日志](evidence/final-docs.log) |
| 文件与包一致性 | 79 份源码/测试/文档快照、5 个生产文件改动、公共声明不变；浏览器安装包的所有 dist 文件与最终构建逐字节一致。[校验](evidence/verification.json)、[散列](evidence/artifact-sha256.json) |
| 补丁检查 | git diff --check 退出 0；已有工作区修改未被重置。 |

环境：Windows 10.0.26300 / Node 24.14.1 / npm 11.19.0；WSL2 Ubuntu 26.04 / Node 24.14.1 / npm 11.11.0。CPU、内存及实际依赖见 [versions.json](evidence/versions.json)，Linux 版本见 [环境记录](evidence/linux-environment.txt)，包消费安装锁及版本保存在 evidence 下。

### 真实浏览器矩阵

| 引擎 | 平台 / 版本 | React 18 dev/prod | React 19 dev/prod |
| --- | --- | --- | --- |
| Chromium | Windows / 151.0.7922.34 | 2/2 通过 | 2/2 通过 |
| WebKit | Windows / 26.5 | 2/2 通过 | 2/2 通过 |
| Firefox | Linux/WSL / 153.0 | 2/2 通过 | 2/2 通过 |

共 **12/12**。每组保留表单输入、Chip 隔离、loading 乱序、原生 storage、强制 IndexedDB、hydration 正反例、真实 iframe 和原生 ESM 的 10 组断言。预期的 storage 故障及 hydration 负面对照日志单独识别，没有未预期 pageerror/console 错误。[Windows 结果](evidence/browser-results.json)、[Linux Firefox 结果](evidence/browser-results-linux-firefox.json)。

浏览器依赖在本轮目录重新安装，新 bundle 来自修复后的 tarball；WSL Firefox 复用的是本轮新 bundle。Windows Firefox 启动仍报 `spawn UNKNOWN`，如实记为该平台阻塞；Linux Firefox 成功不表述为 Windows Firefox 成功。

本轮 tarball SHA-256：`8b69139047d7386e88c7c4bb1672ab16512b64b61368ec06d46eeec46a75a0e2`。

## 5. 性能检查与 R01

按原质量用例固定规模，修复前快照和最终版本在同机连续对照两轮；各项预热 3 次、测量 10 次，P95 取排序第 10 项。以下为第二轮中位数（ms）：

| 场景 | 修复前 | 修复后 |
| --- | ---: | ---: |
| 10000 个深层字段代理读取 | 14.891 | 15.416 |
| computed 100000 次缓存读取 | 1.741 | 1.666 |
| 普通 effect，10000 次写入 | 15.109 | 16.386 |
| 同上，包在一个 batch 中 | 3.765 | 4.346 |
| 长度 1e9、仅 3 个索引的稀疏数组截断 | 0.012 | 0.013 |
| 深度 1000 的数据代理/存储 | 4.436 | 4.680 |

固定基准没有任何一项的中位数或 P95 **连续两轮同时满足增加 >20% 且绝对增加 >2ms**。[第一轮前](evidence/benchmark-before-final-1.json)、[第一轮后](evidence/benchmark-after-final-1.json)、[第二轮前](evidence/benchmark-before-final-2.json)、[第二轮后](evidence/benchmark-after-final-2.json)。通知/getter 次数、快照尺寸断言均通过。

**R01：高频 computed 写入的额外成本，待评审。** 为检查 D02 保活逻辑，额外测了单计算值、100/1000 个共享消费者、16 层链。开发中发现过共享/链式图的重复全图扫描，已通过仅处理变更边、同步合并刷新、复用登记消除该实现中的大幅退化；没有为此改调度或业务语义。

最终持续同步微基准第二轮如下；包含创建/订阅/写入/stop，通知次数及结果全部断言通过：

| 场景 | 前 / 后中位数 ms | 前 / 后 P95 ms |
| --- | ---: | ---: |
| 1 个 computed，10000 次写入 | 16.733 / 19.767 | 17.181 / 21.587 |
| 100 个共享消费者，100 次写入 | 2.886 / 2.910 | 5.690 / 7.876 |
| 1000 个共享消费者，10 次写入 | 3.224 / 4.461 | 6.404 / 8.228 |
| 16 层 computed 链，1000 次写入 | 5.103 / 6.851 | 7.914 / 7.483 |

单计算值场景的 P95 连续两轮超过上述阈值：[第一轮](evidence/derived-benchmark-final-1.json)、[第二轮](evidence/derived-benchmark-final-2.json)。另用交替前后顺序、样本之间跨 job 并在计时外 GC 的方法复核，单计算值中位数分别从 20.446→25.296 ms、20.026→27.044 ms，仍有开销；不能全部归因为一次抖动。[隔离复核一](evidence/derived-benchmark-isolated-1.json)、[隔离复核二](evidence/derived-benchmark-isolated-2.json)。两种测法不可互相比绝对值，也不代表真实页面必然等比例变慢。

该成本与 D02 的弱订阅解析、登记及所有权维护有关；现有结果不足以宣称性能完全无回归。保留当前已完整验证的最小修复，不增加另一套调度/订阅架构掩盖成本；若高频 computed 写入是发布关键路径，应结合业务负载评审 R01。

## 6. 执行问题与边界

- Linux 初次文档校验因快照未携带历史证据链接而失败；补齐原证据文件后通过，没有改断言。[初次日志](evidence/linux-docs-initial.log)
- Linux 分段继续时 `/tmp` 项目已不再包含先前安装的依赖，包构建报找不到 esbuild。改用本轮专属缓存目录，重新隔离安装并完整执行后全部通过；未修改生产构建脚本。[初次日志](evidence/linux-package-initial.log)
- 堆检查最初把包含测试标记的 V8 模板也计为业务 receiver；查看入边后修正诊断规则，最终同时核对 AllocationSite 入边和业务 WeakRef 计数。没有放宽正式 GC 回归。
- 原 QUAL-001 的系统级 IME/剪贴板和 QUAL-016 的独立人工验收未执行；自动化输入不代替这些检查。
- 没有重跑与本次缺陷无关的完整大对象/长时间资源压力矩阵，也没有改 storage 大对象扫描、loading 状态机或事件转换。

## 7. 复跑入口

在仓库根执行：

```powershell
npm test
npm run build
npm run test:dist
npm run test:package
node --expose-gc --test test/derived-lifecycle.mjs
node --expose-gc test/derived-lifecycle.mjs --cjs
node test/validate-docs.mjs
```

本轮补充、浏览器、内存、性能和 Linux 脚本在 [scripts](scripts/run-command.mjs) 对应目录，Windows 命令退出码及起止时间记录在 `evidence/*.result.json`，Linux 各步骤退出码在 `evidence/linux-*.exit.txt`。复跑时使用新报告目录保存证据，避免覆盖本轮基线与最终结果。
