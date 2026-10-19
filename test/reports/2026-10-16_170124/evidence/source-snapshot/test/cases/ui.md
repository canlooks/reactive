# Chip 与 Model 测试用例

使用 [夹具 F0/F3](../TEST_CASES.md)。React用例运行 `npm run test:react`，引用定位白盒回归随 `npm run test:node`；真实事件兼容性见QUAL-001。完整英文测试标题见 [自动化索引](../AUTOMATION.md)。

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | P0 | 四个片段工厂无副作用/身份稳定 | chip/strictChip/asyncChip/asyncStrictChip传计数回调 | 在render外调用；条件/列表生成element；随后挂载 | 工厂只创建element、不调用回调/Hook；type分别为对应组件；相同key保持组件身份 | P: F23、D-REACT；补充条件/列表及相同key挂载次数 |
| UI-002 | P0 | A/B局部更新与父隔离 | 父只创建两个Chip，子回调分别读a/b；计数parent/A/B | 改a；改b；同批a往返 | 改a仅A更新、改b仅B更新；父不增render；净回退不更新片段 | A: F23 |
| UI-003 | P1 | 普通Chip采纳新闭包 | children捕获父普通label | 父label A→B后提交，再改片段store | 采用B闭包，父更新造成一次正常片段更新，无自身props补渲染 | A: F24 |
| UI-004 | P1 | Strict忽略父props但响应自身/context | Chip.Strict及strictChip；闭包label与reactive count/context | 父换label；再改count/context；最后换key | 父更新被跳过的新闭包不替换旧闭包；count/context仍更新；换key后使用新label | A: F24 |
| UI-005 | P0 | 分支/嵌套子组件/卸载隔离 | Chip按flag读a/b，嵌套Chip与独立子组件；StrictMode | 切flag，改旧/新分支，卸载后改值 | 仅当前分支有效；子订阅不混入父；StrictMode最终一份有效订阅，卸载无回调 | A: F26 |
| UI-006 | P0 | Strict读取稳定props视图及派生值 | RC父props.count，Strict Chip读props与computed | 父props更新并确认own-props来源 | Strict仍因响应式props/派生依赖更新；父去重不吞片段更新；终值正确 | A: F25、F13 |
| UI-007 | P0 | Async首次fallback与最新数据 | AsyncChip/AsyncChip.Strict，fallback文本；SSR和hydrate | SSR；客户端layout阶段读取；激活前改store；effect后读取 | SSR/首帧为fallback且children未执行/未订阅；effect后首次读最新值；默认工厂fallback为null | A: F27 |
| UI-008 | P1 | Async未提交树与StrictMode | 初次挂起/卸载的Async gate；StrictMode重放 | 激活前终止；另正常挂载、重连、更新 | 未提交树不激活/不遗留订阅；正常重连可更新；无定时器或“等待网络Promise”语义 | A: F28 |
| UI-009 | P1 | 非同步children与失败render | 非函数、async函数、返回Promise/thenable；普通同步null/text/Fragment/array | 分别render；抛错/挂起后改源 | 非同步输入TypeError；失败候选不订阅；合法同步ReactNode正常渲染；回调内Hook不属于支持写法 | P: F29；补充合法ReactNode参数表及返回自定义thenable |
| UI-010 | P0 | useModel身份/重渲染/初值函数 | 字符串、布尔、对象、函数字面值模型，普通父+Chip | 真实输入；提取onChange直接调用；直接写value；换initial重渲染 | 模型和onChange稳定；初值函数作为数据不调用；当前值不重置；Chip更新而父不因Hook自动刷新 | A: F14 |
| UI-011 | P0 | 普通target对象不是事件 | model对象值含target:{value:'data'}，另有函数值 | onChange传对象/函数 | 第一个参数完整作为新数据；不当事件读取target.value，不当React updater执行函数 | A: F14、F18 |
| UI-012 | P0 | Model/defineModel真实双向输入 | state.name=Alice；单input含key/ref/data-*和defaultValue；另TextInput refer | 挂载；输入Bob；外部设Carol | 初值Alice；两控件同步Bob/Carol；ref指同input且卸载清空；业务props保留；覆盖受控value并移除defaultValue，无受控警告 | A: F15 |
| UI-013 | P0 | 一次写入与原回调顺序 | Model转换可计数；原onChange读state.name并写extra | 派发一次事件 | 转换一次→模型写一次→原回调一次且完整原参数；回调已见新值；extra写与模型同batch，仅最终一次业务通知 | A: F15、F18 |
| UI-014 | P0 | 事件时重新定位嵌套目标 | Model source=()=>state.user.name，保存稳定handler和旧user | 同batch替换user，立刻handler('X') | 写当前user.name，旧user不变；不使用render时保存的过期位置 | A: F17 |
| UI-015 | P0 | Suspense事件配置仅取已提交版本 | 已提交first/old转换与callback；候选second/new挂起 | 候选期间调用旧handler；成功提交后再调用同handler | 未提交时只写first，用old转换/callback；提交后写second用new配置；handler身份稳定 | A: F17 |
| UI-016 | P0 | 原生控件提取与null显示 | checkbox(undefined,显式checked)、radio(false)、textarea(null)、单选、多选(undefined)、number(3) | 挂载检查；click/input/change；number显式postValue | checked=false、文本=''、多选=[]仅用于显示不回写；事件得布尔/字符串/字符串数组；数字显式转12；checkbox提交value保留 | A: F16 |
| UI-017 | P1 | 自定义值/valueProp/完整参数 | 布尔value控件、对象控件、金额控件onChange(number,unit) | 显式valueProp=value；传对象；defineModel转换4,'kg'为8 | 布尔不误注入checked；对象按数据；转换/原回调完整参数；label等必填业务props保留 | A: F18 |
| UI-018 | P0 | 转换/写入/回调失败与净回退 | state.value=1；转换抛E、字段只读、callback抛E/恢复原值 | 四模式独立触发一次事件 | 转换/写失败不调原callback；callback失败不回滚已写2；callback把3恢复2时本批无净通知；错误原样保留 | A: F19 |
| UI-019 | P1 | 合法属性位置矩阵 | nested.x、数组0、symbol、空键、缺失可扩展字段 | 对每项captureReference读取后write；挂载Model对照 | 只写指定终端；0/空键不被当未绑定；可新增缺失字段；不按“值相同”猜测位置 | P: X02；内部矩阵已覆盖，补充这些位置的真实Model事件集成 |
| UI-020 | P0 | 可写getter与一次setter | reactive对象get/set name，getter内部读其他字段 | captureReference/Model指向name；写新值 | setter只执行一次，getter内部读不劫持目标；正确更新backing字段和消费者 | P: X03；白盒已覆盖，补充Model DOM集成 |
| UI-021 | P0 | 无效/只读/派生/歧义引用 | 常量、raw属性、Computed缓存命中、只读props/getter、算术/多字段/不连续链、不可扩展缺失字段 | 每项捕获/Model渲染；失败后执行合法引用写入 | 可识别非法表达式TypeError，无错写；收集/定位上下文恢复；不要求识别所有碰巧同值的运算，selector必须直接选择可赋值位置 | A: X04、F20 |
| UI-022 | P1 | 子element形状与valueProp校验 | null/text/数组/多个元素/Fragment/portal/file input；非法valueProp | 逐项渲染独立错误边界；再渲染单有效input | 非法形状/协议拒绝，file不尝试写value；合法单控件正常；错误不污染后续绑定 | P: F20；补充portal、多元素、非法valueProp矩阵 |
| UI-023 | P0 | StrictMode重连与遗留handler失效 | Model/useModel已提交并保留onChange | StrictMode setup/cleanup后输入；卸载；调用遗留handler | 重连可写；卸载后不改状态、不执行子原回调；真正新实例不被旧handler影响 | A: F21、F14、F17 |
| UI-024 | P1 | SSR只输出受控值 | SSR单input/checkbox/select及Model getter+setter计数；无window | renderToString；记录setter/callback；客户端同值hydrate再输入 | SSR输出当前值，setter/callback=0，无永久观察订阅；匹配hydrate无warning，提交后才能处理事件 | P: R14、F20；补充Model专属SSR副作用计数与hydrate链路 |
| UI-025 | P1 | currentTarget/target与跨文档事件 | 来自另一个同源Document的input，真实Event或具备事件方法的参数 | currentTarget有效时与target不同；currentTarget无效时target为原生控件；事件结束后检查 | 调用期间同步读取有效currentTarget优先，否则target；用控件自身ownerDocument识别；普通数据对象保持原样 | M: F3；用真实iframe或独立jsdom Window，捕获值与回调参数 |
| UI-026 | P1 | defineModel保持业务协议与挂载 | 自定义函数/类控件，必填label，value/onChange(number,unit)；保留key切换 | 外部值更新、输入、同key重渲染、换key；比较调用参数 | 业务props/children正常；同key无意外重挂载；换key按React重建；不承诺HOC静态复制/React18 ref转发/任意泛型保真 | P: F15、F18、T-REACT；补充类控件运行时和key重挂载 |
