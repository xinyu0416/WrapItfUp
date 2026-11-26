'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/editor.js'),'utf8');
function section(start,end){const at=source.indexOf(start);assert.ok(at>=0,start);const to=source.indexOf(end,at);assert.ok(to>at,end);return source.slice(at,to);}
function harness(){
 const handlers=[],calls={commits:[],next:[],moves:[],focus:0,resets:0};
 const input={value:'data',defaultValue:'data',canvasRef:{kind:'name',which:'right',id:'p'},matches:()=>true,closest:()=>null,removeAttribute(){},classList:{remove(){}},blur(){vm.runInContext('applyCanvasEditor()',env);}};
 const env=vm.createContext({
  window:{addEventListener(type,fn){if(type==='keydown')handlers.push(fn);},WIUTextEditing:{reset(){calls.resets++;}}},
  history:{tx:null},canvasEdit:null,canvasDrafts:new Map(),canvasDraftKey:r=>r.id,
  portClipboardScope:()=>({project:'p',module:'m'}),canvasFieldTarget:el=>el.canvasRef,
  refreshCanvasEditor(){},commitCanvasField(ref,value){calls.commits.push({id:ref.id,value});return true;},
  nextSignalId(which,id,step){calls.moves.push({which,id,step});return step>0?'next':'previous';},openCanvasEditor:ref=>calls.next.push(ref),returnCanvasEditView(){},previewCanvas:{focus(){calls.focus++;}},
  $:()=>({hidden:true}),handleWorkspaceKey:()=>false,isEditableTarget:()=>true,presentationOpen:false,
  moveExcelSignalEditor(){throw Error('legacy navigation must not handle canvas drafts');},excelFieldInfo:()=>true,
 });
 const controller=section('function handleCanvasFieldKey(e){','function commitCanvasField');
 vm.runInContext(section('function closeCanvasEditor(','function canvasWidthPlan')+section('function applyCanvasEditor(){','// Capture draft input')+section('function inlineCanvasRef(','document.addEventListener(\'focusin\'')+controller,env);
 // Execute the actual competing registrations in their source order. This catches
 // the original bug: legacy Escape blurs and commits before cancellation runs.
 const dedicated="window.addEventListener('keydown',handleCanvasFieldKey,true);";
 const legacy=section('window.addEventListener("keydown",e=>','const workspace=');
 for(const code of [dedicated,legacy].sort((a,b)=>source.indexOf(a)-source.indexOf(b)))vm.runInContext(code,env);
 function draft(value='right_port_visible'){
  input.value='data';input.defaultValue='data';env.canvasEdit={...input.canvasRef,input,original:'data',scope:JSON.stringify(['p','m'])};input.value=value;
 }
 function key(key,extra={}){let stopped=false,prevented=false;const event={target:input,key,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},...extra};for(const handler of handlers){handler(event);if(stopped)break;}return {prevented,stopped};}
 return {input,calls,draft,key,env};
}
test('Escape cancels a right-side name before blur and cannot commit on the next click',()=>{
 const h=harness();h.draft();assert.equal(h.key('Escape').prevented,true);
 assert.equal(h.input.value,'data');assert.equal(h.env.canvasEdit,null);assert.equal(h.calls.commits.length,0);
 h.input.blur();assert.equal(h.calls.commits.length,0);assert.equal(h.calls.resets,1);
});
test('Enter and Tab commit once before navigation; later blur cannot duplicate the rename',()=>{
 for(const key of ['Enter','Tab']){const h=harness();h.draft();h.key(key);h.input.blur();assert.deepEqual(h.calls.commits,[{id:'p',value:'right_port_visible'}]);assert.equal(h.calls.next.length,1);assert.equal(h.env.canvasEdit,null);}
});
test('Enter follows the same field down rows while Tab follows the next column, with Shift reversing both',()=>{
 const cases=[
  ['name','Enter',false,'name','next'],['bits','Enter',false,'bits','next'],['comment','Enter',true,'comment','previous'],
  ['name','Tab',false,'bits','p'],['bits','Tab',false,'comment','p'],['comment','Tab',false,'name','next'],
  ['name','Tab',true,'comment','previous'],['bits','Tab',true,'name','p'],['comment','Tab',true,'bits','p']
 ];
 for(const [kind,key,shiftKey,nextKind,nextId] of cases){
  const h=harness();h.input.canvasRef.kind=kind;h.draft();h.key(key,{shiftKey});
  assert.equal(h.calls.next.length,1);assert.equal(h.calls.next[0].kind,nextKind);assert.equal(h.calls.next[0].id,nextId);
  assert.equal(h.calls.commits.length,1);assert.equal(h.env.canvasEdit,null);
 }
});
test('IME Enter and Escape stay native without triggering legacy blur or rename',()=>{
 for(const key of ['Enter','Escape'])for(const composition of [{isComposing:true},{keyCode:229}]){
  const h=harness();h.draft();const result=h.key(key,composition);
  assert.equal(result.prevented,false);assert.equal(h.calls.commits.length,0);assert.ok(h.env.canvasEdit);assert.equal(h.input.value,'right_port_visible');
 }
});
