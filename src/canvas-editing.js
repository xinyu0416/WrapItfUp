(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.WIUCanvasEditing=api;})(globalThis,function(){
'use strict';
function nameConflicts(signals,id,name,reserved=[]){const text=String(name||'').trim();if(!text||/^\/\//.test(text))return [];return signals.filter(s=>s.id!==id&&String(s.name||'').trim()===text).map(s=>({id:s.id,name:s.name,side:s.side})).concat(reserved.includes(text)?[{id:null,name:text,reserved:true}]:[]);}
function duplicateSets(signals){const groups=new Map();for(const s of signals){const name=String(s.name||'').trim();if(!name||name.startsWith('//'))continue;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(s);}return [...groups.entries()].filter(([,rows])=>rows.length>1).map(([name,rows])=>({name,rows}));}
class TextHistory{
 constructor(value,start=0,end=start){this.past=[];this.future=[];this.current={value,start,end};}
 record(value,start=0,end=start){if(value===this.current.value){this.current={value,start,end};return;}this.past.push(this.current);if(this.past.length>500)this.past.shift();this.current={value,start,end};this.future=[];}
 undo(){if(!this.past.length)return null;this.future.push(this.current);return this.current=this.past.pop();}
 redo(){if(!this.future.length)return null;this.past.push(this.current);return this.current=this.future.pop();}
}
return {nameConflicts,duplicateSets,TextHistory};
});
