#!/usr/bin/env node
import fs from "node:fs";

const curriculum=JSON.parse(fs.readFileSync("data/iitm-curriculum.json","utf8"));
const state=JSON.parse(fs.readFileSync("data/portfolio-state.json","utf8"));
const errors=[];

if(!String(curriculum.authority||"").includes("IIT Madras")) errors.push("Curriculum authority must identify IIT Madras.");
for(const source of curriculum.sources||[]){
  if(!/^https:\/\/study\.iitm\.ac\.in\/ds\//.test(source.url||"")) errors.push("Non-official IITM curriculum source: "+source.url);
}
const codes=new Set();
for(const layer of curriculum.layers||[]){
  const courseGroups=[layer.courses||[],layer.coreCourses||[],...(layer.optionTracks||[]).map(t=>t.courses||[])];
  for(const group of courseGroups){
    for(const course of group){
      if(!course.code||!course.name) errors.push("Course missing code/name in "+layer.id);
      if(codes.has(course.code)) errors.push("Duplicate curriculum course code: "+course.code);
      codes.add(course.code);
    }
  }
}
const allowed=new Set(curriculum.personalCourseStatuses?.allowed||[]);
const personal=state.academics?.iitm?.courseStatuses||{};
for(const [code,record] of Object.entries(personal)){
  if(!codes.has(code)) errors.push("Personal IITM course status references unknown official course: "+code);
  if(!allowed.has(record.status)) errors.push("Unsupported personal IITM course status "+record.status+" for "+code);
  if(record.status!=="PLANNED"&&(!record.date||!record.evidence?.type)) errors.push(code+" needs date and evidence for non-PLANNED status");
  if(["CURRENT","COMPLETED","PASSED","REPEATED"].includes(record.status)&&["QUALIFIER PATHWAY","QUALIFIED","ADMITTED"].includes(state.academics?.iitm?.status)){
    errors.push(code+" cannot be presented as registered/completed coursework while programme status is only "+state.academics.iitm.status);
  }
}
if(curriculum.personalCourseStatuses?.defaultStatus!=="PLANNED") errors.push("Default IITM course status must remain PLANNED.");
if(errors.length){
  console.error("IITM curriculum/state validation failed:");
  for(const error of errors) console.error(" - "+error);
  process.exit(1);
}
console.log(`OK: ${codes.size} official curriculum course records validated; personal course states remain evidence-gated.`);
