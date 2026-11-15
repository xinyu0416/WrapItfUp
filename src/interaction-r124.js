(function(root){'use strict';
const W=()=>root.WIUWorkbook||(typeof require==='function'?require('./workbook'):null);
const C=()=>root.WIUCore||(typeof require==='function'?require('./assembly-core'):null);
function disclosures(raw){return Object.fromEntries(Object.entries(raw||{}).filter(([key,value])=>typeof value==='boolean'&&(key.startsWith('module:')||['design','recovered'].includes(key))));}
function disclosureOpen(state,key,search=false){return Object.hasOwn(state||{},key)?state[key]:!!search;}
function nameError(project,id,value){
 const name=String(value).trim();
 if(!C().validName(name))return '名稱需以英文字母或底線開頭，後接英數字、底線或 $；不可含空白或減號。';
 if((id!=='top'&&name===project.top)||project.modules.some(m=>m.id!==id&&m.name===name))return '模組名稱「'+name+'」已使用，請改用其他名稱。';
 return W().editCapabilities(project,id).renameReason;
}
function rename(project,id,value){
 const name=String(value).trim(),error=nameError(project,id,name);if(error)throw Error(error);
 const m=W().moduleOf(project,id);if(name===m.name)return project;
 if(id==='top'){
  const next=structuredClone(project);next.top=name;next.orgEdited=true;
  if(next.workbook.diagrams.top)next.workbook.diagrams.top.moduleName=name;
  return W().normalize(next,project);
 }
 const raw=W().makeDiagram(project,id);raw.moduleName=name;
 return W().applyDiagram(project,id,raw,{ports:structuredClone(m.ports),parameters:structuredClone(m.parameters||[]),issues:[]}).project;
}
const api={disclosures,disclosureOpen,nameError,rename};root.WIUInteractionR124=api;if(typeof module==='object')module.exports=api;
})(globalThis);
