/* WrapItfUp r98 - shared diagram/Visio Manhattan quality pass.
 * Presentation only. Never mutate an electrical connection or project state.
 * The visible I/O glyph is 14px wide. Two glyph widths = 28 scene units.
 * A route leaves each pad in its outward direction before the first bend.
 */
(function(root){'use strict';
const IL=root.WIUInstanceLayout||(typeof require==='function'?require('./instance-layout'):null);
const PAD_WIDTH=14, MOAT=2*PAD_WIDTH, ESCAPE=MOAT+12, EPS=.001;
const SP=root.WIURoutingSpacingR98||(typeof require==='function'?require('./routing-spacing-r98'):null);
const round=n=>Math.round(n*1000)/1000;
const point=(x,y)=>({x:round(x),y:round(y)});
const eq=(a,b)=>Math.abs(a-b)<EPS;
const same=(a,b)=>eq(a.x,b.x)&&eq(a.y,b.y);
const ortho=(a,b)=>eq(a.x,b.x)||eq(a.y,b.y);
const len=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const segs=pts=>pts.slice(1).map((b,i)=>({a:pts[i],b})).filter(s=>!same(s.a,s.b));
function clean(pts){const r=[];for(const raw of pts){const p=point(raw.x,raw.y);if(r.length&&same(r.at(-1),p))continue;r.push(p);while(r.length>2){const [a,b,c]=r.slice(-3);if(eq(a.x,b.x)&&eq(b.x,c.x)||eq(a.y,b.y)&&eq(b.y,c.y))r.splice(r.length-2,1);else break;}}return r;}
function rectHits(a,b,o){if(!ortho(a,b))return true;return eq(a.y,b.y)
  ?a.y>o.y+EPS&&a.y<o.y+o.h-EPS&&Math.max(a.x,b.x)>o.x+EPS&&Math.min(a.x,b.x)<o.x+o.w-EPS
  :a.x>o.x+EPS&&a.x<o.x+o.w-EPS&&Math.max(a.y,b.y)>o.y+EPS&&Math.min(a.y,b.y)<o.y+o.h-EPS;}
const inflate=(o,n)=>({x:o.x-n,y:o.y-n,w:o.w+2*n,h:o.h+2*n});
const includes=(o,p)=>p.x>o.x+EPS&&p.x<o.x+o.w-EPS&&p.y>o.y+EPS&&p.y<o.y+o.h-EPS;
function sideVector(side){return side==='left'?-1:side==='right'?1:0;}
const ptsOf=e=>e.points?.length?clean([{x:e.points[0][0],y:e.points[0][1]},...e.points.map(s=>({x:s[2],y:s[3]}))]):[];
const toSegments=pts=>segs(pts).map(s=>[s.a.x,s.a.y,s.b.x,s.b.y]);
function countBends(pts){let n=0;for(let i=1;i<pts.length-1;i++)if((eq(pts[i-1].x,pts[i].x)) !== (eq(pts[i].x,pts[i+1].x)))n++;return n;}
// Binary heap; do not sort a large queue for every routing step.
class Heap{constructor(){this.a=[];}push(item){const a=this.a;a.push(item);let i=a.length-1;while(i){const j=(i-1)>>1;if(a[j].priority<=item.priority)break;a[i]=a[j];i=j;}a[i]=item;}pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1].priority<a[j].priority)j++;if(last.priority<=a[j].priority)break;a[i]=a[j];i=j;}a[i]=last;}return top;}get size(){return this.a.length;}}
function overlap(a,b){const ah=eq(a.a.y,a.b.y),bh=eq(b.a.y,b.b.y);if(ah!==bh)return 0;
 if(ah){if(!eq(a.a.y,b.a.y))return 0;return Math.max(0,Math.min(Math.max(a.a.x,a.b.x),Math.max(b.a.x,b.b.x))-Math.max(Math.min(a.a.x,a.b.x),Math.min(b.a.x,b.b.x)));}
 if(!eq(a.a.x,b.a.x))return 0;return Math.max(0,Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y)));}
function overlapPenalty(s,net,used){let v=0;const h=eq(s.a.y,s.b.y);
 for(const t of SP.near(used,s,18)){if(t.net===net)continue;
  const o=overlap(s,t);if(o>EPS){v+=250+o*18;continue;}
  const th=eq(t.a.y,t.b.y);if(h!==th)continue;
  const gap=Math.abs(h?s.a.y-t.a.y:s.a.x-t.a.x);if(gap>=18)continue;
  const l=h?Math.max(0,Math.min(Math.max(s.a.x,s.b.x),Math.max(t.a.x,t.b.x))-Math.max(Math.min(s.a.x,s.b.x),Math.min(t.a.x,t.b.x))):Math.max(0,Math.min(Math.max(s.a.y,s.b.y),Math.max(t.a.y,t.b.y))-Math.max(Math.min(s.a.y,s.b.y),Math.min(t.a.y,t.b.y)));
  if(l>EPS)v+=l*(18-gap)*.35;
 }
 return v;
}
function metrics(pts,net,used=[]){let length=0,overlapCost=0;for(const s of segs(pts)){length+=len(s.a,s.b);overlapCost+=overlapPenalty(s,net,used);}const bends=countBends(pts);return {length,bends,overlapCost,score:length+bends*112+overlapCost};}
function contextFor(scene){
 const blocks=scene.placed.map(p=>({id:p.instance.id,x:p.x,y:p.y,w:p.width,h:p.height}));
 const pads=Object.values(scene.points).map(p=>({id:p.key,x:p.x,y:p.y,instance:p.instance,side:p.side}));
 return {blocks,moats:blocks.map(o=>inflate(o,MOAT)),pads,top:{left:scene.topBoundary.left,right:scene.topBoundary.right,top:scene.topBoundary.headerBottom??66,bottom:scene.topBoundary.bottom??scene.canvasBounds.height-18}};
}
const expired=()=>Number.isFinite(root.WIURoutingDeadline)&&Date.now()>=root.WIURoutingDeadline;
function valid(pts,edge,scene,ctx){
 const {blocks,moats,pads,top}=ctx;const src=scene.points[edge.source],dst=scene.points[edge.target];
 if(!pts||pts.length<2||!src||!dst||!same(pts[0],src)||!same(pts.at(-1),dst))return false;
 if(pts.some((p,i)=>i&&(!ortho(pts[i-1],p)||same(pts[i-1],p))))return false;
 for(const [p,q] of [[src,pts[1]],[dst,pts.at(-2)]]){const [dx,dy]=IL.vector(p.side);if(dx&&(!eq(q.y,p.y)||(q.x-p.x)*dx+EPS<MOAT)||dy&&(!eq(q.x,p.x)||(q.y-p.y)*dy+EPS<MOAT))return false;}
 for(let i=1;i<pts.length-1;i++){
  const p=pts[i],a=pts[i-1],b=pts[i+1];if((eq(a.x,p.x))===(eq(p.x,b.x)))continue;
  if(p.x<top.left+MOAT-EPS||p.x>top.right-MOAT+EPS||p.y<top.top+MOAT-EPS||p.y>top.bottom-MOAT+EPS)return false;
  if(moats.some(r=>includes(r,p)))return false;
 }
 // Only a terminal's own strictly outward FIRST or LAST lead may traverse
 // its owner Block's 28px moat; no wire may touch any foreign pad glyph.
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],lanes=scene.topBoundary.lanes;
  if(lanes&&eq(a.x,b.x)&&(a.x<top.left+64+lanes.left*lanes.pitch||a.x>top.right-64-lanes.right*lanes.pitch)&&![src.trackX,dst.trackX].some(x=>Number.isFinite(x)&&eq(x,a.x)))return false;
  // Keep ALL geometry outside the top title cap + two-pad-width corridor.
  if(Math.min(a.y,b.y)<top.top+MOAT-EPS)return false;
  if(Math.max(a.y,b.y)>top.bottom-MOAT+EPS||Math.min(a.x,b.x)<top.left-EPS||Math.max(a.x,b.x)>top.right+EPS)return false;
  if(eq(a.x,b.x)&&a.x>top.left-EPS&&a.x<top.left+MOAT-EPS)return false;
  if(eq(a.x,b.x)&&a.x<top.right+EPS&&a.x>top.right-MOAT+EPS)return false;
  for(let j=0;j<moats.length;j++){
   const m=moats[j];if(!rectHits(a,b,m))continue;
   const ownSource=i===0&&blocks[j].id===src.instance;
   const ownTarget=i===pts.length-2&&blocks[j].id===dst.instance;
   if(!ownSource&&!ownTarget)return false;
  }
  // Block-moat collision protection already covers all instance pads.
  // Top pads sit exactly on the boundary; protect those independently.
  for(const pad of pads){if(pad.instance||pad.id===edge.source||pad.id===edge.target)continue;
   if(rectHits(a,b,{x:pad.x-9,y:pad.y-9,w:18,h:18}))return false;
  }
 }
 return true;
}
function unique(v){return [...new Set(v.filter(Number.isFinite).map(round))].sort((a,b)=>a-b);}
function jumpTurnConflict(p,net,used){
 return used.some(s=>s.net!==net&&[s.a,s.b].some(q=>Math.abs(q.x-p.x)<7.5&&Math.abs(q.y-p.y)<7.5));
}
function hasJumpTurnConflict(points,net,used){return points.slice(1,-1).some(p=>jumpTurnConflict(p,net,used));}
function resolve(edge,scene,ctx,used){
 const src=scene.points[edge.source],dst=scene.points[edge.target];
 if(!src||!dst)return null;
 // Top-to-Top alias wires sharing a source must branch after exactly the
 // mandatory 28-unit pad escape, rather than overlaying unrelated signals
 // on a 40/54-unit generic stub. This remains a true route, not a waiver.
 if(!src.instance&&!dst.instance&&src.outerSide===dst.outerSide){
  const lane=src.x+sideVector(src.side)*MOAT;
  const direct=clean([src,point(lane,src.y),point(lane,dst.y),dst]);
  const usedTop=SP.index(used);
  if(valid(direct,edge,scene,ctx)&&!segs(direct).some(s=>SP.collides(s,edge,usedTop,scene)))return direct;
 }
 const forced=Number.isFinite(edge.sharedTrunkX)&&edge.sharedFanout&&src.outerSide==='left'&&src.side==='right';
 const first=forced?point(edge.sharedTrunkX,src.y):IL.escape(src,ESCAPE);
 const last=IL.escape(dst,ESCAPE);
 const rootPart=forced?[point(src.x,src.y),first]:[point(src.x,src.y),first];
 // A common Top-entry trunk must stay identical across all fanout sinks.
 if(!validLead(rootPart[0],rootPart[1],edge,scene,ctx,src.instance))return null;
 if(!validLead(last,dst,edge,scene,ctx,dst.instance))return null;
 const {blocks,moats,top}=ctx,usedIndex=SP.index(used);
 const xMin=top.left+MOAT+2,xMax=top.right-MOAT-2,yMin=top.top+MOAT+2,yMax=top.bottom-MOAT-2;
 const old=ptsOf(edge);
 const nearVertical=used.filter(s=>eq(s.a.x,s.b.x)).sort((a,b)=>Math.min(Math.abs(a.a.x-first.x),Math.abs(a.a.x-last.x),Math.abs(a.a.x-(first.x+last.x)/2))-Math.min(Math.abs(b.a.x-first.x),Math.abs(b.a.x-last.x),Math.abs(b.a.x-(first.x+last.x)/2))).slice(0,12);
 const nearHorizontal=used.filter(s=>eq(s.a.y,s.b.y)).sort((a,b)=>Math.min(Math.abs(a.a.y-first.y),Math.abs(a.a.y-last.y),Math.abs(a.a.y-(first.y+last.y)/2))-Math.min(Math.abs(b.a.y-first.y),Math.abs(b.a.y-last.y),Math.abs(b.a.y-(first.y+last.y)/2))).slice(0,12);
 // Keep sufficient straight-track spacing even when a 4.5-unit bridge faces the next lane.
 const laneOffsets=(track,axis)=>{const c=track.a[axis],required=SP.requiredGap(axis==='y')+SP.halfStroke(edge)+SP.halfStroke(track),pitch=Math.ceil(required+4.5);
  return [c-pitch,c+pitch,c-2*pitch,c+2*pitch,c-Math.ceil(required),c+Math.ceil(required)];};
 const xs=unique([first.x,last.x,(first.x+last.x)/2,...moats.flatMap(r=>[r.x-9,r.x+r.w+9]),...old.map(p=>p.x),...nearVertical.flatMap(s=>laneOffsets(s,'x'))]).filter(x=>x>=xMin-EPS&&x<=xMax+EPS);
 const ys=unique([first.y,last.y,(first.y+last.y)/2,...moats.flatMap(r=>[r.y-9,r.y+r.h+9]),...old.map(p=>p.y),...nearHorizontal.flatMap(s=>laneOffsets(s,'y'))]).filter(y=>y>=yMin-EPS&&y<=yMax+EPS);
 const sx=xs.findIndex(x=>eq(x,first.x)),sy=ys.findIndex(y=>eq(y,first.y));
 const tx=xs.findIndex(x=>eq(x,last.x)),ty=ys.findIndex(y=>eq(y,last.y));
 if(sx<0||sy<0||tx<0||ty<0||xs.length*ys.length>17000)return null;
 const blocked=p=>moats.some(r=>includes(r,p));
 const clear=(a,b)=>!moats.some(r=>rectHits(a,b,r));
 const termPads=ctx.pads.filter(p=>!p.instance&&p.id!==edge.source&&p.id!==edge.target);
 const free=(a,b)=>!termPads.some(p=>rectHits(a,b,{x:p.x-9,y:p.y-9,w:18,h:18}));
 const badTurns=new Set();
 for(const track of used){if(track.net===edge.net)continue;for(const p of [track.a,track.b]){
  const ix0=xs.findIndex(v=>v>p.x-7.5),iy0=ys.findIndex(v=>v>p.y-7.5);
  if(ix0<0||iy0<0)continue;
  for(let ix=ix0;ix<xs.length&&xs[ix]<p.x+7.5;ix++)
   for(let iy=iy0;iy<ys.length&&ys[iy]<p.y+7.5;iy++)badTurns.add(ix+','+iy);
 }}
 const start={ix:sx,iy:sy,dir:0,cost:0,priority:0,parent:null};const heap=new Heap();heap.push(start);
 const dists=new Map([[`${sx},${sy},0`,0]]);let goal=null,popped=0;
 // Grid edges only run along rows/columns; each turn is charged heavily.
 while(!expired()&&heap.size&&popped++<15000){const p=heap.pop(),k=p.ix+','+p.iy+','+p.dir;if(p.cost>(dists.get(k)??Infinity)+EPS)continue;
  if(p.ix===tx&&p.iy===ty){goal=p;break;}
  for(const [dx,dy,d] of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){
   const ix=p.ix+dx,iy=p.iy+dy;if(ix<0||ix>=xs.length||iy<0||iy>=ys.length)continue;
   const a=point(xs[p.ix],ys[p.iy]),b=point(xs[ix],ys[iy]);if(blocked(b)||!clear(a,b)||!free(a,b))continue;
   const turning=p.dir&&p.dir!==d;
   if(turning&&badTurns.has(p.ix+','+p.iy))continue;
   if(turning&&(a.x<top.left+MOAT-EPS||a.x>top.right-MOAT+EPS||a.y<top.top+MOAT-EPS||a.y>top.bottom-MOAT+EPS))continue;
   const segment={a,b,net:edge.net};
   if(SP.collides(segment,edge,usedIndex,scene))continue;
   // During search, penalize only local candidate track conflicts; verify
   // the entire final path before deciding to commit it.
   const penalty=overlapPenalty(segment,edge.net,usedIndex);
   const score=p.cost+len(a,b)+(turning?112:0)+penalty,nk=ix+','+iy+','+d;
   if(score+EPS<(dists.get(nk)??Infinity)){dists.set(nk,score);const n={ix,iy,dir:d,cost:score,priority:score+len(b,last),parent:p};heap.push(n);}
  }
 }
 if(!goal)return null;
 const core=[];for(let p=goal;p;p=p.parent)core.unshift(point(xs[p.ix],ys[p.iy]));
 const pts=clean([...rootPart,...core.slice(1),point(dst.x,dst.y)]);
 return valid(pts,edge,scene,ctx)&&!segs(pts).some(s=>SP.collides(s,edge,usedIndex,scene))?pts:null;
}
function validLead(a,b,edge,scene,ctx,owner){
 if(!ortho(a,b))return false;
 for(const block of ctx.blocks){if(block.id===owner)continue;if(rectHits(a,b,inflate(block,MOAT)))return false;}
 for(const p of ctx.pads){if(p.id===edge.source||p.id===edge.target||p.instance)continue;if(rectHits(a,b,{x:p.x-9,y:p.y-9,w:18,h:18}))return false;}
 return true;
}
function improve(scene,{limit=Infinity}={}){
 const ctx=contextFor(scene),used=[],issues=[],summary={total:0,changed:0,straightened:0,bendsBefore:0,bendsAfter:0,invalidBefore:0,unresolved:0,manualPreserved:0};
 const priority=scene.edges.slice(0,limit).sort((a,b)=>{
  const fan=Number(!!b.sharedFanout)-Number(!!a.sharedFanout);if(fan)return fan;
  const d=e=>{const u=scene.points[e.source],v=scene.points[e.target];return u&&v?Math.abs(u.x-v.x)+Math.abs(u.y-v.y):0;};
  const mode=root.__WIU_R98_SORT__||'original';
  return mode==='long'?d(b)-d(a):mode==='short'?d(a)-d(b):mode==='topfirst'?Number(!b.source.startsWith('top'))-Number(!a.source.startsWith('top')):mode==='blockfirst'?Number(!a.source.startsWith('top'))-Number(!b.source.startsWith('top')):0;
 });
 for(const edge of priority){if(expired())break;
  const before=ptsOf(edge);if(before.length<2)continue;
  summary.total++;summary.bendsBefore+=countBends(before);
  let after=before;
  const beforeValid=valid(before,edge,scene,ctx);
  if(!beforeValid)summary.invalidBefore++;
  const beforeSpaced=!segs(before).some(s=>SP.collides(s,edge,used,scene));
  if(edge.manual&&beforeValid)summary.manualPreserved++;
  else {
   const candidate=resolve(edge,scene,ctx,used);
   if(candidate){
    // Keep the established path when it is actually cleaner, so routing
    // does not chase unrelated wires by growing unnecessary detours.
    if(!beforeValid||!beforeSpaced||hasJumpTurnConflict(before,edge.net,used)||metrics(candidate,edge.net,used).score+1<metrics(before,edge.net,used).score)after=candidate;
   }else if(!beforeValid||!beforeSpaced){
    // Priority 1: never leave a path that hits a pad/Block/Top keepout.
    // If other-net occupancy makes the strict A* search impossible, find a
    // geometrically valid path first, and report any remaining wire gap.
    // Never mislabel this geometry-only fallback as spacing-safe.
    const geometric=beforeValid?null:resolve(edge,scene,ctx,[]);
    if(geometric){after=geometric;issues.push({type:'spacing-open',net:edge.net,routeKey:edge.routeKey});}
    else{summary.unresolved++;issues.push({type:'no-safe-route',net:edge.net,routeKey:edge.routeKey});}
   }
  }
  if(JSON.stringify(toSegments(after))!==JSON.stringify(edge.points)){
   edge.points=toSegments(after);
   edge.routed=true;
   if(edge.manual)edge.manual=false; // render safe auto fallback; original saved waypoint is untouched
   edge.handle=after[Math.floor(after.length/2)];
   const visual=scene.items.find(x=>x.role==='connection'&&x.routeKey===edge.routeKey);
   if(visual)visual.points=after.map(p=>[p.x,p.y]);
   summary.changed++;
   if(countBends(after)<countBends(before))summary.straightened++;
  }
  summary.bendsAfter+=countBends(after);
  used.push(...segs(after).map(s=>({...s,net:edge.net,source:edge.source,target:edge.target,weight:edge.weight})));
 }
 scene.routeQualityR97={summary,issues};return scene.routeQualityR97;
}
function smoothCongestion(scene,{passes=2}={}){
 const ctx=contextFor(scene),edges=scene.edges,foreign=(idx)=>edges.flatMap((e,j)=>idx===j?[]:segs(ptsOf(e)).map(s=>({...s,net:e.net,source:e.source,target:e.target,weight:e.weight})));
 const overlapsWith=(pts,net,tracks)=>segs(pts).reduce((sum,s)=>sum+tracks.filter(t=>t.net!==net&&overlap(s,t)>EPS).length,0);
 const candidateIndices=()=>{
  const indices=[];
  for(let i=0;i<edges.length;i++){
   const e=edges[i],pts=ptsOf(e),tracks=foreign(i);if(overlapsWith(pts,e.net,tracks))indices.push(i);
  }
  // Move independent routes before shared trunk routes. Preserve known fanout.
  return indices.sort((a,b)=>Number(!!edges[a].sharedFanout)-Number(!!edges[b].sharedFanout)||b-a);
 };
 let updated=0;
 for(let pass=0;pass<passes&&!expired();pass++){
  let moves=0;
  for(const i of candidateIndices()){
   const e=edges[i],used=foreign(i),initial=ptsOf(e),prior=overlapsWith(initial,e.net,used);
   if(!prior||e.manual&&valid(initial,e,scene,ctx))continue;
   const trial=resolve(e,scene,ctx,used);if(!trial||!valid(trial,e,scene,ctx))continue;
   const after=overlapsWith(trial,e.net,used);
   // Lexicographic: never introduce new foreign-net superposition merely
   // to reduce wire length. For equal overlaps, demand a better score.
   if(after>prior||after===prior&&metrics(trial,e.net,used).score>=metrics(initial,e.net,used).score-1)continue;
   e.points=toSegments(trial);e.handle=trial[Math.floor(trial.length/2)];e.routed=true;
   const visual=scene.items.find(x=>x.role==='connection'&&x.routeKey===e.routeKey);
   if(visual)visual.points=trial.map(p=>[p.x,p.y]);
   updated++;moves++;
  }
  if(!moves)break;
 }
 return updated;
}
function applyRoute(scene,edge,pts){
 const segments=toSegments(pts);
 if(JSON.stringify(edge.points)===JSON.stringify(segments))return false;
 edge.points=segments;edge.routed=true;edge.handle=pts[Math.floor(pts.length/2)];
 const visual=scene.items.find(x=>x.role==='connection'&&x.routeKey===edge.routeKey);
 if(visual)visual.points=pts.map(p=>[p.x,p.y]);
 return true;
}
function routeContact(pts,edge,tracks,scene){
 let count=0,severity=0;
 for(const s of segs(pts))for(const t of SP.near(tracks,s,SP.requiredGap(eq(s.a.y,s.b.y))+SP.halfStroke(edge)+(tracks.maxHalfStroke||.65))){const o=SP.violation(s,t,edge,t,scene);if(o){count++;severity+=o.required-o.gap;}}
 return {count,score:count*100000+severity};
}
function shiftTrack(pts,i,offset){
 const p=pts.map(x=>({...x})),a=p[i],b=p[i+1];
 if(eq(a.x,b.x)){a.x+=offset;b.x+=offset;}
 else if(eq(a.y,b.y)){a.y+=offset;b.y+=offset;}
 else return null;
 return clean(p);
}
// Search whole channels when a short local slide is trapped between two other tracks.
// Test each mandatory horizontal pad exit before pairing lanes; most candidates end there.
function alternateChannels(old,edge,scene,ctx,foreign,idx){
 const src=scene.points[edge.source],dst=scene.points[edge.target];if(!src||!dst)return null;
 const usable=(a,b)=>same(a,b)||!SP.collides({a,b},edge,idx,scene);
 const priorities=(values,a,b,lo,hi)=>unique(values).filter(v=>v>=lo&&v<=hi).sort((u,v)=>Math.min(Math.abs(a-u),Math.abs(b-u))-Math.min(Math.abs(a-v),Math.abs(b-v)));
 const h=SP.requiredGap(true)+2*SP.halfStroke(edge),v=SP.requiredGap(false)+2*SP.halfStroke(edge);
 const xCandidates=[...old.map(p=>p.x),src.x,dst.x],yCandidates=[...old.map(p=>p.y),src.y,dst.y];
 for(const p of [src,dst])for(const d of [MOAT,MOAT+5,ESCAPE,56,70,84,112,140,196,280])xCandidates.push(p.x+sideVector(p.side)*d);
 for(const t of foreign){const horizontal=eq(t.a.y,t.b.y),vals=horizontal?yCandidates:xCandidates,n=horizontal?t.a.y:t.a.x,pitch=horizontal?h:v;
  for(const d of [Math.ceil(pitch),Math.ceil(pitch+4.5),Math.ceil(pitch+9)])vals.push(n-d,n+d);
 }
 for(const r of ctx.moats){xCandidates.push(r.x-2,r.x+r.w+2);yCandidates.push(r.y-2,r.y+r.h+2);}
 const {top}=ctx,xs=priorities(xCandidates,src.x,dst.x,top.left+MOAT,top.right-MOAT),ys=priorities(yCandidates,src.y,dst.y,top.top+MOAT,top.bottom-MOAT);
 const validRun=(a,b)=>usable(a,b)&&!ctx.moats.some(m=>rectHits(a,b,m));
 const ends=p=>xs.filter(x=>(x-p.x)*sideVector(p.side)>=MOAT-EPS&&validLead(p,point(x,p.y),edge,scene,ctx,p.instance)&&usable(p,point(x,p.y)));
 let a=ends(src),b=ends(dst);
 if(edge.sharedFanout&&Number.isFinite(edge.sharedTrunkX)&&src.outerSide==='left')a=a.filter(x=>eq(x,edge.sharedTrunkX));
 if(!a.length||!b.length)return null;
 const commit=points=>{const q=clean(points);return valid(q,edge,scene,ctx)&&segs(q).every(s=>usable(s.a,s.b))?q:null;};
 const both=new Set(b);
 for(const x of a){if(!both.has(x))continue;const q=commit([src,point(x,src.y),point(x,dst.y),dst]);if(q)return q;}
 a=a.slice(0,40);b=b.slice(0,40);
 for(const y of ys.slice(0,180)){if(expired())break;
  const av=a.filter(x=>validRun(point(x,src.y),point(x,y))),bv=b.filter(x=>validRun(point(x,dst.y),point(x,y)));
  for(const ax of av)for(const bx of bv){
   if(!validRun(point(ax,y),point(bx,y)))continue;
   const q=commit([src,point(ax,src.y),point(ax,y),point(bx,y),point(bx,dst.y),dst]);if(q)return q;
  }
 }
 return null;
}
// Two routes can occupy one another's only clear exit. Test both together
// before committing either relocation, preserving user-pinned waypoints.
function swapChannels(scene,ctx){
 const edges=scene.edges,issues=SP.scan(scene,{limit:200}).issues;
 const track=(path,e)=>segs(path).map(s=>({...s,net:e.net,source:e.source,target:e.target,weight:e.weight}));
 let moves=0;
 for(const {edgeA,edgeB} of issues){if(expired())break;const a=edges[edgeA],b=edges[edgeB];if(a.manual||b.manual)continue;
  const pa=ptsOf(a),pb=ptsOf(b),others=edges.flatMap((e,k)=>k===edgeA||k===edgeB?[]:track(ptsOf(e),e)),oi=SP.index(others);
  const pairScore=(x,y)=>routeContact(x,a,oi,scene).score+routeContact(y,b,oi,scene).score+routeContact(x,a,track(y,b),scene).score;
  const base=pairScore(pa,pb);if(!base)continue;
  let best=base,choice=null;
  for(let i=1;i<pa.length-2;i++)for(let j=1;j<pb.length-2;j++){
   const ah=eq(pa[i].y,pa[i+1].y),bh=eq(pb[j].y,pb[j+1].y);if(ah!==bh)continue;
   const axis=ah?'y':'x',delta=pb[j][axis]-pa[i][axis];if(Math.abs(delta)<EPS)continue;
   const x=shiftTrack(pa,i,delta),y=shiftTrack(pb,j,-delta);if(!valid(x,a,scene,ctx)||!valid(y,b,scene,ctx))continue;
   const score=pairScore(x,y);if(score+EPS<best){best=score;choice=[x,y];}
  }
  // Complete rethreading can also resolve a deadlock without moving fixed pads.
  if(!choice&&moves<12){
   for(const [e1,e2,q1,q2,reverse] of [[a,b,pa,pb,false],[b,a,pb,pa,true]]){
    const u=alternateChannels(q1,e1,scene,ctx,others,oi);if(!u)continue;
    const pile=others.concat(track(u,e1)),v=alternateChannels(q2,e2,scene,ctx,pile,SP.index(pile));
    if(v){choice=reverse?[v,u]:[u,v];break;}
   }
  }
  if(choice){applyRoute(scene,a,choice[0]);applyRoute(scene,b,choice[1]);moves++;}
 }
 return moves;
}
function repairSpacing(scene,{passes=3,maxRoutes=145}={}){
 const ctx=contextFor(scene),edges=scene.edges,allUsed=()=>edges.map(e=>segs(ptsOf(e)).map(s=>({...s,net:e.net,source:e.source,target:e.target,weight:e.weight})));
 let moves=0,routed=0;
 for(let pass=0;pass<passes&&!expired();pass++){
  const used=allUsed(),contactCount=edges.map((e,i)=>routeContact(ptsOf(e),e,SP.index(used.flatMap((t,j)=>i===j?[]:t)),scene).count);
  const order=edges.map((e,i)=>i).filter(i=>contactCount[i]&&!edges[i].manual).sort((a,b)=>contactCount[b]-contactCount[a]||b-a).slice(0,maxRoutes);
  let changed=0;
  for(const i of order){if(expired())break;
   const edge=edges[i],foreign=used.flatMap((t,j)=>i===j?[]:t),idx=SP.index(foreign),old=ptsOf(edge);
   let best=old,base=routeContact(old,edge,idx,scene),quality=base.score;
   if(!base.count)continue;
   // First try a globally spaced replacement, then try one whole straight
   // track moved as a unit (not fragment-by-fragment). A collision-free
   // candidate always wins regardless of modest length or bend changes.
   if(quality>0){
    for(let j=1;j<old.length-2;j++){
     for(const d of [2,-2,4,-4,6,-6,10,-10,14,-14,16,-16,20,-20,28,-28,30,-30,35,-35,42,-42,56,-56,70,-70,84,-84,112,-112,168,-168,224,-224,280,-280]){
      const c=shiftTrack(old,j,d);if(!c||!valid(c,edge,scene,ctx))continue;
      const score=routeContact(c,edge,idx,scene).score;
      if(score+EPS<quality){quality=score;best=c;}
     }
    }
   }
   if(quality>0){const reroute=alternateChannels(old,edge,scene,ctx,foreign,idx)||resolve(edge,scene,ctx,foreign);
    if(reroute&&valid(reroute,edge,scene,ctx)){const score=routeContact(reroute,edge,idx,scene).score;
     if(score<quality){best=reroute;routed++;}
    }
   }
   if(best!==old&&applyRoute(scene,edge,best)){
    used[i]=segs(best).map(s=>({...s,net:edge.net,source:edge.source,target:edge.target,weight:edge.weight}));moves++;changed++;
   }
  }
  if(!changed||pass===passes-1){const swaps=swapChannels(scene,ctx);moves+=swaps;if(!changed&&!swaps)break;}
 }
 return {moves,routed,spacing:SP.scan(scene,{limit:200})};
}
const api={applyRoute,routeContact,swapChannels,PAD_WIDTH,MOAT,ESCAPE,jumpTurnConflict,hasJumpTurnConflict,improve,smoothCongestion,repairSpacing,valid,contextFor,metrics,clean,ptsOf,countBends};
root.WIURoutingQualityR98=api;if(typeof module==='object')module.exports=api;
})(globalThis);
