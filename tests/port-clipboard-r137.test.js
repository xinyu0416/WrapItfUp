'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Codec=require('../src/signal-clipboard'),Adapter=require('../src/port-clipboard'),I=require('../src/interaction-r128');
const C=require('../src/assembly-core'),W=require('../src/workbook'),K=require('../src/assembly-company'),H=require('../src/history'),M=require('../src/signal-table-model-r120');
const sanitize=name=>String(name).trim().replace(/\s+/g,'_');
const native=()=>({format:'WrapperSignalRows',version:5,items:[
 {name:'clk',bits:'1',waveType:'clock',direction:'input',groupName:'Control'},
 {name:'valid',bits:'1',waveType:'data',direction:'output'},
 {name:'payload',bits:'[WIDTH-1:0]',waveType:'auto',direction:'input'},
 {name:'',bits:'1',direction:'input'},
 {name:'// unused',bits:'1',direction:'input'}],parameterSnapshot:{definitions:[{name:'WIDTH',value:'32'}],ranges:['','','[WIDTH-1:0]','','']}});
test('whole port clipboard exports resolved widths and explicit one-bit Data while keeping all native rows',()=>{
 const source=native(),text=Adapter.encode(source,(row,index)=>({width:index===2?32:1})),envelope=Codec.decode(text);
 assert.deepEqual(envelope.signals,[{name:'clk',bits:'1',waveType:'clock',group:'Control'},{name:'valid',bits:'1',waveType:'data',group:''},{name:'payload',bits:'32',waveType:'data',group:''}]);
 assert.deepEqual(Adapter.decode(text,'output',sanitize),source);assert.equal(source.items[2].bits,'[WIDTH-1:0]');
});
test('unresolved widths and spacer-only rows retain native same-site copy and parameter review data',()=>{
 const source=native();source.items=[source.items[2]];
 let text=Adapter.encode(source,()=>({error:'WIDTH missing'}));assert.equal(Codec.decode(text).signals[0].bits,'[WIDTH-1:0]');assert.deepEqual(Adapter.decode(text,'input',sanitize),source);
 source.items=[{name:'',bits:'1',direction:'output'}];text=Adapter.encode(source,()=>({width:1}));assert.equal(Codec.decode(text),null);assert.deepEqual(Adapter.decode(text,'input',sanitize),source);
});
test('foreign paste uses destination defaults and sanitizes before existing name allocation',()=>{
 const text=Codec.encode('WaveASecond',[{name:'tx data',bits:'8',waveType:'data'},{name:'tx_data',bits:'1',waveType:'signal'},{name:'data_p1',bits:'1',waveType:'data'},{name:'clk',bits:'1',waveType:'clock',group:'Clock'}],{direction:'inout',referenceClock:'clk'});
 const p=Adapter.decode(text,'input',sanitize),names=I.allocateNames(p.items.map(x=>x.name),['tx_data','data_p1']);
 assert.deepEqual(names,['tx_data_2','tx_data_3','data_p2','clk']);
 assert.ok(p.items.every(x=>x.direction==='input'&&!x.referenceClock));assert.deepEqual(p.items.map(x=>x.waveType),['data','signal','data','clock']);
 assert.deepEqual(p.renames,[{from:'tx data',to:'tx_data'}]);
 assert.ok(Adapter.decode(text,'output',sanitize).items.every(x=>x.direction==='output'));
});
test('malformed recognized clipboard is rejected before fallback; ordinary TSV is left for existing parser',()=>{
 assert.equal(Adapter.decode('req\t8\tIN','input',sanitize),null);
 assert.throws(()=>Adapter.decode('{"format":"SignalClipboard","version":1','input',sanitize),/incomplete/);
 const p=JSON.parse(Codec.encode('WaveASecond',[{name:'ok',bits:'1',waveType:'signal'}]));p.signals.push({name:'bad',bits:'8',waveType:'broken'});
 assert.throws(()=>Adapter.decode(JSON.stringify(p),'input',sanitize),/waveform type/);
});
function fixture(){return W.read(JSON.parse(fs.readFileSync(require.resolve('../examples/ExampleTop.wiu.json')))).project;}
function parsed(m){return {ports:m.ports.map(x=>({...x})),parameters:m.parameters,issues:[]};}
test('waveform metadata persists through module and Top diagrams, reload and undo without changing HDL or org',()=>{
 let p=fixture(),before=JSON.parse(JSON.stringify(p)),rtl=C.exportVerilog(p),org=K.org(p),files=K.files(p),issues=C.validate(p);
 for(const id of ['top',p.modules[0].id]){
  const d=W.makeDiagram(p,id),m=W.moduleOf(p,id),signals=[...d.signals.left,...d.signals.right];
  signals.forEach((s,index)=>s.waveType=index===0?'clock':'data');
  p=W.applyDiagram(p,id,d,parsed(m)).project;
  assert.equal(W.moduleOf(p,id).ports[0].waveType,'clock');
  assert.equal(W.makeDiagram(p,id).signals.left.concat(W.makeDiagram(p,id).signals.right)[0].waveType,'clock');
 }
 assert.equal(C.exportVerilog(p),rtl);assert.equal(K.org(p),org);assert.deepEqual(K.files(p),files);assert.deepEqual(C.validate(p),issues);
 assert.deepEqual(W.read(W.envelope(p)).project,p);
 const patch=H.changes(before,p);assert.deepEqual(H.apply(p,{patch},true),before);assert.deepEqual(H.apply(before,{patch},false),p);
});
test('port rename and width edits retain manual Data and Clock metadata',()=>{
 let p=fixture(),id=p.modules[0].id,d=W.makeDiagram(p,id),m=W.moduleOf(p,id),s=d.signals.left.concat(d.signals.right)[0];
 s.waveType='data';p=W.applyDiagram(p,id,d,parsed(m)).project;d=W.makeDiagram(p,id);m=W.moduleOf(p,id);s=d.signals.left.concat(d.signals.right)[0];const old=s.name;s.name=old+'_renamed';const next=parsed(m);next.ports.find(x=>x.name===old).name=s.name;
 p=W.applyDiagram(p,id,d,next).project;assert.equal(W.moduleOf(p,id).ports.find(x=>x.name===s.name).waveType,'data');
 const rows=[{id:'a',name:'valid',bits:'1',direction:'input',side:'left',waveType:'data'}];
 const plan=M.plan(rows,M.parse('32',{startField:'bits'}),{mode:'overwrite',startId:'a',targetIds:['a']});assert.equal(plan.rows[0].waveType,'data');
 assert.ok(M.plan(rows,M.parse('wrong',{startField:'waveType'}),{mode:'overwrite',startId:'a',targetIds:['a']}).errors.some(x=>x.field==='waveType'));
 assert.equal(Adapter.resolvedType({waveType:'data'},1),'data');assert.equal(Adapter.resolvedType({waveType:'auto'},1),'signal');assert.equal(Adapter.resolvedType({waveType:'auto'},8),'data');
});
function clipboardHarness(readText,writeText){
 const code=fs.readFileSync(require.resolve('../src/editor.js'),'utf8'),notices=[],pastes=[],finishes=[];
 const ctx={window:{WIUPortClipboard:Adapter},navigator:{clipboard:{readText,writeText}},side:'left',rowClipboard:{items:[{name:'stale'}],text:'stale'},svIdentifier:sanitize,normalizeClipboardRows:text=>[{name:text}],portEditNotice:x=>notices.push(x),portClipboardScope:()=>({project:'p',module:'m'}),capturePortClipboard:()=>({clipboardText:'current',operation:'cut'}),finishPortClipboard:x=>finishes.push(x),pasteRowItems:(items,options)=>pastes.push({items,options})};
 vm.createContext(ctx);vm.runInContext(code.slice(code.indexOf('function readPortClipboard('),code.indexOf('function portEditingApi(')),ctx);
 return {ctx,notices,pastes,finishes};
}
test('menu paste never falls back to stale local rows and failed cut keeps original ports',async()=>{
 const h=clipboardHarness(async()=>{throw Error('permission denied');},async()=>{throw Error('permission denied');});
 await h.ctx.pastePortSelection();assert.equal(h.pastes.length,0);assert.match(h.notices.at(-1),/Ctrl\/Cmd\+V/);
 await h.ctx.copyPortSelection(true);assert.equal(h.finishes.length,0);assert.match(h.notices.at(-1),/Ctrl\/Cmd\+X/);
});
test('menu and native event decoder use the latest system clipboard even with old local rows',async()=>{
 const text=Codec.encode('WaveASecond',[{name:'latest pin',bits:'1',waveType:'data'}]);const h=clipboardHarness(async()=>text,async()=>{});
 await h.ctx.pastePortSelection();assert.equal(h.pastes.length,1);assert.equal(h.pastes[0].items[0].name,'latest_pin');assert.equal(h.pastes[0].items[0].waveType,'data');
 const nativeOld=JSON.stringify({format:'WrapperSignalRows',items:[{name:'old'}],text:'old'});
 assert.equal(h.ctx.readPortClipboard(text,'right',nativeOld).items[0].name,'latest_pin');
});
function insertionHarness(){
 const code=fs.readFileSync(require.resolve('../src/editor.js'),'utf8'),state={signals:{left:[{id:'existing',name:'data_p1',bits:'1',waveType:'signal'}],right:[]},groups:{left:[],right:[]},conditions:{left:[],right:[]}},history=[];let serial=0;
 const ctx={window:{WIUPortClipboard:Adapter},state,side:'left',rowSelection:{left:new Set(),right:new Set()},rowClipboard:null,portEditAllowed:()=>true,portClipboardScope:()=>({project:'p',module:'m'}),finishActiveEditHistory(){},planPortNames(items){const out=I.allocateNames(items.map(x=>x.name),state.signals.left.concat(state.signals.right).map(x=>x.name));return {items:items.map((x,i)=>({...x,name:out[i]})),renames:[]};},commitPortCreation(change){const before=JSON.parse(JSON.stringify(state));change();history.push(H.changes(before,state));return true;},signal:(name,bits,direction,groupId,formatRuns,lineColor,textColor,comment,conditionId)=>({id:'new_'+(++serial),name,bits,direction,groupId,formatRuns,lineColor,textColor,comment,conditionId}),ensureGroupOnSide:(side,g)=>g.name,ensureConditionOnSide:()=>null,cleanBitsText:x=>x,normalizeFormatRuns:x=>x||[],colorValue:(x,f)=>x||f,cleanComment:x=>x||'',selectCreatedPorts(){},reportPortCreation(){}};
 vm.createContext(ctx);vm.runInContext(code.slice(code.indexOf('function pasteRowItems('),code.indexOf('function duplicateDeskSelection(')),ctx);return {ctx,state,history};
}
test('repeated foreign paste creates fresh rows using existing naming and a single undo transaction per batch',()=>{
 const h=insertionHarness(),before=JSON.parse(JSON.stringify(h.state)),text=Codec.encode('WaveASecond',[{name:'data_p1',bits:'1',waveType:'data',group:'Bus'},{name:'clock',bits:'1',waveType:'clock'}]),payload=Adapter.decode(text,'input',sanitize);
 assert.equal(h.ctx.pasteRowItems(payload.items,{payload}),true);const first=JSON.parse(JSON.stringify(h.state));
 assert.deepEqual(h.state.signals.left.map(x=>x.name),['data_p1','data_p2','clock']);assert.equal(h.state.signals.left[1].waveType,'data');assert.equal(h.state.signals.left[1].groupId,'Bus');
 assert.equal(h.ctx.pasteRowItems(payload.items,{payload}),true);
 assert.deepEqual(h.state.signals.left.map(x=>x.name),['data_p1','data_p2','clock','data_p3','clock_2']);
 assert.equal(new Set(h.state.signals.left.map(x=>x.id)).size,5);assert.equal(h.history.length,2);
 assert.deepEqual(H.apply(h.state,{patch:h.history[1]},true),first);assert.deepEqual(H.apply(first,{patch:h.history[0]},true),before);assert.deepEqual(H.apply(before,{patch:h.history[0]},false),first);
});
test('row checkboxes permit whole-signal copy while text fields retain normal editing clipboard',()=>{
 const code=fs.readFileSync(require.resolve('../src/editor.js'),'utf8'),ctx={window:{},$:()=>({hidden:true}),workspaceTextTarget:()=>false};
 vm.createContext(ctx);vm.runInContext(code.slice(code.indexOf('function portClipboardTextTarget('),code.indexOf('function capturePortClipboard(')),ctx);
 const target=(tagName,type)=>({closest:()=>({tagName,type})});
 for(const type of ['checkbox','radio','button','range'])assert.equal(ctx.portClipboardBlocked(target('INPUT',type)),false,type);
 for(const type of ['text','number','search'])assert.equal(ctx.portClipboardBlocked(target('INPUT',type)),true,type);
 assert.equal(ctx.portClipboardBlocked(target('TEXTAREA')),true);assert.equal(ctx.portClipboardBlocked(target('SELECT')),true);
});
test('RTL re-import and define reparse retain existing waveform metadata by port identity',()=>{
 const R=require('../src/import-review-r118'),P=require('../src/assembly-parser'),D=require('../src/assembly-defines');
 let p=fixture();const m=p.modules[0];m.ports[0].waveType='clock';m.ports[1].waveType='data';
 const source=p.rtlSources.find(x=>x.name===(m.sourceFilename||m.filename));
 const imported=R.mergeRtl(p,P.parseRtl(source.text,{filename:source.name}),m.name).project;
 assert.equal(imported.modules[0].ports[0].waveType,'clock');assert.equal(imported.modules[0].ports[1].waveType,'data');
 const cfg=D.normalize(p.defineConfig);cfg.rows.push({name:'WAVE_TEST',value:'1',enabled:true});
 const reparsed=W.normalize(D.plan(p,cfg,P).project,p);assert.equal(reparsed.modules[0].ports[0].waveType,'clock');
 assert.equal(reparsed.modules[0].ports[1].waveType,'data');
});
