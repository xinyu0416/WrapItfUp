/* Data-only plans. Every apply is performed by the existing project history. */
(function(root,factory){const api=factory(root);root.WIUWorkflowR119=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const dep=(key,file)=>root[key]||(typeof require==='function'?require('./'+file):null);
const C=()=>dep('WIUCore','assembly-core.js'),A=()=>dep('WIUActions','assembly-actions.js'),I=()=>dep('WIUImportReview','import-review-r118.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function pastedConnections(project,text){
 const pins=[...I().pinMap(project).values()],byName=new Map(pins.map(p=>[p.instanceName+'.'+p.port,p])),seen=new Set(),changes=[],rows=[],errors=[];
 const top=C().resolveParameters({parameters:C().projectView(project).parameters||[]},{}).context;
 let formatErrors=0;
 String(text).replace(/^\uFEFF/,'').split(/\r?\n/).forEach((line,index)=>{if(!line.trim())return;
  const cols=line.includes('\t')?line.split('\t'):line.trim().split(/\s+(.+)/s).slice(0,2);
  if(/^(instance\.?pin|pin|接腳)$/i.test(cols[0].trim()))return;
  const name=cols[0].trim(),raw=String(cols[1]??'').trim(),pin=byName.get(name),row={line:index+1,name,raw,errors:[],source:'',destination:name};rows.push(row);
  if(cols.length!==2){row.errors.push('需要兩欄：instance.pin 與連線');formatErrors++;return;}
  if(!pin){row.errors.push('找不到接腳 '+name);return;}if(seen.has(name)){row.errors.push('重複目標 '+name);return;}seen.add(name);
  if(!raw){row.errors.push('空白不代表 NC，請填 NC 或 UNSET');return;}
  const expr=/^(NC|"")$/i.test(raw)?'':/^UNSET$/i.test(raw)?null:raw;
  if(expr)try{C().expressionInfo(C().expandDefines(expr,project),project.nets,top);}catch(e){row.errors.push(e.message);return;}
  row.source=pin.direction==='output'?name:(expr===null?'未設定':expr===''?'NC':expr);row.destination=pin.direction==='output'?(expr||'NC'):name;row.direction=pin.direction;
  changes.push({instance:pin.instance,port:pin.port,expr});
 });
 if(formatErrors)errors.push(formatErrors+' 列格式不完整；使用 Tab 分成兩欄，或以空白分開 instance.pin 與完整運算式。');
 const trial=clone(project);A().applyConnections(trial,changes);
 const issueKey=x=>x.code+'|'+JSON.stringify(x.ref)+'|'+x.message,existing=new Set(C().validate(project).filter(x=>x.severity==='error').map(issueKey));
 for(const issue of C().validate(trial).filter(x=>x.severity==='error'&&x.code!=='UNCONFIGURED_PIN'&&!existing.has(issueKey(x)))){
  const c=trial.connections.find(c=>issue.ref?.type==='connection'&&c.id===issue.ref.id),pin=c&&pins.find(p=>p.instance===c.instance&&p.port===c.port),row=pin&&rows.find(r=>r.name===pin.instanceName+'.'+pin.port);
  if(row)row.errors.push(issue.message);else errors.push(issue.message);
 }
 const bad=rows.filter(r=>r.errors.length);if(bad.length)errors.unshift(bad.length+' 列待修正，請直接修改紅色列後重新檢查。');
 return {changes,rows,errors:[...new Set(errors)],project:trial};
}
function slices(project,keys,{name,start=0,direction='up',reverse=false}={}){
 if(!C().validName(name)||!Number.isSafeInteger(start)||start<0)throw Error('Bus 名稱與起始 bit 必須有效。');
 const map=I().pinMap(project),rows=keys.map(k=>map.get(k));if(!rows.length||rows.some(x=>!x))throw Error('接腳已變更，請重新選取。');
 if(reverse)rows.reverse();let cursor=start;const ranges=[],changes=[];
 for(const row of rows){if(row.error||!Number.isSafeInteger(row.width)||row.width<1)throw Error(row.instanceName+'.'+row.port+' 的位寬無法解析。');
  const lo=direction==='down'?cursor-row.width+1:cursor,hi=direction==='down'?cursor:cursor+row.width-1;if(lo<0)throw Error('分配到負 bit；請提高起始 bit。');cursor+=direction==='down'?-row.width:row.width;
  ranges.push({lo,hi,label:row.instanceName+'.'+row.port});changes.push({instance:row.instance,port:row.port,expr:name+'['+hi+(hi===lo?'':':'+lo)+']'});
 }
 const existing=project.nets.find(n=>n.name===name),max=Math.max(...ranges.map(r=>r.hi));
 if(existing){const params=C().resolveParameters({parameters:C().projectView(project).parameters||[]},{});const r=C().parseRange(C().expandDefines(existing.range,project),params.context);const min=Math.min(r.msb??0,r.lsb??0),upper=Math.max(r.msb??0,r.lsb??0);if(ranges.some(x=>x.lo<min||x.hi>upper))throw Error('切片超出 '+name+(existing.range||'（純量）')+' 的宣告範圍。');}
 const nets=existing?[]:[{id:'r119_bus_'+Date.now(),name,range:'['+max+':0]',direction:'wire',signed:false,group:'',comment:''}];
 return {changes,nets,ranges};
}
function netCandidates(project,key){
 const row=I().pinMap(project).get(key);if(!row)return [];
 return project.nets.map(n=>{const candidate=clone(project);A().applyConnections(candidate,[{instance:row.instance,port:row.port,expr:n.name}]);
  const connection=candidate.connections.find(c=>c.instance===row.instance&&c.port===row.port),errors=C().validate(candidate).filter(e=>e.severity==='error'&&((e.ref?.type==='connection'&&e.ref.id===connection?.id)||(e.ref?.type==='net'&&e.ref.id===n.id)));
  const drivers=[...(n.direction==='input'?['Top input']:[]),...[...I().pinMap(project).values()].filter(p=>p.direction==='output'&&p.expr===n.name&&p.instance+'::'+p.port!==key).map(p=>p.instanceName+'.'+p.port)];
  return {name:n.name,range:n.range||'1 bit',direction:n.direction,drivers,errors:errors.map(e=>e.message)};
 });
}
function groupPairs(project,sourceKeys,targetId,stripPrefix=''){
 const pins=[...I().pinMap(project).values()],source=sourceKeys.map(k=>pins.find(p=>p.instance+'::'+p.port===k)).filter(Boolean),targets=pins.filter(p=>p.instance===targetId),used=new Set(),pairs=[],skipped=[];
 const normalize=name=>stripPrefix&&name.startsWith(stripPrefix)?name.slice(stripPrefix.length):name;
 for(const a of source){const matches=targets.filter(b=>b.instance!==a.instance&&normalize(a.port)===normalize(b.port));
  if(matches.length!==1){skipped.push({name:a.instanceName+'.'+a.port,reason:matches.length?'同名目標不唯一':'沒有同名目標'});continue;}const b=matches[0],key=b.instance+'::'+b.port;
  if(used.has(key)){skipped.push({name:a.instanceName+'.'+a.port,reason:'目標已被其他成員配對'});continue;}
  if(a.error||b.error||a.width!==b.width||!['input/output','output/input'].includes(a.direction+'/'+b.direction)){skipped.push({name:a.instanceName+'.'+a.port,reason:'方向或位寬不相容'});continue;}
  if(a.expr!=null||b.expr!=null){skipped.push({name:a.instanceName+'.'+a.port,reason:'已有設定，請個別核對後再配對'});continue;}
  used.add(key);pairs.push({source:a,target:b});
 }
 return {pairs,skipped};
}
function dirtyField(field){return !!(field&&field.isConnected&&typeof field.value==='string'&&field.value!==field.defaultValue);}
function namedParameters(project,instances,values){const p=clone(project);for(const i of instances){const row=p.instances.find(x=>x.id===i.id);if(!row)throw Error('找不到 instance '+i.name);row.parameters=Object.fromEntries(Object.entries(values[i.id]||{}).filter(([,v])=>String(v).trim()).map(([k,v])=>[k,String(v).trim()]));const params=C().instanceParameterRows(p,row);if(params.some(x=>x.error))throw Error(row.name+'：'+params.filter(x=>x.error).map(x=>x.error).join('；'));}const ids=new Set(instances.map(i=>i.id));const bad=[...I().pinMap(p).values()].filter(row=>ids.has(row.instance)&&row.error);if(bad.length)throw Error(bad.map(row=>row.instanceName+'.'+row.port+'：'+row.error).join('；'));return p;}
function saveProfile(project,name){name=String(name).trim();if(!name)throw Error('請輸入組態名稱。');const p=clone(project),D=dep('WIUDefines','assembly-defines.js');p.workbook=p.workbook||{};const profiles=p.workbook.defineProfiles||p.bundleConfig?.profiles||[];if(profiles.some(x=>x.name===name))throw Error('組態名稱已存在。');p.workbook.defineProfiles=[...profiles,{name,defineConfig:D.normalize(p.defineConfig)}];return p;}
function executionFiles(project){const K=dep('WIUCompany','assembly-company.js'),plan=K.scriptPlan(project),list=[{path:plan.filename,text:K.script(project),description:'公司 C-shell 執行腳本；從解壓目錄執行 csh '+plan.filename+'。'}];try{const config=K.files(project).find(f=>f.path==='delivery-config.json');if(!config)throw Error('工作包未提供設定檔');list.push({...config,description:'與工作包相同的完整設定檔，含 inputs 與驗證設定。'});}catch(e){list.push({path:'execution-plan.preview.json',text:JSON.stringify(plan,null,2)+'\n',description:'設定草稿，尚非可執行的 delivery-config.json。工作包仍待修正：'+e.message});}return list;}
return {pastedConnections,slices,netCandidates,groupPairs,dirtyField,namedParameters,saveProfile,executionFiles};
});
