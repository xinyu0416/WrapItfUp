'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/assembly-core'),W=require('../src/workbook'),G=require('../src/graph-scene'),D=require('../src/diagram-scene');

// Exercise ordinary, mirrored, bar and Top pins through the actual scene builder.
function fixture(monochrome=false){
 const p=C.newProject();p.top='ClockPaletteExample';
 p.modules=[{id:'cell',name:'ClockCell',parameters:[],ports:[
  {id:'clock_in',name:'clock_in',direction:'input',range:'',waveType:'clock'},
  {id:'clock_out',name:'clock_out',direction:'output',range:'',waveType:'clock'},
  {id:'payload',name:'payload',direction:'input',range:'[7:0]',waveType:'data'}
 ],interfaceOnly:true,placeholder:true}];
 p.instances=[{id:'a',name:'u_a',module:'ClockCell',parameters:{}},{id:'b',name:'u_b',module:'ClockCell',parameters:{}}];
 p.nets=[{id:'sysclk',name:'sysclk',direction:'input',range:'',waveType:'clock'}];
 const q=W.normalize(p),diagram=W.makeDiagram(q,'cell');
 diagram.signals={left:diagram.signals.right,right:diagram.signals.left};
 q.workbook.diagrams.cell=diagram;
 q.workbook.instanceLayouts={a:{shape:'bar',pinSides:{clock_in:'bottom'}}};
 q.workbook.topStyle={monochrome};
 return q;
}
function attributes(tag){return Object.fromEntries(Array.from(tag.matchAll(/([\w-]+)="([^"]*)"/g),m=>[m[1],m[2]]));}
function svgShapes(html){return {circle:attributes(html.match(/<circle\b[^>]*>/)[0]),wave:attributes(html.match(/<path\b[^>]*>/)[0])};}
function sections(vbs,role){return vbs.split(/(?=phase = "Draw )/).filter(s=>s.startsWith('phase = "Draw '+role+' '));}

test('live Clock control has the same circle and square-wave geometry as the exported marker',()=>{
 const active=svgShapes(D.clockIconSvg(true)),inactive=svgShapes(D.clockIconSvg(false));
 const [circle,wave]=D.clockMarker(12,12,{key:'clk',color:'#00ff00'});
 assert.equal(active.circle.stroke,'#A65F86');assert.equal(active.circle.fill,'#F8EAF1');
 assert.equal(active.circle['stroke-dasharray'],undefined);assert.equal(active.wave.stroke,'#A65F86');
 assert.equal(circle.color,active.circle.stroke);assert.equal(circle.fill,active.circle.fill);
 assert.equal(Number(active.circle.r)*2,circle.width);assert.equal(circle.width,circle.height);
 assert.equal(Number(active.circle.cx),circle.x+circle.width/2);assert.equal(Number(active.circle.cy),circle.y+circle.height/2);
 const coords=active.wave.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
 assert.deepEqual(coords,wave.points.flat());assert.equal(active.wave.fill,'none');
 assert.equal(inactive.circle.fill,'none');assert.equal(inactive.circle.stroke,'#858B94');
 assert.equal(inactive.circle['stroke-dasharray'],'2.2 2.2');assert.equal(inactive.wave.stroke,inactive.circle.stroke);
 assert.equal(inactive.wave['stroke-dasharray'],undefined);assert.equal(inactive.wave.d,active.wave.d);
 assert.equal(circle.key,'clk');assert.equal(wave.key,'clk');
});

test('Top, mirrored module and bar clocks retain the chosen palette and monochrome export policy',()=>{
 for(const monochrome of [false,true]){
  const p=fixture(monochrome),before=JSON.stringify(p),rtl=C.renderVerilog(p),scene=G.create(p,{fast:true});
  const circles=scene.items.filter(s=>s.role==='clock-pin'),waves=scene.items.filter(s=>s.role==='clock-wave');
  assert.equal(circles.length,5);assert.equal(waves.length,5);
  assert.deepEqual(circles.map(s=>s.key).sort(),['a::clock_in','a::clock_out','b::clock_in','b::clock_out','top::sysclk']);
  const stroke=monochrome?'#555555':'#A65F86',fill=monochrome?'#f5f5f5':'#F8EAF1';
  for(const c of circles){assert.equal(c.color,stroke);assert.equal(c.fill,fill);assert.equal(waves.find(w=>w.key===c.key).color,stroke);}
  const svg=G.svg(scene);
  assert.ok(svg.includes('fill="'+fill+'"'));assert.ok(svg.includes('stroke="'+stroke+'"'));
  if(monochrome)assert.doesNotMatch(svg,/#A65F86|#F8EAF1/i);
  assert.equal(JSON.stringify(p),before,'drawing a Clock palette must not alter the project');
  assert.equal(C.renderVerilog(p),rtl);
 }
});

test('fixed and native Visio outputs preserve Clock stroke, pale fill and unfilled square wave',()=>{
 for(const monochrome of [false,true]){
  const scene=G.create(fixture(monochrome),{fast:true});
  const outputs=[['fixed',D.vbs(scene)],...['native-visio-r92','native-visio-polyline-r98'].map(name=>[name,require('../src/'+name).exportVbs(scene,{name:'ClockPaletteExample'}).vbs])];
  const stroke=monochrome?'RGB(85,85,85)':'RGB(166,95,134)',fill=monochrome?'RGB(245,245,245)':'RGB(248,234,241)';
  for(const [name,vbs] of outputs){
   const circles=sections(vbs,'clock-pin'),waves=sections(vbs,'clock-wave');
   assert.equal(circles.length,5,name);assert.equal(waves.length,5,name);
   for(const c of circles){assert.match(c,/DrawOval/);assert.ok(c.includes('LineColor").FormulaU = "'+stroke+'"'),name);assert.ok(c.includes('FillForegnd").FormulaU = "'+fill+'"'),name);assert.match(c,/LinePattern"\).FormulaU = "1"/);}
   for(const w of waves){assert.ok(w.includes('LineColor").FormulaU = "'+stroke+'"'),name);assert.match(w,/FillPattern"\).FormulaU = "0"/);}
   if(monochrome)assert.doesNotMatch(vbs,/RGB\(166,95,134\)|RGB\(248,234,241\)/);
  }
 }
});
