(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WIUWorkbook=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const dep=n=>root[n]||(typeof require==='function'?require({'WIUActions':'./assembly-actions.js','WIUCore':'./assembly-core.js','WIUParser':'./assembly-parser.js'}[n]):null);
const A=()=>dep('WIUActions'),C=()=>dep('WIUCore'),P=()=>dep('WIUParser');
const clone=x=>JSON.parse(JSON.stringify(x)),uid=()=> 'w_'+Math.random().toString(36).slice(2,12),arr=x=>Array.isArray(x)?x:[];
function normalize(input,previous){
 const p=A().normalizeProject(input),old=previous||input;
 if(p.top==='dual_lane_wrapper'&&!p.rtlSources?.length)for(const m of p.modules)if(['mac_pair','phy_link'].includes(m.name)&&!m.source&&!m.originalSource)m.interfaceOnly=true;
 if(p.parameters&&!Array.isArray(p.parameters))p.parameters=Object.entries(p.parameters).map(([name,value])=>({name,value}));
 if(p.workbook&&p.workbook.schema!==1)throw Error('不支援這個 Workbook 資料版本。');
 p.workbook=p.workbook||{schema:1,projectId:uid(),diagrams:{},recovered:[]};
 p.workbook.projectId=p.workbook.projectId||uid();p.workbook.diagrams=p.workbook.diagrams||{};p.workbook.recovered=arr(p.workbook.recovered);
 // A generated instance name follows its module; a deliberate custom name does not.
 for(const i of p.instances){
  const b=i.nameBinding;
  if(b&&['module','custom'].includes(b.mode)&&i.name===b.lastGenerated)continue;
  if(b&&i.name!==b.lastGenerated){i.nameBinding={mode:'custom',lastGenerated:i.name};continue;}
  const prefix=i.module+'_inst',suffix=i.name.slice(prefix.length);
  i.nameBinding=i.name.startsWith(prefix)&&/^(?:_?\d+)?$/.test(suffix)?{mode:'module',suffix,lastGenerated:i.name}:{mode:'custom',lastGenerated:i.name};
 }
 const ids=new Set(['top']);
 for(const m of p.modules){const before=arr(old.modules).find(x=>x.id&&x.id===m.id)||arr(old.modules).find(x=>x.name===m.name);m.id=m.id||before?.id||uid();if(ids.has(m.id))throw Error('Module ID 重複。');ids.add(m.id);const pins=new Set();for(const port of m.ports){port.id=port.id||before?.ports.find(x=>x.name===port.name)?.id||uid();if(pins.has(port.id))throw Error('Port ID 重複。');pins.add(port.id);}}
 for(const id of Object.keys(p.workbook.diagrams)){if(ids.has(id))p.workbook.diagrams[id]=makeDiagram(p,id);else delete p.workbook.diagrams[id];}
 syncGeneratedNetNames(p);
 return p;
}
// Generated wire names have an owner, not a permanent copy of its old name.
// Stable IDs preserve topology; manual net names are never inferred by substring.
function syncGeneratedNetNames(p){
 const owners=()=>p.instances.flatMap(i=>{const m=p.modules.find(m=>m.name===i.module);return arr(m?.ports).filter(port=>port.direction!=='input').map(port=>({i,port}));});
 const endpoints=owners(),planned=[];
 for(const n of p.nets){
  if(n.direction!=='wire')continue;
  let b=n.nameBinding;
  if(b?.mode==='custom')continue;
  if(b&&n.name!==b.lastGenerated){n.nameBinding={mode:'custom',lastGenerated:n.name};continue;}
  if(!b){
   // Old GUI wires retain their creation name in graph_net_<name>. Only an
   // unchanged generated name with one proven driver can recover ownership.
   if(n.id!=='graph_net_'+n.name)continue;
   const candidates=endpoints.filter(({i,port})=>p.connections.some(c=>c.instance===i.id&&c.port===port.name&&c.expr===n.name));
   if(candidates.length!==1)continue;
   const {i,port}=candidates[0],at=n.name.lastIndexOf('_'+port.name),suffix=at>=0?n.name.slice(at+port.name.length+1):null;
   if(at<1||!/^(?:_(?:[2-9]|[1-9]\d+))?$/.test(suffix))continue;
   b=n.nameBinding={mode:'instance-port',instanceId:i.id,portId:port.id,suffix,lastGenerated:n.name};
  }
  if(b.mode!=='instance-port')continue;
  const owner=endpoints.find(({i,port})=>i.id===b.instanceId&&(port.id===b.portId||!b.portId&&port.name===b.portName));if(!owner)continue;
  b.portId=owner.port.id;b.portName=owner.port.name;
  const base=owner.i.name+'_'+owner.port.name,desired=base+(b.suffix||'');
  planned.push({n,b,base,desired});
 }
 const moving=new Set(planned.filter(x=>x.desired!==x.n.name).map(x=>x.n.id));
 const used=new Set(p.nets.filter(n=>!moving.has(n.id)).map(n=>n.name.toLowerCase()).concat(p.instances.map(i=>i.name.toLowerCase()),arr(p.parameters).map(x=>x.name.toLowerCase())));
 const changes=[];
 for(const x of planned){if(!moving.has(x.n.id))continue;let name=x.desired,k=2;while(used.has(name.toLowerCase()))name=x.base+'_'+k++;used.add(name.toLowerCase());x.b.suffix=name.slice(x.base.length);changes.push({...x,name});}
 let serial=0;for(const x of changes){let temp;do{temp='__wiu_net_rename_'+(++serial);}while(p.nets.some(n=>n.name===temp)||p.instances.some(i=>i.name===temp)||arr(p.parameters).some(v=>v.name===temp));A().renameNet(p,x.n.id,temp,{automatic:true});}
 for(const x of changes){A().renameNet(p,x.n.id,x.name,{automatic:true});x.b.lastGenerated=x.name;}
 if(changes.length)p.orgEdited=true;
 return changes.map(x=>({id:x.n.id,name:x.name}));
}
function moduleOf(p,id){if(id==='top')return {id:'top',name:p.top,ports:p.nets.filter(n=>n.direction!=='wire'),parameters:arr(p.parameters),top:true};const m=p.modules.find(m=>m.id===id);if(!m)throw Error('找不到這個模組頁。');return m;}
function groupLabel(diagram,side,id){
 const groups=arr(diagram.groups?.[side]),names=[],seen=new Set();
 let group=groups.find(g=>g.id===id);
 while(group&&!seen.has(group.id)){
  seen.add(group.id);names.unshift(group.name);
  group=groups.find(g=>g.id===group.parentId);
 }
 return names.join(' / ');
}
function makeDiagram(p,id){
 const m=moduleOf(p,id),old=p.workbook?.diagrams?.[id];
 const d=old?clone(old):{moduleName:m.name,parameters:'',signals:{left:[],right:[]},groups:{left:[],right:[]},conditions:{left:[],right:[]},rtlOrder:[],layout:{blockX:650,blockY:48,blockWidth:500,blockHeight:420,leftSignalX:530,rightSignalX:1270}};
 const all=[...d.signals.left,...d.signals.right];d.moduleName=m.name;d.parameters=arr(m.parameters).map(x=>(x.local?'localparam ':'parameter ')+(x.type?x.type+' ':'')+x.name+' = '+x.value).join(', ');
 const next={left:[],right:[]};
 for(const port of m.ports){const prior=all.find(s=>s.id===port.id)||all.find(s=>s.name===port.name),side=prior?(d.signals.left.includes(prior)?'left':'right'):port.direction==='output'?'right':'left';const sig={...(prior||{}),id:port.id,name:port.name,direction:port.direction,bits:port.range||'1',signed:!!port.signed,comment:port.comment??prior?.comment??'',conditionId:null};
  if(!prior&&port.group){let g=d.groups[side].find(x=>x.name===port.group);if(!g){g={id:'auto_'+side+'_'+crc(m.id+'::'+port.group),name:port.group,color:['#68778c','#806596','#5d427c','#8c6f4e','#4f6382','#856d96'][d.groups[side].length%6]};d.groups[side].push(g);}sig.groupId=g.id;}
  next[side].push(sig);
 }
 for(const side of ['left','right']){const mapped=new Map(next[side].map(x=>[x.id,x])),ordered=[];for(const s of d.signals[side]){if(mapped.has(s.id)){ordered.push(mapped.get(s.id));mapped.delete(s.id);}else if(!String(s.name||'').trim()||arr(d.nonPortIds).includes(s.id))ordered.push(s);}next[side]=ordered.concat([...mapped.values()]);}
 d.signals=next;const valid=new Set([...next.left,...next.right].map(x=>x.id));d.rtlOrder=arr(d.rtlOrder).filter(x=>valid.has(x));for(const x of valid)if(!d.rtlOrder.includes(x))d.rtlOrder.push(x);
 return d;
}
function interfaceKey(m){return JSON.stringify({name:m.name,parameters:arr(m.parameters).map(x=>({name:x.name,value:x.value,type:x.type||'',local:!!x.local})),ports:m.ports.map(x=>({name:x.name,range:x.range||'',direction:x.direction,signed:!!x.signed}))});}
function skeleton(m){const params=arr(m.parameters).map(p=>'  '+(p.local?'localparam ':'parameter ')+(p.type?p.type+' ':'')+p.name+' = '+p.value);return 'module '+m.name+(params.length?' #(\n'+params.join(',\n')+'\n)':'')+' (\n'+m.ports.map(p=>'  '+p.direction+' wire '+(p.signed?'signed ':'')+(p.range?p.range+' ':'')+p.name).join(',\n')+'\n);\nendmodule\n';}
function createModule(project,name){
 const p=normalize(project);if(!C().validName(name)||name===p.top||p.modules.some(m=>m.name===name))throw Error('請輸入有效且不重複的 module 名稱。');
 const filename=name+'.v',file=p.rtlSources.find(f=>f.name.toLowerCase()===filename.toLowerCase());
 if(file){
  const scan=physicalModules(file.text);
  if(!p.workbook.reusableModuleSources?.some(r=>r.name===name&&r.file===file.name)||scan.ambiguous||scan.spans.some(s=>s.name===name))throw Error('此名稱與保存的 RTL 來源檔重複，請換一個名稱。');
 }
 const m={id:uid(),name,ports:[],parameters:[],issues:[],source:'',filename,sourceFilename:filename,placeholder:true,interfaceOnly:true};m.source=skeleton(m);
 p.modules.push(m);
 if(file){
  // Its original physical file still serves siblings or an include. Add only
  // the newly requested definition; future sheet edits replace its own span.
  file.text+='\n'+m.source;m.filename=m.sourceFilename=file.name;
  p.workbook.reusableModuleSources=p.workbook.reusableModuleSources.filter(r=>r.name!==name);
 }else p.rtlSources.push({name:filename,text:m.source});
 return {project:p,id:m.id};
}
// Physical RTL spans, before preprocessing, include modules in alternate define branches.
// Comment/string masking keeps original offsets. Macro bodies are not design units.
function codeMask(text){
 return P().stripComments(String(text)).replace(/"(?:\\[\s\S]|[^"\\])*"/g,s=>s.replace(/[^\r\n]/g,' '));
}
function physicalModules(text){
 const clean=codeMask(text).replace(/^[\t ]*`define\b(?:[^\n]*\\\r?\n)*[^\n]*/gm,s=>s.replace(/[^\r\n]/g,' '));
 const token=/\\[^\s]+|`[A-Za-z_][\w$]*|[A-Za-z_][\w$]*/g;
 const spans=[];let open=null,bad=false,t;
 while((t=token.exec(clean))){
  if(t[0]==='module'||t[0]==='macromodule'){
   const m=/^\s+(?:(?:static|automatic)\s+)?([A-Za-z_][\w$]*|\\\S+)/.exec(clean.slice(token.lastIndex));
   if(!m||open){bad=true;continue;}
   // An attached attribute belongs to the removed declaration as well.
   const attr=/(?:\(\*(?:(?!\(\*|\*\))[\s\S])*?\*\)\s*)+$/.exec(clean.slice(0,t.index));
   open={name:m[1].replace(/^\\/,''),start:attr?attr.index:t.index};
  }else if(t[0]==='endmodule'){
   if(!open){bad=true;continue;}
   const label=/^\s*:\s*(?:[A-Za-z_][\w$]*|\\\S+)/.exec(clean.slice(token.lastIndex));
   spans.push({...open,end:token.lastIndex+(label?label[0].length:0)});open=null;
  }
 }
 return {spans,ambiguous:bad||!!open};
}
function dropSpans(text,spans){
 let start=0,out='';for(const s of spans){out+=text.slice(start,s.start);start=s.end;}return out+text.slice(start);
}
function sourceName(m){return m.sourceFilename||m.filename||m.name+'.v';}
function mayInstantiate(text,name){
 const tokens=codeMask(text).match(/\\[^\s]+|[A-Za-z_][\w$]*|[#()[\]]|\S/g)||[];
 const ident=s=>s&&/^(?:[A-Za-z_]|\\)/.test(s),skip=(i,open,close)=>{let depth=0;for(;i<tokens.length;i++){if(tokens[i]===open)depth++;if(tokens[i]===close&&--depth===0)return i+1;}return tokens.length;};
 for(let i=0;i<tokens.length;i++){
  if(tokens[i]!==name&&tokens[i]!=='\\'+name)continue;
  let j=i+1;
  if(tokens[j]==='#'&&tokens[j+1]==='(')j=skip(j+1,'(',')');
  if(!ident(tokens[j++]))continue;
  while(tokens[j]==='[')j=skip(j,'[',']');
  if(tokens[j]==='(')return true;
 }
 return false;
}
function checkModuleUpdate(project,name,incoming){
 if(!incoming.modules.some(m=>m.name===name))throw Error('更新內容必須包含目前組態啟用的 '+name+'。請選擇完整來源檔，或確認 Defines。');
 for(const file of incoming.sources||[]){
  const old=project.rtlSources.find(f=>f.name===file.name);if(!old)continue;
  const before=physicalModules(old.text),after=physicalModules(file.text);
  if(before.ambiguous||after.ambiguous)throw Error(file.name+' 的 module 邊界不明，請先拆分來源再更新。');
  const missing=before.spans.filter(s=>s.name!==name&&!after.spans.some(x=>x.name===s.name)).map(s=>s.name);
  if(missing.length)throw Error('更新 '+file.name+' 會漏掉共用來源中的 '+[...new Set(missing)].join('、')+'；請提供完整檔案。');
 }
}
// Remove topology and its saved geometry together, so one history entry can
// restore both. Shared by deleting one instance and retiring a whole module.
function removeInstanceWithLayout(project,id){
 const G=root.WIUTopScene,w=project.workbook||{};
 const previous=G&&(G.validFreeze(project)||(w.graphAutoR99?.pendingRouting&&w.graphAutoR99.layoutIdentity===G.layoutIdentity(project)?w.graphAutoR99:null));
 const removal=A().removeInstance(project,id),removedNets=new Set(removal.nets.map(n=>n.id));
 const owns=key=>String(key||'').startsWith(id+'::');
 const clearRoutes=routes=>{for(const key of Object.keys(routes||{})){const parts=key.split('|');if(parts.slice(0,2).some(owns)||removedNets.has(parts[2]))delete routes[key];}};
 if(w.graphPositions)delete w.graphPositions[id];
 clearRoutes(w.wireRoutes);
 if(previous){
  const frozen=clone(previous);w.graphAutoR99=frozen;
  if(frozen.placed)delete frozen.placed[id];
  if(frozen.inputPositions)delete frozen.inputPositions[id];
  if(frozen.autoSize?.trackSpace?.origin)delete frozen.autoSize.trackSpace.origin[id];
  clearRoutes(frozen.inputManualRoutes);clearRoutes(frozen.routes);
  frozen.signature=G.topologySignature(project);frozen.routeIdentity=G.routeIdentity(project);
  if(frozen.pendingRouting)frozen.layoutIdentity=G.layoutIdentity(project);
  delete frozen.lastRepair;
 }else if(w.graphAutoR99){
  // An invalid snapshot must not keep endpoints belonging to a removed block.
  delete w.graphAutoR99;
 }
 return removal;
}
function retireModule(project,id,options={}){
 const m=moduleOf(project,id);if(m.top)throw Error('Top 對外介面無法移除。');
 const uses=project.instances.filter(i=>i.module===m.name);
 if(uses.length&&!options.cascade)throw Error('Top 仍直接使用 '+uses.length+' 顆 '+m.name+'：'+uses.map(i=>i.name).join('、')+'。請先移除這些 instance。');
 const p=normalize(project),files=new Map(p.rtlSources.map(f=>[f.name,f]));
 const removedInstances=uses.map(i=>removeInstanceWithLayout(p,i.id));
 for(const mod of p.modules){const f=sourceName(mod);if(!files.has(f)&&(mod.originalSource||mod.source))files.set(f,{name:f,text:mod.originalSource||mod.source});}
 const D=root.WIUDefines||(typeof require==='function'?require('./assembly-defines.js'):null);
 const configs=[p.defineConfig,...arr(p.bundleConfig?.profiles).map(x=>x.defineConfig)].filter(Boolean);
 const includes=configs.flatMap(c=>arr(c.includes)),changes=[],support=[...files.values(),...includes];
 const named=new RegExp('(^|[^A-Za-z0-9_$])'+m.name.replace(/[$]/g,'\\$&')+'(?![A-Za-z0-9_$])');
 const mentionsInDefine=text=>codeMask(text).match(/^[\t ]*`define\b(?:[^\n]*\\\r?\n)*[^\n]*/gm)?.some(s=>named.test(s));
 const blocked=reason=>{throw Error(reason+'。請先更新或拆分來源，再移除 '+m.name+'。');};
 for(const f of includes)if(physicalModules(f.text).spans.some(s=>s.name===m.name)||mayInstantiate(f.text,m.name)||mentionsInDefine(f.text))blocked('Include '+f.name+' 含有 '+m.name+' 的宣告或引用');
 for(const [filename,f] of files){
  const text=f.text,scan=physicalModules(text),target=scan.spans.filter(s=>s.name===m.name);
  if(scan.ambiguous&&(target.length||filename===sourceName(m)||named.test(codeMask(text))))blocked(filename+' 的 module 邊界受條件或巨集影響');
  if(filename===sourceName(m)&&!target.length&&text.trim())blocked(filename+' 找不到可單獨移除的實體宣告（可能由 include 或巨集提供）');
  for(const s of target){
   const decl=codeMask(text.slice(s.start,s.end));let depth=0;
   for(const hit of decl.matchAll(/^[ \t]*`(ifdef|ifndef|endif|elsif|else|define|undef|include|timescale|default_nettype|resetall)\b/gm)){
    if(hit[1]==='ifdef'||hit[1]==='ifndef')depth++;
    else if(hit[1]==='endif'){if(--depth<0)blocked(filename+' 的條件跨越 module 邊界');}
    else if(hit[1]==='else'||hit[1]==='elsif'){if(!depth)blocked(filename+' 的條件跨越 module 邊界');}
    else if(hit[1]!=='include'||scan.spans.length>target.length)blocked(filename+' 的 '+hit[1]+' 可能影響其他 RTL');
   }
   if(depth)blocked(filename+' 的條件跨越 module 邊界');
  }
  const remaining=dropSpans(text,target);
  if(mayInstantiate(remaining,m.name)||mentionsInDefine(remaining))blocked(filename+' 的 RTL 仍引用 '+m.name+'（包含其他 Defines 分支）');
  if(!target.length)continue;
  const other=scan.spans.filter(s=>s.name!==m.name).map(s=>s.name);
  const outside=codeMask(remaining).replace(/^[\t ]*`(?:ifdef|ifndef|else|elsif|endif)\b[^\r\n]*/gm,'').trim();
  const referenced=support.some(file=>file.name!==filename&&[...P().stripComments(file.text).matchAll(/^[\t ]*`include[\t ]+"([^"\r\n]+)"/gm)].some(hit=>{
   try{return D.pathName(hit[1],file.name)===D.pathName(filename);}catch{return hit[1]===filename;}
  }));
  const keep=!!(outside||other.length||referenced);
  changes.push({filename,kept:keep,siblings:[...new Set(other)]});
  const index=p.rtlSources.findIndex(row=>row.name===filename);
  if(!keep&&index>=0)p.rtlSources.splice(index,1);
  if(keep){
   const next={...f,text:remaining};if(next.placeholderProvenance){const prov=next.placeholderProvenance;if(prov.text===text)next.placeholderProvenance={text:remaining,modules:arr(prov.modules).filter(g=>g.name!==m.name)};else delete next.placeholderProvenance;}
   if(index<0)p.rtlSources.push(next);else p.rtlSources[index]=next;
   for(const sib of p.modules)if(sib.id!==id&&sourceName(sib)===filename)delete sib.originalSource;
   if(filename.toLowerCase()===(m.name+'.v').toLowerCase()){
    p.workbook.reusableModuleSources=arr(p.workbook.reusableModuleSources).filter(r=>r.name!==m.name);
    p.workbook.reusableModuleSources.push({name:m.name,file:filename});
   }
  }
 }
 // External user-supplied link targets cannot be surgically edited by the exporter.
 for(const change of changes.filter(c=>c.kept)){
  const linked=arr(p.companyConfig?.sources).some(l=>l.path&&p.modules.some(sib=>sib.id!==id&&sourceName(sib)===change.filename&&(l.moduleId===sib.id||l.module===sib.name)));
  if(linked)blocked('共用來源 '+change.filename+' 已設定外部 RTL 路徑，請先更新該來源');
 }
 p.modules=p.modules.filter(x=>x.id!==id);
 if(p.companyConfig?.sources)p.companyConfig.sources=p.companyConfig.sources.filter(l=>l.moduleId!==id&&l.module!==m.name);
 p.orgEdited=true;return {project:normalize(p,project),changes,removedInstances};
}
function rtlInterfaceEditor(){return root.WIURtlInterfaceEdit||(typeof require==='function'?require('./rtl-interface-edit.js'):null);}
function portEditStatus(p,m){return rtlInterfaceEditor().status(p,m,physicalModules);}
function editCapabilities(project,id){
 const m=moduleOf(project,id);return {renameReason:id!=='top'&&!m.interfaceOnly?'來源模組目前不支援直接改名。更新 RTL 用於更新同名模組；若要換 module 名稱，請先匯入新名稱版本，再遷移實例與接線。':'',conditionReason:'圖面條件編輯尚未支援寫入完整專案，本次未修改任何接腳。請在 RTL 來源編輯 IFDEF／IFNDEF，再使用「更新 RTL」及 Defines 選擇組態。'};
}
function applyDiagram(project,id,raw,parsed){
 const p=normalize(project),old=clone(moduleOf(p,id)),d=clone(raw.state||raw),issues=arr(parsed.issues).filter(x=>x.severity==='error');
 if(issues.length)throw Error(issues.map(x=>x.message).join('\n'));
 if(!C().validName(d.moduleName))throw Error('Module 名稱需為合法 Verilog 識別字。');
 if((id!=='top'&&d.moduleName===p.top)||p.modules.some(m=>m.id!==id&&m.name===d.moduleName))throw Error('Module 名稱已被使用。');
 const signals=[...d.signals.left,...d.signals.right],ports=parsed.ports.map(port=>{const sig=signals.find(s=>s.name===port.name);const previous=old.ports.find(x=>x.id===sig?.id)||old.ports.find(x=>x.name===port.name);return {...port,id:previous?.id||sig?.id||uid(),comment:port.comment||sig?.comment||''};});
 const next={name:d.moduleName,ports,parameters:parsed.parameters||[]};
 const structural=interfaceKey(old)!==interfaceKey(next);
 const sourceEdit=id!=='top'&&!old.interfaceOnly&&structural?rtlInterfaceEditor().patch(p,old,next,physicalModules,mayInstantiate):null;
 const changes=[];
 const renames=old.ports.flatMap(port=>{const updated=ports.find(x=>x.id===port.id);return updated&&updated.name!==port.name?[{id:port.id,before:port.name,after:updated.name}]:[];});
 if(id==='top'&&renames.length){
  // Two phases avoid cascading a->aa and aa->aaaa through the first new name.
  // Work on the candidate project only; any failure discards the whole batch.
  const occupied=JSON.stringify(p)+JSON.stringify(renames),temporary=[];let n=0;
  for(const r of renames){let name;do{name='__wiu_batch_rename_'+(++n);}while(occupied.includes(name));A().renameNet(p,r.id,name);temporary.push(r);}
  for(const r of temporary)A().renameNet(p,r.id,r.after);
 }else if(renames.length){const mapping=new Map(renames.map(r=>[r.before,r.after])),instances=new Set(p.instances.filter(i=>i.module===old.name).map(i=>i.id));for(const c of p.connections)if(instances.has(c.instance)&&mapping.has(c.port))c.port=mapping.get(c.port);}
 for(const port of old.ports){const updated=ports.find(x=>x.id===port.id);if(!updated){changes.push(port.name+' 已移除；原接線保留待修正');continue;}if(port.name!==updated.name)changes.push(port.name+' → '+updated.name);if(port.range!==updated.range||port.direction!==updated.direction)changes.push(updated.name+' 的位寬／方向已更新，請檢查接線');}
 if(id==='top'){
  if(ports.some(x=>p.nets.some(n=>n.direction==='wire'&&n.name===x.name)))throw Error('Top 接腳與內部線名稱重複。');
  p.top=next.name;p.parameters=next.parameters;p.nets=p.nets.filter(n=>n.direction==='wire').concat(ports);
 }else{
  const m=p.modules.find(x=>x.id===id);const oldFile=m.sourceFilename||m.filename;
  if(structural){if(p.rtlSources.some(x=>x.name!==oldFile&&x.name.toLowerCase()===(next.name+'.v').toLowerCase()))throw Error('新名稱與保存的 RTL 來源檔重複。');const affected=p.instances.filter(i=>i.module===m.name),planned=affected.map(i=>({i,name:next.name!==m.name&&i.nameBinding?.mode==='module'?next.name+'_inst'+i.nameBinding.suffix:i.name}));
   const symbols=new Set(p.nets.map(n=>n.name).concat(arr(p.parameters).map(x=>x.name))),allNames=p.instances.map(i=>planned.find(x=>x.i.id===i.id)?.name||i.name);
   for(const x of planned)if(x.name!==x.i.name&&(symbols.has(x.name)||allNames.filter(n=>n===x.name).length!==1))throw Error('模組改名未套用：instance 名稱「'+x.name+'」與現有名稱衝突；請先改名，整批資料保持原樣。');
   for(const {i,name} of planned){if(i.name!==name){changes.push(i.name+' → '+name);i.name=name;i.nameBinding.lastGenerated=name;}i.module=next.name;}
   // Link identity and user-supplied filesystem path are distinct: preserve the path.
   for(const link of arr(p.companyConfig?.sources))if(link.moduleId===id||link.module===m.name)link.module=next.name;
   const f=p.rtlSources.find(f=>f.name===oldFile),scan=f&&physicalModules(f.text),owned=scan?.spans.filter(s=>s.name===m.name)||[];
   const shared=f&&owned.length&&(scan.spans.length>owned.length||codeMask(dropSpans(f.text,owned)).trim());
   if(shared&&(scan.ambiguous||owned.length!==1))throw Error('共用來源 '+oldFile+' 的介面包含多個條件版本；請更新完整 RTL。');
   if(sourceEdit){
    Object.assign(m,next,{source:sourceEdit.module.source,filename:sourceEdit.filename,sourceFilename:sourceEdit.filename,issues:sourceEdit.module.issues,preprocessKey:sourceEdit.module.preprocessKey,includeDependencies:sourceEdit.module.includeDependencies});
    if(f)f.text=sourceEdit.text;else p.rtlSources.push({name:sourceEdit.filename,text:sourceEdit.text});
    for(const sibling of p.modules)if(sourceName(sibling)===sourceEdit.filename)delete sibling.originalSource;
   }else{
   Object.assign(m,next);m.filename=shared?oldFile:next.name+'.v';m.sourceFilename=m.filename;m.source=skeleton(m);m.issues=[];
   if(f){f.name=m.filename;f.text=shared?f.text.slice(0,owned[0].start)+m.source.trimEnd()+f.text.slice(owned[0].end):m.source;}
   else p.rtlSources.push({name:m.filename,text:m.source});
   }
  }
  else m.ports=ports;
 }
 // The diagram retains editable geometry, not a second connectivity graph.
 d.nonPortIds=signals.filter(s=>!ports.some(p=>p.id===s.id)).map(s=>s.id);
 p.workbook.diagrams[id]=d;p.orgEdited=true;return {project:normalize(p,project),changes};
}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function crc(text){let c=0xffffffff;for(const b of new TextEncoder().encode(text)){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return ((c^0xffffffff)>>>0).toString(16).padStart(8,'0');}
function envelope(project,workspace={},kind='user'){
 const p=normalize(project),body={format:'WrapItfUp',schemaVersion:1,appVersion:String((root.WIURelease||(typeof require==='function'?require('./release'):null)).number),scope:'project',origin:kind==='practice'?'practice':'user',project:p,workspace:clone(workspace)};
 return {...body,savedAt:new Date().toISOString(),integrity:{algorithm:'crc32',value:crc(stable(body))}};
}
function read(raw){
 if(!raw||typeof raw!=='object')throw Error('專案檔案格式錯誤。');
 if(raw.format==='WrapItfUp'&&raw.schemaVersion!==undefined){
  if(raw.schemaVersion!==1||raw.scope!=='project')throw Error('不支援這個專案格式版本或保存範圍，請使用對應版本的 WrapItfUp。');
  const body={};for(const k of ['format','schemaVersion','appVersion','scope','origin','project','workspace']){if(raw[k]===undefined)throw Error('專案缺少 '+k);body[k]=raw[k];}
  if(raw.integrity?.algorithm!=='crc32'||raw.integrity.value!==crc(stable(body)))throw Error('專案資料校驗失敗；請使用完整原始下載檔。');
  if(!['user','practice'].includes(raw.origin))throw Error('無效的專案來源。');
  const p=normalize(raw.project),warnings=[];
  // r86 readability migration: old versions stored the dense curve default.
  // Explicit users can restore curve with the visible Top route toggle.
  if(Number(raw.appVersion)<86&&p.workbook.topStyle?.route==='curve'){
   p.workbook.topStyle={...p.workbook.topStyle,route:'orthogonal'};
   warnings.push('r86 為密集 Top 自動啟用智慧直角線距（只改圖面，不動接線）。可使用上方「智慧直角」按鈕切回曲線。');
  }
  return {project:p,workspace:clone(raw.workspace),origin:raw.origin,warnings};
 }
 if(raw.format==='WrapItfUp-assembly'){
  if(!Number.isInteger(raw.version)||raw.version<56||raw.version>63)throw Error('不支援這個舊專案版本。');
  const p=normalize(raw.project),warnings=[];if(raw.diagram){p.workbook.recovered.push({id:uid(),label:'舊版獨立介面圖',diagram:clone(raw.diagram)});warnings.push('舊版介面圖已獨立保留，請核對後加入模組頁；不會覆蓋接線。');}
  return {project:p,workspace:{activeModule:'top',tab:'modules',view:'assembly'},origin:p.learning||p.flow?.tutorial?'practice':'user',warnings};
 }
 throw Error('請載入 WrapItfUp 專案，或原始可還原圖檔。');
}
function asUser(project){const p=normalize(project);p.workbook.projectId=uid();delete p.workbook.example;delete p.learning;delete p.learningGuide;if(p.flow)delete p.flow.tutorial;return p;}
function diagramProject(raw){const d=raw.state||raw;if(!d?.signals||!d.moduleName)throw Error('不是有效的舊版介面圖。');const p=normalize(C().newProject());p.top=C().validName(d.moduleName)?d.moduleName:'recovered_top';p.workbook.recovered.push({id:uid(),label:d.moduleName,diagram:clone(raw)});return p;}
return {editCapabilities,portEditStatus,normalize,moduleOf,groupLabel,makeDiagram,createModule,retireModule,removeInstanceWithLayout,checkModuleUpdate,applyDiagram,skeleton,envelope,read,asUser,diagramProject,stable,crc,interfaceKey};
});
