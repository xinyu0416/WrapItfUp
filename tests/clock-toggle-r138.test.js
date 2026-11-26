'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../src/port-clipboard'),Codec=require('../src/signal-clipboard');
const C=require('../src/assembly-core'),W=require('../src/workbook'),H=require('../src/history'),K=require('../src/assembly-company');
const code=fs.readFileSync(require.resolve('../src/editor.js'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
function loadFunction(context,name){const from=code.indexOf('function '+name+'('),to=code.indexOf(['normalizeProjectState','copyPayloadFromSelection'].includes(name)?'\n':'\nfunction ',from+1);assert.ok(from>=0);vm.runInContext(code.slice(from,to),context);}
test('Clock toggle restores explicit one-bit Data and changes no electrical fields',()=>{
 const p={id:'flag',name:'status_p1',bits:'1',direction:'output',groupId:'Control',waveType:'data'},before=clone(p);
 T.toggleClock(p);assert.equal(p.waveType,'clock');assert.equal(p.beforeClockType,'data');
 T.setWaveType(p,'clock');assert.equal(p.beforeClockType,'data');
 T.toggleClock(p);assert.deepEqual(p,before);
 T.setWaveType(p,'clock');T.setWaveType(p,'signal');assert.equal(p.beforeClockType,undefined);
 T.toggleClock(p);T.toggleClock(p);assert.equal(p.waveType,'signal');
 const incoming={name:'incoming',bits:'1',waveType:'clock'};T.toggleClock(incoming);assert.equal(incoming.waveType,'auto');
});
test('diagram click changes only its port; table batch remembers each type and is one undo action',()=>{
 const state={signals:{left:[{id:'a',name:'a',bits:'1',direction:'input',waveType:'data'}],right:[{id:'b',name:'b',bits:'16',direction:'output',waveType:'auto'}]}},history=[],notices=[];
 const ctx=vm.createContext({state,window:{WIUPortClipboard:T,addEventListener(){}},portEditAllowed:()=>true,isSpacerSignal:s=>!s.name,finishActiveEditHistory(){},clearTimeout(){},inlineCommitTimer:null,commitPortCreation(fn){const before=clone(state);fn();history.push(H.changes(before,state));return true;},render(){},portEditNotice:s=>notices.push(s),requestAnimationFrame(){},previewCanvas:{addEventListener(){}}});
 loadFunction(ctx,'applyPortWaveTypes');loadFunction(ctx,'togglePortClock');
 const before=clone(state);assert.equal(ctx.togglePortClock('left','a'),true);assert.equal(state.signals.left[0].waveType,'clock');assert.equal(state.signals.right[0].waveType,'auto');assert.equal(history.length,1);
 assert.deepEqual(H.apply(state,{patch:history[0]},true),before);assert.deepEqual(H.apply(before,{patch:history[0]},false),state);
 ctx.togglePortClock('left','a');ctx.applyPortWaveTypes([{sig:state.signals.left[0]},{sig:state.signals.right[0]}],'clock');
 assert.deepEqual(state.signals.left.concat(state.signals.right).map(s=>s.beforeClockType),['data','auto']);
 assert.equal(history.length,3);const restored=H.apply(state,{patch:history[2]},true);assert.deepEqual(restored,before);
});
test('Clock action resolves rows after a pending text commit replaces sheet objects',()=>{
 const old={id:'a',name:'old',bits:'1',direction:'input',waveType:'data'},ctx=vm.createContext({state:{signals:{left:[old],right:[]}},window:{WIUPortClipboard:T,addEventListener(){}},portEditAllowed:()=>true,isSpacerSignal:s=>!s.name,clearTimeout(){},inlineCommitTimer:null,render(){},portEditNotice(){},requestAnimationFrame(){},previewCanvas:{addEventListener(){}}});
 ctx.finishActiveEditHistory=()=>{ctx.state=clone(ctx.state);ctx.state.signals.left[0].name='new';};
 ctx.commitPortCreation=fn=>{ctx.finishActiveEditHistory();const before=JSON.stringify(ctx.state);fn();return JSON.stringify(ctx.state)!==before;};
 loadFunction(ctx,'applyPortWaveTypes');loadFunction(ctx,'togglePortClock');
 assert.equal(ctx.togglePortClock('left','a'),true);assert.equal(old.waveType,'data');assert.equal(ctx.state.signals.left[0].waveType,'clock');assert.equal(ctx.state.signals.left[0].beforeClockType,'data');
 assert.equal(ctx.togglePortClock('left','a'),true);assert.equal(ctx.state.signals.left[0].waveType,'data');
});
test('sheet normalize and native clipboard preserve the prior type; shared rows do not expose it',()=>{
 const row={id:'a',name:'flag',bits:'1',direction:'output',waveType:'data'};T.toggleClock(row);
 const ctx=vm.createContext({window:{WIUPortClipboard:T},uid:()=> 'new',normalizeFormatRuns:x=>x||[],cleanBitsText:String,colorValue:(x,d)=>x||d,cleanComment:x=>x||'',ensureLayoutState(){},COLORS:['#000'],selectedRowsAll:()=>[{which:'right',sig:row}],groupDescriptor:()=>null,conditionDescriptor:()=>null,lineColorOf:()=> '#000',textColorOf:()=> '#000'});
 loadFunction(ctx,'normalizeProjectState');loadFunction(ctx,'copyPayloadFromSelection');
 const normalized=ctx.normalizeProjectState({moduleName:'Control',signals:{left:[],right:[row]},groups:{left:[],right:[]}});
 assert.equal(normalized.signals.right[0].beforeClockType,'data');
 const native=ctx.copyPayloadFromSelection(),text=T.encode(native,()=>({width:1})),shared=Codec.decode(text);
 assert.deepEqual(shared.signals,[{name:'flag',bits:'1',waveType:'clock',group:''}]);
 const pasted=T.decode(text,'input',String);T.toggleClock(pasted.items[0]);assert.equal(pasted.items[0].waveType,'data');
 const foreign=T.decode(Codec.encode('WaveASecond',shared.signals),'input',String);assert.equal(foreign.items[0].beforeClockType,undefined);T.toggleClock(foreign.items[0]);assert.equal(foreign.items[0].waveType,'auto');
});
function fixture(){return W.read(JSON.parse(fs.readFileSync(require.resolve('../examples/ExampleTop.wiu.json')))).project;}
function parsed(m){return {ports:m.ports.map(x=>({...x})),parameters:m.parameters,issues:[]};}
test('Top and module Clock choices survive save/reload and restore Data without HDL or org drift',()=>{
 let p=fixture();const rtl=C.exportVerilog(p),org=K.org(p),files=K.files(p),validation=C.validate(p);
 for(const id of ['top',p.modules[0].id]){
  let d=W.makeDiagram(p,id),s=d.signals.left.concat(d.signals.right)[0];T.setWaveType(s,'data');T.toggleClock(s);
  p=W.applyDiagram(p,id,d,parsed(W.moduleOf(p,id))).project;
  p=W.read(W.envelope(p)).project;d=W.makeDiagram(p,id);s=d.signals.left.concat(d.signals.right)[0];assert.equal(s.beforeClockType,'data');T.toggleClock(s);
  p=W.applyDiagram(p,id,d,parsed(W.moduleOf(p,id))).project;
  const restored=W.makeDiagram(p,id).signals.left.concat(W.makeDiagram(p,id).signals.right)[0];assert.equal(restored.waveType,'data');assert.equal(restored.beforeClockType,undefined);
 }
 assert.equal(C.exportVerilog(p),rtl);assert.equal(K.org(p),org);assert.deepEqual(K.files(p),files);assert.deepEqual(C.validate(p),validation);
});
