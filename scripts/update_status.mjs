#!/usr/bin/env node
import fs from "node:fs";

const FILE="data/portfolio-state.json";
const args=process.argv.slice(2);
const target=args.shift();
if(!target||args.includes("--help")){
  console.log(`Usage:
node scripts/update_status.mjs academics.iitm --status="QUALIFIED" --date="NOV 2026" --sort=20261100 --evidence-type="PORTAL EVIDENCE" --note="Qualifier milestone completed." --as-of="NOV 2026"

Optional:
--evidence-label="Official result / portal evidence"
--evidence-href="#ev-edu-001"
--changelog="IIT Madras qualifier status updated"
`);
  process.exit(target?0:1);
}
const opts={};
for(const arg of args){
  if(!arg.startsWith("--")||!arg.includes("=")) throw new Error("Use --key=value arguments.");
  const [key,...rest]=arg.slice(2).split("=");
  opts[key]=rest.join("=");
}
for(const required of ["status","date","sort","evidence-type"]){
  if(!opts[required]) throw new Error("Missing --"+required);
}
const state=JSON.parse(fs.readFileSync(FILE,"utf8"));
const item=target.split(".").reduce((value,key)=>value?.[key],state);
if(!item||!Array.isArray(item.history)) throw new Error("Unknown status target: "+target);
if(!state.statusDefinitions?.[opts.status]) throw new Error("Unsupported status: "+opts.status);

const entry={
  status:opts.status,
  date:opts.date,
  sortKey:Number(opts.sort),
  evidenceType:opts["evidence-type"],
  note:opts.note||"Status updated from verified evidence."
};
if(!Number.isFinite(entry.sortKey)) throw new Error("--sort must be numeric, e.g. 20261100.");

const last=item.history[item.history.length-1];
if(!last||last.status!==entry.status||last.date!==entry.date){
  item.history.push(entry);
}
item.status=entry.status;
item.statusDate=entry.date;
item.note=opts.note||item.note;
item.evidence=item.evidence||{};
item.evidence.type=opts["evidence-type"];
if(opts["evidence-label"]) item.evidence.label=opts["evidence-label"];
if(opts["evidence-href"]) item.evidence.href=opts["evidence-href"];
if(opts["as-of"]) state.asOf=opts["as-of"];
if(opts.changelog){
  state.changelog=state.changelog||[];
  state.changelog.push({date:opts["as-of"]||opts.date,sortKey:entry.sortKey,text:opts.changelog});
}
fs.writeFileSync(FILE,JSON.stringify(state,null,2)+"\n");
const derivedNext=item.transitionModel?state.transitionModels?.[item.transitionModel]?.[entry.status]:null;\nconsole.log(`Updated ${target}: ${entry.status} · ${entry.date}. Previous history retained.${derivedNext?` Next possible verified state: ${derivedNext}.`:""}`);
