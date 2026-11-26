'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./fixtures/dense-top.cjs'), review=require('../src/net-review-r132'), diagram=require('../src/group-diagram');
const build=p=>diagram.model(p,review.index(p));
function grouped(){
  const p=fixture(3,4);
  for(const pin of p.modules[0].ports)pin.group=pin.name.endsWith('3')?'':'Bus';
  for(const net of p.nets)if(net.direction!=='wire')net.group='Pins';
  return p;
}
test('bundles distinct nets per instance pair with fanout and reverse traffic, omits ungrouped pins',()=>{
  const p=grouped();
  p.connections.find(c=>c.instance==='u0'&&c.port==='in_p1').expr='link_2_p1';
  p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0';
  const original=JSON.stringify(p),m=build(p);
  const pair=(one,two)=>m.edges.find(e=>[e.a.instance,e.b.instance].sort().join('|')===[one,two].sort().join('|'));
  const e=pair('u_cell_p0','u_cell_p1');assert.equal(e.nets.size,4);assert.ok(e.forward&&e.reverse);
  assert.ok(pair('u_cell_p0','u_cell_p2').nets.has('link_1_p0'));assert.ok(!m.edges.some(e=>[...e.nets].some(n=>n.endsWith('p3'))));
  const hide=new Set(m.groups.filter(g=>g.key!==e.a.key&&g.key!==e.b.key).map(g=>g.key));
  const selected=diagram.draw(m,hide);assert.equal(selected.count,1);assert.match(selected.svg,/×4/);assert.doesNotMatch(selected.svg,/u_cell_p2/);
  hide.add(e.a.key);assert.equal(diagram.draw(m,hide).svg,'');assert.equal(JSON.stringify(p),original);
});
test('slice overlap, straight aliases, logic assigns, and constants are distinguished',()=>{
  const p=grouped();const conn=(i,name)=>p.connections.find(c=>c.instance===i&&c.port===name);
  conn('u0','out_p0').expr='link_1_p0[3:0]';conn('u1','in_p0').expr='link_1_p0[7:4]';
  const net=(a,b)=>build(p).edges.some(e=>[e.a.instance,e.b.instance].includes('u_cell_p1')&&e.nets.has(a)&&(!b||[e.a.instance,e.b.instance].includes(b)));
  assert.equal(net('link_1_p0','u_cell_p0'),false);
  p.nets.push({id:'alias',name:'alias',direction:'wire',range:'[7:0]'});p.assigns.push({id:'a',target:'alias',expr:'link_1_p1'});conn('u1','in_p1').expr='alias';assert.ok(net('alias','u_cell_p0'));
  p.assigns[0].expr='~link_1_p1';assert.equal(net('alias','u_cell_p0'),false);conn('u1','in_p1').expr="8'h0";assert.equal(net('alias','u_cell_p0'),false);
});
test('a group on only one endpoint cannot create a line, and markup in labels is escaped',()=>{
  const p=fixture(1,1);p.nets[0].group='Source';assert.equal(build(p).edges.length,0);p.modules[0].ports[0].group='A<&B';const svg=diagram.draw(build(p)).svg;assert.match(svg,/A&lt;&amp;B/);assert.doesNotMatch(svg,/A<&B/);
});

test('an internal group loop uses distinct pins, and disjoint selections remain independent',()=>{
  const p=grouped();
  const bind=(instance,port,expr)=>{p.connections.find(c=>c.instance===instance&&c.port===port).expr=expr;};
  bind('u0','in_p0','link_1_p0');
  let m=build(p), loop=m.edges.find(e=>e.a===e.b);
  assert.ok(loop?.nets.has('link_1_p0'));assert.ok(loop.forward&&!loop.reverse);
  bind('u0','out_p1','{link_1_p1[7:6],link_1_p1[1:0]}');
  const included=()=>build(p).edges.some(e=>e.a!==e.b&&e.nets.has('link_1_p1'));
  bind('u1','in_p1','link_1_p1[6]');assert.ok(included());
  bind('u1','in_p1','link_1_p1[0]');assert.ok(included());
  for (const expr of ['link_1_p1[4]', 'link_1_p1[10]', '~link_1_p1']) {
    bind('u1','in_p1',expr);assert.equal(included(),false);
  }
});

test('the group panel filters and exports only the selected pairs without modifying the project',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require.resolve('../src/assembly-ui'),'utf8');
  const code=source.slice(source.indexOf('  let groupFilterOwner'),source.indexOf('  function workspace()'));
  const p=grouped(), before=JSON.stringify(p), picture={}, count={}, buttons=[{},{}], downloads=[];
  const ctx={project:p,shell:{},window:{WIUGroupDiagram:diagram},netReview:()=>review.index(p),
    topViewTabs:()=>'',esc:String,stash:()=>{},filename:()=>p.top,
    $:s=>s==='[data-group-picture]'?picture:count,$$:s=>s==='[data-group-visible]'?[]:buttons,
    download:(...args)=>downloads.push(args)};
  vm.createContext(ctx);
  vm.runInContext(code+'this.ui={renderGroupPanel,selectGroups,exportGroupPicture,groupPreview,choose:(...keys)=>{for(const key of keys)hiddenGroups.delete(key);refreshGroupPicture();}};',ctx);
  const {ui}=ctx;
  assert.match(ui.renderGroupPanel(),/data-group-visible=/);ui.selectGroups(false);
  assert.equal(count.textContent,'0 組連線');assert.ok(buttons.every(b=>b.disabled));
  await ui.exportGroupPicture('svg');assert.equal(downloads.length,0);
  const e=build(p).edges.find(e=>e.a.instance==='u_cell_p0'&&e.b.instance==='u_cell_p1');
  ui.choose(e.a.key,e.b.key);assert.equal(count.textContent,'1 組連線');assert.ok(buttons.every(b=>!b.disabled));
  await ui.exportGroupPicture('svg');
  assert.equal(downloads[0][1],picture.innerHTML);assert.match(picture.innerHTML,/×3/);assert.doesNotMatch(picture.innerHTML,/u_cell_p2/);
  assert.match(ui.renderGroupPanel(),/1 組連線/);
  assert.equal(JSON.stringify(p),before);
});

test('removing a group on a saved sheet takes precedence over an old import label',()=>{
  const p=fixture(1,1);
  p.modules[0].ports[0].group='Imported';p.nets[0].group='Source';
  const W=require('../src/workbook'),d=W.makeDiagram(p,'cell');
  p.workbook.diagrams.cell=d;
  assert.equal(build(p).edges.length,1);
  d.signals.left[0].groupId=null;
  assert.equal(build(p).edges.length,0);
});
