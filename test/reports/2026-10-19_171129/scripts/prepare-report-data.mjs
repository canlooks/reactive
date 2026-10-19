import {readFileSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const here=dirname(fileURLToPath(import.meta.url)),report=resolve(here,'..'),root=resolve(report,'../../..')
const previous=readFileSync(resolve(root,'test/reports/2026-10-16_170124/scripts/report.mjs'),'utf8')
const mapping=previous.slice(previous.indexOf('const supplemental={'),previous.indexOf('const cases=[]')).replace('const supplemental=','const descriptions=')
const corrections={
 'UI-022':'非法元素形状、portal、file input、全部非法 valueProp（含 null）均拒绝；随后合法输入正常。D03 修复维持有效。',
 'QUAL-010':'1000 轮 effect/watch 创建与停止、React 19 源码和 React 18 实际包各 1000 轮 RC/Chip/Model/loading 挂载卸载通过；各存 3 份堆快照。独立 derived GC 套件 ESM/CJS 各 9 项通过，D02 未复现。堆大小仅作诊断，不构成绝对无泄漏证明。',
 'QUAL-006':'Windows 与 Ubuntu/WSL Node 24 完整基线及安装包测试通过；相同 Windows tarball 在 Linux 消费成功；esbuild 0.28.2 dev/prod 和原生浏览器 ESM 通过。macOS/Safari 未验证，若将它们纳入发布目标仍须追加验收。',
 'QUAL-001':'三引擎 × React 18/19 × dev/prod 共 12 组常规表单、Unicode/emoji、Chip、乱序 loading 通过。系统级 IME 与真实系统剪贴板粘贴未执行；insertText 仅是自动化文本输入，整行不能算通过。Windows Firefox 启动阻塞，Firefox 结果来自 Linux。',
 'QUAL-016':'validate-docs 通过；Linux 隔离 npm ci 和 tarball 消费通过。计划要求未参与开发的测试人员进行独立交付演练，该人工验收未执行。'
}
writeFileSync(resolve(here,'case-notes.mjs'),mapping+'\nObject.assign(descriptions,'+JSON.stringify(corrections,null,2)+')\nexport default descriptions\n')
writeFileSync(resolve(report,'evidence/suggested-D04.patch'),`diff --git a/src/reactive.ts b/src/reactive.ts
--- a/src/reactive.ts
+++ b/src/reactive.ts
@@
             const success = Reflect.set(target, key, normalized, receiver)
-            if (success && target === toRaw(receiver)) {
+            if (target === toRaw(receiver)) {
                 recordChange(target, key, before, () => propertyState(target, key))
                 for (const [implicitKey, state] of implicit) {
                     recordChange(target, implicitKey, state, () => propertyState(target, implicitKey))
`)
console.log('Prepared review-only D04 patch sketch and current case notes; production source unchanged.')
