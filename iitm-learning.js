const $=(s,c=document)=>c.querySelector(s);

const statusSlug=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

function flattenIitmCourses(curriculum){
  return Object.entries(curriculum?.courses||{}).map(([code,course])=>({code,...course}));
}
function courseStateRecord(code,state,curriculum){
  const override=state?.academics?.iitm?.courseStatuses?.[code];
  return override||{status:curriculum?.personalCourseStatuses?.defaultStatus||"PLANNED",date:null,evidence:null,note:null};
}
function courseStatusChip(record){
  const chip=document.createElement("span");
  chip.className="course-status-chip";
  chip.textContent=record.status||"PLANNED";
  chip.dataset.status=statusSlug(record.status||"PLANNED");
  return chip;
}
function renderCourseStateList(container,courses,kind,t){
  if(!container) return;
  container.replaceChildren();
  if(!courses.length){
    const empty=document.createElement("p");
    empty.className="course-state-empty";
    if(kind==="completed") empty.textContent=t("iitmLearning.noneCompleted","No verified completed IITM coursework is recorded yet.");
    else if(kind==="current") empty.textContent=t("iitmLearning.noneCurrent","No formally registered IITM course is claimed as current yet.");
    else empty.textContent=t("iitmLearning.noneUpcoming","No upcoming curriculum layer is currently identified.");
    container.append(empty);
    return;
  }
  const visible=courses.slice(0,6);
  for(const course of visible){
    const item=document.createElement("div");
    item.className="course-state-item";
    const name=document.createElement("span");name.textContent=course.name;
    const meta=document.createElement("small");meta.textContent=[course.code,course.record?.date,course.record?.evidence?.type].filter(Boolean).join(" · ");
    item.append(name,courseStatusChip(course.record),meta);
    container.append(item);
  }
  if(courses.length>visible.length){
    const more=document.createElement("small");
    more.className="course-more";
    more.textContent=`+${courses.length-visible.length} ${t("iitmLearning.more","more in the curriculum map below")}`;
    container.append(more);
  }
}
function coursesForArchitectureGroup(group,curriculum){
  return (group?.representativeCourseCodes||[])
    .map(code=>curriculum?.courses?.[code]?{code,...curriculum.courses[code]}:null)
    .filter(Boolean);
}
function populateIitmCourseDetails(details,group,curriculum,state){
  let list=details.querySelector("ul");
  if(!list){list=document.createElement("ul");details.append(list);}
  list.replaceChildren();
  for(const course of coursesForArchitectureGroup(group,curriculum)){
    const record=courseStateRecord(course.code,state,curriculum);
    const li=document.createElement("li");
    const name=document.createElement("span");name.textContent=course.name;
    const meta=document.createElement("small");meta.textContent=`${course.code} · ${course.credits} cr · ${course.officialLevel}`;
    li.append(name,meta,courseStatusChip(record));
    list.append(li);
  }
  details.dataset.rendered="true";
}
function iitmDisplayMode(programmeStatus,t){
  if(programmeStatus==="QUALIFIER PATHWAY") return t("iitmLearning.modeQualifier","QUALIFIER PREPARATION / CURRICULUM VIEW");
  if(["QUALIFIED","ADMITTED"].includes(programmeStatus)) return t("iitmLearning.modeTrajectory","FOUNDATION ENTRY PATHWAY");
  if(["ENROLLED","ACTIVE"].includes(programmeStatus)) return t("iitmLearning.modeCurrent","CURRENT ACADEMIC CURRICULUM");
  if(programmeStatus==="COMPLETED") return t("iitmLearning.modeCompleted","COMPLETED COURSEWORK RECORD");
  return t("iitmLearning.modeTrajectory","CURRICULUM TRAJECTORY");
}

export function renderIitmLearning(curriculum,state,t=(key,fallback)=>fallback){
  if(!curriculum||!state||!$("#iitm-learning")) return;

  const programmeStatus=state.academics?.iitm?.status||"";
  const verified=$("#iitm-curriculum-verified");if(verified) verified.textContent=curriculum.verifiedAt||t("iitmLearning.verifiedUnavailable","See official source");
  const mode=$("#iitm-learning-mode");if(mode) mode.textContent=iitmDisplayMode(programmeStatus,t);

  const all=flattenIitmCourses(curriculum).map(course=>({...course,record:courseStateRecord(course.code,state,curriculum)}));
  const completed=all.filter(c=>["COMPLETED","PASSED","REPEATED","ARCHIVED"].includes(c.record.status));
  const current=all.filter(c=>c.record.status==="CURRENT");
  let upcoming=all.filter(c=>c.record.status==="PLANNED");
  if(!completed.length&&!current.length&&upcoming.length){
    const foundationCodes=new Set(curriculum.officialStructure?.foundation?.courseCodes||[]);
    upcoming=upcoming.filter(c=>foundationCodes.has(c.code));
  }
  renderCourseStateList($("#iitm-completed-courses"),completed,"completed",t);
  renderCourseStateList($("#iitm-current-courses"),current,"current",t);
  renderCourseStateList($("#iitm-upcoming-courses"),upcoming,"upcoming",t);

  const sourceNote=$(".iitm-source-note");
  let qualifier=$("#iitm-qualifier-context");
  if(sourceNote&&!qualifier){
    qualifier=document.createElement("div");
    qualifier.id="iitm-qualifier-context";
    qualifier.className="qualifier-context";
    sourceNote.append(qualifier);
  }
  if(qualifier){
    qualifier.replaceChildren();
    const strong=document.createElement("strong");
    strong.textContent=t("iitmLearning.qualifierLabel","OFFICIAL QUALIFIER CONTEXT");
    const p=document.createElement("p");
    const names=(curriculum.qualifierContext?.courseCodes||[]).map(code=>curriculum.courses?.[code]?.name).filter(Boolean);
    p.textContent=programmeStatus==="QUALIFIER PATHWAY"
      ? `${t("iitmLearning.qualifierCurrent","The current programme state is Qualifier Pathway. IIT Madras states that regular-entry qualifier preparation uses four weeks of content from:")} ${names.join(" · ")}. ${t("iitmLearning.qualifierCaution","This is qualifier content, not a claim that these courses are completed or formally registered.")}`
      : curriculum.qualifierContext?.note||"";
    qualifier.append(strong,p);
  }

  const progression=$("#iitm-progression");
  if(progression){
    progression.replaceChildren();
    (curriculum.conceptualProgression?.steps||[]).forEach((step,index,steps)=>{
      const span=document.createElement("span");span.textContent=step;progression.append(span);
      if(index<steps.length-1){const i=document.createElement("i");i.textContent="→";i.setAttribute("aria-hidden","true");progression.append(i);}
    });
    const note=document.createElement("small");note.textContent=curriculum.conceptualProgression?.label||"";progression.append(note);
  }

  const layers=$("#iitm-learning-layers");
  if(layers){
    layers.replaceChildren();
    const groups=curriculum.learningArchitecture?.groups||[];
    for(const [index,group] of groups.entries()){
      const article=document.createElement("article");article.className="iitm-layer";article.dataset.layer=group.id;

      const head=document.createElement("header");
      const num=document.createElement("span");num.textContent=String(index+1).padStart(2,"0");
      const title=document.createElement("div");
      const h3=document.createElement("h3");h3.textContent=group.label;
      const officialLevels=[...new Set(coursesForArchitectureGroup(group,curriculum).map(c=>c.officialLevel))];
      const level=document.createElement("small");
      level.textContent=`${t("iitmLearning.portfolioGroup","PORTFOLIO VIEW")} · ${officialLevels.join(" / ")}`;
      title.append(h3,level);head.append(num,title);article.append(head);

      const meaning=document.createElement("div");meaning.className="iitm-meaning-grid";
      const why=document.createElement("p");
      const whyLabel=document.createElement("b");whyLabel.textContent=t("iitmLearning.why","WHY IT MATTERS");
      const whyText=document.createElement("span");whyText.textContent=group.purpose||"";
      why.append(whyLabel,whyText);
      const connection=document.createElement("p");
      const connectionLabel=document.createElement("b");connectionLabel.textContent=t("iitmLearning.connection","PORTFOLIO CONNECTION");
      const connectionText=document.createElement("span");connectionText.textContent=group.connection||"";
      connection.append(connectionLabel,connectionText);
      meaning.append(why,connection);article.append(meaning);

      const details=document.createElement("details");details.className="iitm-course-details";
      const summary=document.createElement("summary");
      const groupCourses=coursesForArchitectureGroup(group,curriculum);
      summary.textContent=`${t("iitmLearning.representativeCourses","Representative official courses")} · ${groupCourses.length}`;
      details.append(summary);
      details.addEventListener("toggle",()=>{if(details.open&&!details.dataset.rendered)populateIitmCourseDetails(details,group,curriculum,state);});
      article.append(details);

      if(group.volatile){
        const note=document.createElement("p");
        note.className="curriculum-policy";
        note.textContent=curriculum.officialStructure?.degreeLevel?.electivePolicy||"";
        article.append(note);
      }
      layers.append(article);
    }
    const architectureNote=document.createElement("p");
    architectureNote.className="curriculum-architecture-note";
    architectureNote.textContent=curriculum.learningArchitecture?.note||"";
    layers.append(architectureNote);
  }

  const connections=$("#iitm-academic-connections");
  if(connections){
    connections.replaceChildren();
    for(const connection of curriculum.academicConnections||[]){
      const article=document.createElement("article");
      const head=document.createElement("div");
      const area=document.createElement("h4");area.textContent=connection.area;
      const relation=document.createElement("span");relation.textContent=connection.relation;
      head.append(area,relation);
      const note=document.createElement("p");note.textContent=connection.note;
      const links=document.createElement("div");links.className="connection-links";
      for(const target of connection.targets||[]){
        const targetEl=document.getElementById(target);if(!targetEl) continue;
        const a=document.createElement("a");a.href="#"+target;a.textContent=(targetEl.querySelector("h3")?.textContent||target)+" ↓";links.append(a);
      }
      article.append(head,note,links);connections.append(article);
    }
  }

  const intersection=$("#iitm-intersection-areas");
  if(intersection){
    intersection.replaceChildren();
    for(const area of curriculum.longTermIntersection?.areas||[]){const span=document.createElement("span");span.textContent=area;intersection.append(span);}
  }

  document.documentElement.dataset.iitmLearningReady="true";
}
