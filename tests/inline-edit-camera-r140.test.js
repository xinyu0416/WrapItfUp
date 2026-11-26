'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editing=require('../src/canvas-editing');
const source=fs.readFileSync(require.resolve('../src/editor.js'),'utf8');
const scopeCode=source.slice(source.indexOf('function canvasEditScope(){'),source.indexOf('function closeCanvasEditor('));
const viewport={left:100,top:100,width:800,height:600};
const field={left:650,right:750,top:350,bottom:370};
function harness(){
 const state=Object.freeze({layout:Object.freeze({gap:31,blockWidth:500}),signals:Object.freeze([{id:'p',name:'data'}])});
 const original={scale:.58,x:-40,y:15,fit:true},calls={transform:0,commit:0,notice:[]};let module='m',valid=true;
 const env=vm.createContext({canvasEditView:null,canvasEdit:null,previewView:{...original},state,
  window:{WIUCanvasEditing:editing,dispatchEvent(){}},CustomEvent:class{},
  previewCanvas:{contains:()=>true,getBoundingClientRect:()=>viewport},
  portClipboardScope:()=>({project:'p',module}),applyPreviewTransform(){calls.transform++;},
  applyCanvasEditor(){calls.commit++;return valid;},portEditNotice:m=>calls.notice.push(m)
 });vm.runInContext(scopeCode,env);
 const input={getBoundingClientRect:()=>field};
 return {env,original,calls,state,focus(){env.focusReadableCanvasField(input);},setModule(v){module=v;},setValid(v){valid=v;}};
}
function installWorkbookRefresh(h){
 const env=h.env,bridge={},fields={signalSearch:{value:'data'},signalSideFilter:{value:'right'},signalDirFilter:{value:'output'}},scroll={scrollTop:75};
 Object.assign(env,{WIUBridge:bridge,loading:false,side:'right',rowSelection:{left:new Set(),right:new Set(['p'])},activeGroupId:{left:null,right:null},activeConditionId:{left:null,right:null},selectionAnchor:{left:null,right:'p'},multiSelectMode:false,
  history:{undo:[],redo:[],tx:null},normalizeProjectState:value=>value,closeCanvasEditor(){env.canvasEdit=null;},closeFindPanel(){},resetDiagramInteraction(){},clearAllSelections(){},render(){},
  currentView:'diagram',diagramGuard:false,project:{},activeModule:'m',W:{makeDiagram:()=>h.state},renderWorkbook(){},
  grid:{mode:'diagram'},$:selector=>fields[selector.slice(1)],panel:{querySelector:()=>scroll},setMode(mode){env.grid.mode=mode;}
 });env.window.WIUBridge=bridge;
 for(const name of ['loadSheet','uiSnapshot','restoreUi']){
  const code=source.split('\n').find(line=>line.trimStart().startsWith('WIUBridge.'+name+'='));assert.ok(code,name);vm.runInContext(code,env);
 }
 // Install the final signal-table decorators too. The refresh option must pass
 // through the same wrapper chain as the browser, rather than a bare base API.
 const decorators=[...source.matchAll(/const oldSnapshot=WIUBridge\.uiSnapshot,[^\n]*\n\s*WIUBridge\.uiSnapshot=[^\n]*\n\s*WIUBridge\.restoreUi=[^\n]*/g)];
 assert.ok(decorators.length,'signal-table UI snapshot and restoration decorators');
 for(const [code] of decorators)vm.runInContext('{'+code+'}',env);
 const assembly=fs.readFileSync(require.resolve('../src/assembly-ui.js'),'utf8');
 const refresh=assembly.split('\n').find(line=>line.trimStart().startsWith('function refreshSheet(){'));assert.ok(refresh);vm.runInContext(refresh,env);
 env.applyCanvasEditor=()=>{h.calls.commit++;env.refreshSheet();return true;};
 return bridge;
}
test('readable edit camera centers the same field at100% without modifying the incoming view',()=>{
 const view={scale:.58,x:-40,y:15,fit:true},before=JSON.stringify(view),next=editing.readableFieldView(view,viewport,field);
 assert.equal(next.scale,1);assert.equal(JSON.stringify(view),before);
 const worldX=((field.left+field.right)/2-viewport.left-view.x)/view.scale;
 const worldY=((field.top+field.bottom)/2-viewport.top-view.y)/view.scale;
 assert.equal(next.x+worldX*next.scale,viewport.width/2);
 assert.equal(next.y+worldY*next.scale,viewport.height/2);
 assert.equal(editing.readableFieldView({scale:1,x:0,y:0},viewport,field),null);
});
test('focus and return affect camera only, and preserve the first origin across consecutive edits',()=>{
 const h=harness(),state=JSON.stringify(h.state);h.focus();assert.equal(h.env.previewView.scale,1);
 const first=JSON.stringify(h.env.canvasEditView.view);h.env.focusReadableCanvasField({getBoundingClientRect:()=>({...field,top:950,bottom:970})});
 assert.equal(JSON.stringify(h.env.canvasEditView.view),first);assert.equal(h.calls.commit,0);
 assert.equal(h.env.returnCanvasEditView(),true);assert.equal(JSON.stringify(h.env.previewView),JSON.stringify(h.original));
 assert.equal(h.env.canvasEditView,null);assert.equal(JSON.stringify(h.state),state);
});
test('manual view changes and module changes cannot be overwritten by an old edit origin',()=>{
 const h=harness();h.focus();h.env.discardCanvasEditView();h.env.previewView.scale=1.2;
 assert.equal(h.env.returnCanvasEditView(),false);assert.equal(h.env.previewView.scale,1.2);
 h.env.previewView.scale=.5;h.focus();h.setModule('other');
 assert.equal(h.env.returnCanvasEditView(),false);assert.equal(h.env.canvasEditView,null);assert.equal(h.env.previewView.scale,1);
});
test('return view preserves an invalid active draft until the user fixes or cancels it',()=>{
 const h=harness();h.focus();h.env.canvasEdit={input:{value:'bad name'}};h.setValid(false);
 assert.equal(h.env.returnCanvasEditView(),false);assert.ok(h.env.canvasEditView);assert.equal(h.env.previewView.scale,1);
 assert.equal(h.env.canvasEdit.input.value,'bad name');assert.equal(h.calls.notice.length,1);
 h.env.canvasEdit=null;assert.equal(h.env.returnCanvasEditView(),true);assert.equal(h.env.previewView.scale,.58);
});
test('a committed edit preserves its origin through the actual workbook refresh, loadSheet and restoreUi callbacks',()=>{
 const h=harness(),bridge=installWorkbookRefresh(h);h.focus();h.env.canvasEdit={input:{value:'renamed_data'}};
 h.env.applyCanvasEditor();assert.equal(h.env.previewView.scale,1);assert.equal(h.env.canvasEditView.view.scale,.58);
 assert.equal(bridge.uiSnapshot().editView.scope,JSON.stringify(['p','m']));assert.equal(h.calls.commit,1);
 assert.equal(bridge.uiSnapshot().signalTable.search,'data');assert.equal(bridge.uiSnapshot().signalTable.scroll,75);
 assert.equal(h.env.returnCanvasEditView(),true);assert.equal(JSON.stringify(h.env.previewView),JSON.stringify(h.original));
});
test('return while committing survives synchronous sheet replacement and refuses a change to another module',()=>{
 const h=harness();installWorkbookRefresh(h);h.focus();h.env.canvasEdit={input:{value:'renamed_data'}};
 assert.equal(h.env.returnCanvasEditView(),true);assert.equal(h.calls.commit,1);assert.equal(h.env.canvasEditView,null);assert.equal(h.env.previewView.scale,.58);
 h.focus();h.env.canvasEdit={input:{value:'next'}};h.env.applyCanvasEditor=()=>{h.env.discardCanvasEditView();h.setModule('another');return true;};
 assert.equal(h.env.returnCanvasEditView(),false);assert.equal(h.env.previewView.scale,1);
});
test('ordinary module UI restoration discards old edit origins; only a scoped refresh may restore them',()=>{
 const h=harness(),bridge=installWorkbookRefresh(h);h.focus();const ui=bridge.uiSnapshot();
 bridge.loadSheet(h.state);bridge.restoreUi(ui);assert.equal(h.env.canvasEditView,null);
 bridge.restoreUi(ui,{preserveEditView:true});assert.equal(h.env.canvasEditView.view.scale,.58);
 h.setModule('another');bridge.restoreUi(ui,{preserveEditView:true});assert.equal(h.env.canvasEditView,null);
});
