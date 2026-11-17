'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
const S=require('../src/graph-scene'),B=require('../src/graph-background-r129'),W=require('../src/workbook'),C=require('../src/assembly-core'),K=require('../src/assembly-company'),f=require('./fixtures/dense-top.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function workerFactory(){
 const code='const {parentPort}=require("node:worker_threads");globalThis.self=globalThis;self.postMessage=x=>parentPort.postMessage(x);'+B.dependencies.map(n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8')).join('\n;\n')+';('+B.workerMain.toString()+')();parentPort.on("message",data=>self.onmessage({data}));';
 const w=new Worker(code,{eval:true}),proxy={postMessage:x=>w.postMessage(x)};w.on('message',data=>proxy.onmessage?.({data}));w.on('error',e=>proxy.onerror?.(e));return {worker:proxy,dispose:()=>w.terminate()};
}
test('unused module creation reuses graph and frozen layout; used edits invalidate it',()=>{
 const p=f(2,2),scene=S.create(p),snap=S.capture(p);p.workbook.graphAutoR99=snap;S.prime(p,scene);
 const next=W.createModule(p,'Unused').project;
 assert.equal(S.sceneKey(p),S.sceneKey(next));assert.equal(S.create(next),scene);assert.deepEqual(S.validFreeze(next),snap);
 const altered=clone(next);altered.modules[0].ports[0].name='renamed';assert.notEqual(S.sceneKey(next),S.sceneKey(altered));assert.equal(S.validFreeze(altered),null);
 for(const alter of [q=>q.instances[0].parameters={WIDTH:'16'},q=>q.defineConfig={rows:[{name:'TEST',value:'1',enabled:true}]},q=>q.workbook.topStyle={monochrome:true},q=>q.workbook.graphPositions.u0.x++,q=>q.connections[0].expr='new_net',q=>q.workbook.diagrams.top={...q.workbook.diagrams.top,moduleName:'display'}]){const q=clone(next);alter(q);assert.notEqual(S.sceneKey(q),S.sceneKey(next));}
});
test('legacy frozen routes with unused module definitions remain readable',()=>{
 const p=W.createModule(f(2,2),'UnusedLegacy').project,scene=S.create(p),snap=S.snapshotScene(p,scene);
 snap.routeIdentity=S.routeIdentity(p,{includeUnused:true});snap.signature=S.topologySignature(p,{includeUnused:true});p.workbook.graphAutoR99=snap;
 assert.equal(S.validFreeze(p),snap);assert.deepEqual(S.create(p).edges.map(e=>e.points),scene.edges.map(e=>e.points));
});
test('1024-pin quick view retains every endpoint and net, without claiming geometry passed',()=>{
 const p=f(32,16),before=clone(p),scene=S.create(p,{fast:true});
 assert.equal(scene.previewOnly,true);assert.equal(Object.keys(scene.points).length,1056);assert.equal(scene.edges.length,528);
 assert.equal(S.capture(p),null);assert.deepEqual(p,before);assert.equal(C.exportVerilog(p),C.exportVerilog(before));
});
test('background worker returns checked geometry with the same electrical endpoints and outputs',async()=>{
 const p=f(4,4);const text='module PerfCell('+p.modules[0].ports.map(v=>v.direction+' [7:0] '+v.name).join(', ')+'); '+Array.from({length:4},(_,i)=>'assign out_p'+i+' = in_p'+i+';').join(' ')+' endmodule';p.rtlSources=[{name:'PerfCell.v',text}];p.modules[0].sourceFilename='PerfCell.v';p.modules[0].originalSource=text;const before=clone(p),preview=S.create(p,{fast:true}),runner=B.createRunner({makeWorker:workerFactory,timeout:10000});
 const phases=[],result=await runner.run({kind:'route',project:p},v=>phases.push(v.phase));
 assert.equal(result.scene.previewOnly,false);assert.deepEqual(result.scene.edges.map(e=>[e.source,e.target,e.net]),preview.edges.map(e=>[e.source,e.target,e.net]));
 assert.ok(phases.includes('分析交叉與文字位置'));assert.deepEqual(p,before);
 const stored=clone(p);stored.workbook.graphAutoR99=result.snapshot;S.prime(stored,result.scene);
 assert.equal(S.create(stored),result.scene);assert.equal(C.exportVerilog(stored),C.exportVerilog(before));assert.deepEqual(K.files(stored),K.files(before));
});
test('rapid edits cancel obsolete worker; late result cannot settle the latest job',async()=>{
 const handles=[],runner=B.createRunner({makeWorker(){const h={worker:{postMessage(){}},disposed:false,dispose(){this.disposed=true;}};handles.push(h);return {worker:h.worker,dispose:()=>{h.disposed=true;}};},timeout:1000});
 const old=runner.run({project:1}).catch(e=>e.code),fresh=runner.run({project:2});assert.equal(await old,'CANCELLED');assert.equal(handles[0].disposed,true);
 handles[0].worker.onmessage({data:{result:'old'}});handles[1].worker.onmessage({data:{result:'new'}});assert.equal(await fresh,'new');assert.equal(runner.running,false);
 const cancel=runner.run({project:3}).catch(e=>e.code);runner.cancel();assert.equal(await cancel,'CANCELLED');assert.equal(handles[2].disposed,true);
});
test('worker timeout and unsupported worker fail explicitly without synchronous routing fallback',async()=>{
 let disposed=false;const runner=B.createRunner({makeWorker:()=>({worker:{postMessage(){}},dispose(){disposed=true;}}),timeout:5});await assert.rejects(runner.run({}),e=>e.code==='TIMEOUT');assert.equal(disposed,true);
 const absent=B.createRunner({makeWorker(){throw Error('Worker unavailable');}});await assert.rejects(absent.run({}),/Worker unavailable/);
});
test('offline worker code reuses embedded dependencies, and source build uses observed local script URLs',()=>{
 const inline=B.workerSource({querySelector:s=>({textContent:'/*'+s+'*/',src:''})});assert.ok(!inline.includes('importScripts('));assert.ok(inline.includes('self.onmessage'));
 const dev=B.workerSource({querySelector:s=>({textContent:'',src:'http://localhost/src/'+s.match(/"(.*?)"/)[1]})});assert.ok(dev.includes('importScripts("http://localhost/src/graph-scene.js")'));
});
test('export diagnostics never certify or export cached quick geometry',()=>{
 const p=f(1,1);assert.equal(S.create(p,{fast:true}).previewOnly,true);const result=S.exportDrawing(p,{mode:'fixed'});assert.ok(result.vbs.length);assert.equal(S.peek(p).previewOnly,false);
});
test('saved drawing snapshot is attached to a copy and cannot invalidate scoped undo/redo',()=>{
 const H=require('../src/history'),p=f(2,2),before=clone(p);p.top='PerfTopEdited';const entry={patch:H.changes(before,p)};
 const scene=S.create(p,{full:true}),saved=S.withDrawingSnapshot(p);assert.notEqual(saved,p);assert.equal(p.workbook.graphAutoR99,undefined);assert.equal(Object.keys(saved.workbook.graphAutoR99.routes).length,scene.edges.length);
 assert.deepEqual(H.apply(p,entry,true),before);assert.deepEqual(H.apply(before,entry,false),p);
 assert.deepEqual(W.read(W.envelope(saved)).project,saved);
 const preview=f(3,3);S.create(preview,{fast:true});assert.equal(S.withDrawingSnapshot(preview),preview);assert.equal(preview.workbook.graphAutoR99,undefined);
});
test('dense interactive worker and immediate VBS export preserve every route and RTL binding',async()=>{
 const p=f(8,16),text='module PerfCell('+p.modules[0].ports.map(v=>v.direction+' [7:0] '+v.name).join(', ')+'); '+Array.from({length:16},(_,i)=>'assign out_p'+i+' = in_p'+i+';').join(' ')+' endmodule';p.rtlSources=[{name:'PerfCell.v',text}];p.modules[0].sourceFilename='PerfCell.v';p.modules[0].originalSource=text;const before=clone(p),preview=S.create(p,{fast:true}),runner=B.createRunner({makeWorker:workerFactory,timeout:30000});
 const result=await runner.run({kind:'route',project:p});assert.equal(result.scene.previewOnly,false);assert.equal(result.scene.boundedRouting,true);
 assert.deepEqual(result.scene.edges.map(e=>[e.source,e.target,e.net]),preview.edges.map(e=>[e.source,e.target,e.net]));
 assert.ok(result.scene.routeQualityR98?.summary?.parallelSpacing);assert.deepEqual(p,before);
 S.prime(p,result.scene);const saved=S.withDrawingSnapshot(p);assert.equal(C.exportVerilog(saved),C.exportVerilog(before));assert.deepEqual(K.files(saved),K.files(before));
 const output=await runner.run({kind:'export',project:before,options:{mode:'fixed'}});assert.ok(output.vbs.length>1000);assert.deepEqual(p,before);assert.equal(Object.keys(saved.workbook.graphAutoR99.routes).length,preview.edges.length);
});
test('explicit repair grows congested drawing space, preserves electrical data and supports one undo/redo',async()=>{
 const H=require('../src/history'),p=f(16,16),before=clone(p),runner=B.createRunner({makeWorker:workerFactory,timeout:30000});
 const r=await runner.run({kind:'layout',options:{kind:'repair'},project:p});assert.equal(r.unchanged,false);assert.ok(r.after.width>r.before.width||r.after.height>r.before.height);
 for(const k of Object.keys(p).filter(k=>k!=='workbook'))assert.deepEqual(r.project[k],p[k]);
 assert.ok(r.after.routeQualityR98.summary.parallelSpacing.count<r.before.routeQualityR98.summary.parallelSpacing.count);
 assert.ok(r.after.routeQualityR98.summary.finalInvalid<=r.before.routeQualityR98.summary.finalInvalid);
 assert.deepEqual(r.after.edges.map(e=>[e.source,e.target,e.net]),r.before.edges.map(e=>[e.source,e.target,e.net]));
 const entry={patch:H.changes(p,r.project)};assert.deepEqual(H.apply(r.project,entry,true),before);assert.deepEqual(H.apply(before,entry,false),r.project);assert.equal(C.exportVerilog(r.project),C.exportVerilog(p));assert.deepEqual(W.read(W.envelope(r.project)).project,r.project);
 const locked=clone(p);locked.workbook.graphAutoR99=S.snapshotScene(locked,r.before);locked.workbook.layoutLocks=['u0'];const lockResult=await runner.run({kind:'layout',options:{kind:'repair'},project:locked});const pick=s=>{const b=s.placed.find(b=>b.instance.id==='u0');return [b.x,b.y,b.width,b.height];};assert.deepEqual(pick(lockResult.before),pick(lockResult.after));
});
test('repair reports no improvement instead of pretending that a clean diagram changed',async()=>{
 const p=f(1,1),runner=B.createRunner({makeWorker:workerFactory,timeout:10000}),r=await runner.run({kind:'layout',options:{kind:'repair'},project:p});assert.equal(r.unchanged,true);assert.deepEqual(r.project,p);assert.match(r.note,/沒有找到/);
});
test('fine repair remains available and clean/manual geometry is not silently replaced',async()=>{
 const p=f(1,1),scene=S.create(p,{full:true});p.workbook.graphAutoR99=S.snapshotScene(p,scene);const first=Object.keys(p.workbook.graphAutoR99.routes)[0];p.workbook.graphAutoR99.routes[first].manual=true;
 const runner=B.createRunner({makeWorker:workerFactory,timeout:10000}),r=await runner.run({kind:'layout',options:{kind:'fine'},project:p});assert.equal(r.unchanged,true);assert.deepEqual(r.project,p);
});
