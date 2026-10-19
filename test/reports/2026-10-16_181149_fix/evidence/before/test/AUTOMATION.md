# 现有自动化测试索引

由 `node test/validate-docs.mjs --inventory` 从当前源码生成。编号是本次交付的定位编号，不是新增的测试。增删测试后需同步检查用例映射。

运行说明见 [测试计划](TEST_PLAN.md)，详细场景见 [测试用例入口](TEST_CASES.md)，本次实测结果见 [基线记录](BASELINE.md)。

共 181 个 node:test 声明。一个声明可能覆盖多组输入；数量不是代码覆盖率，也不等于详细用例数量。

| 编号 | 测试源码及当前行号 | 原始测试标题 | 执行入口 |
| --- | --- | --- | --- |
| N01 | [test.ts](test.ts)：9 | effects run immediately and track only the properties they read | `npm run test:node` |
| N02 | [test.ts](test.ts)：21 | effects replace conditional dependencies and restore nested collection | `npm run test:node` |
| N03 | [test.ts](test.ts)：42 | stopping is idempotent and can remove queued or currently running effects | `npm run test:node` |
| N04 | [test.ts](test.ts)：62 | Object.is and raw/proxy normalization determine changes | `npm run test:node` |
| N05 | [test.ts](test.ts)：75 | missing properties, additions, deletions and failed writes retain JS semantics | `npm run test:node` |
| N06 | [test.ts](test.ts)：90 | deep proxies are stable, support cycles and discard replaced dependencies | `npm run test:node` |
| N07 | [test.ts](test.ts)：107 | nested batches use one baseline, deduplicate effects and return their result | `npm run test:node` |
| N08 | [test.ts](test.ts)：127 | net property state includes existence and treats restored values as unchanged | `npm run test:node` |
| N09 | [test.ts](test.ts)：140 | batch keeps active tracking and initial effects run immediately inside it | `npm run test:node` |
| N10 | [test.ts](test.ts)：154 | empty batches and invalid arguments | `npm run test:node` |
| N11 | [test.ts](test.ts)：163 | failed initial effects leave no subscriptions and restore tracking | `npm run test:node` |
| N12 | [test.ts](test.ts)：175 | batch and notification errors preserve every cause and the queue recovers | `npm run test:node` |
| N13 | [test.ts](test.ts)：193 | effects can start new batches while flushing and can run again later in the queue | `npm run test:node` |
| N14 | [test.ts](test.ts)：205 | setters batch backing fields, preserve errors and never evaluate getters for comparison | `npm run test:node` |
| N15 | [test.ts](test.ts)：223 | computed is lazy, cached and only reevaluates when read | `npm run test:node` |
| N16 | [test.ts](test.ts)：239 | computed tracks its own branches without leaking source dependencies to consumers | `npm run test:node` |
| N17 | [test.ts](test.ts)：250 | source, chain and diamond consumers observe one fresh result per batch | `npm run test:node` |
| N18 | [test.ts](test.ts)：263 | intermediate computed reads are current and a reverted batch does not notify | `npm run test:node` |
| N19 | [test.ts](test.ts)：279 | settlement preserves an already computed final cache with the same dependencies | `npm run test:node` |
| N20 | [test.ts](test.ts)：299 | restoring computed branches does not miss a net change on the original branch | `npm run test:node` |
| N21 | [test.ts](test.ts)：318 | changes on temporary computed branches do not notify and original dependencies recover | `npm run test:node` |
| N22 | [test.ts](test.ts)：338 | a pure branch round trip restores original dependencies even without a post-batch read | `npm run test:node` |
| N23 | [test.ts](test.ts)：353 | computed-to-computed branch restoration restores both sides of every subscription | `npm run test:node` |
| N24 | [test.ts](test.ts)：375 | new computed nodes use their first evaluation as the batch dependency baseline | `npm run test:node` |
| N25 | [test.ts](test.ts)：389 | computed restoration does not revive stopped consumers | `npm run test:node` |
| N26 | [test.ts](test.ts)：405 | source net changes notify even when a computed result is equal | `npm run test:node` |
| N27 | [test.ts](test.ts)：414 | computed errors are retried, contexts recover and circular reads fail clearly | `npm run test:node` |
| N28 | [test.ts](test.ts)：436 | computed dependencies restore on a throwing batch and future updates still work | `npm run test:node` |
| N29 | [test.ts](test.ts)：454 | object getters are lazy computed values and setters invalidate their backing fields | `npm run test:node` |
| N30 | [test.ts](test.ts)：479 | prototype getters are cached by receiver and work across a proxied prototype | `npm run test:node` |
| N31 | [test.ts](test.ts)：494 | deleting and replacing an own getter notifies its property consumers | `npm run test:node` |
| N32 | [test.ts](test.ts)：516 | fixed references and getter-less accessors respect proxy invariants | `npm run test:node` |
| N33 | [test.ts](test.ts)：534 | writes through a proxy in the prototype chain do not notify the parent object | `npm run test:node` |
| N34 | [test.ts](test.ts)：549 | built-ins are returned unchanged while replacing their containing property notifies | `npm run test:node` |
| N35 | [test.ts](test.ts)：570 | proxy eligibility does not evaluate custom tags or reject own class tag fields | `npm run test:node` |
| N36 | [test.ts](test.ts)：586 | symbol properties and null-prototype objects are reactive | `npm run test:node` |
| N37 | [test.ts](test.ts)：596 | array indices, implicit length growth and truncation notify the affected readers | `npm run test:node` |
| N38 | [test.ts](test.ts)：617 | array batch round trips compare indices and length independently | `npm run test:node` |
| N39 | [test.ts](test.ts)：634 | array length computed values stay fresh inside a batch | `npm run test:node` |
| N40 | [test.ts](test.ts)：651 | sparse truncation visits real indices and ignores noncanonical array index properties | `npm run test:node` |
| N41 | [test.ts](test.ts)：666 | batched splice merges its writes without replacing native array methods | `npm run test:node` |
| N42 | [test.ts](test.ts)：675 | @reactive preserves construction and batches instance and static methods | `npm run test:node` |
| N43 | [test.ts](test.ts)：713 | @reactive() preserves constructor types, getter caches and automatic method batches | `npm run test:node` |
| N44 | [test.ts](test.ts)：751 | reactive(Class) and reactive()(Class) share proxy identity and preserve signatures | `npm run test:node` |
| N45 | [test.ts](test.ts)：780 | inherited methods, super calls and explicit batches share the outermost boundary | `npm run test:node` |
| N46 | [test.ts](test.ts)：817 | inherited instance methods and static getters keep separate receiver caches | `npm run test:node` |
| N47 | [test.ts](test.ts)：844 | method wrappers have stable identity, refresh after replacement and preserve dynamic this | `npm run test:node` |
| N48 | [test.ts](test.ts)：871 | plain object methods and directly proxied instances do not acquire automatic batches | `npm run test:node` |
| N49 | [test.ts](test.ts)：889 | class function fields and functions returned by getters are not method wrappers | `npm run test:node` |
| N50 | [test.ts](test.ts)：919 | fixed static methods respect invariants and TypeScript private fields remain trackable | `npm run test:node` |
| N51 | [test.ts](test.ts)：936 | throwing class methods settle successful writes, aggregate failures and remain reusable | `npm run test:node` |
| N52 | [test.ts](test.ts)：957 | reads inside automatic methods stay tracked and method array writes share the batch | `npm run test:node` |
| N53 | [test.ts](test.ts)：976 | batch returns the original Promise and only batches its synchronous portion | `npm run test:node` |
| N54 | [test.ts](test.ts)：996 | async class methods, generator iteration, microtasks and timers do not extend a batch | `npm run test:node` |
| N55 | [test.ts](test.ts)：1028 | effect dependencies stop at asynchronous boundaries | `npm run test:node` |
| N56 | [test.ts](test.ts)：1048 | batch net comparisons cover normalized references, signed zero and independent nested fields | `npm run test:node` |
| N57 | [test.ts](test.ts)：1068 | caught inner batch errors keep the outer baseline and single update errors retain identity | `npm run test:node` |
| N58 | [test.ts](test.ts)：1086 | failed additions and invalid array lengths produce no changes or leaked batch context | `npm run test:node` |
| N59 | [test.ts](test.ts)：1101 | a failed computed update can retry and does not block other consumers | `npm run test:node` |
| N60 | [test.ts](test.ts)：1116 | automatic getter branches recover and static method round trips do not notify | `npm run test:node` |
| N61 | [test.ts](test.ts)：1141 | public API preserves generic results and ignores effect callback return values | `npm run test:node` |
| N62 | [test.ts](test.ts)：1159 | watch defaults, immediate, undefined values and options are initialized once | `npm run test:node` |
| N63 | [test.ts](test.ts)：1183 | watch callback and option reads are isolated from both source and enclosing effect | `npm run test:node` |
| N64 | [test.ts](test.ts)：1202 | watch follows dependency changes without result equality filtering or deep snapshots | `npm run test:node` |
| N65 | [test.ts](test.ts)：1226 | immediate watches inside batches initialize synchronously and suppress direct recursion | `npm run test:node` |
| N66 | [test.ts](test.ts)：1246 | watch failures clean initial subscriptions and preserve the last successful value | `npm run test:node` |
| N67 | [test.ts](test.ts)：1271 | watch queue cancellation, self-stop and aggregated failures remain usable | `npm run test:node` |
| X01 | [reference.ts](reference.ts)：6 | computed shells are lazy, readonly, non-callable and retain identity in reactive containers | `npm run test:node` |
| X02 | [reference.ts](reference.ts)：37 | property references support nested paths, arrays, symbols, empty and missing keys | `npm run test:node` |
| X03 | [reference.ts](reference.ts)：60 | writable getter references isolate backing reads and invoke their setter once | `npm run test:node` |
| X04 | [reference.ts](reference.ts)：81 | reference validation rejects readonly, derived and ambiguous selectors and restores contexts | `npm run test:node` |
| S01 | [storage.ts](storage.ts)：55 | storage is available from the core entry | `npm run test:node` |
| S02 | [storage.ts](storage.ts)：59 | object properties named length retain the same accessor and hidden-field protections | `npm run test:node` |
| S03 | [storage.ts](storage.ts)：75 | storage restores synchronously, keeps root identity and preserves local methods and getters | `npm run test:node` |
| S04 | [storage.ts](storage.ts)：104 | storage creates a missing record once, preserves the name, and batches its initial write | `npm run test:node` |
| S05 | [storage.ts](storage.ts)：119 | storage observes unseen additions, deletions, replacements and only the current graph | `npm run test:node` |
| S06 | [storage.ts](storage.ts)：136 | storage preserves net batch semantics, settles throwing batches and skips equal JSON | `npm run test:node` |
| S07 | [storage.ts](storage.ts)：157 | storage persists arrays, holes and implicit length changes without wrapping native methods | `npm run test:node` |
| S08 | [storage.ts](storage.ts)：178 | storage writes after business effects settle and leaves enumeration and getter contracts intact | `npm run test:node` |
| S09 | [storage.ts](storage.ts)：194 | storage isolates adapter reads and reference captures from all observers | `npm run test:node` |
| S10 | [storage.ts](storage.ts)：219 | storage shares graph notifications without sharing controllers or retaining detached branches | `npm run test:node` |
| S11 | [storage.ts](storage.ts)：237 | storage returns immediately for async reads and never writes before they finish | `npm run test:node` |
| S12 | [storage.ts](storage.ts)：256 | storage gives the entire local state priority over a late read, including deletions and arrays | `npm run test:node` |
| S13 | [storage.ts](storage.ts)：270 | async restore distinguishes net batch rollback from earlier edits and equivalent replacements | `npm run test:node` |
| S14 | [storage.ts](storage.ts)：288 | storage hydrates in one batch and persists subsequent watch edits without echoing the read | `npm run test:node` |
| S15 | [storage.ts](storage.ts)：302 | storage serializes async writes and retains a return to the previously confirmed snapshot | `npm run test:node` |
| S16 | [storage.ts](storage.ts)：319 | storage resumes after failed writes, coalesces newer pending values and never spins on rejection | `npm run test:node` |
| S17 | [storage.ts](storage.ts)：341 | encoding failures discard stale pending writes and recovery can retry the last observed value | `npm run test:node` |
| S18 | [storage.ts](storage.ts)：360 | storage handles read rejection without overwriting records until a later local change | `npm run test:node` |
| S19 | [storage.ts](storage.ts)：375 | storage rejects malformed records without a partial restore or immediate rewrite | `npm run test:node` |
| S20 | [storage.ts](storage.ts)：390 | storage reports synchronous get/set failures and a broken diagnostic sink does not break reactivity | `npm run test:node` |
| S21 | [storage.ts](storage.ts)：412 | storage uses data-only canonical JSON, leaves getters and toJSON idle and repairs invalid graphs | `npm run test:node` |
| S22 | [storage.ts](storage.ts)：440 | storage supports null prototypes and shared acyclic data without persisting alias identity | `npm run test:node` |
| S23 | [storage.ts](storage.ts)：452 | restore preflight is atomic for readonly fields, non-extensible roots and locked arrays | `npm run test:node` |
| S24 | [storage.ts](storage.ts)：470 | storage preserves business errors and releases synchronous failed initialization bindings | `npm run test:node` |
| S25 | [storage.ts](storage.ts)：494 | storage validates options and binding identities before extra I/O | `npm run test:node` |
| S26 | [storage.ts](storage.ts)：516 | storage stop is idempotent and ignores late reads and writes without reopening subscriptions | `npm run test:node` |
| S27 | [storage.ts](storage.ts)：538 | storage accepts non-Promise thenables, settles once and handles throwing then accessors | `npm run test:node` |
| S28 | [storage.ts](storage.ts)：560 | storage handles mixed sync/async setters independently from the getter | `npm run test:node` |
| B01 | [storage-browser.ts](storage-browser.ts)：22 | native storage restores before returning, defaults to localStorage and isolates sessionStorage | `npm run test:node` |
| B02 | [storage-browser.ts](storage-browser.ts)：46 | native storage creates a missing array snapshot and replaces cached array contents in place | `npm run test:node` |
| B03 | [storage-browser.ts](storage-browser.ts)：62 | an explicit adapter takes precedence without touching either browser storage getter | `npm run test:node` |
| B04 | [storage-browser.ts](storage-browser.ts)：80 | a blocked browser getter falls back to memory and can be bound once access is restored | `npm run test:node` |
| B05 | [storage-browser.ts](storage-browser.ts)：99 | native quota failures preserve notifications and retry on a later state change | `npm run test:node` |
| B06 | [storage-browser.ts](storage-browser.ts)：127 | SSR ignores Node global storage and does not reserve a backend binding | `npm run test:node` |
| R01 | [react.tsx](react.tsx)：30 | aliases, memo identity, repeated wrapping and invalid categories | `npm run test:react` |
| R02 | [react.tsx](react.tsx)：48 | function memo skips unchanged props while store, React state and context still update | `npm run test:react` |
| R03 | [react.tsx](react.tsx)：79 | reactive props watch fires without JSX reads and never adds a second own render | `npm run test:react` |
| R04 | [react.tsx](react.tsx)：106 | props derived computed chains use candidate caches and commit once | `npm run test:react` |
| R05 | [react.tsx](react.tsx)：135 | props proxy is stable, shallow, readonly and handles existence and Object.is | `npm run test:react` |
| R06 | [react.tsx](react.tsx)：170 | props-selected watch updates closures and branches without swallowing oldValue | `npm run test:react` |
| R07 | [react.tsx](react.tsx)：188 | local state identity, immediate commit timing, refresh and StrictMode cleanup | `npm run test:react` |
| R08 | [react.tsx](react.tsx)：227 | layout changes in the render/subscribe window and a new branch are detected | `npm run test:react` |
| R09 | [react.tsx](react.tsx)：244 | suspended renders retain committed props, watch closures and computed caches | `npm run test:react` |
| R10 | [react.tsx](react.tsx)：276 | props changes inside an enclosing batch preserve watcher baselines and net rollback | `npm run test:react` |
| R11 | [react.tsx](react.tsx)：299 | props callback writes remain separate updates, including notify-time synchronous commits | `npm run test:react` |
| R12 | [react.tsx](react.tsx)：316 | class refs, PureComponent, lifecycle args, props watchers and independent instances | `npm run test:react` |
| R13 | [react.tsx](react.tsx)：354 | class SCU is honored except active props consumers and external forceUpdate | `npm run test:react` |
| R14 | [react.tsx](react.tsx)：378 | SSR does not initialize watchers and hydration establishes the initial baseline | `npm run test:react` |
| R15 | [react.tsx](react.tsx)：407 | ordinary useWatch refreshes captured props silently and uses latest callback | `npm run test:react` |
| R16 | [react.tsx](react.tsx)：423 | queued useWatch keeps oldValue when an earlier consumer synchronously renders | `npm run test:react` |
| R17 | [react.tsx](react.tsx)：441 | candidate collection never subscribes, but notices invalidations before subscription | `npm run test:react` |
| R18 | [react.tsx](react.tsx)：463 | observer props acknowledgments keep other owners and ordinary store causes | `npm run test:react` |
| R19 | [react.tsx](react.tsx)：493 | notify nodes retain dependencies and can be queued again during notification | `npm run test:react` |
| R20 | [react.tsx](react.tsx)：512 | render dependencies switch branches and ignore event-only and child-only reads | `npm run test:react` |
| R21 | [react.tsx](react.tsx)：535 | initial suspended and throwing renders never initialize their watchers | `npm run test:react` |
| R22 | [react.tsx](react.tsx)：557 | multiple watch setups clean every initialized handle when a later immediate callback fails | `npm run test:react` |
| R23 | [react.tsx](react.tsx)：585 | class field lifecycles, context, StrictMode reconnection and mount-window writes | `npm run test:react` |
| R24 | [react.tsx](react.tsx)：609 | class props notify the whole slot without duplicate forceUpdate and preserve historical refs | `npm run test:react` |
| R25 | [react.tsx](react.tsx)：638 | inline local states are independent while explicit shared raw state stays shared | `npm run test:react` |
| R26 | [react.tsx](react.tsx)：655 | source reads after destructuring stay plain values; props fields retain reference semantics | `npm run test:react` |
| R27 | [react.tsx](react.tsx)：679 | immediate watches created inside an outer batch initialize during setup | `npm run test:react` |
| R28 | [react.tsx](react.tsx)：696 | props commits inside an outer batch do not invalidate their own snapshot before settlement | `npm run test:react` |
| F01 | [react-features.tsx](react-features.tsx)：48 | external storage drives RC, Chip and Model in StrictMode and persists after unmount | `npm run test:react` |
| F02 | [react-features.tsx](react-features.tsx)：77 | async storage hydrates React consumers as one batch and preserves subsequent model edits | `npm run test:react` |
| F03 | [react-features.tsx](react-features.tsx)：105 | useLoading counts concurrent tokens, settles out of order and preserves boolean/numeric baselines | `npm run test:react` |
| F04 | [react-features.tsx](react-features.tsx)：149 | load wraps values and thenables, preserves synchronous/asynchronous failures and can retry | `npm run test:react` |
| F05 | [react-features.tsx](react-features.tsx)：182 | loading releases tokens and preserves every error when both business code and state subscribers fail | `npm run test:react` |
| F06 | [react-features.tsx](react-features.tsx)：211 | immediate and props watches see active model/load handles and the latest committed function | `npm run test:react` |
| F07 | [react-features.tsx](react-features.tsx)：237 | load never adopts a suspended candidate and running requests retain their original closure | `npm run test:react` |
| F08 | [react-features.tsx](react-features.tsx)：266 | load settles internally after unmount, rejects retained invocations and isolates new mounts | `npm run test:react` |
| F09 | [react-features.tsx](react-features.tsx)：292 | StrictMode loading reconnects its tokens, SSR does not invoke functions and instances stay separate | `npm run test:react` |
| F10 | [react-features.tsx](react-features.tsx)：322 | calling load from an effect does not subscribe it to token bookkeeping or function reads | `npm run test:react` |
| F11 | [react-features.tsx](react-features.tsx)：341 | loading resumes from real tokens after a hidden Suspense tree completes its requests | `npm run test:react` |
| F12 | [react-features.tsx](react-features.tsx)：366 | failed commit setup disconnects all model and loading handles before their own layout cleanup | `npm run test:react` |
| F13 | [react-features.tsx](react-features.tsx)：397 | props watch, Strict Chip, Model and load share commit ordering without suppressing child updates | `npm run test:react` |
| F14 | [react-features.tsx](react-features.tsx)：421 | useModel preserves identities and treats function initial values and object inputs as data | `npm run test:react` |
| F15 | [react-features.tsx](react-features.tsx)：470 | Model and defineModel bind real inputs, preserve refs and merge callbacks after one batched write | `npm run test:react` |
| F16 | [react-features.tsx](react-features.tsx)：515 | Model handles checkbox/radio, text areas, selects, explicit numbers and nullable display values | `npm run test:react` |
| F17 | [react-features.tsx](react-features.tsx)：556 | Model resolves the current nested target at event time and retains committed event configuration during Suspense | `npm run test:react` |
| F18 | [react-features.tsx](react-features.tsx)：600 | custom Model values, valueProp and defineModel preserve complete argument tuples and business props | `npm run test:react` |
| F19 | [react-features.tsx](react-features.tsx)：625 | Model conversion/write/callback failures preserve ordering, errors and net-change batching | `npm run test:react` |
| F20 | [react-features.tsx](react-features.tsx)：663 | Model validates selectors and child shape, with readonly props and computed cache hits rejected | `npm run test:react` |
| F21 | [react-features.tsx](react-features.tsx)：677 | Model reconnects after StrictMode cleanup and ignores retained handlers after unmount | `npm run test:react` |
| F22 | [react-features.tsx](react-features.tsx)：692 | PureComponent state fields named key/ref remain part of shallow comparison | `npm run test:react` |
| F23 | [react-features.tsx](react-features.tsx)：708 | Chip factories are inert, stable and independently update a/b without rendering their parent | `npm run test:react` |
| F24 | [react-features.tsx](react-features.tsx)：734 | normal Chip adopts new closures once; Strict skips parent props, accepts context and resets by key | `npm run test:react` |
| F25 | [react-features.tsx](react-features.tsx)：757 | Strict Chip receives parent reactive props and computed updates across owner acknowledgments | `npm run test:react` |
| F26 | [react-features.tsx](react-features.tsx)：772 | Chip branch subscriptions, nested children and StrictMode cleanup remain independent | `npm run test:react` |
| F27 | [react-features.tsx](react-features.tsx)：799 | Async gates render fallback through SSR and layout, then activate with current values | `npm run test:react` |
| F28 | [react-features.tsx](react-features.tsx)：828 | Async gates replay safely in StrictMode and never activate an uncommitted tree | `npm run test:react` |
| F29 | [react-features.tsx](react-features.tsx)：854 | Chip rejects non-synchronous callbacks and discarded renders never subscribe | `npm run test:react` |
| L01 | [react-loading.tsx](react-loading.tsx)：36 | all class component entries observe ordinary instance fields without loading | `npm run test:react` |
| L02 | [react-loading.tsx](react-loading.tsx)：52 | React entry exports the loading method decorator | `npm run test:react` |
| L03 | [react-loading.tsx](react-loading.tsx)：56 | class fields retain deep identity, per-instance subscriptions and batch net changes | `npm run test:react` |
| L04 | [react-loading.tsx](react-loading.tsx)：93 | class descriptors, symbols, empty keys and private methods preserve the original instance | `npm run test:react` |
| L05 | [react-loading.tsx](react-loading.tsx)：146 | bridged fields participate in effect, watch, computed, Chip and Model without parent renders | `npm run test:react` |
| L06 | [react-loading.tsx](react-loading.tsx)：180 | loading shares boolean/numeric tokens across methods and preserves results and this | `npm run test:react` |
| L07 | [react-loading.tsx](react-loading.tsx)：215 | loading fixes each selected field until settlement and separates inherited instances and hooks | `npm run test:react` |
| L08 | [react-loading.tsx](react-loading.tsx)：245 | loading awaits JS values and thenables, releases rejected calls and aggregates notification failures | `npm run test:react` |
| L09 | [react-loading.tsx](react-loading.tsx)：289 | loading rejects invalid selectors before work and restores tracking and reference capture | `npm run test:react` |
| L10 | [react-loading.tsx](react-loading.tsx)：351 | loading validates numeric capacity and mode, guards active writes including Model and permits idle baselines | `npm run test:react` |
| L11 | [react-loading.tsx](react-loading.tsx)：404 | loading registers tokens before reentrant watchers and protects other requests on rejection | `npm run test:react` |
| L12 | [react-loading.tsx](react-loading.tsx)：432 | React state/context/refs, PureComponent and props deduplication coexist with loading field updates | `npm run test:react` |
| L13 | [react-loading.tsx](react-loading.tsx)：489 | class mount windows and loading in componentDidMount recover through StrictMode | `npm run test:react` |
| L14 | [react-loading.tsx](react-loading.tsx)：515 | loading stops publication while hidden, settles internally and restores real tokens and idle writes | `npm run test:react` |
| L15 | [react-loading.tsx](react-loading.tsx)：554 | unmount and a new instance cannot receive old loading completion or retained calls | `npm run test:react` |
| L16 | [react-loading.tsx](react-loading.tsx)：587 | loading rejects construction, render and uncommitted/SSR calls without starting work | `npm run test:react` |
| L17 | [react-loading.tsx](react-loading.tsx)：627 | failed mount and throwing unmount release observation and loading connectivity synchronously | `npm run test:react` |
| L18 | [react-loading.tsx](react-loading.tsx)：664 | loading validates legacy method descriptors and rejects unsupported decorator targets | `npm run test:react` |
| L19 | [react-loading.tsx](react-loading.tsx)：686 | symbol and empty loading fields work from committed props watches without duplicate props notifications | `npm run test:react` |

## 构建、类型与包级检查

| 证据代号 | 文件 | 验证范围 |
| --- | --- | --- |
| T-CORE | [核心类型配置](types/tsconfig.json) | esm/commonjs、computed、watch、storage 的 .mts/.cts 正反类型用例；无 DOM、无额外 types |
| T-REACT | [React 类型配置](types/react/tsconfig.json) | ESM/CJS、JSX、Model、Chip、useLoading、loading 的正反类型用例 |
| T-LF | [localforage 类型示例](storage-localforage.ts) | localforage 薄包装编译检查；不是 IndexedDB 运行时测试 |
| D-CORE | [核心断言](smoke-assertions.cjs)、[ESM 入口](smoke.mjs)、[CJS 入口](smoke.cjs) | 根导出、计算值、方法装饰器、模块共享与 SSR |
| D-STORAGE | [存储冒烟](storage-smoke.cjs) | 同步/异步存储与双方向混合入口 |
| D-REACT | [React 冒烟](react-smoke.mjs) | 十九个导出、别名、组件/Model/Chip/加载状态 |
| PKG | [隔离打包脚本](../scripts/test-package.mjs) | tarball 白名单、无 React/localforage 核心消费者、React 18.3.1/工作区 19 隔离消费者 |
| BUILD | [构建脚本](../scripts/build.mjs) | ESM/CJS、声明、Node 条件入口 |
