'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 const events={},calls={undo:0,redo:0};const doc={querySelectorAll:()=>[],activeElement:null};
 const win={addEventListener:(type,fn)=>(events[type]||=[]).push(fn),WIUProjectHost:{undo:()=>calls.undo++,redo:()=>calls.redo++}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/text-editing.js'),'utf8'),{window:win,document:doc,WIUCanvasEditing:require('../src/canvas-editing'),Event:class{constructor(type){this.type=type;}}});
 const input={value:'req_p1',defaultValue:'req_p1',selectionStart:0,selectionEnd:6,readOnly:false,disabled:false,isConnected:true,matches:()=>true,closest:()=>null,focus(){doc.activeElement=this;},blur(){doc.activeElement=null;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},dispatchEvent(e){emit(e.type,{target:this});}};
 function emit(type,props={}){for(const fn of events[type]||[])fn({preventDefault(){},stopImmediatePropagation(){},...props});}
 function key(name,shiftKey=false){emit('keydown',{target:input,key:name,ctrlKey:true,shiftKey});}
 emit('focusin',{target:input});return {input,emit,key,calls,win};
}
test('dirty text undoes locally, then repeated clean-field shortcuts reach project history',()=>{
 const h=harness();h.input.value='req_p12';h.emit('input',{target:h.input});h.key('z');assert.equal(h.input.value,'req_p1');assert.equal(h.calls.undo,0);h.key('z');h.key('z');h.key('z');assert.equal(h.calls.undo,3);
});
test('local text redo stays local and a committed field permits both project redo shortcuts',()=>{
 const h=harness();h.input.value='req_p12';h.emit('input',{target:h.input});h.key('z');h.key('y');assert.equal(h.input.value,'req_p12');assert.equal(h.calls.redo,0);
 h.input.defaultValue=h.input.value;h.win.WIUTextEditing.reset(h.input);h.key('y');h.key('z',true);assert.equal(h.calls.redo,2);
});
test('pointer redraws wait through click, coalesce and then allow ordinary keyboard repaint',()=>{
 const events={},timers=new Map();let tick=0;const env={document:{activeElement:null,querySelectorAll:()=>[]},addEventListener:(type,fn)=>events[type]=fn,setTimeout:fn=>{timers.set(++tick,fn);return tick;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/interaction-r128.js'),'utf8'),env);const painted=[],I=env.WIUInteractionR128;
 events.pointerdown();I.paint('table',()=>painted.push('old'));events.pointerup();I.paint('table',()=>painted.push('new'));I.paint('focus',()=>painted.push('focus'));assert.deepEqual(painted,[]);for(const fn of timers.values())fn();assert.deepEqual(painted,['new','focus']);I.paint('table',()=>painted.push('keyboard'));assert.equal(painted.at(-1),'keyboard');
});
