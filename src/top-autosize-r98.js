/* WrapItfUp r98 — Top worksheet geometry is a single source of truth.
 * Preserve electrical state, the instance geometry, port pitch and fonts.
 * If routing corridors are narrower than the pad-derived minimum, INSERT
 * whitespace between (not into) modules; the Top wall grows in the scene
 * consumed by the browser and every Visio exporter.
 */
(function(root){'use strict';
const PAD=14, MOAT=2*PAD, EPS=.001;
const rd=n=>Math.ceil((n-EPS)/PAD)*PAD;
// Pick the gap containing the conflict. Inserting space before a column or
// row moves the following blocks together, retaining their pad pitch.
function demand(scene){
 const columns=Array.from(new Set(scene.placed.map(b=>b.x))).sort((a,b)=>a-b)
   .map(x=>scene.placed.filter(b=>b.x===x).sort((a,b)=>a.y-b.y));
 const space={beforeX:{},beforeY:{},extraRight:0,extraBottom:0};
 const reserve=(axis,x,y,n)=>{
   const amount=rd(Math.max(2*PAD,n+PAD));
   let next;
   if(axis==='x'){
     next=columns.find(col=>x<=col[0].x+col[0].width/2)?.[0];
     if(!next){space.extraRight=Math.max(space.extraRight,amount);return;}
   }else{
     const dx=col=>Math.max(0,col[0].x-x,x-Math.max(...col.map(b=>b.x+b.width)));
     const nearest=columns.reduce((best,col)=>!best||dx(col)<dx(best)?col:best,null);
     next=nearest?.find(b=>y<=b.y+b.height/2);
     if(!next){space.extraBottom=Math.max(space.extraBottom,amount);return;}
   }
   const map=axis==='x'?space.beforeX:space.beforeY;
   map[next.instance.id]=Math.max(map[next.instance.id]||0,amount);
 };
 for(const v of scene.routeQualityR98?.summary?.parallelSpacing?.issues||[])
   reserve(v.horizontal?'y':'x',v.x,v.y,v.required-v.gap);
 for(const v of scene.crossingIssues||[]){
   if(v.kind!=='unresolved')continue;
   const axis=v.horizontal===true?'y':v.horizontal===false?'x':null;
   if(axis!=='x')reserve('y',v.x,v.y,PAD);
   if(axis!=='y')reserve('x',v.x,v.y,PAD);
 }
 return space;
}
function plan(project,placed,{leftX=300,headerBottom=66}={}){
 const original=placed.map(b=>({...b}));
 const result=placed.map(b=>({...b}));
 const columns=[];
 for(let i=0;i<result.length;i++){
  const b=result[i];let col=columns.find(c=>Math.abs(c.x-b.x)<1);
  if(!col){col={x:b.x,items:[]};columns.push(col);}col.items.push(i);
 }
 columns.sort((a,b)=>a.x-b.x);
 const changes=[];
 // One bounded retry is allowed when the FIRST layout fails clearance;
 // website and native Visio consume the same expanded coordinates.
 const space=project.workbook?.routingSpace||{};
 const minLeft=MOAT*2+PAD*5;
 // Preserve every block's exact width and height; adjust scene positions only.
 let priorRight=leftX,previousExtra=0;
 for(let colIndex=0;colIndex<columns.length;colIndex++){
  const col=columns[colIndex];
  let newX=col.x+previousExtra;
  const requiredX=colIndex===0?leftX+minLeft:priorRight+MOAT*2+PAD*7;
  if(newX<requiredX){const delta=rd(requiredX-newX);newX+=delta;previousExtra+=delta;changes.push({kind:colIndex===0?'left-corridor':'between-columns',delta});}
  const extraX=Math.max(0,...col.items.map(i=>space.beforeX?.[result[i].instance.id]||0));
  if(extraX){newX+=extraX;previousExtra+=extraX;changes.push({kind:'vertical-track-space',delta:extraX});}
  const boxes=col.items.map(i=>({i,b:result[i]})).sort((a,b)=>a.b.y-b.b.y);
  let previousBottom=-Infinity;
  let stackShift=0;
  for(const {i,b} of boxes){
   const topMin=headerBottom+MOAT+PAD*2;
   let newY=b.y+stackShift;
   const requiredY=Math.max(topMin,previousBottom+MOAT*2+PAD*3);
   if(newY<requiredY){const delta=rd(requiredY-newY);newY+=delta;stackShift+=delta;changes.push({kind:previousBottom===-Infinity?'top-corridor':'between-rows',delta,instance:b.instance.id});}
   const extraY=space.beforeY?.[b.instance.id]||0;
   if(extraY){newY+=extraY;stackShift+=extraY;changes.push({kind:'horizontal-track-space',delta:extraY,instance:b.instance.id});}
   result[i].x=newX;result[i].y=newY;previousBottom=newY+b.height;
  }
  priorRight=Math.max(...col.items.map(i=>result[i].x+result[i].width));
 }
 // Don't allow text/pad geometry to be resized: all compensation is spacing.
 const before={right:Math.max(leftX+1050,...original.map(b=>b.x+b.width+580)),bottom:Math.max(500,...original.map(b=>b.y+b.height+70))};
 const after={right:Math.max(leftX+1050,...result.map(b=>b.x+b.width+580)),bottom:Math.max(500,...result.map(b=>b.y+b.height+70))};
 const shifts=result.map((b,i)=>({id:b.instance.id,dx:b.x-original[i].x,dy:b.y-original[i].y})).filter(x=>Math.abs(x.dx)>EPS||Math.abs(x.dy)>EPS);
 const expansion={active:shifts.length>0||after.right>before.right+EPS||after.bottom>before.bottom+EPS,
  changedInstances:shifts.length,widthAdded:Math.max(0,after.right-before.right)+(space.extraRight||0),heightAdded:Math.max(0,after.bottom-before.bottom)+(space.extraBottom||0),
  extraRight:space.extraRight||0,extraBottom:space.extraBottom||0,
  padWidth:PAD,minimumParallelGap:PAD,horizontalClearance:2*PAD,verticalClearance:PAD,topTurnKeepout:MOAT,blockTurnKeepout:MOAT,
  shifts,changes};
 return {placed:result,expansion,before,after};
}
const api={PAD,MOAT,plan,demand};root.WIUTopAutoSizeR98=api;if(typeof module==='object')module.exports=api;
})(globalThis);
