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
  const heroBeforeBanner=await page.evaluate(()=>{
    const hero=document.querySelector("#profile");
    const banner=document.querySelector(".portfolio-banner");
    return Boolean(hero&&banner&&(hero.compareDocumentPosition(banner)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  await assert("hero precedes decorative identity banner",heroBeforeBanner);
  const selectedBeforeBanner=await page.evaluate(()=>{
    const selected=document.querySelector("#selected-work");
    const banner=document.querySelector(".portfolio-banner");
    return Boolean(selected&&banner&&(selected.compareDocumentPosition(banner)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  await assert("selected work precedes decorative identity banner",selectedBeforeBanner);
  const heroText=await page.locator("#profile").innerText();
  await assert("hero communicates student builder researcher",heroText.includes("STUDENT")&&heroText.includes("BUILDER")&&heroText.includes("RESEARCHER"),{heroText:heroText.slice(0,300)});
  await assert("hero communicates software data electronics",heroText.includes("Software")||heroText.includes("SOFTWARE"),{heroText:heroText.slice(0,400)});
  const academicText=await page.locator("#academic-path").innerText();
  await assert("academic pathway labels remain precise",academicText.includes("admissions/qualifier")&&academicText.includes("PLANNED IN PARALLEL"),{academicText:academicText.slice(0,900)});
  await assert("selected work contains five anchors",(await page.locator("#selected-work .highlight-card").count())===5,{count:await page.locator("#selected-work .highlight-card").count()});
  await assert("project case studies exist",(await page.locator("#work .case-study-detail").count())===2,{count:await page.locator("#work .case-study-detail").count()});
  await assert("source-mapped project evidence exists",(await page.locator("#work .source-mapped").count())===2,{count:await page.locator("#work .source-mapped").count()});
  await assert("research dates are prominent",(await page.locator("#research .research-statusbar").count())===2);
  await assert("timeline taxonomy distinguishes project and research",(await page.locator('#experience [data-kind="project"]').count())===1&&(await page.locator('#experience [data-kind="research"]').count())===2);
  const ogW=await page.locator('meta[property="og:image:width"]').getAttribute("content");
  const ogH=await page.locator('meta[property="og:image:height"]').getAttribute("content");
  await assert("OG dimensions are explicit",ogW==="1200"&&ogH==="630",{ogW,ogH});
  await assert("research status remains explicit",(await page.locator("#research").innerText()).includes("PREPRINT")&&(await page.locator("#research").innerText()).includes("MANUSCRIPT"));
  await assert("evidence definitions available",await page.locator("#evidence .evidence-help").count()===1);
  const ogImage=await page.locator('meta[property="og:image"]').getAttribute("content");
  await assert("OG image points to dedicated 1200x630 asset",Boolean(ogImage&&ogImage.includes("assets/images/og/mhf-og-v3.webp")),{ogImage});

  const headerChecks=await page.locator(".section-head").evaluateAll(headers=>headers.map((h,index)=>{
    const title=h.querySelector("h2");
    const label=h.querySelector(":scope > p:first-child");
    const intro=title?.nextElementSibling?.tagName==="P"?title.nextElementSibling:null;
    const meta=h.querySelector(".verification-stamp");
    const box=e=>e?e.getBoundingClientRect():null;
    const tb=box(title),lb=box(label),ib=box(intro),mb=box(meta);
    const overlap=(a,b)=>a&&b&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
    return {
      index,
      title:title?.textContent?.trim(),
      titleBox:tb?{x:tb.x,y:tb.y,width:tb.width,height:tb.height}:null,
      labelBox:lb?{x:lb.x,y:lb.y,width:lb.width,height:lb.height}:null,
      introBox:ib?{x:ib.x,y:ib.y,width:ib.width,height:ib.height}:null,
      metaBox:mb?{x:mb.x,y:mb.y,width:mb.width,height:mb.height}:null,
      titleLabelOverlap:overlap(tb,lb),
      titleIntroOverlap:overlap(tb,ib),
      introMetaOverlap:overlap(ib,mb),
      alignedIntro:!ib||Math.abs(ib.x-tb.x)<2,
      titleInContentColumn:!lb||tb.x>lb.x+lb.width
    };
  }));
  const badHeaders=headerChecks.filter(h=>h.titleLabelOverlap||h.titleIntroOverlap||h.introMetaOverlap||!h.alignedIntro||!h.titleInContentColumn);
  await assert("section headers assemble without overlap",badHeaders.length===0,{badHeaders});
  const nextHeader=headerChecks.find(h=>h.title?.includes("Across software and silicon"));
  await assert("system layers title has usable desktop width",Boolean(nextHeader&&nextHeader.titleBox.width>420),{nextHeader});
  const evidenceHeader=headerChecks.find(h=>h.title?.includes("Verification centre"));
  await assert("verification metadata sits below introduction",Boolean(evidenceHeader&&evidenceHeader.metaBox&&evidenceHeader.introBox&&evidenceHeader.metaBox.y>=evidenceHeader.introBox.y+evidenceHeader.introBox.height-1),{evidenceHeader});

  // Force lazy images to load by walking the page.
  for(const selector of ["#research",".dpg","#credentials","#evidence"]){
    const loc=page.locator(selector);
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
  }
  const images=await imageStatus(page);
  const broken=images.filter(i=>!i.complete||i.naturalWidth===0);
  await assert("all displayed images load",broken.length===0,{broken});

  await page.evaluate(()=>{window.scrollTo(0,0);document.activeElement?.blur();});
  await page.keyboard.press("Tab");
  await assert("skip link is first keyboard target",(await page.evaluate(()=>document.activeElement?.classList.contains("skip")))===true,{active:await page.evaluate(()=>document.activeElement?.outerHTML)});
  await page.keyboard.press("Enter");
  await assert("skip link moves focus to main",(await page.evaluate(()=>document.activeElement?.id))==="main",{active:await page.evaluate(()=>document.activeElement?.id)});
    await page.keyboard.press("Control+K");
  await page.waitForTimeout(80);
  await assert("search dialog opens",await page.locator("#search-dialog").evaluate(d=>d.open));
  await assert("search input receives focus",(await page.evaluate(()=>document.activeElement?.id))==="search-input",{activeElement:await page.evaluate(()=>document.activeElement?.id)});
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
  await page.emulateMedia({reducedMotion:"reduce"});
  const reducedMotion=await page.evaluate(()=>{
    const el=document.querySelector(".case");
    const style=getComputedStyle(el);
    return {transitionDuration:style.transitionDuration,animationDuration:style.animationDuration,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior};
  });
  await assert("reduced motion disables transitions",reducedMotion.transitionDuration==="0s"&&reducedMotion.animationDuration==="0s",{reducedMotion});
  await assert("reduced motion disables smooth scrolling",reducedMotion.scrollBehavior==="auto",{reducedMotion});
  await page.emulateMedia({reducedMotion:"no-preference"});

  const badges=await page.locator("#credentials .credential-art").evaluateAll(imgs=>imgs.map(i=>({src:i.currentSrc||i.src,w:i.naturalWidth,h:i.naturalHeight})));
  await assert("five credential badges render",badges.length===5 && badges.every(x=>x.w>0),{badges});

  for(const [sel,file] of [["#next","desktop-system-layers.png"],["#research","desktop-research.png"],[".dpg","desktop-dpg.png"],["#credentials","desktop-credentials.png"],["#evidence","desktop-evidence.png"]]){
    const loc=page.locator(sel); await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await loc.screenshot({path:`${OUT}/${file}`});
  }

  // Dark-mode regression shots for the exact editorial sections most likely to expose assembly issues.
  await page.locator("#theme").click();
  await page.waitForTimeout(120);
  for(const [sel,file] of [["#next","desktop-dark-system-layers.png"],[".dpg","desktop-dark-dpg.png"],["#evidence","desktop-dark-evidence.png"]]){
    const loc=page.locator(sel); await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); await loc.screenshot({path:`${OUT}/${file}`});
  }
  await page.locator("#theme").click();

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

  await page.locator(".dpg").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.locator("#credentials").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await assert("mobile credentials use one column",
    (await page.locator("#credentials .credential-grid article").first().boundingBox())?.width > 300,
    {grid:await page.locator("#credentials .credential-grid").evaluate(e=>getComputedStyle(e).gridTemplateColumns)}
  );
  await page.locator("#credentials").screenshot({path:`${OUT}/mobile-credentials.png`});

  await page.locator(".portfolio-banner").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
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


// Production responsive matrix: explicit breakpoints required by the portfolio spec.
const requiredViewports=[
  {name:"320",width:320,height:760},
  {name:"375",width:375,height:812},
  {name:"430",width:430,height:932},
  {name:"768",width:768,height:1024},
  {name:"1024",width:1024,height:900},
  {name:"1920",width:1920,height:1080}
];
for(const vp of requiredViewports){
  const {page,consoleErrors,pageErrors,failedRequests}=await makePage({width:vp.width,height:vp.height});
  const response=await page.goto(BASE,{waitUntil:"networkidle"});
  const dims=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,scrollHeight:document.documentElement.scrollHeight}));
  await assert(`viewport ${vp.name} HTTP 200`,response?.status()===200,{status:response?.status()});
  await assert(`viewport ${vp.name} no horizontal overflow`,dims.scrollWidth<=dims.innerWidth+1,dims);
  await assert(`viewport ${vp.name} no page errors`,pageErrors.length===0,{pageErrors});
  await assert(`viewport ${vp.name} no console errors`,consoleErrors.length===0,{consoleErrors});
  await assert(`viewport ${vp.name} no failed requests`,failedRequests.length===0,{failedRequests});
  const heroBox=await page.locator("#profile").boundingBox();
  const heroTitle=await page.locator("#profile h1").boundingBox();
  await assert(`viewport ${vp.name} hero title visible`,Boolean(heroBox&&heroTitle&&heroTitle.width>0&&heroTitle.height>0),{heroBox,heroTitle});
  const selected=page.locator("#selected-work");
  await selected.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const firstCard=await selected.locator(".highlight-card").first().boundingBox();
  await assert(`viewport ${vp.name} selected work readable`,Boolean(firstCard&&firstCard.width>=Math.min(240,vp.width-80)),{firstCard});
  await page.close();
}

await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failed) process.exit(1);
