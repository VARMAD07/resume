#!/usr/bin/env node
import fs from "node:fs";

const STATE_FILE="data/portfolio-state.json";
const CURRICULUM_FILE="data/iitm-curriculum.json";
const args=process.argv.slice(2);
const code=(args.shift()||"").toUpperCase();

if(!code||args.includes("--help")){
  console.log(`Usage:
node scripts/update_iitm_course.mjs BSMA1001 --status=CURRENT --date="JAN 2027" --evidence-type="PORTAL EVIDENCE" --note="Registered course shown in official academic record."

Allowed course statuses:
PLANNED | CURRENT | COMPLETED | PASSED | REPEATED | ARCHIVED

Optional:
--evidence-label="Official course registration / result"
--evidence-href="#ev-edu-001"
--as-of="JAN 2027"
--changelog="IITM course status updated"
`);
  process.exit(code?0:1);
}

const opts={};
for(const arg of args){
  if(!arg.startsWith("--")||!arg.includes("=")) throw new Error("Use --key=value arguments.");
  const [key,...rest]=arg.slice(2).split("=");
  opts[key]=rest.join("=");
}
for(const required of ["status","date","evidence-type"]){
  if(!opts[required]) throw new Error("Missing --"+required);
}

const state=JSON.parse(fs.readFileSync(STATE_FILE,"utf8"));
const curriculum=JSON.parse(fs.readFileSync(CURRICULUM_FILE,"utf8"));
const allowed=new Set(curriculum.personalCourseStatuses.allowed);
if(!allowed.has(opts.status)) throw new Error("Unsupported IITM course status: "+opts.status);

const allCourses=[];
for(const layer of curriculum.layers||[]){
  allCourses.push(...(layer.courses||[]),...(layer.coreCourses||[]));
  for(const track of layer.optionTracks||[]) allCourses.push(...(track.courses||[]));
}
if(!allCourses.some(c=>c.code===code)) throw new Error("Course code not found in official curriculum data: "+code);

state.academics.iitm.courseStatuses=state.academics.iitm.courseStatuses||{};
const current=state.academics.iitm.courseStatuses[code]||{history:[]};
const entry={
  status:opts.status,
  date:opts.date,
  evidenceType:opts["evidence-type"],
  note:opts.note||"Course status updated from verified academic evidence."
};
current.status=entry.status;
current.date=entry.date;
current.evidence={
  type:opts["evidence-type"],
  label:opts["evidence-label"]||current.evidence?.label||"Academic record",
  href:opts["evidence-href"]||current.evidence?.href||"#ev-edu-001"
};
current.note=entry.note;
current.history=current.history||[];
const last=current.history[current.history.length-1];
if(!last||last.status!==entry.status||last.date!==entry.date) current.history.push(entry);
state.academics.iitm.courseStatuses[code]=current;

if(opts["as-of"]) state.asOf=opts["as-of"];
if(opts.changelog){
  state.changelog=state.changelog||[];
  state.changelog.push({date:opts["as-of"]||opts.date,sortKey:Number((opts.date.match(/\d{4}/)||["0"])[0])*10000,text:opts.changelog});
}
fs.writeFileSync(STATE_FILE,JSON.stringify(state,null,2)+"\n");
console.log(`Updated IITM course ${code}: ${entry.status} · ${entry.date}. History retained.`);
