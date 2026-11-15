/* Routing invariant for other electrical signals: measure the nearest painted contours of parallel tracks, including their end caps.
 * Horizontal tracks require 2 pad widths of clear space; vertical tracks require 1.
 * Same-net fanout can share a trunk. Two signal names referencing exactly one
 * physical source pad may only share the first 28 units of the pad escape.
 */
(function(root){'use strict';
const EPS=.001,PAD=14,SHARED_LEAD=28;
const eq=(a,b)=>Math.abs(a-b)<EPS;
const requiredGap=horizontal=>horizontal?2*PAD:PAD;
const halfStroke=e=>Number.isFinite(e?.weight)&&e.weight>0?e.weight/2:.65;
function overlapInterval(s,t){
 const h=eq(s.a.y,s.b.y),th=eq(t.a.y,t.b.y);if(h!==th||(!h&&(!eq(s.a.x,s.b.x)||!eq(t.a.x,t.b.x))))return null;
 const x=h?'x':'y',y=h?'y':'x';
 const start=Math.max(Math.min(s.a[x],s.b[x]),Math.min(t.a[x],t.b[x])),end=Math.min(Math.max(s.a[x],s.b[x]),Math.max(t.a[x],t.b[x]));
 const normal=Math.abs(s.a[y]-t.a[y]),axial=Math.max(0,start-end);
 return {horizontal:h,start,end,axial,normal,gap:axial?Math.hypot(axial,normal):normal};
}
function sharedLeadExempt(s,t,edge,other,interval,scene){
 if(!scene||!edge?.source||edge.source!==other.source||interval.gap>EPS)return false;
 const p=scene.points[edge.source];if(!p)return false;
 const dir=p.side==='left'?-1:p.side==='right'?1:0;
 if(!dir||!interval.horizontal||!eq(s.a.y,p.y)||!eq(t.a.y,p.y))return false;
 const a=p.x,b=p.x+dir*SHARED_LEAD;
 return interval.start>=Math.min(a,b)-EPS&&interval.end<=Math.max(a,b)+EPS;
}
function violation(s,t,edge,other,scene){
 if(edge.net===other.net)return null;
 const o=overlapInterval(s,t);if(!o)return null;
 const required=requiredGap(o.horizontal),gap=o.gap-halfStroke(edge)-halfStroke(other);
 if(gap>=required-EPS)return null;
 // Mandatory common first lead is the same physical wire, not two side by side.
 if(sharedLeadExempt(s,t,edge,other,o,scene))return null;
 const along=(o.start+o.end)/2,across=o.horizontal?(s.a.y+t.a.y)/2:(s.a.x+t.a.x)/2;
 return {...o,x:o.horizontal?along:across,y:o.horizontal?across:along,centerGap:o.gap,gap,required,length:Math.max(0,o.end-o.start),netA:edge.net,netB:other.net,sourceA:edge.source,sourceB:other.source};
}
// Search a sorted spatial strip, not every routed segment for every A* step.
// The same exact violation() predicate is still authoritative.
function index(tracks){
 const h=[],v=[];
 for(const t of tracks){
  if(eq(t.a.y,t.b.y))h.push({at:t.a.y,t});
  else if(eq(t.a.x,t.b.x))v.push({at:t.a.x,t});
 }
 h.sort((a,b)=>a.at-b.at);v.sort((a,b)=>a.at-b.at);
 return {__wiuSpatial:true,h,v,maxHalfStroke:tracks.reduce((n,t)=>Math.max(n,halfStroke(t)),.65)};
}
function near(tracks,s,radius){
 if(!tracks?.__wiuSpatial)return tracks;
 const horizontal=eq(s.a.y,s.b.y),arr=horizontal?tracks.h:tracks.v;
 const center=horizontal?s.a.y:s.a.x,lo=center-radius,hi=center+radius;
 let a=0,b=arr.length;
 while(a<b){const m=(a+b)>>1;if(arr[m].at<lo)a=m+1;else b=m;}
 const out=[];
 for(;a<arr.length&&arr[a].at<=hi;a++)out.push(arr[a].t);
 return out;
}
function collides(s,edge,tracks,scene){for(const t of near(tracks,s,requiredGap(eq(s.a.y,s.b.y))+halfStroke(edge)+(tracks.maxHalfStroke||.65)))if(violation(s,t,edge,t,scene))return true;return false;}
function scan(scene,{limit=200}={}){
 const issues=[],edges=scene.edges;
 const shapes=edges.map(edge=>edge.points.filter(p=>Math.abs(p[0]-p[2])+Math.abs(p[1]-p[3])>EPS).map(p=>({a:{x:p[0],y:p[1]},b:{x:p[2],y:p[3]}})));
 let count=0,shortest=Infinity;const gaps={};
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)if(edges[i].net!==edges[j].net)
  for(const a of shapes[i])for(const b of shapes[j]){const v=violation(a,b,edges[i],edges[j],scene);if(!v)continue;
   count++;shortest=Math.min(shortest,v.gap);gaps[Math.round(v.gap)]=(gaps[Math.round(v.gap)]||0)+1;
   if(issues.length<limit)issues.push({edgeA:i,edgeB:j,...v});
  }
 return {count,minGap:Number.isFinite(shortest)?shortest:null,gaps,issues};
}
const api={PAD,SHARED_LEAD,requiredGap,halfStroke,overlapInterval,sharedLeadExempt,violation,index,near,collides,scan};
root.WIURoutingSpacingR98=api;if(typeof module==='object')module.exports=api;
})(globalThis);
