/* On the first automatic drawing, spread conflicting tracks without changing
 * their order or adding bends. Extra paper is inserted only between coordinates
 * involved in a clearance constraint. Pad symbols, text and stroke widths keep
 * their physical sizes. The stored cuts also reconstruct the exact pad rows. */
(function(root){'use strict';
const EPS=.001,PAD=14;
function mapped(cuts,value){
 let low=0,high=cuts.length;
 while(low<high){const mid=(low+high)>>1;if(cuts[mid][0]<=value)low=mid+1;else high=mid;}
 return value+(low?cuts[low-1][1]:0);
}
function axisCuts(constraints,protectedRanges){
 if(!constraints.length)return [];
 const coords=Array.from(new Set(constraints.flatMap(c=>[c[0],c[1]]))).sort((a,b)=>a-b);
 const bins=[],index=new Map();
 for(const v of coords){
  const prev=bins.at(-1);
  const locked=prev&&(v-prev.last<EPS||protectedRanges.some(([lo,hi])=>lo<=(prev.last+v)/2&&hi>=(prev.last+v)/2&&lo<=prev.last+EPS&&hi>=v-EPS));
  if(locked)prev.last=v;else bins.push({first:v,last:v,incoming:[]});
  index.set(v,bins.length-1);
 }
 for(const [a,b,gap] of constraints){
  const i=index.get(a),j=index.get(b);
  if(i!==j)bins[j].incoming.push([i,gap-(b-a)]);
 }
 const cuts=[];
 for(let j=0;j<bins.length;j++){
  const p=bins[j],last=j?bins[j-1].extra:0;
  p.extra=last;
  for(const [i,d] of p.incoming)p.extra=Math.max(p.extra,bins[i].extra+d);
  p.extra=Math.ceil(p.extra-EPS);
  if(j&&p.extra>last){
   let cut=(bins[j-1].last+p.first)/2;
   for(const [lo,hi] of protectedRanges)if(cut>=lo&&cut<=hi)cut=lo>bins[j-1].last?(lo+bins[j-1].last)/2:(hi+p.first)/2;
   cuts.push([cut,p.extra]);
  }
 }
 return cuts;
}
function make(scene,pinned={}){
 const constraints={x:[],y:[]},runs=[];
 const add=(axis,a,b,gap)=>{const lo=Math.min(a,b),hi=Math.max(a,b);if(hi-lo>EPS&&hi-lo<gap)constraints[axis].push([lo,hi,gap]);};
 for(const e of scene.edges)for(const [x,y,u,v] of e.points){
  const h=Math.abs(y-v)<EPS;if(!h&&Math.abs(x-u)>EPS)return null;
  const from=h?x:y,to=h?u:v;
  if(Math.abs(to-from)>EPS)runs.push({h,k:h?y:x,lo:Math.min(from,to),hi:Math.max(from,to),net:e.net,w:e.weight||1.3});
 }
 for(let i=0;i<runs.length;i++)for(let j=0;j<i;j++){
  const a=runs[i],b=runs[j];if(a.net===b.net)continue;
  if(a.h===b.h){
   const normal=Math.abs(a.k-b.k),start=Math.max(a.lo,b.lo),end=Math.min(a.hi,b.hi);
   // Allow two opposing 4.5-unit bridges, plus both half-strokes.
   const pitch=(a.h?2:1)*PAD+(a.w+b.w)/2+10;
   if(normal>=pitch||start-end>=pitch)continue;
   if(start<=end||normal>=start-end)add(a.h?'y':'x',a.k,b.k,pitch);
   else add(a.h?'x':'y',end,start,pitch);
  }else{
   const h=a.h?a:b,v=a.h?b:a;
   if(v.k<h.lo-EPS||v.k>h.hi+EPS||h.k<v.lo-EPS||h.k>v.hi+EPS)continue;
   for(const x of [h.lo,h.hi])add('x',x,v.k,10);
   for(const y of [v.lo,v.hi])add('y',y,h.k,10);
  }
 }
 const lockedX=[...Object.values(scene.points)].filter(p=>Number.isFinite(p.padX)).map(p=>[p.padX-7,p.padX+7]);
 // Add both ends of rigid pad intervals as anchors so no cut moves a pad tip
 // relative to its owning block or Top wall.
 for(const [a,b] of lockedX)constraints.x.push([a,b,0]);
 function keepPins(cuts,axis,guard){
  const fixed=Object.values(pinned).filter(p=>Number.isFinite(p[axis]));if(!fixed.length)return cuts;
  const until=Math.max(...fixed.map(p=>p[axis]+guard)),offset=mapped(cuts,until)-until;
  return cuts.filter(c=>c[0]>until).map(([at,extra])=>[at,extra-offset]);
 }
 const x=keepPins(axisCuts(constraints.x,lockedX),'x',7),y=keepPins(axisCuts(constraints.y,[]),'y',0);
 return x.length||y.length?{x,y,origin:Object.fromEntries(scene.placed.map(b=>[b.instance.id,[b.x,b.y]]))}:null;
}
function block(b,map){
 const origin=map.origin[b.instance.id];if(!origin)return b;
 const [x,y]=origin,newY=mapped(map.y,y),local=v=>mapped(map.y,y+v)-newY;
 const columns=Object.fromEntries(Object.entries(b.columns).map(([key,rows])=>[key,rows.map(r=>r?{...r,y:local(r.y)}:r)]));
 return {...b,width:mapped(map.x,x+b.width)-mapped(map.x,x),height:local(b.height),columns,
  groups:b.groups.map(g=>({...g,y:local(g.y),bottom:local(g.bottom)}))};
}
function expand(scene,snapshot,pinned){
 if(snapshot.autoSize?.trackSpace||scene.edges.some(e=>e.manual))return null;
 const map=make(scene,pinned);if(!map)return null;
 const X=v=>mapped(map.x,v),Y=v=>mapped(map.y,v);
 for(const p of Object.values(snapshot.placed)){p.x=X(p.x);p.y=Y(p.y);}
 for(const r of Object.values(snapshot.routes))r.points=r.points.map(([x,y])=>[X(x),Y(y)]);
 const wall=scene.items.find(i=>i.role==='top-boundary');
 const baseRight=Math.max(scene.topBoundary.left+1050,...scene.placed.map(b=>X(b.x+b.width)+580));
 const topY=Object.values(scene.points).filter(p=>p.outerSide).map(p=>Y(p.y)+100);
 const baseHeight=Math.max(500,...scene.placed.map(b=>Y(b.y+b.height)+70),...topY);
 const height=wall.y+wall.height+18;
 snapshot.autoSize={...snapshot.autoSize,trackSpace:map,extraRight:Math.max(0,X(scene.topBoundary.right)-baseRight),
  extraBottom:Math.max(0,Y(height)-baseHeight),widthAdded:(snapshot.autoSize.widthAdded||0)+X(scene.topBoundary.right)-scene.topBoundary.right,
  heightAdded:(snapshot.autoSize.heightAdded||0)+Y(height)-height};
 return snapshot;
}
const api={make,block,expand,mapped};root.WIUTrackSpaceR106=api;if(typeof module==='object')module.exports=api;
})(globalThis);
