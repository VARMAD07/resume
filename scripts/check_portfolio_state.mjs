#!/usr/bin/env node
import fs from "node:fs";
const state=JSON.parse(fs.readFileSync("data/portfolio-state.json","utf8"));\nif(state.schemaVersion!==2) throw new Error("Expected portfolio state schemaVersion 2.");

const requiredStatuses=new Set(Object.keys(state.statusDefinitions||{}));
const evidenceTypes=new Set(["PUBLIC SOURCE","ISSUER RECORD","SUPPLIED DOCUMENT","PORTAL EVIDENCE","SELF-REPORTED"]);
const errors=[];

const nonEmpty=(value)=>typeof value==="string"&&value.trim().length>0;
const groups=[
  ["academics",state.academics],
  ["projects",state.projects],
  ["research",state.research]
];

for(const [groupName,group] of groups){
  if(!group||typeof group!=="object"){errors.push(groupName+": missing group");continue;}
  for(const [key,item] of Object.entries(group)){
    const path=groupName+"."+key;
    if(!item||typeof item!=="object"){errors.push(path+": missing");continue;}
    for(const field of ["label","status","statusDate","evidence","history"]){
      if(item[field]==null) errors.push(path+": missing "+field);
    }
    if(!requiredStatuses.has(item.status)) errors.push(path+": unsupported status "+item.status);
    if(!evidenceTypes.has(item.evidence?.type)) errors.push(path+": unsupported evidence type "+String(item.evidence?.type));
    if(!nonEmpty(item.statusDate)) errors.push(path+": statusDate must be non-empty");
    if(Object.prototype.hasOwnProperty.call(item,"nextState")) errors.push(path+": nextState must be derived from transitionModel, not stored");
    if(item.transitionModel&&!state.transitionModels?.[item.transitionModel]) errors.push(path+": unknown transitionModel "+item.transitionModel);
    if(!Array.isArray(item.history)||!item.history.length){
      errors.push(path+": history missing");
      continue;
    }
    const last=item.history[item.history.length-1];
    if(last.status!==item.status) errors.push(path+": latest history status must match current status");
    let previousSort=-Infinity;
    for(const h of item.history){
      if(!requiredStatuses.has(h.status)) errors.push(path+": history has unsupported status "+h.status);
      if(!nonEmpty(h.date)||!evidenceTypes.has(h.evidenceType)) errors.push(path+": every history state needs date and supported evidenceType");
      if(Number.isFinite(h.sortKey)){
        if(h.sortKey<previousSort) errors.push(path+": history sortKey must be chronological");
        previousSort=h.sortKey;
      }
    }
  }
}

for(const field of ["stage","stageDate","schoolSystem","status","location"]){
  if(!nonEmpty(state.profile?.[field])) errors.push("profile."+field+": missing or empty");
}
if(!requiredStatuses.has(state.profile?.status)) errors.push("profile.status: unsupported status");
if(!evidenceTypes.has(state.profile?.evidence?.type)) errors.push("profile.evidence.type: unsupported evidence type");

for(const [modelName,model] of Object.entries(state.transitionModels||{})){
  if(!model||typeof model!=="object") { errors.push("transitionModels."+modelName+": invalid model"); continue; }
  for(const [from,to] of Object.entries(model)){
    if(!requiredStatuses.has(from)) errors.push("transitionModels."+modelName+": unsupported source status "+from);
    if(to!=null&&!requiredStatuses.has(to)) errors.push("transitionModels."+modelName+": unsupported target status "+to);
  }
}
for(const [modelName,model] of Object.entries(state.presentationModels||{})){
  if(!model||typeof model!=="object"){errors.push("presentationModels."+modelName+": invalid model");continue;}
  for(const [from,presentation] of Object.entries(model)){
    if(!requiredStatuses.has(from)) errors.push("presentationModels."+modelName+": unsupported source status "+from);
    if(!requiredStatuses.has(presentation)) errors.push("presentationModels."+modelName+": unsupported presentation status "+presentation);
  }
}
for(const [key,item] of Object.entries(state.projects||{})){
  if(!nonEmpty(item.role)) errors.push("projects."+key+".role: missing");
  if(item.transitionModel!=="project") errors.push("projects."+key+": must use the centralized project transition model");
  if(!Object.prototype.hasOwnProperty.call(state.transitionModels?.project||{},item.status)) errors.push("projects."+key+": current status is not mapped in project transition model");
}
if(state.academics?.school?.dashboard!==true) errors.push("academics.school must appear in the current-academics dashboard");
if(state.academics?.engineering?.dashboard!==false) errors.push("future engineering direction must stay out of the current-academics dashboard");
if(state.academics?.iitm?.status==="QUALIFIER PATHWAY" && /admitted|enrolled|active student/i.test(state.academics.iitm.note||"")){
  errors.push("IITM note conflicts with qualifier-stage status");
}
if(state.academics?.iitm?.activityModel!=="iitmActivity") errors.push("academics.iitm: missing iitmActivity presentation model");
const iitmActivity=state.presentationModels?.[state.academics?.iitm?.activityModel]?.[state.academics?.iitm?.status];
if(state.academics?.iitm?.status==="QUALIFIER PATHWAY"&&iitmActivity!=="PREPARING") errors.push("Qualifier Pathway must present current activity as PREPARING");

if(!Array.isArray(state.capabilities?.currentExperience)||!state.capabilities.currentExperience.length) errors.push("capabilities.currentExperience must be a non-empty array");
if(!Array.isArray(state.capabilities?.activeLearning)||!state.capabilities.activeLearning.length) errors.push("capabilities.activeLearning must be a non-empty array");
if(!Array.isArray(state.capabilities?.futureDirection)||!state.capabilities.futureDirection.length) errors.push("capabilities.futureDirection must be a non-empty array");
if(!nonEmpty(state.asOf)) errors.push("asOf missing");
if(!nonEmpty(state.lastVerified)) errors.push("lastVerified missing");
if(!nonEmpty(state.validityWindow)) errors.push("validityWindow missing");
if(!Array.isArray(state.changelog)||state.changelog.length<4) errors.push("changelog must contain the implemented production history");
for(const [i,entry] of (state.changelog||[]).entries()){
  if(!nonEmpty(entry.date)||!nonEmpty(entry.title)||!nonEmpty(entry.text)) errors.push("changelog["+i+"]: date, title and text are required");
}
function findNull(value,path="state"){
  if(value===null){errors.push(path+": null values are not allowed in public portfolio state");return;}
  if(Array.isArray(value)){value.forEach((child,i)=>findNull(child,path+"["+i+"]"));return;}
  if(value&&typeof value==="object"){for(const [key,child] of Object.entries(value)) findNull(child,path+"."+key);}
}
findNull(state);

if(errors.length){
  console.error("Portfolio state validation failed:");
  for(const error of errors) console.error(" - "+error);
  process.exit(1);
}
console.log("OK: portfolio state, evidence taxonomy, history and dashboard classifications are internally consistent.");
