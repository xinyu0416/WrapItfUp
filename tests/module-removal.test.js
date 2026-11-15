'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../src/workbook.js'),H=require('../src/history.js'),P=require('../src/assembly-parser.js');
function fixture(){
 const p=W.normalize({top:'chip',modules:[
  {id:'m_src',name:'src',interfaceOnly:true,ports:[{name:'clk',direction:'input'},{name:'q',direction:'output'}]},
  {id:'m_sink',name:'sink',interfaceOnly:true,ports:[{name:'clk',direction:'input'},{name:'a',direction:'input'},{name:'b',direction:'input'}]}],
 instances:[{id:'u0',name:'src_0',module:'src'},{id:'u1',name:'src_1',module:'src'},{id:'v',name:'sink_0',module:'sink'}],
 nets:[{id:'clk',name:'clk',direction:'input'},{id:'n0',name:'d0',direction:'wire',nameBinding:{mode:'instance-port',instanceId:'u0',portId:'q0',lastGenerated:'d0'}},{id:'n1',name:'d1',direction:'wire',nameBinding:{mode:'instance-port',instanceId:'u1',portId:'q1',lastGenerated:'d1'}}],
 connections:[{instance:'u0',port:'clk',expr:'clk'},{instance:'u1',port:'clk',expr:'clk'},{instance:'v',port:'clk',expr:'clk'},{instance:'u0',port:'q',expr:'d0'},{instance:'u1',port:'q',expr:'d1'},{instance:'v',port:'a',expr:'d0'},{instance:'v',port:'b',expr:'d1'}]});
 p.workbook.graphPositions={u0:{x:10,y:20},u1:{x:100,y:200},v:{x:450,y:90}};
 p.workbook.wireRoutes={'u0::q|v::a|n0':[{x:1,y:2}],'u1::q|v::b|n1':[{x:3,y:4}],'top::clk|v::clk|clk':[{x:9,y:7}]};
 p.workbook.diagrams.m_src=W.makeDiagram(p,'m_src');
 return p;
}
test('cascade removes every matching instance and dependent bindings while preserving unrelated clock fanout',()=>{
 const before=fixture(),json=JSON.stringify(before),r=W.retireModule(before,'m_src',{cascade:true}),p=r.project;
 assert.equal(JSON.stringify(before),json);assert.equal(r.removedInstances.length,2);
 assert.deepEqual(p.modules.map(m=>m.name),['sink']);assert.deepEqual(p.instances.map(i=>i.id),['v']);
 assert.deepEqual(p.connections.map(c=>[c.instance,c.port,c.expr]),[['v','clk','clk']]);
 assert.deepEqual(p.workbook.graphPositions,{v:{x:450,y:90}});
 assert.deepEqual(Object.keys(p.workbook.wireRoutes),['top::clk|v::clk|clk']);assert.equal(p.workbook.diagrams.m_src,undefined);
 assert.ok(p.nets.some(n=>n.name==='clk'&&n.direction==='input'));
});
test('one patch undoes and redoes definition, source, all instances, bindings and geometry exactly',()=>{
 const before=fixture(),after=W.retireModule(before,'m_src',{cascade:true}).project;
 const entry={patch:H.changes(before,after)};
 const restored=W.normalize(H.apply(after,entry,true));assert.deepEqual(restored,before);
 assert.deepEqual(W.normalize(H.apply(restored,entry,false)),after);
 assert.deepEqual(W.normalize(H.apply(after,entry,true)),before);
});
test('unused module deletion and undo preserve other definitions',()=>{
 const before=fixture();before.modules.push({id:'unused',name:'unused',ports:[],parameters:[],interfaceOnly:true});
 const p=W.normalize(before),r=W.retireModule(p,'unused',{cascade:true});
 assert.equal(r.removedInstances.length,0);assert.deepEqual(r.project.instances,p.instances);
 assert.deepEqual(H.apply(r.project,{patch:H.changes(p,r.project)},true),p);
});
test('deleting a sink preserves the surviving driver and other shared-net connections',()=>{
 const p=fixture(),r=W.retireModule(p,'m_sink',{cascade:true}).project;
 assert.equal(r.instances.length,2);assert.equal(r.connections.length,4);
 assert.ok(r.connections.some(c=>c.instance==='u0'&&c.port==='q'));assert.ok(r.nets.some(n=>n.name==='clk'));
});
test('shared RTL file keeps sibling source, and undo restores the original bytes',()=>{
 const text='// shared file\nmodule src(input clk, output q); assign q=clk; endmodule\nmodule sink(input clk, input a, input b); endmodule\n';
 const parsed=P.parseRtl(text,{filename:'shared.v'}),base=fixture();
 base.modules=parsed.modules.map(m=>({...m,id:m.name==='src'?'m_src':'m_sink'}));base.rtlSources=parsed.sources;
 const p=W.normalize(base),r=W.retireModule(p,'m_src',{cascade:true});
 assert.equal(r.project.rtlSources.length,1);assert.ok(!r.project.rtlSources[0].text.includes('module src('));assert.ok(r.project.rtlSources[0].text.includes('module sink('));
 assert.deepEqual(H.apply(r.project,{patch:H.changes(p,r.project)},true),p);
});
test('unsafe nested RTL references reject the whole cascade without partial deletion',()=>{
 const text='module src(input clk, output q); assign q=clk; endmodule\nmodule sink(input clk, input a, input b); src inner(.clk(clk),.q()); endmodule';
 const parsed=P.parseRtl(text,{filename:'shared.v'}),base=fixture();base.modules=parsed.modules.map(m=>({...m,id:m.name==='src'?'m_src':'m_sink'}));base.rtlSources=parsed.sources;
 const p=W.normalize(base),before=JSON.stringify(p);assert.throws(()=>W.retireModule(p,'m_src',{cascade:true}),/引用/);assert.equal(JSON.stringify(p),before);
 assert.throws(()=>W.retireModule(p,'top',{cascade:true}),/Top/);
});
