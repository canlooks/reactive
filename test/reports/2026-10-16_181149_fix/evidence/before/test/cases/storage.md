# 持久化存储测试用例

公共夹具 F1/F2/F3 见 [用例入口](../TEST_CASES.md)，代码定位见 [自动化索引](../AUTOMATION.md)。默认 `npm run test:node`；STORE-035/036 运行 `npm run test:react`。原生存储现有测试运行在 jsdom，真实浏览器另见 [质量用例](quality.md)。

## 1. 初始化与异步冲突决策表

每个格子使用新 root/adapter，缓存为 `{"count":8,"theme":"dark"}`，初值为 `{count:1,theme:'light'}`。异步 pending 期间 set 次数必须为0。

| 读取结果 | 本地操作 | 预期内存 | 初始化后写入 |
| --- | --- | --- | --- |
| 同步有效缓存 | 尚无机会编辑 | count=8、theme=dark | 纯恢复0次 |
| 同步/异步 null | 无编辑 | 初值 | 保存初值1次；外层batch可合并 |
| 异步有效缓存 | 无编辑 | count=8、theme=dark | 0次 |
| 异步有效缓存 | 同批count 1→2→1 | count=8、theme=dark | 0次 |
| 异步有效缓存 | 不同批count 1→2→1 | count=1、theme=light | 本地最终快照1次 |
| 异步有效缓存 | count=2 | count=2、theme=light | 整份本地快照1次，不补theme |
| 异步有效缓存 | 深层修改、删除、数组写入 | 保留整份本地树 | 本地最终快照 |
| 异步有效缓存 | 等JSON的新对象替换 | 保留新对象、本地状态 | 若与远端不同则保存；不允许迟到恢复 |
| 有效缓存 | 恢复后的watch继续写 | 恢复+业务变更 | 仅保存业务结算后的最终快照 |
| 抛错/reject/非法返回/非法JSON/错误根形状 | 无或已有编辑 | 保留当前本地 | 不立即覆盖旧记录；下一次新变化才重试写 |
| 恢复预检失败 | 尚未应用 | 完整初值 | 0次，无半恢复 |

不同批次的本地修改历史不可仅用最终 JSON 比较替代；同值赋值无净变化。JSON 相同与引用相同是两个不同断言。

## 2. 详细用例

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| STORE-001 | P0 | 根入口storage可用 | 从核心入口导入 | 检查函数并创建同步内存store | 导出为function；不需要React；返回可用响应式对象 | A: S01、D-STORAGE |
| STORE-002 | P1 | 对象名为length的受保护字段 | 普通对象length分别为getter/不可枚举只读，count=0；缓存count=4,length=2 | 创建；读取length；count++ | length仍9；count恢复4；纯恢复不写；之后仅存count=5，不误用数组length特例 | A: S02 |
| STORE-003 | P0 | 同步恢复、浅合并及本地行为保留 | F1默认初值；本地方法/getter/hidden/symbol；缓存试图覆盖它们 | 创建即读；重复读getter；调用方法 | 返回前count=8；enabled保留；profile.size消失；根===reactive(raw)；方法/getter/hidden/symbol保留，恢复不调用getter、不回写 | A: S03 |
| STORE-004 | P0 | 缺失记录初存及key原样 | get返回null；name=' app:key ' | 外层batch创建count=1再写2；结束后写3 | get一次使用原样key；batch内set=0；边界写count=2一次；之后写3；不偷偷trim key | A: S04 |
| STORE-005 | P0 | 未读取字段深层新增/删除与分支替换 | child={}，业务不预读新键；持有旧child | 新增deep=1→2；删除；替换child；修改旧child；新child再新增 | 每次有效数据变化自动保存；旧分支不再引发写；新分支无需业务预读也生效 | A: S05 |
| STORE-006 | P0 | 净变化/相同JSON/抛错批次 | count=1、child={value:1}、computed=count×2 | batch 2→3；batch4→3；raw/proxy互换；同JSON替换；写4后抛E | 变化批次仅最终JSON；净回退及同JSON替换不重复set；抛错仍保存4且原E保留；内存观察正常 | A: S06 |
| STORE-007 | P0 | 根数组原位恢复和孔洞 | raw=[1,2,3]，缓存[9] | 创建；索引3=4；删0；length=1；batch push/pop；batch splice | 根代理不变；依次JSON [9,null,null,4]、[null,null,null,4]、[null]；回退不写；splice一次终态 | A: S07 |
| STORE-008 | P0 | 等业务通知完成后保存 | count=0,mirror=0；watch将mirror设count×10；另有getter计数与Object.keys effect | count=1；新增字段 | 存储仅写含count=1,mirror=10的最终快照；不执行派生getter；普通枚举effect不被扩展为结构监听 | A: S08 |
| STORE-009 | P1 | adapter及引用捕获隔离 | adapter get/set读other.dependency；外层effect创建store | 改other；经captureReference选择业务字段；写store再改other | 不额外绑定外层effect/store；引用仍指向业务字段；get/set读取不污染Model定位 | A: S09 |
| STORE-010 | P1 | 共享子图、独立控制器 | 两个根/adapter共享child={value:0} | 改共享child；第一根替换child；再改第二根child | 初次两份都保存；替换后第一根不响应旧child；第二根继续；控制器不混用 | A: S10 |
| STORE-011 | P0 | 异步读立即返回且禁写 | deferred get；结果分别null/有效缓存 | 创建后立即读并注册effect；断言pending；resolve后turn | pending读初值、set=0；null后保存初值；缓存后一次恢复通知且set=0；返回值不是Promise | A: S11 |
| STORE-012 | P0 | 整份本地状态优先 | 延迟读；初值有count/theme/nested/list/remove | pending中batch改count、nested、list并删remove；返回旧缓存 | 本地全树保留，theme不从旧缓存补入；删除不复活；读取完只保存本地最终JSON | A: S12 |
| STORE-013 | P0 | 净回退/跨批回退/等内容替换 | value={count:1}；延迟缓存count=8 | 三个独立用例：同批1→2→1；跨批1→2→1；替换{count:1} | 仅同批回退允许恢复8；另两项保留本地1并保存；冲突使用修改历史而非最终JSON相等 | A: S13 |
| STORE-014 | P0 | 回填一批及业务追加写 | 初始a=b=1；缓存a=8,b=9；watch a==8时b=10 | resolve缓存，记录effect与writes | effect先见[1,1]、[8,9]，业务再见[8,10]；set仅最终{a:8,b:10}一次；不回声保存纯缓存 | A: S14 |
| STORE-015 | P0 | 单写在途/最新等待/回到旧成功值 | 已存0；第一set受控不完成 | count=1→2→3→0；先断言调用；完成第一、再第二 | 第一只写1；等待阶段不并发；完成后必须写0；中间2/3合并；maxActiveWrites=1、最终磁盘0 | A: S15 |
| STORE-016 | P0 | 写失败重试与无无限循环 | delayedWriter已存0 | 写1，等待中改2→3；第一reject；第二reject；turn后改4并resolve | 失败后继续最新3；无新状态不再自动重试；改4能保存；成功基线不因失败推进，maxActive=1 | A: S16 |
| STORE-017 | P0 | 编码失败丢弃过期pending | {count:0,extra:0}，写1在途；等待count=2 | extra=BigInt；完成在途；再extra=0 | 编码失败清除旧pending，不能续写过时快照；修复后保存{count:2,extra:0}，无永久去重屏蔽 | A: S17 |
| STORE-018 | P0 | 读reject保留旧记录 | 旧磁盘count=9，初值1，deferred读 | pending中count=2；reject；turn；再count=3 | 内存2保留，磁盘9不立刻覆盖，set=0；新修改后保存3；诊断phase=get | A: S18 |
| STORE-019 | P0 | 非法缓存/根形状/危险键 | 每次独立预置空串、null文本、数值、字符串、[]、损坏JSON、__proto__、嵌套constructor | 创建对象根，检查数据和原型；再合法修改count | 整份拒绝，初值保留、无初始化set；原型不污染；新变化可写合法快照 | A: S19 |
| STORE-020 | P1 | 同步get/set错误与诊断失败 | get throw；第一次set throw；console.warn可抛 | 创建；count=1→2；再注入编码错误并修复 | 内存通知0→1→2正常；报告get/set；logger失败不破坏队列；数据修复后仍可存 | A: S20 |
| STORE-021 | P0 | 纯数据投影/不执行getter或toJSON | NaN、-0、undefined、function、symbol、数组孔洞/Infinity、危险getter/toJSON；payload可变 | 首存；逐项payload=BigInt/环/Date/Map/Set/Promise/类/Computed；改另一个tail；修复payload | getter/toJSON调用0；省略对象不可JSON字段，数组转null，NaN转null，-0转0；非法图不覆盖好记录；修复可恢复保存 | A: S21 |
| STORE-022 | P1 | null原型与无环共享图 | null原型根a/b共用同子对象 | 存储后改a.value | 原型保持null，a/b内存共用；JSON两处保存等值；无误判循环；重新解析JSON不保留别名身份 | A: S22 |
| STORE-023 | P0 | 恢复预检无半修改 | count可写但另字段只读；不可扩展根；锁length/尾索引数组 | 缓存同时尝试合法和非法修改 | 整份拒绝，所有初值和数组内容不变；不先修改count再失败；phase=restore | A: S23 |
| STORE-024 | P0 | 回填业务异常保真与绑定释放 | effect在恢复到8时抛E；同步与异步两条路径 | 同步创建失败后stop业务effect再重建；异步resolve后再改9 | 同步原E抛出并释放绑定，重建成功；异步phase=hydrate且原E保留，store后续可用；不误归为decode错误 | A: S24 |
| STORE-025 | P0 | 参数和绑定唯一性 | 非对象根/类/Computed；无name/空白name/错误type/坏adapter；一个已绑定raw | 逐项非法调用；同根同后端/key重复；改key/adapter；同后端key绑第二根 | TypeError在新增I/O前发生；重复合法绑定同proxy、只get一次；冲突拒绝；不同key合法 | A: S25 |
| STORE-026 | P1 | 内部停止/迟到回调保护 | 白盒stopStorage；读/写deferred | 停止两次；完成旧read/write；再写proxy；另建同后端key绑定 | 停止幂等；不恢复、不续pending、不重订阅；可新建；不要求取消已经发出的adapter I/O | A: S26 |
| STORE-027 | P1 | PromiseLike与then异常 | 非Promise thenable重复resolve/reject；then getter抛 | get返回thenable；turn；另测get/set then getter失败 | 只同化一次且只接受首次结果；不提前同步回填；诊断阶段get/set正确；无未处理拒绝 | A: S27 |
| STORE-028 | P1 | 每次调用独立识别同步/异步 | 同步get；set1同步、set2延迟、set3同步 | 依次写1/2/3；完成2 | 先调用[1,2]；3等2完成；最终[1,2,3]；不能由getter或第一次set推断后续模式 | A: S28 |
| STORE-029 | P0 | local/session默认与隔离 | jsdom同源两后端相同含空格key分别存2/8 | 默认store与session store创建；分别修改 | 默认local；返回前已恢复；缓存缺默认字段不回写；两个后端互不污染；key原样 | A: B01 |
| STORE-030 | P0 | 浏览器数组初存/缓存原位恢复 | local缺失；session缓存[9] | 新建[1,2,3]并batch splice/push；另用reactive数组恢复 | local创建快照并写最终[3,4]；session原proxy恢复为[9]、长度一致 | A: B02 |
| STORE-031 | P1 | adapter优先，不触碰浏览器getter | local/session getter均计数并抛；显式adapter | 设置type=session仍传adapter，创建并修改 | 浏览器getter访问0；adapter正常get/set且this正确 | A: B03、S03 |
| STORE-032 | P1 | 存储getter被禁用及显式再绑定 | localStorage getter抛SecurityError | 创建后内存修改；恢复getter；显式storage同root再修改 | 降级内存、报告access；恢复环境不自动触发；显式调用才绑定并继续存储 | A: B04 |
| STORE-033 | P1 | QuotaExceededError不破坏响应式 | Storage.setItem模拟配额错误，之后恢复可写 | 初始化及修改各失败；恢复后再修改 | 每次实际失败有诊断；无忙重试；effect持续收到数据；恢复后保存最新值 | A: B05 |
| STORE-034 | P0 | SSR无window不使用Node全局storage | 删除window；globalThis.localStorage getter抛且计数 | 创建不同name内存store并修改；还原环境 | 不访问Node全局storage，访问次数0；无持久化占位绑定；只返回响应式初值 | A: B06 |
| STORE-035 | P0 | 外部storage+RC/Chip/Model+StrictMode | 客户端render前创建store，F3 StrictMode | 修改store、真实输入改Model；卸载组件后再改store | UI与最终JSON一致；卸载只停React订阅，仍保存外部store；无重复绑定 | A: F01 |
| STORE-036 | P0 | 异步恢复驱动React与表单 | 初值state、延迟缓存；已提交RC/Chip/Model | resolve有效缓存；再输入新值 | 恢复统一通知DOM/控件；纯恢复不回写；随后表单编辑保存新状态 | A: F02 |
| STORE-037 | P1 | 缓存不是业务schema校验 | 初值count:number；缓存count='eight'，带未知普通字段 | 创建并检查；另用自定义adapter先验证/迁移再返回字符串 | 默认接受合法JSON字段，不承诺number校验；自定义迁移按自身协议生效；不得编写默认丢弃字符串的错误预期 | M: F1；记录实际字段类型及adapter迁移结果 |
| STORE-038 | P1 | 非法adapter返回值与this | get返回undefined/数字/普通对象；set同步返回非undefined值；then计数 | 每项独立运行，记录get/set this和阶段；随后合法操作 | 非法get报告decode，非法同步set报告set；记录不被错误确认成功；this为adapter；then只读一次 | P: S03、S20、S27；补充非法返回值及then getter读取次数 |
| STORE-039 | P0 | 所有危险键和继承setter防护 | 以defineProperty构建__proto__/constructor/prototype数据键，根/深层/数组元素各一份；Object.prototype临时setter测试在独立进程 | 编码、解码各测三键；恢复将命中继承setter的字段 | 拒绝危险数据投影，无原型污染；继承setter不被执行，预检失败不半恢复；finally恢复全局描述符 | P: S19、S21、S23；补充prototype/编码方向/继承setter矩阵 |
| STORE-040 | P1 | JSON细节与重新初始化默认字段 | Unicode/换行字符串、±Infinity、数组命名属性；初值可删除字段x=1 | 保存后JSON.parse；删x并保存；释放测试绑定，用同初值重新创建 | 字符串等值；无限数null；数组命名属性不保存；缺失x由初值重新补回且纯恢复不回写，长期空值应显式null | P: S03、S07、S21；补充Unicode、数组命名属性及重载删除默认字段 |

## 3. 错误阶段核对

| 阶段 | 注入位置 | 诊断/状态要求 |
| --- | --- | --- |
| access | window.localStorage/sessionStorage getter | 内存回退；仅访问选中的后端；不自动切换 |
| get | adapter.getItem抛错/reject/then访问失败 | 不立即覆盖旧记录，后续新变化可写 |
| decode | 非字符串非null、JSON解析、根形状/危险键 | 整份拒绝，不把坏记录当缺失 |
| restore | 可写性/扩展性/数组约束预检 | 原状态完整保留 |
| encode | BigInt、环、不支持对象、危险数据键 | 本次不写，清除待写旧快照，修复后继续 |
| set | 同步异常、拒绝、非法同步返回 | 不推进confirmed；允许较新的pending继续，禁止无限重试 |
| hydrate | 异步恢复期间业务订阅者抛错 | 保留原业务错误及已成功修改，控制器继续可用 |

诊断至少能识别 name、phase、error；库不主动输出整份状态。adapter/业务错误本身的message由调用者决定，不把任意错误文本都定义成库的脱敏保证。
