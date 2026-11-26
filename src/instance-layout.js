/* Per-instance presentation. This module never edits ports, nets or bindings. */
(function(root){'use strict';
const settings=(p,id)=>p.workbook?.instanceLayouts?.[id]||{};
const vector=side=>({left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]})[side]||[0,0];
function escape(p,d){const [x,y]=vector(p.side);return {x:p.x+x*d,y:p.y+y*d};}
function bar(p,b,measure){
 const cfg=settings(p,b.instance.id);if(cfg.shape!=='bar')return b;
 const buckets=new Map(),connections=p.connections.filter(c=>c.instance===b.instance.id);
 for(const port of b.module.ports){
  const expr=connections.find(c=>c.port===port.name)?.expr;
  const peers=expr&&p.connections.filter(c=>c.instance!==b.instance.id&&c.expr===expr).map(c=>c.instance)||[];
  const ids=[...new Set(peers)],peer=ids.length===1?p.instances.find(i=>i.id===ids[0]):null;
  const group=port.group||port.groupName||'',name=peer?.name||(ids.length>1?'共用訊號':group||'其他／未接線');
  const side=cfg.pinSides?.[port.id]==='bottom'?'bottom':'top',key=side+'::'+(peer?.id||name);
  if(!buckets.has(key))buckets.set(key,{key,name,side,peer:peer?.id,members:[]});buckets.get(key).members.push(port);
 }
 const groups=[...buckets.values()].sort((a,c)=>(a.side===c.side?0:a.side==='top'?-1:1)||(p.workbook.graphPositions?.[a.peer]?.x??0)-(p.workbook.graphPositions?.[c.peer]?.x??0));
 const columns={top:[],bottom:[]},gs=[];let width=0,maxRows=1;
 for(const side of ['top','bottom']){let x=18;
  for(const g of groups.filter(g=>g.side===side)){
   const compact=cfg.compact&&!cfg.expanded?.includes(g.key),labelWidth=Math.max(126,...g.members.map(port=>measure(port.name,12)+50));
   const gw=Math.max(measure(g.name,12)+32,labelWidth+36*g.members.length+26);
   const rows=compact?0:g.members.length;maxRows=Math.max(maxRows,rows);
   gs.push({...g,x,width:gw,compact,labelWidth});
   g.members.forEach((port,i)=>columns[side].push({port,x:x+labelWidth+18+i*36,index:i,group:g.key,compact}));
   x+=gw+18;
  }width=Math.max(width,x);
 }
 const detailHeight=maxRows*27+40,headerHeight=58+b.parameterHeight,height=headerHeight+detailHeight*(columns.bottom.length?2:1)+22;
 width=Math.max(width,580,Number(cfg.width)||0,measure(b.module.name,17)+40,...b.parameterRows.map(r=>measure(r.text,11)+36));
 for(const side of ['top','bottom']){const row=gs.filter(g=>g.side===side),natural=row.reduce((n,g)=>n+g.width+18,18),extra=Math.max(0,width-natural);row.forEach((g,i)=>{const shift=extra*(i+.5)/row.length;g.x+=shift;for(const r of columns[side].filter(r=>r.group===g.key))r.x+=shift;});}
 for(const side of ['top','bottom'])for(const r of columns[side]){r.y=side==='top'?0:height;r.labelY=side==='top'?headerHeight+32+r.index*27:height-34-r.index*27;}
 return {...b,shape:'bar',barGroups:gs,barColumns:columns,groups:[],width,height,headerHeight,detailHeight};
}
function set(p,id,patch,placed){
 if(!p.instances.some(i=>i.id===id))throw Error('找不到 instance');
 p.workbook.instanceLayouts||={};const before=settings(p,id);p.workbook.instanceLayouts[id]={...before,...patch};
 if(patch.shape==='bar'&&before.shape!=='bar'){
  p.workbook.graphPositions||={};for(const b of placed)p.workbook.graphPositions[b.instance.id]={x:b.x,y:b.y};
  const others=placed.filter(b=>b.instance.id!==id),x=Math.min(...others.map(b=>b.x),800);p.workbook.graphPositions[id]={x,y:Math.max(130,...others.map(b=>b.y+b.height))+180};
  if(!before.width&&!patch.width)p.workbook.instanceLayouts[id].width=Math.max(580,...others.map(b=>b.x+b.width-x));
 }
 delete p.workbook.graphAutoR99;
 for(const key of Object.keys(p.workbook.wireRoutes||{}))if(key.includes(id+'::'))delete p.workbook.wireRoutes[key];
}
const api={settings,vector,escape,bar,set};root.WIUInstanceLayout=api;if(typeof module==='object')module.exports=api;
})(globalThis);
