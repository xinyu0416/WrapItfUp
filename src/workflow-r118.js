(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function groupPinKeys(project,scene,keys){
 const wanted=new Set(keys),pins=new Set(),topNames=new Set();
 for(const g of scene.groups||[])if(wanted.has(g.key)){
  if(g.instance)for(const name of g.members||[])pins.add(g.instance+'::'+name);
  else if(g.moduleId==='top')for(const name of g.members||[])topNames.add(name);
 }
 for(const c of project.connections||[])if(c.expr&&[...topNames].some(n=>new RegExp('(^|[^A-Za-z0-9_$])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z0-9_$])').test(c.expr)))pins.add(c.instance+'::'+c.port);
 return [...pins];
}
function interfaceImpact(before,after,id){
 const a=before.modules?.find(m=>m.id===id),b=after.modules?.find(m=>m.id===id);if(!a||!b)return {ports:[],instances:[],bindings:0};
 const ports=[];for(const p of a.ports){const n=b.ports.find(q=>q.id===p.id)||b.ports.find(q=>q.name===p.name);if(!n||['name','direction','range','signed'].some(k=>String(n[k]??'')!==String(p[k]??'')))ports.push({before:p,after:n||null});}
 for(const n of b.ports)if(!a.ports.some(p=>p.id===n.id||p.name===n.name))ports.push({before:null,after:n});
 const instances=before.instances.filter(i=>i.module===a.name),ids=new Set(instances.map(i=>i.id)),names=new Set(ports.map(p=>p.before?.name).filter(Boolean));
 return {ports,instances,bindings:before.connections.filter(c=>ids.has(c.instance)&&names.has(c.port)).length};
}
function layoutPlan(project,kind,G,L){
 const original=clone(project),candidate=clone(project),before=G.create(clone(project));
 if(kind==='arrange'){delete candidate.workbook.graphAutoR99;L.arrange(candidate);}
 if(kind==='optimize'){delete candidate.workbook.graphAutoR99;candidate.workbook.wireRoutes={};}
 candidate.workbook.graphAutoR99=G.prepare(candidate,{force:true}).snapshot;
 const after=G.create(candidate),old=new Map(before.placed.map(b=>[b.instance.id,b]));
 const moved=after.placed.filter(b=>{const a=old.get(b.instance.id);return !a||a.x!==b.x||a.y!==b.y;}).length;
 return {project:candidate,before,after,moved,unchanged:JSON.stringify(original)===JSON.stringify(candidate)};
}
const api={groupPinKeys,interfaceImpact,layoutPlan};root.WIUWorkflowR118=api;if(typeof module==='object')module.exports=api;
})(globalThis);
