'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const K=require('../src/assembly-company'),C=require('../src/assembly-core'),W=require('../src/workbook'),P=require('../src/assembly-parser'),B=require('../src/assembly-bundle');
const fixture=()=>W.read(JSON.parse(fs.readFileSync(require.resolve('../examples/ExampleTop.wiu.json')))).project;
const getOrg=p=>K.files(p).find(f=>f.path.endsWith('.v.org')).text;
const headings=['gen_top constraint','Module instantiate','Input/output/inout','Wire & signal connection','Special case'];
const at=(s,title)=>s.indexOf('// '+title+'\n');
test('package, individual org and both per-mode exports keep Top I/O together and bind a wire adjacent to its endpoints',()=>{
  const p=fixture(),before=JSON.stringify(p),s=getOrg(p);
  assert.equal(K.org(p),s);assert.equal(getOrg(W.read(W.envelope(p)).project),s);
  for(const item of B.files(p,{dualMode:true}).filter(f=>f.path.endsWith('.v.org')))assert.equal(item.text,s);
  const offsets=headings.map(h=>at(s,h));assert.ok(offsets.every((x,i)=>x>=0&&(!i||x>offsets[i-1])));
  assert.deepEqual([...s.slice(offsets[2],offsets[3]).matchAll(/^\/\/ realtek (\w+) (\w+)/gm)].map(m=>m.slice(1)),[['input','clk'],['output','done']]);
  assert.match(s,/\/\/ realtek wire data_link\n\/\/ realtek conn data_link learn_source.data learn_sink.data/);
  assert.match(s,/\/\/ realtek conn "" learn_source.debug/);
  assert.equal(JSON.stringify(p),before);
});
test('nested interface groups, unused headings, remarks and inert FPGA placeholder round-trip without duplicate sections',()=>{
  const p=fixture();let text=getOrg(p).replace('// realtek input clk','//==== Global ====//\n  //==== Clock ====//\n// realtek input clk\n// Note clk | note #3').replace('// realtek output done','  //==== Future ====//\n//==== Status ====//\n// realtek output done\n//==== FPGA ====//\n`ifdef FPGA\n`endif');
  const q=P.importOrg(text,p.modules).project;
  assert.equal(q.nets.find(n=>n.name==='clk').group,'Global / Clock');assert.equal(q.nets.find(n=>n.name==='clk').comment,'note #3');
  assert.equal(q.advanced,'');assert.deepEqual(q.importUnresolved,[]);assert.equal(K.org(q),text);
  const legacy={...q,advanced:P.importOrg(text,p.modules,{recoverSavedLayout:true}).previousAdvanced};delete legacy.orgLayout;
  for(const n of legacy.nets)n.group='';
  assert.equal(K.org(W.read(W.envelope(legacy)).project),text);
  legacy.advanced+='\n// a later user edit';
  assert.match(W.read(W.envelope(legacy)).project.advanced,/later user edit/);
});
test('nonempty conditional directives remain guarded and cannot become unconditional ports',()=>{
  const p=fixture(),s=K.org(p).replace('// realtek input clk','`ifdef FEATURE\n// realtek input alternate\n`endif\n// realtek input clk');
  const q=P.importOrg(s,p.modules).project;assert.equal(q.nets.some(n=>n.name==='alternate'),false);assert.match(q.advanced,/`ifdef FEATURE\n\/\/ realtek input alternate\n`endif/);assert.throws(()=>K.org(q));
});
test('an inferred bit-zero vector retains the saved scalar; wider stale declarations remain blocking',()=>{
  const p=fixture();for(const m of p.modules)for(const port of m.ports)if(port.name==='clk')port.range='[0:0]';
  const text=K.org(p),parse=t=>P.importOrg(t,p.modules).project;
  assert.equal(parse(text).nets.find(n=>n.name==='clk').range,'');
  assert.deepEqual(parse(text).importUnresolved,[]);
  assert.ok(parse(text.replace('input clk;','input [2:0] clk;')).importUnresolved.some(i=>i.code==='GENERATED_DECLARATION_STALE'));
});
test('Top body parameters stay outside regeneration regions; instance overrides and assign directives stay in their sections',()=>{
  const p=fixture();p.parameters=[{name:'COUNT',value:'8'},{name:'END_BIT',value:'COUNT-1',local:true}];
  p.nets.push({id:'copy',name:'copy_out',direction:'output'});p.assigns.push({id:'a',target:'copy_out',expr:'done'});
  const s=getOrg(p);const start=at(s,'Special case');assert.ok(s.indexOf('// realtek assign copy_out = done;',start)>start);
  let generated=false;for(const line of s.split('\n')){if(line==='// realtek begin')generated=true;if(line==='// realtek end')generated=false;if(/^(?:localparam|parameter) /.test(line))assert.equal(generated,false);}
  assert.match(s,/parameter COUNT = 8;\nlocalparam END_BIT = COUNT-1;/);
});
test('a same-name internal load on a Top output keeps an explicit connection',()=>{
  const p=C.demoProject();p.nets.find(n=>n.name==='link_up').name='status';
  p.connections.find(c=>c.port==='status').expr='status';
  p.modules[0].ports.push({name:'status',direction:'input',range:''});
  p.connections.push({id:'read_status',instance:'i_mac',port:'status',expr:'status'});
  const s=K.org(p,{allowErrors:true});assert.match(s,/\/\/ realtek conn status mac_pair.status/);
  assert.doesNotMatch(s,/\/\/ realtek conn status[^\n]*phy_link.status/);
  assert.ok(!P.importOrg(s,p.modules).project.importUnresolved.some(i=>i.code==='IMPLICIT_TOP_INTERFACE_CONFLICT'));
});
