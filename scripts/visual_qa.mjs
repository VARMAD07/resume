import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE="http://127.0.0.1:8080/index.html";
const OUT="visual-qa";
await fs.mkdir(OUT,{recursive:true});
const report={};
const browser=await chromium.launch({headless:true});

async function makePage(viewport){
  const page=await browser.newPage({viewport});
  const consoleErrors=[];
  const pageErrors=[];
  const failedRequests=[];
  page.on("console",m=>{if(m.type()==="error") consoleErrors.push(m.text());});
  page.on("pageerror",e=>pageErrors.push(String(e)));
  page.on("requestfailed",r=>failedRequests.push({url:r.url(),failure:r.failure()}));
  return {page,consoleErrors,pageErrors,failedRequests};
}
async function imageStatus(page){
  return page.locator("img").evaluateAll(imgs=>imgs.map(i=>({
    alt:i.alt,
    src:i.currentSrc||i.src,
    complete:i.complete,
    naturalWidth:i.naturalWidth,
    naturalHeight:i.naturalHeight
  })));
}
async function assert(name,condition,details={}){
  report.assertions ??=[];
  report.assertions.push({name,pass:Boolean(condition),...details});
  if(!condition) report.failed=true;
}

{
  const {page,consoleErrors,pageErrors,failedRequests}=await makePage({width:1440,height:1000});
  const response=await page.goto(BASE,{waitUntil:"networkidle"});
  await page.screenshot({path:`${OUT}/desktop-top.png`,fullPage:false});
  await assert("desktop HTTP 200",response?.status()===200,{status:response?.status()});
  await assert("desktop no horizontal overflow",
    await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),
    {scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),innerWidth:await page.evaluate(()=>innerWidth)}
  );
  await assert("desktop no page errors",pageErrors.length===0,{pageErrors});
  await assert("desktop no console errors",consoleErrors.length===0,{consoleErrors});
  await assert("desktop no failed requests",failedRequests.length===0,{failedRequests});

  // Force lazy images to load by walking the page.
  for(const selector of ["#research",".dpg","#credentials","#evidence"]){
    const loc=page.locator(selector);
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
  }
  const images=await imageStatus(page);
  const broken=images.filter(i=>!i.complete||i.naturalWidth===0);
  await assert("all displayed images load",broken.length===0,{broken});

  await page.keyboard.press("Control+K");
  await assert("search dialog opens",await page.locator("#search-dialog").evaluate(d=>d.open));
  await assert("search input receives focus",(await page.evaluate(()=>document.activeElement?.id))==="search-input");
  await page.locator('#search-dialog button[aria-label="Close"]').click();

  const beforeTheme=await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme").click();
  const afterTheme=await page.locator("html").getAttribute("data-theme");
  await assert("theme switch works",beforeTheme!==afterTheme,{beforeTheme,afterTheme});
  await page.locator("#theme").click();

  await page.locator('button[data-lang="ar"]').click();
  await assert("Arabic switches RTL",(await page.locator("html").getAttribute("dir"))==="rtl",{
    lang:await page.locator("html").getAttribute("lang"),
    nav:await page.locator(".desktop-nav a").first().innerText()
  });
  await page.screenshot({path:`${OUT}/desktop-arabic.png`,fullPage:false});
  await page.locator('button[data-lang="ja"]').click();
  await assert("Japanese language switch works",(await page.locator("html").getAttribute("lang"))==="ja",{
    dir:await page.locator("html").getAttribute("dir"),
    nav:await page.locator(".desktop-nav a").first().innerText()
  });
  await page.locator('button[data-lang="en"]').click();

  const badges=await page.locator("#credentials .credential-art").evaluateAll(imgs=>imgs.map(i=>({src:i.currentSrc||i.src,w:i.naturalWidth,h:i.naturalHeight})));
  await assert("five credential badges render",badges.length===5 && badges.every(x=>x.w>0),{badges});

  for(const [sel,file] of [["#research","desktop-research.png"],[".dpg","desktop-dpg.png"],["#credentials","desktop-credentials.png"],["#evidence","desktop-evidence.png"]]){
    const loc=page.locator(sel); await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await loc.screenshot({path:`${OUT}/${file}`});
  }

  report.desktop={
    title:await page.title(),
    documentHeight:await page.evaluate(()=>document.documentElement.scrollHeight),
    bannerSrc:await page.locator(".portfolio-banner img").evaluate(i=>i.currentSrc),
    profileSrc:await page.locator(".profile-card img").evaluate(i=>i.currentSrc),
    imageCount:images.length
  };
  await page.close();
}

{
  const {page,consoleErrors,pageErrors,failedRequests}=await makePage({width:1440,height:1000});
  const response=await page.goto(BASE+"?view=reviewer",{waitUntil:"networkidle"});
  const optional=page.locator(".reviewer-optional");
  const visibleOptional=await optional.evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=="none").length);
  await assert("reviewer mode HTTP 200",response?.status()===200,{status:response?.status()});
  await assert("reviewer mode activates",(await page.locator("body").getAttribute("data-view"))==="reviewer");
  await assert("reviewer notice visible",await page.locator("#reviewer-mode-note").isVisible());
  await assert("reviewer optional sections hidden",visibleOptional===0,{total:await optional.count(),visible:visibleOptional});
  await assert("reviewer no page errors",pageErrors.length===0,{pageErrors});
  await assert("reviewer no console errors",consoleErrors.length===0,{consoleErrors});
  await assert("reviewer no failed requests",failedRequests.length===0,{failedRequests});
  await page.screenshot({path:`${OUT}/reviewer-top.png`,fullPage:false});
  await page.close();
}

{
  const {page,consoleErrors,pageErrors,failedRequests}=await makePage({width:390,height:844});
  const response=await page.goto(BASE,{waitUntil:"networkidle"});
  await assert("mobile HTTP 200",response?.status()===200,{status:response?.status()});
  await assert("mobile no horizontal overflow",
    await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),
    {scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),innerWidth:await page.evaluate(()=>innerWidth)}
  );
  await assert("mobile no page errors",pageErrors.length===0,{pageErrors});
  await assert("mobile no console errors",consoleErrors.length===0,{consoleErrors});
  await assert("mobile no failed requests",failedRequests.length===0,{failedRequests});
  await page.screenshot({path:`${OUT}/mobile-top.png`,fullPage:false});

  await page.locator("#menu").click();
  await assert("mobile menu opens",await page.locator("#mobile-nav").isVisible(),{links:await page.locator("#mobile-nav a").count()});
  await page.screenshot({path:`${OUT}/mobile-menu.png`,fullPage:false});
  await page.locator("#mobile-nav a").first().click();

  await page.locator("#credentials").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await assert("mobile credentials use one column",
    (await page.locator("#credentials .credential-grid article").first().boundingBox())?.width > 300,
    {grid:await page.locator("#credentials .credential-grid").evaluate(e=>getComputedStyle(e).gridTemplateColumns)}
  );
  await page.locator("#credentials").screenshot({path:`${OUT}/mobile-credentials.png`});

  const mobileImages=await imageStatus(page);
  const broken=mobileImages.filter(i=>!i.complete||i.naturalWidth===0);
  await assert("mobile images load",broken.length===0,{broken});
  report.mobile={
    bannerSrc:await page.locator(".portfolio-banner img").evaluate(i=>i.currentSrc),
    profileSrc:await page.locator(".profile-card img").evaluate(i=>i.currentSrc),
    scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),
    innerWidth:await page.evaluate(()=>innerWidth)
  };

  await page.emulateMedia({media:"print"});
  await assert("print hides navigation",(await page.locator(".topbar").evaluate(e=>getComputedStyle(e).display))==="none");
  await assert("print hides decorative banner",(await page.locator(".portfolio-banner").evaluate(e=>getComputedStyle(e).display))==="none");
  await assert("print hides hero side",(await page.locator(".hero-side").evaluate(e=>getComputedStyle(e).display))==="none");
  await page.close();
}

await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failed) process.exit(1);
