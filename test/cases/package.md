# 类型、构建与发布测试用例

在根目录依次执行 `npm test`、`npm run build`、`npm run test:dist`、`npm run test:package`。类型检查必须以构建后的 `.d.ts` 为消费对象，不能只依靠源码测试的类型推断。每组 `.mts/.cts` 均需执行；React JSX 另有 `.tsx` 用例。

| 用例 | 优先级 | 目标 | 前置/数据 | 步骤 | 预期/验收 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| PKG-001 | P0 | 源码和测试编译 | 当前锁定依赖；strict、experimentalDecorators | npm test中的typecheck/typecheck:test/typecheck:react | 全部退出0；noUnusedLocals/noImplicitOverride等配置有效；没有以any绕过公共API类型 | A: BUILD、T-CORE、T-REACT |
| PKG-002 | P0 | reactive/batch/类构造泛型 | types/esm.mts、commonjs.cts；对象和装饰类 | 核对对象属性、构造参数、方法参数、batch返回推断；负例错误赋值/构造 | .mts/.cts保持精确类型；错误用法产生预期诊断，不退化为any | A: T-CORE |
| PKG-003 | P0 | Computed只读.value迁移 | computed.mts/.cts | 正例标量/对象/undefined/函数/嵌套；反例value赋值、computed()旧调用、watch(computed) | value类型T正确，仅外壳只读；负例有错；watch要求读取闭包 | A: T-CORE |
| PKG-004 | P1 | watch/useWatch immediate重载 | 缺省/false/true/boolean变量/WatchOptions或undefined | 编译new/old推断和不处理undefined的负例 | 默认/false旧值T；可能immediate时旧值T或undefined；void可用；错误callback类型与选项拒绝；useWatch返回void | A: T-CORE、T-REACT |
| PKG-005 | P0 | storage结构类型、无DOM依赖 | storage.mts/.cts；lib ES2022、types=[]；sync/async/PromiseLike adapter | 编译对象/数组推断；缺name、错type、根基本值、坏getter/setter返回等负例 | 状态保留T；正例全部通过；反例确有诊断；无需DOM/React/localforage声明 | A: T-CORE |
| PKG-006 | P1 | localforage薄包装 | 开发依赖localforage；getItem<string>，async setItem等待后void返回 | typecheck:test包含storage-localforage.ts；错误直接Promise<string> setter对照 | 推荐包装可编译，错误返回类型被拒绝；不据此声称真实IndexedDB已验证 | A: T-LF、T-CORE |
| PKG-007 | P0 | React组件类型与Hook命名 | 18/19匹配类型；esm/commonjs/jsx | 编译RC/RFC必填props、RCC构造/ref/静态；useReactive对象返回；旧useState导入负例 | JSX必填属性保留；不返回tuple；旧useState未导出；各别名类型一致 | A: T-REACT |
| PKG-008 | P1 | Chip/Model/defineModel类型 | features.mts/.cts/.tsx；文本/布尔/数组/数字模型、带label的控件 | 正反例编译：children函数、source/refer、postValue返回、完整tuple、必填业务props、数字事件 | 支持输入通过；数字model直接传DOM事件拒绝；错误转换/缺props拒绝；onChange只读 | A: T-REACT |
| PKG-009 | P1 | useLoading类型 | fn必填/多参数/同步值/Promise；初始true/false/0/2/联合类型 | 推断load返回与loading类型；写stacksCount、错参数、误认为常量类型的负例 | 返回Promise<Awaited<R>>；参数tuple保持；布尔/数字拓宽，联合保持；状态只读 | A: T-REACT |
| PKG-010 | P1 | @loading传统方法类型 | loading.mts/.cts/.tsx，显式泛型/ctx注解/简写 | 编译可选/rest/泛型/重载/继承/静态成员/JSX；同步方法/箭头/getter/错字段负例 | 方法签名保留；类型层拒绝同步方法等；显式ctx类型检查拼写；不要求简写反推完整类字段 | A: T-REACT |
| PKG-011 | P0 | 构建布局与两个Node桥 | dist允许重建；使用当前tsconfig | npm run build；检查esm/cjs所有js/d.ts及cjs/package.json和node.js/node-react.js | 产物齐全；CJS目录type=commonjs；桥接导出与源码一致，target ES2022；只清理项目生成目录 | A: BUILD、PKG |
| PKG-012 | P0 | 公开导出准确、纯CJS可用 | 构建完成；ESM/CJS消费者 | test:dist；CJS加--no-experimental-require-module | 根恰reactive/effect/computed/batch/watch/storage；React十九个及别名准确；require不依赖实验性加载ESM | A: D-CORE、D-REACT |
| PKG-013 | P0 | 混合入口共享内核/绑定 | Node import核心+require React、反方向；同raw/Computed/storage | 对比API引用、proxy身份；跨格式订阅/批次/存储/组件；另独立运行原生ESM图 | Node两个方向共用内核和绑定；原生ESM核心与React配套使用成功；不混用原生ESM与Node桥而要求同内核 | A: D-CORE、D-STORAGE、D-REACT |
| PKG-014 | P0 | 真实tarball与可选依赖隔离 | test:package联网；临时core-only/react18/react19消费者 | dry-run白名单→实际pack/install→行为和类型；安装前全局window/storage getter抛错；清空NODE_PATH | 核心无React/DOM/localforage也成功；模块导入不读浏览器全局；React18/19完整行为均通过；包仅dist/README/package/LICENSE，当前90文件 | A: PKG |
| PKG-015 | P1 | README示例与迁移说明可执行 | README核心、装饰器、storage/localforage、RC、Model、两loading示例 | 复制至最小TS/TSX消费者；fetch示例用可控mock；按例操作；核对.value/useReactive名称 | 示例类型及结果与文档一致；无旧computed()/库useState残留；依赖安装说明准确，不进行真实网络业务请求 | P: T-LF、D-CORE、D-REACT；需逐个摘录README示例完整复跑 |
| PKG-016 | P1 | 内部API/深导入不可误发布 | 六/十九导出列表；stopStorage/toRaw/captureReference等内部符号；exports只有根和/react | 类型负例导入内部符号；安装包尝试受exports限制的深路径；检查无源码/测试/工作区私有文件入包 | 公共入口不导出内部符号；未声明子路径按Node exports拒绝；包文件遵循白名单，测试文档不进入发布包 | P: T-CORE、PKG；补充安装包深路径运行时拒绝断言 |

`@ts-expect-error` 用例通过意味着对应行确实产生类型错误；不可把这些注释一并删除或用 `skipLibCheck:true` 掩盖消费端问题。package脚本的源码测试总数和独立消费者复跑次数分别报告，不能把同一场景三次执行算成三倍功能覆盖。
