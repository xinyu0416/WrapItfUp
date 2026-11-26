'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/editor'),'utf8');
const rowCode=source.slice(source.indexOf('const PORT_ROW_METRICS='),source.indexOf('function richNameMeasurePx('));
function context(){const ctx=vm.createContext({});vm.runInContext(rowCode+'\nthis.metrics=PORT_ROW_METRICS;',ctx);return ctx;}

test('physical port rows reserve disjoint direction, Clock and name hit areas on both sides',()=>{
 const ctx=context(),m=ctx.metrics,edge=600;
 for(const side of ['left','right'])for(const width of [104,220,560]){
  const row=ctx.portRowGeometry(side,edge,width),sign=side==='left'?1:-1;
  const clockDistance=Math.abs(row.clockX-edge),clockNear=clockDistance-m.clockHitSize/2,clockFar=clockDistance+m.clockHitSize/2;
  assert.ok(clockNear-m.arrowHitRadius>=4,'Clock never swallows the block-edge direction hit target');
  assert.ok(Math.abs(row.nameX-edge)-clockFar>=6,'Clock hit and name field have their own gap');
  assert.equal(row.nameX,side==='left'?row.cardX:row.cardX+width,'name stays on the pin side of the card');
  const buttonStart=side==='left'?row.cardX-row.clockOffset:row.cardX+width+row.clockOffset-m.clockHitSize;
  assert.equal(buttonStart+m.clockHitSize/2,row.clockX,'DOM Clock center equals exported scene center');
  assert.equal(row.nameX-edge,sign*m.nameInset);
 }
});

test('increasing a name width grows inward without moving its Clock or outer text anchor',()=>{
 const ctx=context();
 for(const side of ['left','right']){
  const small=ctx.portRowGeometry(side,100,104),large=ctx.portRowGeometry(side,100,560);
  assert.equal(small.nameX,large.nameX);assert.equal(small.clockX,large.clockX);
  assert.equal(side==='left'?small.cardX:small.cardX+104,side==='left'?large.cardX:large.cardX+560);
 }
});

test('diagram HTML uses the shared Clock renderer and computed position for every port direction',()=>{
 const ctx=context();
 Object.assign(ctx,{window:{WIUDiagramScene:{clockIconSvg:active=>'<svg data-active="'+active+'"></svg>'}},rowSelection:{left:new Set(),right:new Set()},selectedRowsAll:()=>[],groupById:()=>null,signalIsCommented:()=>false,isSpacerSignal:()=>false,esc:String,textColorOf:()=> '#222',styledNameHtml:s=>s.name});
 const start=source.indexOf('function portClockButton('),end=source.indexOf('function inlineCommentHtml(');
 vm.runInContext(source.slice(start,end),ctx);
 for(const side of ['left','right'])for(const direction of ['input','output','inout']){
  const row={id:'p',name:'p',y:100,direction,waveType:'clock'},layout={blockX:100,blockWidth:800};
  const html=ctx.inlineCardHtml(row,side,0,180,layout);
  const geometry=ctx.portRowGeometry(side,side==='left'?100:900,180);
  assert.ok(html.includes('left:'+geometry.cardX+'px;'));
  assert.ok(html.includes('--clock-offset:'+geometry.clockOffset+'px'));
  assert.ok(html.includes('<svg data-active="true"></svg>'));
  assert.ok(html.includes('aria-pressed="true"'));
 }
 const inactive=ctx.portClockButton({name:'clockCandidate',waveType:'data'});
 assert.ok(inactive.includes('aria-pressed="false"'));assert.ok(inactive.includes('data-active="false"'));
});
