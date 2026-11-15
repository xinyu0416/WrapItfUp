/* Endpoint-driven custom connector geometry. No macro, event loop or rerouter.
 * Preserve the initial shared jump plan exactly. Deform only each connector's
 * terminal tracks when a glued pad/guide moves; interior tracks remain fixed.
 * Straight routes get an initially zero-length elbow (same ONE connector), so
 * moving one end perpendicular to the line creates a proper orthogonal dogleg.
 */
(function(root){'use strict';
const EPS=1e-7;
const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<EPS;
const point=p=>Array.isArray(p)?{x:p[0],y:p[1]}:{x:p.x,y:p.y};
const num=n=>String(Number(Number(n).toFixed(9)));
function clean(raw){
 const result=[];
 for(const v of raw){const p=point(v);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Non-finite route vertex');
  if(result.length&&same(result.at(-1),p))continue;
  while(result.length>=2){const a=result.at(-2),b=result.at(-1),ux=b.x-a.x,uy=b.y-a.y,vx=p.x-b.x,vy=p.y-b.y;
   if(Math.abs(ux*vy-uy*vx)<EPS&&ux*vx+uy*vy>0)result.pop();else break;
  }result.push(p);
 }return result;
}
function axisWeights(points,axes,axis){
 const group=[0];let k=0;
 for(const type of axes){if(type===axis)k++;group.push(k);}
 if(!k)throw Error('Endpoint track was not split for '+axis);
 return group.map(g=>g===0?[1,0]:g===k?[0,1]:[0,0]);
}
function model(raw,rendered){
 let base=clean(raw),drawn=rendered.map(point),axes=[],assign=null;
 if(base.length<2||drawn.length<2)throw Error('Empty live connector');
 if(!same(base[0],drawn[0])||!same(base.at(-1),drawn.at(-1)))throw Error('Rendered/chain endpoint mismatch');
 for(let i=1;i<base.length;i++){
  const dx=Math.abs(base[i].x-base[i-1].x),dy=Math.abs(base[i].y-base[i-1].y);
  if(dx>EPS&&dy>EPS)throw Error('Live connector needs an orthogonal base path');
  axes.push(dx>EPS?'x':'y');
 }
 let straightSplit=false;
 if(base.length===2){
  const axis=axes[0],other=axis==='x'?'y':'x',a=base[0],b=base[1];
  // Split the longest genuine baseline span, not through an existing bridge.
  let best=null;
  for(let i=1;i<drawn.length;i++){
   const p=drawn[i-1],q=drawn[i];
   if(Math.abs(p[other]-a[other])<EPS&&Math.abs(q[other]-a[other])<EPS){
    const len=Math.abs(q[axis]-p[axis]);if(!best||len>best.len)best={i,len,p,q};
   }
  }
  if(!best||best.len<EPS)throw Error('No baseline span for endpoint movement');
  const m={x:(best.p.x+best.q.x)/2,y:(best.p.y+best.q.y)/2};
  drawn=[...drawn.slice(0,best.i),m,{...m},...drawn.slice(best.i)];
  base=[a,m,{...m},b];axes=[axis,other,axis];straightSplit=true;
  assign=drawn.map((_,i)=>i<=best.i?0:2);
 }
 const wx=axisWeights(base,axes,'x'),wy=axisWeights(base,axes,'y');
 if(straightSplit){const w=axes[0]==='x'?wx:wy;w[1]=[.5,.5];w[2]=[.5,.5];}
 const vertices=drawn.map((p,index)=>{
  let segment=assign?.[index],t=0;
  if(segment==null){
   let best=Infinity;
   for(let j=0;j<axes.length;j++){
    const a=base[j],b=base[j+1],axis=axes[j],len=b[axis]-a[axis];
    const u=(p[axis]-a[axis])/len,clamp=Math.max(0,Math.min(1,u));
    const q={x:a.x+(b.x-a.x)*clamp,y:a.y+(b.y-a.y)*clamp};
    const d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<best-EPS){best=d;segment=j;}
   }
   if(best>8)throw Error('Jump vertex too far from base route');
  }
  const a=base[segment],b=base[segment+1],axis=axes[segment];
  t=Math.max(0,Math.min(1,(p[axis]-a[axis])/(b[axis]-a[axis])));
  const mix=w=>w[segment].map((v,i)=>v+(w[segment+1][i]-v)*t);
  return {...p,wx:mix(wx),wy:mix(wy),segment};
 });
 return {base,axes,vertices,straightSplit,begin:base[0],end:base.at(-1)};
}
function displaced(m,begin,end){
 const da={x:begin.x-m.begin.x,y:begin.y-m.begin.y},db={x:end.x-m.end.x,y:end.y-m.end.y};
 return m.vertices.map(p=>({x:p.x+p.wx[0]*da.x+p.wx[1]*db.x,y:p.y+p.wy[0]*da.y+p.wy[1]*db.y}));
}
function formulas(v,X,Y){
 const expr=(value,w,axis)=>num(value)+' in'+w.map((k,i)=>Math.abs(k)<EPS?'':'+'+num(k)+'*User.WIU_d'+(i?'E':'B')+axis).join('');
 const p='LOCTOLOC(PNT('+expr(X(v.x),v.wx,'X')+','+expr(Y(v.y),v.wy,'Y')+'),ThePage!PageWidth,Width)';
 return {x:'PNTX('+p+')',y:'PNTY('+p+')'};
}
const api={model,displaced,formulas,clean};root.WIUVisioLiveGeometryR105=api;if(typeof module==='object')module.exports=api;
})(globalThis);
