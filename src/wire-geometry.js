/* Top schematic electrical-crossing analysis. SVG and Visio draw the same
 * integrated, continuous branch geometry. The original routes remain intact.
 * Every crossing is classified by NET ID; none is hidden by a paint mask. */
(function(root){'use strict';
const EPS=1e-4, R=6, H=4.5; // Schematic v9-sized local line jumps
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const key=(x,y)=>`${Math.round(x*10)}:${Math.round(y*10)}`;
function cleanSegments(input){
 const out=[];
 for(const raw of input||[]){
  if(!Array.isArray(raw)||raw.length!==4||!raw.every(Number.isFinite))continue;
  const p=raw.slice(),dx=p[2]-p[0],dy=p[3]-p[1];if(Math.hypot(dx,dy)<EPS)continue;
  const last=out.at(-1);
  if(last&&Math.hypot(last[2]-p[0],last[3]-p[1])<EPS){
   const ux=last[2]-last[0],uy=last[3]-last[1];
   if(Math.abs(ux*dy-uy*dx)<EPS*Math.max(1,Math.hypot(ux,uy),Math.hypot(dx,dy))&&ux*dx+uy*dy>0){last[2]=p[2];last[3]=p[3];continue;}
  }
  out.push(p);
 }
 return out;
}
function routes(edges){return edges.map((e,edgeIndex)=>{
 const all=[],pts=[];let cumulative=0;
 const cleaned=cleanSegments(e.points);
 for(let i=0;i<cleaned.length;i++){
  const [x1,y1,x2,y2]=cleaned[i],dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
  if(!pts.length)pts.push([x1,y1]);pts.push([x2,y2]);
  all.push({edgeIndex,segmentIndex:i,net:e.net,points:[x1,y1,x2,y2],p:{x:x1,y:y1},q:{x:x2,y:y2},d:{x:dx,y:dy},len,offset:cumulative,
    orientation:Math.abs(dy)<EPS?'horizontal':Math.abs(dx)<EPS?'vertical':'oblique'});
  cumulative+=len;
 }
 return {edge:e,edgeIndex,segments:all,points:pts,total:cumulative};
});}
function segments(edges){return routes(edges).flatMap(x=>x.segments);}
function intersects(a,b){
 const d=cross(a.d,b.d),r={x:b.p.x-a.p.x,y:b.p.y-a.p.y};
 if(Math.abs(d)<EPS){
  if(Math.abs(cross(r,a.d))>EPS)return null;
  const alongX=Math.abs(a.d.x)>=Math.abs(a.d.y),a0=alongX?a.p.x:a.p.y,a1=alongX?a.q.x:a.q.y,b0=alongX?b.p.x:b.p.y,b1=alongX?b.q.x:b.q.y;
  const lo=Math.max(Math.min(a0,a1),Math.min(b0,b1)),hi=Math.min(Math.max(a0,a1),Math.max(b0,b1));
  if(hi-lo>1)return {overlap:true,x:alongX?(lo+hi)/2:a.p.x,y:alongX?a.p.y:(lo+hi)/2};
  return null;
 }
 const t=cross(r,b.d)/d,u=cross(r,a.d)/d;
 if(t<-EPS||t>1+EPS||u<-EPS||u>1+EPS)return null;
 return {x:a.p.x+a.d.x*t,y:a.p.y+a.d.y*t,t:Math.max(0,Math.min(1,t)),u:Math.max(0,Math.min(1,u))};
}
function within(x,y,o,pad=0){return x>o.x-pad&&x<o.x+o.width+pad&&y>o.y-pad&&y<o.y+o.height+pad;}
function pointAt(route,pos){
 if(!route.segments.length)return [0,0];
 const seg=route.segments.find(s=>pos<=s.offset+s.len+EPS)||route.segments.at(-1);
 const u=Math.max(0,Math.min(1,(pos-seg.offset)/seg.len));return [seg.p.x+seg.d.x*u,seg.p.y+seg.d.y*u];
}
// If different nets run ON TOP of one another, no arc can represent their
// topology. Spread internal Manhattan trunk segments to neighbouring free
// tracks. Pinned endpoints and explicit user routes are never moved.
function spreadTracks(edges,blocks=[],limits={}){
 const accepted=[];let changed=0;
 const clean=(a,b)=>!blocks.some(o=>{
  const pad=4;if(Math.abs(a[0]-b[0])<EPS)return a[0]>o.x-pad&&a[0]<o.x+o.width+pad&&Math.max(a[1],b[1])>o.y-pad&&Math.min(a[1],b[1])<o.y+o.height+pad;
  if(Math.abs(a[1]-b[1])<EPS)return a[1]>o.y-pad&&a[1]<o.y+o.height+pad&&Math.max(a[0],b[0])>o.x-pad&&Math.min(a[0],b[0])<o.x+o.width+pad;
  return false;
 });
 const edgesPoints=e=>e.points.map(x=>[x[0],x[1]]).concat(e.points.length?[[e.points.at(-1)[2],e.points.at(-1)[3]]]:[]);
 const collisionScore=(path,other)=>{let score=0;
  for(let j=0;j<path.length-1;j++)for(const seg of other){
   const p=path[j],q=path[j+1],x1=seg[0],y1=seg[1],x2=seg[2],y2=seg[3];
   const hv=Math.abs(p[1]-q[1])<EPS,ov=Math.abs(x1-x2)<EPS;
   if(hv===!ov){
    const ppos=hv?p[1]:p[0],opos=ov?x1:y1,over=Math.min(Math.max(hv?p[0]:p[1],hv?q[0]:q[1]),Math.max(ov?y1:x1,ov?y2:x2))-
      Math.max(Math.min(hv?p[0]:p[1],hv?q[0]:q[1]),Math.min(ov?y1:x1,ov?y2:x2));
    if(over>3){const delta=Math.abs(ppos-opos);if(delta<.2)score+=over*20;else if(delta<12)score+=over*(12-delta)*.55;}
   }
  }return score;
 };
 edges.forEach(edge=>{
  if(!edge.points?.length||edge.manual){accepted.push(edge);return;}
  let path=edgesPoints(edge),hasChanged=false;
  // Only attempt to move an INTERNAL trunk between two horizontal stubs.
  for(let j=1;j<path.length-2;j++){
   const a=path[j],b=path[j+1],prev=path[j-1],next=path[j+2],vertical=Math.abs(a[0]-b[0])<EPS,horizontal=Math.abs(a[1]-b[1])<EPS;
   if(!vertical&&!horizontal)continue;
   if(vertical&&!(Math.abs(prev[1]-a[1])<EPS&&Math.abs(next[1]-b[1])<EPS))continue;
   if(horizontal&&!(Math.abs(prev[0]-a[0])<EPS&&Math.abs(next[0]-b[0])<EPS))continue;
   if(Math.hypot(a[0]-b[0],a[1]-b[1])<35)continue;
   const foreign=accepted.filter(z=>z.net!==edge.net).flatMap(z=>z.points);
   if(!foreign.length)continue;
   const localOverlap=collisionScore([path[j],path[j+1]],foreign);if(localOverlap<12)continue;
   const baseline=collisionScore(path,foreign);
   const old=vertical?a[0]:a[1];let best=path,bestScore=baseline;
   for(const delta of [18,-18,30,-30,42,-42,54,-54,72,-72,96,-96]){
    const value=old+delta;
    if(vertical&&!(value>(limits.minX??-Infinity)&&value<(limits.maxX??Infinity)))continue;
    if(!vertical&&value<75)continue;
    const q=path.map(p=>p.slice());q[j][vertical?0:1]=value;q[j+1][vertical?0:1]=value;
    if(![j-1,j,j+1].every(k=>clean(q[k],q[k+1])))continue;
    const score=collisionScore(q,foreign)+Math.abs(delta)*.15;
    if(score<bestScore-15){best=q;bestScore=score;}
   }
   if(best!==path){path=best;hasChanged=true;changed++;}
  }
  if(hasChanged)edge.points=path.slice(1).map((p,j)=>[path[j][0],path[j][1],p[0],p[1]]);
  accepted.push(edge);
 });
 return changed;
}
// The wire's own route owns the jump. A crossing is never rendered by
// painting a white mask over another route. A bridge is SMALL and confined
// to one straight segment (Schematic v9 visual convention). In particular,
// never merge bridge clusters across corners: this produced r88's huge waves.
// Test exactly the six painted chords used by both SVG and native Visio.
function bridgePoints(x,y,tangent,normal,radius){
 return Array.from({length:7},(_,i)=>{
  const along=(i/3-1)*radius, height=(i===0||i===6)?0:H*Math.sin(Math.PI*i/6);
  return [x+tangent.x*along+normal.x*height,y+tangent.y*along+normal.y*height];
 });
}
function bbox(points,pad=0){
 let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
 for(const [x,y] of points){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 return {l:l-pad,r:r+pad,t:t-pad,b:b+pad};
}
function separated(a,b,pad=0){return a.r+pad<b.l||b.r+pad<a.l||a.b+pad<b.t||b.b+pad<a.t;}
function localIndex(){
 const buckets=new Map(),size=96,all=[],large=[];
 const cells=b=>(Math.floor(b.r/size)-Math.floor(b.l/size)+1)*(Math.floor(b.b/size)-Math.floor(b.t/size)+1);
 function visit(box,fn){for(let x=Math.floor(box.l/size);x<=Math.floor(box.r/size);x++)for(let y=Math.floor(box.t/size);y<=Math.floor(box.b/size);y++)fn(x+','+y);}
 return {add(box,value){all.push(value);if(cells(box)>2048){large.push(value);return;}
   visit(box,k=>{if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(value);});},
  near(box){if(cells(box)>2048)return all;const found=new Set(large);visit(box,k=>{for(const v of buckets.get(k)||[])found.add(v);});return found;}};
}
function paintedStrokeIndex(paths,edges){
 const idx=localIndex();
 paths.forEach((path,i)=>{for(let j=1;j<path.length;j++){
  const a=path[j-1],b=path[j],box=bbox([a,b],(edges[i].weight||1.3)/2);
  idx.add(box,{box,net:edges[i].net,oblique:Math.abs(a[0]-b[0])>EPS&&Math.abs(a[1]-b[1])>EPS});
 }});
 return (box,net)=>{for(const s of idx.near(box))if((s.net!==net||s.oblique)&&!separated(box,s.box))return true;return false;};
}
function vertexDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],k=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 const x=a[0]+k*dx,y=a[1]+k*dy;return {d:Math.hypot(x-p[0],y-p[1]),x:(x+p[0])/2,y:(y+p[1])/2};
}
function chordDistance(a,b,c,d){
 const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],dx=c[0]-a[0],dy=c[1]-a[1],det=ux*vy-uy*vx;
 if(Math.abs(det)>EPS){const s=(dx*vy-dy*vx)/det,t=(dx*uy-dy*ux)/det;
  if(s>=0&&s<=1&&t>=0&&t<=1)return {d:0,x:a[0]+s*ux,y:a[1]+s*uy};}
 const hits=[vertexDistance(a,c,d),vertexDistance(b,c,d),vertexDistance(c,a,b),vertexDistance(d,a,b)];
 return hits.reduce((a,b)=>a.d<b.d?a:b);
}
function arcObstacle(points,rect,half){
 const l=rect.l-half,r=rect.r+half,t=rect.t-half,b=rect.b+half;
 // Exact polyline against conservatively ink-expanded rectangle; glancing and endpoint contacts count.
 for(let i=1;i<points.length;i++){
  const [x,y]=points[i-1],dx=points[i][0]-x,dy=points[i][1]-y;
  let lo=0,hi=1;
  for(const [p,q] of [[-dx,x-l],[dx,r-x],[-dy,y-t],[dy,b-y]]){
   if(p===0){if(q<0){hi=-1;break;}}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);
  }
  if(lo<=hi)return true;
 }return false;
}
function renderBridges(r,bumps){
 if(!r.segments.length)return [];
  const output=[],push=pt=>{const prev=output.at(-1);if(!prev||Math.hypot(prev[0]-pt[0],prev[1]-pt[1])>EPS)output.push(pt);};
  let cursor=0;
  const appendUntil=end=>{
   for(const seg of r.segments){const lo=Math.max(cursor,seg.offset),hi=Math.min(end,seg.offset+seg.len);
    if(hi<=lo+EPS)continue;
    push(pointAt(r,lo));push(pointAt(r,hi));
   }
   cursor=end;
  };
  push(pointAt(r,0));
  for(const bump of bumps){
   appendUntil(bump.start);
   const start=pointAt(r,bump.start),end=pointAt(r,bump.end),length=Math.hypot(end[0]-start[0],end[1]-start[1]);
   if(length>EPS)for(const pt of bridgePoints((start[0]+end[0])/2,(start[1]+end[1])/2,
    {x:(end[0]-start[0])/length,y:(end[1]-start[1])/length},bump.normal,length/2))push(pt);
   cursor=bump.end;
  }
  appendUntil(r.total);
  return output;
}
function analyze(edges,pins=new Map(),blocks=[]){
 const rr=routes(edges),ss=rr.flatMap(r=>r.segments),marks=[],issues=[],seen=new Set(),pinLocations=[...pins.values()],byEdge=new Map();
 let sharedSourceLeads=0;
 const nearPin=(x,y,n=11)=>pinLocations.some(p=>Math.hypot(p.x-x,p.y-y)<n);
 const spacing=root.WIURoutingSpacingR98||(typeof require==='function'?require('./routing-spacing-r98'):null);
 const parallelGap=horizontal=>spacing?.requiredGap?.(horizontal)??(horizontal?28:14);
 const tracks=localIndex(),obstacles=localIndex(),pending=[], crossings=new Map();
 for(const seg of ss){
  seg.half=spacing?.halfStroke?.(edges[seg.edgeIndex])??((edges[seg.edgeIndex].weight||1.3)/2);
  seg.u={x:seg.d.x/seg.len,y:seg.d.y/seg.len};seg.bumps=[];seg.hits=[];
  seg.box=bbox([[seg.p.x,seg.p.y],[seg.q.x,seg.q.y]]);tracks.add(seg.box,seg);
 }
 const widest=ss.reduce((n,s)=>Math.max(n,s.half),0);
 function obstacle(l,t,r,b,reason){const box={l,t,r,b};obstacles.add(box,{box,reason});}
 for(const b of blocks)obstacle(b.x-3,b.y-3,b.x+b.width+3,b.y+b.height+3,'BLOCK_CLEARANCE');
 for(const p of pinLocations){const px=p.padX??p.x;obstacle(px-7.7,p.y-5.7,px+7.7,p.y+5.7,'PAD_CLEARANCE');}
 for(let i=0;i<ss.length;i++)for(let j=i+1;j<ss.length;j++){
  const a=ss[i],b=ss[j];if(a.edgeIndex===b.edgeIndex)continue;
  const hit=intersects(a,b);if(!hit)continue;
  const xy=key(hit.x,hit.y),same=a.net===b.net;
  if(hit.overlap){
   // The two logical net names may be aliases of one physical Top input.
   // A shared initial 28-unit pad escape is *one physical trace*, not an
   // electrical short. Longer overlap remains an unambiguous error.
   const ea=edges[a.edgeIndex],eb=edges[b.edgeIndex],origin=pins.get?.(ea.source);
   const lo=Math.max(Math.min(a.p.x,a.q.x),Math.min(b.p.x,b.q.x));
   const hi=Math.min(Math.max(a.p.x,a.q.x),Math.max(b.p.x,b.q.x));
   const direction=origin?.side==='left'?-1:origin?.side==='right'?1:0;
   const minLead=Math.min(origin?.x||0,(origin?.x||0)+direction*28);
   const maxLead=Math.max(origin?.x||0,(origin?.x||0)+direction*28);
   const shared=ea.source===eb.source&&ea.source?.startsWith('top::')&&origin&&direction&&
     a.orientation==='horizontal'&&b.orientation==='horizontal'&&
     Math.abs(a.p.y-origin.y)<EPS&&Math.abs(b.p.y-origin.y)<EPS&&
     lo>=minLead-EPS&&hi<=maxLead+EPS;
   if(shared){sharedSourceLeads++;continue;}
   if(!same){const id='o'+xy+'|'+[a.edgeIndex,b.edgeIndex].sort((x,y)=>x-y).join(':');
    if(!seen.has(id)){seen.add(id);issues.push({kind:'overlap',x:hit.x,y:hit.y,nets:[a.net,b.net],edgeIndices:[a.edgeIndex,b.edgeIndex]});}}
   continue;
  }
  if(blocks.some(o=>within(hit.x,hit.y,o,2)))continue;
  const ea=edges[a.edgeIndex],eb=edges[b.edgeIndex],src=ea.source===eb.source&&ea.source?.startsWith('top::')&&pins.get(ea.source);
  const tap=src&&(src.side==='left'||src.side==='right')&&Math.abs(hit.y-src.y)<EPS&&
   (hit.x-src.x)*(src.side==='right'?1:-1)>=-EPS&&(hit.x-src.x)*(src.side==='right'?1:-1)<=28+EPS&&
   [a,b].every(s=>s.segmentIndex===0&&s.orientation==='horizontal'||s.segmentIndex===1&&Math.hypot(hit.x-s.p.x,hit.y-s.p.y)<EPS);
  if(same||tap){const id='j'+xy+a.net;
   if(!nearPin(hit.x,hit.y)&&!seen.has(id)){seen.add(id);marks.push({kind:'junction',x:hit.x,y:hit.y,net:a.net,color:edges[a.edgeIndex].color||'#444444'});}
   continue;
  }
  const id='x'+xy+'|'+[a.edgeIndex,b.edgeIndex].sort((x,y)=>x-y).join(':');if(seen.has(id))continue;seen.add(id);
  // Shared trunks can be represented by several electrical branches. Plan one physical
  // crossing and apply its identical arc to every participating branch of the owner net.
  const idp=JSON.stringify([xy,...[a.net,b.net].sort()]);
  let crossing=crossings.get(idp);if(!crossing){crossing={x:hit.x,y:hit.y,legs:new Map()};crossings.set(idp,crossing);pending.push(crossing);}
  for(const [seg,t] of [[a,hit.t],[b,hit.u]]){
   if(!crossing.legs.has(seg)){const offset=seg.len*t;crossing.legs.set(seg,offset);seg.hits.push(offset);}
  }
 }
 for(const seg of ss)seg.hits=[...new Set(seg.hits)].sort((a,b)=>a-b);
 // A foreign crossing close to a real fan-out must leave the painted junction
 // intact. Moving the owner branch off its junction would disconnect it visually.
 for(const m of marks)if(m.kind==='junction'){
  const box=bbox([[m.x,m.y]],4.3);obstacles.add(box,{box,reason:'JUNCTION_CLEARANCE',junction:m});
 }
 function available(seg,at){
  let i=0,j=seg.hits.length;while(i<j){const m=(i+j)>>1;if(seg.hits[m]<at-EPS)i=m+1;else j=m;}
  const distance=Math.min(at-(seg.hits[i-1]??-Infinity),(seg.hits[i+1]??Infinity)-at);
  return Math.min(R,Math.min(at,seg.len-at)-1.5,(distance-1)/2);
 }
 function option(legs,x,y,normal,side){
  const [seg,at]=legs[0],margin=Math.min(...legs.map(([s,t])=>Math.min(t,s.len-t)));
  const radius=Math.min(...legs.map(([s,t])=>available(s,t)));
  return {legs,seg,at,normal,radius,reason:margin<4.5?'TURN_CLEARANCE':radius<2.2?'BRIDGE_RUNWAY':null,
   score:(seg.orientation==='horizontal'?100:seg.orientation==='vertical'?60:20)+Math.min(margin,24)-side*.5};
 }
 function options({x,y,legs}){
  const groups=new Map(),out=[];
  for(const [seg,at] of legs){const k=seg.net+'|'+seg.orientation;if(!groups.has(k))groups.set(k,[]);groups.get(k).push([seg,at]);}
  for(const a of groups.values()){
   const s=a[0][0],u=s.u,sign=(s.orientation==='horizontal'&&u.x<0||s.orientation==='vertical'&&u.y<0)?-1:1;
   const n={x:sign*u.y,y:-sign*u.x};
   out.push(option(a,x,y,n,0),option(a,x,y,{x:-n.x,y:-n.y},1));
  }
  return out.sort((a,b)=>b.score-a.score);
 }
 function clearance(candidate,crossing,nearby,nearObstacles){
  if(candidate.reason)return {code:candidate.reason};
  const {seg,normal,radius}=candidate,{x,y}=crossing,points=bridgePoints(x,y,seg.u,normal,radius),box=bbox(points);
  const half=Math.max(...candidate.legs.map(([s])=>s.half));
  for(const o of nearObstacles){
   if(separated(box,o.box,half))continue;
   if(!o.junction){if(arcObstacle(points,o.box,half))return {code:o.reason};continue;}
   const m=o.junction;
   if(m.net===seg.net){
    const dx=m.x-x,dy=m.y-y;
    if(Math.abs(dx*seg.u.y-dy*seg.u.x)<EPS&&Math.abs(dx*seg.u.x+dy*seg.u.y)<=radius+EPS)return {code:o.reason};
   }else if(points.slice(1).some((p,i)=>vertexDistance([m.x,m.y],points[i],p).d<4.3+half-EPS))return {code:o.reason};
  }
  for(const other of nearby){
   if(other.net===seg.net)continue;
   const parallel=other.orientation===seg.orientation,
    required=parallel?parallelGap(seg.orientation==='horizontal'):0,
    ink=half+other.half,reach=ink+required;
   if(separated(box,other.box,reach+H))continue;
   const crossingUnderlay=crossing.legs.has(other)&&!parallel;
   const check=(vertices,bb)=>{
    if(separated(box,bb,reach))return null;
    let closest=null;
    for(let i=1;i<points.length;i++)for(let j=1;j<vertices.length;j++){
     const a=points[i-1],b=points[i],c=vertices[j-1],d=vertices[j];
     if(Math.max(a[0],b[0])+reach<Math.min(c[0],d[0])||Math.max(c[0],d[0])+reach<Math.min(a[0],b[0])||
       Math.max(a[1],b[1])+reach<Math.min(c[1],d[1])||Math.max(c[1],d[1])+reach<Math.min(a[1],b[1]))continue;
     const hit=chordDistance(a,b,c,d);if(hit.d<reach-EPS&&(!closest||hit.d<closest.d))closest=hit;
    }
    return closest&&{code:parallel?'PARALLEL_ENVELOPE':'BRIDGE_COLLISION',edgeIndex:seg.edgeIndex,otherEdgeIndex:other.edgeIndex,netA:seg.net,netB:other.net,
     x:closest.x,y:closest.y,gap:closest.d-ink,required};
   };
   // Only the straight underpass at this actual crossing is exempt. Neighboring
   // bridges on that same underpass are independent painted obstacles.
   if(!other.bumps.length){if(!crossingUnderlay){const hit=check([[other.p.x,other.p.y],[other.q.x,other.q.y]],other.box);if(hit)return hit;}continue;}
   const center=(x-other.p.x)*other.u.x+(y-other.p.y)*other.u.y;
   const span=reach+radius+2*H+1,start=Math.max(0,center-span),end=Math.min(other.len,center+span);
   let cursor=start;
   const straight=(lo,hi)=>{
    if(crossingUnderlay||hi<lo+EPS)return null;
    const p=[[other.p.x+lo*other.u.x,other.p.y+lo*other.u.y],[other.p.x+hi*other.u.x,other.p.y+hi*other.u.y]];return check(p,bbox(p));
   };
   for(const bump of other.bumps){
    if(bump.end<start)continue;if(bump.start>end)break;
    const hit=straight(cursor,Math.min(end,bump.start))||check(bump.points,bump.box);if(hit)return hit;
    cursor=Math.max(cursor,bump.end);
   }
   const hit=straight(cursor,end);if(hit)return hit;
  }
  return null;
 }
 for(const crossing of pending){
  const {x,y,legs}=crossing,choices=options(crossing),failures=[];
  const search=bbox([[x,y]],Math.max(parallelGap(true),parallelGap(false))+2*H+R+2*widest+1);
  const nearby=tracks.near(search),nearObstacles=obstacles.near(search);
  let owner;
  for(const candidate of choices){const hit=clearance(candidate,crossing,nearby,nearObstacles);if(!hit){owner=candidate;break;}failures.push(hit);}
  if(!owner){
   const clearances=failures.filter(f=>Number.isFinite(f.gap)),edgeIndices=[...new Set([...legs.keys()].map(s=>s.edgeIndex).concat(clearances.map(c=>c.otherEdgeIndex)))];
   issues.push({kind:'unresolved',x,y,nets:[...new Set([...legs.keys()].map(s=>s.net))],edgeIndices,reasonCodes:[...new Set(failures.map(f=>f.code))],clearances,
    reason:clearances.length?'跳線外緣與相鄰線路的淨距不足，需局部換軌':'跳線鄰近轉角、相鄰交叉、分岔接點、pad 或 Block，需局部調整路徑'});continue;
  }
  for(const [seg,at] of owner.legs){
   const unique='b'+seg.edgeIndex+':'+Math.round((seg.offset+at)*100)/100;if(seen.has(unique))continue;seen.add(unique);
   const otherNet=[...legs.keys()].find(s=>s.net!==seg.net).net;
   const mark={kind:'bridge',x,y,net:seg.net,color:edges[seg.edgeIndex].color||'#444444',edgeIndex:seg.edgeIndex,
    segmentIndex:seg.segmentIndex,position:seg.offset+at,normal:owner.normal,radius:owner.radius,otherNet};
   marks.push(mark);if(!byEdge.has(seg.edgeIndex))byEdge.set(seg.edgeIndex,[]);byEdge.get(seg.edgeIndex).push(mark);
   const points=bridgePoints(x,y,seg.u,owner.normal,owner.radius);
   seg.bumps.push({start:at-owner.radius,end:at+owner.radius,points,box:bbox(points)});seg.bumps.sort((a,b)=>a.start-b.start);
  }
 }
 const renderPaths=rr.map(r=>{
  if(!r.segments.length)return [];
  const bumps=(byEdge.get(r.edgeIndex)||[]).sort((a,b)=>a.position-b.position)
   .map(m=>({start:m.position-m.radius,end:m.position+m.radius,normal:m.normal,radius:m.radius}));
  return renderBridges(r,bumps);
 });
 return {marks:marks.filter(m=>!m.skipped),issues,renderPaths,segments:ss,summary:{branches:edges.length,bridges:marks.filter(m=>m.kind==='bridge'&&!m.skipped).length,
   junctions:marks.filter(m=>m.kind==='junction').length,sharedSourceLeads,unresolved:issues.filter(m=>m.kind==='unresolved').length,overlaps:issues.filter(m=>m.kind==='overlap').length}};
}
const api={analyze,renderBridges,cleanSegments,segments,intersects,pointAt,routes,spreadTracks,paintedStrokeIndex};root.WIUWireGeometry=api;if(typeof module==='object')module.exports=api;
})(globalThis);
