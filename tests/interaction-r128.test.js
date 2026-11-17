'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const I=require('../src/interaction-r128'),IL=require('../src/instance-layout'),C=require('../src/assembly-core'),P=require('../src/assembly-parser'),W=require('../src/workbook'),A=require('../src/assembly-actions'),H=require('../src/history'),K=require('../src/assembly-company'),S=require('../src/graph-scene'),RQ=require('../src/routing-quality-r98');
function five(){
 const p=C.newProject();p.top='ControlBarTop';p.modules=[];p.instances=[];p.nets=[];p.connections=[];p.assigns=[];p.rtlSources=[];
 const sources=[['ChannelPort',"module ChannelPort #(parameter WIDTH=8)(input [WIDTH-1:0] req, output ready); assign ready=|req; endmodule\n"],['ControlReg',"module ControlReg(output [7:0] req_p0, req_p1, req_p2, req_p3, input ready_p0, ready_p1, ready_p2, ready_p3); assign req_p0=8'd1; assign req_p1=8'd2; assign req_p2=8'd3; assign req_p3=8'd4; endmodule\n"]];
 for(const [name,text] of sources){const parsed=P.parseRtl(text,{filename:name+'.v'});p.modules.push(...parsed.modules);p.rtlSources.push(...parsed.sources);}
 for(let n=0;n<4;n++)p.instances.push({id:'port'+n,name:'channel_p'+n,module:'ChannelPort',parameters:{}});
 p.instances.push({id:'reg',name:'control_reg',module:'ControlReg',parameters:{}});
 for(let n=0;n<4;n++)for(const [name,range,peer] of [['req','[7:0]','req'],['ready','','ready']]){
  const net=name+'_p'+n;p.nets.push({id:net,name:net,range,direction:'wire',signed:false});
  p.connections.push({id:net+'_a',instance:'reg',port:net,expr:net},{id:net+'_b',instance:'port'+n,port:peer,expr:net});
 }
 const q=W.normalize(p);q.workbook.graphPositions={port0:{x:800,y:180},port1:{x:1450,y:180},port2:{x:2100,y:180},port3:{x:2750,y:180},reg:{x:800,y:700}};return q;
}
test('trailing digit runs increment without changing prefixes or zero padding',()=>{
 assert.deepEqual(I.allocateNames(['ready_p1','data_1','lane009','plain'],['ready_p1','data_1','lane009','plain']),['ready_p2','data_2','lane010','plain_2']);
 assert.deepEqual(I.allocateNames(['x_p1','x_p2'],['x_p1','x_p2','x_p3']),['x_p4','x_p5']);
 assert.deepEqual(I.allocateNames(['wide99999999999999999999'],['wide99999999999999999999']),['wide100000000000000000000']);
});
test('wire name-only editing retains a parameterized range; explicit new range is preserved',()=>{
 assert.deepEqual(I.wireValue('payload_p2','[WIDTH-1:0]'),{name:'payload_p2',range:'[WIDTH-1:0]'});
 assert.deepEqual(I.wireValue('payload_p2[15:0]','[7:0]'),{name:'payload_p2',range:'[15:0]'});
 assert.throws(()=>I.wireValue('bad name','[7:0]'));
});
test('wire rename preserves pin bindings, assigns, Empty ties, serialization and atomic undo',()=>{
 let p=five();p.nets[0].direction='output';p.assigns.push({id:'alias',target:'req_p1',expr:'req_p0'});p.bundleConfig={outputTies:[{port:'req_p0',expr:"8'd0"}]};p=W.normalize(p);
 const before=A.clone(p),v=I.wireValue('payload_p1',p.nets[0].range);A.renameNet(p,p.nets[0].id,v.name);p.nets[0].range=v.range;
 assert.equal(p.nets[0].range,'[7:0]');assert.ok(p.connections.filter(c=>c.expr==='payload_p1').length===2);assert.equal(p.assigns[0].expr,'payload_p1');assert.equal(p.bundleConfig.outputTies[0].port,'payload_p1');
 assert.deepEqual(W.read(W.envelope(p)).project,p);const entry={patch:H.changes(before,p)};assert.deepEqual(H.apply(p,entry,true),before);assert.deepEqual(H.apply(before,entry,false),p);
});
test('bottom bar layout leaves all RTL and work package bytes unchanged',()=>{
 const p=five(),before=A.clone(p),rtl=C.exportVerilog(p),files=K.files(p),placed=require('../src/graph-layout').layout(p);
 IL.set(p,'reg',{shape:'bar'},placed);const box=S.create(p).placed.find(b=>b.instance.id==='reg');
 assert.equal(box.shape,'bar');assert.equal(box.barGroups.length,4);assert.equal(box.barColumns.top.length,8);assert.equal(box.barColumns.bottom.length,0);
 assert.equal(C.exportVerilog(p),rtl);assert.deepEqual(K.files(p),files);assert.deepEqual(C.validate(p).filter(i=>i.severity==='error'),[]);
 for(const key of ['modules','instances','nets','connections','assigns','rtlSources'])assert.deepEqual(p[key],before[key]);
 assert.deepEqual(W.read(W.envelope(p)).project,p);const patch=H.changes(before,p);assert.deepEqual(H.apply(p,{patch},true),before);assert.deepEqual(H.apply(before,{patch},false),p);
});
test('top/bottom pins route outwards and the bar does not intersect regular blocks',()=>{
 const p=five(),L=require('../src/graph-layout');IL.set(p,'reg',{shape:'bar'},L.layout(p));
 const port=p.modules.find(m=>m.name==='ControlReg').ports.find(x=>x.name==='req_p0');IL.set(p,'reg',{pinSides:{[port.id]:'bottom'}},L.layout(p));
 const scene=S.create(p),ctx=RQ.contextFor(scene),bar=scene.placed.find(b=>b.instance.id==='reg');
 assert.ok(scene.placed.filter(b=>b!==bar).every(b=>bar.y>b.y+b.height));assert.equal(scene.points['reg::req_p0'].side,'bottom');
 assert.equal(scene.edges.length,8);assert.ok(scene.edges.every(e=>RQ.valid(RQ.ptsOf(e),e,scene,ctx)),JSON.stringify(scene.routeQualityR98?.summary));
 assert.equal(scene.edges.filter(e=>e.source.startsWith('reg::')||e.target.startsWith('reg::')).length,8);
 assert.ok(!S.svg(scene).includes('NaN'));
});
test('every control pin can independently move to the bottom with a safe escape corridor',()=>{
 const base=five(),L=require('../src/graph-layout');IL.set(base,'reg',{shape:'bar'},L.layout(base));
 for(const port of base.modules.find(m=>m.name==='ControlReg').ports){const p=A.clone(base);IL.set(p,'reg',{pinSides:{[port.id]:'bottom'}},L.layout(p));const scene=S.create(p),ctx=RQ.contextFor(scene);assert.ok(scene.edges.every(e=>RQ.valid(RQ.ptsOf(e),e,scene,ctx)),port.name);}
});
test('compact groups retain physical pins and electrical connections; re-expansion restores labels',()=>{
 const p=five(),L=require('../src/graph-layout');IL.set(p,'reg',{shape:'bar'},L.layout(p));const original=S.create(p);
 IL.set(p,'reg',{compact:true,expanded:[]},L.layout(p));let scene=S.create(p);assert.equal(scene.edges.length,original.edges.length);assert.equal(Object.keys(scene.points).length,Object.keys(original.points).length);
 const group=scene.placed.find(b=>b.instance.id==='reg').barGroups[0];IL.set(p,'reg',{expanded:[group.key]},L.layout(p));scene=S.create(p);
 assert.equal(scene.placed.find(b=>b.instance.id==='reg').barGroups.filter(g=>!g.compact).length,1);
 assert.equal(C.exportVerilog(p),C.exportVerilog(five()));
});
test('removing the bar removes its presentation and undo restores everything',()=>{
 const p=five(),L=require('../src/graph-layout');IL.set(p,'reg',{shape:'bar'},L.layout(p));const before=A.clone(p);W.removeInstanceWithLayout(p,'reg');assert.equal(p.workbook.instanceLayouts.reg,undefined);assert.deepEqual(H.apply(p,{patch:H.changes(before,p)},true),before);
});
if(process.env.WIU_WRITE_CONTROL_EXAMPLE){const p=five();IL.set(p,'reg',{shape:'bar'},require('../src/graph-layout').layout(p));fs.writeFileSync(path.join(__dirname,'../examples/ControlBar.wiu.json'),JSON.stringify(W.envelope(p),null,2)+'\n');}
