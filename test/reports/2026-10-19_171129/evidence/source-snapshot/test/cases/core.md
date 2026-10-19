# 核心响应式测试用例

公共夹具 F0/F2/F4、计数和清理约定见 [用例入口](../TEST_CASES.md)。自动化定位见 [索引](../AUTOMATION.md)。默认运行 `npm run test:node`；P 项需按步骤补充断言。所有通知次数包含首次 effect；watch callback 默认不含首次读取。

## 1. 依赖、属性与批处理

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-001 | P0 | 立即执行、属性级依赖与重复读取 | count=1、message=hello；两个 effect 分别读取字段 | 1. 注册；2. 在 count effect 连读两次；3. 分别修改 count/message | 注册各执行一次；一次 count 修改只重跑对应 effect 一次；message 同理；赋值返回前已通知 | A: N01 |
| CORE-002 | P0 | 条件依赖和嵌套收集 | flag=true、a=1、b=10；外层读条件及 tail，内部另建 effect | 1. flag=false；2. 改 a、b、inner；3. 改 tail；每次重建内层前 stop 旧内层 | a 旧分支不触发；b 新分支触发；inner 只驱动内层；tail 仍属于外层；外层不会代管内层 stop | A: N02 |
| CORE-003 | P0 | stop 幂等、排队取消和自停 | 先注册的 effect 可停止后注册 effect | 1. 触发后停止待执行节点；2. 回调内自停后继续读 tail；3. 重复 stop；4. 再改数据 | 已排队节点不执行；自停后读取不重新订阅；重复 stop 无异常；其他消费者照常执行 | A: N03 |
| CORE-004 | P0 | Object.is 和 raw/proxy 归一 | value=NaN、nested=raw | 1. 再写 NaN；2. nested 写同 raw 的 proxy；3. value 写 +0、-0 | 前两项不通知；NaN→+0、+0→-0 各通知一次；raw/proxy 不误判新对象 | A: N04 |
| CORE-005 | P0 | 缺失/undefined/删除/失败写入 | 空对象，fixed 为不可写不可配置；effect 读缺失 value | 1. value=undefined；2. 删除两次；3. Reflect.set/delete fixed | 缺失→存在 undefined、存在→缺失各通知；重复删除无通知；失败返回 false，fixed 保持 2 | A: N05 |
| CORE-006 | P0 | 深层代理身份、环、旧分支清理 | raw.child.n=1，raw.self=raw | 1. 重复 reactive(raw/proxy)；2. 读取 child/self；3. 替换 child；4. 修改旧 child 与新 child | 代理身份稳定，self===proxy；替换触发；旧 child 不再触发，新 child 正常触发；无递归溢出 | A: N06 |
| CORE-007 | P0 | 嵌套 batch、返回值、多字段去重 | a=1、b=10；effect 同读 a/b | 1. 外层 a=2，内层 a=3，回到1；2. 新批次 a=2→3、b=11；3. 批外连续 a++ 两次 | 内层结束不通知；回退批次无通知；变化批次只追加 [3,11]；返回值原样；批外两次各通知 | A: N07 |
| CORE-008 | P0 | 净变化包含属性存在性 | {value:1}，effect 读 value | 1. 同批删除再恢复1；2. 独立删除；3. 同批新增2再删除；4. 写 undefined | 步骤1/3不额外通知；步骤2通知；步骤4虽读取值仍 undefined，存在性改变仍通知 | A: N08 |
| CORE-009 | P1 | batch 内依赖及新 effect | effect 内通过 batch 读 a；外部 batch 内另建读 b 的 effect | 1. 修改 a；2. 批内新建 effect；3. stop 原 effect；4. 再改 b | batch 不屏蔽收集；新 effect 当场运行；停止项不在结算复活；b 净变化正常通知 | A: N09 |
| CORE-010 | P1 | 空批次与非法参数 | null、显式 undefined、1、字符串、布尔、symbol | 1. batch 空函数；2. batch/effect 传 null；3. reactive 显式传每个基本类型 | 空 batch 返回 undefined；非法调用 TypeError；reactive() 无参工厂与 reactive(undefined) 严格区分 | A: N10、N43 |
| CORE-011 | P0 | 首次 effect 失败自动清理 | effect 读 value 后抛 E；另一个正常 effect | 1. 捕获创建异常；2. 注册正常 effect；3. 改 value | 原样抛 E；失败 effect 总共运行一次；后续正常订阅更新，收集上下文未泄漏 | A: N11 |
| CORE-012 | P0 | 回调/通知多错误与恢复 | batch 错误 E0；两个更新 effect 抛 E1/E2；第三个记录值 | 1. batch 写1后抛 E0；2. 捕获；3. 写2；4. 单独 throw undefined | errors 为 [E0,E1,E2]；记录者仍看到1；写2正常；成功写入不回滚；单个 undefined 异常不被吞 | A: N12 |
| CORE-013 | P0 | flush 中再写与自递归抑制 | 先订阅 [source,derived]，后订阅 source→derived=source×2 | 1. source 0→1；2. 创建读写自身的 effect | 可观察 [0,0]→[1,0]→[1,2]，后续写是新批次；当前运行的 effect 不直接递归自身 | A: N13 |
| CORE-014 | P0 | setter 合并、异常与无隐式求值 | setter 同时写 a/b，值2时抛 E；getter 计数 | 1. 不读 getter 直接设置1；2. 设置2并捕获 | 观察者仅见 [1,1]、[2,2] 完整状态；getter 调用0；原 E 抛出，已写数据仍结算 | A: N14 |

## 2. computed 与 getter

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-015 | P0 | 惰性计算与缓存 | count=1，double=count×2，getterCalls=0 | 1. 创建；2. 连读两次；3. count=2→3且不读；4. 再读；5. computed(null) | 调用次数0→1→1→2；结果2/6；无消费者时写入不主动求值；非法 getter TypeError | A: N15、N70 |
| CORE-016 | P0 | 计算分支隔离 | computed(flag?a:b)，消费者只读 computed | 1. true→false；2. a++；3. b++ | 序列1→10→11；消费者不因旧 a 变化运行；派生内部依赖不泄漏给外部 | A: N16 |
| CORE-017 | P0 | 链与菱形一次新鲜通知 | a=count+1，b=count×2，total=a+b，chain=total×10 | 1. effect 同读源和全部派生；2. count=2；3. batch 3→4 | 序列 [1,2,2,4,40]、[2,3,4,7,70]、[4,5,8,13,130]；无旧缓存或重复通知 | A: N17 |
| CORE-018 | P0 | 中途读取与净回退 | count=1，double、chain=double+1 | batch 中 count=2，读 chain，再恢复1；批后再读两层 | 中途为5；effect 不追加；批后 double=2、chain=3，不保留中间值 | A: N18 |
| CORE-019 | P1 | 结算不废弃最终有效缓存 | getter 每次改变依赖读取顺序，集合相同 | batch 写 count=2并读 final；批次结束让消费者读 | final=4；getter 总计只计算2次；依赖顺序变化不导致多一次重算 | A: N19 |
| CORE-020 | P0 | 恢复原分支后不漏净变化 | flag=true、a=1、b=10；computed 选分支 | batch 切到 b并读取；a=2；flag=true；结束后再改 a | 结束通知原分支最终2，后续 a 仍能触发；按原依赖判断变化 | A: N20 |
| CORE-021 | P0 | 临时分支变化不误通知 | 同 CORE-020 | batch 切 b并读，修改 b，flag 恢复；再独立改 a/b | 本批无原分支净变化则不通知；a 后续触发，临时 b 不触发 | A: N21 |
| CORE-022 | P0 | 无批后读取也恢复依赖 | 同上 | batch 切换/读取/恢复；不主动读 computed，直接改 a | a 修改仍驱动消费者；不能依赖批后手动读取修复订阅 | A: N22 |
| CORE-023 | P0 | 多层 computed 分支图恢复 | 内外两层 computed 均可切分支 | 批内切换读取再恢复；分别修改原/临时分支 | 上下游订阅双向一致，原分支有效、临时分支无多余通知；最终缓存正确 | A: N23 |
| CORE-024 | P1 | 批内首次计算的基线 | computed 创建时未读，批内首次读并订阅 | 首次求值后再变更并结算 | 首次实际收集的依赖成为该批基线；之后变化不丢、不误用空依赖 | A: N24 |
| CORE-025 | P0 | 分支恢复不复活 stop 节点 | 消费者订阅 computed | 批内切分支后 stop 消费者，再回退/结束；后续写源 | 停止节点不再执行；computed 依赖恢复不会重新激活消费者 | A: N25 |
| CORE-026 | P1 | 不按派生结果去重 | computed(count%2)，count=1 | count=3 | 消费者仍通知，新旧派生值均1；不是 computed 结果相等过滤 | A: N26 |
| CORE-027 | P0 | 计算失败重试和循环检测 | 首次/条件失败的 getter；直接及互相循环 computed | 1. 读失败；2. 修复再读；3. 读循环；4. 新建正常订阅 | 错误不缓存为成功；修复可重试；循环抛明确 Circular 错误；后续上下文正常 | A: N27 |
| CORE-028 | P0 | 抛错批次也恢复计算依赖 | 条件 computed，batch 中切分支读后抛 E | 捕获，修改最终有效分支 | 已完成修改按最终状态结算；后续依赖仍有效，无损坏队列 | A: N28 |
| CORE-029 | P0 | 自动 getter 缓存与 setter | count=1，get/set double | 连读 double；设 double=8；再次读取 | getter 惰性且缓存，setter 写 count=4使缓存失效；结果8，消费者收到新状态 | A: N29 |
| CORE-030 | P1 | 原型 getter 按 receiver 隔离 | 两对象共享原型 getter，数据值不同；原型也经代理 | 分别读两实例多次，改其中一个 | 缓存各自独立且 this 正确；改 A 不污染 B；代理原型不导致重包错误 | A: N30 |
| CORE-031 | P1 | getter 删除与替换 | 自有可配置 getter，已有消费者 | 删除 getter；经受支持的属性赋值恢复/替换数据；读取 | 属性消费者获得删除后的值和新数据；不以 defineProperty 本身须通知作为要求 | A: N31 |
| CORE-032 | P1 | Proxy 不变量 | 不可配置不可写对象属性；没有 getter 的固定访问器 | 读固定引用/空 getter；尝试失败写入 | 固定引用返回原对象，空 getter 为 undefined，无 Proxy invariant 异常；不强制深代理 | A: N32 |

## 3. 对象、数组和类

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-033 | P1 | 代理位于原型链的 receiver | parent proxy、Object.create(parent) 子对象 | 观察 parent；通过 child 写同名属性 | 写入落到子对象，不误通知父对象；父值不变 | A: N33 |
| CORE-034 | P1 | 内建对象保留身份 | Map/Set/Date/Promise/URL/Headers 等；置于响应式属性 | reactive(内建对象)并比较引用；对Map调用set；整体替换Map字段 | 各内建对象返回原引用；Map内部set可执行但不通知；整体替换Map通知 | A: N34 |
| CORE-035 | P1 | 类型判定无用户 getter 副作用 | 自定义 Symbol.toStringTag getter；类有同名数据标识 | reactive 并读写正常字段 | 不调用 tag getter 判代理资格；正常用户类仍可追踪 | A: N35 |
| CORE-036 | P1 | null 原型与 symbol | Object.create(null)，symbol key | 代理、订阅 symbol，修改值 | 值正常，原型不变，symbol 按属性通知 | A: N36 |
| CORE-037 | P0 | 数组索引/长度/截断 | [1,2,3]；分别观察 length、尾项、缺失索引 | 写越界索引、push、delete 索引、缩短 length | 隐式增长通知 length；删除索引不改变 length；截断通知实际被删索引和长度 | A: N37 |
| CORE-038 | P0 | 数组净回退 | [1,2,3]；观察 length 和索引2 | 1. batch push/pop；2. batch length=1再=3；3. 删除再恢复同索引同值 | 完整回退不通知；恢复 length 不恢复丢失的元素，索引2为 undefined且通知；存在性独立比较 | A: N38 |
| CORE-039 | P1 | length 派生中途读取 | computed(()=>list.length)，有消费者 | batch 内增长/截断并逐次读取，最后回退 | 中途派生立即更新；最终通知遵循净变化，不读旧 length 缓存 | A: N39 |
| CORE-040 | P1 | 稀疏数组与非规范索引 | 大 length、少量真实索引；键 01、-1、4294967295 | 缩短 length；读非规范键 | 仅处理真实数组索引；非规范键不作为 length 索引被误删，稀疏截断可完成 | A: N40 |
| CORE-041 | P1 | splice 与原生方法身份 | [1,2,3] | 核对 splice 身份；batch 内 splice 多次写入 | 保持原生数组方法；批内消费者一次看到终态；未包 batch 不承诺一次通知 | A: N41 |
| CORE-042 | P0 | @reactive 构造、实例与静态批次 | F4，构造参数1，方法连增两次 | new、instanceof、调用实例/静态方法、roundTrip | 构造参数和返回值正确；实例/静态各一次最终通知；往返无通知；原型正常 | A: N42 |
| CORE-043 | P0 | @reactive() 等价能力 | 与 CORE-042 同类定义但工厂形式 | 重复构造、getter 读取、方法和静态变化 | 与直接装饰器同语义；构造类型、缓存、批处理保留 | A: N43 |
| CORE-044 | P1 | reactive(Class) 与工厂身份 | 普通用户类 | 比较 reactive(Class)、reactive()(Class)、重复代理；构造调用 | 同一构造代理；参数与方法签名保留；行为和装饰器一致 | A: N44 |
| CORE-045 | P0 | 继承/super/互调最外层批次 | 父子类实例/静态方法，内部显式 batch | 子方法调用 super和其他方法，每层写两次 | 直到最外层结束才通知；共用原始基线；无重复包装通知 | A: N45 |
| CORE-046 | P1 | 继承 getter/方法接收对象 | 多实例、父子构造函数静态 getter | 交错读取和修改不同 receiver | 实例和静态缓存各自隔离，继承方法读取当前调用者数据 | A: N46 |
| CORE-047 | P1 | 包装身份、替换、动态 this | 取 method 两次，准备另一个接收对象 | 比较包装引用；替换原方法后重读；call/apply；无 receiver 调用 | 未替换时同一函数；替换后新包装；this由调用方式决定，不自动 bind | A: N47 |
| CORE-048 | P1 | 不误包装普通函数属性 | 普通对象 method；reactive(new Store()) | 方法内通过代理写两次 | 不自动合并这两次写；直接代理实例仅代理属性，不等价于类构造装饰 | A: N48 |
| CORE-049 | P1 | 函数字段/getter返回函数边界 | 实例箭头/绑定字段、静态函数字段、getter返回函数 | 读取比较身份并调用；另经显式 batch写代理 | 不作为原型方法自动包装；构造捕获 raw 不被强制修正；受支持写入仍按显式 batch | A: N49 |
| CORE-050 | P1 | 固定静态方法与 TS private | 不可写不可配置静态方法；TS private普通字段 | 读方法；调用 public方法改 private数据 | 不违反 Proxy 不变量；TS private 可追踪；不据此宣称核心支持 #private | A: N50 |
| CORE-051 | P0 | 类方法失败后的结算 | 方法写状态后抛 E；观察者也可抛 | 调用失败方法，捕获，再调用成功方法 | 已写值通知；单错保真，多错包含业务及通知错误；实例可继续用 | A: N51 |
| CORE-052 | P1 | 方法内读取和数组批次 | effect 调用读取字段的方法；另一个方法修改数组 | 改被读字段；调用数组多写方法 | 方法包装不隔离 effect 收集；数组写入在方法边界一次结算 | A: N52 |

## 4. 异步、错误和 watch

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-053 | P0 | batch 不等待 Promise | async 回调在 await 前/后分别写两次 | 保存原 Promise与 batch返回值；分段控制完成 | 返回同一个 Promise；await前合并，await后独立通知，除非另加 batch | A: N53 |
| CORE-054 | P1 | async方法/生成器/微任务/定时器 | 类 async方法、生成器迭代和排队回调 | 分段执行并观察每个阶段 | 仅当前同步调用栈共享批次；后续迭代/回调不延长旧 batch | A: N54 |
| CORE-055 | P1 | effect 仅收集同步读 | effect 同步读 a、await或回调后读 b | 完成异步读取；分别修改 a/b | a 变化重跑，b 的异步读取不成为原 effect 依赖 | A: N55 |
| CORE-056 | P1 | 净变化逐属性判断 | NaN、±0、raw/proxy、两个嵌套字段 | 同批往返/交换引用/只改其中一字段 | 按 Object.is及归一后的属性状态比较，不做深相等；独立字段互不吞通知 | A: N56 |
| CORE-057 | P1 | 捕获内层异常不重置基线 | 外层 batch；内层写后抛并在外层捕获 | 继续外层写入/回退；另测单一通知错误 | 仍使用最外层初值，通知次数正确；单错严格等于原错误 | A: N57 |
| CORE-058 | P1 | 不可扩展与非法 length | preventExtensions对象、普通可变数组 | 添加属性失败；设置非法 length；再写合法数据 | JS失败语义正确，没有虚假通知或遗留批次；合法后续写仍通知 | A: N58 |
| CORE-059 | P0 | 更新期 computed失败不阻断其他人 | 一消费者读取可能抛错的 computed，另一人记录源 | 源触发失败；修复后再读/再改 | 其他消费者执行；computed可重试；错误不使队列永久停止 | A: N59 |
| CORE-060 | P1 | 自动 getter分支与静态回退 | 类 getter条件分支；静态 roundTrip | 批内切换并回退；后续改原分支；调用静态往返方法 | 原依赖恢复，静态回退无额外通知，缓存最终值正确 | A: N60 |
| CORE-061 | P1 | API 返回语义 | effect返回一个函数；batch返回对象/基本值 | stop effect；比较 batch原返回引用/类型 | effect回调返回函数不被自动调用，stop不是runner；batch原样返回 | A: N61、T-CORE |
| CORE-062 | P0 | watch默认/immediate/void/配置 | source返回数值或undefined；缺省/空/false/true选项 | 创建；修改；创建后改options.immediate；stop | 默认只读一次不回调；true在返回前(initial,undefined)；后续old推进；undefined不是未初始化标记；改选项不补发 | A: N62 |
| CORE-063 | P0 | watch回调及选项读隔离 | 在外层effect建watch，callback/options getter读旁路字段 | 改旁路、源和外层专属字段 | 旁路不绑定watch或外层effect；source只订阅自身同步读取 | A: N63 |
| CORE-064 | P0 | watch分支/同值/对象引用 | source为条件、count%2、对象及嵌套字段 | 切分支；1→3；修改嵌套或替换对象 | 旧依赖解除；同结果仍回调(1,1)；仅返回对象不深监听；old对象不是历史快照 | A: N64 |
| CORE-065 | P1 | 批内immediate与同步写回 | batch内创建immediate watch；callback写自身源 | 记录创建前后顺序；批内变更/回退 | 首回调不等批次；当前watch不会直接自递归；后续按净变化结算 | A: N65 |
| CORE-066 | P0 | watch错误时旧值推进 | 首次source/callback抛；更新source/callback可控失败 | 分别失败后修复并改源 | 首次失败无残留订阅；更新source失败保留上次成功值；callback失败已保存本次新值，其他观察者继续 | A: N66 |
| CORE-067 | P0 | watch停止与聚合错误 | 多watch、可排队停止/自停，两个callback抛错 | 触发同批变化、捕获，再变更 | 被停项不执行；多错误保留；其他watch继续；后续队列可用 | A: N67 |
| CORE-068 | P0 | Computed外壳只读与身份 | computed(()=>count×2)；对象/数组内保存它 | 尝试调用、直接赋value、Reflect.set；reactive(computed)；缓存命中后新建消费者 | 冻结外壳；Reflect.set=false，严格写/调用TypeError；无自动解包/二次代理；缓存命中也能订阅 | A: X01 |
| CORE-069 | P1 | 计算结果引用与解构快照 | computed返回对象/函数/undefined；解构value | 读两次比较引用；修改结果对象；修改源；再读解构局部值 | 结果不自动代理/冻结；类型保持；提前解构仅旧值；消费者需在同步回调读.value | P: X01、T-CORE；补充运行时对象结果与提前解构断言 |
| CORE-070 | P1 | raw和结构追踪范围 | raw/proxy同对象；effect分别只用in/Object.keys/for...in | 直接改raw；通过proxy新增/删除；另建显式读字段的effect | raw写无通知；仅结构枚举不因结构变更重跑；显式字段读仍通知；storage内部观察不扩大该契约 | P: S08、N06；补充in/for...in及raw写入负向对照 |
| CORE-071 | P1 | 序列化以外的字符串/对象边界 | 空键、中文/emoji键、空数组、共享嵌套对象、0与false值 | 分别读写、重复代理、两个根共享子对象，批内回退 | 键/值原样保留；各真实读取依赖正确；共享对象代理一致；无truthy/falsy误判 | P: N36、N04、X02；补充Unicode键和false/0参数表 |
| CORE-072 | P1 | watch输入验证与返回值非清理 | source/callback分别传null/undefined/数值，callback返回函数 | 每项单独调用；合法watch停止/更新 | 非函数TypeError，无残留；返回的stop幂等且不执行callback返回函数；后续合法watch正常 | P: N62、N66；补充全部非法参数和清理返回值运行时检查 |
| CORE-073 | P1 | 跨 realm 普通对象与代理边界（D01） | Node vm 的嵌套普通对象、数组、null 原型、用户类和内建实例；constructor/tag 访问器 | 创建代理并重复取值；批量改子对象和类字段；对照内建身份及访问器次数 | 普通对象/用户类正确通知且身份稳定；内建保持原样；分类不执行访问器、不收紧同 realm 自定义原型 | A: N68、N69、D-CORE；真实 iframe 另见复测报告 |
