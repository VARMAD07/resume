#!/usr/bin/env node
import fs from "node:fs";

const curriculum=JSON.parse(fs.readFileSync("data/iitm-curriculum.json","utf8"));
const state=JSON.parse(fs.readFileSync("data/portfolio-state.json","utf8"));
const errors=[];

if(curriculum.schemaVersion!==2) errors.push("Expected IITM curriculum schemaVersion 2.");
if(!String(curriculum.authority||"").includes("IIT Madras")) errors.push("Curriculum authority must identify IIT Madras.");
for(const source of curriculum.sources||[]){
  if(!/^https:\/\/study\.iitm\.ac\.in\/ds\//.test(source.url||"")) errors.push("Non-official IITM curriculum source: "+source.url);
}

const courses=curriculum.courses||{};
const codes=new Set(Object.keys(courses));
for(const [code,course] of Object.entries(courses)){
  if(!code||!course?.name||!course?.officialLevel) errors.push("Course missing code/name/officialLevel: "+code);
  if(!Number.isFinite(course?.credits)) errors.push("Course missing numeric credits: "+code);
}

const referencedCodes=new Set();
const addCodes=(values,label)=>{
  for(const code of values||[]){
    referencedCodes.add(code);
    if(!codes.has(code)) errors.push(label+" references unknown official course: "+code);
  }
};
const structure=curriculum.officialStructure||{};
addCodes(structure.foundation?.courseCodes,"Foundation structure");
addCodes(structure.diplomaProgramming?.courseCodes,"Programming diploma structure");
addCodes(structure.diplomaDataScience?.mandatoryCodes,"Data Science diploma structure");
for(const track of structure.diplomaDataScience?.optionTracks||[]) addCodes(track.courseCodes,"Data Science option track");
addCodes(structure.degreeLevel?.coreCodes,"Degree core structure");
addCodes(structure.degreeLevel?.representativeElectiveSnapshot,"Degree elective snapshot");
addCodes(curriculum.qualifierContext?.courseCodes,"Qualifier context");

const expectedGroups=["foundation","programming","data-science","ml-ai","systems","advanced-electives"];
const groups=curriculum.learningArchitecture?.groups||[];
if(groups.length!==expectedGroups.length) errors.push("Learning architecture must expose exactly six groups.");
for(const [index,id] of expectedGroups.entries()){
  if(groups[index]?.id!==id) errors.push("Learning architecture group "+(index+1)+" must be "+id+".");
}
for(const group of groups){
  addCodes(group.representativeCourseCodes,"Learning architecture "+group.id);
  if(!group.label||!group.purpose||!group.connection) errors.push("Learning architecture "+group.id+" needs label, purpose and connection.");
}
if(!groups.find(g=>g.id==="advanced-electives")?.volatile) errors.push("Advanced/elective group must be marked volatile because official availability can change by term.");

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
if(!curriculum.verifiedAt||!curriculum.reviewDue) errors.push("Curriculum snapshot must include verifiedAt and reviewDue.");

if(errors.length){
  console.error("IITM curriculum/state validation failed:");
  for(const error of errors) console.error(" - "+error);
  process.exit(1);
}
console.log(`OK: ${codes.size} official-source course records validated; six-group learning architecture is intact; personal course states remain evidence-gated.`);
