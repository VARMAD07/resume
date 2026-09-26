import {chromium} from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base=process.env.PORTFOLIO_URL||"http://127.0.0.1:8080/index.html";
await fs.mkdir("visual-qa",{recursive:true});
const browser=await chromium.launch({headless:true});
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:"block"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(base);
 await page.waitForFunction(()=>document.documentElement.dataset.stateReady==="true"&&document.documentElement.dataset.languageReady==="en");
 const initial=await page.locator("[data-i18n]").allTextContents();
 const rawState=await page.evaluate(()=>fetch("data/portfolio-state.json").then(r=>r.text()));
 const sourceNames=await page.locator("#profile h1").innerText();
 for(const language of ["ar","ja","en"]){
  await page.locator('[data-lang="'+language+'"]').click();
  await page.waitForFunction(l=>document.documentElement.dataset.languageReady===l,language);
  check(await page.locator("html").getAttribute("dir")===(language==="ar"?"rtl":"ltr"),language+" direction");
  check(await page.locator('[data-lang="'+language+'"]').getAttribute("aria-pressed")==="true",language+" selected button");
  check(await page.locator("#profile h1").innerText()===sourceNames,language+" identity preserved");
  if(language!=="en"){
   const audit=await page.evaluate(async l=>{
    const map=await fetch("translations/"+l+".json").then(r=>r.json());
    return [...document.querySelectorAll("[data-i18n]")].filter(el=>typeof map[el.dataset.i18n]!=="string"||el.textContent!==map[el.dataset.i18n]).map(el=>el.dataset.i18n);
   },language);
   check(audit.length===0,language+" complete keyed translations: "+audit.join(", "));
   const status=await page.locator('[data-state-status="academics.iitm.status"]').first().innerText();
   check(status!=="QUALIFIER PATHWAY",language+" translated qualifier status");
   check((await page.locator('[data-state-status="academics.iitm.status"]').first().getAttribute("data-status"))==="qualifier-pathway",language+" canonical status unchanged");
   await page.locator("#iitm-learning").scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.documentElement.dataset.iitmLearningReady==="true");
   check(!((await page.locator("#iitm-learning-layers").innerText()).includes("Mathematics, statistics")),language+" curriculum explanations translated");
   check(!((await page.locator("#iitm-upcoming-courses").innerText()).includes("PLANNED")),language+" course statuses translated");
   await page.locator("#search-button").click();
   await page.locator("#search-input").fill(language==="ar"?"البحث":"研究");
   check(await page.locator("#search-results a").count()>0,language+" native search");
   await page.locator("#search-dialog header button").click();
   await page.waitForFunction(()=>!document.getElementById("search-dialog").open);
  }
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),language+" desktop overflow");
  await page.screenshot({path:"visual-qa/language-"+language+".png"});
 }
 check(JSON.stringify(await page.locator("[data-i18n]").allTextContents())===JSON.stringify(initial),"English round trip restores all keyed text");
 check(await page.evaluate(()=>fetch("data/portfolio-state.json").then(r=>r.text()))===rawState,"No factual state mutation");
 for(const language of ["ar","ja"]){
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-lang="'+language+'"]').click();
  await page.waitForFunction(l=>document.documentElement.dataset.languageReady===l,language);
  await page.locator("#record").scrollIntoViewIfNeeded().catch(()=>{});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),language+" mobile overflow");
  await page.screenshot({path:"visual-qa/mobile-language-"+language+".png"});
 }
 check(errors.length===0,"No page errors: "+errors.join("; "));
 await context.close();

 // An obsolete, failed request must not undo a newer selection.
 const raceContext=await browser.newContext({serviceWorkers:"block"});
 const race=await raceContext.newPage();
 await race.route("**/translations/ar.json",async route=>{await new Promise(r=>setTimeout(r,450));await route.abort();});
 await race.goto(base);
 await race.waitForFunction(()=>document.documentElement.dataset.languageReady==="en");
 await race.locator('[data-lang="ar"]').click();
 await race.locator('[data-lang="ja"]').click();
 await race.waitForFunction(()=>document.documentElement.dataset.languageReady==="ja");
 await race.waitForTimeout(600);
 check(await race.locator("html").getAttribute("lang")==="ja","Failed stale request cannot reset Japanese");
 await race.locator('[data-lang="ar"]').click();
 await race.waitForFunction(()=>document.documentElement.dataset.languageError==="ar");
 check(await race.locator("html").getAttribute("lang")==="ja","Failed new request preserves current language");
 check(await race.locator("#toast").isVisible(),"Language failure announced");
 await raceContext.close();

 const blockedContext=await browser.newContext({serviceWorkers:"block"});
 await blockedContext.addInitScript(()=>{
  Storage.prototype.getItem=()=>{throw new Error("storage disabled");};
  Storage.prototype.setItem=()=>{throw new Error("storage disabled");};
 });
 const blocked=await blockedContext.newPage();
 await blocked.goto(base);
 await blocked.waitForFunction(()=>document.documentElement.dataset.languageReady==="en");
 await blocked.locator('[data-lang="ja"]').click();
 await blocked.waitForFunction(()=>document.documentElement.dataset.languageReady==="ja");
 check(true,"Language controls work with storage disabled");
 await blockedContext.close();
 console.log("PASS: "+checks+" localization checks");
}finally{await browser.close();}
