const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];

const EN_BASE=Object.fromEntries(
  [...document.querySelectorAll("[data-i18n]")].map(el=>[el.dataset.i18n,el.textContent])
);
const D={en:EN_BASE};
const LANGS=new Set(["en","ar","ja"]);
let lang=localStorage.getItem("mhf-lang")||"en";
let theme=localStorage.getItem("mhf-theme")||"home";

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
  try{
    const map=await languageMap(lang);
    if(lang!==requested) return;
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const value=map[el.dataset.i18n] ?? EN_BASE[el.dataset.i18n];
      if(value!=null) el.textContent=value;
    });
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
    }
  }
}

function applyTheme(next){
  theme=next==="lab"?"lab":"home";
  localStorage.setItem("mhf-theme",theme);
  document.documentElement.dataset.theme=theme;
  $("#theme").setAttribute("aria-pressed",String(theme==="lab"));
}

applyTheme(theme);
void applyLang(lang);
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
{label:"Academic status",meta:"IIT MADRAS / qualifier / planned engineering",href:"#academic-path"},
{label:"Credentials",meta:"ISSUER RECORDS / NASA / Google / Google Cloud",href:"#credentials"},
{label:"Résumé",meta:"COMPRESSED RECORD / PDF",href:"#resume"},
{label:"Contact",meta:"EMAIL / LinkedIn / GitHub / ORCID",href:"#contact"},
{label:"Halim Nexus AI",meta:"PROJECT / Python / AI / SQLite / Twilio",href:"#work"},
{label:"StudySyncEngine",meta:"PROJECT / OCR / local automation / privacy",href:"#work"},
{label:"AI-Assisted Healthcare Systems",meta:"RESEARCH / preprint / methodology / Zenodo",href:"#research"},
{label:"METABASIS / Books vs. Reels",meta:"RESEARCH / context compression",href:"#research"},
{label:"IIT Madras BS Data Science and Applications",meta:"ACADEMIC / admissions pathway / supplied portal evidence",href:"#academic-path"},
{label:"DPG Dialogues 2025",meta:"EXPERIENCE / public-interest systems",href:"#experience"},
{label:"NASA Open Science Essentials",meta:"CREDENTIAL / open science",href:"#credentials"},
{label:"Google AI Professional Certificate",meta:"CREDENTIAL / AI",href:"#credentials"},
{label:"Verification centre",meta:"EVIDENCE / ORCID / GitHub / issuer records",href:"#evidence"},
{label:"Electronics / VLSI / semiconductors",meta:"NEXT / learning direction",href:"#next"},
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
