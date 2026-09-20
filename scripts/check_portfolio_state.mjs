#!/usr/bin/env node
import fs from "node:fs";
const state=JSON.parse(fs.readFileSync("data/portfolio-state.json","utf8"));

const requiredStatuses=new Set([
  "PLANNED","PREPARING","APPLIED","SUBMITTED","UNDER REVIEW","QUALIFIER PATHWAY","QUALIFIED",
  "ADMITTED","ENROLLED","ACTIVE","COMPLETED","PUBLISHED","PREPRINT","MANUSCRIPT","IN PROGRESS",
  "ARCHIVED","VERIFIED","SELF-REPORTED","LEARNING DIRECTION","ACCEPTED","IN DEVELOPMENT","MAINTAINED","PROTOTYPE","OPEN SOURCE"
]);

let errors=[];
const allItems=[
  ["academics.iitm",state.academics?.iitm],
  ["academics.engineering",state.academics?.engineering],
  ["projects.halim",state.projects?.halim],
  ["projects.studysync",state.projects?.studysync],
  ["research.healthcare",state.research?.healthcare],
  ["research.metabasis",state.research?.metabasis]
];
for(const [path,item] of allItems){
  if(!item){errors.push(path+": missing");continue;}
  for(const key of ["status","statusDate","evidence","history"]) if(item[key]==null) errors.push(path+": missing "+key);
  if(!requiredStatuses.has(item.status)) errors.push(path+": unsupported status "+item.status);
  if(!item.evidence?.type) errors.push(path+": evidence.type missing");
  if(!Array.isArray(item.history)||!item.history.length) errors.push(path+": history missing");
  else {
    const last=item.history[item.history.length-1];
    if(last.status!==item.status) errors.push(path+": latest history status must match current status");
    for(const h of item.history){
      if(!requiredStatuses.has(h.status)) errors.push(path+": history has unsupported status "+h.status);
      if(!h.date||!h.evidenceType) errors.push(path+": every history state needs date and evidenceType");
    }
  }
}
if(state.academics?.iitm?.status==="QUALIFIER PATHWAY" && /admitted|enrolled|active student/i.test(state.academics.iitm.note||"")){
  errors.push("IITM note conflicts with qualifier-stage status");
}
if(!Array.isArray(state.capabilities?.currentExperience)||!Array.isArray(state.capabilities?.activeLearning)||!Array.isArray(state.capabilities?.futureDirection)){
  errors.push("capability buckets must all be arrays");
}
if(!state.asOf) errors.push("asOf missing");
if(errors.length){
  console.error("Portfolio state validation failed:");
  for(const e of errors) console.error(" - "+e);
  process.exit(1);
}
console.log("OK: portfolio state is internally consistent and updateable from one source.");
