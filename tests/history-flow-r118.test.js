'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../src/history-flow-r118.js');
const base=()=>({top:'top',workbook:{projectId:'p'},modules:[{id:'m',name:'child',ports:[]}],instances:[{id:'i',name:'u_child',module:'child',parameters:{}}],connections:[],nets:[]});
test('binding states distinguish unfinished from intentional NC and constants',()=>{
 assert.equal(H.bindingKind(null),'unset');assert.equal(H.bindingKind(''),'open');
 for(const s of ["1'b0","32'hff",'0',"'1",'-4'])assert.equal(H.bindingKind(s),'constant');
 for(const s of ['data[7:0]','`IDLE_VAL','{hi,lo}'])assert.equal(H.bindingKind(s),'net');
});
test('history picks only current sheet or project entries',()=>{
 const list=[{scope:'top',label:'top'},{scope:'m',label:'sheet'},{scope:'project',label:'cascade'},{scope:'other',label:'other'}];
 assert.equal(H.historyEntry(list,'m').entry.label,'cascade');assert.equal(H.historyEntry(list.slice(0,2),'top').entry.label,'top');assert.equal(H.historyEntry(list.slice(0,2),'other'),null);
});
test('history labels name affected object and operation before rendering',()=>{
 const a=base(),b=structuredClone(a);b.instances[0].parameters.DATA_W='32';assert.equal(H.historyLabel(a,b,'top'),'修改 u_child 的參數覆寫');
 const c=structuredClone(a);c.modules=[];c.instances=[];assert.equal(H.historyLabel(a,c,'project'),'刪除模組 child');
 const d=structuredClone(a);d.connections=[{id:'c',instance:'i',port:'data',expr:'bus'}];assert.equal(H.historyLabel(a,d,'top'),'修改 u_child.data 綁定');
});
test('issue identity survives updated message but distinguishes ports',()=>{
 const a={code:'WIDTH',ref:{type:'instance',id:'i',port:'a'},message:'8 != 16'};
 assert.equal(H.issueKey(a),H.issueKey({...a,message:'8 != 32'}));assert.notEqual(H.issueKey(a),H.issueKey({...a,ref:{...a.ref,port:'b'}}));
});
const Patch=require('../src/history.js');
test('page-scoped undo preserves independent Top changes',()=>{
 const before=base(),sheet=structuredClone(before);sheet.modules[0].ports=[{id:'a',name:'req',direction:'input'}];
 const entry={scope:'m',patch:Patch.changes(before,sheet)};
 const top=structuredClone(sheet);top.nets.push({id:'n',name:'clk',direction:'input'});
 const undone=Patch.apply(top,entry,true);assert.deepEqual(undone.modules,before.modules);assert.deepEqual(undone.nets,top.nets);
});
test('dependent edits reject scoped undo without mutating original project or entry',()=>{
 const before=base(),one=structuredClone(before);one.instances[0].parameters.DATA_W='32';
 const entry={scope:'top',patch:Patch.changes(before,one)},later=structuredClone(one);later.instances[0].parameters.DATA_W='64';
 const original=JSON.stringify({later,entry});assert.throws(()=>Patch.apply(later,entry,true),/後續相依/);assert.equal(JSON.stringify({later,entry}),original);
});
