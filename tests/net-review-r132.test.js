'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../src/assembly-core'),W=require('../src/workbook'),N=require('../src/net-review-r132'),S=require('../src/graph-scene'),SP=require('../src/routing-spacing-r98'),Q=require('../src/routing-quality-r98'),H=require('../src/history'),F=require('../src/workflow-r118'),L=require('../src/graph-layout'),fixture=require('./fixtures/dense-top.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
test('review resolves Top directions, groups and every fanout independently of rendered DOM',()=>{
 const p=fixture(3,2);p.modules[0].ports.forEach(p=>p.group='data');p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0';const before=clone(p),n=N.index(p);
 assert.deepEqual(n.net('link_0_p0').drivers.map(e=>e.key),['top::link_0_p0']);assert.deepEqual(n.net('link_3_p0').loads.map(e=>e.key),['top::link_3_p0']);
 assert.deepEqual(n.peers('u0::out_p0').map(e=>e.key),['u1::in_p0','u2::in_p0']);assert.equal(n.byKey.get('u0::out_p0').group,'data');assert.deepEqual(p,before);
 assert.match(N.endpointHTML({...n.ends[0],pin:'<unsafe>'}),/&lt;unsafe&gt;/);
});
test('slices, assign intermediates, NC and bidirectional endpoints remain distinct',()=>{
 const p=fixture(3,2);p.modules[0].ports.find(p=>p.name==='in_p0').range='[3:0]';p.connections.find(c=>c.instance==='u1'&&c.port==='in_p0').expr='link_1_p0[3:0]';p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0[7:4]';p.connections.find(c=>c.instance==='u0'&&c.port==='out_p0').expr='link_1_p0[3:0]';
 let n=N.index(p);assert.deepEqual(N.refs('link_1_p0[3:0]',p),[{name:'link_1_p0',range:[0,3]}]);assert.deepEqual(n.peers('u0::out_p0').map(e=>e.key),['u1::in_p0']);
 p.assigns=[{id:'a',target:'link_2_p1',expr:'link_1_p1 ^ 8\'hff'}];n=N.index(p);assert.ok(n.net('link_2_p1').drivers.some(e=>e.key==='assign::a'));assert.ok(n.net('link_1_p1').loads.some(e=>e.key==='assign::a'));assert.ok(!n.peers('u0::out_p1').some(e=>e.key==='u2::in_p1'));
 p.modules[0].ports.find(p=>p.name==='in_p0').direction='inout';p.nets[0].direction='inout';n=N.index(p);assert.equal(n.net(p.nets[0].name).bidirectional.length,2);
 assert.match(N.destinationHTML({expr:''},[]),/刻意不接 NC/);assert.match(N.destinationHTML({expr:null},[]),/尚未設定/);
});
test('review table retains edits and shows both complete endpoint paths in requested column order',()=>{
 const p=fixture(2,2),source=fs.readFileSync(require.resolve('../src/assembly-ui'),'utf8'),part=source.slice(source.indexOf('  function renderConnectionTable(rows){'),source.indexOf('  function topContext()'));
 const ctx={project:p,graphTableOrigin:null,instanceFilter:'',onlyUnbound:false,filter:'',selected:new Set(),netReview:()=>N.index(p),window:{WIUNetReview:N},connectionScopeSummary:()=>'',esc:x=>String(x??''),badge:x=>x,pinRange:r=>r.port.range,pinStatus:()=>'<b>已設定</b>',HF:require('../src/history-flow-r118'),emptyStart:()=>''};vm.createContext(ctx);vm.runInContext(part+';this.renderTable=renderConnectionTable;',ctx);
 const rows=require('../src/assembly-actions').pinRows(p),html=ctx.renderTable(rows);for(const title of ['Instance / Group / Pin','方向','位寬','連到 Instance / Group / Pin','狀態','操作'])assert.ok(html.includes('<th>'+title+'</th>'),title);
 assert.equal((html.match(/data-row-key=/g)||[]).length,8);assert.equal((html.match(/data-connection=/g)||[]).length,8);assert.equal((html.match(/data-binding-mode=/g)||[]).length,8);assert.match(html,/r132-destinations/);assert.match(html,/u_cell_p1/);assert.match(html,/in_p0/);
 ctx.filter='u_cell_p1';const filtered=ctx.renderTable(rows);assert.ok(filtered.includes('data-row-key="u0::out_p0"'),'search matches destination instance');
});
test('endpoint navigation restores the original view without project or history mutations',()=>{
 const source=fs.readFileSync(require.resolve('../src/assembly-ui'),'utf8'),part=source.slice(source.indexOf('  let netNavigation=null'),source.indexOf('  function recomputeGraphNetFocus()'));
 const p=fixture(3,1);p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0';const before=clone(p),sc={clientWidth:900,clientHeight:500,scrollLeft:2,scrollTop:3},pan={x:23,y:41};let paints=0;
 const ctx={project:p,window:{WIUNetReview:N,WIUTopScene:{peek:()=>({points:{'u1::in_p0':{x:4000,y:3000},'u2::in_p0':{x:6000,y:7000}}})}},graphNetFocus:new Set(['link_1_p0']),graphZoom:.25,graphPan:{...pan},shell:{},$:()=>sc,dialog:{close(){}},applyGraphZoom(){paints++},applyGraphNetFocus(){},openDialog(){},toast:m=>{throw Error(m)},esc:x=>String(x??'')};vm.createContext(ctx);vm.runInContext(part+';this.nav={chooseEndpoint,navigateEndpoint,stepLoad,returnNetView,navigationTools};',ctx);
 ctx.nav.stepLoad(1);assert.equal(ctx.graphZoom,.85);assert.ok(ctx.nav.navigationTools().includes('Load 1 / 2'));ctx.nav.stepLoad(1);assert.ok(ctx.nav.navigationTools().includes('Load 2 / 2'));ctx.nav.stepLoad(1);assert.ok(ctx.nav.navigationTools().includes('Load 1 / 2'));ctx.nav.returnNetView();assert.equal(ctx.graphZoom,.25);assert.equal(ctx.graphPan.x,pan.x);assert.equal(ctx.graphPan.y,pan.y);assert.equal(sc.scrollLeft,2);assert.equal(sc.scrollTop,3);assert.deepEqual(p,before);assert.equal(paints,4);
});
test('outer Top lanes enforce spacing and physical frame bounds including after snapshot reload',()=>{
 const p=fixture(2,12),before=clone(p);globalThis.WIUInteractiveRouting=true;let s;try{s=S.create(p,{full:true});}finally{delete globalThis.WIUInteractiveRouting;}
 const wall=s.items.find(x=>x.role==='top-boundary');assert.equal(s.topBoundary.bottom,wall.y+wall.height);
 const lanes=s.topBoundary.lanes,left=s.topBoundary.left+64+lanes.left*lanes.pitch,right=s.topBoundary.right-64-lanes.right*lanes.pitch,tracks=[];
 for(const e of s.edges)for(const [x,y,xx,yy] of e.points){assert.ok(Math.max(y,yy)<=s.topBoundary.bottom);if(x===xx&&(x<left||x>right))tracks.push({a:{x,y},b:{x:xx,y:yy},...e});}
 assert.ok(tracks.length>8);for(let i=0;i<tracks.length;i++)for(let j=i+1;j<tracks.length;j++)assert.equal(SP.violation(tracks[i],tracks[j],tracks[i],tracks[j],s),null);
 const edge=s.edges.find(e=>e.source.startsWith('top::')||e.target.startsWith('top::')),points=Q.ptsOf(edge).map(p=>({...p}));points.splice(1,0,{x:s.topBoundary.right+10,y:s.topBoundary.bottom+100});assert.equal(Q.valid(points,edge,{...s,canvasBounds:{...s.canvasBounds,height:s.height+9999}},Q.contextFor(s)),false);
 const saved=clone(p);saved.workbook.graphAutoR99=S.snapshotScene(saved,s);const restored=W.read(W.envelope(saved)).project;assert.deepEqual(S.create(restored,{full:true}).topBoundary.lanes,lanes);assert.equal(C.exportVerilog(saved),C.exportVerilog(before));assert.deepEqual(p,before);
});
test('fine repair deadline is scoped, preserves electrical data, and remains one undoable transaction',()=>{
 const p=fixture(2,3),before=clone(p);globalThis.WIURoutingDeadline=123;const plan=F.layoutPlan(p,'fine',S,L);assert.equal(globalThis.WIURoutingDeadline,123);delete globalThis.WIURoutingDeadline;
 for(const k of Object.keys(p).filter(k=>k!=='workbook'))assert.deepEqual(plan.project[k],before[k]);const change={patch:H.changes(before,plan.project)};assert.deepEqual(H.apply(plan.project,change,true),before);assert.deepEqual(H.apply(before,change,false),plan.project);
});
