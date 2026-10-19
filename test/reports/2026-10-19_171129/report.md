# @canlooks/reactive 全面测试报告

运行：2026-10-19_171129 · 2026/10/19 17:25:34 · Asia/Shanghai

## 1. 测试结论与发布判断

当前项目存在 1 项本轮新确认的 S1 功能缺陷 D04，尚未修复：数组部分截断后漏发通知，导致派生缓存、watch、React DOM 和 storage 记录与内存状态不一致。187 项已有主测试全部通过仍不足以判定无 BUG。本轮不满足测试计划的发布退出标准。

被测 79 份源码、测试、配置及文档与 2026-10-16 修复后快照逐字节一致；本轮发现的是旧用例未覆盖的问题，不是本轮修改引入的回归。生产代码、依赖声明、锁文件及原有测试均未改动。新增脚本、原始日志、快照和报告均位于本轮目录；dist 按测试计划重新构建。

| 结果口径 | 本轮结论 |
| --- | --- |
| 已有主测试 | 110 项核心/存储 + 77 项 React = 187/187；fail/cancelled/skipped/todo 均为 0。 |
| 补充与 GC | 核心补充 14/14；React 补充 15/15（19 源码、18 实际包各执行一次）；GC ESM/CJS 各 9/9；新增 computed 模型测试 1/1。 |
| 真实浏览器常规矩阵 | Chromium / WebKit（Windows）、Firefox（Linux/WSL），React 18/19 × dev/prod 共 12/12 通过。Windows Firefox 启动阻塞。 |
| D04 探索复现 | 源码/ESM/CJS × 4 种调用共 12 个独立组合失败；三引擎 × React 18/19 共 6 个页面组合失败。同一根因，不计成 18 个 BUG。 |
| 计划 242 条逐行账本 | 237 通过、2 失败、3 未执行（部分子项已执行）。原 A 映射为 203 条，P/M 补充为 39 条；不等同于独立 node:test 数量。 |
| 历史问题 | D01 跨 realm、D02 派生回收、D03 valueProp=null 三项修复保持有效。R01 高频 computed 性能风险继续记录，不能据主测试通过关闭。 |

计数规则：ESM/CJS/React 18/19/Linux 的重复执行是环境验证，不累计为新增功能用例。D04 与 CORE-037 / STORE-007 关联，原始普通数组步骤通过，但扩展边界失败，因此这两行整体记失败。未执行项不计通过。

## 2. 被测版本、环境与可复现证据

| 项目 | 记录 |
| --- | --- |
| 执行时间 | 2026/10/19 17:11:42 至 2026/10/19 17:25:34，Asia/Shanghai |
| 测试对象 | @canlooks/reactive@5.0.0 当前未提交工作区 |
| Git HEAD | d0f7e04faa353b8572481067573f20e9d3f466ed |
| Windows | 10.0.26300 x64；Node v24.14.1；npm 11.19.0 |
| Linux | Ubuntu 26.04 / WSL2；Node v24.14.1；npm 11.11.0 |
| 硬件 | Intel(R) Core(TM) i7-14650HX；24 逻辑处理器；31.64 GiB RAM |
| 开发依赖 | react 19.3.0；react-dom 19.3.0；@types/react 19.3.0；@types/react-dom 19.3.0；tsx 4.23.13；typescript 7.0.2；jsdom 29.1.1；localforage 1.10.0；esbuild 0.28.2 |
| 隔离 React 18 | react/react-dom 18.3.1；@types/react 18.3.31；@types/react-dom 18.3.7 |
| 隔离 React 19 | react/react-dom/@types 19.3.0 |
| 包文件 | 90 个白名单文件；六个核心导出、十九个 React 导出；核心无 React/DOM/localforage 消费通过 |
| 本轮 tarball SHA-256 | 8b69139047d7386e88c7c4bb1672ab16512b64b61368ec06d46eeec46a75a0e2 |

[测试计划](../../TEST_PLAN.md) · [上轮修复报告](../2026-10-16_181149_fix/report.md) · [源码指纹](evidence/source-sha256.json) · [结束时一致性](evidence/source-integrity.json) · [与修复快照比较](evidence/changes-since-fix.json) · [已有工作区差异](evidence/worktree.diff) · [初始状态](evidence/git-status.txt) · [Windows 环境](evidence/environment.json) · [Linux 环境](evidence/linux-environment.txt)

[核心消费者 lock](evidence/core-only-package-lock.json) · [React 18 lock](evidence/react-18-package-lock.json) · [React 19 lock](evidence/react-19-package-lock.json) · [浏览器夹具 lock](evidence/browser-package-lock.json) · [Linux 同包 lock](evidence/linux-same-tarball-lock.json) · [实际测试包](evidence/canlooks-reactive-5.0.0.tgz)

package-archived.mjs 是保留锁文件和 tarball 的测试脚本副本。正式 npm run test:package 也单独执行成功，因此归档操作没有替代或改写正式入口。Linux 在本轮专属缓存目录从源码快照 npm ci；同包测试另安装本轮 Windows tarball。浏览器工具与 Linux Node 复用本机已有安装，业务 bundle 和库包均来自本轮产物。

## 3. 实际执行结果

| 测试层 | 结果 | 证据 |
| --- | --- | --- |
| Windows npm test | 187/187；3 个源码/测试类型检查通过 | [npm-test.log](evidence/npm-test.log) |
| build / test:dist | ESM/CJS、Node 双入口、两种混用方向及声明检查通过 | [build.log](evidence/build.log) / [dist.log](evidence/dist.log) |
| 正式 test:package | 退出码 0；无 React 核心、React 18/19 完整 77 项行为及类型通过 | [package.log](evidence/package.log) |
| 包级证据归档 | 实际 tarball、消费者锁及完整日志已保存 | [package-archived.log](evidence/package-archived.log) |
| 补充核心/存储 | 14/14；300040 次独立模型操作、18 组危险键投影、50 轮异常恢复 | [supplement-core.log](evidence/supplement-core.log) |
| 补充 React | 19 源码和 18 安装包各 15/15，包含各 1000 次挂载卸载 | [supplement-react.log](evidence/supplement-react.log) / [supplement-react18.log](evidence/supplement-react18.log) |
| 新增条件 computed DAG 模型 | 100 seeds × 1000 外层批次 × 12 个计算节点；277936 次修改及中途读取通过 | [derived-model.json](evidence/derived-model.json) / [derived-model.log](evidence/derived-model.log) |
| 独立派生 GC | ESM 9/9，CJS 9/9；活动订阅保活与弃用派生释放均正常 | [gc-esm.log](evidence/gc-esm.log) / [gc-cjs.log](evidence/gc-cjs.log) |
| README | 26 个可执行块类型与行为通过，fetch/localforage 示例使用受控 mock | [readme-types.log](evidence/readme-types.log) / [readme-runtime-final.log](evidence/readme-runtime-final.log) |
| Linux | npm ci / test / build / test:dist / 两种 GC / docs / test:package 均退出 0；同 Windows tarball 消费通过 | [linux.log](evidence/linux.log) / [linux-test.log](evidence/linux-test.log) / [linux-package.log](evidence/linux-package.log) |
| 文档映射 | 11 份 Markdown、242 条详细用例、187 项主测试映射通过 | [docs.log](evidence/docs.log) |
| 探索首次执行 | 16 项：8 通过、8 失败；失败均为 D04，未跳过 | [exploratory-arrays.log](evidence/exploratory-arrays.log) |
| 源码补充与复验 | 24 项：12 通过、12 失败，包含重验 ESM/CJS；失败均为 D04 | [exploratory-arrays-source.log](evidence/exploratory-arrays-source.log) |

已有套件全部通过与新增探索失败同时成立。首次失败日志完整保留，未删除断言、反转预期、修改生产代码或将失败转为跳过。README 首次运行使用了未包含提取子目录的 tsconfig，出现 React 未定义/装饰器转换错误；指定提取目录自己的配置后 26 段全部通过，详见执行异常记录。

## 4. D04：失败的数组 length 写入造成漏通知（S1 / P0）

定位：[src/reactive.ts](../../../src/reactive.ts) 第 156～162 行，Proxy set trap。关联 CORE-037、CORE-058、STORE-007、STORE-006 及 React 外部 store 更新链路；逐行统计归于 CORE-037 / STORE-007。README 第 736、742 行分别承诺已成功写入仍结算、数组截断通知实际受影响属性。

触发条件：数组中间有一个不可配置（不可删除）的索引，尾部还有可删除的索引，随后通过代理把 length 缩到受保护索引之前。JavaScript 会先删除高位元素，再在受保护索引处停止；Reflect.set 返回 false，但数组已变短。严格模式赋值抛 TypeError 也不能恢复已经删除的尾部。

```js
import { reactive, computed, effect } from '@canlooks/reactive'
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
stop()
```

| 观察项 | 预期 | 实际 |
| --- | --- | --- |
| 原始数组语义 | 返回 false；length=2，索引 2/3 删除 | 符合 JS 语义，本身不是 BUG |
| effect | 初始 [4,40] 后收到 [2,undefined] | 只收到初始状态 |
| watch length | callback(2,4) | 无回调；后续合法 length=3 时错误地跳过中间状态，callback(3,4) |
| computed | 长度 2 / 尾元素 undefined | 仍是长度 4 / 尾元素 40 |
| storage | 最终 JSON [10,20] | 仍为 [10,20,30,40]，重新加载可能恢复已删尾部 |
| React DOM | 2:undefined:2 | 4:40:4，三引擎及 React 18/19 均复现 |

根因：set trap 只有在 success 为 true 时才调用 recordChange，错误地把操作失败等同于状态未变。数组 ArraySetLength 的部分失败不符合这个假设。length 与隐式删除索引的前态其实已采集，只是在返回 false 时全部丢弃，进而没有失效 computed，也没有通知 storage 的深层观察者。

- 修复建议：保留 receiver 属于当前 raw target 的判断，但不以 success=true 为记录变化的前提。Reflect.set 返回后对目标属性及已采集的隐式索引逐一比较前后状态；让现有 recordChange / samePropertyState 过滤真正无变化的失败。继续返回原布尔结果，不回滚数组，也不提前额外执行 length 类型转换。
- 不要仅在 catch 分支处理：Reflect.set 的这条路径返回 false，并不抛错；严格赋值的 TypeError 产生在代理 trap 返回之后。也不要把所有失败都强制通知，完全未变化的只读数组应保持零额外通知。
- 最小方案见 suggested-D04.patch（仅建议草案，未应用、未经完整修复回归）。数组只含普通可删除元素时行为应保持不变；保留稀疏数组按自有索引枚举，避免扫描巨大 length。
- 修复验收：覆盖 numeric/string length、Reflect.set/严格赋值/外层 batch；断言实际 length、已删/保留索引、effect/watch 次数和 oldValue、computed 中途读取、storage 最终 JSON、React DOM、后续合法写入。增加完全不变的只读/受保护尾项负对照及通知抛错后的队列恢复。之后执行完整 npm test、dist、package、GC 和三浏览器矩阵。
- 临时规避：保持业务响应式数组元素可删除；确需固定元素时，在应用写入前校验截断范围，或把过滤后的新数组赋给一个可写的响应式容器属性。仅捕获 TypeError 或再写一次当前 length 无法触发缺失通知，batch 包裹也无法规避。

[完整值/通知/恢复记录](evidence/exploratory-arrays-source.json) · [Chromium/WebKit 复现](evidence/browser-defect.json) · [Firefox 复现](evidence/browser-defect-firefox.json) · [Linux 同 tarball 复现](evidence/linux-partial-truncation.log) · [可运行最小矩阵](scripts/exploratory-arrays.mjs) · [建议补丁草案](evidence/suggested-D04.patch)

严重度为 S1：公开通知契约在受限但合法的数组描述符场景失效，已观察到页面与磁盘记录陈旧。没有把返回 false 或 TypeError 本身报为缺陷，也没有把未声明的 defineProperty 响应式通知列为要求；不可配置描述符在创建代理之前已设置。

## 5. 历史缺陷复验

| 编号 | 复验结论 | 证据 |
| --- | --- | --- |
| D01 跨 realm | Node vm 与三引擎 iframe 的普通对象、嵌套/用户类通知、内建排除、storage 恢复和访问器零调用通过 | [npm-test.log](evidence/npm-test.log) / [browser-results.json](evidence/browser-results.json) / [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) |
| D02 派生回收 | 存活源旁的 1000 个 computed 载荷与 1000 个 getter receiver 均回收为 0；活动 effect/watch 跨 GC 保持通知；两种模块图独立 9/9 | [memory.json](evidence/memory.json) / [heap-canaries.json](evidence/heap-canaries.json) / [gc-esm.log](evidence/gc-esm.log) / [gc-cjs.log](evidence/gc-cjs.log) |
| D03 valueProp=null | Model / defineModel 明确拒绝非法 null；合法省略/undefined/value/checked 及 null 模型数据通过；三个消费端类型入口通过 | [npm-test.log](evidence/npm-test.log) / [supplement-react.log](evidence/supplement-react.log) / [supplement-react18.log](evidence/supplement-react18.log) |
| R01 computed 额外成本 | 继续评审；两轮独立微基准详见下节。保持内存修复，不能建议退回有泄漏的旧实现。 | [derived-isolated-1.json](evidence/derived-isolated-1.json) / [derived-isolated-2.json](evidence/derived-isolated-2.json) |

## 6. 真实浏览器、安装包与平台覆盖

| 引擎 / OS | 版本 | React | 构建 | 常规断言组 | D04 |
| --- | --- | --- | --- | --- | --- |
| chromium / Windows | 151.0.7922.34 | 18.3.1 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| chromium / Windows | 151.0.7922.34 | 18.3.1 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| chromium / Windows | 151.0.7922.34 | 19.3.0 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| chromium / Windows | 151.0.7922.34 | 19.3.0 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| webkit / Windows | 26.5 | 18.3.1 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| webkit / Windows | 26.5 | 18.3.1 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| webkit / Windows | 26.5 | 19.3.0 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| webkit / Windows | 26.5 | 19.3.0 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| firefox / Linux/WSL | 153.0 | 18.3.1 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| firefox / Linux/WSL | 153.0 | 18.3.1 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| firefox / Linux/WSL | 153.0 | 19.3.0 | development | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |
| firefox / Linux/WSL | 153.0 | 19.3.0 | production | 10/10 通过 | 同引擎 dev 的 18/19 均复现 |

每个常规组合覆盖：真实输入/checkbox/select/multiple/数字空值、Chip 隔离、加载乱序、local/session 刷新与标签隔离、受控 SecurityError/QuotaExceededError 及恢复、真实强制 IndexedDB、SSR/hydration 正反例、真实 iframe 跨 realm、原生 ESM 和关闭会话后重开。每个失败注入都有对应阶段记录；常规矩阵未出现非预期 pageerror 或 console 错误。这里的 12/12 不包含 D04 的故障场景。

SSR 双请求夹具在 React 19 服务端生成简单 p 元素，React 18/19 客户端分别 hydrate；各 major 的包级完整套件另含其自身 SSR 验证。IndexedDB 明确确认驱动为 asyncStorage，没有把 localStorage 回退当成 IndexedDB 成功。

Windows Firefox 启动失败记录：Error: browserType.launch: spawn UNKNOWN
Call log:
  - <launching> C:\Users\Administrator\AppData\Local\ms-playwright\firefox-1538\firefox\firefox.exe -no-remote -headless -profile C:\Users\ADMINI~1\AppData\Local\Temp\playwright_firefoxdev_profile-VP3sdu -juggler-pipe -silent
。Linux Firefox 成功不能代替 Windows Firefox 平台证明。macOS/Safari 未执行；WebKit 引擎通过不能表述为 Safari 真机通过。自动化 insertText 不等同系统剪贴板粘贴或原生 IME。

[browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) · [Chromium 截图](evidence/chromium-19-development.png) · [WebKit 截图](evidence/webkit-19-development.png) · [Firefox 截图](evidence/firefox-19-development.png) · [D04 页面截图](evidence/D04-chromium-19.png)

## 7. 性能、压力与资源

固定微基准各预热 3 次、测量 10 次，中位数为中间两项均值，P95 取最近秩第 10 项。性能专用命令在大对象压力与浏览器任务结束后顺序执行；压力阶段的耗时只用于规模观察。比较基线为 10 月 16 日 D02 修复前的归档构建，用于复核历史 R01，不是把有泄漏的旧实现视为推荐版本。本轮源码与修复后基线完全一致，不能据运行噪声声称新增代码回归。

| 固定场景（第 2 轮） | 修复前中位数 ms | 当前中位数 ms | 修复前 P95 ms | 当前 P95 ms |
| --- | --- | --- | --- | --- |
| proxy/deep fields=1000 | 1.965 | 1.943 | 3.731 | 3.383 |
| proxy/deep fields=10000 | 15.070 | 15.036 | 25.208 | 24.430 |
| computed 100000 cached reads | 1.686 | 1.622 | 2.008 | 2.106 |
| 10000 writes batch=false | 15.094 | 16.364 | 59.596 | 53.617 |
| 10000 writes batch=true | 3.613 | 4.143 | 3.860 | 4.675 |
| QUAL-008 sparse length=1e9 own indices=3 | 0.011 | 0.012 | 0.015 | 0.017 |
| QUAL-008 depth=100 | 0.388 | 0.411 | 0.752 | 0.789 |
| QUAL-008 depth=1000 | 4.844 | 4.605 | 6.820 | 5.860 |
| JSON shared graph=false | 0.470 | 0.488 | 0.538 | 1.481 |
| JSON shared graph=true | 0.158 | 0.199 | 1.091 | 0.323 |

按“同一指标连续两轮增加 >20% 且绝对增加 >2ms”的计划观察阈值，固定规模基准命中：无。该阈值用于评审，不是项目承诺的绝对性能 SLA。

computed 微基准规模：single 为单计算值/单消费者/10000 次写入；shared-100 为 100 消费者/100 次写入；shared-1000 为 1000 消费者/10 次写入；chain-16 为 16 层计算链/1000 次写入。计时包含订阅、写入和 stop，不包含样本间 GC。

| computed 微基准（第 2 轮） | 修复前中位数 ms | 当前中位数 ms | 修复前 P95 ms | 当前 P95 ms |
| --- | --- | --- | --- | --- |
| single | 19.330 | 24.319 | 21.160 | 28.308 |
| shared-100 | 2.616 | 3.047 | 2.879 | 5.016 |
| shared-1000 | 3.617 | 5.816 | 4.755 | 9.663 |
| chain-16 | 6.047 | 9.716 | 8.531 | 12.650 |

R01 两轮复核命中：single、shared-100、shared-1000。测量在样本间跨事件循环并在计时外 GC、交替前后顺序，完整计数/结果断言通过。结果支持继续保留性能风险，需按真实业务 computed 写入频率评审。 优化应围绕弱订阅解析、登记复用和保活路径，并同时保护 D02 的回收与活动订阅语义。

[benchmark-before-1.json](evidence/benchmark-before-1.json) · [benchmark-after-1.json](evidence/benchmark-after-1.json) · [benchmark-before-2.json](evidence/benchmark-before-2.json) · [benchmark-after-2.json](evidence/benchmark-after-2.json) · [derived-isolated-1.json](evidence/derived-isolated-1.json) · [derived-isolated-2.json](evidence/derived-isolated-2.json)

| 存储压力：每组 5×10000 次编辑 | 字段数 | 每轮 set 次数 | maxActive | 平均每轮 ms | 最终 JSON 字节 |
| --- | --- | --- | --- | --- | --- |
| sync-batch | 1000 | 1 | 0 | 6.745 | 8895 |
| sync-unbatched | 1000 | 10000 | 0 | 5263.625 | 8895 |
| async-pending | 1000 | 2 | 1 | 5100.821 | 8895 |
| sync-batch | 10000 | 1 | 0 | 10.703 | 98895 |
| sync-unbatched | 10000 | 10000 | 0 | 55609.431 | 98895 |
| async-pending | 10000 | 2 | 1 | 54383.035 | 98895 |

共 300000 次压力编辑；异步在途最多 1 个 set，每轮只发首个与最后快照 2 次写入，没有积累 10000 次待写调用，最后磁盘 JSON 与最新内存一致。异步等待合并不会消除每次变更的全图扫描：一万字段逐次编辑仍有显著 CPU 成本。此为性能观察，未按缺失的 SLA 擅自判为新功能 BUG；业务事务可使用同步 batch 合并，同步段外不承诺自动批处理。

内存诊断：computed/getter 各创建 1000 个，源保留时存活 0/0，释放源后 0/0；保留共享 child 的 storage 根存活 0，异步 I/O 完成后根存活 0。每阶段跨 12 轮事件循环/GC，堆入边检查仅剩 V8 AllocationSite 模板，不把模板当作业务泄漏。

React 18/19 各 1000 轮 RC/Chip/Model/loading 挂载卸载，旧 handler 不再写入，旧 load 拒绝，外部修改不再产生已停止回调；每 100 轮记录堆，保存 before/500/1000 三份快照。GC 时机和进程堆波动不作为单次失败标准；有限压力结果不证明任意时长或规模均无泄漏。

压力脚本 resources.json 的两组 storage 初次诊断各显示 1 个根存活，未隐藏该原始结果。追加对照明确定位为第 999 号（最后一次循环）局部值：创建函数尚未返回时存活，函数返回并再次跨轮 GC 后两组均为 0，且共享 child 仍保留。与独立 factory 形式的 memory.mjs 及正式 GC 套件相符，不据此误报库保留泄漏。[诊断对照](evidence/storage-liveness-check.json) / [storage-liveness-check.log](evidence/storage-liveness-check.log)

[resources.json](evidence/resources.json) · [memory.json](evidence/memory.json) · [heap-canaries.json](evidence/heap-canaries.json) · [react-lifecycle.json](evidence/react-lifecycle.json) · [react18-lifecycle.json](evidence/react18-lifecycle.json) · [派生源保留堆](evidence/heap-clean-retained.heapsnapshot) · [React 19 结束堆](evidence/react-1000.heapsnapshot) · [React 18 结束堆](evidence/react18-1000.heapsnapshot)

## 8. 需求与用例执行覆盖

| 模块 | 计划用例 | 通过 | 失败 | 未执行 |
| --- | --- | --- | --- | --- |
| 核心响应式 | 73 | 72 | 1 | 0 |
| 持久化 | 41 | 40 | 1 | 0 |
| React 基础 | 35 | 35 | 0 | 0 |
| Chip / Model | 26 | 26 | 0 | 0 |
| 加载状态 | 35 | 35 | 0 | 0 |
| 类型与发布 | 16 | 16 | 0 | 0 |
| 兼容性与质量 | 16 | 13 | 0 | 3 |

优先级分布：P0 140、P1 98、P2 4。保守整行执行率 (通过+失败)/计划 = 98.76%；已执行整行通过率 = 99.16%。这两个比例不是行/分支覆盖率；本轮未采集 V8 行覆盖率。

未执行：QUAL-001 的系统 IME/真实剪贴板；QUAL-006 的 macOS/Safari 子项；QUAL-016 的独立人工交付演练。这些行已完成的自动化子项仍保留证据，但整行不计通过。不适用项为 0，未替维护者签署平台排除。Windows Firefox 另有明确环境阻塞。

每条记录的原始前置、步骤、预期和自动化映射列于下方；“通过”表示列明范围的实际断言通过。测试计划和基线文档中的 105/76、181/240 是历史数量，本轮按 validate-docs 实际得到的 110/77、187/242 统计。

## 9. 执行异常、限制与修复顺序

| 事项 | 判断与处理 | 证据 |
| --- | --- | --- |
| Windows Firefox spawn UNKNOWN | 浏览器启动环境阻塞；原日志保留，Linux Firefox 另行完成，未覆盖为 Windows 成功 | [browser.log](evidence/browser.log) / [browser-results.json](evidence/browser-results.json) |
| README 首次 React/装饰器报错 | 提取后的 .tsx 位于子目录，首次使用的 tsconfig 未包含它们；改为明确指定提取目录配置后 26/26。没有给示例塞 React 全局或修改库实现。 | [readme-runtime.log](evidence/readme-runtime.log) / [readme-results-initial.json](evidence/readme-results-initial.json) / [readme-runtime-final.log](evidence/readme-runtime-final.log) |
| Linux D04 首次手工启动命令 | 跨 shell 的未引用 PATH 包含空格/括号导致 bash 解析失败；改为有完整引号的 linux-defect.sh 后正常运行并确认产品失败。与库逻辑无关。 | [修正后的脚本](scripts/linux-defect.sh) |
| 测试边界 | 没有原生 IME/真实剪贴板、macOS/Safari、独立人工签收；没有最低浏览器版本和任意无限规模承诺。压力计时未记录电源模式/温度，需将机器噪声纳入评审。 | 见第 8 节 |
| BUG 状态 | D04 已确认、未修复；建议优先修复并把边界用例纳入正式核心/存储/React 套件。R01 继续性能评审。 | 发布门槛仍未满足 |

- 先修复 D04 并回归公开入口、两种模块与三引擎；不要把失败写入统一当成无变化。
- 再根据真实业务写频率评审 R01 和大对象逐次扫描成本，优化时保留 GC 证据与净变化语义。
- 补齐系统输入、目标 macOS/Safari 与独立验收；发布负责人明确支持平台并签收所有未执行项。

## 10. 复跑入口与交付清单

```powershell
# 在项目根目录运行；输出写入新目录时先复制并调整报告脚本路径
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
node --test test/reports/2026-10-19_171129/scripts/derived-model.mjs
```

完整命令及参数、CWD、UTC 起止、耗时、退出码见各 *.result.json；Linux 子步骤另有 *.exit.txt。浏览器运行需要本轮 .runtime 安装及 Playwright 1.62.0 对应引擎，首次准备使用 setup-browser.mjs；Linux 脚本中的已有 Node/浏览器安装路径应在其他机器调整。不要直接复跑并覆盖历史证据目录。

| 交付 | 说明 |
| --- | --- |
| [report.md](report.md) | 完整 Markdown 报告与 242 行执行账本 |
| [report.html](report.html) | 离线 HTML，支持检索/状态筛选/用例展开与打印 |
| [results.json](results.json) | 结构化结果、缺陷、环境矩阵及完整用例数据 |
| [manifest.json](evidence/manifest.json) | 证据文件 SHA-256 清单 |
| [源码快照入口](evidence/source-snapshot/package.json) | 79 文件快照 + 历史文档证据附件 |
| [scripts/run-command.mjs](scripts/run-command.mjs) | 所有执行与新增复现/模型/浏览器/报告验证脚本 |

报告自检：242 条记录及唯一 ID、全部本地链接、失败/未执行筛选、D04 检索、详情展开、桌面/390px 移动视口及页面异常检查通过。[自检结果](evidence/report-validation.json) · [桌面预览](evidence/report-desktop.png) · [移动预览](evidence/report-mobile.png) · [源文件/产物一致性与建议补丁检查](evidence/verification.json)

## 11. 命令结果清单

| 命令标识 | 退出码 | 耗时 s | 日志 |
| --- | --- | --- | --- |
| npm-test | 0 | 5.57 | [npm-test.log](evidence/npm-test.log) |
| build | 0 | 0.61 | [build.log](evidence/build.log) |
| supplement-core | 0 | 1.12 | [supplement-core.log](evidence/supplement-core.log) |
| dist | 0 | 1.54 | [dist.log](evidence/dist.log) |
| gc-esm | 0 | 0.53 | [gc-esm.log](evidence/gc-esm.log) |
| gc-cjs | 0 | 0.46 | [gc-cjs.log](evidence/gc-cjs.log) |
| memory | 0 | 0.61 | [memory.log](evidence/memory.log) |
| supplement-react | 0 | 5.07 | [supplement-react.log](evidence/supplement-react.log) |
| docs | 0 | 0.10 | [docs.log](evidence/docs.log) |
| package | 0 | 50.45 | [package.log](evidence/package.log) |
| package-archived | 0 | 21.90 | [package-archived.log](evidence/package-archived.log) |
| resources | 0 | 603.29 | [resources.log](evidence/resources.log) |
| browser-install | 0 | 4.88 | [browser-install.log](evidence/browser-install.log) |
| browser | 1 | 11.79 | [browser.log](evidence/browser.log) |
| exploratory-arrays | 1 | 0.14 | [exploratory-arrays.log](evidence/exploratory-arrays.log) |
| exploratory-arrays-source | 1 | 0.36 | [exploratory-arrays-source.log](evidence/exploratory-arrays-source.log) |
| linux | 0 | 149.31 | [linux.log](evidence/linux.log) |
| readme-extract | 0 | 0.07 | [readme-extract.log](evidence/readme-extract.log) |
| readme-types | 0 | 0.28 | [readme-types.log](evidence/readme-types.log) |
| readme-runtime | 1 | 1.05 | [readme-runtime.log](evidence/readme-runtime.log) |
| heap-check | 0 | 0.10 | [heap-check.log](evidence/heap-check.log) |
| linux-browser | 0 | 9.60 | [linux-browser.log](evidence/linux-browser.log) |
| readme-runtime-final | 0 | 1.07 | [readme-runtime-final.log](evidence/readme-runtime-final.log) |
| browser-defect | 1 | 1.44 | [browser-defect.log](evidence/browser-defect.log) |
| derived-model | 0 | 1.87 | [derived-model.log](evidence/derived-model.log) |
| browser-defect-firefox | 1 | 3.73 | [browser-defect-firefox.log](evidence/browser-defect-firefox.log) |
| supplement-react18 | 0 | 4.38 | [supplement-react18.log](evidence/supplement-react18.log) |
| verify-artifacts | 0 | 0.16 | [verify-artifacts.log](evidence/verify-artifacts.log) |
| benchmark-before-1 | 0 | 0.75 | [benchmark-before-1.log](evidence/benchmark-before-1.log) |
| benchmark-after-1 | 0 | 0.78 | [benchmark-after-1.log](evidence/benchmark-after-1.log) |
| benchmark-before-2 | 0 | 0.75 | [benchmark-before-2.log](evidence/benchmark-before-2.log) |
| benchmark-after-2 | 0 | 0.77 | [benchmark-after-2.log](evidence/benchmark-after-2.log) |
| derived-isolated-1 | 0 | 1.26 | [derived-isolated-1.log](evidence/derived-isolated-1.log) |
| derived-isolated-2 | 0 | 1.28 | [derived-isolated-2.log](evidence/derived-isolated-2.log) |
| storage-liveness-check | 0 | 0.15 | [storage-liveness-check.log](evidence/storage-liveness-check.log) |
| verify-report | 0 | 1.12 | [verify-report.log](evidence/verify-report.log) |

退出码 1 的 D04 复现脚本代表真实产品断言失败；browser 的 1 来自 Windows Firefox 启动阻塞；readme-runtime 的首次 1 来自测试夹具配置，最终 readme-runtime-final 为 0。它们不能合并成一个“所有命令成功”的结论。建议补丁仅为审阅草案，不代表本报告测试对象已修复。

## 12. 242 条用例执行账本

### 核心响应式

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| CORE-001 / P0 | 立即执行、属性级依赖与重复读取 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N01 |
| CORE-002 / P0 | 条件依赖和嵌套收集 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N02 |
| CORE-003 / P0 | stop 幂等、排队取消和自停 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N03 |
| CORE-004 / P0 | Object.is 和 raw/proxy 归一 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N04 |
| CORE-005 / P0 | 缺失/undefined/删除/失败写入 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N05 |
| CORE-006 / P0 | 深层代理身份、环、旧分支清理 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N06 |
| CORE-007 / P0 | 嵌套 batch、返回值、多字段去重 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N07 |
| CORE-008 / P0 | 净变化包含属性存在性 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N08 |
| CORE-009 / P1 | batch 内依赖及新 effect / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N09 |
| CORE-010 / P1 | 空批次与非法参数 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N10、N43 |
| CORE-011 / P0 | 首次 effect 失败自动清理 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N11 |
| CORE-012 / P0 | 回调/通知多错误与恢复 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N12 |
| CORE-013 / P0 | flush 中再写与自递归抑制 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N13 |
| CORE-014 / P0 | setter 合并、异常与无隐式求值 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N14 |
| CORE-015 / P0 | 惰性计算与缓存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N15、N70 |
| CORE-016 / P0 | 计算分支隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N16 |
| CORE-017 / P0 | 链与菱形一次新鲜通知 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N17 |
| CORE-018 / P0 | 中途读取与净回退 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N18 |
| CORE-019 / P1 | 结算不废弃最终有效缓存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N19 |
| CORE-020 / P0 | 恢复原分支后不漏净变化 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N20 |
| CORE-021 / P0 | 临时分支变化不误通知 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N21 |
| CORE-022 / P0 | 无批后读取也恢复依赖 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N22 |
| CORE-023 / P0 | 多层 computed 分支图恢复 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N23 |
| CORE-024 / P1 | 批内首次计算的基线 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N24 |
| CORE-025 / P0 | 分支恢复不复活 stop 节点 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N25 |
| CORE-026 / P1 | 不按派生结果去重 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N26 |
| CORE-027 / P0 | 计算失败重试和循环检测 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N27 |
| CORE-028 / P0 | 抛错批次也恢复计算依赖 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N28 |
| CORE-029 / P0 | 自动 getter 缓存与 setter / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N29 |
| CORE-030 / P1 | 原型 getter 按 receiver 隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N30 |
| CORE-031 / P1 | getter 删除与替换 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N31 |
| CORE-032 / P1 | Proxy 不变量 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N32 |
| CORE-033 / P1 | 代理位于原型链的 receiver / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N33 |
| CORE-034 / P1 | 内建对象保留身份 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N34 |
| CORE-035 / P1 | 类型判定无用户 getter 副作用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N35 |
| CORE-036 / P1 | null 原型与 symbol / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N36 |
| CORE-037 / P0 | 数组索引/长度/截断 / 失败 | 计划原始普通数组步骤通过；扩展到不可删除索引时，length 写入失败但数组部分截断，通知与持久化遗漏（D04）。为防止掩盖同一功能的已知失败，本行整体记失败。 [npm-test.log](evidence/npm-test.log) · [exploratory-arrays-source.log](evidence/exploratory-arrays-source.log) · [exploratory-arrays-source.json](evidence/exploratory-arrays-source.json) · [browser-defect.json](evidence/browser-defect.json) · [browser-defect-firefox.json](evidence/browser-defect-firefox.json) | A: N37 |
| CORE-038 / P0 | 数组净回退 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N38 |
| CORE-039 / P1 | length 派生中途读取 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N39 |
| CORE-040 / P1 | 稀疏数组与非规范索引 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N40 |
| CORE-041 / P1 | splice 与原生方法身份 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N41 |
| CORE-042 / P0 | @reactive 构造、实例与静态批次 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N42 |
| CORE-043 / P0 | @reactive() 等价能力 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N43 |
| CORE-044 / P1 | reactive(Class) 与工厂身份 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N44 |
| CORE-045 / P0 | 继承/super/互调最外层批次 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N45 |
| CORE-046 / P1 | 继承 getter/方法接收对象 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N46 |
| CORE-047 / P1 | 包装身份、替换、动态 this / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N47 |
| CORE-048 / P1 | 不误包装普通函数属性 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N48 |
| CORE-049 / P1 | 函数字段/getter返回函数边界 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N49 |
| CORE-050 / P1 | 固定静态方法与 TS private / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N50 |
| CORE-051 / P0 | 类方法失败后的结算 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N51 |
| CORE-052 / P1 | 方法内读取和数组批次 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N52 |
| CORE-053 / P0 | batch 不等待 Promise / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N53 |
| CORE-054 / P1 | async方法/生成器/微任务/定时器 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N54 |
| CORE-055 / P1 | effect 仅收集同步读 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N55 |
| CORE-056 / P1 | 净变化逐属性判断 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N56 |
| CORE-057 / P1 | 捕获内层异常不重置基线 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N57 |
| CORE-058 / P1 | 不可扩展与非法 length / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N58 |
| CORE-059 / P0 | 更新期 computed失败不阻断其他人 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N59 |
| CORE-060 / P1 | 自动 getter分支与静态回退 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N60 |
| CORE-061 / P1 | API 返回语义 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N61、T-CORE |
| CORE-062 / P0 | watch默认/immediate/void/配置 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N62 |
| CORE-063 / P0 | watch回调及选项读隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N63 |
| CORE-064 / P0 | watch分支/同值/对象引用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N64 |
| CORE-065 / P1 | 批内immediate与同步写回 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N65 |
| CORE-066 / P0 | watch错误时旧值推进 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N66 |
| CORE-067 / P0 | watch停止与聚合错误 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: N67 |
| CORE-068 / P0 | Computed外壳只读与身份 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: X01 |
| CORE-069 / P1 | 计算结果引用与解构快照 / 通过 | 对象结果可修改且同次缓存保留引用；函数/undefined 原样返回；解构值保持旧快照。 [supplement-core.log](evidence/supplement-core.log) | P: X01、T-CORE；补充运行时对象结果与提前解构断言 |
| CORE-070 / P1 | raw和结构追踪范围 / 通过 | raw 写入、in/Object.keys/for...in 不触发结构订阅；代理字段写入正常通知。 [supplement-core.log](evidence/supplement-core.log) | P: S08、N06；补充in/for...in及raw写入负向对照 |
| CORE-071 / P1 | 序列化以外的字符串/对象边界 / 通过 | 空键、中文、emoji、symbol、false/0、空数组和跨根共享 child 身份及批内回退通过。 [supplement-core.log](evidence/supplement-core.log) | P: N36、N04、X02；补充Unicode键和false/0参数表 |
| CORE-072 / P1 | watch输入验证与返回值非清理 / 通过 | null/undefined/数字分别置于 source/callback 均拒绝；stop 幂等，回调返回函数未执行。 [supplement-core.log](evidence/supplement-core.log) | P: N62、N66；补充全部非法参数和清理返回值运行时检查 |
| CORE-073 / P1 | 跨 realm 普通对象与代理边界（D01） / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) · [package-archived.log](evidence/package-archived.log) | A: N68、N69、D-CORE；真实 iframe 另见复测报告 |

<details><summary>CORE-001 原始前置、步骤、预期</summary>

- 前置/数据：count=1、message=hello；两个 effect 分别读取字段
- 步骤：1. 注册；2. 在 count effect 连读两次；3. 分别修改 count/message
- 预期：注册各执行一次；一次 count 修改只重跑对应 effect 一次；message 同理；赋值返回前已通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-002 原始前置、步骤、预期</summary>

- 前置/数据：flag=true、a=1、b=10；外层读条件及 tail，内部另建 effect
- 步骤：1. flag=false；2. 改 a、b、inner；3. 改 tail；每次重建内层前 stop 旧内层
- 预期：a 旧分支不触发；b 新分支触发；inner 只驱动内层；tail 仍属于外层；外层不会代管内层 stop
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-003 原始前置、步骤、预期</summary>

- 前置/数据：先注册的 effect 可停止后注册 effect
- 步骤：1. 触发后停止待执行节点；2. 回调内自停后继续读 tail；3. 重复 stop；4. 再改数据
- 预期：已排队节点不执行；自停后读取不重新订阅；重复 stop 无异常；其他消费者照常执行
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-004 原始前置、步骤、预期</summary>

- 前置/数据：value=NaN、nested=raw
- 步骤：1. 再写 NaN；2. nested 写同 raw 的 proxy；3. value 写 +0、-0
- 预期：前两项不通知；NaN→+0、+0→-0 各通知一次；raw/proxy 不误判新对象
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-005 原始前置、步骤、预期</summary>

- 前置/数据：空对象，fixed 为不可写不可配置；effect 读缺失 value
- 步骤：1. value=undefined；2. 删除两次；3. Reflect.set/delete fixed
- 预期：缺失→存在 undefined、存在→缺失各通知；重复删除无通知；失败返回 false，fixed 保持 2
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-006 原始前置、步骤、预期</summary>

- 前置/数据：raw.child.n=1，raw.self=raw
- 步骤：1. 重复 reactive(raw/proxy)；2. 读取 child/self；3. 替换 child；4. 修改旧 child 与新 child
- 预期：代理身份稳定，self===proxy；替换触发；旧 child 不再触发，新 child 正常触发；无递归溢出
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-007 原始前置、步骤、预期</summary>

- 前置/数据：a=1、b=10；effect 同读 a/b
- 步骤：1. 外层 a=2，内层 a=3，回到1；2. 新批次 a=2→3、b=11；3. 批外连续 a++ 两次
- 预期：内层结束不通知；回退批次无通知；变化批次只追加 [3,11]；返回值原样；批外两次各通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-008 原始前置、步骤、预期</summary>

- 前置/数据：{value:1}，effect 读 value
- 步骤：1. 同批删除再恢复1；2. 独立删除；3. 同批新增2再删除；4. 写 undefined
- 预期：步骤1/3不额外通知；步骤2通知；步骤4虽读取值仍 undefined，存在性改变仍通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-009 原始前置、步骤、预期</summary>

- 前置/数据：effect 内通过 batch 读 a；外部 batch 内另建读 b 的 effect
- 步骤：1. 修改 a；2. 批内新建 effect；3. stop 原 effect；4. 再改 b
- 预期：batch 不屏蔽收集；新 effect 当场运行；停止项不在结算复活；b 净变化正常通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-010 原始前置、步骤、预期</summary>

- 前置/数据：null、显式 undefined、1、字符串、布尔、symbol
- 步骤：1. batch 空函数；2. batch/effect 传 null；3. reactive 显式传每个基本类型
- 预期：空 batch 返回 undefined；非法调用 TypeError；reactive() 无参工厂与 reactive(undefined) 严格区分
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-011 原始前置、步骤、预期</summary>

- 前置/数据：effect 读 value 后抛 E；另一个正常 effect
- 步骤：1. 捕获创建异常；2. 注册正常 effect；3. 改 value
- 预期：原样抛 E；失败 effect 总共运行一次；后续正常订阅更新，收集上下文未泄漏
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-012 原始前置、步骤、预期</summary>

- 前置/数据：batch 错误 E0；两个更新 effect 抛 E1/E2；第三个记录值
- 步骤：1. batch 写1后抛 E0；2. 捕获；3. 写2；4. 单独 throw undefined
- 预期：errors 为 [E0,E1,E2]；记录者仍看到1；写2正常；成功写入不回滚；单个 undefined 异常不被吞
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-013 原始前置、步骤、预期</summary>

- 前置/数据：先订阅 [source,derived]，后订阅 source→derived=source×2
- 步骤：1. source 0→1；2. 创建读写自身的 effect
- 预期：可观察 [0,0]→[1,0]→[1,2]，后续写是新批次；当前运行的 effect 不直接递归自身
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-014 原始前置、步骤、预期</summary>

- 前置/数据：setter 同时写 a/b，值2时抛 E；getter 计数
- 步骤：1. 不读 getter 直接设置1；2. 设置2并捕获
- 预期：观察者仅见 [1,1]、[2,2] 完整状态；getter 调用0；原 E 抛出，已写数据仍结算
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-015 原始前置、步骤、预期</summary>

- 前置/数据：count=1，double=count×2，getterCalls=0
- 步骤：1. 创建；2. 连读两次；3. count=2→3且不读；4. 再读；5. computed(null)
- 预期：调用次数0→1→1→2；结果2/6；无消费者时写入不主动求值；非法 getter TypeError
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-016 原始前置、步骤、预期</summary>

- 前置/数据：computed(flag?a:b)，消费者只读 computed
- 步骤：1. true→false；2. a++；3. b++
- 预期：序列1→10→11；消费者不因旧 a 变化运行；派生内部依赖不泄漏给外部
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-017 原始前置、步骤、预期</summary>

- 前置/数据：a=count+1，b=count×2，total=a+b，chain=total×10
- 步骤：1. effect 同读源和全部派生；2. count=2；3. batch 3→4
- 预期：序列 [1,2,2,4,40]、[2,3,4,7,70]、[4,5,8,13,130]；无旧缓存或重复通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-018 原始前置、步骤、预期</summary>

- 前置/数据：count=1，double、chain=double+1
- 步骤：batch 中 count=2，读 chain，再恢复1；批后再读两层
- 预期：中途为5；effect 不追加；批后 double=2、chain=3，不保留中间值
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-019 原始前置、步骤、预期</summary>

- 前置/数据：getter 每次改变依赖读取顺序，集合相同
- 步骤：batch 写 count=2并读 final；批次结束让消费者读
- 预期：final=4；getter 总计只计算2次；依赖顺序变化不导致多一次重算
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-020 原始前置、步骤、预期</summary>

- 前置/数据：flag=true、a=1、b=10；computed 选分支
- 步骤：batch 切到 b并读取；a=2；flag=true；结束后再改 a
- 预期：结束通知原分支最终2，后续 a 仍能触发；按原依赖判断变化
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-021 原始前置、步骤、预期</summary>

- 前置/数据：同 CORE-020
- 步骤：batch 切 b并读，修改 b，flag 恢复；再独立改 a/b
- 预期：本批无原分支净变化则不通知；a 后续触发，临时 b 不触发
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-022 原始前置、步骤、预期</summary>

- 前置/数据：同上
- 步骤：batch 切换/读取/恢复；不主动读 computed，直接改 a
- 预期：a 修改仍驱动消费者；不能依赖批后手动读取修复订阅
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-023 原始前置、步骤、预期</summary>

- 前置/数据：内外两层 computed 均可切分支
- 步骤：批内切换读取再恢复；分别修改原/临时分支
- 预期：上下游订阅双向一致，原分支有效、临时分支无多余通知；最终缓存正确
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-024 原始前置、步骤、预期</summary>

- 前置/数据：computed 创建时未读，批内首次读并订阅
- 步骤：首次求值后再变更并结算
- 预期：首次实际收集的依赖成为该批基线；之后变化不丢、不误用空依赖
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-025 原始前置、步骤、预期</summary>

- 前置/数据：消费者订阅 computed
- 步骤：批内切分支后 stop 消费者，再回退/结束；后续写源
- 预期：停止节点不再执行；computed 依赖恢复不会重新激活消费者
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-026 原始前置、步骤、预期</summary>

- 前置/数据：computed(count%2)，count=1
- 步骤：count=3
- 预期：消费者仍通知，新旧派生值均1；不是 computed 结果相等过滤
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-027 原始前置、步骤、预期</summary>

- 前置/数据：首次/条件失败的 getter；直接及互相循环 computed
- 步骤：1. 读失败；2. 修复再读；3. 读循环；4. 新建正常订阅
- 预期：错误不缓存为成功；修复可重试；循环抛明确 Circular 错误；后续上下文正常
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-028 原始前置、步骤、预期</summary>

- 前置/数据：条件 computed，batch 中切分支读后抛 E
- 步骤：捕获，修改最终有效分支
- 预期：已完成修改按最终状态结算；后续依赖仍有效，无损坏队列
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-029 原始前置、步骤、预期</summary>

- 前置/数据：count=1，get/set double
- 步骤：连读 double；设 double=8；再次读取
- 预期：getter 惰性且缓存，setter 写 count=4使缓存失效；结果8，消费者收到新状态
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-030 原始前置、步骤、预期</summary>

- 前置/数据：两对象共享原型 getter，数据值不同；原型也经代理
- 步骤：分别读两实例多次，改其中一个
- 预期：缓存各自独立且 this 正确；改 A 不污染 B；代理原型不导致重包错误
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-031 原始前置、步骤、预期</summary>

- 前置/数据：自有可配置 getter，已有消费者
- 步骤：删除 getter；经受支持的属性赋值恢复/替换数据；读取
- 预期：属性消费者获得删除后的值和新数据；不以 defineProperty 本身须通知作为要求
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-032 原始前置、步骤、预期</summary>

- 前置/数据：不可配置不可写对象属性；没有 getter 的固定访问器
- 步骤：读固定引用/空 getter；尝试失败写入
- 预期：固定引用返回原对象，空 getter 为 undefined，无 Proxy invariant 异常；不强制深代理
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-033 原始前置、步骤、预期</summary>

- 前置/数据：parent proxy、Object.create(parent) 子对象
- 步骤：观察 parent；通过 child 写同名属性
- 预期：写入落到子对象，不误通知父对象；父值不变
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-034 原始前置、步骤、预期</summary>

- 前置/数据：Map/Set/Date/Promise/URL/Headers 等；置于响应式属性
- 步骤：reactive(内建对象)并比较引用；对Map调用set；整体替换Map字段
- 预期：各内建对象返回原引用；Map内部set可执行但不通知；整体替换Map通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-035 原始前置、步骤、预期</summary>

- 前置/数据：自定义 Symbol.toStringTag getter；类有同名数据标识
- 步骤：reactive 并读写正常字段
- 预期：不调用 tag getter 判代理资格；正常用户类仍可追踪
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-036 原始前置、步骤、预期</summary>

- 前置/数据：Object.create(null)，symbol key
- 步骤：代理、订阅 symbol，修改值
- 预期：值正常，原型不变，symbol 按属性通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-037 原始前置、步骤、预期</summary>

- 前置/数据：[1,2,3]；分别观察 length、尾项、缺失索引
- 步骤：写越界索引、push、delete 索引、缩短 length
- 预期：隐式增长通知 length；删除索引不改变 length；截断通知实际被删索引和长度
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-038 原始前置、步骤、预期</summary>

- 前置/数据：[1,2,3]；观察 length 和索引2
- 步骤：1. batch push/pop；2. batch length=1再=3；3. 删除再恢复同索引同值
- 预期：完整回退不通知；恢复 length 不恢复丢失的元素，索引2为 undefined且通知；存在性独立比较
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-039 原始前置、步骤、预期</summary>

- 前置/数据：computed(()=>list.length)，有消费者
- 步骤：batch 内增长/截断并逐次读取，最后回退
- 预期：中途派生立即更新；最终通知遵循净变化，不读旧 length 缓存
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-040 原始前置、步骤、预期</summary>

- 前置/数据：大 length、少量真实索引；键 01、-1、4294967295
- 步骤：缩短 length；读非规范键
- 预期：仅处理真实数组索引；非规范键不作为 length 索引被误删，稀疏截断可完成
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-041 原始前置、步骤、预期</summary>

- 前置/数据：[1,2,3]
- 步骤：核对 splice 身份；batch 内 splice 多次写入
- 预期：保持原生数组方法；批内消费者一次看到终态；未包 batch 不承诺一次通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-042 原始前置、步骤、预期</summary>

- 前置/数据：F4，构造参数1，方法连增两次
- 步骤：new、instanceof、调用实例/静态方法、roundTrip
- 预期：构造参数和返回值正确；实例/静态各一次最终通知；往返无通知；原型正常
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-043 原始前置、步骤、预期</summary>

- 前置/数据：与 CORE-042 同类定义但工厂形式
- 步骤：重复构造、getter 读取、方法和静态变化
- 预期：与直接装饰器同语义；构造类型、缓存、批处理保留
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-044 原始前置、步骤、预期</summary>

- 前置/数据：普通用户类
- 步骤：比较 reactive(Class)、reactive()(Class)、重复代理；构造调用
- 预期：同一构造代理；参数与方法签名保留；行为和装饰器一致
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-045 原始前置、步骤、预期</summary>

- 前置/数据：父子类实例/静态方法，内部显式 batch
- 步骤：子方法调用 super和其他方法，每层写两次
- 预期：直到最外层结束才通知；共用原始基线；无重复包装通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-046 原始前置、步骤、预期</summary>

- 前置/数据：多实例、父子构造函数静态 getter
- 步骤：交错读取和修改不同 receiver
- 预期：实例和静态缓存各自隔离，继承方法读取当前调用者数据
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-047 原始前置、步骤、预期</summary>

- 前置/数据：取 method 两次，准备另一个接收对象
- 步骤：比较包装引用；替换原方法后重读；call/apply；无 receiver 调用
- 预期：未替换时同一函数；替换后新包装；this由调用方式决定，不自动 bind
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-048 原始前置、步骤、预期</summary>

- 前置/数据：普通对象 method；reactive(new Store())
- 步骤：方法内通过代理写两次
- 预期：不自动合并这两次写；直接代理实例仅代理属性，不等价于类构造装饰
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-049 原始前置、步骤、预期</summary>

- 前置/数据：实例箭头/绑定字段、静态函数字段、getter返回函数
- 步骤：读取比较身份并调用；另经显式 batch写代理
- 预期：不作为原型方法自动包装；构造捕获 raw 不被强制修正；受支持写入仍按显式 batch
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-050 原始前置、步骤、预期</summary>

- 前置/数据：不可写不可配置静态方法；TS private普通字段
- 步骤：读方法；调用 public方法改 private数据
- 预期：不违反 Proxy 不变量；TS private 可追踪；不据此宣称核心支持 #private
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-051 原始前置、步骤、预期</summary>

- 前置/数据：方法写状态后抛 E；观察者也可抛
- 步骤：调用失败方法，捕获，再调用成功方法
- 预期：已写值通知；单错保真，多错包含业务及通知错误；实例可继续用
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-052 原始前置、步骤、预期</summary>

- 前置/数据：effect 调用读取字段的方法；另一个方法修改数组
- 步骤：改被读字段；调用数组多写方法
- 预期：方法包装不隔离 effect 收集；数组写入在方法边界一次结算
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-053 原始前置、步骤、预期</summary>

- 前置/数据：async 回调在 await 前/后分别写两次
- 步骤：保存原 Promise与 batch返回值；分段控制完成
- 预期：返回同一个 Promise；await前合并，await后独立通知，除非另加 batch
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-054 原始前置、步骤、预期</summary>

- 前置/数据：类 async方法、生成器迭代和排队回调
- 步骤：分段执行并观察每个阶段
- 预期：仅当前同步调用栈共享批次；后续迭代/回调不延长旧 batch
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-055 原始前置、步骤、预期</summary>

- 前置/数据：effect 同步读 a、await或回调后读 b
- 步骤：完成异步读取；分别修改 a/b
- 预期：a 变化重跑，b 的异步读取不成为原 effect 依赖
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-056 原始前置、步骤、预期</summary>

- 前置/数据：NaN、±0、raw/proxy、两个嵌套字段
- 步骤：同批往返/交换引用/只改其中一字段
- 预期：按 Object.is及归一后的属性状态比较，不做深相等；独立字段互不吞通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-057 原始前置、步骤、预期</summary>

- 前置/数据：外层 batch；内层写后抛并在外层捕获
- 步骤：继续外层写入/回退；另测单一通知错误
- 预期：仍使用最外层初值，通知次数正确；单错严格等于原错误
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-058 原始前置、步骤、预期</summary>

- 前置/数据：preventExtensions对象、普通可变数组
- 步骤：添加属性失败；设置非法 length；再写合法数据
- 预期：JS失败语义正确，没有虚假通知或遗留批次；合法后续写仍通知
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-059 原始前置、步骤、预期</summary>

- 前置/数据：一消费者读取可能抛错的 computed，另一人记录源
- 步骤：源触发失败；修复后再读/再改
- 预期：其他消费者执行；computed可重试；错误不使队列永久停止
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-060 原始前置、步骤、预期</summary>

- 前置/数据：类 getter条件分支；静态 roundTrip
- 步骤：批内切换并回退；后续改原分支；调用静态往返方法
- 预期：原依赖恢复，静态回退无额外通知，缓存最终值正确
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-061 原始前置、步骤、预期</summary>

- 前置/数据：effect返回一个函数；batch返回对象/基本值
- 步骤：stop effect；比较 batch原返回引用/类型
- 预期：effect回调返回函数不被自动调用，stop不是runner；batch原样返回
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-062 原始前置、步骤、预期</summary>

- 前置/数据：source返回数值或undefined；缺省/空/false/true选项
- 步骤：创建；修改；创建后改options.immediate；stop
- 预期：默认只读一次不回调；true在返回前(initial,undefined)；后续old推进；undefined不是未初始化标记；改选项不补发
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-063 原始前置、步骤、预期</summary>

- 前置/数据：在外层effect建watch，callback/options getter读旁路字段
- 步骤：改旁路、源和外层专属字段
- 预期：旁路不绑定watch或外层effect；source只订阅自身同步读取
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-064 原始前置、步骤、预期</summary>

- 前置/数据：source为条件、count%2、对象及嵌套字段
- 步骤：切分支；1→3；修改嵌套或替换对象
- 预期：旧依赖解除；同结果仍回调(1,1)；仅返回对象不深监听；old对象不是历史快照
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-065 原始前置、步骤、预期</summary>

- 前置/数据：batch内创建immediate watch；callback写自身源
- 步骤：记录创建前后顺序；批内变更/回退
- 预期：首回调不等批次；当前watch不会直接自递归；后续按净变化结算
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-066 原始前置、步骤、预期</summary>

- 前置/数据：首次source/callback抛；更新source/callback可控失败
- 步骤：分别失败后修复并改源
- 预期：首次失败无残留订阅；更新source失败保留上次成功值；callback失败已保存本次新值，其他观察者继续
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-067 原始前置、步骤、预期</summary>

- 前置/数据：多watch、可排队停止/自停，两个callback抛错
- 步骤：触发同批变化、捕获，再变更
- 预期：被停项不执行；多错误保留；其他watch继续；后续队列可用
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-068 原始前置、步骤、预期</summary>

- 前置/数据：computed(()=>count×2)；对象/数组内保存它
- 步骤：尝试调用、直接赋value、Reflect.set；reactive(computed)；缓存命中后新建消费者
- 预期：冻结外壳；Reflect.set=false，严格写/调用TypeError；无自动解包/二次代理；缓存命中也能订阅
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-069 原始前置、步骤、预期</summary>

- 前置/数据：computed返回对象/函数/undefined；解构value
- 步骤：读两次比较引用；修改结果对象；修改源；再读解构局部值
- 预期：结果不自动代理/冻结；类型保持；提前解构仅旧值；消费者需在同步回调读.value
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-070 原始前置、步骤、预期</summary>

- 前置/数据：raw/proxy同对象；effect分别只用in/Object.keys/for...in
- 步骤：直接改raw；通过proxy新增/删除；另建显式读字段的effect
- 预期：raw写无通知；仅结构枚举不因结构变更重跑；显式字段读仍通知；storage内部观察不扩大该契约
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-071 原始前置、步骤、预期</summary>

- 前置/数据：空键、中文/emoji键、空数组、共享嵌套对象、0与false值
- 步骤：分别读写、重复代理、两个根共享子对象，批内回退
- 预期：键/值原样保留；各真实读取依赖正确；共享对象代理一致；无truthy/falsy误判
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-072 原始前置、步骤、预期</summary>

- 前置/数据：source/callback分别传null/undefined/数值，callback返回函数
- 步骤：每项单独调用；合法watch停止/更新
- 预期：非函数TypeError，无残留；返回的stop幂等且不执行callback返回函数；后续合法watch正常
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

<details><summary>CORE-073 原始前置、步骤、预期</summary>

- 前置/数据：Node vm 的嵌套普通对象、数组、null 原型、用户类和内建实例；constructor/tag 访问器
- 步骤：创建代理并重复取值；批量改子对象和类字段；对照内建身份及访问器次数
- 预期：普通对象/用户类正确通知且身份稳定；内建保持原样；分类不执行访问器、不收紧同 realm 自定义原型
- 计划位置：[test/cases/core.md](../../cases/core.md)

</details>

### 持久化

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| STORE-001 / P0 | 根入口storage可用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S01、D-STORAGE |
| STORE-002 / P1 | 对象名为length的受保护字段 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S02 |
| STORE-003 / P0 | 同步恢复、浅合并及本地行为保留 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S03 |
| STORE-004 / P0 | 缺失记录初存及key原样 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S04 |
| STORE-005 / P0 | 未读取字段深层新增/删除与分支替换 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S05 |
| STORE-006 / P0 | 净变化/相同JSON/抛错批次 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S06 |
| STORE-007 / P0 | 根数组原位恢复和孔洞 / 失败 | 计划原始普通数组步骤通过；扩展到不可删除索引时，length 写入失败但数组部分截断，通知与持久化遗漏（D04）。为防止掩盖同一功能的已知失败，本行整体记失败。 [npm-test.log](evidence/npm-test.log) · [exploratory-arrays-source.log](evidence/exploratory-arrays-source.log) · [exploratory-arrays-source.json](evidence/exploratory-arrays-source.json) · [browser-defect.json](evidence/browser-defect.json) · [browser-defect-firefox.json](evidence/browser-defect-firefox.json) | A: S07 |
| STORE-008 / P0 | 等业务通知完成后保存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S08 |
| STORE-009 / P1 | adapter及引用捕获隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S09 |
| STORE-010 / P1 | 共享子图、独立控制器 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S10 |
| STORE-011 / P0 | 异步读立即返回且禁写 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S11 |
| STORE-012 / P0 | 整份本地状态优先 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S12 |
| STORE-013 / P0 | 净回退/跨批回退/等内容替换 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S13 |
| STORE-014 / P0 | 回填一批及业务追加写 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S14 |
| STORE-015 / P0 | 单写在途/最新等待/回到旧成功值 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S15 |
| STORE-016 / P0 | 写失败重试与无无限循环 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S16 |
| STORE-017 / P0 | 编码失败丢弃过期pending / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S17 |
| STORE-018 / P0 | 读reject保留旧记录 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S18 |
| STORE-019 / P0 | 非法缓存/根形状/危险键 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S19 |
| STORE-020 / P1 | 同步get/set错误与诊断失败 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S20 |
| STORE-021 / P0 | 纯数据投影/不执行getter或toJSON / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S21 |
| STORE-022 / P1 | null原型与无环共享图 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S22 |
| STORE-023 / P0 | 恢复预检无半修改 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S23 |
| STORE-024 / P0 | 回填业务异常保真与绑定释放 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S24 |
| STORE-025 / P0 | 参数和绑定唯一性 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S25 |
| STORE-026 / P1 | 内部停止/迟到回调保护 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S26 |
| STORE-027 / P1 | PromiseLike与then异常 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S27 |
| STORE-028 / P1 | 每次调用独立识别同步/异步 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: S28 |
| STORE-029 / P0 | local/session默认与隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B01 |
| STORE-030 / P0 | 浏览器数组初存/缓存原位恢复 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B02 |
| STORE-031 / P1 | adapter优先，不触碰浏览器getter / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B03、S03 |
| STORE-032 / P1 | 存储getter被禁用及显式再绑定 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B04 |
| STORE-033 / P1 | QuotaExceededError不破坏响应式 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B05 |
| STORE-034 / P0 | SSR无window不使用Node全局storage / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: B06 |
| STORE-035 / P0 | 外部storage+RC/Chip/Model+StrictMode / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F01 |
| STORE-036 / P0 | 异步恢复驱动React与表单 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F02 |
| STORE-037 / P1 | 缓存不是业务schema校验 / 通过 | 合法 JSON 的 count="eight" 和未知字段按数据恢复；adapter 显式迁移后为数字 8。 [supplement-core.log](evidence/supplement-core.log) | M: F1；记录实际字段类型及adapter迁移结果 |
| STORE-038 / P1 | 非法adapter返回值与this / 通过 | 非法 get 返回值报告 decode；非法同步 set 报告 set；this 为 adapter，then getter 各读取一次。 [supplement-core.log](evidence/supplement-core.log) | P: S03、S20、S27；补充非法返回值及then getter读取次数 |
| STORE-039 / P0 | 所有危险键和继承setter防护 / 通过 | 三危险键 × 根/嵌套/数组元素 × 编码/解码共 18 组；继承 setter 独立进程测试无执行及半恢复。 [supplement-core.log](evidence/supplement-core.log) | P: S19、S21、S23；补充prototype/编码方向/继承setter矩阵 |
| STORE-040 / P1 | JSON细节与重新初始化默认字段 / 通过 | 中文/emoji/换行、±Infinity→null、数组命名属性忽略；删除默认字段后重载补回且纯恢复不写回。 [supplement-core.log](evidence/supplement-core.log) | P: S03、S07、S21；补充Unicode、数组命名属性及重载删除默认字段 |
| STORE-041 / P1 | 跨 realm 数据持久化与安全边界（D01） / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) · [package-archived.log](evidence/package-archived.log) | A: S29、S30、D-STORAGE |

<details><summary>STORE-001 原始前置、步骤、预期</summary>

- 前置/数据：从核心入口导入
- 步骤：检查函数并创建同步内存store
- 预期：导出为function；不需要React；返回可用响应式对象
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-002 原始前置、步骤、预期</summary>

- 前置/数据：普通对象length分别为getter/不可枚举只读，count=0；缓存count=4,length=2
- 步骤：创建；读取length；count++
- 预期：length仍9；count恢复4；纯恢复不写；之后仅存count=5，不误用数组length特例
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-003 原始前置、步骤、预期</summary>

- 前置/数据：F1默认初值；本地方法/getter/hidden/symbol；缓存试图覆盖它们
- 步骤：创建即读；重复读getter；调用方法
- 预期：返回前count=8；enabled保留；profile.size消失；根===reactive(raw)；方法/getter/hidden/symbol保留，恢复不调用getter、不回写
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-004 原始前置、步骤、预期</summary>

- 前置/数据：get返回null；name=' app:key '
- 步骤：外层batch创建count=1再写2；结束后写3
- 预期：get一次使用原样key；batch内set=0；边界写count=2一次；之后写3；不偷偷trim key
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-005 原始前置、步骤、预期</summary>

- 前置/数据：child={}，业务不预读新键；持有旧child
- 步骤：新增deep=1→2；删除；替换child；修改旧child；新child再新增
- 预期：每次有效数据变化自动保存；旧分支不再引发写；新分支无需业务预读也生效
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-006 原始前置、步骤、预期</summary>

- 前置/数据：count=1、child={value:1}、computed=count×2
- 步骤：batch 2→3；batch4→3；raw/proxy互换；同JSON替换；写4后抛E
- 预期：变化批次仅最终JSON；净回退及同JSON替换不重复set；抛错仍保存4且原E保留；内存观察正常
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-007 原始前置、步骤、预期</summary>

- 前置/数据：raw=[1,2,3]，缓存[9]
- 步骤：创建；索引3=4；删0；length=1；batch push/pop；batch splice
- 预期：根代理不变；依次JSON [9,null,null,4]、[null,null,null,4]、[null]；回退不写；splice一次终态
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-008 原始前置、步骤、预期</summary>

- 前置/数据：count=0,mirror=0；watch将mirror设count×10；另有getter计数与Object.keys effect
- 步骤：count=1；新增字段
- 预期：存储仅写含count=1,mirror=10的最终快照；不执行派生getter；普通枚举effect不被扩展为结构监听
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-009 原始前置、步骤、预期</summary>

- 前置/数据：adapter get/set读other.dependency；外层effect创建store
- 步骤：改other；经captureReference选择业务字段；写store再改other
- 预期：不额外绑定外层effect/store；引用仍指向业务字段；get/set读取不污染Model定位
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-010 原始前置、步骤、预期</summary>

- 前置/数据：两个根/adapter共享child={value:0}
- 步骤：改共享child；第一根替换child；再改第二根child
- 预期：初次两份都保存；替换后第一根不响应旧child；第二根继续；控制器不混用
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-011 原始前置、步骤、预期</summary>

- 前置/数据：deferred get；结果分别null/有效缓存
- 步骤：创建后立即读并注册effect；断言pending；resolve后turn
- 预期：pending读初值、set=0；null后保存初值；缓存后一次恢复通知且set=0；返回值不是Promise
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-012 原始前置、步骤、预期</summary>

- 前置/数据：延迟读；初值有count/theme/nested/list/remove
- 步骤：pending中batch改count、nested、list并删remove；返回旧缓存
- 预期：本地全树保留，theme不从旧缓存补入；删除不复活；读取完只保存本地最终JSON
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-013 原始前置、步骤、预期</summary>

- 前置/数据：value={count:1}；延迟缓存count=8
- 步骤：三个独立用例：同批1→2→1；跨批1→2→1；替换{count:1}
- 预期：仅同批回退允许恢复8；另两项保留本地1并保存；冲突使用修改历史而非最终JSON相等
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-014 原始前置、步骤、预期</summary>

- 前置/数据：初始a=b=1；缓存a=8,b=9；watch a==8时b=10
- 步骤：resolve缓存，记录effect与writes
- 预期：effect先见[1,1]、[8,9]，业务再见[8,10]；set仅最终{a:8,b:10}一次；不回声保存纯缓存
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-015 原始前置、步骤、预期</summary>

- 前置/数据：已存0；第一set受控不完成
- 步骤：count=1→2→3→0；先断言调用；完成第一、再第二
- 预期：第一只写1；等待阶段不并发；完成后必须写0；中间2/3合并；maxActiveWrites=1、最终磁盘0
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-016 原始前置、步骤、预期</summary>

- 前置/数据：delayedWriter已存0
- 步骤：写1，等待中改2→3；第一reject；第二reject；turn后改4并resolve
- 预期：失败后继续最新3；无新状态不再自动重试；改4能保存；成功基线不因失败推进，maxActive=1
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-017 原始前置、步骤、预期</summary>

- 前置/数据：{count:0,extra:0}，写1在途；等待count=2
- 步骤：extra=BigInt；完成在途；再extra=0
- 预期：编码失败清除旧pending，不能续写过时快照；修复后保存{count:2,extra:0}，无永久去重屏蔽
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-018 原始前置、步骤、预期</summary>

- 前置/数据：旧磁盘count=9，初值1，deferred读
- 步骤：pending中count=2；reject；turn；再count=3
- 预期：内存2保留，磁盘9不立刻覆盖，set=0；新修改后保存3；诊断phase=get
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-019 原始前置、步骤、预期</summary>

- 前置/数据：每次独立预置空串、null文本、数值、字符串、[]、损坏JSON、__proto__、嵌套constructor
- 步骤：创建对象根，检查数据和原型；再合法修改count
- 预期：整份拒绝，初值保留、无初始化set；原型不污染；新变化可写合法快照
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-020 原始前置、步骤、预期</summary>

- 前置/数据：get throw；第一次set throw；console.warn可抛
- 步骤：创建；count=1→2；再注入编码错误并修复
- 预期：内存通知0→1→2正常；报告get/set；logger失败不破坏队列；数据修复后仍可存
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-021 原始前置、步骤、预期</summary>

- 前置/数据：NaN、-0、undefined、function、symbol、数组孔洞/Infinity、危险getter/toJSON；payload可变
- 步骤：首存；逐项payload=BigInt/环/Date/Map/Set/Promise/类/Computed；改另一个tail；修复payload
- 预期：getter/toJSON调用0；省略对象不可JSON字段，数组转null，NaN转null，-0转0；非法图不覆盖好记录；修复可恢复保存
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-022 原始前置、步骤、预期</summary>

- 前置/数据：null原型根a/b共用同子对象
- 步骤：存储后改a.value
- 预期：原型保持null，a/b内存共用；JSON两处保存等值；无误判循环；重新解析JSON不保留别名身份
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-023 原始前置、步骤、预期</summary>

- 前置/数据：count可写但另字段只读；不可扩展根；锁length/尾索引数组
- 步骤：缓存同时尝试合法和非法修改
- 预期：整份拒绝，所有初值和数组内容不变；不先修改count再失败；phase=restore
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-024 原始前置、步骤、预期</summary>

- 前置/数据：effect在恢复到8时抛E；同步与异步两条路径
- 步骤：同步创建失败后stop业务effect再重建；异步resolve后再改9
- 预期：同步原E抛出并释放绑定，重建成功；异步phase=hydrate且原E保留，store后续可用；不误归为decode错误
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-025 原始前置、步骤、预期</summary>

- 前置/数据：非对象根/类/Computed；无name/空白name/错误type/坏adapter；一个已绑定raw
- 步骤：逐项非法调用；同根同后端/key重复；改key/adapter；同后端key绑第二根
- 预期：TypeError在新增I/O前发生；重复合法绑定同proxy、只get一次；冲突拒绝；不同key合法
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-026 原始前置、步骤、预期</summary>

- 前置/数据：白盒stopStorage；读/写deferred
- 步骤：停止两次；完成旧read/write；再写proxy；另建同后端key绑定
- 预期：停止幂等；不恢复、不续pending、不重订阅；可新建；不要求取消已经发出的adapter I/O
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-027 原始前置、步骤、预期</summary>

- 前置/数据：非Promise thenable重复resolve/reject；then getter抛
- 步骤：get返回thenable；turn；另测get/set then getter失败
- 预期：只同化一次且只接受首次结果；不提前同步回填；诊断阶段get/set正确；无未处理拒绝
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-028 原始前置、步骤、预期</summary>

- 前置/数据：同步get；set1同步、set2延迟、set3同步
- 步骤：依次写1/2/3；完成2
- 预期：先调用[1,2]；3等2完成；最终[1,2,3]；不能由getter或第一次set推断后续模式
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-029 原始前置、步骤、预期</summary>

- 前置/数据：jsdom同源两后端相同含空格key分别存2/8
- 步骤：默认store与session store创建；分别修改
- 预期：默认local；返回前已恢复；缓存缺默认字段不回写；两个后端互不污染；key原样
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-030 原始前置、步骤、预期</summary>

- 前置/数据：local缺失；session缓存[9]
- 步骤：新建[1,2,3]并batch splice/push；另用reactive数组恢复
- 预期：local创建快照并写最终[3,4]；session原proxy恢复为[9]、长度一致
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-031 原始前置、步骤、预期</summary>

- 前置/数据：local/session getter均计数并抛；显式adapter
- 步骤：设置type=session仍传adapter，创建并修改
- 预期：浏览器getter访问0；adapter正常get/set且this正确
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-032 原始前置、步骤、预期</summary>

- 前置/数据：localStorage getter抛SecurityError
- 步骤：创建后内存修改；恢复getter；显式storage同root再修改
- 预期：降级内存、报告access；恢复环境不自动触发；显式调用才绑定并继续存储
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-033 原始前置、步骤、预期</summary>

- 前置/数据：Storage.setItem模拟配额错误，之后恢复可写
- 步骤：初始化及修改各失败；恢复后再修改
- 预期：每次实际失败有诊断；无忙重试；effect持续收到数据；恢复后保存最新值
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-034 原始前置、步骤、预期</summary>

- 前置/数据：删除window；globalThis.localStorage getter抛且计数
- 步骤：创建不同name内存store并修改；还原环境
- 预期：不访问Node全局storage，访问次数0；无持久化占位绑定；只返回响应式初值
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-035 原始前置、步骤、预期</summary>

- 前置/数据：客户端render前创建store，F3 StrictMode
- 步骤：修改store、真实输入改Model；卸载组件后再改store
- 预期：UI与最终JSON一致；卸载只停React订阅，仍保存外部store；无重复绑定
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-036 原始前置、步骤、预期</summary>

- 前置/数据：初值state、延迟缓存；已提交RC/Chip/Model
- 步骤：resolve有效缓存；再输入新值
- 预期：恢复统一通知DOM/控件；纯恢复不回写；随后表单编辑保存新状态
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-037 原始前置、步骤、预期</summary>

- 前置/数据：初值count:number；缓存count='eight'，带未知普通字段
- 步骤：创建并检查；另用自定义adapter先验证/迁移再返回字符串
- 预期：默认接受合法JSON字段，不承诺number校验；自定义迁移按自身协议生效；不得编写默认丢弃字符串的错误预期
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-038 原始前置、步骤、预期</summary>

- 前置/数据：get返回undefined/数字/普通对象；set同步返回非undefined值；then计数
- 步骤：每项独立运行，记录get/set this和阶段；随后合法操作
- 预期：非法get报告decode，非法同步set报告set；记录不被错误确认成功；this为adapter；then只读一次
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-039 原始前置、步骤、预期</summary>

- 前置/数据：以defineProperty构建__proto__/constructor/prototype数据键，根/深层/数组元素各一份；Object.prototype临时setter测试在独立进程
- 步骤：编码、解码各测三键；恢复将命中继承setter的字段
- 预期：拒绝危险数据投影，无原型污染；继承setter不被执行，预检失败不半恢复；finally恢复全局描述符
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-040 原始前置、步骤、预期</summary>

- 前置/数据：Unicode/换行字符串、±Infinity、数组命名属性；初值可删除字段x=1
- 步骤：保存后JSON.parse；删x并保存；释放测试绑定，用同初值重新创建
- 预期：字符串等值；无限数null；数组命名属性不保存；缺失x由初值重新补回且纯恢复不回写，长期空值应显式null
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

<details><summary>STORE-041 原始前置、步骤、预期</summary>

- 前置/数据：vm 普通根/嵌套/数组/null 原型、延迟读取、类/内建/危险键、getter/toJSON
- 步骤：恢复再编辑；延迟缓存前编辑；非法根和编码/解码逐项验证
- 预期：根身份不变、纯恢复不回写、深层编辑保存、本地优先；危险键拒绝且无半恢复；访问器不执行
- 计划位置：[test/cases/storage.md](../../cases/storage.md)

</details>

### React 基础

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| REACT-001 / P0 | 别名、统一分发、包装缓存、非法类别 / 通过 | 真实 memo/forwardRef/lazy、async、null/undefined/数字/对象全部拒绝；重复本库包装保持身份。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: R01；补充真实memo/forwardRef/lazy对象的非法包装矩阵 |
| REACT-002 / P0 | 自动memo不屏蔽有效更新 / 通过 | 相同对象与函数引用跳过渲染；替换引用、store 更新正确显示；React 18/19 补充复测通过。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: R02；补充对象和函数引用更换的memo比较断言 |
| REACT-003 / P0 | props仅watch读取与无二次render / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R03 |
| REACT-004 / P0 | props派生候选缓存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R04 |
| REACT-005 / P1 | props视图身份、浅层只读、存在性 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R05 |
| REACT-006 / P0 | props选择source和最新闭包 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R06 |
| REACT-007 / P0 | 外层batch包含多次props提交 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R10 |
| REACT-008 / P0 | useReactive身份/useWatch提交时序 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R07 |
| REACT-009 / P0 | render到subscribe之间变化 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R08 |
| REACT-010 / P0 | Suspense保留已提交props/缓存/回调 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R09 |
| REACT-011 / P0 | props回调写入和通知中同步提交 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R11 |
| REACT-012 / P1 | 候选收集不订阅、快照失效 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R17 |
| REACT-013 / P0 | owner来源确认隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R18 |
| REACT-014 / P0 | notify节点依赖与重排队 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R19 |
| REACT-015 / P0 | 外层batch中的props快照确认 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R28 |
| REACT-016 / P0 | 类ref/PureComponent/生命周期/实例隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R12 |
| REACT-017 / P1 | shouldComponentUpdate语义 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R13 |
| REACT-018 / P1 | PureComponent的key/ref普通state字段 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F22 |
| REACT-019 / P0 | SSR及hydrate基线 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R14 |
| REACT-020 / P1 | 普通组件useWatch静默刷新 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R15 |
| REACT-021 / P0 | 排队watch旧值不被先行渲染覆盖 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R16 |
| REACT-022 / P0 | 首次挂起/抛错不得初始化watch / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R21 |
| REACT-023 / P0 | 后续setup失败清理已建watch / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R22 |
| REACT-024 / P1 | 外层batch内immediate setup时机 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R27 |
| REACT-025 / P0 | render分支与事件/子节点依赖隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R20 |
| REACT-026 / P0 | 类生命周期字段/context及挂载窗口 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R23 |
| REACT-027 / P0 | 类props整槽通知与历史引用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R24 |
| REACT-028 / P1 | 局部状态独立/显式共享 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R25 |
| REACT-029 / P1 | 解构值与props引用语义 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: R26 |
| REACT-030 / P0 | 所有类入口直接字段响应 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L01 |
| REACT-031 / P0 | 类字段深层身份/实例/净回退 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L03 |
| REACT-032 / P1 | 类描述符/symbol/空键/#private / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L04 |
| REACT-033 / P0 | 桥接字段贯通全部消费者 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L05 |
| REACT-034 / P1 | React保留字段与loading共存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L12 |
| REACT-035 / P1 | RC类方法无自动批次及getter边界 / 通过 | 普通方法两次写入通知两次，显式 batch 一次；getter 重读两次求值，18/19 一致。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: L03、L04；补充普通方法通知次数和getter非缓存对照 |

<details><summary>REACT-001 原始前置、步骤、预期</summary>

- 前置/数据：同步函数、类、已包装对象；外部memo/forwardRef/lazy、async函数、错误类型
- 步骤：对三组别名与RC/RFC/RCC包装结果比较；重复包装；逐项传非法组件
- 预期：RC/RFC/RCC各等于其全名；RC函数与RFC同一包装；重复本库包装不叠加；函数/类合法分发，非法类别TypeError
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-002 原始前置、步骤、预期</summary>

- 前置/数据：RC函数读store、React state、context，记录render增量
- 步骤：相同props父更新；对象/函数引用变化；store/state/context分别变化
- 预期：相同props跳过；真实props变化正常；store/state/context仍驱动正确DOM，不因memo漏更新
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-003 原始前置、步骤、预期</summary>

- 前置/数据：props.count=1；JSX不读或同时读；useWatch记录参数
- 步骤：一次父级更新count=2
- 预期：watch恰收到(2,1)，回调读props为2；受控render只增1，无同源补渲染
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-004 原始前置、步骤、预期</summary>

- 前置/数据：computed/getter链依赖props，已有已提交缓存
- 步骤：父级1→2；render和watch读取派生值
- 预期：本次render即用新props；成功提交后采用新缓存；不需要第二次修正render
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-005 原始前置、步骤、预期</summary>

- 前置/数据：props含对象/函数/children、缺失字段、NaN、±0
- 步骤：连续提交；检查代理身份/嵌套引用；尝试写/删/define；新增undefined、删键、改±0
- 预期：同挂载代理稳定；浅层原引用；顶层拒写，不修改冻结React props；按存在性/Object.is通知
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-006 原始前置、步骤、预期</summary>

- 前置/数据：props决定watch读store.a或b，callback带label
- 步骤：父级切分支/label并提交；改旧/新字段
- 预期：此次props回调仍保留上一成功oldValue；新闭包生效；旧分支解绑，新分支更新
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-007 原始前置、步骤、预期</summary>

- 前置/数据：已watch props.count=1
- 步骤：batch内提交2再3；另一batch提交4再3；每次flushSync受控提交
- 预期：正常变化一次(3,1)；回退无回调；结算前静默刷新不得吞旧值
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-008 原始前置、步骤、预期</summary>

- 前置/数据：inline初值、immediate watch，StrictMode对照
- 步骤：首次render/提交；重渲染换initial/options；卸载再写；重新挂载
- 预期：render不调用watch callback；layout setup按immediate执行；同挂载不重置/补发；卸载停止，重挂载新基线
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-009 原始前置、步骤、预期</summary>

- 前置/数据：layout中可修改store；新分支未在旧提交订阅
- 步骤：首次render读取后、订阅前改源；切新分支后窗口中再改
- 预期：版本复查发现候选过期，最终显示最新值；不能长期停留旧首帧
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-010 原始前置、步骤、预期</summary>

- 前置/数据：已提交A；新props B的transition被受控Promise挂起
- 步骤：挂起期间读已保存props、触发watch、读computed；随后释放并提交B
- 预期：挂起候选不发布、不改oldValue或缓存；旧事件读A；提交后才读B并通知正确一次
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-011 原始前置、步骤、预期</summary>

- 前置/数据：useWatch props变更时写local/store；React listener可flushSync提交
- 步骤：更新props并观察DOM/通知序列
- 预期：own-props去重只消除已覆盖来源；callback真实写入仍驱动必要后续更新，无丢失重入
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-012 原始前置、步骤、预期</summary>

- 前置/数据：白盒Observer，未subscribe的attempt读取a
- 步骤：仅render候选后改a；比较snapshot；再subscribe/commit
- 预期：收集期间无永久订阅；无变化snapshot稳定；订阅前失效被发现
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-013 原始前置、步骤、预期</summary>

- 前置/数据：两observer、普通store更新同时排队
- 步骤：确认A已提交props原因，保留B或普通store原因
- 预期：仅A自身已覆盖原因被清除；其他owner/store通知不被吞
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-014 原始前置、步骤、预期</summary>

- 前置/数据：白盒notify节点订阅字段，通知中写新数据
- 步骤：连续变化及通知内再次写
- 预期：notify不清空已提交依赖、不直接调用组件函数；可再次入队，最终读最新值
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-015 原始前置、步骤、预期</summary>

- 前置/数据：own-props提交发生于未结束batch
- 步骤：提交后但结算前多次读取snapshot；结束batch
- 预期：已覆盖的own-props版本不制造额外失效；真正新来源仍能触发
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-016 原始前置、步骤、预期</summary>

- 前置/数据：两个包装类实例，static标记、props watch，生命周期日志
- 步骤：props更新/字段变化/卸载；比较ref、prevProps、构造/方法参数
- 预期：ref为原类实例，instanceof/静态成员保留；生命周期参数正常；实例订阅独立；手工watch自行stop
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-017 原始前置、步骤、预期</summary>

- 前置/数据：SCU=false类；有/无活动props消费者；另有外部store
- 步骤：父props浅变；同props；外部store变；forceUpdate
- 预期：原SCU被调用；有活动props消费者且浅变时放行一次；其他遵守SCU；外部依赖更新不被阻断
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-018 原始前置、步骤、预期</summary>

- 前置/数据：state={key:1,ref:2}，RC(PureComponent)
- 步骤：setState key=3，再ref=4
- 预期：DOM依次3:2、3:4；不能把state的key/ref当React特殊props忽略
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-019 原始前置、步骤、预期</summary>

- 前置/数据：无window SSR；immediate useWatch；相同客户端初值
- 步骤：renderToString；改服务端store；hydrateRoot；客户端更新
- 预期：SSR不建watch、不callback；相同初值无hydration警告；首次客户端提交按immediate建立基线，不补历史变化
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-020 原始前置、步骤、预期</summary>

- 前置/数据：未经RC的函数组件，source捕获普通props/context
- 步骤：改普通props/context并提交；再改响应式源
- 预期：无响应式变化时不伪造回调；source绑定与callback更新到最新提交，之后使用新闭包
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-021 原始前置、步骤、预期</summary>

- 前置/数据：同轮较早消费者触发同步React提交；watch尚排队
- 步骤：触发源变化，记录watch next/previous
- 预期：静默refresh不吞队列、不提前改oldValue；只收到应有新旧值
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-022 原始前置、步骤、预期</summary>

- 前置/数据：初次render在useWatch之后挂起或抛错
- 步骤：执行失败render，改store，再解除挂起成功挂载
- 预期：未提交期间callback=0、无残留订阅；成功提交才按配置初始化
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-023 原始前置、步骤、预期</summary>

- 前置/数据：一个组件多个immediate useWatch，后一个首次callback抛E
- 步骤：挂载失败；之后修改所有source
- 预期：之前已初始化句柄也全部停止，无遗留回调，即使React尚未注册各自cleanup
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-024 原始前置、步骤、预期</summary>

- 前置/数据：batch内同步挂载组件/useWatch immediate
- 步骤：记录setup内与batch结束顺序
- 预期：immediate在setup当场执行，不推迟到外层batch结束，也不递归重复初始化
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-025 原始前置、步骤、预期</summary>

- 前置/数据：父RC按flag读a或b；事件读c；独立子读d
- 步骤：切分支并提交；分别改a/b/c/d
- 预期：父只响应当前render依赖；事件读和独立子组件读不进入父订阅；旧分支清理
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-026 原始前置、步骤、预期</summary>

- 前置/数据：类字段形式生命周期，context，StrictMode；挂载前窗口修改
- 步骤：mount/unmount/mount重放；改store/context
- 预期：用户生命周期正常、窗口变化最终可见；重连后有效订阅一份，卸载后停止
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-027 原始前置、步骤、预期</summary>

- 前置/数据：this.props.count手工watch；只改其他props；记录prevProps和forceUpdate
- 步骤：父props多次更新、同值外壳对照
- 预期：整槽浅变可回调相同count；旧props引用保持历史；不额外forceUpdate同源props更新
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-028 原始前置、步骤、预期</summary>

- 前置/数据：两组件分别inline初值；另两组件共享raw
- 步骤：各自写状态；父级重渲染换initial
- 预期：inline互不干扰；共享raw同代理且互相可见；本次挂载忽略新initial
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-029 原始前置、步骤、预期</summary>

- 前置/数据：RC(props)，const {count}=props；另读props.count和对象字段
- 步骤：父级提交count及嵌套引用变化
- 预期：source闭包中的解构值不建立props订阅；视图字段读取可监听；嵌套引用不深复制
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-030 原始前置、步骤、预期</summary>

- 前置/数据：RC/ReactiveComponent/RCC/ReactiveClassComponent分别包类；普通count字段
- 步骤：无loading装饰器，挂载后count++
- 预期：四入口都更新DOM，不需额外reactive；不能仅在加载字段场景验证类字段能力
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-031 原始前置、步骤、预期</summary>

- 前置/数据：两实例字段含对象/数组；明确共享raw的对照
- 步骤：深层改动、整体替换、同值、batch回退及多写
- 预期：普通实例独立；共享raw共享；深层proxy稳定；多写一次通知，回退无通知
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-032 原始前置、步骤、预期</summary>

- 前置/数据：configurable普通字段、readonly/hidden/symbol/空键、访问器、#private方法；另有不可配置可写字段
- 步骤：包装、读取/写入，调用原方法；构造非法字段类
- 预期：ref/this为原实例，#private方法可用；枚举性/只读保留；已有访问器和固定只读不变；不可配置可写字段TypeError含键
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-033 原始前置、步骤、预期</summary>

- 前置/数据：原实例字段被effect/watch/computed/Chip/Model使用
- 步骤：通过字段与Model修改；观察父/片段计数
- 预期：所有消费者见同一状态；片段/控件可独立更新，未读取字段的父不增render；外部手工订阅仍需stop
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-034 原始前置、步骤、预期</summary>

- 前置/数据：state/context/refs、PureComponent、props watch与busy字段
- 步骤：setState、context/props更新、业务任务开始完成
- 预期：React字段不被普通用户字段接管；各类更新正常；props去重不误屏蔽busy更新
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

<details><summary>REACT-035 原始前置、步骤、预期</summary>

- 前置/数据：类count/a/b和普通getter；普通原型方法连续写两次
- 步骤：用外部effect计数，调用普通方法；显式batch对照；重复读getter
- 预期：普通方法两次独立通知，显式batch一次；类getter不承诺computed缓存；不依赖动态新增/删除字段响应
- 计划位置：[test/cases/react.md](../../cases/react.md)

</details>

### Chip / Model

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| UI-001 / P0 | 四个片段工厂无副作用/身份稳定 / 通过 | 四工厂调用时零 children 执行；条件/列表挂载各一次，相同 key 重渲染不重挂载。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F23、D-REACT；补充条件/列表及相同key挂载次数 |
| UI-002 / P0 | A/B局部更新与父隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F23 |
| UI-003 / P1 | 普通Chip采纳新闭包 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F24 |
| UI-004 / P1 | Strict忽略父props但响应自身/context / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F24 |
| UI-005 / P0 | 分支/嵌套子组件/卸载隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F26 |
| UI-006 / P0 | Strict读取稳定props视图及派生值 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F25、F13 |
| UI-007 / P0 | Async首次fallback与最新数据 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F27 |
| UI-008 / P1 | Async未提交树与StrictMode / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F28 |
| UI-009 / P1 | 非同步children与失败render / 通过 | null/text/Fragment/array 同步 ReactNode 可用；自定义 thenable 被 TypeError 拒绝。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F29；补充合法ReactNode参数表及返回自定义thenable |
| UI-010 / P0 | useModel身份/重渲染/初值函数 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F14 |
| UI-011 / P0 | 普通target对象不是事件 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F14、F18 |
| UI-012 / P0 | Model/defineModel真实双向输入 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F15 |
| UI-013 / P0 | 一次写入与原回调顺序 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F15、F18 |
| UI-014 / P0 | 事件时重新定位嵌套目标 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F17 |
| UI-015 / P0 | Suspense事件配置仅取已提交版本 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F17 |
| UI-016 / P0 | 原生控件提取与null显示 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F16 |
| UI-017 / P1 | 自定义值/valueProp/完整参数 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F18 |
| UI-018 / P0 | 转换/写入/回调失败与净回退 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F19 |
| UI-019 / P1 | 合法属性位置矩阵 / 通过 | nested、数组 0、symbol、空键、缺失字段的真实 DOM input 事件均写到正确位置。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: X02；内部矩阵已覆盖，补充这些位置的真实Model事件集成 |
| UI-020 / P0 | 可写getter与一次setter / 通过 | Model DOM 输入触发可写 getter 的 setter 恰好一次，backing 字段正确。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: X03；白盒已覆盖，补充Model DOM集成 |
| UI-021 / P0 | 无效/只读/派生/歧义引用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: X04、F20 |
| UI-022 / P1 | 子element形状与valueProp校验 / 通过 | 非法元素形状、portal、file input、全部非法 valueProp（含 null）均拒绝；随后合法输入正常。D03 修复维持有效。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F20、F30；valueProp仅省略/undefined/value/checked合法，模型数据null仍合法；portal/多元素见补充脚本 |
| UI-023 / P0 | StrictMode重连与遗留handler失效 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F21、F14、F17 |
| UI-024 / P1 | SSR只输出受控值 / 通过 | SSR input/checkbox/select 输出正确，setter/callback 零执行；匹配 hydrate 后输入调用各一次，无 warning。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: R14、F20；补充Model专属SSR副作用计数与hydrate链路 |
| UI-025 / P1 | currentTarget/target与跨文档事件 / 通过 | 第二个 jsdom Window 的真实 Event：有效 currentTarget 优先，否则使用 target；结束后 currentTarget=null 不影响已取值；普通对象保留为数据。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | M: F3；用真实iframe或独立jsdom Window，捕获值与回调参数 |
| UI-026 / P1 | defineModel保持业务协议与挂载 / 通过 | defineModel 类控件保留 label/children/onChange(7,"kg")；相同 key 不重挂，换 key 按 React 重建。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F15、F18、T-REACT；补充类控件运行时和key重挂载 |

<details><summary>UI-001 原始前置、步骤、预期</summary>

- 前置/数据：chip/strictChip/asyncChip/asyncStrictChip传计数回调
- 步骤：在render外调用；条件/列表生成element；随后挂载
- 预期：工厂只创建element、不调用回调/Hook；type分别为对应组件；相同key保持组件身份
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-002 原始前置、步骤、预期</summary>

- 前置/数据：父只创建两个Chip，子回调分别读a/b；计数parent/A/B
- 步骤：改a；改b；同批a往返
- 预期：改a仅A更新、改b仅B更新；父不增render；净回退不更新片段
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-003 原始前置、步骤、预期</summary>

- 前置/数据：children捕获父普通label
- 步骤：父label A→B后提交，再改片段store
- 预期：采用B闭包，父更新造成一次正常片段更新，无自身props补渲染
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-004 原始前置、步骤、预期</summary>

- 前置/数据：Chip.Strict及strictChip；闭包label与reactive count/context
- 步骤：父换label；再改count/context；最后换key
- 预期：父更新被跳过的新闭包不替换旧闭包；count/context仍更新；换key后使用新label
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-005 原始前置、步骤、预期</summary>

- 前置/数据：Chip按flag读a/b，嵌套Chip与独立子组件；StrictMode
- 步骤：切flag，改旧/新分支，卸载后改值
- 预期：仅当前分支有效；子订阅不混入父；StrictMode最终一份有效订阅，卸载无回调
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-006 原始前置、步骤、预期</summary>

- 前置/数据：RC父props.count，Strict Chip读props与computed
- 步骤：父props更新并确认own-props来源
- 预期：Strict仍因响应式props/派生依赖更新；父去重不吞片段更新；终值正确
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-007 原始前置、步骤、预期</summary>

- 前置/数据：AsyncChip/AsyncChip.Strict，fallback文本；SSR和hydrate
- 步骤：SSR；客户端layout阶段读取；激活前改store；effect后读取
- 预期：SSR/首帧为fallback且children未执行/未订阅；effect后首次读最新值；默认工厂fallback为null
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-008 原始前置、步骤、预期</summary>

- 前置/数据：初次挂起/卸载的Async gate；StrictMode重放
- 步骤：激活前终止；另正常挂载、重连、更新
- 预期：未提交树不激活/不遗留订阅；正常重连可更新；无定时器或“等待网络Promise”语义
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-009 原始前置、步骤、预期</summary>

- 前置/数据：非函数、async函数、返回Promise/thenable；普通同步null/text/Fragment/array
- 步骤：分别render；抛错/挂起后改源
- 预期：非同步输入TypeError；失败候选不订阅；合法同步ReactNode正常渲染；回调内Hook不属于支持写法
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-010 原始前置、步骤、预期</summary>

- 前置/数据：字符串、布尔、对象、函数字面值模型，普通父+Chip
- 步骤：真实输入；提取onChange直接调用；直接写value；换initial重渲染
- 预期：模型和onChange稳定；初值函数作为数据不调用；当前值不重置；Chip更新而父不因Hook自动刷新
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-011 原始前置、步骤、预期</summary>

- 前置/数据：model对象值含target:{value:'data'}，另有函数值
- 步骤：onChange传对象/函数
- 预期：第一个参数完整作为新数据；不当事件读取target.value，不当React updater执行函数
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-012 原始前置、步骤、预期</summary>

- 前置/数据：state.name=Alice；单input含key/ref/data-*和defaultValue；另TextInput refer
- 步骤：挂载；输入Bob；外部设Carol
- 预期：初值Alice；两控件同步Bob/Carol；ref指同input且卸载清空；业务props保留；覆盖受控value并移除defaultValue，无受控警告
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-013 原始前置、步骤、预期</summary>

- 前置/数据：Model转换可计数；原onChange读state.name并写extra
- 步骤：派发一次事件
- 预期：转换一次→模型写一次→原回调一次且完整原参数；回调已见新值；extra写与模型同batch，仅最终一次业务通知
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-014 原始前置、步骤、预期</summary>

- 前置/数据：Model source=()=>state.user.name，保存稳定handler和旧user
- 步骤：同batch替换user，立刻handler('X')
- 预期：写当前user.name，旧user不变；不使用render时保存的过期位置
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-015 原始前置、步骤、预期</summary>

- 前置/数据：已提交first/old转换与callback；候选second/new挂起
- 步骤：候选期间调用旧handler；成功提交后再调用同handler
- 预期：未提交时只写first，用old转换/callback；提交后写second用new配置；handler身份稳定
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-016 原始前置、步骤、预期</summary>

- 前置/数据：checkbox(undefined,显式checked)、radio(false)、textarea(null)、单选、多选(undefined)、number(3)
- 步骤：挂载检查；click/input/change；number显式postValue
- 预期：checked=false、文本=''、多选=[]仅用于显示不回写；事件得布尔/字符串/字符串数组；数字显式转12；checkbox提交value保留
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-017 原始前置、步骤、预期</summary>

- 前置/数据：布尔value控件、对象控件、金额控件onChange(number,unit)
- 步骤：显式valueProp=value；传对象；defineModel转换4,'kg'为8
- 预期：布尔不误注入checked；对象按数据；转换/原回调完整参数；label等必填业务props保留
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-018 原始前置、步骤、预期</summary>

- 前置/数据：state.value=1；转换抛E、字段只读、callback抛E/恢复原值
- 步骤：四模式独立触发一次事件
- 预期：转换/写失败不调原callback；callback失败不回滚已写2；callback把3恢复2时本批无净通知；错误原样保留
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-019 原始前置、步骤、预期</summary>

- 前置/数据：nested.x、数组0、symbol、空键、缺失可扩展字段
- 步骤：对每项captureReference读取后write；挂载Model对照
- 预期：只写指定终端；0/空键不被当未绑定；可新增缺失字段；不按“值相同”猜测位置
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-020 原始前置、步骤、预期</summary>

- 前置/数据：reactive对象get/set name，getter内部读其他字段
- 步骤：captureReference/Model指向name；写新值
- 预期：setter只执行一次，getter内部读不劫持目标；正确更新backing字段和消费者
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-021 原始前置、步骤、预期</summary>

- 前置/数据：常量、raw属性、Computed缓存命中、只读props/getter、算术/多字段/不连续链、不可扩展缺失字段
- 步骤：每项捕获/Model渲染；失败后执行合法引用写入
- 预期：可识别非法表达式TypeError，无错写；收集/定位上下文恢复；不要求识别所有碰巧同值的运算，selector必须直接选择可赋值位置
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-022 原始前置、步骤、预期</summary>

- 前置/数据：null/text/数组/多个元素/Fragment/portal/file input；非法valueProp含null/空串/错误字符串/数值/布尔/对象
- 步骤：逐项渲染独立错误边界；再渲染单有效input
- 预期：非法形状/协议拒绝，file不尝试写value；合法单控件正常；错误不污染后续绑定
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-023 原始前置、步骤、预期</summary>

- 前置/数据：Model/useModel已提交并保留onChange
- 步骤：StrictMode setup/cleanup后输入；卸载；调用遗留handler
- 预期：重连可写；卸载后不改状态、不执行子原回调；真正新实例不被旧handler影响
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-024 原始前置、步骤、预期</summary>

- 前置/数据：SSR单input/checkbox/select及Model getter+setter计数；无window
- 步骤：renderToString；记录setter/callback；客户端同值hydrate再输入
- 预期：SSR输出当前值，setter/callback=0，无永久观察订阅；匹配hydrate无warning，提交后才能处理事件
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-025 原始前置、步骤、预期</summary>

- 前置/数据：来自另一个同源Document的input，真实Event或具备事件方法的参数
- 步骤：currentTarget有效时与target不同；currentTarget无效时target为原生控件；事件结束后检查
- 预期：调用期间同步读取有效currentTarget优先，否则target；用控件自身ownerDocument识别；普通数据对象保持原样
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

<details><summary>UI-026 原始前置、步骤、预期</summary>

- 前置/数据：自定义函数/类控件，必填label，value/onChange(number,unit)；保留key切换
- 步骤：外部值更新、输入、同key重渲染、换key；比较调用参数
- 预期：业务props/children正常；同key无意外重挂载；换key按React重建；不承诺HOC静态复制/React18 ref转发/任意泛型保真
- 计划位置：[test/cases/ui.md](../../cases/ui.md)

</details>

### 加载状态

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| LOAD-001 / P0 | 所有初值及乱序计数 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F03 |
| LOAD-002 / P1 | 返回对象/load稳定与初值不重置 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F03 |
| LOAD-003 / P0 | 普通值/Promise/thenable与只读外壳 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F04 |
| LOAD-004 / P0 | 业务同步/异步/then访问失败 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F04 |
| LOAD-005 / P0 | 开始/业务/结束多错误 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F05 |
| LOAD-006 / P0 | immediate/props watch可用句柄与最新函数 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F06 |
| LOAD-007 / P0 | 候选闭包隔离与在途固定 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F07 |
| LOAD-008 / P0 | 卸载停止发布/保留调用结果/新挂载独立 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F08 |
| LOAD-009 / P0 | StrictMode重连、SSR和双Hook隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F09 |
| LOAD-010 / P1 | 内部记账/业务读不泄漏依赖 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F10 |
| LOAD-011 / P0 | Suspense隐藏期间结算与恢复 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F11 |
| LOAD-012 / P0 | commit失败统一断开句柄 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F12 |
| LOAD-013 / P0 | props/Strict Chip/Model/load提交链 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: F13 |
| LOAD-014 / P1 | 非法初值/回调及首次提交前 / 通过 | 所有非法数值及非函数拒绝，MAX_SAFE_INTEGER 初值接受；首次 Suspense 未提交句柄拒绝且业务次数零。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F04、F09；补充非函数、-Infinity、未提交保留句柄及最大合法初值 |
| LOAD-015 / P0 | 导出边界 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L02、D-REACT、T-REACT |
| LOAD-016 / P0 | 布尔/数字字段基线 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L06 |
| LOAD-017 / P0 | 同字段多方法/互调共享token / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L06 |
| LOAD-018 / P1 | 动态this、参数和结果 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L06、T-REACT |
| LOAD-019 / P0 | 每次选择一次并固定字段 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L07 |
| LOAD-020 / P1 | 继承、多实例与Hook隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L07 |
| LOAD-021 / P0 | JS返回值、thenable、错误聚合 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L08 |
| LOAD-022 / P0 | selector拒绝非法定位/变更 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L09 |
| LOAD-023 / P1 | selector异常与追踪上下文恢复 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L09 |
| LOAD-024 / P0 | 非法数字、容量溢出及首次失败不锁模式 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L10 |
| LOAD-025 / P0 | 活动字段写保护 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L10 |
| LOAD-026 / P1 | 空闲基线调整与模式固定 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L10 |
| LOAD-027 / P0 | 通知回调重入与部分失败 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L11 |
| LOAD-028 / P1 | props/React原生状态并存 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L12 |
| LOAD-029 / P0 | componentDidMount可启动及StrictMode重连 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L13 |
| LOAD-030 / P0 | 隐藏树保留活动集合与空闲调整 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L14 |
| LOAD-031 / P0 | 卸载与新实例隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L15 |
| LOAD-032 / P0 | 构造/render/首次未提交/SSR禁调用 / 通过 | 同一类实例构造/render 调用拒绝；成功提交后相同方法返回 7，busy 正常归零。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: L16；禁止阶段已覆盖，补充同一实例合法事件恢复对照 |
| LOAD-033 / P0 | 挂载/提交失败和卸载抛错先断开 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L17 |
| LOAD-034 / P1 | 装饰目标/传统语法校验 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L18、T-REACT |
| LOAD-035 / P1 | symbol/空字符串字段与props监听 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) | A: L19 |

<details><summary>LOAD-001 原始前置、步骤、预期</summary>

- 前置/数据：initial分别省略/false/true/0/2；两个deferred
- 步骤：挂载不调用；load0、load1；先完成1再失败0
- 预期：不自动执行业务；stacks 0→1→2→1→0；数字loading=n+stacks；布尔最后false，初始true未调用前仍true
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-002 原始前置、步骤、预期</summary>

- 前置/数据：同一挂载、保存对象与解构load
- 步骤：开始两任务；父重渲染initial=99；完成
- 预期：对象/load严格同引用；不重置计数或模式；解构load不需要this
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-003 原始前置、步骤、预期</summary>

- 前置/数据：fn分别返回普通值、Promise、thenable
- 步骤：提交后调用load；检查返回与Reflect.set loading/stacksCount
- 预期：始终Promise<Awaited<R>>，值正确；外壳只读；不承诺原Promise身份
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-004 原始前置、步骤、预期</summary>

- 前置/数据：fn同步抛E、Promise.reject(E)、then getter抛E
- 步骤：逐项load并等待reject；随后成功调用
- 预期：单错误原对象；每次只释放本token；最终false/0，之后可成功，不永久loading
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-005 原始前置、步骤、预期</summary>

- 前置/数据：订阅者分别开始抛E1、结束抛E3；业务抛E2
- 步骤：load并捕获；关闭故障再调用
- 预期：业务仍启动；finally释放；AggregateError.errors=[E1,E2,E3]，无错误丢失；下次成功
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-006 原始前置、步骤、预期</summary>

- 前置/数据：组件先声明useWatch，随后useModel/useLoading；fn捕获label
- 步骤：首次immediate执行；props count/label更新
- 预期：setup前句柄已激活；首次A1!、下一次B2!；旧load引用使用最新已提交fn；Model同步可写
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-007 原始前置、步骤、预期</summary>

- 前置/数据：A提交后load1；B候选挂起；再load2；C成功提交后load3
- 步骤：统一释放等待Promise
- 预期：结果依次A1/A2/C3；B不泄漏；在途1不因C改用新函数；计数归零
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-008 原始前置、步骤、预期</summary>

- 前置/数据：numeric baseline2；一个在途请求，保存旧对象
- 步骤：卸载；调用遗留load；新挂载；完成旧请求42
- 预期：遗留调用拒绝且fn不启动；旧请求仍返回42；旧公开值冻结在断开时快照，新实例仍2/0，无跨实例发布
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-009 原始前置、步骤、预期</summary>

- 前置/数据：两个Hook，a初始true；layout只启动一次；SSR纯render
- 步骤：SSR；StrictMode挂载/清理/重连；完成a
- 预期：SSR业务调用0；重连不重复业务；a计数恢复真实未完成数，b不受影响；清理窗口调用拒绝
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-010 原始前置、步骤、预期</summary>

- 前置/数据：外层effect只显式读trigger并调用load；fn读other
- 步骤：完成；other++；trigger++
- 预期：other和loading内部发布不使外层重复执行；trigger变化才新调用
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-011 原始前置、步骤、预期</summary>

- 前置/数据：baseline2、任务未完；已挂载树同步挂起隐藏
- 步骤：隐藏后调用load；完成旧任务；恢复同树
- 预期：隐藏期间新调用拒绝；旧请求完成但公开计数不发布；重连刷新为2/0，不保留假请求
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-012 原始前置、步骤、预期</summary>

- 前置/数据：Model/loading创建后immediate useWatch抛E，ErrorBoundary兜底
- 步骤：挂载失败；调用遗留model.onChange与load
- 预期：Model无写入；load拒绝且业务调用0；不依赖后续尚未安装的React cleanup
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-013 原始前置、步骤、预期</summary>

- 前置/数据：props.count切到2；watch调用load(value×已提交count)并写name
- 步骤：更新props，等待请求，再输入Model
- 预期：load结果4，Strict Chip显示2:false，input=2；own-props确认不吞子更新，后续输入3写回
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-014 原始前置、步骤、预期</summary>

- 前置/数据：initial=-1/小数/NaN/±Infinity/超安全整数，fn非函数；首次render保存load后挂起；另仅挂载MAX_SAFE_INTEGER不启动任务
- 步骤：参数各独立SSR/挂载；调用未提交load；检查业务次数
- 预期：非法参数TypeError；首次提交前拒绝、不启动fn；最大安全整数作为初值可接受；不将未约定的累计溢出行为写成保证
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-015 原始前置、步骤、预期</summary>

- 前置/数据：React子入口与根入口
- 步骤：检查loading导出；类型层从根尝试导入
- 预期：仅React入口有loading；根入口不泄漏；十九个React导出准确
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-016 原始前置、步骤、预期</summary>

- 前置/数据：RC类busy初值false/true/0/3，原型async方法
- 步骤：提交后调用/等待；记录方法同步部分看到的busy
- 预期：开始即见true或n+1；结束布尔false、数字回n；未调用的true保留；不额外返回Hook状态对象
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-017 原始前置、步骤、预期</summary>

- 前置/数据：方法fetch和other共用busy；other调用fetch
- 步骤：同时直接fetch0及other1；先完成1后0
- 预期：other及内层fetch各登记token，总并发3；完成1释放其两层，仍保留0的token；最后回基线
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-018 原始前置、步骤、预期</summary>

- 前置/数据：方法含必填/默认/rest参数
- 步骤：instance.method、call、bind；另解构后无receiver调用
- 预期：this为原实例，参数/成功值保留；无receiver拒绝，不自动bind；返回Promise不要求身份相同
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-019 原始前置、步骤、预期</summary>

- 前置/数据：selector由闭包选择left或right且计次
- 步骤：调用A选择left；切选择right开始B；乱序完成
- 预期：每次source仅1次，完成时不重选；各自归还原字段token，不因闭包变化串字段
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-020 原始前置、步骤、预期</summary>

- 前置/数据：父类装饰方法，子类super，两个实例和独立useLoading
- 步骤：启动并交错完成三任务
- 预期：实例/字段/Hook计数互相独立；继承结果与this保留
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-021 原始前置、步骤、预期</summary>

- 前置/数据：运行时桥接普通值/thenable/同步抛/拒绝/then getter；状态订阅抛
- 步骤：逐项调用；开始+业务+结束同时失败；再恢复
- 预期：普通值/thenable按await；每token释放；单E原样；多错按开始/业务/结束顺序；业务不被开始发布失败阻断
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-022 原始前置、步骤、预期</summary>

- 前置/数据：常量、缺字段、取反、多次/多字段读、nested、getter、readonly、props/state、调用方法；set/delete/define/枚举等
- 步骤：每项独立调用装饰方法，记录业务次数/字段
- 预期：可识别非法表达式TypeError且业务0次；临时ctx只读；不把ctx当业务this；字段保持初值
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-023 原始前置、步骤、预期</summary>

- 前置/数据：source读后抛E；外部effect/Model引用捕获中调用；字段之后被重定义
- 步骤：修复selector合法调用；改旁路字段；重定义被管理字段再调用
- 预期：source E保真；合法调用恢复；内部/业务同步读不污染外层依赖或引用；重定义字段被拒绝
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-024 原始前置、步骤、预期</summary>

- 前置/数据：initial=NaN/Infinity/-1/0.5/MAX_SAFE_INTEGER；另MAX_SAFE_INTEGER-1
- 步骤：分别调用；非法首次后改0重试；边界已占一token再启动第二个
- 预期：非法值TypeError/容量RangeError在业务前；无token泄漏；修复可调用；再启动会溢出时拒绝且原请求计数不变
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-025 原始前置、步骤、预期</summary>

- 前置/数据：stack请求在途；持有实例与Model handler
- 步骤：直接赋0、Model赋0、引用write0；同值写；模式改布尔
- 预期：不同值/模式在修改前抛错；业务原token不受影响；同值写安全，不追加通知
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-026 原始前置、步骤、预期</summary>

- 前置/数据：首组完成后stack为数字基线
- 步骤：空闲改5并发下一组；再写负数或布尔；布尔组对照
- 预期：下一组从5计数并回5；非法值/跨模式拒绝；未被loading使用的普通字段不加此限制
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-027 原始前置、步骤、预期</summary>

- 前置/数据：watch stack==1时发第二请求
- 步骤：启动第一；第二失败；第一成功
- 预期：token先登记再发布，观察序列0→1→2→1→0；第二失败不释放第一；无重复减计数
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-028 原始前置、步骤、预期</summary>

- 前置/数据：PureComponent，state/context/refs，busy字段与props watch
- 步骤：更新props及state/context；加载开始/结束
- 预期：props正常一次更新；原生机制正常；loading变化仍可刷新，不被去重/SCU屏蔽
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-029 原始前置、步骤、预期</summary>

- 前置/数据：用户didMount中有防重复条件；子layout改count
- 步骤：StrictMode挂载/断开/重连；完成任务
- 预期：didMount调用合法；库不重复业务；字段窗口变化补齐；任务与普通字段后续都响应
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-030 原始前置、步骤、预期</summary>

- 前置/数据：数字基线2；三个分支：隐藏时仍active、已settled、settled后手改5
- 步骤：隐藏后尝试新调用；按分支完成/调整；恢复同实例
- 预期：隐藏不发布或forceUpdate，新调用拒绝；恢复分别显示3/2/5；不会重新执行业务；最终基线正确
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-031 原始前置、步骤、预期</summary>

- 前置/数据：旧实例请求在途，外部watch旧busy
- 步骤：卸载；旧实例再调用；新挂载；完成旧请求
- 预期：旧调用拒绝；旧请求仍兑现；不发布旧busy结束值、不更新新实例；新实例初值false
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-032 原始前置、步骤、预期</summary>

- 前置/数据：装饰方法业务次数计数；构造和render中尝试；SSR/hydration/首次Suspense
- 步骤：所有拒绝Promise由测试捕获；正常提交后合法事件调用对照
- 预期：拒绝无业务调用、无假loading；SSR保留初值；识别到render上下文时拒绝；合法提交后可用
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-033 原始前置、步骤、预期</summary>

- 前置/数据：didMount启动请求后抛E，willUnmount也抛；forceUpdate计数
- 步骤：ErrorBoundary处理；旧实例改count、调用run、完成在途
- 预期：观察/连接已同步释放；旧run拒绝；完成不发布/forceUpdate；用户清理异常不留下库订阅
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-034 原始前置、步骤、预期</summary>

- 前置/数据：static/getter/arrow/render/lifecycle/constructor、重复装饰、Stage3、未RC类
- 步骤：应用装饰器或调用方法
- 预期：不支持目标TypeError，重复/Stage3明确失败；未包装类调用拒绝；普通业务原型方法合法
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

<details><summary>LOAD-035 原始前置、步骤、预期</summary>

- 前置/数据：RCC类symbol布尔字段和空键数字2；props watch启动两任务
- 步骤：props count1→2；观察字段/forceUpdate/结果；完成
- 预期：symbol/空键均可定位；已提交props回调可启动；自身props不额外通知，加载字段必要更新保留
- 计划位置：[test/cases/loading.md](../../cases/loading.md)

</details>

### 类型与发布

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| PKG-001 / P0 | 源码和测试编译 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: BUILD、T-CORE、T-REACT |
| PKG-002 / P0 | reactive/batch/类构造泛型 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-CORE |
| PKG-003 / P0 | Computed只读.value迁移 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-CORE |
| PKG-004 / P1 | watch/useWatch immediate重载 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-CORE、T-REACT |
| PKG-005 / P0 | storage结构类型、无DOM依赖 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-CORE |
| PKG-006 / P1 | localforage薄包装 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-LF、T-CORE |
| PKG-007 / P0 | React组件类型与Hook命名 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-REACT |
| PKG-008 / P1 | Chip/Model/defineModel类型 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-REACT |
| PKG-009 / P1 | useLoading类型 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-REACT |
| PKG-010 / P1 | @loading传统方法类型 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: T-REACT |
| PKG-011 / P0 | 构建布局与两个Node桥 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: BUILD、PKG |
| PKG-012 / P0 | 公开导出准确、纯CJS可用 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: D-CORE、D-REACT |
| PKG-013 / P0 | 混合入口共享内核/绑定 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: D-CORE、D-STORAGE、D-REACT |
| PKG-014 / P0 | 真实tarball与可选依赖隔离 / 通过 | 本轮完整主套件及对应类型/产物检查的直接断言通过。按原 A 映射核对；并不据此推定未声明平台或任意参数全部通过。 [npm-test.log](evidence/npm-test.log) · [dist.log](evidence/dist.log) · [package-archived.log](evidence/package-archived.log) | A: PKG |
| PKG-015 / P1 | README示例与迁移说明可执行 / 通过 | 逐段提取 README 的 26 个可执行代码块，严格类型和运行断言全部通过；fetch/localforage 示例用可控夹具。 [readme-types.log](evidence/readme-types.log) · [readme-runtime-final.log](evidence/readme-runtime-final.log) | P: T-LF、D-CORE、D-REACT；需逐个摘录README示例完整复跑 |
| PKG-016 / P1 | 内部API/深导入不可误发布 / 通过 | 真实 tarball 的 require/import 深路径均 ERR_PACKAGE_PATH_NOT_EXPORTED；内部符号未公开，90 文件白名单通过。 [package-archived.log](evidence/package-archived.log) | P: T-CORE、PKG；补充安装包深路径运行时拒绝断言 |

<details><summary>PKG-001 原始前置、步骤、预期</summary>

- 前置/数据：当前锁定依赖；strict、experimentalDecorators
- 步骤：npm test中的typecheck/typecheck:test/typecheck:react
- 预期：全部退出0；noUnusedLocals/noImplicitOverride等配置有效；没有以any绕过公共API类型
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-002 原始前置、步骤、预期</summary>

- 前置/数据：types/esm.mts、commonjs.cts；对象和装饰类
- 步骤：核对对象属性、构造参数、方法参数、batch返回推断；负例错误赋值/构造
- 预期：.mts/.cts保持精确类型；错误用法产生预期诊断，不退化为any
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-003 原始前置、步骤、预期</summary>

- 前置/数据：computed.mts/.cts
- 步骤：正例标量/对象/undefined/函数/嵌套；反例value赋值、computed()旧调用、watch(computed)
- 预期：value类型T正确，仅外壳只读；负例有错；watch要求读取闭包
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-004 原始前置、步骤、预期</summary>

- 前置/数据：缺省/false/true/boolean变量/WatchOptions或undefined
- 步骤：编译new/old推断和不处理undefined的负例
- 预期：默认/false旧值T；可能immediate时旧值T或undefined；void可用；错误callback类型与选项拒绝；useWatch返回void
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-005 原始前置、步骤、预期</summary>

- 前置/数据：storage.mts/.cts；lib ES2022、types=[]；sync/async/PromiseLike adapter
- 步骤：编译对象/数组推断；缺name、错type、根基本值、坏getter/setter返回等负例
- 预期：状态保留T；正例全部通过；反例确有诊断；无需DOM/React/localforage声明
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-006 原始前置、步骤、预期</summary>

- 前置/数据：开发依赖localforage；getItem<string>，async setItem等待后void返回
- 步骤：typecheck:test包含storage-localforage.ts；错误直接Promise<string> setter对照
- 预期：推荐包装可编译，错误返回类型被拒绝；不据此声称真实IndexedDB已验证
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-007 原始前置、步骤、预期</summary>

- 前置/数据：18/19匹配类型；esm/commonjs/jsx
- 步骤：编译RC/RFC必填props、RCC构造/ref/静态；useReactive对象返回；旧useState导入负例
- 预期：JSX必填属性保留；不返回tuple；旧useState未导出；各别名类型一致
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-008 原始前置、步骤、预期</summary>

- 前置/数据：features.mts/.cts/.tsx；文本/布尔/数组/数字模型、带label的控件
- 步骤：正反例编译：children函数、source/refer、postValue返回、完整tuple、必填业务props、数字事件
- 预期：支持输入通过；数字model直接传DOM事件拒绝；错误转换/缺props拒绝；onChange只读
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-009 原始前置、步骤、预期</summary>

- 前置/数据：fn必填/多参数/同步值/Promise；初始true/false/0/2/联合类型
- 步骤：推断load返回与loading类型；写stacksCount、错参数、误认为常量类型的负例
- 预期：返回Promise<Awaited<R>>；参数tuple保持；布尔/数字拓宽，联合保持；状态只读
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-010 原始前置、步骤、预期</summary>

- 前置/数据：loading.mts/.cts/.tsx，显式泛型/ctx注解/简写
- 步骤：编译可选/rest/泛型/重载/继承/静态成员/JSX；同步方法/箭头/getter/错字段负例
- 预期：方法签名保留；类型层拒绝同步方法等；显式ctx类型检查拼写；不要求简写反推完整类字段
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-011 原始前置、步骤、预期</summary>

- 前置/数据：dist允许重建；使用当前tsconfig
- 步骤：npm run build；检查esm/cjs所有js/d.ts及cjs/package.json和node.js/node-react.js
- 预期：产物齐全；CJS目录type=commonjs；桥接导出与源码一致，target ES2022；只清理项目生成目录
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-012 原始前置、步骤、预期</summary>

- 前置/数据：构建完成；ESM/CJS消费者
- 步骤：test:dist；CJS加--no-experimental-require-module
- 预期：根恰reactive/effect/computed/batch/watch/storage；React十九个及别名准确；require不依赖实验性加载ESM
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-013 原始前置、步骤、预期</summary>

- 前置/数据：Node import核心+require React、反方向；同raw/Computed/storage
- 步骤：对比API引用、proxy身份；跨格式订阅/批次/存储/组件；另独立运行原生ESM图
- 预期：Node两个方向共用内核和绑定；原生ESM核心与React配套使用成功；不混用原生ESM与Node桥而要求同内核
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-014 原始前置、步骤、预期</summary>

- 前置/数据：test:package联网；临时core-only/react18/react19消费者
- 步骤：dry-run白名单→实际pack/install→行为和类型；安装前全局window/storage getter抛错；清空NODE_PATH
- 预期：核心无React/DOM/localforage也成功；模块导入不读浏览器全局；React18/19完整行为均通过；包仅dist/README/package/LICENSE，当前90文件
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-015 原始前置、步骤、预期</summary>

- 前置/数据：README核心、装饰器、storage/localforage、RC、Model、两loading示例
- 步骤：复制至最小TS/TSX消费者；fetch示例用可控mock；按例操作；核对.value/useReactive名称
- 预期：示例类型及结果与文档一致；无旧computed()/库useState残留；依赖安装说明准确，不进行真实网络业务请求
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

<details><summary>PKG-016 原始前置、步骤、预期</summary>

- 前置/数据：六/十九导出列表；stopStorage/toRaw/captureReference等内部符号；exports只有根和/react
- 步骤：类型负例导入内部符号；安装包尝试受exports限制的深路径；检查无源码/测试/工作区私有文件入包
- 预期：公共入口不导出内部符号；未声明子路径按Node exports拒绝；包文件遵循白名单，测试文档不进入发布包
- 计划位置：[test/cases/package.md](../../cases/package.md)

</details>

### 兼容性与质量

| ID / 优先级 | 目标 / 状态 | 本轮实际与证据 | 原自动化映射 |
| --- | --- | --- | --- |
| QUAL-001 / P1 | 三引擎真实表单与局部更新 / 未执行 | 三引擎 × React 18/19 × dev/prod 共 12 组常规表单、Unicode/emoji、Chip、乱序 loading 通过。系统级 IME 与真实系统剪贴板粘贴未执行；insertText 仅是自动化文本输入，整行不能算通过。Windows Firefox 启动阻塞，Firefox 结果来自 Linux。 [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) | M: 真实浏览器交互；留事件序列、录像/截图与console |
| QUAL-002 / P1 | 原生local/session刷新与边界 / 通过 | 原生 local/session 同页刷新、独立新标签、关闭原标签后重开；local 共享且 session 隔离；跨页修改不自动同步内存。 [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) | M: 浏览器Storage面板与刷新日志；浏览器复制标签行为须单独记录 |
| QUAL-003 / P1 | 浏览器禁止存储/配额/恢复 / 通过 | 真实浏览器环境注入 SecurityError / QuotaExceededError，内存可继续编辑，恢复后写入成功；没有实际填满磁盘或修改用户浏览器权限。 [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) | P: B04、B05；补充真实浏览器策略与配额环境 |
| QUAL-004 / P1 | 真实localforage/IndexedDB / 通过 | 强制 asyncStorage/IndexedDB 驱动，保存 JSON 字符串、纯刷新恢复、迟到读取与本地编辑冲突、写失败恢复及 maxActive=1 通过。 [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) | P: T-LF、S11、S15；当前只有类型/模拟adapter，真实驱动待执行 |
| QUAL-005 / P1 | 真浏览器SSR/hydration及请求隔离 / 通过 | Node HTTP SSR 独立 A/B 请求；浏览器等待提交后 hydrate 更新及启用 storage；匹配无错误，不匹配负对照产生预期错误。SSR 夹具为 React 19 的简单 p 元素，18/19 客户端均验证；既有包级 SSR 在各自 React major 内执行。 [browser-results.json](evidence/browser-results.json) · [browser-results-linux-firefox.json](evidence/browser-results-linux-firefox.json) | P: R14、L16、F27；补充真实服务/浏览器和双请求 |
| QUAL-006 / P1 | 同包跨OS与打包器消费 / 未执行 | Windows 与 Ubuntu/WSL Node 24 完整基线及安装包测试通过；相同 Windows tarball 在 Linux 消费成功；esbuild 0.28.2 dev/prod 和原生浏览器 ESM 通过。macOS/Safari 未验证，若将它们纳入发布目标仍须追加验收。 本行保守记未执行：Windows/Linux 子项已通过，macOS 子项未完成；不代表已执行环境失败。 [linux-test.log](evidence/linux-test.log) · [linux-build.log](evidence/linux-build.log) · [linux-dist.log](evidence/linux-dist.log) · [linux-package.log](evidence/linux-package.log) · [linux-tarball-core.log](evidence/linux-tarball-core.log) | M: 归档每环境退出码、构建配置、依赖锁与包散列 |
| QUAL-007 / P2 | 代理/缓存/通知性能 / 通过 | 3 次预热 + 10 次计时；computed 100k 读取只求值 1 次；10k 写入普通/batch 通知 10000/1；10k 无关订阅只有目标字段 1 次通知。 [benchmark-after-1.json](evidence/benchmark-after-1.json) · [benchmark-after-2.json](evidence/benchmark-after-2.json) · [supplement-core.log](evidence/supplement-core.log) | M: Node performance.now与次数断言，按本页门槛评审 |
| QUAL-008 / P2 | 稀疏数组和深层图资源边界 / 通过 | length=1e9、3 个自有索引截断通过；深度 100/1000 代理与 JSON 存储通过，未推导无限深度支持。 [benchmark-after-2.json](evidence/benchmark-after-2.json) | P: N40；补充规模/耗时和递增深度资源观察 |
| QUAL-009 / P1 | 存储扫描/等待队列有界 / 通过 | 1k/10k 字段 × 同步批量/同步逐次/异步在途 × 5 轮，每轮 10k 编辑；写入数 1/10000/2，异步 maxActive=1，最终 JSON 正确。 [resources.json](evidence/resources.json) | P: S15、S16；补充高频压力和堆/队列有界证据 |
| QUAL-010 / P1 | stop/unmount长期订阅清理 / 通过 | 1000 轮 effect/watch 创建与停止、React 19 源码和 React 18 实际包各 1000 轮 RC/Chip/Model/loading 挂载卸载通过；各存 3 份堆快照。独立 derived GC 套件 ESM/CJS 各 9 项通过，D02 未复现。堆大小仅作诊断，不构成绝对无泄漏证明。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) · [gc-esm.log](evidence/gc-esm.log) · [gc-cjs.log](evidence/gc-cjs.log) · [memory.json](evidence/memory.json) | M: N70；生命周期循环脚本、业务计数、至少3次堆快照对比；派生回收与活动订阅对照见 derived-lifecycle.mjs |
| QUAL-011 / P2 | storage弱引用/共享子图回收 / 通过 | 两组各 1000 个 storage 根：共享 child 保留/异步 I/O 完成后，多轮 GC 均 0 根存活；仅作诊断证据，不承诺 GC 时限。 [memory.json](evidence/memory.json) · [heap-canaries.json](evidence/heap-canaries.json) | M: Node --expose-gc诊断或浏览器堆；仅测试弱引用生命周期 |
| QUAL-012 / P1 | 固定种子属性/批次模型测试 / 通过 | 种子 1～100 × 1000 外层批次，实际 300040 个 set/delete 操作，嵌套 batch、NaN、±0、属性存在性及简单数组全部与独立 JS 模型一致。 [supplement-core.log](evidence/supplement-core.log) · [derived-model.json](evidence/derived-model.json) | M: 新增独立模型脚本后执行；目前未实现此随机套件 |
| QUAL-013 / P0 | 数据污染/异常后可恢复的组合 / 通过 | 18 组危险键编码/解码与继承 setter、会抛错的 logger，修复后正常保存；多 store 错误隔离对照通过。 [supplement-core.log](evidence/supplement-core.log) | P: S19、S20、S21、S23；补充完整三键方向组合及多store对照 |
| QUAL-014 / P0 | 用户完整编辑/加载/持久化链路 / 通过 | Model 中文编辑、watch mirror、count 2→3 / computed 6、两任务乱序成功/失败、落盘重载和卸载后继续持久化通过。 [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: F01、F02、F13；补充多模块完整链路与重载 |
| QUAL-015 / P1 | 失败隔离与后续连续运行 / 通过 | 50 轮 adapter/watch 错误与恢复，以及 React 18/19 多 RC 与多 watch 并行对照；正常实例无漏更新，原 callback 错误保真。 [supplement-core.log](evidence/supplement-core.log) · [supplement-react.log](evidence/supplement-react.log) · [supplement-react18.log](evidence/supplement-react18.log) | P: N12、S20、L08；补充反复故障及并行消费者组合 |
| QUAL-016 / P2 | 文档与交付可复现 / 未执行 | validate-docs 通过；Linux 隔离 npm ci 和 tarball 消费通过。计划要求未参与开发的测试人员进行独立交付演练，该人工验收未执行。 [docs.log](evidence/docs.log) · [linux-ci.log](evidence/linux-ci.log) | M: 独立交付演练及文档校验日志 |

<details><summary>QUAL-001 原始前置、步骤、预期</summary>

- 前置/数据：目标Chromium/Firefox/WebKit确切版本；React18/19各一页面；Model/Chip/加载按钮
- 步骤：输入中文/emoji、粘贴、IME组合输入；切checkbox/单/多选；数字输入清空；只改Chip A；启动两个任务乱序完成
- 预期：最终model、DOM、回调参数一致；文本不丢/截断，依React事件语义不凭空重复转换；数字空值由显式postValue策略处理；父/兄弟更新符合用例；无非预期warning
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-002 原始前置、步骤、预期</summary>

- 前置/数据：专用同源页面与key；local/session分别写不同值
- 步骤：修改后刷新同页；新建独立标签页；关闭对应会话后重新访问；另一页改local
- 预期：同页恢复各自记录；local跨页可读，session按浏览器会话语义隔离；库不自动监听跨标签更新，不期待实时合并
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-003 原始前置、步骤、预期</summary>

- 前置/数据：专用测试origin；权限阻断或受控抛SecurityError/QuotaExceededError；不写满真实用户空间
- 步骤：初始化失败；仍编辑；恢复权限/后端；显式重建或新变化
- 预期：内存持续工作；诊断阶段正确；读失败不立刻覆盖；恢复按公开规则继续；无无限重试/假成功
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-004 原始前置、步骤、预期</summary>

- 前置/数据：独立数据库、强制IndexedDB驱动，F1包装
- 步骤：首次无缓存→编辑→等待adapter完成→刷新恢复；延迟get期间编辑；模拟set拒绝后恢复
- 预期：实际后端为IndexedDB；保存JSON字符串不二次编码；刷新等值；本地优先和单写在途成立；Promise<void>包装正确
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-005 原始前置、步骤、预期</summary>

- 前置/数据：SSR服务每请求新store；A/B不同初值；匹配客户端快照；持久化在hydrate后接入
- 步骤：并发请求A/B，hydrate；提交后启用storage；更新/卸载；另做不匹配快照负对照
- 预期：A/B无串数据；匹配快照无hydration警告；SSR无订阅/自动任务；负对照警告归应用初值不一致，不假称库自动解决
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-006 原始前置、步骤、预期</summary>

- 前置/数据：同一tarball；Linux Node24，目标macOS；团队实际构建工具固定版本
- 步骤：各运行完整基线命令；浏览器production bundle中导入两入口；查看产物解析
- 预期：无路径大小写/扩展名/模块解析问题；浏览器不选Node专用桥；production UI行为一致；无React核心消费者仍可用
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-007 原始前置、步骤、预期</summary>

- 前置/数据：固定机器；1k/10k字段，getter计数，10k写
- 步骤：计时首proxy、深层首次/重复读；computed连读100k次；batch与不batch各写10k次
- 预期：未读不求值；未失效重复读getter只1次；单effect未batch 10k净写对应10k通知，batch仅1次；无与无关字段订阅规模相同的通知膨胀；记录性能基线
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-008 原始前置、步骤、预期</summary>

- 前置/数据：length=1e9、自有索引3个；深度100/1000对象，禁止序列化超大稀疏数组
- 步骤：核心数组length缩短；只对可控小体积图存储；逐级读取深层对象
- 预期：核心截断与真实索引数关联，不遍历1e9孔洞；无异常长阻塞；深度结果如实记录；不推导无限深JSON能力
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-009 原始前置、步骤、预期</summary>

- 前置/数据：1k/10k字段，5轮每轮10k编辑；set一直pending至轮末
- 步骤：同步batch、未batch、异步在途分别测；轮末完成请求
- 预期：同绑定maxActive=1；异步等待只留最终快照，未因1万次编辑积累1万次set；最后磁盘等最新JSON；扫描耗时/输出大小独立记录
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-010 原始前置、步骤、预期</summary>

- 前置/数据：预热；1,000轮创建/停止effect/watch及挂载/卸载RC/Chip/Model/loading；每轮完成deferred
- 步骤：每轮结束再写旧源/调旧handler；每100轮记录计数和堆
- 预期：停止后回调0、卸载后库发布0；新实例正常；无随轮数增加的活跃监听；若堆增长检查保留链后再判泄漏
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-011 原始前置、步骤、预期</summary>

- 前置/数据：两组：丢弃根但保留共享child；丢弃根且I/O最终完成；测试不得保留根于日志/数组
- 步骤：循环创建不同key的root、丢弃引用；完成I/O；诊断环境允许时触发GC、抓堆
- 预期：不以单次未GC判失败；若控制器经长期强引用不可回收则报泄漏，保留链可复现；不得依赖FinalizationRegistry触发保证正确性
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-012 原始前置、步骤、预期</summary>

- 前置/数据：种子1～100，每种子1,000步；操作set/delete/nested batch；数据限纯标量/简单数组
- 步骤：普通JS模型与proxy执行同操作；每外层批次保存前后自有描述符；读固定字段的effect记录
- 预期：终态与JS模型一致；按Object.is/存在性预测通知；同批回退零通知；失败保存seed/序列，缩减最小复现；不让预测模型调用库内部函数
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-013 原始前置、步骤、预期</summary>

- 前置/数据：初值含合法数据；缓存根/嵌套/数组元素注入三危险键；日志收集器可抛
- 步骤：对编码/解码矩阵执行，再换合法数据和正常logger；执行其他store与effect
- 预期：原型不变、好记录未被坏快照覆盖、无半恢复；修复后保存/通知；一个store失败不影响另一个；诊断不主动附完整状态
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-014 原始前置、步骤、预期</summary>

- 前置/数据：外部storage{name:'A',count:1}；RC显示computed double；Model编辑name；useWatch派生mirror；useLoading加载数据
- 步骤：改name为中文；batch count2→3；两load乱序成功/失败；等adapter落盘后重载；卸载后改外部store
- 预期：名称/3/6及mirror、回调旧值正确；加载数归零；最终JSON等内存投影；重载恢复；卸载只停UI；不自动套用“最后请求胜出”业务规则
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-015 原始前置、步骤、预期</summary>

- 前置/数据：多store、多RC、多个watch；故障仅作用于一个adapter/一个callback
- 步骤：连续50轮注入错误→捕获→修复；其他实例每轮持续写入
- 预期：原错误/聚合顺序可定位，无未处理拒绝；正常实例没有漏更新；失败实例修复后可恢复；无跨实例状态污染
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

<details><summary>QUAL-016 原始前置、步骤、预期</summary>

- 前置/数据：一名未参与开发的测试人员，干净Node24环境，仅本交付包
- 步骤：按计划装依赖、跑自动化、定位一个失败和一个P/M用例、填报告；运行validate-docs
- 预期：无需口头补充即可定位源测试/预期/命令；链接有效、ID唯一、181项均映射；缺信息登记文档缺陷；不把P/M当自动通过
- 计划位置：[test/cases/quality.md](../../cases/quality.md)

</details>

