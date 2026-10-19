import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {chromium} from '../.runtime/node_modules/playwright-core/index.mjs'
const report=resolve(dirname(fileURLToPath(import.meta.url)),'..'),results=JSON.parse(readFileSync(resolve(report,'results.json'),'utf8'))
assert.equal(results.cases.length,240);assert.equal(new Set(results.cases.map(c=>c.id)).size,240)
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(String(e)))
try{
 await page.goto(pathToFileURL(resolve(report,'report.html')).href);assert.equal(await page.locator('tr[data-case]').count(),240)
 const hrefs=await page.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));const broken=[];for(const href of hrefs){if(href.startsWith('#')){if(!await page.locator(href).count())broken.push(href)}else if(!/^https?:/.test(href)&&!existsSync(resolve(report,href)))broken.push(href)}assert.deepEqual(broken,[])
 await page.screenshot({path:resolve(report,'evidence/report-desktop.png')})
 await page.locator('#case-status').selectOption('失败');assert.equal(await page.locator('tr[data-case]:visible').count(),2)
 await page.locator('#case-status').selectOption('');await page.locator('#case-search').fill('D02');assert.equal(await page.locator('tr[data-case]:visible').count(),1)
 await page.locator('#case-search').fill('');assert.equal(await page.locator('tr[data-case]:visible').count(),240)
 await page.locator('tr[data-case="QUAL-010"] summary').click();assert.ok(await page.locator('tr[data-case="QUAL-010"] details').getAttribute('open')!==null)
 await page.locator('#D02').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(report,'evidence/report-defect.png')})
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));await page.screenshot({path:resolve(report,'evidence/report-mobile.png')});assert.ok(width.scroll<=width.client+1,JSON.stringify(width))
 assert.deepEqual(errors,[]);writeFileSync(resolve(report,'evidence/report-validation.json'),JSON.stringify({cases:240,uniqueIds:240,localLinks:hrefs.length,brokenLinks:broken,failedFilter:2,defectSearch:1,allRestored:240,mobileWidth:width,pageErrors:errors,validatedAt:new Date().toISOString()},null,2));console.log('Report verified: 240 rows, all local links, filters, details, desktop/mobile and no page errors.')
}finally{await browser.close()}
