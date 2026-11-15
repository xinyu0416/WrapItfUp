/* Atomic material intake and interface impact previews. No caller mutations. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WIUImportReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const dep=(name,file)=>root[name]||(typeof require==='function'?require('./'+file):null);
const C=()=>dep('WIUCore','assembly-core.js'),P=()=>dep('WIUParser','assembly-parser.js'),D=()=>dep('WIUDefines','assembly-defines.js'),W=()=>dep('WIUWorkbook','workbook.js'),F=()=>dep('WIUFlow','assembly-flow.js');
const clone=x=>JSON.parse(JSON.stringify(x)),arr=x=>Array.isArray(x)?x:[];
function classify(name,text){if(/\.org$/i.test(name))return 'org';if(/\.(vh|svh)$/i.test(name))return 'include';if(/\.v(?:p)?$|\.sv$/i.test(name))return 'rtl';return /\bmodule\b/.test(P().stripComments(text))?'rtl':'include';}
function mergeRtl(project,result,targetModule=''){
 const p=clone(project);if(targetModule){const old=p.modules.find(m=>m.name===targetModule);if(!old)throw Error('目前模組已被移除。');W().checkModuleUpdate(p,targetModule,result);}
 const retirement=F().retireReplacedSources?F().retireReplacedSources(p,result):{project:p,changes:[],issues:[]};
 if(arr(retirement.issues).some(i=>i.severity==='error'))throw Error(retirement.issues.map(i=>i.message).join('\n'));
 p.rtlSources=retirement.project.rtlSources||[];p.archivedRtlSources=retirement.project.archivedRtlSources||[];
 for(const f of result.sources||[]){const i=p.rtlSources.findIndex(x=>x.name===f.name);if(i<0)p.rtlSources.push(clone(f));else p.rtlSources[i]=clone(f);}
 const incomingNames=new Set(result.modules.map(m=>m.name)),incomingFiles=new Set(arr(result.sources).map(f=>f.name));
 const oldModules=clone(p.modules);
 p.modules=p.modules.filter(m=>!incomingFiles.has(m.sourceFilename||m.filename)||incomingNames.has(m.name));
 for(const incoming of result.modules){const m=clone(incoming),old=oldModules.find(x=>x.name===m.name);if(old){m.id=old.id;for(const port of m.ports){const prev=old.ports.find(x=>x.name===port.name);if(prev?.id)port.id=prev.id;}}if(p.rtlSources.some(f=>f.name===m.sourceFilename))delete m.originalSource;const i=p.modules.findIndex(x=>x.name===m.name);if(i>=0)p.modules[i]=m;else p.modules.push(m);}
 p.orgEdited=true;return {project:W().normalize(p,project),changes:retirement.changes||[]};
}
function intake(project,files,options={}){
 if(!files.length)throw Error('請加入 RTL、org、Define 或 include 材料。');
 const cfg=D().normalize(project.defineConfig),seen=new Set(),defined=new Map(),sources=[],orgs=[],materials=[];
 for(const item of files){const f={name:D().pathName(String(item.name||'').trim()),text:String(item.text??''),role:item.role};if(!['rtl','org','defines','include'].includes(f.role))throw Error('請指定 '+f.name+' 的用途。');if(seen.has(f.name))throw Error('材料路徑重複：'+f.name);seen.add(f.name);materials.push({name:f.name,role:f.role,bytes:new TextEncoder().encode(f.text).length});
  if(f.role==='defines'){for(const row of D().importHeader(f.text)){if(defined.has(row.name))throw Error('本次材料重複定義 '+row.name+'；請保留一個明確來源。');defined.set(row.name,row);const i=cfg.rows.findIndex(x=>x.name===row.name);if(i<0)cfg.rows.push(row);else cfg.rows[i]={...cfg.rows[i],...row};}}
  else if(f.role==='include'){const i=cfg.includes.findIndex(x=>x.name===f.name);if(i<0)cfg.includes.push({name:f.name,text:f.text});else cfg.includes[i]={name:f.name,text:f.text};}
  else if(f.role==='org')orgs.push(f);else sources.push(f);
 }
 if(orgs.length>1)throw Error('一次只能匯入一份 Top org。');
 const configChanged=D().fingerprint(cfg)!==D().fingerprint(project.defineConfig);
 const definePlan=configChanged?D().plan(project,cfg,P()):{project:clone(project),changes:[],defineChanges:[]};
 const result={modules:[],issues:[],sources:[]},moduleNames=new Set();
 for(const f of sources){const r=P().parseRtl(f.text,{config:cfg,filename:f.name});for(const m of r.modules){if(moduleNames.has(m.name))throw Error('不同材料重複宣告 module '+m.name+'。');moduleNames.add(m.name);}result.modules.push(...r.modules);result.issues.push(...r.issues);result.sources.push(...r.sources);}
 const fatal=result.issues.filter(i=>i.severity==='error');
 if(fatal.length){const error=Error(fatal.map(i=>i.message).join('\n'));error.issues=fatal;throw error;}
 let merged=result.sources.length?mergeRtl(definePlan.project,result,options.targetModule):{project:definePlan.project,changes:[]};
 let p=merged.project,orgNeedsName=false,orgIssues=[];
 if(orgs.length){const f=orgs[0],r=P().importOrg(f.text,p.modules,{filename:f.name});orgNeedsName=r.issues.some(i=>i.code==='TOP_NAME_MISSING');orgIssues=r.issues;const prior=p;p={...p,...r.project,defineConfig:cfg,rtlSources:p.rtlSources,archivedRtlSources:p.archivedRtlSources,workbook:clone(p.workbook),originalOrg:f.text,originalOrgFilename:f.name,orgEdited:false};p=W().normalize(p,prior);}
 p.defineConfig=cfg;
 return {project:W().normalize(p,project),modules:result.modules,issues:result.issues.concat(orgIssues),materials,org:!!orgs.length,orgNeedsName,defineChanges:definePlan.defineChanges,sourceChanges:merged.changes,impact:compareInterfaces(project,p)};
}
function addInstances(project,counts){const p=clone(project),added=[],parameterNames=Array.isArray(p.parameters)?p.parameters.map(x=>x.name):Object.keys(p.parameters||{}),reserved=new Set([...p.instances.map(i=>i.name),...p.nets.map(n=>n.name),...parameterNames]);for(const [module,value]of Object.entries(counts||{})){const count=Number(value);if(!Number.isInteger(count)||count<0||count>64)throw Error(module+' 的新增顆數請填 0～64。');if(!p.modules.some(m=>m.name===module))throw Error('找不到模組 '+module);for(let k=0;k<count;k++){let n=0,name=module+'_inst';while(reserved.has(name))name=module+'_inst'+(++n);reserved.add(name);let serial=1,id='r118_import_'+serial;while(p.instances.some(i=>i.id===id))id='r118_import_'+(++serial);const row={id,name,module,parameters:{}};p.instances.push(row);added.push(row);}}return {project:W().normalize(p,project),added};}
function remapBindings(project,mappings){const p=clone(project);for(const [id,port]of Object.entries(mappings||{})){if(!port)continue;const c=p.connections.find(c=>c.id===id);if(!c)throw Error('舊綁定已不存在，請重新預覽。');const i=p.instances.find(i=>i.id===c.instance),m=i&&p.modules.find(m=>m.name===i.module);if(!m?.ports.some(p=>p.name===port))throw Error('找不到新接腳 '+port);if(p.connections.some(other=>other.id!==id&&other.instance===c.instance&&other.port===port))throw Error(i.name+'.'+port+' 已有接線，不會覆蓋。');c.port=port;}return W().normalize(p,project);}
function pinMap(project){const p=C().projectView(project),pars=Array.isArray(p.parameters)?p.parameters:Object.entries(p.parameters||{}).map(([name,value])=>({name,value}));const top=C().resolveParameters({parameters:pars},{}),out=new Map();for(const instance of p.instances){const m=p.modules.find(m=>m.name===instance.module);if(!m)continue;const ctx=C().resolveParameters(m,instance.parameters||{},top.context);for(const port of m.ports){let width=null,error='';try{if(ctx.errors.length)throw Error(ctx.errors.map(e=>e.message).join('；'));width=C().parseRange(port.range,ctx.context).width;}catch(e){error=e.message;}const binding=project.connections.find(c=>c.instance===instance.id&&c.port===port.name);out.set(instance.id+'::'+port.name,{instance:instance.id,instanceName:instance.name,module:m.name,port:port.name,direction:port.direction,signed:!!port.signed,range:port.range||'',width,error,expr:binding?.expr??null,connectionId:binding?.id,ref:binding?{type:'connection',id:binding.id}:{type:'instance',id:instance.id,port:port.name}});}}return out;}
function compareInterfaces(before,after){const a=pinMap(before),b=pinMap(after),rows=[];for(const key of new Set([...a.keys(),...b.keys()])){const old=a.get(key),next=b.get(key),sample=next||old;let state=!old?'added':!next?'missing':old.direction!==next.direction||old.width!==next.width||old.range!==next.range||old.error!==next.error?'changed':'kept';rows.push({...sample,state,before:old||null,after:next||null,ref:next?.ref||old?.ref});}const errors=C().validate(after).filter(i=>i.severity==='error');return {rows,changed:rows.filter(r=>r.state!=='kept'),kept:rows.filter(r=>r.state==='kept').length,errors,affectedInstances:[...new Set(rows.filter(r=>r.state!=='kept').map(r=>r.instanceName))]};}
function parameterImpact(project,instance,parameters){const before=clone(project),existing=before.instances.find(i=>i.id===instance.id);if(!existing)before.instances.push({...instance,parameters:{}});const next=clone(before),target=next.instances.find(i=>i.id===instance.id);target.parameters=clone(parameters);const impact=compareInterfaces(before,next);return {project:next,rows:impact.rows.filter(r=>r.instance===instance.id),errors:impact.errors.filter(e=>e.ref?.id===instance.id||next.connections.some(c=>c.instance===instance.id&&c.id===e.ref?.id))};}
return {classify,intake,mergeRtl,addInstances,remapBindings,pinMap,compareInterfaces,parameterImpact};
});
