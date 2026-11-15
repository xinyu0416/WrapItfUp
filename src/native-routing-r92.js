/* WrapItfUp r92: electrical-net aware orthogonal route plan for *native* Visio connectors.
 * Geometry is presentation-only: no RTL, net binding or project state is changed.
 * Each unique net segment is a 1D Visio connector; branches share geometric trunk.
 */
(function(root){'use strict';
const KEY_SCALE=1000;
const round=x=>Math.round(x*KEY_SCALE)/KEY_SCALE;
const ck=p=>`${round(p.x)},${round(p.y)}`;
const cmp=(a,b)=>a.x-b.x||a.y-b.y;
function clean(pts){const r=[];for(const p of pts){const q={x:round(p.x),y:round(p.y)},n=r.length;if(n&&ck(q)===ck(r[n-1]))continue;
 if(n>1&&(r[n-2].x===r[n-1].x&&r[n-1].x===q.x||r[n-2].y===r[n-1].y&&r[n-1].y===q.y))r.pop();r.push(q);}return r;}
function isOrthogonal(p){return p.slice(1).every((q,i)=>q.x===p[i].x||q.y===p[i].y);}
function polyline(edge){const raw=edge.points;if(!raw?.length)return [];return clean([{x:raw[0][0],y:raw[0][1]},...raw.map(s=>({x:s[2],y:s[3]}))]);}
function segmentsOf(pts,net){return pts.slice(1).map((b,i)=>({a:pts[i],b,net})).filter(s=>ck(s.a)!==ck(s.b));}
function overlap(a,b){const ah=a.a.y===a.b.y,bh=b.a.y===b.b.y;if(ah!==bh)return 0;
 if(ah){if(a.a.y!==b.a.y)return 0;return Math.max(0,Math.min(Math.max(a.a.x,a.b.x),Math.max(b.a.x,b.b.x))-Math.max(Math.min(a.a.x,a.b.x),Math.min(b.a.x,b.b.x)));}
 if(a.a.x!==b.a.x)return 0;return Math.max(0,Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y)));}
function overlapCount(lines){let n=0;for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++)if(lines[i].net!==lines[j].net&&overlap(lines[i],lines[j])>.5)n++;return n;}
function routeScore(pts,net,occupied,blocks,base){if(!isOrthogonal(pts))return Infinity;
 let cost=0;for(const s of segmentsOf(pts,net)){
  let length=Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y);cost+=length*.5;
  // An electrical terminal may approach its own Block edge briefly, but
  // no long segment may run ALONG or THROUGH a Block within 24 px of it.
  // Checking only the interior used to accept 608-px boundary overlaps.
  for(const o of blocks){const pad=24,inner=o.x-pad,outer=o.x+o.width+pad,top=o.y-pad,bottom=o.y+o.height+pad;
   if(s.a.y===s.b.y){const y=s.a.y,lo=Math.min(s.a.x,s.b.x),hi=Math.max(s.a.x,s.b.x),cross=Math.min(hi,outer)-Math.max(lo,inner);
    if(y>top&&y<bottom&&cross>pad+7)return Infinity;
   }else{const x=s.a.x,lo=Math.min(s.a.y,s.b.y),hi=Math.max(s.a.y,s.b.y),cross=Math.min(hi,bottom)-Math.max(lo,top);
    if(x>inner&&x<outer&&cross>pad+7)return Infinity;
   }}
  for(const t of occupied){const cross=overlap(s,t),same=s.net===t.net;
   if(cross>0){cost+=same?-Math.min(cross,250)*.09:450+Math.min(cross,350)*14;continue;}
   if(s.a.y===s.b.y&&t.a.y===t.b.y){const dist=Math.abs(s.a.y-t.a.y),run=Math.max(0,Math.min(Math.max(s.a.x,s.b.x),Math.max(t.a.x,t.b.x))-Math.max(Math.min(s.a.x,s.b.x),Math.min(t.a.x,t.b.x)));
    if(run&&dist<24&&!same)cost+=run*4*(1-dist/24);}
   if(s.a.x===s.b.x&&t.a.x===t.b.x){const dist=Math.abs(s.a.x-t.a.x),run=Math.max(0,Math.min(Math.max(s.a.y,s.b.y),Math.max(t.a.y,t.b.y))-Math.max(Math.min(s.a.y,s.b.y),Math.min(t.a.y,t.b.y)));
    if(run&&dist<16&&!same)cost+=run*4*(1-dist/16);}
  }
 }
 for(let i=1;i<pts.length-1;i++)cost+=Math.hypot(pts[i].x-(base[i]?.x??pts[i].x),pts[i].y-(base[i]?.y??pts[i].y))*.24;
 return cost;
}
function nudge(pts,axis,index,offset){const p=pts.map(x=>({...x}));if(axis==='x'){p[index].x+=offset;p[index+1].x+=offset;}else{p[index].y+=offset;p[index+1].y+=offset;}
 return clean(p);}
// Visibility-grid fallback for routes that run along a Block border.
// It plans from real port centres through a short outward stub to padded
// obstacle-free lanes, so every connector can still glue to the exact pad.
function safeDetour(edge,scene,occupied,blocks){
 const source=scene.points[edge.source],target=scene.points[edge.target];if(!source||!target)return null;
 const margin=36,srcBlock=source.instance?blocks.find(b=>b.id===source.instance):null,dstBlock=target.instance?blocks.find(b=>b.id===target.instance):null;
 const from=srcBlock?{x:source.x+(source.side==='left'?-margin:margin),y:source.y}:{x:source.x,y:source.y};
 const to=dstBlock?{x:target.x+(target.side==='left'?-margin:margin),y:target.y}:{x:target.x,y:target.y};
 const forceShared=Number.isFinite(edge.sharedTrunkX)&&source.outerSide==='left'&&edge.sharedFanout;
 const root=forceShared?{x:edge.sharedTrunkX,y:source.y}:from;
 const blockPad=27;
 const inside=p=>blocks.some(o=>p.x>o.x-blockPad&&p.x<o.x+o.width+blockPad&&p.y>o.y-blockPad&&p.y<o.y+o.height+blockPad);
 const free=(a,b)=>{
  if(a.x!==b.x&&a.y!==b.y)return false;
  return !blocks.some(o=>{const l=o.x-blockPad,r=o.x+o.width+blockPad,t=o.y-blockPad,bt=o.y+o.height+blockPad;
   return a.x===b.x?a.x>l&&a.x<r&&Math.max(a.y,b.y)>t&&Math.min(a.y,b.y)<bt:
    a.y>t&&a.y<bt&&Math.max(a.x,b.x)>l&&Math.min(a.x,b.x)<r;});
 };
 if(inside(root)||inside(to)||root.x<0||to.x<0)return null;
 const coordsX=new Set([root.x,to.x,(root.x+to.x)/2]),coordsY=new Set([root.y,to.y,(root.y+to.y)/2]);
 for(const o of blocks){coordsX.add(o.x-blockPad-9);coordsX.add(o.x+o.width+blockPad+9);coordsY.add(o.y-blockPad-9);coordsY.add(o.y+o.height+blockPad+9);}
 // A small sample of occupied tracks reduces overlap without adding huge grids.
 for(const s of occupied.slice(-12)){
  if(s.a.x===s.b.x){coordsX.add(s.a.x-30);coordsX.add(s.a.x+30);}
  else{coordsY.add(s.a.y-30);coordsY.add(s.a.y+30);}
 }
 const xs=[...coordsX].filter(x=>x>=40&&x<scene.width+300).sort((a,b)=>a-b),ys=[...coordsY].filter(y=>y>=74&&y<scene.height+300).sort((a,b)=>a-b);
 let sx=xs.indexOf(root.x),sy=ys.indexOf(root.y),tx=xs.indexOf(to.x),ty=ys.indexOf(to.y);if([sx,sy,tx,ty].some(x=>x<0))return null;
 const start={x:sx,y:sy,dir:0,cost:0,parent:null},queue=[start],best=new Map();let goal=null,count=0;
 while(queue.length&&count++<5000){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift(),key=p.x+','+p.y+','+p.dir;if(best.has(key)&&best.get(key)<p.cost)continue;
  if(p.x===tx&&p.y===ty){goal=p;break;}
  for(const [dx,dy,dir] of [[0,-1,2],[0,1,2],[-1,0,1],[1,0,1]]){
   const nx=p.x+dx,ny=p.y+dy;if(nx<0||nx>=xs.length||ny<0||ny>=ys.length)continue;
   const a={x:xs[p.x],y:ys[p.y]},b={x:xs[nx],y:ys[ny]};if(inside(b)||!free(a,b))continue;
   const len=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);let penalty=0;
   for(const s of occupied){if(s.net===edge.net)continue;const newSeg={a,b,net:edge.net};const o=overlap(newSeg,s);if(o>0){penalty+=o*12+150;continue;}
    const h=a.y===b.y,oh=s.a.y===s.b.y;if(h===oh){const dist=Math.abs(h?a.y-s.a.y:a.x-s.a.x),lo=Math.max(Math.min(h?a.x:a.y,h?b.x:b.y),Math.min(oh?s.a.x:s.a.y,oh?s.b.x:s.b.y)),hi=Math.min(Math.max(h?a.x:a.y,h?b.x:b.y),Math.max(oh?s.a.x:s.a.y,oh?s.b.x:s.b.y));if(hi>lo&&dist<27)penalty+=(hi-lo)*(27-dist)*.25;}
   }
   const cost=p.cost+len+(p.dir&&p.dir!==dir?18:0)+penalty,nkey=nx+','+ny+','+dir;
   if(best.has(nkey)&&best.get(nkey)<=cost)continue;best.set(nkey,cost);queue.push({x:nx,y:ny,dir,cost,parent:p});
  }
 }
 if(!goal)return null;let mid=[];for(let p=goal;p;p=p.parent)mid.unshift({x:xs[p.x],y:ys[p.y]});
 let pts=[{x:source.x,y:source.y}];if(forceShared)pts.push(root);else if(srcBlock)pts.push(from);
 pts.push(...mid.slice(forceShared?1:srcBlock?1:1));
 if(dstBlock)pts.push({x:target.x,y:target.y});
 pts=clean(pts);
 if(!isOrthogonal(pts)||pts.length<2)return null;
 return pts;
}

function spread(scene,{limit=Infinity,routeValidator=null}={}){
 const edges=scene.edges.slice(0,limit),blocks=scene.placed.map(p=>({x:p.x,y:p.y,width:p.width,height:p.height,id:p.instance.id}));const routes=[],occupied=[],issues=[];
 for(const edge of edges){const initial=polyline(edge);
  if(initial.length<2)continue;
  if(!isOrthogonal(initial)){issues.push({net:edge.net,type:'non-orthogonal',routeKey:edge.routeKey});continue;}
  if(scene.routeQualityR97||scene.routeQualityR98){
   // Browser and editable Visio must use identical verified electrical paths.
   routes.push({...edge,routePoints:initial});occupied.push(...segmentsOf(initial,edge.net));
   continue;
  }
  let pts=initial,best=routeScore(pts,edge.net,occupied,blocks,initial);
  // Move only internal straight tracks. Terminal coordinates never change.
  // Bidirectional score is deterministic, no global/circular state.
  for(let pass=0;pass<(edge.sharedFanout?0:2);pass++){
   let win=null,winCost=best;
   for(let i=1;i<pts.length-2;i++){
    const a=pts[i],b=pts[i+1],axis=a.x===b.x?'x':a.y===b.y?'y':null;if(!axis)continue;
    for(const delta of [12,-12,24,-24,36,-36,48,-48,64,-64,88,-88,112,-112,144,-144]){
     const candidate=nudge(pts,axis,i,delta);
     if(candidate.length!==pts.length||!isOrthogonal(candidate)||routeValidator&&!routeValidator(candidate,edge))continue;
     const cost=routeScore(candidate,edge.net,occupied,blocks,initial);
     if(cost<winCost-1){win=candidate;winCost=cost;}
    }
   }
   if(!win)break;pts=win;best=winCost;
  }
  if(!Number.isFinite(best)){
   const replacement=safeDetour(edge,scene,occupied,blocks);
   if(replacement&&(!routeValidator||routeValidator(replacement,edge))&&Number.isFinite(routeScore(replacement,edge.net,occupied,blocks,initial))){pts=replacement;best=routeScore(pts,edge.net,occupied,blocks,initial);}
   else issues.push({net:edge.net,type:'block-clearance',routeKey:edge.routeKey});
  }
  routes.push({...edge,routePoints:pts});occupied.push(...segmentsOf(pts,edge.net));
 }
 if(scene.routeQualityR97?.issues?.length)issues.push(...scene.routeQualityR97.issues);
 if(scene.routeQualityR98?.summary?.parallelSpacing?.count)issues.push({type:'wire-spacing',count:scene.routeQualityR98.summary.parallelSpacing.count});
 if(scene.routeQualityR98?.summary?.finalInvalid)issues.push({type:'block-clearance',count:scene.routeQualityR98.summary.finalInvalid});
 return {routes,originalSegments:edges.flatMap(e=>segmentsOf(polyline(e),e.net)),adjustedSegments:occupied,issues};
}
function build(scene,opts={}){
 const sp=spread(scene,opts),nodes=new Map(),segments=new Map(),terminals=new Map();
 for(const edge of sp.routes){
  for(const endpoint of [edge.source,edge.target]){
   const pt=scene.points[endpoint];if(!pt)throw Error('Missing electrical terminal '+endpoint);
   const nk=edge.net+'|'+ck(pt);
   if(terminals.has(nk)&&terminals.get(nk)!==endpoint){ // identical node and same net can have multiple actual ports
    const old=terminals.get(nk);if(!Array.isArray(old))terminals.set(nk,[old,endpoint]);else if(!old.includes(endpoint))old.push(endpoint);
   }else if(!terminals.has(nk))terminals.set(nk,endpoint);
  }
 }
 // Split same-net collinear overlaps and true junction crossings into atomic,
 // uniquely owned electrical segments. Different-net crossings NEVER create a node.
 const all=sp.routes.flatMap(e=>segmentsOf(e.routePoints,e.net));
 const byNet=new Map();for(const s of all){const a=byNet.get(s.net)||[];a.push(s);byNet.set(s.net,a);}
 const allAtomic=[];
 for(const [net,lines] of byNet){
  const endcoords=lines.flatMap(s=>[s.a,s.b]);
  for(const s of lines){
   const horizontal=s.a.y===s.b.y;
   const span=p=>horizontal?p.x:p.y;
   const lo=Math.min(span(s.a),span(s.b)),hi=Math.max(span(s.a),span(s.b));
   const cuts=new Set([lo,hi]);
   for(const p of endcoords){
    if(horizontal ? (p.y===s.a.y&&p.x>lo&&p.x<hi) : (p.x===s.a.x&&p.y>lo&&p.y<hi))cuts.add(span(p));
   }
   for(const other of lines){
    if(horizontal&&other.a.x===other.b.x&&Math.min(other.a.y,other.b.y)<=s.a.y&&s.a.y<=Math.max(other.a.y,other.b.y)){
     if(other.a.x>lo&&other.a.x<hi)cuts.add(other.a.x);
    }
    if(!horizontal&&other.a.y===other.b.y&&Math.min(other.a.x,other.b.x)<=s.a.x&&s.a.x<=Math.max(other.a.x,other.b.x)){
     if(other.a.y>lo&&other.a.y<hi)cuts.add(other.a.y);
    }
   }
   const v=[...cuts].sort((a,b)=>a-b);
   for(let k=1;k<v.length;k++){
    const a=horizontal?{x:v[k-1],y:s.a.y}:{x:s.a.x,y:v[k-1]};
    const b=horizontal?{x:v[k],y:s.a.y}:{x:s.a.x,y:v[k]};
    if(ck(a)!==ck(b))allAtomic.push({a,b,net});
   }
  }
 }
 for(const s of allAtomic){const sorted=[s.a,s.b].sort(cmp),k=s.net+'|'+ck(sorted[0])+'|'+ck(sorted[1]);if(!segments.has(k))segments.set(k,{...s,key:k});}
  for(const s of segments.values())for(const p of [s.a,s.b]){const k=s.net+'|'+ck(p);if(!nodes.has(k))nodes.set(k,{id:k,net:s.net,x:p.x,y:p.y,degree:0});nodes.get(k).degree++;}
 for(const [k,term] of terminals){const node=nodes.get(k);if(Array.isArray(term)&&term.length>1)throw Error('Multiple physical ports share the same routed coordinate: '+k+' ('+term.join(', ')+')');if(node)node.terminal=term;}
 // Prove that each graph branch still has a connected path after shared
 // trunk merging, straight-segment subdivision, and native rerouting.
 const adjByNet=new Map();
 for(const s of segments.values()){
  let adj=adjByNet.get(s.net);if(!adj){adj=new Map();adjByNet.set(s.net,adj);}
  const a=ck(s.a),b=ck(s.b);if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);
 }
 const reach=new Map();
 for(const route of sp.routes){const a=ck(scene.points[route.source]),b=ck(scene.points[route.target]),k=route.net+'|'+a,adj=adjByNet.get(route.net);
  if(!adj?.has(a)||!adj.has(b))throw Error('Routed net has missing physical terminal: '+route.net+' '+route.source+' → '+route.target);
  let seen=reach.get(k);if(!seen){seen=new Set([a]);const queue=[a];while(queue.length){for(const next of adj.get(queue.shift())||[]){if(!seen.has(next)){seen.add(next);queue.push(next);}}}reach.set(k,seen);}
  if(!seen.has(b))throw Error('Routed net is physically disconnected: '+route.net+' '+route.source+' → '+route.target);
 }
 const visibleNodes=[...nodes.values()].filter(x=>!x.terminal);
 const stats={rtlConnections:null,visualBranches:sp.routes.length,netCount:byNet.size,uniqueStraightSegments:segments.size,anchorCount:visibleNodes.length,terminalNodes:[...nodes.values()].filter(x=>x.terminal).length,junctions:visibleNodes.filter(x=>x.degree>=3).length,crossNetOverlapBefore:overlapCount(sp.originalSegments),crossNetOverlapAfter:overlapCount(sp.adjustedSegments),unroutable:sp.issues.length};
 return {routes:sp.routes,edges:[...segments.values()],nodes:[...nodes.values()],stats,issues:sp.issues};
}
const api={build,spread,overlapCount,clean,polyline};root.WIUNativeRoutingR92=api;if(typeof module==='object')module.exports=api;
})(globalThis);
