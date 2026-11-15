/* One jump plan for browser and native Visio. Never paint white masks or
 * introduce one Visio shape per bend. Embed sampled arcs in the same 1D shape.
 * Fail the native representation if it cannot carry the full plan; the caller
 * can still export the complete fixed-geometry picture, with an explicit note.
 */
(function(root){'use strict';
const EPS=.002;
const pointKey=(n,x,y)=>n+'@'+Math.round(x*1000)+','+Math.round(y*1000);
function project(scene,chains,{partial=false}={}){
 const W=root.WIUWireGeometry||(typeof require==='function'?require('./wire-geometry'):null);
 if(!W)throw Error('Shared jump geometry module not loaded');
 const planned=scene.bridgePlan||W.analyze(scene.edges,new Map(Object.entries(scene.points)),scene.placed).marks.filter(m=>m.kind==='bridge');
 const unique=new Map();for(const m of planned){const k=pointKey(m.net,m.x,m.y);if(!unique.has(k))unique.set(k,m);}
 const paths=W.routes(chains.map(c=>({net:c.net,points:c.points.slice(1).map((p,i)=>[c.points[i].x,c.points[i].y,p.x,p.y])})));
 const buckets=paths.map(()=>[]),mapped=[],unplaced=[];
 for(const [key,m] of unique){
  let found=null;
  for(let i=0;i<paths.length&&!found;i++){
   const r=paths[i];if(r.edge.net!==m.net)continue;
   for(const seg of r.segments){
    const t=((m.x-seg.p.x)*seg.d.x+(m.y-seg.p.y)*seg.d.y)/(seg.len*seg.len);
    const x=seg.p.x+seg.d.x*t,y=seg.p.y+seg.d.y*t;
    if(Math.hypot(x-m.x,y-m.y)>EPS||t<0||t>1)continue;
    if(Math.min(t,1-t)*seg.len+EPS<m.radius)continue;
    // The bridge normal must stay perpendicular to the same underlying track.
    if(Math.abs(seg.d.x*m.normal.x+seg.d.y*m.normal.y)>EPS)continue;
    found={i,at:seg.offset+seg.len*t};break;
   }
  }
  if(!found){unplaced.push({key,net:m.net,x:m.x,y:m.y});continue;}
  const {i,at}=found;
  buckets[i].push({start:at-m.radius,end:at+m.radius,normal:m.normal,radius:m.radius});
  mapped.push({key,chainIndex:i,position:at,x:m.x,y:m.y,normal:m.normal,radius:m.radius});
 }
 if(unplaced.length&&!partial)throw Error('SHARED_JUMP_PLAN: '+unplaced.length+' 個網站跳線無法放入原生連接器；使用完整固定圖面備用');
 const rendered=paths.map((r,i)=>W.renderBridges(r,buckets[i].sort((a,b)=>a.start-b.start)));
 return {rendered,mapped,unplaced,planned:unique.size};
}
const api={project};root.WIUSharedJumpPlanR104=api;if(typeof module==='object')module.exports=api;
})(globalThis);
