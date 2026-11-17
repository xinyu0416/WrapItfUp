'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Fast=require('../src/routing-fast-r130'),VP=require('../src/graph-viewport-r130'),S=require('../src/graph-scene'),C=require('../src/assembly-core'),f=require('./fixtures/dense-top.cjs');
require('../src/group-focus-r100');require('../src/workbook-view');
const V=globalThis.WIUWorkbookView;
const clone=x=>JSON.parse(JSON.stringify(x));
const limits={minX:-1000,maxX:2000,minY:-1000};
function segmentsSafe(path,obstacle){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];assert.ok(a.x===b.x||a.y===b.y);const cross=a.x===b.x?a.x>obstacle.x&&a.x<obstacle.x+obstacle.width&&Math.max(a.y,b.y)>obstacle.y&&Math.min(a.y,b.y)<obstacle.y+obstacle.height:a.y>obstacle.y&&a.y<obstacle.y+obstacle.height&&Math.max(a.x,b.x)>obstacle.x&&Math.min(a.x,b.x)<obstacle.x+obstacle.width;assert.equal(cross,false);}}
test('bounded router keeps direct routes direct, clears obstacles and preserves every endpoint side',()=>{
 const blocks=[{x:0,y:0,width:100,height:100},{x:600,y:0,width:100,height:100}],middle={x:260,y:-30,width:120,height:160};
 for(const side of ['left','right','top','bottom']){
  const point=(b,s)=>({x:s==='left'?b.x:s==='right'?b.x+b.width:b.x+b.width/2,y:s==='top'?b.y:s==='bottom'?b.y+b.height:b.y+b.height/2,side:s});
  const a=point(blocks[0],side),b=point(blocks[1],side),before=clone([blocks,a,b]),r=Fast.router([...blocks,middle],limits).route(a,b,'net_'+side);
  assert.ok(r,side);assert.deepEqual(r[0],{x:a.x,y:a.y});assert.deepEqual(r.at(-1),{x:b.x,y:b.y});segmentsSafe(r,{x:middle.x-28,y:middle.y-28,width:middle.width+56,height:middle.height+56});
  const vec={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]}[side];for(const [p,q] of [[r[0],r[1]],[r.at(-1),r.at(-2)]])assert.ok((q.x-p.x)*vec[0]+(q.y-p.y)*vec[1]>=40);
  assert.deepEqual([blocks,a,b],before);
 }
 const direct=Fast.router(blocks,limits).route({x:100,y:50,side:'right'},{x:600,y:50,side:'left'},'n');assert.deepEqual(direct,[{x:100,y:50},{x:600,y:50}]);
});
test('viewport retains wires crossing the screen with both endpoints outside and rejects distant paths',()=>{
 const v={x:100,y:100,width:200,height:200};
 assert.equal(VP.visibleItem({type:'path',points:[[0,200],[500,200]],role:'connection'},v),true);
 assert.equal(VP.visibleItem({type:'path',points:[[0,0],[500,0],[500,500]],role:'connection'},v),false);
 assert.equal(VP.visibleItem({type:'rect',x:90,y:90,width:20,height:20},v),true);
 assert.equal(VP.visibleItem({type:'rect',x:0,y:0,width:10,height:10},v),false);
 const scene={width:2000,height:3000},window=VP.windowRect(scene,500,300,.5,{x:-250,y:-500},0);assert.deepEqual(window,{x:500,y:1000,width:1000,height:600,overview:false});
 assert.equal(VP.contains(VP.windowRect(scene,500,300,.5,{x:-250,y:-500}),window),true);
});
test('large graph viewport and overview reduce DOM while full scene, SVG and RTL stay complete',()=>{
 const p=f(8,32),before=clone(p),scene=S.create(p,{fast:true}),full=V.drawing(p,'',{scene}),viewport=VP.windowRect(scene,900,600,1,{x:-800,y:-400}),partial=V.drawing(p,'',{scene,viewport});
 const nodes=s=>(s.match(/<[a-z][^>]*>/g)||[]).length;assert.ok(nodes(partial)<nodes(full)/2);
 const overview=V.drawing(p,'',{scene,viewport:{x:0,y:0,width:scene.width,height:scene.height,overview:true}});
 assert.ok(nodes(overview)<nodes(full)/2);assert.ok(!overview.includes('data-graph-wire-pad'));assert.ok(!overview.includes('data-wire-name'));
 assert.equal((full.match(/data-graph-wire-pad/g)||[]).length,Object.keys(scene.points).length);
 assert.equal(S.create(p,{fast:true}),scene);assert.deepEqual(p,before);assert.equal(C.exportVerilog(p),C.exportVerilog(before));
 const svg=S.svg(scene);assert.ok(svg.includes('in_p31'));assert.ok(svg.length>S.svg(scene,{viewport}).length);
 assert.ok(V.drawing(p,'',{scene,viewport:{...viewport,overview:false}}).includes('data-graph-wire-pad'));
});
