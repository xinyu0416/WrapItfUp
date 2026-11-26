'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const W=require('../src/workbook'),B=require('../src/assembly-bundle'),K=require('../src/assembly-company'),N=require('../src/net-review-r132');
const src=fs.readFileSync(require.resolve('../src/assembly-ui'),'utf8');
const example=()=>W.read(JSON.parse(fs.readFileSync(require.resolve('../examples/ExampleTop.wiu.json')))).project;
const fragment=(start,end)=>src.slice(src.indexOf(start),src.indexOf(end,src.indexOf(start)));

test('module preview, copy and file download use the exact packaged physical source including inactive code and CRLF',async()=>{
  const p=example(),module=p.modules[0],path='learn_source.v',original=p.rtlSources.find(f=>f.name===path);
  const before=original.text.replace('output debug','output reg debug').replace('assign debug = enable;', 'always @* debug = enable;');
  original.text=("`ifdef FPGA\n// FPGA path\n`else\n// ASIC path\n`endif\n"+before).replace(/\r?\n/g,'\r\n');
  assert.notEqual(module.source,original.text);
  const files=K.files(p),full=files.find(f=>f.path===path).text;
  assert.equal(full,original.text);assert.match(full,/output reg debug/);
  for(const mode of ['asic','fpga'])assert.equal(B.files(p,{dualMode:true}).find(f=>f.path==='model/current/modes/'+mode+'/src/'+path).text,full);
  const spans=new Map(),sent=[],clip=[];
  function element(id){if(!spans.has(id))spans.set(id,{textContent:'',classList:{toggle(){}},setAttribute(){}});return spans.get(id);}
  const ctx={currentView:'diagram',project:p,activeModule:module.id,W,window:{WIUBundle:B,WIUBridge:{finish(){}}},
    $:element,download:(name,text)=>sent.push({name,text}),navigator:{clipboard:{writeText:async t=>clip.push(t)}},toast(){}};
  vm.createContext(ctx);vm.runInContext(fragment('  let childSourceView','  function renderWorkbook()')+'this.render=renderChildSource;',ctx);
  ctx.render();assert.equal(element('#r134-source-text').textContent,full);
  await element('#r134-file-copy').onclick();element('#r134-file-download').onclick();
  assert.deepEqual(clip,[full]);assert.deepEqual(sent,[{name:path,text:full}]);
  element('#r134-show-ports').onclick();assert.ok(element('#r134-source-actions').hidden);
  element('#r134-show-file').onclick();assert.equal(element('#r134-source-text').textContent,full);
  ctx.activeModule='top';ctx.render();assert.ok(element('#r134-source-tabs').hidden);assert.equal(element('#r134-source-text').textContent,'');
});

test('physical source lookup preserves file identity, other modules, and legacy source fallbacks',()=>{
  const p=example(),m=p.modules[0];m.sourceFilename='ip/Shared.v';
  m.originalSource='// original before elaboration\nmodule '+m.name+'(); endmodule\nmodule Sibling(); endmodule\n';
  assert.deepEqual(B.moduleFile(p,m),{name:'ip/Shared.v',text:m.originalSource});delete m.originalSource;
  assert.equal(B.moduleFile(p,m).text,m.source);delete m.source;assert.equal(B.moduleFile(p,m),null);
});

test('a selected wire shows complete driver and load routes before navigation plus fanout and zero-endpoint states',()=>{
  const p=require('./fixtures/dense-top.cjs')(3,2);
  for(const port of p.modules[0].ports)port.group='Packet / Payload';
  p.connections.find(c=>c.instance==='u2'&&c.port==='in_p0').expr='link_1_p0';
  const nav={kind:'loads',key:'u2::in_p0',origin:{},name:'link_1_p0',owner:p.workbook.projectId};
  const ctx={project:p,graphNetFocus:new Set(['link_1_p0']),window:{WIUNetReview:N},esc:String};
  vm.createContext(ctx);vm.runInContext(fragment('  let netNavigation=null','  function navigateEndpoint')+'this.nav=navigationTools;this.setNav=value=>netNavigation=value;',ctx);
  const html=ctx.nav();
  for(const name of ['u_cell_p0','out_p0','u_cell_p1','in_p0','Packet / Payload','Driver 驅動','Load 接收','2 個 · 首筆'])assert.ok(html.includes(name),name);
  assert.match(html,/net-nav-step/);ctx.setNav(nav);const second=ctx.nav();assert.match(second,/u_cell_p2/);assert.match(second,/2 \/ 2/);assert.match(second,/返回原視野/);
  ctx.graphNetFocus=new Set(['absent']);assert.equal((ctx.nav().match(/尚無端點/g)||[]).length,2);
});
test('completed routing removes the notice while in-progress and paused work have controls',()=>{
  const ctx={graphJob:{status:'running',message:'整理中'},esc:String};vm.createContext(ctx);
  vm.runInContext(fragment('  function backgroundStatus','  async function drawingTask')+'this.show=backgroundStatus;',ctx);
  assert.equal(ctx.show({previewOnly:false,boundedRouting:true}),'');assert.match(ctx.show({previewOnly:true}),/暫停整理/);
  ctx.graphJob.status='paused';assert.match(ctx.show({previewOnly:true}),/繼續整理/);
});

test('the Top graph folds routine status into Project while leaving unsaved input or a failed draft visible',()=>{
 const p=example(),state={draftStatus:'saved'},ctx={project:p,window:{WIUProjectHost:{saveState:()=>state}},
   tab:'graph',currentView:'assembly',activeModule:'top',railOpen:true,issues:()=>[],outputTarget:()=>({kind:'graph',name:p.top}),
   sessionKind:'user',VERSION:'r134',esc:String,headerName:()=>p.top,saveStatusText:()=>'草稿狀態',recentDownload:null};
 vm.createContext(ctx);
 vm.runInContext(fragment('  function globalHeader(){','  // The net focus')+'this.header=globalHeader;',ctx);
 let header=ctx.header();assert.doesNotMatch(header,/r121-context-strip/);assert.match(header,/recent-download/);assert.match(header,/r118-save-status/);
 state.draftStatus='failed';header=ctx.header();assert.match(header,/role="status" >草稿暫存失敗/);
 state.draftStatus='saved';state.pendingEdit={label:'Net'};assert.match(ctx.header(),/role="status" >欄位待套用/);
 ctx.tab='check';assert.match(ctx.header(),/r121-context-strip/);
});
