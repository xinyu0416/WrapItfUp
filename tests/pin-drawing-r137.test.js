'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../src/assembly-core'),W=require('../src/workbook'),G=require('../src/graph-scene'),D=require('../src/diagram-scene');

function fixture(){
 const p=C.newProject();p.top='ClockExample';
 p.modules=[{id:'cell',name:'ClockCell',parameters:[{name:'W',value:'8'}],ports:[
  {id:'clock_in',name:'clock_in',direction:'input',range:'',waveType:'clock'},
  {id:'clock_out',name:'clock_out',direction:'output',range:'[0:0]',waveType:'clock'},
  {id:'payload',name:'payload',direction:'input',range:'[W-1:0]',waveType:'data'},
  {id:'serial',name:'serial',direction:'output',range:'[0:0]',waveType:'data'}
 ],interfaceOnly:true,placeholder:true}];
 p.instances=[{id:'a',name:'u_a',module:'ClockCell',parameters:{W:'8'}},{id:'b',name:'u_b',module:'ClockCell',parameters:{W:'32'}}];
 p.nets=[{id:'sysclk',name:'sysclk',direction:'input',range:'',waveType:'clock'},{id:'top_data',name:'top_data',direction:'output',range:'[31:0]',waveType:'data'}];
 const q=W.normalize(p),diagram=W.makeDiagram(q,'cell');
 diagram.signals={left:diagram.signals.right,right:diagram.signals.left};
 q.workbook.diagrams.cell=diagram;
 return q;
}

test('Top pin names, numeric widths and clock marks respect per-instance values and arbitrary sides',()=>{
 const p=fixture(),before=C.renderVerilog(p),scene=G.create(p,{fast:true});
 const labels=scene.items.filter(s=>s.role==='port-name'||s.role==='top-port-name');
 assert.ok(labels.length);assert.ok(labels.every(s=>!/[\[\]]|^(IN|OUT|I\/O) /.test(s.text)));
 const widths=Object.fromEntries(scene.items.filter(s=>s.role==='port-width').map(s=>[s.key,s.text]));
 assert.equal(widths['a::payload'],'8');assert.equal(widths['b::payload'],'32');assert.equal(widths['top::top_data'],'32');
 assert.equal(widths['a::serial'],undefined);assert.equal(widths['a::clock_out'],undefined);
 const circles=scene.items.filter(s=>s.role==='clock-pin');assert.equal(circles.length,5);
 for(const id of ['a','b']){
  const block=scene.placed.find(b=>b.instance.id===id);
  const left=circles.find(s=>s.key===id+'::clock_out'),right=circles.find(s=>s.key===id+'::clock_in');
  assert.equal(left.ownerInstance,id);assert.ok(left.x>block.x&&left.x+left.width<block.x+block.width);
  assert.ok(right.x>block.x+block.width/2&&right.x+right.width<block.x+block.width);
  const name=labels.find(s=>s.key===id+'::clock_out');assert.ok(name.x>=left.x+left.width);
 }
 const reload=W.read(W.envelope(p)).project;
 assert.equal(G.create(reload,{fast:true}).items.filter(s=>s.role==='clock-pin').length,5);
 assert.equal(C.renderVerilog(reload),before);
 assert.match(G.svg(scene),/data-graph-copy-pin="a::payload"/);
});

test('bar pins keep direction geometry and clock circles on the inside for top and bottom',()=>{
 const p=fixture();p.workbook.instanceLayouts={a:{shape:'bar',pinSides:{clock_in:'bottom'}}};
 const scene=G.create(p,{fast:true}),block=scene.placed.find(b=>b.instance.id==='a');
 for(const name of ['clock_in','clock_out']){
  const marker=scene.items.find(s=>s.role==='clock-pin'&&s.key==='a::'+name);
  assert.ok(marker.y>block.y&&marker.y+marker.height<block.y+block.height);
  const glyph=scene.items.find(s=>s.role==='directional-port'&&s.key==='a::'+name);
  assert.equal(glyph.type,'polygon');
 }
 assert.ok(scene.items.filter(s=>s.role==='port-name').every(s=>!s.text.includes('[')&&!s.text.startsWith('IN ')));
 assert.equal(scene.items.find(s=>s.role==='port-width'&&s.key==='a::payload').text,'8');
});

test('all drawing exporters preserve the clock circle outline and wave',()=>{
 const scene=G.create(fixture(),{fast:true});
 const clock=scene.items.findIndex(s=>s.role==='clock-pin');
 const text=D.vbs(scene);
 assert.match(text,/Draw clock-pin/);assert.match(text,/Draw clock-wave/);
 const section=text.slice(text.indexOf('Draw clock-pin'),text.indexOf('Draw clock-wave'));
 assert.match(section,/DrawOval/);assert.match(section,/LinePattern"\).FormulaU = "1"/);
 for(const file of ['native-visio-r92','native-visio-polyline-r98']){
  const exporter=require('../src/'+file),output=exporter.exportVbs(scene,{name:'ClockExample'}).vbs;
  const start=output.indexOf('Set shp = page.DrawOval');
  assert.ok(start>=0,file);assert.match(output.slice(start,start+500),/LinePattern"\).FormulaU = "1"/,file);
 }
 assert.ok(clock>=0);
});

test('net labels retain only the name while wire leads show width',()=>{
 const p=fixture();p.nets.find(n=>n.name==='top_data').direction='input';
 p.connections=[{id:'wire',instance:'b',port:'payload',expr:'top_data'}];
 for(const fast of [true,false]){
  const scene=G.create(p,{fast}),labels=scene.items.filter(s=>s.role==='net-label'&&s.net==='top_data'&&s.primary);
  assert.ok(labels.length);assert.ok(labels.every(s=>s.text==='top_data'));
  assert.equal(scene.items.find(s=>s.role==='port-width'&&s.key==='b::payload').text,'32');
 }
});

test('the submodule scene resolves one-bit parameters and shares clock geometry with editable exports',()=>{
 const source=fs.readFileSync(require.resolve('../src/editor'),'utf8');
 const width=source.slice(source.indexOf('function diagramPortWidth('),source.indexOf('function inlineLengthHtml('));
 const sceneCode=source.slice(source.indexOf('function sharedDiagramScene('),source.indexOf('function sharedDiagramMarkup('));
 const rowGeometry=source.slice(source.indexOf('const PORT_ROW_METRICS='),source.indexOf('function richNameMeasurePx('));
 const rows=[{id:'clk',name:'clk',bits:'1',direction:'input',waveType:'clock',y:90},{id:'one',name:'one',bits:'[ONE-1:0]',direction:'output',waveType:'data',y:121},{id:'wide',name:'wide',bits:'[W-1:0]',direction:'input',waveType:'data',y:152}];
 const context={window:{WIUDiagramScene:D,WIUPortWidths:{rangeFromInput:x=>x==='1'?'':x},WIUProjectHost:{widthInfo:range=>C.parseRange(range,{ONE:1,W:16})}},
  ensureLayoutState:()=>({blockX:200,blockY:40,blockWidth:500,blockHeight:240,leftSignalX:60,rightSignalX:840}),
  signalLayout:side=>side==='left'?rows:[],measureTextPx:s=>s.length*7,blockTitleSafeMetrics:()=>({width:220,cx:450}),moduleFormatObject:()=>({name:'Cell'}),wrapTextRanges:s=>[{text:s}],
  commentLaneGeometry:()=>({x:0}),isSpacerSignal:()=>false,signalIsCommented:()=>false,lineColorOf:()=>'#222222',textColorOf:()=>'#222222',PORT_NAME_EDGE_PAD:8,sceneTextRuns:()=>[],
  cleanComment:()=>'',groupSegments:()=>[],conditionSegments:()=>[],getCanvasHeight:()=>400};
 vm.createContext(context);vm.runInContext(rowGeometry+'\n'+width+'\n'+sceneCode+'\nthis.scene=sharedDiagramScene();',context);
 const scene=context.scene;
 assert.equal(scene.items.filter(s=>s.role==='clock-pin').length,1);
 assert.deepEqual(Array.from(scene.items.filter(s=>s.role==='width'),s=>s.text),['16']);
 assert.equal(scene.items.filter(s=>s.role==='bus-slash').length,1);
 assert.match(D.vbs(scene),/Draw clock-pin/);
});
