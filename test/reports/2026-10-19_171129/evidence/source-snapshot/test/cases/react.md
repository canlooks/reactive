# React 组件、props 与生命周期测试用例

使用 [公共夹具 F3/F4](../TEST_CASES.md)，运行 `npm run test:react`；包级在 React 18.3.1/19 分别复跑。计数类断言在非 StrictMode、没有无关更新的受控环境下执行；StrictMode 只判断有效订阅与终态。React DOM 更新在 act 完成后断言，不要求赋值后 DOM 立即同步提交。

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| REACT-001 | P0 | 别名、统一分发、包装缓存、非法类别 | 同步函数、类、已包装对象；外部memo/forwardRef/lazy、async函数、错误类型 | 对三组别名与RC/RFC/RCC包装结果比较；重复包装；逐项传非法组件 | RC/RFC/RCC各等于其全名；RC函数与RFC同一包装；重复本库包装不叠加；函数/类合法分发，非法类别TypeError | P: R01；补充真实memo/forwardRef/lazy对象的非法包装矩阵 |
| REACT-002 | P0 | 自动memo不屏蔽有效更新 | RC函数读store、React state、context，记录render增量 | 相同props父更新；对象/函数引用变化；store/state/context分别变化 | 相同props跳过；真实props变化正常；store/state/context仍驱动正确DOM，不因memo漏更新 | P: R02；补充对象和函数引用更换的memo比较断言 |
| REACT-003 | P0 | props仅watch读取与无二次render | props.count=1；JSX不读或同时读；useWatch记录参数 | 一次父级更新count=2 | watch恰收到(2,1)，回调读props为2；受控render只增1，无同源补渲染 | A: R03 |
| REACT-004 | P0 | props派生候选缓存 | computed/getter链依赖props，已有已提交缓存 | 父级1→2；render和watch读取派生值 | 本次render即用新props；成功提交后采用新缓存；不需要第二次修正render | A: R04 |
| REACT-005 | P1 | props视图身份、浅层只读、存在性 | props含对象/函数/children、缺失字段、NaN、±0 | 连续提交；检查代理身份/嵌套引用；尝试写/删/define；新增undefined、删键、改±0 | 同挂载代理稳定；浅层原引用；顶层拒写，不修改冻结React props；按存在性/Object.is通知 | A: R05 |
| REACT-006 | P0 | props选择source和最新闭包 | props决定watch读store.a或b，callback带label | 父级切分支/label并提交；改旧/新字段 | 此次props回调仍保留上一成功oldValue；新闭包生效；旧分支解绑，新分支更新 | A: R06 |
| REACT-007 | P0 | 外层batch包含多次props提交 | 已watch props.count=1 | batch内提交2再3；另一batch提交4再3；每次flushSync受控提交 | 正常变化一次(3,1)；回退无回调；结算前静默刷新不得吞旧值 | A: R10 |
| REACT-008 | P0 | useReactive身份/useWatch提交时序 | inline初值、immediate watch，StrictMode对照 | 首次render/提交；重渲染换initial/options；卸载再写；重新挂载 | render不调用watch callback；layout setup按immediate执行；同挂载不重置/补发；卸载停止，重挂载新基线 | A: R07 |
| REACT-009 | P0 | render到subscribe之间变化 | layout中可修改store；新分支未在旧提交订阅 | 首次render读取后、订阅前改源；切新分支后窗口中再改 | 版本复查发现候选过期，最终显示最新值；不能长期停留旧首帧 | A: R08 |
| REACT-010 | P0 | Suspense保留已提交props/缓存/回调 | 已提交A；新props B的transition被受控Promise挂起 | 挂起期间读已保存props、触发watch、读computed；随后释放并提交B | 挂起候选不发布、不改oldValue或缓存；旧事件读A；提交后才读B并通知正确一次 | A: R09 |
| REACT-011 | P0 | props回调写入和通知中同步提交 | useWatch props变更时写local/store；React listener可flushSync提交 | 更新props并观察DOM/通知序列 | own-props去重只消除已覆盖来源；callback真实写入仍驱动必要后续更新，无丢失重入 | A: R11 |
| REACT-012 | P1 | 候选收集不订阅、快照失效 | 白盒Observer，未subscribe的attempt读取a | 仅render候选后改a；比较snapshot；再subscribe/commit | 收集期间无永久订阅；无变化snapshot稳定；订阅前失效被发现 | A: R17 |
| REACT-013 | P0 | owner来源确认隔离 | 两observer、普通store更新同时排队 | 确认A已提交props原因，保留B或普通store原因 | 仅A自身已覆盖原因被清除；其他owner/store通知不被吞 | A: R18 |
| REACT-014 | P0 | notify节点依赖与重排队 | 白盒notify节点订阅字段，通知中写新数据 | 连续变化及通知内再次写 | notify不清空已提交依赖、不直接调用组件函数；可再次入队，最终读最新值 | A: R19 |
| REACT-015 | P0 | 外层batch中的props快照确认 | own-props提交发生于未结束batch | 提交后但结算前多次读取snapshot；结束batch | 已覆盖的own-props版本不制造额外失效；真正新来源仍能触发 | A: R28 |
| REACT-016 | P0 | 类ref/PureComponent/生命周期/实例隔离 | 两个包装类实例，static标记、props watch，生命周期日志 | props更新/字段变化/卸载；比较ref、prevProps、构造/方法参数 | ref为原类实例，instanceof/静态成员保留；生命周期参数正常；实例订阅独立；手工watch自行stop | A: R12 |
| REACT-017 | P1 | shouldComponentUpdate语义 | SCU=false类；有/无活动props消费者；另有外部store | 父props浅变；同props；外部store变；forceUpdate | 原SCU被调用；有活动props消费者且浅变时放行一次；其他遵守SCU；外部依赖更新不被阻断 | A: R13 |
| REACT-018 | P1 | PureComponent的key/ref普通state字段 | state={key:1,ref:2}，RC(PureComponent) | setState key=3，再ref=4 | DOM依次3:2、3:4；不能把state的key/ref当React特殊props忽略 | A: F22 |
| REACT-019 | P0 | SSR及hydrate基线 | 无window SSR；immediate useWatch；相同客户端初值 | renderToString；改服务端store；hydrateRoot；客户端更新 | SSR不建watch、不callback；相同初值无hydration警告；首次客户端提交按immediate建立基线，不补历史变化 | A: R14 |
| REACT-020 | P1 | 普通组件useWatch静默刷新 | 未经RC的函数组件，source捕获普通props/context | 改普通props/context并提交；再改响应式源 | 无响应式变化时不伪造回调；source绑定与callback更新到最新提交，之后使用新闭包 | A: R15 |
| REACT-021 | P0 | 排队watch旧值不被先行渲染覆盖 | 同轮较早消费者触发同步React提交；watch尚排队 | 触发源变化，记录watch next/previous | 静默refresh不吞队列、不提前改oldValue；只收到应有新旧值 | A: R16 |
| REACT-022 | P0 | 首次挂起/抛错不得初始化watch | 初次render在useWatch之后挂起或抛错 | 执行失败render，改store，再解除挂起成功挂载 | 未提交期间callback=0、无残留订阅；成功提交才按配置初始化 | A: R21 |
| REACT-023 | P0 | 后续setup失败清理已建watch | 一个组件多个immediate useWatch，后一个首次callback抛E | 挂载失败；之后修改所有source | 之前已初始化句柄也全部停止，无遗留回调，即使React尚未注册各自cleanup | A: R22 |
| REACT-024 | P1 | 外层batch内immediate setup时机 | batch内同步挂载组件/useWatch immediate | 记录setup内与batch结束顺序 | immediate在setup当场执行，不推迟到外层batch结束，也不递归重复初始化 | A: R27 |
| REACT-025 | P0 | render分支与事件/子节点依赖隔离 | 父RC按flag读a或b；事件读c；独立子读d | 切分支并提交；分别改a/b/c/d | 父只响应当前render依赖；事件读和独立子组件读不进入父订阅；旧分支清理 | A: R20 |
| REACT-026 | P0 | 类生命周期字段/context及挂载窗口 | 类字段形式生命周期，context，StrictMode；挂载前窗口修改 | mount/unmount/mount重放；改store/context | 用户生命周期正常、窗口变化最终可见；重连后有效订阅一份，卸载后停止 | A: R23 |
| REACT-027 | P0 | 类props整槽通知与历史引用 | this.props.count手工watch；只改其他props；记录prevProps和forceUpdate | 父props多次更新、同值外壳对照 | 整槽浅变可回调相同count；旧props引用保持历史；不额外forceUpdate同源props更新 | A: R24 |
| REACT-028 | P1 | 局部状态独立/显式共享 | 两组件分别inline初值；另两组件共享raw | 各自写状态；父级重渲染换initial | inline互不干扰；共享raw同代理且互相可见；本次挂载忽略新initial | A: R25 |
| REACT-029 | P1 | 解构值与props引用语义 | RC(props)，const {count}=props；另读props.count和对象字段 | 父级提交count及嵌套引用变化 | source闭包中的解构值不建立props订阅；视图字段读取可监听；嵌套引用不深复制 | A: R26 |
| REACT-030 | P0 | 所有类入口直接字段响应 | RC/ReactiveComponent/RCC/ReactiveClassComponent分别包类；普通count字段 | 无loading装饰器，挂载后count++ | 四入口都更新DOM，不需额外reactive；不能仅在加载字段场景验证类字段能力 | A: L01 |
| REACT-031 | P0 | 类字段深层身份/实例/净回退 | 两实例字段含对象/数组；明确共享raw的对照 | 深层改动、整体替换、同值、batch回退及多写 | 普通实例独立；共享raw共享；深层proxy稳定；多写一次通知，回退无通知 | A: L03 |
| REACT-032 | P1 | 类描述符/symbol/空键/#private | configurable普通字段、readonly/hidden/symbol/空键、访问器、#private方法；另有不可配置可写字段 | 包装、读取/写入，调用原方法；构造非法字段类 | ref/this为原实例，#private方法可用；枚举性/只读保留；已有访问器和固定只读不变；不可配置可写字段TypeError含键 | A: L04 |
| REACT-033 | P0 | 桥接字段贯通全部消费者 | 原实例字段被effect/watch/computed/Chip/Model使用 | 通过字段与Model修改；观察父/片段计数 | 所有消费者见同一状态；片段/控件可独立更新，未读取字段的父不增render；外部手工订阅仍需stop | A: L05 |
| REACT-034 | P1 | React保留字段与loading共存 | state/context/refs、PureComponent、props watch与busy字段 | setState、context/props更新、业务任务开始完成 | React字段不被普通用户字段接管；各类更新正常；props去重不误屏蔽busy更新 | A: L12 |
| REACT-035 | P1 | RC类方法无自动批次及getter边界 | 类count/a/b和普通getter；普通原型方法连续写两次 | 用外部effect计数，调用普通方法；显式batch对照；重复读getter | 普通方法两次独立通知，显式batch一次；类getter不承诺computed缓存；不依赖动态新增/删除字段响应 | P: L03、L04；补充普通方法通知次数和getter非缓存对照 |

附加验收：类组件提交后复查版本的现有保证，与函数组件 useSyncExternalStore 的保证分别记录；不把未承诺的完整并发提交前保证列成类组件缺陷。SSR跨请求隔离、真实浏览器hydration另见QUAL用例。
