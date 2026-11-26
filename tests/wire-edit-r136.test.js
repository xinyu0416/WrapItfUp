'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const W=require('../src/workbook'),C=require('../src/assembly-core'),A=require('../src/assembly-actions'),K=require('../src/assembly-company'),
  G=require('../src/graph-scene'),L=require('../src/wire-labels'),H=require('../src/history'),N=require('../src/net-review-r132');
const example=()=>W.read(require('../examples/ExampleTop.wiu.json')).project;
test('branch annotations survive reload and signal rename; SVG and VBS include the note and HDL stays independent',()=>{
  const p=example(),rtl=C.exportVerilog(p),org=K.org(p),before=structuredClone(p);
  const e=G.create(p).edges.find(e=>e.net==='data_link'),net=p.nets.find(n=>n.name===e.net);
  const label={id:'annotation',routeKey:e.routeKey,netId:net.id,at:.45};
  L.set(p,label,'TX 資料');const withNote=W.read(W.envelope(p)).project;
  assert.equal(withNote.workbook.wireLabels[0].text,'TX 資料');assert.equal(C.exportVerilog(withNote),rtl);assert.equal(K.org(withNote),org);
  const g=G.create(withNote);assert.match(G.svg(g),/TX 資料/);for(const mode of ['fixed','native-routed'])assert.match(G.exportDrawing(withNote,{mode}).vbs,/TX 資料/);
  const at=L.position(e,.45);assert.ok(Math.abs(L.fraction(e,at)-.45)<.0001);
  const patch={patch:H.changes(before,p)};assert.deepEqual(H.apply(p,patch,true),before);assert.deepEqual(H.apply(before,patch,false),p);
  assert.throws(()=>A.renameNet(withNote,net.id,'clk'));A.renameNet(withNote,net.id,'tx_payload');
  const after=W.read(W.envelope(withNote)).project;assert.equal(after.workbook.wireLabels.length,1);
  assert.ok(G.create(after).items.some(i=>i.labelId==='annotation'&&i.net==='tx_payload'));
  assert.match(K.org(after),/tx_payload/);assert.doesNotMatch(C.exportVerilog(after),/\bdata_link\b/);
  const rx=after.connections.find(c=>c.instance===e.target.split('::')[0]&&c.port==='data');rx.expr='';
  assert.equal(W.normalize(after).workbook.wireLabels,undefined);L.set(withNote,label,'');assert.equal(withNote.workbook.wireLabels,undefined);
});
test('two loads can have separate branch names and multiple labels on a branch',()=>{
  const p=require('./fixtures/dense-top.cjs')(3,2);
  p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0';
  const edges=G.create(p,{fast:true}).edges.filter(e=>e.net==='link_1_p0');assert.equal(edges.length,2);
  for(const [i,e] of edges.entries())L.set(p,{id:'tag'+i,netId:e.net,routeKey:e.routeKey,at:.3},'Channel '+i);
  L.set(p,{id:'last',netId:edges[0].net,routeKey:edges[0].routeKey,at:.8},'Status');
  const q=W.read(W.envelope(p)).project,g=G.create(q,{fast:true});
  assert.equal(g.items.filter(i=>i.role==='segment-label').length,3);
  W.removeInstanceWithLayout(q,'u2');assert.equal(W.normalize(q).workbook.wireLabels.length,2);
});
test('slices of a concat driver reach both loads while driver navigation lists one port',()=>{
  const p=example(),sink=p.modules.find(m=>m.name==='learn_sink'),src=p.instances.find(i=>i.module==='learn_source'),rx=p.instances.find(i=>i.module===sink.name);
  sink.ports.find(n=>n.name==='data').range='[3:0]';p.connections.find(c=>c.instance===src.id&&c.port==='data').expr='{data_link[7:4],data_link[3:0]}';
  p.connections.find(c=>c.instance===rx.id&&c.port==='data').expr='data_link[7:4]';
  const review=N.index(p);assert.equal(review.peers(rx.id+'::data')[0].key,src.id+'::data');
  const pins=review.net('data_link').drivers;assert.equal(pins.length,1);assert.deepEqual(pins[0].bitRanges,[[4,7],[0,3]]);
});
test('package and website report an orphan Empty setting and a layout-only edit retains an active org comment',()=>{
  const p=example(),original=K.org(p).replace('// realtek input clk','// realtek input clk\n// realtek comment clk.//clock purpose');
  const parsed=require('../src/assembly-parser').importOrg(original,p.modules,{filename:'example_top.v.org'}).project;
  const q=W.normalize({...p,nets:parsed.nets}),d=W.makeDiagram(q,'top');d.layout.blockWidth+=20;
  const ports=W.moduleOf(q,'top').ports.map(({name,direction,range,signed,group,comment})=>({name,direction,range,signed,group,comment}));
  const next=W.applyDiagram(q,'top',d,{ports,parameters:q.parameters,issues:[]}).project;
  assert.match(K.org(W.read(W.envelope(next)).project),/\/\/ realtek comment clk\.\/\/clock purpose/);
  p.bundleConfig={...p.bundleConfig,outputTies:[{port:'removed_pin',expr:"1'b0"}]};
  assert.deepEqual(K.inspectPackage(p).validation.errors,K.emptyValidation(p).errors);assert.ok(K.inspectPackage(p).validation.errors.some(e=>e.port==='removed_pin'));
});
test('a crowded repair separates a Top alias, survives reload and preserves electrical bindings',()=>{
  const channels=require('../src/channel-layout'),p=require('./fixtures/dense-top.cjs')(4,14);
  const input=p.nets.find(n=>n.direction==='input'),alias={id:'alias_id',name:'clock_copy',direction:'output',range:input.range};
  p.nets.push(alias);p.assigns.push({id:'copy',target:alias.name,expr:input.name});
  const design=W.normalize(p),b=G.create(design,{fast:true}),r=channels.candidate(design,b,G);
  function clean(scene){assert.equal(scene.routeQualityR98.summary.finalInvalid,0);assert.equal(scene.routeQualityR98.summary.parallelSpacing.count,0);assert.equal(scene.crossingSummary.overlaps,0);assert.equal(scene.crossingSummary.unresolved,0);}
  clean(r.scene);assert.ok(r.scene.crossingSummary.sharedSourceLeads>0);const loaded=W.read(W.envelope(r.project)).project;
  clean(G.create(loaded,{full:true}));assert.deepEqual(loaded.connections,p.connections);assert.deepEqual(loaded.assigns,p.assigns);
  assert.deepEqual(G.layoutThumbnail(r.scene).items.filter(i=>i.role==='preview-wire').length,r.scene.edges.length);
  const locked=structuredClone(p);locked.workbook.layoutLocks=[p.instances[0].id];assert.equal(channels.candidate(locked,b,G),null);
});
