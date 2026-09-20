const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const EN_BASE=Object.fromEntries(
  [...document.querySelectorAll("[data-i18n]")].map(el=>[el.dataset.i18n,el.textContent])
);
const D={en:EN_BASE};
const LANGS=new Set(["en","ar","ja"]);
let lang=localStorage.getItem("mhf-lang")||"en";
let theme=localStorage.getItem("mhf-theme")||"home";
let langInitialized=false;

async function languageMap(code){
  if(D[code]) return D[code];
  const response=await fetch(`translations/${code}.json`,{cache:"force-cache"});
  if(!response.ok) throw new Error(`Language file unavailable: ${code}`);
  D[code]=await response.json();
  return D[code];
}

async function applyLang(next){
  const requested=LANGS.has(next)?next:"en";
  lang=requested;
  localStorage.setItem("mhf-lang",lang);
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  document.querySelectorAll(".languages button").forEach(b=>b.classList.toggle("active",b.dataset.lang===lang));
  if(requested==="en"&&!langInitialized){
    langInitialized=true;
    return;
  }
  try{
    const map=await languageMap(lang);
    if(lang!==requested) return;
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const value=map[el.dataset.i18n] ?? EN_BASE[el.dataset.i18n];
      if(value!=null) el.textContent=value;
    });
    langInitialized=true;
    rerenderIitmLearning();
  }catch{
    if(requested!=="en"){
      lang="en";
      localStorage.setItem("mhf-lang","en");
      document.documentElement.lang="en";
      document.documentElement.dir="ltr";
      document.querySelectorAll(".languages button").forEach(b=>b.classList.toggle("active",b.dataset.lang==="en"));
      document.querySelectorAll("[data-i18n]").forEach(el=>{
        const value=EN_BASE[el.dataset.i18n];
        if(value!=null) el.textContent=value;
      });
      rerenderIitmLearning();
    }
  }
}

function applyTheme(next){
  theme=next==="lab"?"lab":"home";
  localStorage.setItem("mhf-theme",theme);
  document.documentElement.dataset.theme=theme;
  $("#theme").setAttribute("aria-pressed",String(theme==="lab"));
}

let portfolioState=null;
let iitmCurriculum=null;
const getState=(path,root=portfolioState)=>path.split(".").reduce((value,key)=>value?.[key],root);
const statusSlug=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const isExternalHref=href=>/^https?:\/\//.test(href||"");

const uiText=(key,fallback)=>D[lang]?.[key]??EN_BASE[key]??fallback;
let iitmModule=null;
const rerenderIitmLearning=()=>{
  if(iitmModule&&iitmCurriculum&&portfolioState) iitmModule.renderIitmLearning(iitmCurriculum,portfolioState,uiText);
};
async function loadIitmCurriculum(){
  try{
    const [module,response]=await Promise.all([
      import("./iitm-learning.js"),
      fetch("data/iitm-curriculum.json",{cache:"no-cache"})
    ]);
    if(!response.ok) throw new Error(`curriculum HTTP ${response.status}`);
    iitmModule=module;
    iitmCurriculum=await response.json();
    rerenderIitmLearning();
  }catch(error){
    console.error("IITM curriculum data unavailable",error);
    document.documentElement.dataset.iitmLearningReady="error";
  }
}

function renderStatusLine(container,label,status,date,evidenceType){
  const row=document.createElement("p");
  const name=document.createElement("span"); name.textContent=label;
  const badge=document.createElement("b"); badge.textContent=status; badge.dataset.status=statusSlug(status);
  const when=document.createElement("small"); when.textContent=[date,evidenceType].filter(Boolean).join(" · ");
  row.append(name,badge,when);
  container.append(row);
}
function renderHistory(el,item){
  el.replaceChildren();
  (item?.history||[]).forEach((entry,index,arr)=>{
    const li=document.createElement("li");
    if(index===arr.length-1&&entry.status===item.status) li.classList.add("current");
    const date=document.createElement("time"); date.textContent=entry.date;
    const status=document.createElement("b"); status.textContent=entry.status; status.dataset.status=statusSlug(entry.status);
    const evidence=document.createElement("span"); evidence.textContent=entry.evidenceType;
    li.append(date,status,evidence);
    if(entry.note){const note=document.createElement("small");note.textContent=entry.note;li.append(note);}
    el.append(li);
  });
}
function collectMilestones(state){
  const groups=[state.academics,state.projects,state.research];
  const rows=[];
  for(const group of groups){
    for(const item of Object.values(group||{})){
      (item.history||[]).forEach((entry,index,arr)=>rows.push({
        label:item.label,category:item.category,status:entry.status,date:entry.date,
        sortKey:entry.sortKey||0,evidenceType:entry.evidenceType,note:entry.note||"",
        href:item.evidence?.href||"",current:index===arr.length-1&&entry.status===item.status
      }));
    }
  }
  return rows.sort((a,b)=>(b.sortKey||0)-(a.sortKey||0));
}
function renderPortfolioState(state){
  portfolioState=state;
  document.documentElement.dataset.stateReady="true";
  document.querySelectorAll("[data-state]").forEach(el=>{
    const value=getState(el.dataset.state,state);
    el.textContent=value??"—";
  });
  document.querySelectorAll("[data-state-status]").forEach(el=>{
    const value=getState(el.dataset.stateStatus,state)??"—";
    el.textContent=value;
    el.dataset.status=statusSlug(value);
  });
  document.querySelectorAll("[data-state-href]").forEach(el=>{
    const href=getState(el.dataset.stateHref,state);
    if(href){el.setAttribute("href",href);if(isExternalHref(href)){el.setAttribute("target","_blank");el.setAttribute("rel","noopener");}}
  });
  document.querySelectorAll("[data-state-list-inline]").forEach(el=>{
    const value=getState(el.dataset.stateListInline,state);
    el.textContent=Array.isArray(value)?value.join(" · "):"—";
  });
  document.querySelectorAll("[data-state-list]").forEach(el=>{
    const value=getState(el.dataset.stateList,state);
    el.replaceChildren();
    (Array.isArray(value)?value:[]).forEach(item=>{const li=document.createElement("li");li.textContent=item;el.append(li);});
  });
  document.querySelectorAll("[data-history-source]").forEach(el=>renderHistory(el,getState(el.dataset.historySource,state)));
  document.querySelectorAll("[data-next-state-wrap]").forEach(el=>{
    const dynamic=el.querySelector("[data-state]");
    el.hidden=!dynamic||!dynamic.textContent||dynamic.textContent==="—";
  });

  const academics=$("#current-academics"),building=$("#current-building"),research=$("#current-research"),learning=$("#current-learning");
  if(academics){academics.replaceChildren();for(const item of Object.values(state.academics||{}))renderStatusLine(academics,item.shortLabel||item.label,item.status,item.statusDate,item.evidence?.type);}
  if(building){building.replaceChildren();for(const item of Object.values(state.projects||{}))renderStatusLine(building,item.label,item.status,item.statusDate,item.evidence?.type);}
  if(research){research.replaceChildren();for(const item of Object.values(state.research||{}))renderStatusLine(research,item.label,item.status,item.statusDate,item.evidence?.type);}
  if(learning){learning.replaceChildren();for(const item of state.capabilities?.activeLearning||[]){const p=document.createElement("p");const span=document.createElement("span");span.textContent=item;p.append(span);learning.append(p);}}

  const reviewer=$("#reviewer-current-state");
  if(reviewer) reviewer.textContent=`${state.asOf} · ${state.academics.iitm.shortLabel}: ${state.academics.iitm.status} · ${state.profile.stage} ${state.profile.stageDate}`;

  const timeline=$("#status-timeline");
  if(timeline){
    timeline.replaceChildren();
    const milestones=collectMilestones(state);
    const latestEvidenceIndex=milestones.findIndex(item=>item.evidenceType!=="SELF-REPORTED");
    for(const [milestoneIndex,item] of milestones.entries()){
      const article=document.createElement("article");
      if(milestoneIndex===latestEvidenceIndex) article.classList.add("latest-milestone");
      article.dataset.kind=String(item.category||"record").toLowerCase().replace(/[^a-z0-9]+/g,"-");
      if(item.current) article.classList.add("current-milestone");
      const time=document.createElement("time");time.textContent=item.date;
      const body=document.createElement("div");
      const type=document.createElement("span");type.className="record-type";type.textContent=item.category;
      const title=document.createElement("h3");title.textContent=item.label;
      const meta=document.createElement("p");
      const stateBadge=document.createElement("b");stateBadge.textContent=item.status;stateBadge.dataset.status=statusSlug(item.status);
      const sep=document.createTextNode(" · ");
      const evidence=document.createElement("span");evidence.textContent=item.evidenceType;
      meta.append(stateBadge,sep,evidence);
      if(item.note){const note=document.createElement("small");note.textContent=item.note;meta.append(document.createElement("br"),note);}
      body.append(type,title,meta);
      const badge=document.createElement("span");badge.className="badge";badge.textContent=item.evidenceType;
      if(item.href){
        const link=document.createElement("a");link.className="milestone-link";link.href=item.href;link.textContent="↗";link.setAttribute("aria-label",`Open evidence for ${item.label}`);
        if(isExternalHref(item.href)){link.target="_blank";link.rel="noopener";}
        article.append(time,body,badge,link);
      }else article.append(time,body,badge);
      timeline.append(article);
    }
  }

  rerenderIitmLearning();

  const changelog=$("#portfolio-changelog");
  if(changelog){
    changelog.replaceChildren();
    [...(state.changelog||[])].sort((a,b)=>(b.sortKey||0)-(a.sortKey||0)).forEach(entry=>{
      const li=document.createElement("li");const time=document.createElement("time");time.textContent=entry.date;const span=document.createElement("span");span.textContent=entry.text;li.append(time,span);changelog.append(li);
    });
  }
}
async function loadPortfolioState(){
  try{
    const response=await fetch("data/portfolio-state.json",{cache:"no-cache"});
    if(!response.ok) throw new Error(`status HTTP ${response.status}`);
    renderPortfolioState(await response.json());
  }catch(error){
    console.error("Portfolio status data unavailable",error);
    document.documentElement.dataset.stateReady="error";
    const current=$("#current-status");
    if(current){const note=document.createElement("p");note.className="status-load-error";note.textContent="Current status data could not be loaded. Stable portfolio content remains available below.";current.append(note);}
  }
}

applyTheme(theme);
void applyLang(lang);
void loadPortfolioState();
let iitmCurriculumLoading=false;
const ensureIitmCurriculum=()=>{
  if(iitmCurriculum||iitmCurriculumLoading) return;
  iitmCurriculumLoading=true;
  loadIitmCurriculum().finally(()=>{iitmCurriculumLoading=false;});
};
const iitmLearningSection=$("#iitm-learning");
if(iitmLearningSection&&"IntersectionObserver" in window){
  const observer=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){ensureIitmCurriculum();observer.disconnect();}
  },{rootMargin:"700px 0px"});
  observer.observe(iitmLearningSection);
}else if(iitmLearningSection){
  setTimeout(ensureIitmCurriculum,1800);
}
$$('a[href="#iitm-learning"]').forEach(a=>{
  a.addEventListener("focus",ensureIitmCurriculum,{once:true});
  a.addEventListener("pointerenter",ensureIitmCurriculum,{once:true});
  a.addEventListener("click",ensureIitmCurriculum,{once:true});
});
const skipLink=$(".skip");
if(skipLink){
  skipLink.addEventListener("click",event=>{
    event.preventDefault();
    const main=$("#main");
    main?.focus({preventScroll:true});
    main?.scrollIntoView({block:"start"});
    history.replaceState(null,"","#main");
  });
}
$$("[data-lang]").forEach(b=>b.addEventListener("click",()=>{void applyLang(b.dataset.lang)}));
$("#theme").addEventListener("click",()=>applyTheme(theme==="home"?"lab":"home"));
$("#menu").addEventListener("click",()=>{
  const n=$("#mobile-nav"),open=!n.hidden;n.hidden=open;$("#menu").setAttribute("aria-expanded",String(!open));
});
$$(".mobile-nav a").forEach(a=>a.addEventListener("click",()=>{$("#mobile-nav").hidden=true;$("#menu").setAttribute("aria-expanded","false")}));
$("#print").addEventListener("click",()=>window.print());

const params=new URLSearchParams(location.search);
if(params.get("ref")==="resume") $("#resume-arrival").hidden=false;
const reviewerMode=params.get("view")==="reviewer";
if(reviewerMode){document.body.dataset.view="reviewer";const note=$("#reviewer-mode-note");if(note)note.hidden=false;}

const toast=(msg)=>{const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),1600)};
$$("[data-copy]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast(lang==="ar"?"تم النسخ":lang==="ja"?"コピーしました":"Copied");}catch{toast("Copy: "+b.dataset.copy)}}));

const dialog=$("#search-dialog"),input=$("#search-input"),results=$("#search-results");
const index=[
{label:"Selected work",meta:"FAST PATH / projects / research / academics",href:"#selected-work"},
{label:"Current status",meta:"VERIFIED STATE / academics / projects / research",href:"#current-status"},
{label:"Academic status",meta:"IIT MADRAS / engineering pathway / status history",href:"#academic-path"},
{label:"IITM learning trajectory",meta:"OFFICIAL CURRICULUM / foundations / data science / ML / AI / projects",href:"#iitm-learning"},
{label:"Credentials",meta:"ISSUER RECORDS / NASA / Google / Google Cloud",href:"#credentials"},
{label:"Résumé",meta:"COMPRESSED RECORD / PDF",href:"#resume"},
{label:"Contact",meta:"EMAIL / LinkedIn / GitHub / ORCID",href:"#contact"},
{label:"Halim Nexus AI",meta:"PROJECT / Python / AI / SQLite / Twilio",href:"#work"},
{label:"StudySyncEngine",meta:"PROJECT / OCR / local automation / privacy",href:"#work"},
{label:"AI-Assisted Healthcare Systems",meta:"RESEARCH / status history / methodology / Zenodo",href:"#research"},
{label:"METABASIS / Books vs. Reels",meta:"RESEARCH / context compression",href:"#research"},
{label:"IIT Madras BS Data Science and Applications",meta:"ACADEMIC / current state / portal evidence",href:"#academic-path"},
{label:"DPG Dialogues 2025",meta:"EXPERIENCE / public-interest systems",href:"#experience"},
{label:"NASA Open Science Essentials",meta:"CREDENTIAL / open science",href:"#credentials"},
{label:"Google AI Professional Certificate",meta:"CREDENTIAL / AI",href:"#credentials"},
{label:"Verification centre",meta:"EVIDENCE / ORCID / GitHub / issuer records",href:"#evidence"},
{label:"Electronics / VLSI / semiconductors",meta:"FUTURE DIRECTION / not claimed mastery",href:"#next"},
{label:"Python / OCR / SQLite / Google Cloud",meta:"SKILLS / linked to work",href:"#work"}
];
function render(q=""){
 const v=q.trim().toLowerCase(),items=index.filter(x=>(x.label+" "+x.meta).toLowerCase().includes(v)).slice(0,8);
 results.innerHTML=items.map(x=>'<a class="search-result" href="'+x.href+'"><small>'+x.meta+'</small>'+x.label+'</a>').join("") || '<p class="search-result">No matching record.</p>';
 $$(".search-result[href]",results).forEach(a=>a.addEventListener("click",()=>dialog.close()));
}
$("#search-button").addEventListener("click",()=>{dialog.showModal();render();setTimeout(()=>input.focus(),0)});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();dialog.showModal();render();setTimeout(()=>input.focus(),0)}});
input.addEventListener("input",()=>render(input.value));

if("serviceWorker" in navigator){window.addEventListener("load",()=>{const registerSW=()=>navigator.serviceWorker.register("sw.js").catch(()=>{});if("requestIdleCallback" in window)requestIdleCallback(registerSW,{timeout:2500});else setTimeout(registerSW,1200);})}


// Reference-led interaction layer: precise, restrained, keyboard-friendly.
const desktopViewport=matchMedia("(min-width: 1051px)").matches;
const progressBar=document.querySelector("#scroll-progress-bar");

if(matchMedia("(min-width: 721px)").matches){
  const onScroll=()=>{
    const max=document.documentElement.scrollHeight-innerHeight;
    const p=max>0?scrollY/max:0;
    if(progressBar) progressBar.style.transform=`scaleX(${Math.min(1,Math.max(0,p))})`;
  };
  addEventListener("scroll",onScroll,{passive:true});
  onScroll();
}

if(desktopViewport){
  const sectionIndex=document.querySelector("#section-index");
  const sectionLabel=document.querySelector("#section-label");
  const navLinks=[...document.querySelectorAll(".desktop-nav a")];
  const tracked=[...document.querySelectorAll("main section[id]")];
  const sectionObserver=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible) return;
    const sec=visible.target;
    const pos=tracked.indexOf(sec);
    const heading=sec.querySelector("h2,h1");
    if(sectionIndex) sectionIndex.textContent=String(Math.max(0,pos)).padStart(2,"0");
    if(sectionLabel) sectionLabel.textContent=(heading?.textContent||sec.id||"SECTION").trim().toUpperCase().slice(0,34);
    navLinks.forEach(a=>{const active=a.getAttribute("href")==="#"+sec.id;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");});
  },{rootMargin:"-20% 0px -55% 0px",threshold:[0,.2,.5,.8]});
  tracked.forEach(s=>sectionObserver.observe(s));
}

const setupVisualEnhancements=()=>{
  const fineDesktop=matchMedia("(min-width: 900px) and (pointer:fine) and (prefers-reduced-motion: no-preference)").matches;
  if(!fineDesktop) return;
  const revealTargets=[...document.querySelectorAll(".hero .profile-card,.indexed .section-head,.path-card,.identity article,.origin-grid article,.case,.research-card,.dpg-media,.media-card,.timeline article,.matrix article,.credential-grid article,.split,.thoughts p,.route,.question-index a,.project-archive")];
  revealTargets.forEach(el=>el.classList.add("reveal"));
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add("is-visible");revealObserver.unobserve(e.target);}
  }),{rootMargin:"0px 0px -8% 0px",threshold:.12});
  revealTargets.forEach(el=>revealObserver.observe(el));

  const spotlight=[...document.querySelectorAll(".path-card,.case,.research-card,.credential-grid article,.identity article,.media-card")];
  spotlight.forEach(el=>{
    el.dataset.spotlight="";
    el.addEventListener("pointermove",e=>{
      const r=el.getBoundingClientRect();
      el.style.setProperty("--spot-x",((e.clientX-r.left)/r.width*100)+"%");
      el.style.setProperty("--spot-y",((e.clientY-r.top)/r.height*100)+"%");
    },{passive:true});
  });
  addEventListener("pointermove",e=>{
    document.documentElement.style.setProperty("--mx",e.clientX+"px");
    document.documentElement.style.setProperty("--my",e.clientY+"px");
  },{passive:true});
};
if("requestIdleCallback" in window)requestIdleCallback(setupVisualEnhancements,{timeout:3000});else setTimeout(setupVisualEnhancements,1400);
