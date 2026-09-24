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
  await page.waitForFunction(()=>document.documentElement.dataset.stateReady==="true");
  const state=await page.evaluate(()=>fetch("data/portfolio-state.json",{cache:"no-cache"}).then(r=>r.json()));
  await assert("central portfolio state loads",Boolean(state&&state.academics&&state.research&&state.projects),{asOf:state?.asOf});
  await assert("production state schema is current",state.schemaVersion===2,{schemaVersion:state.schemaVersion});
  const dynamicAudit=await page.locator("[data-state],[data-state-status],[data-state-list-inline]").evaluateAll(nodes=>nodes.map(el=>({
    selector:el.getAttribute("data-state")||el.getAttribute("data-state-status")||el.getAttribute("data-state-list-inline"),
    text:(el.textContent||"").trim()
  })).filter(x=>!x.text||x.text==="—"||/^(?:Loading|undefined|null|NaN|Unknown|TODO|TBD|PLACEHOLDER|N\/A)\b/i.test(x.text)));
  await assert("no unresolved dynamic placeholders after state load",dynamicAudit.length===0,{dynamicAudit});
  const heroStateText=(await page.locator("#profile").innerText()).slice(0,1200);
  await assert("hero current stage propagates from source of truth",heroStateText.includes(state.profile.stage),{heroStateText,stateStage:state.profile.stage});
  await assert("hero avoids stale or unverified academic predictions",!heroStateText.match(/will sit|I plan to|QUALIFIED|ADMITTED|ENROLLED/i),{heroStateText});
  await assert("current status dashboard renders",await page.locator("#current-status").count()===1&&!(await page.locator("#current-status").innerText()).includes("—"),{text:(await page.locator("#current-status").innerText()).slice(0,1400)});
  await assert("30-second reviewer snapshot renders",(await page.locator("#current-status .reviewer-snapshot article").count())===6,{count:await page.locator("#current-status .reviewer-snapshot article").count()});
  await assert("reviewer snapshot WHO is state-driven",(await page.locator("#current-status .reviewer-snapshot article").first().innerText()).includes(state.profile.stage),{who:await page.locator("#current-status .reviewer-snapshot article").first().innerText()});
  const academicDashboardText=await page.locator("#current-academics").innerText();
  await assert("current academics includes school and IITM",academicDashboardText.includes(state.academics.school.shortLabel)&&academicDashboardText.includes(state.academics.iitm.shortLabel),{academicDashboardText});
  await assert("future engineering path stays out of current academics",!academicDashboardText.includes(state.academics.engineering.shortLabel),{academicDashboardText});
  await assert("IITM current status propagates from source of truth",(await page.locator('[data-state-status="academics.iitm.status"]').first().innerText()).trim()===state.academics.iitm.status,{dom:await page.locator('[data-state-status="academics.iitm.status"]').first().innerText(),state:state.academics.iitm.status});
  const expectedIitmActivity=state.presentationModels?.[state.academics.iitm.activityModel]?.[state.academics.iitm.status];
  const renderedIitmActivity=(await page.locator('[data-state-status="academics.iitm.activityStatus"]').innerText()).trim();
  await assert("IITM qualifier activity presentation is derived",renderedIitmActivity===expectedIitmActivity&&renderedIitmActivity==="PREPARING",{expectedIitmActivity,renderedIitmActivity});
  await assert("IITM next state is not duplicated in source data",!Object.prototype.hasOwnProperty.call(state.academics.iitm,"nextState"),{rawIitm:state.academics.iitm});
  const expectedIitmNext=state.transitionModels?.[state.academics.iitm.transitionModel]?.[state.academics.iitm.status]??null;
  const renderedIitmNext=(await page.locator('[data-state="academics.iitm.nextState"]').first().innerText()).trim();
  await assert("IITM next state derives from one current status value",expectedIitmNext===renderedIitmNext,{expectedIitmNext,renderedIitmNext,current:state.academics.iitm.status});
  await assert("engineering current status propagates from source of truth",(await page.locator('[data-state-status="academics.engineering.status"]').first().innerText()).trim()===state.academics.engineering.status,{dom:await page.locator('[data-state-status="academics.engineering.status"]').first().innerText(),state:state.academics.engineering.status});
  await assert("status milestone timeline is generated",(await page.locator("#status-timeline article").count())>=6,{count:await page.locator("#status-timeline article").count()});
  await assert("academic copy has no stale exam prediction",!(await page.locator("#academic-path").innerText()).match(/will sit|I plan to|next month|next year|preparing to/i));
  await assert("site has no stale qualifier-exam prediction",!(await page.locator("body").innerText()).match(/I plan to sit the qualifier|will sit the qualifier examination/i));
  await assert("capability state buckets render",(await page.locator(".capability-state-grid article").count())===3,{count:await page.locator(".capability-state-grid article").count()});
  await assert("portfolio changelog renders",(await page.locator("#portfolio-changelog li").count())>=4,{count:await page.locator("#portfolio-changelog li").count()});
  const changelogText=await page.locator("#portfolio-changelog").textContent();
  await assert("final production pass is recorded",(changelogText||"").includes("FINAL PRODUCTION PASS"),{text:changelogText});
  await assert("international section is future-facing",(await page.locator("text=INTERNATIONAL DIRECTION").count())===1&&!(await page.locator("body").innerText()).includes("INTERNATIONAL STUDY"),{international:await page.locator(".route").innerText()});
  const languageAssessmentText=await page.locator(".language-assessment").textContent();
  await assert("language proficiency is labelled self-assessment",(languageAssessmentText||"").includes("SELF-ASSESSMENT"),{label:languageAssessmentText});
  await page.locator("#iitm-learning").scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.documentElement.dataset.iitmLearningReady==="true");
  const curriculum=await page.evaluate(()=>fetch("data/iitm-curriculum.json",{cache:"no-cache"}).then(r=>r.json()));
  await assert("IITM curriculum data loads",Boolean(curriculum&&curriculum.schemaVersion===2&&curriculum.learningArchitecture?.groups?.length===6&&curriculum.sources?.every(x=>x.url.startsWith("https://study.iitm.ac.in/ds/"))),{verifiedAt:curriculum?.verifiedAt,groups:curriculum?.learningArchitecture?.groups?.length});
  await assert("IITM curriculum source check date is current",curriculum.verifiedAt==="20 SEP 2026"&&(await page.locator("#iitm-curriculum-verified").innerText()).trim()==="20 SEP 2026",{verifiedAt:curriculum.verifiedAt,rendered:await page.locator("#iitm-curriculum-verified").innerText()});
  const iitmMetaAudit=await page.locator("#iitm-learning-mode,#iitm-curriculum-verified").evaluateAll(nodes=>nodes.map(el=>(el.textContent||"").trim()).filter(x=>!x||x==="—"||/^(?:Loading|undefined|null|NaN|Unknown|TODO|TBD|PLACEHOLDER|N\/A)\b/i.test(x)));
  await assert("IITM metadata has no unfinished placeholders",iitmMetaAudit.length===0,{iitmMetaAudit});
  await assert("IITM learning trajectory reflects current programme state",(await page.locator("#iitm-learning [data-state-status=\"academics.iitm.status\"]").first().innerText()).trim()===state.academics.iitm.status);
  await assert("IITM programme lockup is explicit",(await page.locator("#iitm-learning .iitm-program-lockup").innerText()).includes("IIT MADRAS")&&(await page.locator("#iitm-learning .iitm-program-lockup").innerText()).includes("BS in Data Science and Applications"));
  await assert("qualifier-stage trajectory does not claim registered current courses",(await page.locator("#iitm-current-courses .course-state-item").count())===0,{text:await page.locator("#iitm-current-courses").innerText()});
  await assert("qualifier context names official four-course preparation",(await page.locator("#iitm-qualifier-context").innerText()).includes("Mathematics for Data Science I")&&(await page.locator("#iitm-qualifier-context").innerText()).includes("Statistics for Data Science I")&&(await page.locator("#iitm-qualifier-context").innerText()).includes("Computational Thinking")&&(await page.locator("#iitm-qualifier-context").innerText()).includes("English I"),{text:await page.locator("#iitm-qualifier-context").innerText()});
  await assert("IITM learning is grouped into six architecture layers",(await page.locator("#iitm-learning-layers .iitm-layer").count())===6,{count:await page.locator("#iitm-learning-layers .iitm-layer").count()});
  const iitmLayerTitles=await page.locator("#iitm-learning-layers .iitm-layer h3").allTextContents();
  await assert("IITM learning architecture names are distinct",["FOUNDATION","PROGRAMMING","DATA SCIENCE","MACHINE LEARNING / AI","SYSTEMS","ELECTIVE / ADVANCED LEARNING"].every(x=>iitmLayerTitles.includes(x)),{iitmLayerTitles});
  await assert("IITM curriculum stays external to marketing HTML",Boolean(curriculum.courses?.BSCS1002?.name==="Programming in Python"&&curriculum.courses?.BSCS2001?.name==="Database Management Systems"&&curriculum.courses?.BSCS2004?.name==="Machine Learning Foundations"&&curriculum.courses?.BSCS3001?.name==="Software Engineering"),{sample:[curriculum.courses?.BSCS1002?.name,curriculum.courses?.BSCS2001?.name,curriculum.courses?.BSCS2004?.name,curriculum.courses?.BSCS3001?.name]});
  await assert("official course lists are collapsed by default",(await page.locator("#iitm-learning-layers details[open]").count())===0);
  await assert("academic connections are explicit",(await page.locator("#iitm-academic-connections article").count())===5,{count:await page.locator("#iitm-academic-connections article").count()});
  await assert("long-term IITM/electronics intersection is direction-only",(await page.locator("#iitm-long-term-intersection").innerText()).includes("no current-expertise claim")||(await page.locator("#iitm-long-term-intersection").innerText()).includes("Direction only"));
  const heroBeforeBanner=await page.evaluate(()=>{
    const hero=document.querySelector("#profile");
    const banner=document.querySelector(".portfolio-banner");
    return Boolean(hero&&banner&&(hero.compareDocumentPosition(banner)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  await assert("hero precedes decorative identity banner",heroBeforeBanner);
  await assert("standalone portrait removed",await page.locator(".profile-card.portrait,img[src*=profile-]").count()===0);
  await assert("sharing metadata uses supplied banner",(await page.locator('meta[property="og:image"]').getAttribute("content")).endsWith("/mhf-banner-20260924.jpg"));
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
  await assert("academic pathway labels remain precise",academicText.includes("QUALIFIER PATHWAY")&&academicText.includes("PLANNED")&&academicText.includes("PORTAL EVIDENCE")&&academicText.includes("SELF-REPORTED"),{academicText:academicText.slice(0,1200)});
  await assert("selected work contains five anchors",(await page.locator("#selected-work .highlight-card").count())===5,{count:await page.locator("#selected-work .highlight-card").count()});
  await assert("project case studies exist",(await page.locator("#work .case-study-detail").count())===2,{count:await page.locator("#work .case-study-detail").count()});
  await assert("project roles are explicit",(await page.locator('#project-halim dt').allTextContents()).includes("ROLE")&&(await page.locator('#project-study dt').allTextContents()).includes("ROLE"));
  await assert("project states are populated",state.projects.halim.status==="PROTOTYPE"&&state.projects.studysync.status==="OPEN SOURCE",{halim:state.projects.halim.status,studysync:state.projects.studysync.status});
  await assert("project lifecycle transitions are centralized",Object.values(state.projects).every(item=>item.transitionModel==="project"&&state.transitionModels.project?.[item.status]),{projects:state.projects,model:state.transitionModels.project});
  await assert("source-mapped project evidence exists",(await page.locator("#work .source-mapped").count())===2,{count:await page.locator("#work .source-mapped").count()});
  await assert("research dates are prominent",(await page.locator("#research .research-statusbar").count())===2);
  await assert("timeline taxonomy distinguishes project and research",(await page.locator('#experience [data-kind="project"]').count())>=2&&(await page.locator('#experience [data-kind="research"]').count())>=2,{projects:await page.locator('#experience [data-kind="project"]').count(),research:await page.locator('#experience [data-kind="research"]').count()});
  const ogW=await page.locator('meta[property="og:image:width"]').getAttribute("content");
  const ogH=await page.locator('meta[property="og:image:height"]').getAttribute("content");
  await assert("OG dimensions are explicit",ogW==="1672"&&ogH==="941",{ogW,ogH});
  await assert("SEO title is production title",(await page.title())==="Mohammad Hammad Faridi · Student, Builder, Researcher",{title:await page.title()});
  await assert("canonical URL is production URL",(await page.locator('link[rel="canonical"]').getAttribute("href"))==="https://varmad07.github.io/resume/",{canonical:await page.locator('link[rel="canonical"]').getAttribute("href")});
  await assert("meta description is precise",(await page.locator('meta[name="description"]').getAttribute("content"))==="Portfolio of Mohammad Hammad Faridi, a Class 12 PCM student exploring software, data science, AI and electronics through projects, research and structured learning.",{description:await page.locator('meta[name="description"]').getAttribute("content")});
  const ogPhysical=await page.evaluate(async()=>{
    const publicSrc=document.querySelector('meta[property="og:image"]')?.content;
    const src=new URL(publicSrc).pathname.replace(/^\/resume\//,"./");
    return await new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight,src});img.onerror=()=>resolve({w:0,h:0,src});img.src=src;});
  });
  await assert("OG asset matches declared dimensions",ogPhysical.w===Number(ogW)&&ogPhysical.h===Number(ogH),ogPhysical);
  await assert("research status remains explicit",(await page.locator("#research").innerText()).includes("PREPRINT")&&(await page.locator("#research").innerText()).includes("MANUSCRIPT"));
  const researchStatusText=await page.locator("#research-healthcare .research-statusbar").innerText();
  await assert("healthcare research status is fully populated",["PREPRINT","JUN 2026","Zenodo","NOT PEER-REVIEWED","JOURNAL SUBMISSION NOT ACCEPTED"].every(x=>researchStatusText.includes(x)),{researchStatusText});
  await assert("evidence definitions available",await page.locator("#evidence .evidence-help").count()===1);
  await assert("current school evidence is classified",(await page.locator("#ev-edu-002").innerText()).includes("SUPPLIED DOCUMENT")&&(await page.locator("#ev-edu-002").innerText()).includes(state.academics.school.status),{text:await page.locator("#ev-edu-002").innerText()});
  const ogImage=await page.locator('meta[property="og:image"]').getAttribute("content");
  await assert("OG image points to dedicated banner asset",Boolean(ogImage&&ogImage.includes("assets/images/og/mhf-banner-20260924.jpg")),{ogImage});

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

  const headingAudit=await page.evaluate(()=>{
    const headings=[...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(el=>getComputedStyle(el).display!=="none");
    const levels=headings.map(el=>Number(el.tagName[1]));
    const skips=[];
    for(let i=1;i<levels.length;i++) if(levels[i]>levels[i-1]+1) skips.push({from:headings[i-1].textContent.trim(),to:headings[i].textContent.trim(),fromLevel:levels[i-1],toLevel:levels[i]});
    return {h1:headings.filter(el=>el.tagName==="H1").length,skips};
  });
  await assert("heading hierarchy has one H1 and no level skips",headingAudit.h1===1&&headingAudit.skips.length===0,headingAudit);
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
  await assert("second-audit status labels translate to Arabic",(await page.locator(".academic-status-legend span").first().innerText()).trim()==="خبرة حالية",{label:await page.locator(".academic-status-legend span").first().innerText()});
  await assert("IITM trajectory translates to Arabic",(await page.locator("#iitm-learning .section-head h2").innerText()).trim()==="ما الذي يضيفه المنهج",{title:await page.locator("#iitm-learning .section-head h2").innerText()});
  await page.screenshot({path:`${OUT}/desktop-arabic.png`,fullPage:false});
  await page.locator('button[data-lang="ja"]').click();
  await assert("second-audit status labels translate to Japanese",(await page.locator(".academic-status-legend span").first().innerText()).trim()==="現在の経験",{label:await page.locator(".academic-status-legend span").first().innerText()});
  await assert("IITM trajectory translates to Japanese",(await page.locator("#iitm-learning .section-head h2").innerText()).trim()==="このカリキュラムが加えるもの",{title:await page.locator("#iitm-learning .section-head h2").innerText()});
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

  for(const [sel,file] of [["#current-status","desktop-current-status.png"],["#academic-path","desktop-academic-path.png"],["#iitm-learning","desktop-iitm-learning.png"],["#next","desktop-system-layers.png"],["#research","desktop-research.png"],[".dpg","desktop-dpg.png"],["#credentials","desktop-credentials.png"],["#evidence","desktop-evidence.png"]]){
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
    portraitCount:await page.locator(".profile-card.portrait").count(),
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
  await page.waitForFunction(()=>document.documentElement.dataset.stateReady==="true");
  await assert("reviewer mode includes current status fast path",(await page.locator('#reviewer-mode-note a[href="#current-status"]').count())===1);
  await assert("reviewer mode surfaces current state",(await page.locator("#reviewer-current-state").innerText()).trim().length>0,{state:await page.locator("#reviewer-current-state").innerText()});
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

  await page.locator("#iitm-learning").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const mobileLayer=await page.locator("#iitm-learning-layers .iitm-layer").first().boundingBox();
  await assert("mobile IITM learning layers stack",Boolean(mobileLayer&&mobileLayer.width>330&&mobileLayer.width<390),{mobileLayer});
  await page.locator("#iitm-learning").screenshot({path:`${OUT}/mobile-iitm-learning.png`});

  await page.locator(".portfolio-banner").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const mobileImages=await imageStatus(page);
  const broken=mobileImages.filter(i=>!i.complete||i.naturalWidth===0);
  await assert("mobile images load",broken.length===0,{broken});
  report.mobile={
    bannerSrc:await page.locator(".portfolio-banner img").evaluate(i=>i.currentSrc),
    portraitCount:await page.locator(".profile-card.portrait").count(),
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
