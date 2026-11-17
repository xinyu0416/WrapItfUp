(function(root){'use strict';
function ports(project,module){
 const d=root.WIUWorkbook.makeDiagram(project,module.id),byId=new Map(module.ports.map(p=>[p.id,p])),byName=new Map(module.ports.map(p=>[p.name,p]));
 return Object.fromEntries(['left','right'].map(side=>[side,d.signals[side].map(s=>byId.get(s.id)||byName.get(s.name)||null)]));
}
function layout(project){
 const D=root.WIUDiagramStyle||(typeof require==='function'?require('./diagram-style'):null),measure=(s,size=12)=>Array.from(String(s)).reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.63)*size,0);
 const IL=root.WIUInstanceLayout||(typeof require==='function'?require('./instance-layout'):null);
 const groups=[];const preliminary=project.instances.flatMap((instance,index)=>{
  const module=project.modules.find(m=>m.name===instance.module);if(!module)return [];
  const C=root.WIUCore||(typeof require==='function'?require('./assembly-core'):null),parameterRows=C.instanceParameterRows(project,instance).map(r=>({...r,text:r.name+' = '+(r.error?'?':r.value)+' · '+r.sourceLabel})),parameterHeight=parameterRows.length?parameterRows.length*21+18:0;
  const diagram=root.WIUWorkbook.makeDiagram(project,module.id),sides=ports(project,module),columns={},gs=[];
  let half=Math.max(210,...parameterRows.map(r=>(measure(r.text,11)+44)/2));
  for(const side of ['left','right']){let y=78+parameterHeight,last='';columns[side]=[];
   sides[side].forEach((port,index)=>{if(!port){y+=24;columns[side].push(null);return;}
    const signal=diagram.signals[side].find(s=>s.id===port.id),g=diagram.groups[side].find(g=>g.id===signal?.groupId),gid=g?.id||'';
    if(gid!==last){if(gs.length&&gs.at(-1).side===side)gs.at(-1).bottom=y-8;if(g){y+=44;const key=D.groupKey(instance.id,side,g.id),name=root.WIUWorkbook.groupLabel(diagram,side,g.id);gs.push({key,id:g.id,name,side,y:y-40,bottom:y,color:D.color(project,key,diagram.groups[side].indexOf(g),g.name,g.color),moduleId:module.id,instanceName:instance.name,members:[]});half=Math.max(half,measure(name,12)+40);}last=gid;}
    const comment=String(signal?.comment||port.comment||''),lines=comment?comment.split(/\r?\n/):[];
    half=Math.max(half,measure(port.name+(port.range||''),12)+48,...lines.map(s=>measure(s,10)+40));
    columns[side].push({port,y,index,comment:lines,group:gid});if(gid){const gg=gs.findLast(g=>g.side===side&&g.id===gid);gg.members.push(port.name);}
    y+=32+lines.length*15;if(gid)gs.findLast(g=>g.side===side&&g.id===gid).bottom=y-8;
   });columns[side].height=y+16;
  }
  return [IL.bar(project,{instance,module,sides,columns,parameterRows,parameterHeight,groups:gs,width:Math.ceil(half)*2+28,height:Math.max(columns.left.height,columns.right.height,140)},measure)];
 });
 const families=[...new Set(preliminary.map(b=>b.module.id))],columnWidth=Math.max(480,...preliminary.filter(b=>b.shape!=='bar').map(b=>b.width)),ys=families.map(()=>130),outer=Math.max(290,...project.nets.filter(n=>n.direction!=='wire').map(n=>measure(n.name+(n.range||''))+42));
 const result=preliminary.map((b,index)=>{const col=families.indexOf(b.module.id),saved=project.workbook?.graphPositions?.[b.instance.id],x=Number.isFinite(saved?.x)?Math.max(350,saved.x):outer+520+col*(columnWidth+900),y=Number.isFinite(saved?.y)?Math.max(80,saved.y):ys[col];ys[col]=Math.max(ys[col],y+b.height+80);return {...b,x,y};});
 let bottom=Math.max(130,...result.filter(b=>b.shape!=='bar').map(b=>b.y+b.height))+180;for(const b of result.filter(b=>b.shape==='bar'))if(!project.workbook?.graphPositions?.[b.instance.id]){b.x=Math.min(800,...result.filter(x=>x.shape!=='bar').map(x=>x.x));b.y=bottom;bottom+=b.height+180;}return result;
}
function move(project,id,x,y){if(!project.instances.some(i=>i.id===id))throw Error('找不到 instance');if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('無效位置');project.workbook.graphPositions||={};project.workbook.graphPositions[id]={x:Math.max(350,Math.round(x)),y:Math.max(80,Math.round(y))};}
function topPorts(project){return ports(project,root.WIUWorkbook.moduleOf(project,'top'));}
function moveTop(project,id,side,index){
 if(!['left','right'].includes(side))throw Error('無效側邊');
 const W=root.WIUWorkbook,d=W.makeDiagram(project,'top'),from=['left','right'].find(k=>d.signals[k].some(s=>s.id===id));if(!from)throw Error('找不到 Top port');
 const signal=d.signals[from].find(s=>s.id===id);
 if(from!==side){
  const usedIds=new Set(['left','right'].flatMap(s=>[...d.signals[s],...d.groups[s],...d.conditions[s]].map(row=>row.id)));
  // Both editors share group origin identity while every row ID stays unique.
  // Conditions retain their existing side-pair identity in workbook metadata.
  const copies=(project.workbook.topPortSideCopies||[]).filter(link=>
   link.kind==='conditions'&&['left','right'].every(s=>d.conditions[s].some(row=>row.id===link[s])));
  const copyAcross=(kind,source,parentId)=>{
   const copy=JSON.parse(JSON.stringify(source));
   if(kind==='groups'){copy.parentId=parentId;copy.originId=source.originId||source.id;}
   const descriptor=row=>W.stable(kind==='groups'
    ?{name:row.name,color:row.color,parentId:row.parentId||null,formatRuns:row.formatRuns||[]}
    :{kind:row.kind,macro:row.macro,path:row.path||null});
   const signature=descriptor(copy);
   if(kind==='groups'){
    const existing=d.groups[side].find(row=>(row.originId||row.id)===copy.originId&&descriptor(row)===signature);
    if(existing)return existing.id;
   }else{
    const linked=copies.find(link=>link.kind===kind&&link[from]===source.id&&
     d[kind][side].some(row=>row.id===link[side]&&descriptor(row)===signature));
    if(linked)return linked[side];
   }
   const base=source.id+'_'+side;let next=base,suffix=2;
   while(usedIds.has(next))next=base+'_'+suffix++;
   copy.id=next;usedIds.add(next);d[kind][side].push(copy);
   if(kind==='conditions')copies.push({kind,[from]:source.id,[side]:next});return next;
  };
  const ancestors=[],seen=new Set();let group=d.groups[from].find(g=>g.id===signal.groupId);
  while(group){
   if(seen.has(group.id))throw Error('群組階層有循環，請先修正 Top block。');
   seen.add(group.id);ancestors.push(group);group=d.groups[from].find(g=>g.id===group.parentId);
  }
  let parentId=null;
  for(const group of ancestors.reverse())parentId=copyAcross('groups',group,parentId);
  signal.groupId=parentId;
  const condition=d.conditions[from].find(c=>c.id===signal.conditionId);
  if(condition)signal.conditionId=copyAcross('conditions',condition);
  if(copies.length)project.workbook.topPortSideCopies=copies;
  else delete project.workbook.topPortSideCopies;
 }
 d.signals[from]=d.signals[from].filter(s=>s.id!==id);
 const at=Math.max(0,Math.min(d.signals[side].length,Number.isFinite(index)?index:d.signals[side].length));d.signals[side].splice(at,0,signal);project.workbook.topPortY={};project.workbook.diagrams.top=d;
}
// A blank interface row is a visual spacer, not a Top port. It has no net
// route/Y coordinate, so sorting it with ports moves it to the top. Attach each
// contiguous spacer run to the stable ID of the NEXT real port; a trailing run
// follows the PREVIOUS real port. Re-derive anchors from the current row order
// every time so manual drag/reorder becomes authoritative (no stale metadata).
function arrangeTopSignals(rows,netY,groups=[]){
 const ports=[],before=new Map(),after=new Map(),pending=[];
 for(const sig of rows){
  if(!String(sig.name||'').trim()){pending.push(sig);continue;}
  if(pending.length)before.set(sig.id,pending.splice(0));
  ports.push({sig,index:ports.length});
 }
 if(!ports.length)return rows.slice();
 if(pending.length)after.set(ports.at(-1).sig.id,pending.splice(0));
 // A Top block group is an explicit interface boundary. Move its complete
 // family together, using its earliest connected height, and retain member order.
 const byId=new Map(groups.map(g=>[g.id,g])),grouped=new Map(),units=[];
 for(const port of ports){
  let groupId=port.sig.groupId;const seen=new Set();
  while(groupId&&!seen.has(groupId)){
   seen.add(groupId);const parentId=byId.get(groupId)?.parentId;
   if(!parentId||!byId.has(parentId))break;groupId=parentId;
  }
  let unit=groupId&&grouped.get(groupId);
  if(!unit){unit={ports:[],index:port.index,y:Infinity};units.push(unit);if(groupId)grouped.set(groupId,unit);}
  unit.ports.push(port);unit.y=Math.min(unit.y,netY.get(port.sig.name)??Infinity);
 }
 const height=unit=>Number.isFinite(unit.y)?unit.y:110;
 units.sort((a,b)=>height(a)-height(b)||a.index-b.index);
 return units.flatMap(unit=>unit.ports.flatMap(({sig})=>[...(before.get(sig.id)||[]),sig,...(after.get(sig.id)||[])]));
}
function arrange(project){
 project.workbook.graphPositions={};const boxes=layout(project),ys=new Map();for(const b of boxes)for(const side of ['left','right'])for(const r of b.columns[side])if(r){const c=project.connections.find(c=>c.instance===b.instance.id&&c.port===r.port.name);if(c?.expr&&!ys.has(c.expr))ys.set(c.expr,b.y+r.y);}
 const d=root.WIUWorkbook.makeDiagram(project,'top');project.workbook.topPortY={};
 for(const side of ['left','right']){d.signals[side]=arrangeTopSignals(d.signals[side],ys,d.groups[side]);let y=100;for(const sig of d.signals[side]){if(!String(sig.name||'').trim())continue;y=Math.max(y+42,ys.get(sig.name)??110);project.workbook.topPortY[sig.id]=y;}}project.workbook.diagrams.top=d;
}
const api={ports,layout,move,topPorts,moveTop,arrange,arrangeTopSignals};root.WIUGraphLayout=api;if(typeof module==='object')module.exports=api;
})(globalThis);
