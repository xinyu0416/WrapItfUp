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
 const deadline=root.WIURoutingDeadline;
 const mode=root.WIUInteractiveRouting;root.WIUInteractiveRouting=true;
 try{
 const before=G.create(clone(project),{full:true}),base=clone(project),locks=new Set(project.workbook.layoutLocks||[]);
 const counts=s=>[s.routeQualityR98?.summary?.finalInvalid||0,s.routeQualityR98?.summary?.parallelSpacing?.count||0,s.crossingSummary?.overlaps||0,s.crossingSummary?.unresolved||0];
 const old=counts(before),score=c=>c[0]*100000+c[1]*1000+c[2]*100+c[3];
 const candidates=[{project:base,scene:before}];
 const keepLocks=scene=>before.placed.filter(b=>locks.has(b.instance.id)).every(b=>{const n=scene.placed.find(x=>x.instance.id===b.instance.id);return n&&n.x===b.x&&n.y===b.y&&n.width===b.width&&n.height===b.height;});
 const add=(p,scene)=>{const c=counts(scene);if(c.every((n,i)=>n<=old[i])&&keepLocks(scene))candidates.push({project:p,scene});};
 if(kind==='fine'){
  root.WIURoutingDeadline=Date.now()+8000;
  const q=clone(base);q.workbook.graphAutoR99=G.prepare(q,{force:true}).snapshot;const scene=G.create(q,{full:true});add(q,scene);const accepted=candidates.length>1&&score(counts(scene))<score(old),after=accepted?scene:before;
  return {project:accepted?q:base,before,after,moved:accepted?after.placed.filter(b=>{const a=before.placed.find(x=>x.instance.id===b.instance.id);return a.x!==b.x||a.y!==b.y;}).length:0,unchanged:!accepted,note:accepted?'已完成本輪限時局部修復；剩餘衝突仍列出，可再次執行。':'這輪限時修復未找到較好的安全配置，原圖保持不變。'};
 }
 const reroute=(p,scene)=>{const q=clone(p);if(kind==='optimize'&&!scene.autoSize?.topLanes&&!locks.size){delete q.workbook.graphAutoR99;q.workbook.graphPositions=Object.fromEntries(scene.placed.map(b=>[b.instance.id,{x:b.x,y:b.y}]));q.workbook.wireRoutes={};const next=G.create(q,{full:true});q.workbook.graphAutoR99=G.snapshotScene(q,next);return {project:q,scene:next};}const snap=G.snapshotScene(q,scene);if(kind==='optimize')q.workbook.wireRoutes={};snap.routes=Object.fromEntries(Object.entries(snap.routes).filter(([,r])=>kind!=='optimize'&&r.manual));snap.settlingRouting=true;snap.layoutIdentity=G.layoutIdentity(q);q.workbook.graphAutoR99=snap;const next=G.create(q,{full:true});q.workbook.graphAutoR99=G.snapshotScene(q,next);return {project:q,scene:next};};
 let seed={project:base,scene:before};
 if(kind==='arrange'&&!locks.size){const p=clone(base);delete p.workbook.graphAutoR99;L.arrange(p);seed={project:p,scene:G.create(p,{full:true})};add(seed.project,seed.scene);}
 if(kind==='optimize'){seed=reroute(base,before);add(seed.project,seed.scene);}
 root.WIURouteProgress?.({phase:'依線距擴大空間並比較結果'});
 const expanded=G.expandSpace(seed.project,seed.scene);
 if(expanded){const p=clone(seed.project);p.workbook.graphAutoR99=expanded;const scene=G.create(p,{full:true});add(p,scene);const routed=reroute(p,scene);add(routed.project,routed.scene);}
 else if(kind==='repair'){const routed=reroute(base,before);add(routed.project,routed.scene);}
 let best=candidates[0];for(const c of candidates.slice(1))if((score(counts(c.scene))<score(counts(best.scene))||(kind==='arrange'&&best===candidates[0]&&score(counts(c.scene))===score(counts(best.scene)))))best=c;
 const unchanged=best===candidates[0],candidate=clone(best.project),after=best.scene;
 if(!unchanged)candidate.workbook.graphAutoR99=G.snapshotScene(candidate,after);
 const moved=after.placed.filter(b=>{const a=before.placed.find(x=>x.instance.id===b.instance.id);return !a||a.x!==b.x||a.y!==b.y;}).length;
 const remaining=counts(after).some(Boolean),manual=before.edges.some(e=>e.manual);
 const note=(unchanged?'這次沒有找到較好的安全配置，原圖保持不變。':expanded?'已比較擴大空間及重新走線，選用衝突較少且沒有增加其他類型衝突的結果。':'已比較重新走線，選用較安全的結果。')+(manual&&kind!=='optimize'?' 手動走線保留；若要全部重排，請選「重新自動走線」。':'')+(locks.size?' 鎖定 Block 的位置與大小保持不變。':'')+(remaining?' 仍有未解決的圖面衝突，下方列出前後數量。':'');
 return {project:candidate,before,after,moved,unchanged,note};
 }finally{root.WIUInteractiveRouting=mode;root.WIURoutingDeadline=deadline;}
}

const api={groupPinKeys,interfaceImpact,layoutPlan};root.WIUWorkflowR118=api;if(typeof module==='object')module.exports=api;
})(globalThis);
