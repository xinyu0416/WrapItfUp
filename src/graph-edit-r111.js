(function(root,factory){const api=factory(root);root.WIUGraphEdit=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const dep=(name,file)=>root[name]||(typeof require==='function'?require('./'+file):null),copy=x=>JSON.parse(JSON.stringify(x));
function rows(p){
 const out=[];const add=(kind,id,value,label,extra={})=>out.push({kind,id,key:kind+':'+id,value:String(value||''),label,...extra});
 for(const i of p.instances)add('instance',i.id,i.name,'Instance · '+i.name);
 for(const n of p.nets){add('net',n.id,n.name,(n.direction==='wire'?'內部線':'Top 接腳')+' · '+n.name);if(n.range)add('detail','net:'+n.id,n.range,n.name+' · 位寬',{readonly:'位寬請在接腳／線的屬性修改',target:'net',targetId:n.id});}
 for(const m of p.modules){
  const placed=p.instances.filter(i=>i.module===m.name);if(!placed.length)continue;
  const sourceReason=dep('WIUWorkbook','workbook.js').portEditStatus(p,m).reason;
  for(const port of m.ports){const extra={moduleId:m.id,portId:port.id,instances:placed.map(i=>i.id),readonly:sourceReason};
   add('port',m.id+':'+port.id,port.name,m.name+'.'+port.name,extra);
   if(port.comment)add('detail','comment:'+m.id+':'+port.id,port.comment,m.name+'.'+port.name+' · 註解',{...extra,readonly:'註解請開啟模組介面修改',target:'port',targetId:m.id+':'+port.id});
  }
  for(const par of m.parameters||[])add('detail','param:'+m.id+':'+par.name,par.name+' = '+par.value,m.name+' · 參數',{readonly:'參數請使用物件屬性修改',instances:placed.map(i=>i.id)});
  const d=p.workbook?.diagrams?.[m.id];for(const side of ['left','right'])for(const g of d?.groups?.[side]||[])add('detail','group:'+m.id+':'+g.id,g.name,m.name+' · 群組',{readonly:'群組名稱請開啟模組介面修改',instances:placed.map(i=>i.id)});
 }
 return out;
}
function plan(p,options){
 const C=dep('WIUCore','assembly-core.js'),F=dep('WIUFindReplaceCore','find-replace.js'),W=dep('WIUWorkbook','workbook.js'),A=dep('WIUActions','assembly-actions.js');
 const query=String(options.query||''),replacement=String(options.replacement||''),matches=[],changes=[],errors=[];
 for(const r of rows(p)){if(options.kind&&options.kind!=='all'&&r.kind!==options.kind)continue;const hits=F.occurrences(r.value,query,{caseSensitive:!!options.caseSensitive});if(!hits.length)continue;matches.push(r);if(r.readonly||options.onlyKey&&r.key!==options.onlyKey)continue;let at=0,after='';for(const h of hits){after+=r.value.slice(at,h.start)+replacement;at=h.end;}after+=r.value.slice(at);if(after!==r.value)changes.push({...r,after});}
 const candidate=copy(p);
 try{
  for(const c of changes)if(!C.validName(c.after))throw Error('「'+c.after+'」不是合法名稱。');
  const mapped=(kind,id,fallback)=>changes.find(c=>c.kind===kind&&c.id===id)?.after||fallback;
  const symbols=candidate.nets.map(n=>mapped('net',n.id,n.name)).concat(candidate.instances.map(i=>mapped('instance',i.id,i.name)),(candidate.parameters||[]).map(p=>p.name));
  if(new Set(symbols).size!==symbols.length)throw Error('取代後 Top 名稱重複；請修改取代文字。');
  for(const m of candidate.modules){const names=m.ports.map(p=>mapped('port',m.id+':'+p.id,p.name));if(new Set(names).size!==names.length||names.some(n=>(m.parameters||[]).some(p=>p.name===n)))throw Error(m.name+' 的接腳名稱重複或與參數衝突。');}
  let serial=0;const netChanges=changes.filter(c=>c.kind==='net');const occupied=JSON.stringify(candidate)+JSON.stringify(changes);
  for(const c of netChanges){let temp;do{temp='__wiu_find_'+(++serial);}while(occupied.includes(temp));A.renameNet(candidate,c.id,temp);}
  for(const c of netChanges)A.renameNet(candidate,c.id,c.after);
  for(const c of changes.filter(c=>c.kind==='instance')){const i=candidate.instances.find(i=>i.id===c.id);i.name=c.after;i.nameBinding={mode:'custom',lastGenerated:c.after};}
  let result=candidate;
  for(const m of candidate.modules){const edits=changes.filter(c=>c.kind==='port'&&c.moduleId===m.id);if(!edits.length)continue;
   const d=W.makeDiagram(result,m.id);for(const side of ['left','right'])for(const s of d.signals[side]){const c=edits.find(c=>c.portId===s.id);if(c)s.name=c.after;}
   const ports=m.ports.map(p=>({...p,name:edits.find(c=>c.portId===p.id)?.after||p.name}));result=W.applyDiagram(result,m.id,d,{ports,parameters:m.parameters,issues:[]}).project;
  }
  result.orgEdited=true;
  return {matches,changes,errors,project:W.normalize(result),before:JSON.stringify(p)};
 }catch(e){errors.push(e.message);return {matches,changes,errors,before:JSON.stringify(p)};}
}
return {rows,plan};});
