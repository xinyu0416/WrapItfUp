/* Top structure artwork: one scene for the browser preview and native Visio.
 * Coordinates deliberately follow graph-layout/workbook-view. Viewport pan/zoom
 * and editor controls are not part of the exported drawing. */
(function(root){'use strict';
const dep=(key,file)=>root[key]||(typeof require==='function'?require('./'+file):null);
const D=dep('WIUDiagramScene','diagram-scene'),W=dep('WIUWorkbook','workbook'),A=dep('WIUActions','assembly-actions'),G=dep('WIUGraphWiring','graph-wiring');
if(!root.WIUWorkbook)root.WIUWorkbook=W;
const L=dep('WIUGraphLayout','graph-layout'),Auto=dep('WIUTopAutoSizeR98','top-autosize-r98'),WG=dep('WIUWireGeometry','wire-geometry'),C=dep('WIUCore','assembly-core'),E=dep('WIUElectricalAudit','graph-electrical-audit'),RQ=dep('WIURoutingQualityR98','routing-quality-r98'),NR=dep('WIUNativeRoutingR92','native-routing-r92'),Corner=dep('WIUCornerUntangleR100','corner-untangle-r100');
const IL=dep('WIUInstanceLayout','instance-layout');
const Track=dep('WIUTrackSpaceR106','track-space-r106'),FastRoute=dep('WIUFastRouting','routing-fast-r130'),Viewport=dep('WIUSceneViewport','graph-viewport-r130');
const color=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'#3e7662';
const identifier=s=>/^[A-Za-z_$][\w$]*$/.test(s||'');
const measure=(s,font)=>{const size=Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1])||11;return Array.from(s).reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.64)*size,0);};
// Explicit lines give SVG and Visio identical appendix layout. Keep every
// character, and prefer boundaries between words before splitting long tokens.
function wrap(value,width,size){
 const lines=[],fits=s=>measure(s,size+'px')*1.14+12<=width;
 for(const paragraph of String(value).split(/\r\n|\r|\n/)){
  let rest=paragraph;if(!rest){lines.push('');continue;}
  while(rest){if(fits(rest)){lines.push(rest);break;}const chars=Array.from(rest);let n=1;while(n<chars.length&&fits(chars.slice(0,n+1).join('')))n++;
   let count=n;for(let i=n-1;i>=Math.floor(n*.55);i--)if(/\s/.test(chars[i])){count=i+1;break;}
   lines.push(chars.slice(0,count).join(''));rest=chars.slice(count).join('');
  }
 }
 return lines;
}
// A small Manhattan visibility grid keeps artwork wires out of block interiors.
// It is intentionally not an EDA router: shared channels may still overlap.
const WIRE_LABEL_PITCH=29;
function minQueue(){
 const heap=[];let serial=0;
 const less=(a,b)=>a.value.cost<b.value.cost||a.value.cost===b.value.cost&&a.order<b.order;
 return {get length(){return heap.length;},push(value){const entry={value,order:serial++};let i=heap.length;heap.push(entry);while(i){const p=(i-1)>>1;if(!less(entry,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=entry;},shift(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],last))break;heap[i]=heap[c];i=c;}heap[i]=last;}return first.value;}};
}
function route(a,b,obstacles,serial,used=[],net='',protectedLabels=[],limits=null){
 const gap=40+(serial%5)*3,stub=40,aa=IL.escape(a,stub),bb=IL.escape(b,stub);
 let xs=[...new Set([aa.x,bb.x,...obstacles.flatMap(o=>[o.x-gap,o.x+o.width+gap])])].sort((a,b)=>a-b);
 // Occupied horizontal tracks suggest fresh candidate tracks at least one text-height away.
 // Cap the neighborhood: 145+ wires must not make a quadratic grid explode.
 const occupied=[];const nearby=[];
 for(const edge of used){if(edge.net===net)continue;for(const [x1,y1,x2,y2] of edge.points){
  const hor=Math.abs(y1-y2)<.1,ver=Math.abs(x1-x2)<.1;
  if(!hor&&!ver)continue;
  occupied.push({x1,y1,x2,y2,hor,ver});
  if(hor&&Math.abs(x2-x1)>=35){const distance=Math.min(Math.abs(y1-a.y),Math.abs(y1-b.y));if(distance<180)nearby.push({y:y1,d:distance});}
 }}
 // Expand vertical routing lanes so parallel nets do not all occupy the same x.
 const midX=(aa.x+bb.x)/2;
 const verticalLanes=[...new Set(occupied.filter(e=>e.ver).map(e=>e.x1))]
  .sort((x,y)=>Math.min(Math.abs(x-aa.x),Math.abs(x-bb.x),Math.abs(x-midX))-
                 Math.min(Math.abs(y-aa.x),Math.abs(y-bb.x),Math.abs(y-midX)))
  .slice(0,16).flatMap(x=>[x-28,x+28]);
 xs=[...new Set([...xs,...verticalLanes.filter(x=>x>(limits?.minX??60)&&x<(limits?.maxX??Infinity))])].sort((a,b)=>a-b);
 nearby.sort((x,y)=>x.d-y.d);
 const extra=nearby.slice(0,12).flatMap(v=>[v.y-WIRE_LABEL_PITCH,v.y+WIRE_LABEL_PITCH]).filter(y=>y>=82);
 const ys=[...new Set([aa.y,bb.y,...obstacles.flatMap(o=>[o.y-gap,o.y+o.height+gap]),...extra])].sort((a,b)=>a-b);
 const nearUsed=(x1,y1,x2,y2)=>{
  let cost=0,hor=Math.abs(y1-y2)<.1,ver=Math.abs(x1-x2)<.1;
  if(!hor&&!ver)return 0;
  const lo=Math.min(hor?x1:y1,hor?x2:y2),hi=Math.max(hor?x1:y1,hor?x2:y2);
  for(const seg of occupied){
    const {x1:u1,y1:v1,x2:u2,y2:v2,hor:otherHor,ver:otherVer}=seg;
    if(hor&&otherHor){const over=Math.min(hi,Math.max(u1,u2))-Math.max(lo,Math.min(u1,u2)),distance=Math.abs(y1-v1);if(over>0&&distance<WIRE_LABEL_PITCH)cost+=Math.min(over,250)*7*(1-distance/WIRE_LABEL_PITCH);}
    else if(ver&&otherVer){const over=Math.min(hi,Math.max(v1,v2))-Math.max(lo,Math.min(v1,v2)),distance=Math.abs(x1-u1);if(over>0&&distance<12)cost+=Math.min(over,180)*2*(1-distance/12);}
    else if((hor&&otherVer&&u1>lo&&u1<hi&&y1>Math.min(v1,v2)&&y1<Math.max(v1,v2))||(ver&&otherHor&&x1>Math.min(u1,u2)&&x1<Math.max(u1,u2)&&v1>lo&&v1<hi))cost+=85;
  }
  for(const label of protectedLabels){if(label.net===net)continue;
   if(hor&&y1>=label.y-6&&y1<=label.y+label.height+6&&hi>label.x-6&&lo<label.x+label.width+6)cost+=900;
   if(ver&&x1>=label.x-6&&x1<=label.x+label.width+6&&hi>label.y-6&&lo<label.y+label.height+6)cost+=900;
  }
  if(ver&&limits&&(x1<limits.minX+47||x1>limits.maxX-47))cost+=Math.abs(y2-y1)*2.5;
  return cost;
 };
 const inside=(x,y)=>obstacles.some(o=>x>o.x+1&&x<o.x+o.width-1&&y>o.y+1&&y<o.y+o.height-1);
 const clear=(x1,y1,x2,y2)=>!obstacles.some(o=>x1===x2?x1>o.x+1&&x1<o.x+o.width-1&&Math.max(y1,y2)>o.y+1&&Math.min(y1,y2)<o.y+o.height-1:y1>o.y+1&&y1<o.y+o.height-1&&Math.max(x1,x2)>o.x+1&&Math.min(x1,x2)<o.x+o.width-1);
 if(!clear(a.x,a.y,aa.x,aa.y)||!clear(bb.x,bb.y,b.x,b.y))return null;
 const start={ix:xs.indexOf(aa.x),iy:ys.indexOf(aa.y),dir:0,cost:0,parent:null},goal={ix:xs.indexOf(bb.x),iy:ys.indexOf(bb.y)},queue=minQueue(),best=new Map();queue.push(start);let last=null;
 while(queue.length){const p=queue.shift(),key=p.ix+','+p.iy+','+p.dir;if(best.has(key)&&best.get(key)<p.cost)continue;if(p.ix===goal.ix&&p.iy===goal.iy){last=p;break;}
  for(const [dx,dy,dir] of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){const ix=p.ix+dx,iy=p.iy+dy;if(ix<0||iy<0||ix>=xs.length||iy>=ys.length||inside(xs[ix],ys[iy])||!clear(xs[p.ix],ys[p.iy],xs[ix],ys[iy]))continue;
   const cost=p.cost+Math.abs(xs[ix]-xs[p.ix])+Math.abs(ys[iy]-ys[p.iy])+(p.dir&&p.dir!==dir?16:0)+nearUsed(xs[p.ix],ys[p.iy],xs[ix],ys[iy]),key=ix+','+iy+','+dir;if(best.has(key)&&best.get(key)<=cost)continue;best.set(key,cost);queue.push({ix,iy,dir,cost,parent:p});
  }
 }
 if(!last)return null;const points=[];for(let n=last;n;n=n.parent)points.unshift({x:xs[n.ix],y:ys[n.iy]});points.unshift(a);points.push(b);
 const clean=[];for(const p of points){const n=clean.length;if(n&&clean[n-1].x===p.x&&clean[n-1].y===p.y)continue;if(n>1&&((clean[n-2].x===clean[n-1].x&&p.x===clean[n-1].x)||(clean[n-2].y===clean[n-1].y&&p.y===clean[n-1].y)))clean.pop();clean.push(p);}return clean;
}
// Compatibility entry point for the graph/geometry regression tests.
// The full analyzer is also used by both SVG and Visio exports.
function wireMarks(edges,pins,obstacles){return WG.analyze(edges,pins,obstacles).marks;}
// r98: a complete scene is CPU-intensive for a dense top. All consumers
// (preview, diagnostics and export) reuse one immutable-by-contract scene
// for an identical serialized workbook. This is a bounded content cache,
// NOT a project reference cache: in-place edits invalidate automatically.
const sceneCache=new Map();
function usedModules(p){const names=new Set(p.instances.map(i=>i.module));return p.modules.filter(m=>names.has(m.name));}
// Cache artwork inputs, not source files, unused module sheets or delivery state.
function sceneKey(p){
 const modules=usedModules(p).map(({id,name,ports,parameters})=>({id,name,ports,parameters}));
 const ids=new Set(['top',...modules.map(m=>m.id)]),wb=p.workbook||{};
 const diagrams=Object.fromEntries(Object.entries(wb.diagrams||{}).filter(([id])=>ids.has(id)));
 return JSON.stringify({top:p.top,parameters:p.parameters,modules,instances:p.instances,nets:p.nets,connections:p.connections,assigns:p.assigns,defineConfig:p.defineConfig,workbook:{diagrams,...Object.fromEntries(['graphPositions','topPortY','wireRoutes','topStyle','graphAutoR99','instanceLayouts','routingSpace','routingCorridorPass','topPortSideCopies'].map(k=>[k,wb[k]]))}});
}
function peek(p){return sceneCache.get(sceneKey(p));}
function prime(p,scene){sceneCache.set(sceneKey(p),scene);while(sceneCache.size>4)sceneCache.delete(sceneCache.keys().next().value);return scene;}

// Geometry-only edits are explicitly excluded: graphPositions, topPortY,
// manual wireRoutes AND Top diagram port ordering cannot trigger expensive
// global automatic routing. Net/port additions still change the signature.
function topologySignature(p,{includeUnused=false}={}){
 const raw=JSON.stringify({instanceLayouts:p.workbook?.instanceLayouts,top:p.top,parameters:p.parameters,modules:(includeUnused?p.modules:usedModules(p)).map(m=>({id:m.id,name:m.name,ports:m.ports,parameters:m.parameters})),instances:p.instances,nets:p.nets,connections:p.connections,assigns:p.assigns,route:p.workbook?.topStyle?.route||'orthogonal'});
 let h1=2166136261,h2=0x9e3779b9;
 for(let i=0;i<raw.length;i++){const c=raw.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=Math.imul(h2^(c+i),2246822519);}
 return raw.length.toString(36)+':'+(h1>>>0).toString(36)+':'+(h2>>>0).toString(36);
}
// Only geometry-affecting interface IDs, names and endpoint bindings require
// rerouting. Direction / param default changes are electrically revalidated
// separately; they must not destroy the user's adjusted diagram.
function routeIdentity(p,options){
 const p2={...p,modules:p.modules.map(m=>({...m,ports:(m.ports||[]).map(v=>({id:v.id,name:v.name,groupId:v.groupId,side:v.side})),parameters:[]})),parameters:[],instances:p.instances.map(i=>({...i,parameters:{}}))};
 return topologySignature(p2,options);
}
function layoutIdentity(p,{ignoreTopNetNames=false,includeUnused=false}={}){
 // Port IDs keep their positions through label edits. nameBinding records
 // the generated/custom label and changes together with that label.
 const nets=p.nets.filter(n=>n.direction!=='wire').map(n=>ignoreTopNetNames?{...n,name:'',nameBinding:undefined}:n);
 return topologySignature({...p,connections:[],assigns:[],nets},{includeUnused});
}
function pendingFreeze(p){
 const f=p.workbook?.graphAutoR99;
 return f?.version===1&&f.pendingRouting&&f.routes&&f.placed&&(f.layoutIdentity===layoutIdentity(p)||f.layoutIdentity===layoutIdentity(p,{includeUnused:true}))?f:null;
}
function settlingFreeze(p){
 const f=p.workbook?.graphAutoR99;
 return f?.version===1&&f.settlingRouting&&f.routes&&f.placed&&(f.layoutIdentity===layoutIdentity(p)||f.layoutIdentity===layoutIdentity(p,{includeUnused:true}))?f:null;
}
function validFreeze(p){
 const f=p.workbook?.graphAutoR99;
 if(f?.version!==1||f.pendingRouting||f.settlingRouting||!f.routes||!f.placed)return null;
 if(f.routeIdentity===routeIdentity(p)||f.routeIdentity===routeIdentity(p,{includeUnused:true}))return f;
 // r102 snapshots remain readable. They get an identity when the graph is
 // next captured, without losing their exact hand-adjusted polylines.
 if(f.signature===topologySignature(p)||f.signature===topologySignature(p,{includeUnused:true}))return f;
 return null;
}
// Electrical edits and Top label renames retain the drawing until arrange/export.
// A pending snapshot is never accepted as a fully routed geometry snapshot.
function deferConnections(before,after){
 if(before.workbook?.projectId!==after.workbook?.projectId)return false;
 const electrical=p=>JSON.stringify([p.connections,p.assigns,p.nets]);
 if(electrical(before)===electrical(after))return false;
 if(JSON.stringify(before.workbook?.graphAutoR99)!==JSON.stringify(after.workbook?.graphAutoR99))return false;
 const prior=pendingFreeze(before)||validFreeze(before);
 if(!prior||layoutIdentity(before,{ignoreTopNetNames:true})!==layoutIdentity(after,{ignoreTopNetNames:true}))return false;
 const snapshot=JSON.parse(JSON.stringify(prior));
 snapshot.pendingRouting=true;snapshot.layoutIdentity=layoutIdentity(after);
 delete snapshot.lastRepair;
 after.workbook.graphAutoR99=snapshot;
 return true;
}
const ptsOf=e=>e.points.length?[[e.points[0][0],e.points[0][1]],...e.points.map(v=>[v[2],v[3]])]:[];
function compressed(points){const out=[];for(const p of points){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
 if(out.length&&out.at(-1).x===p.x&&out.at(-1).y===p.y)continue;
 while(out.length>1&&(out.at(-2).x===out.at(-1).x&&out.at(-1).x===p.x||out.at(-2).y===out.at(-1).y&&out.at(-1).y===p.y))out.pop();out.push(p);
 }return out;}
function frozenLead(a,b,side){
 const lead=IL.escape({...a,side},40);
 const elbow=['top','bottom'].includes(side)?{x:b.x,y:lead.y}:{x:lead.x,y:b.y};
 return compressed([a,lead,elbow,b]);
}
function frozenPath(record,a,b){
 const old=(record?.points||[]).map(p=>({x:p[0],y:p[1]}));if(old.length<2)return null;
 const same=(u,v)=>Math.abs(u.x-v.x)<.001&&Math.abs(u.y-v.y)<.001;
 if(same(old[0],a)&&same(old.at(-1),b))return old;
 let path=old;
 if(!same(old[0],a)){
  const i=Math.min(2,old.length-1),lead=frozenLead(a,old[i],a.side);
  path=[...lead,...old.slice(i+1)];
 }
 if(!same(path.at(-1),b)){
  const i=Math.max(0,path.length-3),lead=frozenLead(b,path[i],b.side).reverse();
  path=[...path.slice(0,i),...lead];
 }
 path=compressed(path);
 return path.length>=2&&path.slice(1).every((p,i)=>p.x===path[i].x||p.y===path[i].y)?path:null;
}
function pendingPath(a,b){
 const first=IL.escape(a,40);
 const last=IL.escape(b,40),y=(first.y+last.y)/2;
 return compressed([a,first,{x:first.x,y},{x:last.x,y},last,b]);
}
function snapshotScene(project,scene){
 return {version:1,signature:topologySignature(project),routeIdentity:routeIdentity(project),
  placed:Object.fromEntries(scene.placed.map(b=>[b.instance.id,{x:b.x,y:b.y}])),
  inputPositions:JSON.parse(JSON.stringify(project.workbook?.graphPositions||{})),
  inputManualRoutes:JSON.parse(JSON.stringify(project.workbook?.wireRoutes||{})),
  routes:Object.fromEntries(scene.edges.map(e=>[e.routeKey,{source:e.source,target:e.target,points:ptsOf(e),manual:!!e.manual}])),autoSize:scene.autoSize};
}
function withDrawingSnapshot(project){
 const scene=peek(project);if(!scene||scene.previewOnly)return project;
 return {...project,workbook:{...project.workbook,graphAutoR99:snapshotScene(project,scene)}};
}
function layoutScore(x){
 const q=x.routeQualityR98?.summary;
 return 10000*(q?.finalInvalid||0)+1000*(q?.parallelSpacing?.count||0)+100*(x.crossingSummary?.overlaps||0)+(x.crossingSummary?.unresolved||0);
}
function spreadAutomatic(project,scene){
 const candidate=Track.expand(scene,snapshotScene(project,scene),project.workbook?.graphPositions);
 if(!candidate)return null;
 const drawing=snap=>create({...project,workbook:{...project.workbook,graphAutoR99:snap}});
 const spread=drawing(candidate);
 if(!spread.routeQualityR98?.summary.parallelSpacing.count&&!spread.crossingSummary.unresolved&&!spread.crossingSummary.overlaps)return spread;
 // Exact corner coincidences still coincide under a monotonic map. Resolve
 // those locally, with the additional room available, before comparing layouts.
 const repaired=structuredClone(spread);
 const spacing=RQ.repairSpacing(repaired,{passes:3});
 const corners=Corner.repairs(repaired,{maxFixes:16});
 if(!spacing.moves&&!corners.fixed)return spread;
 const checked=drawing(snapshotScene(project,repaired));
 return layoutScore(checked)<layoutScore(spread)?checked:spread;
}
function capture(project){
 const pending=pendingFreeze(project);
 if(pending)return pending;
 const compatible=validFreeze(project);
 if(compatible)return {...compatible,routeIdentity:routeIdentity(project)};
 const scene=create(project);
 return scene.previewOnly?null:snapshotScene(project,scene);
}
// Entry lifecycle, deliberately separate from create(). A saved dirty flag or
// positive r103 repair counter is NOT proof that the present geometry is clean.
function prepare(project,{force=false}={}){
 if(peek(project)?.previewOnly)sceneCache.delete(sceneKey(project));
 const counts=s=>({jump:s.crossingSummary?.unresolved||0,overlap:s.crossingSummary?.overlaps||0,space:s.routeQualityR98?.summary?.parallelSpacing?.count||0,invalid:s.routeQualityR98?.summary?.finalInvalid||0});
 const score=c=>c.invalid*100000+c.overlap*1000+c.space+c.jump;
 const pending=pendingFreeze(project);let pendingScene,pendingCandidate;
 if(pending){
  if(!force)return {snapshot:pending,report:{pendingRouting:true},changed:false};
  pendingScene=create(project);
  // Complete newly connected paths against the existing drawing first. The
  // old routes temporarily act as fixed obstacles, then regain their original
  // manual/automatic status before the validated snapshot is recorded.
  const scene=JSON.parse(JSON.stringify(pendingScene)),manual=scene.edges.map(e=>!!e.manual);
  const wall=scene.items.find(i=>i.role==='top-boundary');
  if(wall)scene.canvasBounds.height=wall.y+wall.height+18;
  for(const edge of scene.edges)if(pending.routes[edge.routeKey])edge.manual=true;
  const context=RQ.contextFor(scene);
  const route=scene.edges.some(e=>!RQ.valid(RQ.ptsOf(e),e,scene,context))?RQ.improve(scene):null;
  const spacing=RQ.repairSpacing(scene,{passes:4}),corners=Corner.repairs(scene,{maxFixes:32});
  scene.edges.forEach((e,i)=>{e.manual=manual[i]&&e.manual;});
  const snapshot=snapshotScene(project,scene);
  const checked=create({...project,workbook:{...project.workbook,graphAutoR99:snapshot}});
  pendingCandidate={scene:checked,c:counts(checked),moved:(route?.summary.changed||0)+spacing.moves+corners.moves,deferred:corners.deferred};
  if(score(pendingCandidate.c)===0){
   const initial=counts(pendingScene),c=pendingCandidate.c;
   snapshot.repairVersion=106;
   snapshot.lastRepair={before:initial.jump,fixed:Math.max(0,initial.jump-c.jump),remaining:c.jump,spacingBefore:initial.space,spacingAfter:c.space,moved:pendingCandidate.moved,deferred:pendingCandidate.deferred};
   return {snapshot,report:snapshot.lastRepair,changed:true};
  }
  project=JSON.parse(JSON.stringify(project));
  delete project.workbook.graphAutoR99.pendingRouting;
  project.workbook.graphAutoR99.settlingRouting=true;
 }
 const original=create(project),previous=validFreeze(project);
 const initial=counts(original);
 // Saved r106 geometry belongs to the user, including later manual edits.
 // Reopening measures the actual drawing; only the repair command may move a track.
 const inspected=!force&&previous?.repairVersion===106;
 const originalResult={scene:original,c:initial,moved:0,deferred:[]};
 const local=s=>{
  const scene=JSON.parse(JSON.stringify(s));let c=counts(s);const SP=dep('WIURoutingSpacingR98','routing-spacing-r98');
  if(pending){const wall=scene.items.find(i=>i.role==='top-boundary');if(wall)scene.canvasBounds.height=wall.y+wall.height+18;}
  let moved=0,deferred=[];
  if(c.space){const r=RQ.repairSpacing(scene,{passes:4});moved=r.moves;}
  if(c.jump||moved){const r=Corner.repairs(scene,{maxFixes:32});c.jump=r.remaining;c.overlap=r.overlaps;moved+=r.moves;deferred=r.deferred;}
  c.space=SP.scan(scene,{limit:0}).count;
  const checked=pending?create({...project,workbook:{...project.workbook,graphAutoR99:snapshotScene(project,scene)}}):scene;
  if(pending)c=counts(checked);
  return {scene:checked,c,moved,deferred};
 };
 // An explicit solver must not replace an already safer pending preview with
 // a worse candidate. Both candidates keep the same electrical endpoints.
 const pendingCounts=pendingScene&&counts(pendingScene);
 let best=pendingCounts&&score(pendingCounts)<=score(initial)?{scene:pendingScene,c:pendingCounts,moved:0,deferred:[]}:originalResult;
 if(pendingCandidate&&score(pendingCandidate.c)<score(best.c))best=pendingCandidate;
 if(!inspected&&original.style.route==='orthogonal'&&(initial.space||initial.jump)&&(previous||original.autoSize?.trackSpace)){
  // Compare the old geometry before it is locally modified: inserting free space can
  // preserve many more existing paths than first individually moving those routes.
  const mayExpand=previous&&previous.repairVersion!==106&&!force;
  const expanded=mayExpand?spreadAutomatic(project,original):null;
  const seed=expanded&&score(counts(expanded))<score(initial)?expanded:original;
  const seedCounts=counts(seed);
  const repaired=score(seedCounts)?local(seed):{scene:seed,c:seedCounts,moved:0,deferred:[]};
  if(score(repaired.c)<score(best.c))best=repaired;
  if(seed===original&&mayExpand&&best.moved&&score(best.c)>0){
   const retry=spreadAutomatic(project,best.scene);
   if(retry&&score(counts(retry))<score(best.c)){const r=local(retry);if(score(r.c)<score(best.c))best=r;}
  }
 }
 const {scene,c,moved,deferred}=best,snapshot=snapshotScene(project,scene);
 const before=pendingScene?counts(pendingScene):initial;
 snapshot.repairVersion=106;
 snapshot.lastRepair={before:before.jump,fixed:Math.max(0,before.jump-c.jump),remaining:c.jump,spacingBefore:before.space,spacingAfter:c.space,moved,deferred};
 return {snapshot,report:snapshot.lastRepair,changed:!!pending||best!==originalResult};
}

function create(project,{fast=false,full=false}={}){
 const cacheKey=sceneKey(project);
 if(sceneCache.has(cacheKey)&&!(full&&sceneCache.get(cacheKey).previewOnly)){
  const result=sceneCache.get(cacheKey);
  sceneCache.delete(cacheKey);sceneCache.set(cacheKey,result);
  return result;
 }
 if(!fast)root.WIURouteProgress?.({phase:'配置方塊與接腳'});
 const pending=pendingFreeze(project),settling=settlingFreeze(project),frozen=pending||settling||validFreeze(project);
 const automatic=!frozen||!!settling;
 const S=root.WIUDiagramStyle||(typeof require==='function'?require('./diagram-style'):null),style=S.settings(project),rawPlaced=L.layout(project),top=L.topPorts(project),ends=G.endpoints(project),endByKey=new Map(ends.map(e=>[e.key,e])),rows=A.pinRows(project),points=new Map(),items=[],edges=[],notes=[],groups=[],labels=[];
 const topDiagram=W.makeDiagram(project,'top'),topRows={},topGroups=[];
 const topParameterText=(project.parameters||[]).map(p=>(p.local?'localparam ':'parameter ')+(p.type?p.type+' ':'')+p.name+' = '+p.value).join('    ·    ');
 const topParameterLines=topParameterText?wrap(topParameterText,860,11):[];
 const headerBottom=66+topParameterLines.length*18;
 for(const side of ['left','right']){let previous=headerBottom-4,lastGroup='';topRows[side]=[];top[side].forEach((p,index)=>{if(!p)return;const sig=topDiagram.signals[side].find(s=>s.id===p.id),g=topDiagram.groups[side].find(g=>g.id===sig?.groupId),key=g?S.groupKey('top',side,g.id):'',changed=key!==lastGroup,y=Math.max(Math.max(project.workbook.topPortY?.[p.id]||112+index*48,headerBottom+42),previous+44+(changed?34:0));topRows[side].push({p,index,y,g,key});if(g){if(changed)topGroups.push({key,name:W.groupLabel(topDiagram,side,g.id),side,top:y-40,bottom:y+22,color:S.color(project,key,topDiagram.groups[side].indexOf(g),g.name,g.color),moduleId:'top',members:[]});const gg=topGroups.at(-1);gg.bottom=y+22;gg.members.push(p.name);}previous=y;lastGroup=key;});}
 const outer= Math.max(290,...project.nets.filter(n=>n.direction!=='wire').map(n=>measure(n.name+(n.range||''),'12px')+42)),leftX=outer;
 const trackSpace=frozen?.autoSize?.trackSpace;
 if(trackSpace){
  const Y=v=>Track.mapped(trackSpace.y,v);
  for(const rows of Object.values(topRows))for(const row of rows)row.y=Y(row.y);
  for(const g of topGroups){g.top=Y(g.top+40)-40;g.bottom=Y(g.bottom-22)+22;}
 }
 const autoSize=frozen?{placed:rawPlaced.map(b=>{const initial=frozen.placed[b.instance.id],original=frozen.inputPositions?.[b.instance.id],current=project.workbook?.graphPositions?.[b.instance.id];const changed=JSON.stringify(current||null)!==JSON.stringify(original||null);return {...(trackSpace?Track.block(b,trackSpace):b),x:changed&&current?current.x:initial?.x??b.x,y:changed&&current?current.y:initial?.y??b.y};}),expansion:{...frozen.autoSize,manual:true,active:false}}:rawPlaced.some(b=>b.shape==='bar')?{placed:rawPlaced,expansion:{active:false,changedInstances:0,widthAdded:0,heightAdded:0}}:Auto.plan(project,rawPlaced,{leftX,headerBottom}),placed=autoSize.placed;
 const rightX=Math.max(leftX+1050,...placed.map(b=>b.x+b.width+580))+(autoSize.expansion.extraRight||0),width=rightX+outer+24,height=Math.max(500,...placed.map(b=>b.y+b.height+(b.barColumns?.bottom.length?140:70)),150+Math.max(top.left.length,top.right.length)*48,...Object.values(topRows).flat().map(r=>r.y+100))+(autoSize.expansion.extraBottom||0);
 const rawHeight=Math.max(500,...rawPlaced.map(b=>b.y+b.height+(b.barColumns?.bottom.length?140:70)),150+Math.max(top.left.length,top.right.length)*48,...Object.values(topRows).flat().map(r=>r.y+100));
 if(!frozen)autoSize.expansion.heightAdded=Math.max(0,height-rawHeight);
 autoSize.expansion.active=!frozen&&(autoSize.expansion.changedInstances>0||autoSize.expansion.widthAdded>0||autoSize.expansion.heightAdded>0);
 const obstacles=placed.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height}));
 const denseRouting=!!root.WIUInteractiveRouting&&project.connections.length>200;
 const quickRouter=denseRouting?FastRoute.router(obstacles,{minX:leftX+42,maxX:rightX-42,minY:headerBottom+42}):null;
 const ink=style.monochrome?'#222222':'#392849',muted=style.monochrome?'#555555':'#615a67';
 const note=(label,value,kind='expression')=>notes.push({label,value:String(value),kind});
 const text=(value,x,y,align='start',options={})=>{const t=D.text(value,x,y,align,{size:12,color:ink,...options},measure);items.push(t);return t;};
 const line=(x1,y1,x2,y2,o={})=>items.push({type:'line',x1,y1,x2,y2,color:ink,weight:1,...o});
 const rect=(x,y,width,height,o={})=>items.push({type:'rect',x,y,width,height,color:ink,weight:1,...o});
 const glyph=(x,y,direction,side,color,key)=>{const toward=side==='left'?1:-1,dir=direction==='output'?-toward:toward;
  const pts=direction==='inout'?[[x-7,y],[x-3,y-5],[x+3,y-5],[x+7,y],[x+3,y+5],[x-3,y+5]]:[[x-dir*7,y-5],[x+dir*1,y-5],[x+dir*7,y],[x+dir*1,y+5],[x-dir*7,y+5]];
  items.push({type:'polygon',points:pts,color,fill:'#ffffff',weight:1.4,role:'directional-port',key});};
 rect(leftX,18,rightX-leftX,height-36,{fill:'#ffffff',weight:1.7,role:'top-boundary'});
 rect(leftX,18,rightX-leftX,headerBottom-18,{fill:style.monochrome?'#eeeeee':'#f0ecf4',role:'top-cap'});
 text(project.top,leftX+20,43,'start',{size:20,bold:true,role:'top-name'});
 topParameterLines.forEach((line,i)=>text(line,leftX+20,66+i*18,'start',{size:11,role:'top-parameter',color:muted}));
 const drawGroup=(g,gx,gy,gw,gh,cc)=>{const tw=measure(g.name,'12px')*1.14+28,center=gx+gw/2,ty=gy+11;
    const title=(xx,align='start',bg=false)=>{if(bg)rect(align==='middle'?xx-tw/2:xx-8,gy,tw,23,{fill:cc,color:cc,role:'group-header',group:g.key});text(g.name,xx,ty,align,{size:12,bold:true,color:bg?'#ffffff':cc,role:'group-name',group:g.key});};
    if(style.group==='06')title(gx+9,'start',true);
    if(style.group==='07'){line(gx,ty,gx+gw,ty,{color:cc});title(center,'middle',true);line(gx,gy+gh,gx+gw,gy+gh,{color:cc});}
    if(style.group==='10'||style.group==='13'){rect(gx,gy+11,gw,gh-11,{color:cc,dash:style.group==='13',role:'group-frame'});const tx=style.group==='10'?center:gx+12;rect(style.group==='10'?tx-tw/2:tx-7,gy,tw,24,{fill:'#ffffff',color:'#ffffff'});title(tx,style.group==='10'?'middle':'start');}
    if(style.group==='14'){rect(gx,gy,gw,24,{color:cc,fill:'#ffffff',role:'group-header'});rect(gx,gy,6,24,{fill:cc,color:cc});title(gx+16);}
    if(style.group==='15'){title(gx+9);line(gx,gy+23,gx+gw,gy+23,{color:cc});line(gx,gy+26,gx+gw,gy+26,{color:cc});line(gx,gy+gh,gx+gw,gy+gh,{color:cc});}
 };
 const paint=[];
 // Tag all artwork belonging to an instance: native Visio groups must move
 // Block, labels and port glyphs together, not just the backing rectangle.
 const paintFor=(owner,fn)=>paint.push(()=>{const start=items.length;fn();for(let j=start;j<items.length;j++)items[j].ownerInstance=owner;});
 for(const b of placed){const {instance:i,module:m,x,y,width:bw}=b;
  if(b.shape==='bar'){
   paintFor(i.id,()=>{
    rect(x,y,bw,b.height,{fill:'#ffffff',weight:1.4,role:'instance',instance:i.id});
    text(m.name,x+18,y+25,'start',{size:17,bold:true,role:'module-name'});text(i.name+' · 水平長條',x+18,y+45,'start',{size:11,color:muted,role:'instance-name'});
    b.parameterRows.forEach((r,j)=>text(r.text,x+18,y+68+j*21,'start',{size:11,color:muted,role:'instance-parameter',instance:i.id,parameter:r.name,source:r.source}));
    for(const g of b.barGroups){const gy=g.side==='top'?y+b.headerHeight:y+b.height-b.detailHeight+8;
     text(g.name+' · '+g.members.length+' pins',x+g.x+6,gy,'start',{size:12,bold:true,role:'bar-group-name'});
    }
   });
   for(const side of ['top','bottom'])for(const row of b.barColumns[side]){
    const p=row.port,key=i.id+'::'+p.name,e=endByKey.get(key),px=x+row.x,py=y+row.y,ly=y+row.labelY;
    points.set(key,{x:px,y:py+(side==='top'?-7:7),side,key,instance:i.id,row,padX:px,padY:py});
    paintFor(i.id,()=>{
     rect(px-5,py-5,10,10,{fill:'#ffffff',role:'directional-port',key});
     if(!row.compact){line(px,py+(side==='top'?7:-7),px,ly,{color:'#b7c5c3',weight:.6,dash:true,role:'pin-label-leader'});
      text(({input:'IN ',output:'OUT ',inout:'I/O '})[p.direction]+p.name+(e?.width===1?'':p.range||''),px-9,ly,'end',{size:12,role:'port-name',key});
     }
     if(e?.expr==null)text('○',px,py+(side==='top'?-18:18),'middle',{size:10,role:'unconfigured',key});else if(e.expr==='')text('×',px,py+(side==='top'?-18:18),'middle',{size:10,role:'open',key});
    });
    if(e?.expr==null)note(i.name+'.'+p.name,'未設定','unconfigured');else if(e.expr==='')note(i.name+'.'+p.name,'刻意留空（NC）','open');
   }
   continue;
  }
  paintFor(i.id,()=>{rect(x,y,bw,b.height,{fill:'#ffffff',weight:1.4,role:'instance',instance:i.id});rect(x,y,bw,54,{fill:style.monochrome?'#eeeeee':'#f0ecf4',role:'instance-header'});text(m.name,x+16,y+20,'start',{size:17,bold:true,role:'module-name'});text(i.name,x+16,y+41,'start',{size:11,color:muted,role:'instance-name'});});
  if(b.parameterRows.length)paintFor(i.id,()=>{
   b.parameterRows.forEach((r,j)=>text(r.text,x+16,y+70+j*21,'start',{size:11,color:r.error?(style.monochrome?'#222222':'#9b302b'):muted,role:'instance-parameter',instance:i.id,parameter:r.name,source:r.source}));
   line(x+12,y+54+b.parameterHeight,x+bw-12,y+54+b.parameterHeight,{color:style.monochrome?'#bbbbbb':'#ddd6e4'});
  });
  for(const g of b.groups){const gx=x+(g.side==='left'?10:bw/2+4),gw=bw/2-14,gy=y+g.y,gh=g.bottom-g.y+4,cc=g.color;groups.push({...g,instance:i.id,x:gx,y:gy,width:gw,height:gh});
   paintFor(i.id,()=>drawGroup(g,gx,gy,gw,gh,cc));
  }
  for(const side of ['left','right'])for(const row of b.columns[side]){if(!row)continue;const p=row.port,key=i.id+'::'+p.name,px=side==='left'?x:x+bw,py=y+row.y,align=side==='left'?'start':'end',lx=px+(side==='left'?17:-17),g=b.groups.find(g=>g.side===side&&g.id===row.group),cc=g?.color||muted,e=endByKey.get(key);
   points.set(key,{x:px+(side==='left'?-7:7),y:py,side,key,instance:i.id,row,group:g?.key,padX:px});
   paintFor(i.id,()=>{glyph(px,py,p.direction,side,cc,key);text(p.name+(e?.width===1?'':p.range||''),lx,py,align,{size:12,role:'port-name',key});row.comment.forEach((c,k)=>text(c,lx,py+17+k*15,align,{size:10,color:muted,role:'port-comment',key}));if(e?.expr==null)text('○',px+(side==='left'?-13:13),py,'middle',{size:9,color:style.monochrome?'#555555':'#8c6f4e',role:'unconfigured',key});else if(e.expr==='')text('×',px+(side==='left'?-13:13),py,'middle',{size:10,role:'open',key});});
   if(e?.expr==null)note(i.name+'.'+p.name,'未設定','unconfigured');else if(e.expr==='')note(i.name+'.'+p.name,'刻意留空（NC）','open');if(e?.expr&&!identifier(e.expr))note(i.name+'.'+p.name,e.expr,'expression');
  }
 }
 for(const g of topGroups){groups.push(g);paint.push(()=>drawGroup(g,g.side==='left'?12:rightX+12,g.top,outer-24,g.bottom-g.top,g.color));}
 for(const side of ['left','right'])topRows[side].forEach(({p,index,y,g,key:gkey})=>{const key='top::'+p.id,x=side==='left'?leftX:rightX,cc=g?S.color(project,gkey,topDiagram.groups[side].indexOf(g),g.name,g.color):muted;
  points.set(key,{x:x+(side==='left'?7:-7),y,side:side==='left'?'right':'left',outerSide:side,key,index,padX:x});

  paint.push(()=>{glyph(x,y,p.direction,side,cc,key);text(p.name+(endByKey.get(key)?.width===1?'':p.range||''),x+(side==='left'?-18:18),y,side==='left'?'end':'start',{size:12,bold:true,role:'top-port-name',key});if(p.comment)text(p.comment,x+(side==='left'?-18:18),y+17,side==='left'?'end':'start',{size:10,color:muted,role:'port-comment',key});});
 });
 const drawn=new Set(),named=new Set(),labelOverflow=[];
 const overlaps=(a,b,pad=7)=>a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;
 const routedWaypoints=project.workbook?.wireRoutes||{};
 const manualRoute=(a,b,waypoint)=>{
  const x=Number(waypoint?.x),y=Number(waypoint?.y);if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const aa=IL.escape(a,40),bb=IL.escape(b,40);
  const candidates=[a,aa,{x,y:aa.y},{x,y},{x:bb.x,y},bb,b];
  const hit=candidates.slice(1).some((pt,j)=>{const q=candidates[j];return obstacles.some(o=>{
   if(pt.x===q.x)return pt.x>o.x+2&&pt.x<o.x+o.width-2&&Math.max(pt.y,q.y)>o.y+2&&Math.min(pt.y,q.y)<o.y+o.height-2;
   if(pt.y===q.y)return pt.y>o.y+2&&pt.y<o.y+o.height-2&&Math.max(pt.x,q.x)>o.x+2&&Math.min(pt.x,q.x)<o.x+o.width-2;
   return true;
  });});
  return hit?null:candidates.filter((pt,j)=>!j||pt.x!==candidates[j-1].x||pt.y!==candidates[j-1].y);
 };

 const connect=(source,target,net,bidirectional=false,selection='')=>{
  const a=points.get(source),b=points.get(target);if(!a||!b||source===target)return;const signature=source+'|'+target+'|'+net;if(drawn.has(signature))return;drawn.add(signature);
  const stableEndpoint=key=>{if(key.startsWith('top::'))return key;const split=key.indexOf('::');if(split<0)return key;const id=key.slice(0,split),portName=key.slice(split+2),instance=project.instances.find(i=>i.id===id),module=project.modules.find(m=>m.name===instance?.module),port=module?.ports.find(p=>p.name===portName);return id+'::'+(port?.id||portName);};
  const netId=project.nets.find(n=>n.name===net)?.id||net,routeKey=stableEndpoint(source)+'|'+stableEndpoint(target)+'|'+netId,manualSetting=routedWaypoints[routeKey];
  let path=frozen?.routes?.[routeKey]?frozenPath(frozen.routes[routeKey],a,b):pending||fast?pendingPath(a,b):quickRouter?quickRouter.route(a,b,net,edges.length):route(a,b,obstacles,edges.length,edges,net,labels,{minX:leftX+14,maxX:rightX-14}),routed=!!path,manual=!!frozen?.routes?.[routeKey]?.manual;
  if(manualSetting&&(!frozen||JSON.stringify(manualSetting)!==JSON.stringify(frozen.inputManualRoutes?.[routeKey]))){const test=manualRoute(a,b,manualSetting);if(test){path=test;manual=true;}else note(net,'已自動避開 Block；儲存的手動轉折路徑不安全','routing');}
  if(!fast&&style.route==='curve'&&!manual&&automatic){
   const dx=Math.max(60,Math.min(260,Math.abs(b.x-a.x)*.5)),c1=IL.escape(a,dx),c2=IL.escape(b,dx);
   const curve=Array.from({length:49},(_,j)=>{const t=j/48,s=1-t;return {x:s*s*s*a.x+3*s*s*t*c1.x+3*s*t*t*c2.x+t*t*t*b.x,y:s*s*s*a.y+3*s*s*t*c1.y+3*s*t*t*c2.y+t*t*t*b.y};});
   const crosses=curve.slice(1,-1).some(pt=>obstacles.some(o=>pt.x>o.x+2&&pt.x<o.x+o.width-2&&pt.y>o.y+2&&pt.y<o.y+o.height-2));
   const curveBox={minX:Math.min(a.x,b.x)-30,maxX:Math.max(a.x,b.x)+30,minY:Math.min(a.y,b.y)-80,maxY:Math.max(a.y,b.y)+80};
   const curveSamples=curve.filter((_,k)=>k%6===0||k===48);
   const curveCrowded=edges.some(e=>e.net!==net&&e.points.some(([x1,y1,x2,y2],k)=>k%6===0&&Math.max(x1,x2)>=curveBox.minX&&Math.min(x1,x2)<=curveBox.maxX&&Math.max(y1,y2)>=curveBox.minY&&Math.min(y1,y2)<=curveBox.maxY&&curveSamples.some(pt=>Math.hypot(pt.x-(x1+x2)/2,pt.y-(y1+y2)/2)<WIRE_LABEL_PITCH*.58)))||labels.some(l=>l.net!==net&&curveSamples.some(pt=>pt.x>l.x-9&&pt.x<l.x+l.width+9&&pt.y>l.y-9&&pt.y<l.y+l.height+9));
   if((!crosses&&!curveCrowded)||!path)path=curve;else{const smooth=[path[0]];for(let j=1;j<path.length-1;j++){const p=path[j],prev=path[j-1],next=path[j+1],r=Math.min(24,Math.hypot(p.x-prev.x,p.y-prev.y)/3,Math.hypot(next.x-p.x,next.y-p.y)/3),norm=(p,q,d)=>({x:p.x+(q.x-p.x)/Math.hypot(q.x-p.x,q.y-p.y)*d,y:p.y+(q.y-p.y)/Math.hypot(q.x-p.x,q.y-p.y)*d}),u=norm(p,prev,r),v=norm(p,next,r);smooth.push(u);for(let k=1;k<=8;k++){const t=k/8,s=1-t;smooth.push({x:s*s*u.x+2*s*t*p.x+t*t*v.x,y:s*s*u.y+2*s*t*p.y+t*t*v.y});}}smooth.push(path.at(-1));path=smooth;}
  }
  if(!path){path=[a,{x:(a.x+b.x)/2,y:a.y},{x:(a.x+b.x)/2,y:b.y},b];note(net,'通道不足；請移動 block','routing');}
  const cc=style.monochrome?'#444444':groups.find(g=>g.key===a.group||g.key===b.group)?.color||'#68778c';
  // Pad glyph already encodes port direction: never add electrical arrows.
  items.push({type:'path',points:path.map(p=>[p.x,p.y]),color:cc,weight:1.3,endArrow:false,startArrow:false,role:'connection',net,selection,source,target,routeKey,groupObject:'net:'+net});
  const segments=path.slice(1).map((p,j)=>[path[j].x,path[j].y,p.x,p.y]);
  const mid=path[Math.floor(path.length/2)],handle=manual&&manualSetting?{x:manualSetting.x,y:manualSetting.y}:{x:mid.x,y:mid.y};
  edges.push({source,target,net,selection,routeKey,bidirectional,points:segments,routed,manual,handle,color:cc});
  if(!fast&&edges.length%8===0)root.WIURouteProgress?.({phase:'計算避障路徑',done:edges.length});
  if(!fast&&!denseRouting&&style.showWireNames&&!named.has(net)){
   const n=project.nets.find(n=>n.name===net),value=net+(n?.range||''),primary=!named.has(net);
   named.add(net);
   const segmentsByLength=segments.slice().sort((a,b)=>Math.hypot(b[2]-b[0],b[3]-b[1])-Math.hypot(a[2]-a[0],a[3]-a[1]));
   const available=segmentsByLength.filter(v=>Math.hypot(v[2]-v[0],v[3]-v[1])>35);
   const horizontal=available.filter(v=>Math.abs(v[1]-v[3])<.1&&Math.abs(v[2]-v[0])>measure(value,'11px')*1.14+40);
   const spots=[...horizontal,...available].slice(0,36).flatMap(v=>{
    const middle={x:(v[0]+v[2])/2,y:(v[1]+v[3])/2};
    return [middle,{x:middle.x,y:middle.y-21},{x:middle.x,y:middle.y+21},{x:middle.x,y:middle.y-44},{x:middle.x,y:middle.y+44}];
   });
   let t=null;
   for(const pos of spots){const candidate=D.text(value,pos.x,pos.y,'middle',{size:11,color:cc,role:'net-label',net,groupObject:'net:'+net},measure);
    if(candidate.x<leftX+12||candidate.x+candidate.width>rightX-12||candidate.y<50||candidate.y+candidate.height>height-10)continue;
    if(obstacles.some(o=>overlaps(candidate,o,9))||labels.some(l=>overlaps(candidate,l,10)))continue;
    // The label may cover its own wire; it may never erase another net.
    const coversForeign=edges.some(edge=>edge.net!==net&&edge.points.some(([x1,y1,x2,y2])=>{
     const lx=candidate.x-6,rx=candidate.x+candidate.width+6,ty=candidate.y-6,by=candidate.y+candidate.height+6;
     if(Math.abs(x1-x2)<.1)return x1>=lx&&x1<=rx&&Math.max(y1,y2)>=ty&&Math.min(y1,y2)<=by;
     if(Math.abs(y1-y2)<.1)return y1>=ty&&y1<=by&&Math.max(x1,x2)>=lx&&Math.min(x1,x2)<=rx;
     return false;
    }));
    if(coversForeign)continue;
    t=candidate;break;
   }
   if(t){t.primary=primary;labels.push(t);}
   else labelOverflow.push({value,cc,net,primary,source,target,number:edges.length});
  }
 };
 const sourcesFor=(name,seen=new Set())=>{
  if(!identifier(name)||seen.has(name))return [];const visited=new Set(seen);visited.add(name);
  const direct=rows.filter(r=>r.port.direction==='output'&&r.expr===name).map(r=>r.key),external=project.nets.find(n=>n.name===name&&n.direction==='input');if(external)direct.push('top::'+external.id);
  for(const a of project.assigns||[])if(a.target===name&&identifier(a.expr))direct.push(...sourcesFor(a.expr,visited));
  const unique=[...new Set(direct)];
  if(unique.length>1){note(name,'同一訊號有多個可能來源，請先修正 driver','electrical');return [];}
  return unique;
 };
 const topContext=C.resolveParameters({parameters:C.projectView(project).parameters||[]},{}).context;
 for(const r of rows){
  if(r.port.direction!=='input'||!r.expr)continue;
  let ref,expanded;try{expanded=C.expandDefines(r.expr,project);ref=C.parseExpression(expanded);}catch{continue;}
  if(!['ref','select'].includes(ref.kind))continue;
  if(ref.kind==='select')try{C.expressionInfo(ref,C.projectView(project).nets,topContext);}catch{continue;}
  const selection=ref.kind==='select'?expanded.trim().slice(expanded.indexOf('[')).replace(/\s+/g,''):'';
  const sources=sourcesFor(ref.name);for(const source of sources)connect(source,r.key,ref.name,false,selection);
  if(!sources.length)note(r.instanceName+'.'+r.port.name,r.expr+'（未找到可直繪的驅動端）','unresolved');
  else if(selection){const at=notes.findIndex(n=>n.kind==='expression'&&n.label===r.instanceName+'.'+r.port.name);if(at>=0)notes.splice(at,1);}
 }
 for(const n of project.nets.filter(n=>n.direction==='output'))for(const source of sourcesFor(n.name))connect(source,'top::'+n.id,n.name);
 const inoutNames=new Set(rows.filter(r=>r.port.direction==='inout'&&identifier(r.expr)).map(r=>r.expr));
 for(const name of inoutNames){const pins=rows.filter(r=>r.port.direction==='inout'&&r.expr===name).map(r=>r.key),port=project.nets.find(n=>n.name===name&&n.direction==='inout');if(port)pins.unshift('top::'+port.id);for(let i=1;i<pins.length;i++)connect(pins[0],pins[i],name,true);}

 // Deterministic common-lead fanout for Top inputs feeding several instance
 // inputs. All branches share ONE entry and one vertical trunk outside the
 // leftmost Block; there are no parallel duplicate sources beside the pad.
 // Other nets retain their prior routes. This does not alter RTL bindings.
 const bySource=new Map();
 for(const e of edges){const key=e.net+'\u0000'+e.source;const a=bySource.get(key)||[];a.push(e);bySource.set(key,a);}
 const fanoutGroups=[...bySource.values()].filter(g=>g.length>1&&g[0].source.startsWith('top::')&&points.get(g[0].source)?.outerSide==='left').sort((a,b)=>a[0].net.localeCompare(b[0].net));
 const firstBlockX=Math.min(...placed.map(b=>b.x));
 const tapLabelGutter=Math.max(76,...edges.filter(e=>e.selection).map(e=>measure(e.selection,'11px')*1.14+88));
 for(let groupIndex=0;!frozen&&groupIndex<fanoutGroups.length;groupIndex++){
  const group=fanoutGroups[groupIndex],origin=points.get(group[0].source);
  const trunkX=Math.max(leftX+55,firstBlockX-tapLabelGutter-groupIndex*33);
  if(trunkX<=origin.x+24)continue;
  for(const edge of group){
   if(routedWaypoints[edge.routeKey])continue; // Respect manually edited paths.
   const sink=points.get(edge.target);if(!sink)continue;
   const lead=[origin,{x:trunkX,y:origin.y}],branch=[];
   if(sink.side==='left'&&sink.x<=firstBlockX+1){
    branch.push({x:trunkX,y:sink.y},sink);
   }else{
    const from={x:trunkX,y:origin.y,side:'right'};
    const path=route(from,sink,obstacles,0,edges.filter(e=>e!==edge&&e.net!==edge.net),edge.net,[],{minX:leftX+14,maxX:rightX-14});
    if(!path)continue;
    branch.push(...path.slice(1));
   }
   const pts=[];for(const pt of [...lead,...branch]){const n=pts.length;if(n&&pt.x===pts[n-1].x&&pt.y===pts[n-1].y)continue;
    if(n>1&&(pt.x===pts[n-1].x&&pt.x===pts[n-2].x||pt.y===pts[n-1].y&&pt.y===pts[n-2].y))pts.pop();pts.push(pt);}
   if(pts.length<2||pts.slice(1).some((pt,j)=>pt.x!==pts[j].x&&pt.y!==pts[j].y))continue;
   // Never replace the route with a path crossing any Block interior.
   if(pts.slice(1).some((pt,j)=>obstacles.some(o=>{const prev=pts[j];return pt.x===prev.x?pt.x>o.x+1&&pt.x<o.x+o.width-1&&Math.max(pt.y,prev.y)>o.y+1&&Math.min(pt.y,prev.y)<o.y+o.height-1:pt.y>o.y+1&&pt.y<o.y+o.height-1&&Math.max(pt.x,prev.x)>o.x+1&&Math.min(pt.x,prev.x)<o.x+o.width-1;})))continue;
   edge.points=pts.slice(1).map((pt,j)=>[pts[j].x,pts[j].y,pt.x,pt.y]);edge.sharedFanout=true;edge.sharedTrunkX=trunkX;edge.handle=pts[Math.floor(pts.length/2)];
   const visual=items.find(x=>x.role==='connection'&&x.routeKey===edge.routeKey);if(visual)visual.points=pts.map(pt=>[pt.x,pt.y]);
  }
 }
 for(const draw of paint)draw();
 // Resolve unsafe same-track occupancy BEFORE trying to position text.
 // Both scene and exporters subsequently use these identical routed points.
 if(!fast)root.WIURouteProgress?.({phase:'檢查與修復線距'});
 const routingScene={placed,points:Object.fromEntries(points),edges,items,topBoundary:{left:leftX,right:rightX,headerBottom},canvasBounds:{height},width,height};
 const spacing=root.WIURoutingSpacingR98||(typeof require==='function'?require('./routing-spacing-r98'):null);
 const bounded=!!root.WIUInteractiveRouting&&edges.length>120;
 const routingResult=!fast&&style.route==='orthogonal'?(automatic&&!denseRouting?RQ.improve(routingScene,{limit:bounded?48:Infinity}):{summary:{changed:0,parallelSpacing:spacing.scan(routingScene,{limit:500}),finalInvalid:0,unresolved:0,mode:pending?'deferred':'manual'}}):null;
 // Apply the established r96 net-separation scorer only to geometries that
 // satisfy the r97 pad / bend safety validator. Browser and native export
 // subsequently consume the SAME finalized routes.
 let trackMoves=routingResult?.summary.changed||0;
 if(routingResult&&automatic){
  const context=RQ.contextFor(routingScene);
  const separation={routes:[]}; // r98: r96 nudges don't enforce foreign-net 14px spacing
  for(const routed of separation.routes){
   const original=edges.find(e=>e.routeKey===routed.routeKey);
   if(!original||JSON.stringify(original.points)===JSON.stringify(routed.routePoints.slice(1).map((p,j)=>[routed.routePoints[j].x,routed.routePoints[j].y,p.x,p.y])))continue;
   original.points=routed.routePoints.slice(1).map((p,j)=>[routed.routePoints[j].x,routed.routePoints[j].y,p.x,p.y]);
   const visual=items.find(i=>i.role==='connection'&&i.routeKey===original.routeKey);
   if(visual)visual.points=routed.routePoints.map(p=>[p.x,p.y]);
   trackMoves++;
  }
  const repair=denseRouting?{moves:0}:RQ.repairSpacing(routingScene,{passes:bounded?1:6,maxRoutes:bounded?48:145});
  routingResult.summary.repairs=repair.moves;
  // r100: prioritize user-ready output: untangle corner-on-corner collisions
  // in the initial automatic solution, before labels, SVG and native Visio.
  const corner=denseRouting?{fixed:0}:Corner.repairs(routingScene,bounded?{maxFixes:8}:{});
  routingResult.summary.cornerRepairs=corner.fixed;
  trackMoves+=corner.fixed;
  // Strict final validation includes parallel spacing; conflicts are never counted as success.
  routingResult.summary.parallelSpacing= (root.WIURoutingSpacingR98||(typeof require==='function'?require('./routing-spacing-r98'):null)).scan(routingScene,{limit:500});
  routingResult.summary.finalBends=edges.reduce((n,e)=>n+RQ.countBends(RQ.ptsOf(e)),0);
  routingResult.summary.finalInvalid=edges.filter(e=>!RQ.valid(RQ.ptsOf(e),e,routingScene,context)).length;
  routingResult.summary.initialSearchFailures=routingResult.summary.unresolved;
  // Initial A* failures are NOT final violations if a later geometry-first
  // fallback and global spacing repair resolved every requirement.
  routingResult.summary.unresolved=routingResult.summary.finalInvalid+routingResult.summary.parallelSpacing.count;
  routingResult.summary.foreignOverlapsAfter=NR.overlapCount(edges.flatMap(e=>e.points.map(s=>({a:{x:s[0],y:s[1]},b:{x:s[2],y:s[3]},net:e.net}))));
 }
 // Frozen layout rendering must not start a solver. The load/repair action
 // runs prepare() explicitly and updates the shared snapshot before drawing.
 const autoLocalRepairs=0;
 if(routingResult&&!automatic){
   const context=RQ.contextFor(routingScene);
   routingResult.summary.finalInvalid=edges.filter(e=>!RQ.valid(RQ.ptsOf(e),e,routingScene,context)).length;
   routingResult.summary.unresolved=routingResult.summary.finalInvalid+routingResult.summary.parallelSpacing.count;
 }
 // A label's opaque backing must clear the final stroke, including every hump.
 if(!fast)root.WIURouteProgress?.({phase:'分析交叉與文字位置'});
 const geometry=fast?{renderPaths:edges.map(ptsOf),marks:[],summary:{overlaps:0,unresolved:0},issues:[]}:WG.analyze(edges,points,obstacles);
 // Place labels AFTER the final (possibly automatically spread) wire geometry.
 // Otherwise a label may stay in the old position after its route has moved.
 // One shared name per logical net; bit selections belong to their branch.
 if(!fast&&(style.showWireNames||edges.some(e=>e.selection))){
  labels.length=0;labelOverflow.length=0;
  const touchesStroke=WG.paintedStrokeIndex(geometry.renderPaths,edges);
  const labelFree=(candidate,own)=>{
   if(candidate.x<leftX+12||candidate.x+candidate.width>rightX-12||candidate.y<50||candidate.y+candidate.height>height-10)return false;
   if(obstacles.some(o=>overlaps(candidate,o,10))||labels.some(l=>overlaps(candidate,l,10)))return false;
   return !touchesStroke({l:candidate.x-5,r:candidate.x+candidate.width+5,t:candidate.y-5,b:candidate.y+candidate.height+5},own);
  };
  const requests=[],nets=[...new Set(edges.map(e=>e.net))];
  const shared=(s,t)=>{
   const h=Math.abs(s[1]-s[3])<.1,th=Math.abs(t[1]-t[3])<.1;
   if(h!==th||Math.abs((h?s[1]:s[0])-(h?t[1]:t[0]))>.1)return null;
   const lo=Math.max(Math.min(s[h?0:1],s[h?2:3]),Math.min(t[h?0:1],t[h?2:3])),hi=Math.min(Math.max(s[h?0:1],s[h?2:3]),Math.max(t[h?0:1],t[h?2:3]));
   return hi-lo>.1?(h?[lo,s[1],hi,s[1]]:[s[0],lo,s[0],hi]):null;
  };
  for(const net of nets){
   const same=edges.filter(e=>e.net===net),n=project.nets.find(n=>n.name===net);let range=n?.range||'';
   try{if(C.parseRange(C.expandDefines(range,project),topContext).width===1)range='';}catch{}
   if(style.showWireNames)requests.push({net,edges:same,value:net+range,primary:true,selection:''});
   for(const selection of new Set(same.map(e=>e.selection).filter(Boolean))){
    if(selection===range)continue;
    requests.push({net,edges:same.filter(e=>e.selection===selection),value:selection,primary:false,selection});
   }
  }
  for(const req of requests){
   const {net,value,primary,selection}=req,edge=req.edges[0],candidates=[];
   // Shared source lead comes first. A slice label must clear every differently
   // selected branch, so a label can never imply that the entire trunk is a slice.
   const different=edges.filter(e=>e.net===net&&e.selection!==selection);
   for(const e of req.edges)for(const sg of (selection?e.points.slice().reverse():e.points)){
    let pieces=[sg];
    if(selection)for(const other of different)for(const segment of other.points){
     pieces=pieces.flatMap(piece=>{const overlap=shared(piece,segment);if(!overlap)return [piece];const h=Math.abs(piece[1]-piece[3])<.1,lo=Math.min(piece[h?0:1],piece[h?2:3]),hi=Math.max(piece[h?0:1],piece[h?2:3]),a=overlap[h?0:1],b=overlap[h?2:3],out=[];
      if(a-lo>1)out.push(h?[lo,piece[1],a,piece[1]]:[piece[0],lo,piece[0],a]);
      if(hi-b>1)out.push(h?[b,piece[1],hi,piece[1]]:[piece[0],b,piece[0],hi]);return out;});
    }
    for(const piece of pieces){let common=[piece];for(const sibling of req.edges.filter(x=>x!==e))common=common.flatMap(c=>sibling.points.map(t=>shared(c,t)).filter(Boolean));
     for(const c of common)candidates.push({sg:c,shared:req.edges.length>1});candidates.push({sg:piece,shared:false});}
   }
   const unique=[...new Map(candidates.slice().sort((a,b)=>Number(a.shared)-Number(b.shared)).map(c=>[c.sg.join(','),c])).values()].filter(c=>Math.hypot(c.sg[2]-c.sg[0],c.sg[3]-c.sg[1])>20);
   // Separate taps need a range at each receiving branch. Deduplicate a slice
   // only when those receivers actually share an exclusive sliced segment.
   if(selection&&req.edges.length>1&&!unique.some(c=>c.shared)){for(const e of req.edges)requests.push({...req,edges:[e]});continue;}
   unique.sort((a,b)=>Number(b.shared)-Number(a.shared)||Number(Math.abs(b.sg[1]-b.sg[3])<.1)-Number(Math.abs(a.sg[1]-a.sg[3])<.1)||Math.hypot(b.sg[2]-b.sg[0],b.sg[3]-b.sg[1])-Math.hypot(a.sg[2]-a.sg[0],a.sg[3]-a.sg[1]));
   let selected=null;
   for(const {sg} of unique){if(selected)break;const horizontal=Math.abs(sg[1]-sg[3])<.1;
    for(const ratio of [.5,.3,.7]){if(selected)break;const x=sg[0]+(sg[2]-sg[0])*ratio,y=sg[1]+(sg[3]-sg[1])*ratio;
     for(const off of horizontal?[-12,-30,22,42]:[-18,18,-40,40]){const label=D.text(value,x,y+off,'middle',{size:11,color:edge.color||ink,role:'net-label',net,selection,primary,targets:req.edges.map(e=>e.target),groupObject:'net:'+net},measure);
      if(labelFree(label,net)){selected=label;break;}
     }
    }
   }
   if(selected)labels.push(selected);
   else labelOverflow.push({value:selection?net+selection:value,cc:edge.color||ink,net,primary,source:edge.source,target:req.edges.map(e=>e.target).join(', '),number:labels.length+labelOverflow.length+1});
  }
 }
 if(fast){
  const namedFast=new Set();
  for(const e of edges){if(!style.showWireNames&&!e.selection||namedFast.has(e.net))continue;namedFast.add(e.net);
   const v=e.points.slice().sort((a,b)=>Math.hypot(b[2]-b[0],b[3]-b[1])-Math.hypot(a[2]-a[0],a[3]-a[1]))[0];if(!v)continue;
   const n=project.nets.find(n=>n.name===e.net),t=D.text(e.net+(n?.range||''),(v[0]+v[2])/2,(v[1]+v[3])/2-12,'middle',{size:11,color:e.color,role:'net-label',net:e.net,groupObject:'net:'+e.net},measure);t.primary=true;labels.push(t);
  }
 }
 // Junctions and bridges share one topology-aware geometry pass; no masks.
 // The net is still represented by the same logical route. Only its drawn
 // continuous geometry gets the arc inserted, before either exporter sees it.
 for(let j=0;j<edges.length;j++){
  const route=items.find(i=>i.role==='connection'&&i.routeKey===edges[j].routeKey);
  if(route)route.points=geometry.renderPaths[j];
 }
 for(const m of geometry.marks){
  if(m.kind==='junction')items.push({type:'ellipse',x:m.x-3.8,y:m.y-3.8,width:7.6,height:7.6,color:m.color,fill:m.color,weight:0,role:'wire-junction',net:m.net,groupObject:'net:'+m.net});
 }
 for(const t of labels){rect(t.x-5,t.y-3,t.width+10,t.height+6,{fill:'#ffffff',color:'#ffffff',role:'net-label-background',net:t.net,groupObject:t.groupObject});items.push(t);}
 let appendixY=height+28;
 // Overflow legend is outside the electrical symbols. No name silently disappears.
 if(labelOverflow.length){text('接線名稱索引 · 擁擠線路移到此處，對應 source → target；放大圖面可核對',leftX,appendixY,'start',{size:13,bold:true,role:'wire-legend-title'});appendixY+=28;
   const colWidth=650,cols=Math.max(1,Math.floor((rightX-leftX)/colWidth)),rowHeight=22;
   labelOverflow.forEach((x,index)=>{const col=index%cols,row=Math.floor(index/cols),xpos=leftX+10+col*colWidth,ypos=appendixY+row*rowHeight;
    const label=D.text('#'+x.number+' '+x.value+' · '+x.source+' → '+x.target,xpos,ypos,'start',{size:11,color:x.cc,role:'net-label-legend',net:x.net,groupObject:'net:'+x.net},measure);label.primary=false;
    items.push(label);});
   appendixY+=Math.ceil(labelOverflow.length/cols)*rowHeight+12;
 }

 // Diagnostics belong in the editor, never inside the exported electrical drawing.
 for(const n of notes.filter(n=>!['routing','electrical'].includes(n.kind))){text(n.label+' = '+n.value,leftX,appendixY,'start',{size:11,role:'annotation'});appendixY+=20;}
 const bb=D.bounds(items),sceneWidth=Math.max(width,bb.x+bb.width+10),sceneHeight=Math.max(height,appendixY+20);
 const completed={previewOnly:fast,boundedRouting:bounded,autoSize:autoSize.expansion,routeQualityR98:routingResult,crossingSummary:{...geometry.summary,trackMoves},crossingIssues:geometry.issues,width:sceneWidth,height:sceneHeight,canvasBounds:{width:sceneWidth,height:sceneHeight},bounds:{x:0,y:0,width:sceneWidth,height:sceneHeight},items,edges,notes,bridgePlan:geometry.marks.filter(m=>m.kind==='bridge'),points:Object.fromEntries(points),groups,placed,labels,labelOverflow,topBoundary:{left:leftX,right:rightX,headerBottom},style,routingMode:pending?'deferred':frozen?'manual':'auto',pendingRouting:!!pending,autoLocalRepairs,routeSearchFallbacks:edges.filter(e=>!e.routed&&!e.manual).length};
 // Geometry quality closure: when an initial automatic solution is still
 // unsafe, expand the Top and retry ONCE. A failed retry remains a diagnostic,
 // never a falsely certified success. No retry on frozen/manual diagrams.
 const score=layoutScore;
 const pass=Number(project.workbook?.routingCorridorPass)||0;
 let selected=completed;
 if(!fast&&!bounded&&!frozen&&style.route==='orthogonal'&&score(completed)>0){
   const rebuilt=spreadAutomatic(project,completed);
   if(rebuilt){
     if(score(rebuilt)<score(selected))selected={...rebuilt,routingMode:'auto',autoSize:{...rebuilt.autoSize,manual:false,active:true}};
   }
 }
 if(!fast&&!bounded&&!frozen&&pass<1&&style.route==='orthogonal'&&score(selected)>0){
   const retry=JSON.parse(JSON.stringify(project));retry.workbook=retry.workbook||{};retry.workbook.routingCorridorPass=pass+1;retry.workbook.routingSpace=Auto.demand(completed);
   const expanded=create(retry);
   if(score(expanded)<score(selected))selected={...expanded,autoSize:{...expanded.autoSize,geometryRetry:pass+1}};
 }
 if(selected!==completed){
   sceneCache.set(cacheKey,selected);while(sceneCache.size>3)sceneCache.delete(sceneCache.keys().next().value);return selected;
 }
 sceneCache.set(cacheKey,completed);
 while(sceneCache.size>3)sceneCache.delete(sceneCache.keys().next().value);
 return completed;
}
function svg(project,{viewport=null}={}){const full=project?.items?project:create(project),scene=viewport?{...full,items:full.items.filter(x=>Viewport.visibleItem(x,viewport))}:full,b=viewport||scene.bounds;
 return D.svg(scene).replace('id="diagramSvg"','id="topSceneSvg"'+(viewport?' style="left:'+b.x+'px;top:'+b.y+'px;overflow:hidden"':''))
 .replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,'width="'+b.width+'" height="'+b.height+'" viewBox="'+[b.x,b.y,b.width,b.height].join(' ')+'"');}
function metadata(project,workspace){const env=W.envelope(project,workspace||{view:'assembly',tab:'graph'},'user'),json=JSON.stringify(env),encoded=typeof Buffer!=='undefined'?Buffer.from(json,'utf8').toString('base64'):btoa(unescape(encodeURIComponent(json))),chunks=encoded.match(/.{1,180}/g)||[];return ["' WRAPPINUP_STATE_BEGIN",...chunks.map(s=>"' WRAPPINUP_STATE_CHUNK:"+s),"' WRAPPINUP_STATE_END"].join('\r\n');}
function exportDiagnostics(project,mode='native-routed'){
 let scene,electricalIssues=[];const warnings=[],blockers=[];
 try{electricalIssues=C.validate(project).filter(i=>i.severity==='error');}catch(e){electricalIssues=[{code:'VALIDATION_UNAVAILABLE',message:String(e.message||e)}];}
 try{
  scene=create(project,{full:true});
  if(!scene.items?.length||![scene.width,scene.height].every(n=>Number.isFinite(n)&&n>0))throw Error('圖面沒有可繪製的有效範圍');
 }catch(e){blockers.push({code:'DRAWING_UNAVAILABLE',message:String(e.message||e)});}
 if(!scene)return {canExport:false,blockers,warnings,electricalIssues,routeMode:mode};
 if(scene.pendingRouting)warnings.push({code:'ROUTING_PENDING',count:1,message:'接線變更待整理；按整理或下載 Visio 時更新完整走線與檢查'});
 if(electricalIssues.length)warnings.push({code:'ELECTRICAL_REVIEW',count:electricalIssues.length,message:'電氣檢查仍有錯誤；只輸出目前圖面，不代表 RTL 或接線通過驗證',issues:electricalIssues});
 try{const map=E.audit(project,scene);if(map.length)warnings.push({code:'DRAWING_MAPPING',count:map.length,message:'部分接線與可見端點無法完整對應，請核對圖面與設計檢查',issues:map});}catch(e){warnings.push({code:'MAPPING_REVIEW',count:1,message:String(e.message||e)});}
 if(scene.routeSearchFallbacks)warnings.push({code:'ROUTE_FALLBACK',count:scene.routeSearchFallbacks,message:'部分路徑仍為備援折線'});
 if(scene.crossingSummary?.unresolved)warnings.push({code:'VISUAL_JUMP',count:scene.crossingSummary.unresolved,message:'部分交叉仍需局部排線修復'});
 if(scene.crossingSummary?.overlaps)warnings.push({code:'VISUAL_OVERLAP',count:scene.crossingSummary.overlaps,message:'不同訊號共線'});
 if(scene.routeQualityR98?.summary?.finalInvalid)warnings.push({code:'BLOCK_CLEARANCE',count:scene.routeQualityR98.summary.finalInvalid,message:'pad／Block 安全距離不足'});
 if(scene.routeQualityR98?.summary?.parallelSpacing?.count)warnings.push({code:'WIRE_SPACING',count:scene.routeQualityR98.summary.parallelSpacing.count,message:'平行線距不足'});
 return {canExport:!blockers.length,blockers,warnings,electricalIssues,routeMode:mode,routingMode:scene.routingMode};
}
function exportDrawing(project,options={}){
 let preparedSnapshot=null,settlementError=null;
 if(pendingFreeze(project)){
  try{
   preparedSnapshot=prepare(project,{force:true}).snapshot;
   project={...project,workbook:{...project.workbook,graphAutoR99:preparedSnapshot}};
  }catch(error){settlementError=String(error.message||error);}
 }
 const mode=options.mode||'fixed',check=exportDiagnostics(project,mode);
 if(!check.canExport){const e=Error(check.blockers.map(x=>x.message).join('; '));e.issues=check.blockers;throw e;}
 if(settlementError)check.warnings.push({code:'ROUTING_SETTLEMENT_FAILED',count:1,message:'接線整理未完成，保留目前圖面的固定圖形匯出。'+settlementError});
 const scene=create(project),meta=metadata(project,options.workspace),release=dep('WIURelease','release').label;
 const drawingName=(project.top||'top')+'-structure-'+release;let text,actualMode=mode,fallbackError=null;
 try{
  if(settlementError)throw Error(settlementError);
  if(mode==='native-routed'||mode==='native-routed-legacy'){
   if(scene.style.route!=='orthogonal')throw Error('曲線圖保留目前可見幾何，不轉成另一張直角圖');
   const native=mode==='native-routed'?dep('WIUNativeVisioPolylineR98','native-visio-polyline-r98'):dep('WIUNativeVisioR92','native-visio-r92');
   text=native.exportVbs(scene,{name:drawingName,metadata:meta,limit:options.limit??Infinity}).vbs;
  }else text=D.vbs(scene,{name:drawingName,metadata:meta,nativeConnectors:mode==='native'});
 }catch(error){
  // An editable connector planner failing does not mean the picture cannot
  // be drawn. Export the same visible geometry and disclose loss of GlueTo.
  fallbackError=String(error.message||error);actualMode='fixed-fallback';
  check.warnings.push({code:'FIXED_GEOMETRY_FALLBACK',count:1,message:'已改用固定圖形 VBS（保留圖面，但沒有動態 GlueTo）：'+fallbackError});
  text=D.vbs(scene,{name:drawingName+'-fixed',metadata:meta,nativeConnectors:false});
 }
 if(typeof text!=='string'||!text.length)throw Error('沒有產生可用的繪圖腳本');
 const report={release,requestedMode:mode,actualMode,warnings:check.warnings,electricalIssues:check.electricalIssues};
 text="' WIU_DRAWING_EXPORT: drawing only; warnings do not certify RTL.\r\n' WIU_EXPORT_REPORT "+JSON.stringify(report)+"\r\n"+text;
 return {vbs:text,actualMode,diagnostics:check,fallbackError,preparedSnapshot};
}
function vbs(project,options={}){return exportDrawing(project,options).vbs;}
const api={create,sceneKey,peek,prime,snapshotScene,withDrawingSnapshot,spreadAutomatic,svg,vbs,exportDrawing,prepare,wireMarks,capture,topologySignature,routeIdentity,layoutIdentity,deferConnections,validFreeze,frozenPath,exportDiagnostics};root.WIUTopScene=api;if(typeof module==='object')module.exports=api;
})(globalThis);
