/* Bounded orthogonal candidate routing for interactive dense diagrams.
 * Obstacles and endpoint escape are checked; electrical bindings are untouched.
 * Full geometry/spacing analysis still runs after this path construction. */
(function(root){'use strict';
const IL=root.WIUInstanceLayout||(typeof require==='function'?require('./instance-layout'):null);
const same=(a,b)=>a.x===b.x&&a.y===b.y;
function clean(ps){const out=[];for(const p of ps){if(out.length&&same(out.at(-1),p))continue;while(out.length>1&&((out.at(-2).x===out.at(-1).x&&p.x===out.at(-1).x)||(out.at(-2).y===out.at(-1).y&&p.y===out.at(-1).y)))out.pop();out.push({x:p.x,y:p.y});}return out;}
function hits(a,b,o){return a.x===b.x?a.x>o.x&&a.x<o.x+o.width&&Math.max(a.y,b.y)>o.y&&Math.min(a.y,b.y)<o.y+o.height:a.y>o.y&&a.y<o.y+o.height&&Math.max(a.x,b.x)>o.x&&Math.min(a.x,b.x)<o.x+o.width;}
function router(obstacles,limits={}){
 const moat=obstacles.map(o=>({x:o.x-28,y:o.y-28,width:o.width+56,height:o.height+56})),tracks={h:new Map(),v:new Map()},bucket=16;
 const clear=(a,b)=>a.x===b.x||a.y===b.y?moat.every(o=>!hits(a,b,o)):false;
 function visits(a,b,fn){const h=a.y===b.y,map=h?tracks.h:tracks.v,axis=h?a.y:a.x,k=Math.floor(axis/bucket);for(let i=k-2;i<=k+2;i++)for(const t of map.get(i)||[])fn(t,h,axis);}
 function cost(path,net){let score=path.length*36;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);score+=len;visits(a,b,(t,h,axis)=>{if(t.net===net)return;const gap=Math.abs(axis-t.axis),over=Math.min(Math.max(h?a.x:a.y,h?b.x:b.y),t.hi)-Math.max(Math.min(h?a.x:a.y,h?b.x:b.y),t.lo);if(gap<28&&over>0)score+=Math.min(over,500)*(28-gap)*3;});}return score;}
 function remember(path,net){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],h=a.y===b.y,map=h?tracks.h:tracks.v,axis=h?a.y:a.x,k=Math.floor(axis/bucket);if(!map.has(k))map.set(k,[]);map.get(k).push({axis,lo:Math.min(h?a.x:a.y,h?b.x:b.y),hi:Math.max(h?a.x:a.y,h?b.x:b.y),net});}}
 function valid(path,a,b){if(path.length<2)return false;
  const av=IL.vector(a.side),bv=IL.vector(b.side),first=path[1],last=path.at(-2);
  if((first.x-a.x)*av[0]+(first.y-a.y)*av[1]<40||(last.x-b.x)*bv[0]+(last.y-b.y)*bv[1]<40)return false;
  const owns=(pt,o)=>pt.x>=o.x-8&&pt.x<=o.x+o.width+8&&pt.y>=o.y-8&&pt.y<=o.y+o.height+8;
  for(let i=1;i<path.length;i++)if(!moat.every((o,k)=>(i===1&&owns(a,obstacles[k]))||(i===path.length-1&&owns(b,obstacles[k]))||!hits(path[i-1],path[i],o)))return false;
  return true;
 }
 function grid(a,b){
  const xs=[...new Set([a.x,b.x,...moat.flatMap(o=>[o.x-12,o.x+o.width+12])])].filter(x=>x>=limits.minX&&x<=limits.maxX).sort((a,b)=>a-b),ys=[...new Set([a.y,b.y,...moat.flatMap(o=>[o.y-12,o.y+o.height+12])])].filter(y=>y>=limits.minY).sort((a,b)=>a-b);
  const ix=xs.indexOf(a.x),iy=ys.indexOf(a.y),gx=xs.indexOf(b.x),gy=ys.indexOf(b.y);if(Math.min(ix,iy,gx,gy)<0)return null;
  const n=xs.length,id=(x,y)=>y*n+x,start=id(ix,iy),goal=id(gx,gy),dist=new Map([[start,0]]),prev=new Map(),open=[{x:ix,y:iy,k:start,score:0}];let visits=0;
  // A small shared-obstacle grid; hard bound avoids pathological search.
  while(open.length&&visits++<4096){open.sort((a,b)=>b.score-a.score);const u=open.pop();if(u.k===goal){const out=[];for(let k=goal;k!==undefined;k=prev.get(k))out.push({x:xs[k%n],y:ys[Math.floor(k/n)]});return out.reverse();}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=u.x+dx,y=u.y+dy;if(x<0||y<0||x>=n||y>=ys.length||!clear({x:xs[u.x],y:ys[u.y]},{x:xs[x],y:ys[y]}))continue;const k=id(x,y),g=dist.get(u.k)+Math.abs(xs[x]-xs[u.x])+Math.abs(ys[y]-ys[u.y]);if(dist.has(k)&&dist.get(k)<=g)continue;dist.set(k,g);prev.set(k,u.k);open.push({x,y,k,score:g+Math.abs(xs[x]-b.x)+Math.abs(ys[y]-b.y)});}
  }return null;
 }
 function route(a,b,net,serial=0){const aa=IL.escape(a,40),bb=IL.escape(b,40),candidates=[],add=ps=>{const path=clean([a,...ps,b]);if(valid(path,a,b))candidates.push(path);};
  add([aa,{x:bb.x,y:aa.y},bb]);add([aa,{x:aa.x,y:bb.y},bb]);
  const offset=(serial%11)*28,midX=(aa.x+bb.x)/2,midY=(aa.y+bb.y)/2;
  const xs=[midX,midX+offset,midX-offset,...moat.flatMap(o=>[o.x-12-offset,o.x+o.width+12+offset])],ys=[midY,midY+offset,midY-offset,...moat.flatMap(o=>[o.y-12-offset,o.y+o.height+12+offset])];
  for(const x of xs)if(x>=limits.minX&&x<=limits.maxX)add([aa,{x,y:aa.y},{x,y:bb.y},bb]);
  for(const y of ys)if(y>=limits.minY)add([aa,{x:aa.x,y},{x:bb.x,y},bb]);
  let path=null,best=Infinity;for(const p of candidates){const c=cost(p,net);if(c<best){best=c;path=p;}}
  if(!path){const middle=grid(aa,bb);if(middle){const p=clean([a,...middle,b]);if(valid(p,a,b))path=p;}}
  if(path)remember(path,net);return path;
 }
 return {route,remember};
}
const api={router};root.WIUFastRouting=api;if(typeof module==='object')module.exports=api;
})(globalThis);
