'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/assembly-core'),W=require('../src/workbook'),X=require('../src/graph-clipboard');
const Codec=require('../src/signal-clipboard');
function example(){
 const p=C.newProject();p.top='TransferTop';
 p.modules=[{id:'port',name:'Channel',parameters:[{name:'WIDTH',value:'8'}],interfaceOnly:true,ports:[
  {id:'clk',name:'clk',direction:'input',range:'',waveType:'clock'},
  {id:'data',name:'data',direction:'output',range:'[WIDTH-1:0]',waveType:'data'},
  {id:'valid',name:'valid',direction:'output',range:'',waveType:'signal'}]}];
 p.instances=[{id:'a',name:'port_p0',module:'Channel',parameters:{WIDTH:'1'}},{id:'b',name:'port_p1',module:'Channel',parameters:{WIDTH:'32'}}];
 p.nets=[{id:'payload',name:'named_payload',range:'[31:0]',direction:'wire'}];
 p.connections=[{id:'wire',instance:'b',port:'data',expr:'named_payload'}];
 return W.normalize(p);
}
test('graph clipboard retains two same-name pins and each instance resolved width',()=>{
 const p=example(),before=JSON.stringify(p),out=X.rows(p,{pins:['a::data','b::data']});
 assert.deepEqual(out.map(x=>[x.name,x.bits,x.waveType,x.group]),[['data','1','data',''],['data','32','data','']]);
 const received=Codec.decode(Codec.encode('WrapItfUp',out));assert.deepEqual(received.signals,out);
 assert.equal(JSON.stringify(p),before);
});
test('instance copy includes unconnected ports with explicit clock type',()=>{
 const rows=X.rows(example(),{object:{kind:'instance',id:'a'}});
 assert.deepEqual(rows.map(x=>[x.name,x.waveType]),[['clk','clock'],['data','data'],['valid','signal']]);
});
test('groups copy all selected ports and wires use the electrical net name',()=>{
 const p=example(),groups=[{instance:'b',members:['clk','valid'],name:'Control'}];
 const rows=X.rows(p,{groups,nets:['named_payload']});
 assert.deepEqual(rows.map(x=>x.name),['clk','valid']);assert.equal(rows[0].group,'Control');
 assert.deepEqual(X.rows(p,{nets:['named_payload']}),[{name:'named_payload',bits:'32',waveType:'data',group:''}]);
});
test('unresolved widths fail before a graph clipboard is created',()=>{
 const p=example();p.instances[0].parameters.WIDTH='MISSING';
 assert.throws(()=>X.rows(p,{object:{kind:'instance',id:'a'}}),/位寬尚未解析/);
});
