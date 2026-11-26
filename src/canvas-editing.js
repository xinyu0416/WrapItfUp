(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.WIUCanvasEditing=api;})(globalThis,function(){
'use strict';
function nameConflicts(signals,id,name,reserved=[]){const text=String(name||'').trim();if(!text||/^\/\//.test(text))return [];return signals.filter(s=>s.id!==id&&String(s.name||'').trim()===text).map(s=>({id:s.id,name:s.name,side:s.side})).concat(reserved.includes(text)?[{id:null,name:text,reserved:true}]:[]);}
function duplicateSets(signals){const groups=new Map();for(const s of signals){const name=String(s.name||'').trim();if(!name||name.startsWith('//'))continue;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(s);}return [...groups.entries()].filter(([,rows])=>rows.length>1).map(([name,rows])=>({name,rows}));}
// Camera-only edit focus. Rectangles are in screen coordinates; the returned
// view never changes port spacing, block dimensions or persisted signal data.
function readableFieldView(view,viewport,field){
 const scale=Number(view?.scale)||1;if(!viewport||!field||viewport.width<=0||viewport.height<=0)return null;
 const margin=20,inside=field.left>=viewport.left+margin&&field.right<=viewport.left+viewport.width-margin&&field.top>=viewport.top+margin&&field.bottom<=viewport.top+viewport.height-margin;
 if(scale>=1&&inside)return null;
 const nextScale=Math.max(1,scale),cx=(field.left+field.right)/2-viewport.left,cy=(field.top+field.bottom)/2-viewport.top;
 const x=(cx-view.x)/scale,y=(cy-view.y)/scale;
 return {scale:nextScale,x:viewport.width/2-x*nextScale,y:viewport.height/2-y*nextScale,fit:false};
}
class TextHistory{
 constructor(value,start=0,end=start){this.past=[];this.future=[];this.current={value,start,end};}
 record(value,start=0,end=start){if(value===this.current.value){this.current={value,start,end};return;}this.past.push(this.current);if(this.past.length>500)this.past.shift();this.current={value,start,end};this.future=[];}
 undo(){if(!this.past.length)return null;this.future.push(this.current);return this.current=this.past.pop();}
 redo(){if(!this.future.length)return null;this.past.push(this.current);return this.current=this.future.pop();}
}
return {nameConflicts,duplicateSets,readableFieldView,TextHistory};
});
