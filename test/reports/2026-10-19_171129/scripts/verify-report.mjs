import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {chromium} from '../.runtime/node_modules/playwright-core/index.mjs'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),data=JSON.parse(readFileSync(resolve(report,'results.json'),'utf8'))
assert.equal(data.cases.length,242);assert.deepEqual(data.counts,{'通过':237,'失败':2,'未执行':3})
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[]
page.on('pageerror',e=>errors.push(String(e)))
try{
 await page.goto(pathToFileURL(resolve(report,'report.html')).href)
 assert.equal(await page.locator('tr[data-case]').count(),242)
 const hrefs=await page.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),broken=[]
 for(const href of hrefs){if(href.startsWith('#')){if(!await page.locator(href).count())broken.push(href)}else if(!/^https?:/.test(href)&&!existsSync(resolve(report,href)))broken.push(href)}
 const md=readFileSync(resolve(report,'report.md'),'utf8');for(const match of md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){const href=match[1];if(!/^https?:|^#/.test(href)&&!existsSync(resolve(report,href)))broken.push(href)}
 assert.deepEqual(broken,[])
 await page.screenshot({path:resolve(report,'evidence/report-desktop.png')})
 await page.locator('#case-status').selectOption('失败');assert.equal(await page.locator('tr[data-case]:visible').count(),2)
 await page.locator('#case-status').selectOption('未执行');assert.equal(await page.locator('tr[data-case]:visible').count(),3)
 await page.locator('#case-status').selectOption('');await page.locator('#case-search').fill('D04');assert.equal(await page.locator('tr[data-case]:visible').count(),2)
 await page.locator('#case-search').fill('');assert.equal(await page.locator('tr[data-case]:visible').count(),242)
 await page.locator('tr[data-case="CORE-037"] summary').click();assert.ok(await page.locator('tr[data-case="CORE-037"] details').getAttribute('open')!==null)
 await page.locator('#D04').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(report,'evidence/report-defect.png')})
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(report,'evidence/report-mobile.png')});const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(width.scroll<=width.client+1,JSON.stringify(width));assert.deepEqual(errors,[])
 const result={cases:242,uniqueIds:242,localLinks:hrefs.length,brokenLinks:broken,failedFilter:2,notExecutedFilter:3,D04Search:2,allRestored:242,mobileWidth:width,pageErrors:errors,validatedAt:new Date().toISOString()}
 writeFileSync(resolve(report,'evidence/report-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{await browser.close()}
