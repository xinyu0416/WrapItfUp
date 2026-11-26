'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const W=require('../src/workbook'),L=require('../src/assembly-learning'),H=require('../src/history'),T=require('../src/port-clipboard'),C=require('../src/assembly-core'),K=require('../src/assembly-company');
const clone=x=>JSON.parse(JSON.stringify(x));
function editorNormalizer(){
 const source=fs.readFileSync(require.resolve('../src/editor'),'utf8'),start=source.indexOf('function normalizeProjectState(');
 const context=vm.createContext({window:{WIUPortClipboard:T},uid:()=> 'generated_unused',normalizeFormatRuns:x=>x||[],cleanBitsText:String,colorValue:(x,d)=>x||d,cleanComment:x=>x||'',ensureLayoutState(){},COLORS:['#000']});
 vm.runInContext(source.slice(start,source.indexOf('\n',start)),context);
 return raw=>clone(context.normalizeProjectState(raw));
}
test('two Clock edits undo and redo through real sheet normalization without false dependencies',()=>{
 const normalizeSheet=editorNormalizer();let project=W.normalize(L.makeProject());const initial=clone(project),moduleId=project.modules.find(m=>m.name==='learn_source').id,entries=[],snapshots=[];
 const rtl=C.exportVerilog(project),org=K.org(project);
 for(const name of ['clk','data']){
  // The second load reconstructs beforeClockType beside waveType, instead of
  // its appended position in the first newly-created diagram history patch.
  const raw=normalizeSheet(W.makeDiagram(project,moduleId)),row=raw.signals.left.concat(raw.signals.right).find(p=>p.name===name);
  T.toggleClock(row);const before=project,m=W.moduleOf(project,moduleId);
  project=W.normalize(W.applyDiagram(project,moduleId,raw,{ports:m.ports,parameters:m.parameters,issues:[]}).project,before);
  entries.push({patch:H.changes(before,project)});snapshots.push(clone(project));
 }
 project=W.normalize(H.apply(project,entries[1],true));assert.deepEqual(project,snapshots[0]);
 assert.notEqual(JSON.stringify(project.workbook.diagrams[moduleId]),JSON.stringify(snapshots[0].workbook.diagrams[moduleId]),'exercise real property-order drift after refresh');
 project=W.normalize(H.apply(project,entries[0],true));assert.deepEqual(project,initial);
 for(let i=0;i<entries.length;i++){project=W.normalize(H.apply(project,entries[i],false));assert.deepEqual(project,snapshots[i]);}
 assert.equal(C.exportVerilog(project),rtl);assert.equal(K.org(project),org);
});
test('history ignores object order but preserves genuine dependency and array-order guards',()=>{
 const before={diagram:null,unrelated:{keep:true}},after={diagram:{ports:[{id:'a',clock:true},{id:'b',clock:false}],layout:{x:10,y:20}},unrelated:{keep:true}},entry={patch:H.changes(before,after)};
 const reordered={diagram:{layout:{y:20,x:10},ports:[{clock:true,id:'a'},{clock:false,id:'b'}]},unrelated:{keep:true}};
 assert.deepEqual(H.apply(reordered,entry,true),before);
 for(const change of [p=>p.diagram.layout.x++,p=>p.diagram.ports.reverse(),p=>delete p.diagram.layout.y]){
  const later=clone(reordered);change(later);const original=clone(later);assert.throws(()=>H.apply(later,entry,true),/後續相依/);assert.deepEqual(later,original);
 }
 assert.deepEqual(H.changes({data:{a:1,b:2}},{data:{b:2,a:1}}),[]);
 assert.deepEqual(H.changes({data:{a:1,optional:undefined}},{data:{a:1}}),[]);
});
