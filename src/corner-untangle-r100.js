/* WrapItfUp r100 — corner-to-corner collision repair, before rendering SVG/VBS.
 * Layout-only; never changes electrical nets, Block positions, or manual routes.
 * All candidate routes must obey r98 14px parallel separation and 28px moats.
 */
(function(root){'use strict';
const W=root.WIUWireGeometry||(typeof require==='function'?require('./wire-geometry'):null);
const Q=root.WIURoutingQualityR98||(typeof require==='function'?require('./routing-quality-r98'):null);
const S=root.WIURoutingSpacingR98||(typeof require==='function'?require('./routing-spacing-r98'):null);
const EPS=.001;
function pts(e){return Q.ptsOf(e);}
function same(a,b){return Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;}
function straight(a,b){return Math.abs(a.x-b.x)<EPS||Math.abs(a.y-b.y)<EPS;}
function setPath(e,path){e.points=path.slice(1).map((p,j)=>[path[j].x,path[j].y,p.x,p.y]);}
function repairs(scene, {maxFixes=16}={}){
 const pins=new Map(Object.entries(scene.points)),blocks=scene.placed.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height})),ctx=Q.contextFor(scene);
 const diag=()=>W.analyze(scene.edges,pins,blocks);
 let before=diag(),fixed=0,tries=0;const skipped=new Set(),deferred=[];
 const initial=before.summary.unresolved;
 const issueKey=i=>(i.nets||[]).slice().sort().join("|")+"@"+i.x+","+i.y;
 const tracks=e=>{const path=Q.ptsOf(e);return path.slice(1).map((b,j)=>({a:path[j],b,net:e.net,source:e.source,target:e.target,weight:e.weight}));};
 const edgeTracks=scene.edges.map(tracks);
 const dist=(p,a,b)=>Math.hypot(Math.max(Math.min(a.x,b.x)-p.x,p.x-Math.max(a.x,b.x),0),Math.max(Math.min(a.y,b.y)-p.y,p.y-Math.max(a.y,b.y),0));
 const clearanceCost=(path,edge,index)=>{
  let cost=0;
  for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j],s={a,b},horizontal=Math.abs(a.y-b.y)<EPS;
   const limit=S.requiredGap(horizontal)+2*S.halfStroke(edge)+9;
   for(const t of S.near(index,s,limit)){if(t.net===edge.net)continue;const o=S.overlapInterval(s,t);if(!o||o.gap>=limit||S.sharedLeadExempt(s,t,edge,t,o,scene))continue;
    cost+=(limit-o.gap)*Math.min(160,2+Math.max(0,o.end-o.start));
   }
  }return cost;
 };
 const budget=Math.max(60,2*maxFixes);
 let checked=new Set();
 while((!Number.isFinite(root.WIURoutingDeadline)||Date.now()<root.WIURoutingDeadline)&&fixed<maxFixes&&tries<budget&&before.summary.unresolved){
  const issues=before.issues.filter(i=>i.kind==='unresolved'&&i.edgeIndices?.length);
  const frequency=new Map();for(const issue of issues)for(const e of issue.edgeIndices)frequency.set(e,(frequency.get(e)||0)+1);
  const nextIssues=issues.filter(i=>!skipped.has(issueKey(i))).sort((a,b)=>Math.max(...b.edgeIndices.map(e=>frequency.get(e)))-Math.max(...a.edgeIndices.map(e=>frequency.get(e))));
  if(!nextIssues.length)break;
  const target=nextIssues[0],priority=target.edgeIndices,alternatives=[];
  for(const ei of priority){const edge=scene.edges[ei];if(!edge||edge.manual)continue;
   const p=pts(edge),foreign=edgeTracks.flatMap((t,j)=>ei===j?[]:t),index=S.index(foreign);
   const base=Q.routeContact(p,edge,index,scene).count,oldCost=clearanceCost(p,edge,index);
   const relevant=[target,...(target.clearances||[])];
   for(let j=1;j<p.length-2;j++){const a=p[j],b=p[j+1],horizontal=Math.abs(a.y-b.y)<EPS;
    if(!relevant.some(t=>dist(t,a,b)<(horizontal?42:28)))continue;
    for(const shift of [6,-6,12,-12,20,-20,34,-34,42,-42,56,-56,70,-70,98,-98,140,-140]){
     const q=p.map(u=>({x:u.x,y:u.y})),axis=horizontal?'y':'x';q[j][axis]+=shift;q[j+1][axis]+=shift;
     const path=Q.clean(q),key=ei+'|'+JSON.stringify(path);
     if(checked.has(key)||!Q.valid(path,edge,scene,ctx))continue;
     const contact=Q.routeContact(path,edge,index,scene).count;if(contact>base)continue;
     const rank=(contact-base)*100000+clearanceCost(path,edge,index)-oldCost+Math.abs(shift)*.02;
     alternatives.push({ei,edge,old:edge.points,path,shift,rank,key});
    }
   }
  }
  alternatives.sort((a,b)=>a.rank-b.rank||Math.abs(a.shift)-Math.abs(b.shift));
  let winner=null;
  for(const alt of alternatives.slice(0,5)){
   if(tries>=budget)break;checked.add(alt.key);tries++;setPath(alt.edge,alt.path);const next=diag();alt.edge.points=alt.old;
   if(next.summary.unresolved<before.summary.unresolved&&next.summary.overlaps<=before.summary.overlaps){winner={...alt,next};break;}
  }
  if(!winner){skipped.add(issueKey(target));deferred.push({x:target.x,y:target.y,nets:target.nets,reason:priority.every(i=>scene.edges[i]?.manual)?'MANUAL_ROUTE_PROTECTED':'NO_LEGAL_LOCAL_CANDIDATE'});continue;}
  setPath(winner.edge,winner.path);edgeTracks[winner.ei]=tracks(winner.edge);
  before=winner.next;fixed++;skipped.clear();
 }
 // Keep each SVG route item in sync with the final routed edges. This is the
 // exact same underlying scene passed to the 1D native Visio writer.
 const visuals=new Map(scene.items.filter(x=>x.role==='connection').map(x=>[x.routeKey,x]));
 for(const edge of scene.edges){const item=visuals.get(edge.routeKey);if(item)item.points=pts(edge).map(p=>[p.x,p.y]);}
 return {fixed:Math.max(0,initial-before.summary.unresolved),moves:fixed,tried:tries,remaining:before.summary.unresolved,overlaps:before.summary.overlaps,deferred};
}
const api={repairs};root.WIUCornerUntangleR100=api;if(typeof module==='object')module.exports=api;
})(globalThis);
