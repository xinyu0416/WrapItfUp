/* Pure workflow operations. Previews never mutate the caller's project. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIUFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  const clone = value => JSON.parse(JSON.stringify(value));
  function dep(name, file) { return root[name] || (typeof require === 'function' ? require('./' + file) : null); }
  const core = () => dep('WIUCore','assembly-core.js');
  const parser = () => dep('WIUParser','assembly-parser.js');
  const defines = () => dep('WIUDefines','assembly-defines.js');
  const issue = (code,message,extra) => Object.assign({severity:'error',code,message},extra || {});
  const error = issues => issues.some(x => x.severity === 'error');
  function uid(rows, prefix) { const used = new Set(arr(rows).map(x=>x.id));let i=1;while(used.has(prefix+i))i++;return prefix+i; }
  function topParameters(p) {return Array.isArray(p.parameters)?p.parameters:Object.entries(p.parameters||{}).map(([name,value])=>({name,value}));}
  function context(p) {return core().resolveParameters({parameters:topParameters(p)},{});}
  function sameRange(a,b,ctx) {try {return core().parseRange(a,ctx).width===core().parseRange(b,ctx).width;}catch(_){return false;}}

  // New instances only: existing names, IDs, parameters and bindings are immutable.
  function planInstances(project,moduleName,options={}) {
    const C=core(),p=clone(project),issues=[],count=Number(options.count??1),start=Number(options.start??0);
    const mod=arr(p.modules).find(m=>m.name===moduleName);
    const base=String(options.base??(moduleName+'_inst')).trim();
    if(!mod)issues.push(issue('INSTANCE_MODULE','找不到子模組 '+moduleName+'。'));
    if(!Number.isInteger(count)||count<1||count>64)issues.push(issue('INSTANCE_COUNT','新增數量請填 1～64。'));
    if(!Number.isSafeInteger(start)||start<0)issues.push(issue('INSTANCE_START','起始編號需為非負整數。'));
    if(!C.validName(base))issues.push(issue('INSTANCE_BASE','名稱前綴不是有效的 Verilog 識別字。'));
    if(issues.length)return {project:clone(project),added:[],changes:[],issues};
    const names=new Set(arr(p.instances).map(i=>i.name).concat(arr(p.nets).map(n=>n.name),topParameters(p).map(n=>n.name)));
    p.instances=arr(p.instances);const added=[];let suffix=start;
    try{for(let n=0;n<count;n++){
      const numbered=()=>{if(!Number.isSafeInteger(suffix))throw Error('編號超出可安全表示的整數範圍，請降低起始編號。');return base+(options.numbered?'':'_')+suffix++;};
      let name=!options.numbered&&count===1&&!names.has(base)?base:numbered();
      while(names.has(name))name=numbered();
      names.add(name);
      const inst={id:uid(p.instances,'i_added_'),module:moduleName,name,parameters:{}};
      p.instances.push(inst);added.push(clone(inst));
    }}catch(e){return {project:clone(project),added:[],changes:[],issues:[issue('INSTANCE_SUFFIX',e.message)]};}
    p.orgEdited=true;
    return {project:p,added,changes:added.map(i=>'新增 '+i.name),issues};
  }

  function parseInterface(text, options) {
    const opt=options||{},C=core(),P=parser(),issues=[];
    let source=String(text||'').replace(/^\uFEFF/,'');
    if(source.length>1024*1024)return {ports:[],parameters:[],issues:[issue('INTERFACE_SIZE','介面文字超過 1 MB。')]};
    const name=opt.name||'interface_preview';
    if(!C.validName(name))return {ports:[],parameters:[],issues:[issue('INTERFACE_NAME','請輸入有效的 module 名稱。')]};
    if(!/\bmodule\s/.test(P.stripComments(source))) {
      // Each simple row is self-contained; accepting a missing direction would
      // hide a common spreadsheet paste mistake.
      const rows=source.replace(/\/\*[\s\S]*?\*\//g,'').split(/\r?\n/),ports=[];
      for(let index=0;index<rows.length;index++) {
        let row=rows[index].replace(/\/\/.*$/,'').trim().replace(/[;,]\s*$/,'').trim();
        if(!row)continue;
        const match=/^(input|output|inout)\s+(?:(?:wire|logic|reg)\s+)?(?:(signed|unsigned)\s+)?(.+)$/.exec(row);
        if(!match){issues.push(issue('INTERFACE_ROW','第 '+(index+1)+' 行請寫成 input clk 或 output data [7:0]。',{line:index+1}));continue;}
        const rest=match[3].trim(),front=/^(\[[^\]\r\n]+\])\s*([A-Za-z_][A-Za-z0-9_$]*)$/.exec(rest),back=/^([A-Za-z_][A-Za-z0-9_$]*)\s*(\[[^\]\r\n]+\])?$/.exec(rest);
        if(!front&&!back){issues.push(issue('INTERFACE_ROW','第 '+(index+1)+' 行只能有一個 port；多個 port 請分行或貼上完整 module。',{line:index+1}));continue;}
        const portName=front?front[2]:back[1],range=front?front[1]:(back[2]||'');
        if(!C.validName(portName)){issues.push(issue('INTERFACE_PORT_NAME','無效的 port 名稱：'+portName));continue;}
        ports.push(match[1]+' '+(match[2]==='signed'?'signed ':'')+(range?range+' ':'')+portName);
      }
      if(error(issues))return {ports:[],parameters:[],issues};
      source='module '+name+' (\n'+ports.map(x=>'  '+x).join(',\n')+'\n);\nendmodule\n';
    }
    const result=P.parseRtl(source,{config:opt.config||defines().defaults(),filename:name+'.v'});
    issues.push(...result.issues);
    if(result.modules.length!==1)issues.push(issue('INTERFACE_MODULE_COUNT','請一次提供一個 module 的介面。'));
    const mod=result.modules[0];
    if(!mod||error(issues))return {ports:[],parameters:[],issues};
    if(!mod.ports.length)issues.push(issue('INTERFACE_EMPTY','請至少宣告一個 input、output 或 inout。'));
    return {ports:clone(mod.ports),parameters:clone(mod.parameters),issues,name:mod.name};
  }

  function makePlaceholder(name,text,options) {
    const opt=Object.assign({},options||{},{name}),parsed=parseInterface(text,opt);
    if(error(parsed.issues))return {module:null,source:'',filename:name+'.v',issues:parsed.issues};
    const params=parsed.parameters.map(p=>(p.local?'localparam ':'parameter ')+(p.type?p.type+' ':'')+p.name+' = '+p.value);
    const lines=['module '+name+(params.length?' #(\n  '+params.join(',\n  ')+'\n)':'')+' ('];
    parsed.ports.forEach((p,i)=>lines.push('  '+p.direction+' wire '+(p.signed?'signed ':'')+(p.range?p.range+' ':'')+p.name+(i<parsed.ports.length-1?',':'')));
    lines.push(');');
    lines.push('endmodule','');
    const source=lines.join('\n'),result=parser().parseRtl(source,{config:opt.config||defines().defaults(),filename:name+'.v'});
    const mod=result.modules[0];
    if(mod){delete mod.originalSource;mod.placeholder=true;mod.interfaceOnly=true;mod.placeholderReason='介面骨架；輸出尚未加入功能邏輯。';}
    return {module:mod||null,source,filename:name+'.v',issues:result.issues};
  }

  function addTopInterface(project,text) {
    const p=clone(project),parsed=parseInterface(text,{name:p.top,config:p.defineConfig}),issues=parsed.issues.slice(),changes=[];
    if(error(issues))return {project:p,changes,issues};
    for(const port of parsed.ports) {
      const existing=arr(p.nets).find(n=>n.name===port.name);
      if(existing){issues.push(issue('INTERFACE_DUPLICATE','Top 已有 '+port.name+'，請在 Top ports 中修改，不會覆蓋既有線路。'));continue;}
      if(arr(p.nets).some(n=>n.name.toLowerCase()===port.name.toLowerCase())||arr(p.instances).some(i=>i.name===port.name)||topParameters(p).some(x=>x.name===port.name)){issues.push(issue('INTERFACE_COLLISION','名稱與既有項目衝突：'+port.name));continue;}
      p.nets.push(Object.assign({id:uid(p.nets,'n_flow_'),group:''},port));changes.push('新增 Top '+port.direction+' '+port.name+(port.range?' '+port.range:''));
    }
    // Imported parameter declarations are explicit and retain their expression.
    const current=topParameters(p);
    for(const param of parsed.parameters) {
      if(current.some(x=>x.name===param.name)){issues.push(issue('INTERFACE_PARAMETER_DUPLICATE','Top parameter 已存在：'+param.name));continue;}
      current.push(param);changes.push('新增 Top parameter '+param.name+' = '+param.value);
    }
    if(parsed.parameters.length)p.parameters=current;
    return {project:error(issues)?clone(project):p,changes,issues};
  }

  function previewAutoConnect(project) {
    const C=core(),prepared=defines().resolveProject(project),p=prepared.project,groups=[],skipped=[],issues=prepared.issues.slice(),byName=new Map(),bound=new Map(arr(p.connections).map(c=>[c.instance+'::'+c.port,c])),top=context(p);
    if(error(issues))return {groups,skipped,issues};
    if(top.errors.length)return {groups,skipped,issues:top.errors.map(x=>issue('AUTO_PARAMETER',x.message))};
    for(const inst of arr(p.instances)) {
      const mod=arr(p.modules).find(m=>m.name===inst.module);
      if(!mod){issues.push(issue('AUTO_MODULE','找不到 module：'+inst.module));continue;}
      const resolved=C.resolveParameters(mod,inst.parameters||{},top.context);
      for(const port of arr(mod.ports)) {
        const ep={instance:inst.id,instanceName:inst.name,module:mod.name,port:port.name,direction:port.direction,signed:!!port.signed,range:port.range,connection:bound.get(inst.id+'::'+port.name)};
        try {if(resolved.errors.length)throw Error('參數未解析');ep.width=C.parseRange(port.range,resolved.context).width;}catch(e){ep.error=e.message;}
        if(!byName.has(port.name))byName.set(port.name,[]);byName.get(port.name).push(ep);
      }
    }
    const baseline=new Set(C.validate(project).filter(x=>x.severity==='error').map(x=>x.code+'|'+x.message));
    for(const [name,eps] of byName) {
      const pending=eps.filter(ep=>!ep.connection);if(!pending.length)continue;
      const skip=reason=>skipped.push({name,reason,endpoints:eps.map(ep=>ep.instanceName+'.'+ep.port)});
      if(eps.some(ep=>ep.error)){skip('位寬或參數尚未確定。');continue;}
      if(new Set(eps.map(ep=>ep.width)).size!==1){skip('同名 pin 位寬不同，請明確選擇 bus slice。');continue;}
      if(new Set(eps.map(ep=>ep.signed)).size!==1){skip('同名 pin 的 signed/unsigned 不一致。');continue;}
      if(eps.some(ep=>ep.direction==='inout')){skip('inout 需要人工確認三態與驅動關係。');continue;}
      if(eps.some(ep=>!['input','output'].includes(ep.direction))){skip('port 方向無法確認。');continue;}
      if(eps.filter(ep=>ep.direction==='output').length>1){skip('有多個 output，可能是獨立通道；不會將它們短接。');continue;}
      if(eps.some(ep=>ep.connection&&ep.connection.expr.trim()!==name)){skip('已有接線、切片或明確空接；保留原設定，請手動處理其餘 pin。');continue;}
      const existing=arr(p.nets).find(n=>n.name===name),repeated=eps.some((ep,i)=>eps.slice(0,i).some(other=>other.module===ep.module&&ep.direction==='input'&&other.direction==='input'));
      const sharedClock=existing&&existing.direction==='input'&&/^(?:clk|clock|rst|reset)(?:_?[A-Za-z0-9]+)*$/i.test(name);
      if(repeated&&!sharedClock&&!(existing&&existing.shared===true)){skip('同一 module 的多個 instance 有此輸入，可能分屬獨立通道；請使用通道對應或明確設定共用 net。');continue;}
      if(!C.validName(name)||arr(p.nets).some(n=>n.name!==name&&n.name.toLowerCase()===name.toLowerCase())||arr(p.instances).some(i=>i.name===name)||topParameters(p).some(x=>x.name===name)){skip('名稱與既有符號衝突。');continue;}
      if(existing&&(!sameRange(existing.range,eps[0].width===1?'':'['+(eps[0].width-1)+':0]',top.context)||!!existing.signed!==eps[0].signed)){skip('既有 net 的位寬或 signed 屬性不同。');continue;}
      const outputs=eps.filter(ep=>ep.direction==='output'),inputs=eps.filter(ep=>ep.direction==='input');
      const net=existing?null:{id:uid(arr(p.nets).concat(groups.filter(g=>g.net).map(g=>g.net)),'n_auto_'),name,direction:outputs.length?(inputs.length?'wire':'output'):'input',range:eps[0].width===1?'':'['+(eps[0].width-1)+':0]',signed:eps[0].signed,comment:'',group:''};
      const bindings=pending.map(ep=>({instance:ep.instance,port:ep.port,expr:name})),candidate=clone(p);if(net)candidate.nets.push(net);
      for(const binding of bindings)candidate.connections.push(Object.assign({id:uid(candidate.connections,'c_auto_')},binding));
      const newErrors=C.validate(candidate).filter(x=>x.severity==='error'&&!baseline.has(x.code+'|'+x.message));
      if(newErrors.length){skip('接線會產生檢查錯誤：'+newErrors[0].message);continue;}
      groups.push({id:name,name,net,bindings,endpoints:eps.map(ep=>ep.instanceName+'.'+ep.port),reason:existing?'連到已宣告的 '+existing.direction+' '+name:outputs.length?(inputs.length?'單一 output 驅動同名 input，建立內部 wire。':'單一 output，引出為 Top output。'):'只有 input，建立 Top input。'});
    }
    return {groups,skipped,issues};
  }

  function applyAutoConnect(project,groupIds) {
    const p=clone(project),preview=previewAutoConnect(project),selected=new Set(arr(groupIds)),changes=[],issues=preview.issues.slice();
    for(const id of selected)if(!preview.groups.some(g=>g.id===id))issues.push(issue('AUTO_STALE','自動接線預覽已變更，請重新檢查：'+id));
    if(error(issues))return {project:p,changes,issues};
    for(const group of preview.groups.filter(g=>selected.has(g.id))) {
      if(group.net){const net=clone(group.net);net.id=uid(p.nets,'n_auto_');p.nets.push(net);changes.push('新增 '+net.direction+' '+net.name);}
      for(const binding of group.bindings){p.connections.push(Object.assign({id:uid(p.connections,'c_auto_')},binding));changes.push(binding.instance+'.'+binding.port+' → '+binding.expr);}
    }
    return {project:p,changes,issues};
  }

  function retireReplacedSources(project,parsedResult) {
    const p=clone(project),parsed=parsedResult||{},issues=[],changes=[],incoming=arr(parsed.modules),files=arr(parsed.sources);
    if(error(arr(parsed.issues)))return {project:p,changes,issues:arr(parsed.issues).filter(i=>i.severity==='error')};
    const incomingFiles=new Set(files.map(f=>f.name)),incomingNames=new Set(incoming.map(m=>m.name));
    const sourceName=m=>m.sourceFilename||m.filename||m.name+'.v',sources=defines().sourcesFor(project),candidates=new Map();
    for(const mod of incoming) {
      const previous=arr(project.modules).find(m=>m.name===mod.name);if(!previous)continue;
      const oldName=sourceName(previous),newName=sourceName(mod);
      if(oldName===newName||incomingFiles.has(oldName))continue;
      const oldFile=sources.find(f=>f.name===oldName);
      if(!oldFile){issues.push(issue('REPLACEMENT_SOURCE_MISSING','找不到 '+oldName+' 的完整原文，無法安全替換來源；請以原檔名重新匯入完整 RTL。'));continue;}
      if(!files.some(f=>f.name===newName)){issues.push(issue('REPLACEMENT_SOURCE_MISSING','新來源 '+newName+' 沒有完整原文；請重新選取 RTL 檔案。'));continue;}
      if(!candidates.has(oldName))candidates.set(oldName,{file:oldFile,replacedBy:new Set()});
      candidates.get(oldName).replacedBy.add(newName);
    }
    if(!candidates.size)return {project:p,changes,issues};
    for(const [oldName,entry] of candidates) {
      // Inspect all physical declarations, not only the currently active
      // ifdef branch. Otherwise a later profile switch resurrects a sibling
      // module that was silently discarded with the superseded file.
      const clean=parser().stripComments(entry.file.text).replace(/"(?:\\[\s\S]|[^"\\])*"/g,' ');
      const physical=[...clean.matchAll(/\bmodule\s+(?:(?:automatic|static)\s+)?([A-Za-z_][A-Za-z0-9_$]*)/g)].map(match=>match[1]);
      const declared=[...new Set(physical)],unknown=clean.match(/\bmodule\b/g)||[];
      if(!declared.length||unknown.length!==physical.length){issues.push(issue('REPLACEMENT_SOURCE_UNCERTAIN','無法確認 '+oldName+' 裡所有 module 的名稱；請用原檔名重新匯入整份檔案。'));continue;}
      entry.modules=declared;
      const unreplaced=declared.filter(name=>!incomingNames.has(name));
      if(unreplaced.length)issues.push(issue('REPLACEMENT_SHARED_SOURCE','不能停用 '+oldName+'：它仍提供 '+unreplaced.join('、')+'（可能在其他 define 分支）。請用原檔名重新匯入包含全部 module 的完整檔案，或先拆分來源。'));
    }
    const references=sources.filter(f=>!candidates.has(f.name)&&!incomingFiles.has(f.name)).concat(files);
    const configs=[project.defineConfig].concat(arr(project.bundleConfig&&project.bundleConfig.profiles).map(profile=>profile.defineConfig));
    for(const cfg of configs)references.push(...arr(cfg&&cfg.includes));
    for(const file of references) {
      const clean=parser().stripComments(file.text||'');
      for(const match of clean.matchAll(/^[ \t]*`include[ \t]+"([^"\r\n]+)"/gm)) {
        let path;try {path=defines().pathName(match[1],file.name);}catch(_){continue;}
        const target=[...candidates.keys()].find(name=>{try{return defines().pathName(name)===path;}catch(_){return name===path;}});
        if(target)issues.push(issue('REPLACEMENT_INCLUDED_SOURCE',file.name+' 仍以 `include 引用 '+target+'；請先將 include 改成新檔名並一併重新匯入，或沿用 '+target+' 的原檔名替換。'));
      }
    }
    if(error(issues))return {project:p,changes,issues};
    p.archivedRtlSources=arr(p.archivedRtlSources);
    for(const [name,entry] of candidates) {
      const original=arr(project.rtlSources).find(f=>f.name===name)||entry.file,replacedBy=[...entry.replacedBy];
      const reason='同名 module 已由 '+replacedBy.join('、')+' 替換；保留原文備查，不再參與解析或編譯。';
      p.archivedRtlSources.push(Object.assign({},clone(original),{name,text:entry.file.text,reason,replacedBy,modules:entry.modules}));
      changes.push({kind:'source-retired',filename:name,replacedBy,message:name+' → 歷史來源（由 '+replacedBy.join('、')+' 替換）'});
    }
    p.rtlSources=arr(p.rtlSources).filter(f=>!candidates.has(f.name));
    return {project:p,changes,issues};
  }

  function previewReplacement(project,source,filename) {
    let p=clone(project);const parsed=parser().parseRtl(source,{config:p.defineConfig,filename}),issues=parsed.issues.slice(),changes=[],orphanBindings=[];
    const matches=parsed.modules.filter(mod=>arr(p.modules).some(old=>old.name===mod.name));
    if(!matches.length)issues.push(issue('REPLACEMENT_NO_MATCH','新 RTL 的 module 名稱與目前介面不符；請使用原 module 名稱替換。'));
    for(const old of arr(p.modules).filter(m=>(m.sourceFilename||m.filename)===filename))if(!parsed.modules.some(m=>m.name===old.name))issues.push(issue('REPLACEMENT_REMOVED_MODULE','此檔案原有的 '+old.name+' 不在新 RTL 中；請先處理對應 instance，再重新匯入。'));
    if(error(issues))return {project:p,changes,issues,orphanBindings};
    const retirement=retireReplacedSources(p,parsed);issues.push(...retirement.issues);changes.push(...retirement.changes);
    if(error(issues))return {project:p,changes,issues,orphanBindings};
    p=retirement.project;
    const oldView=core().projectView(p);
    for(const mod of matches) {
      const old=p.modules.find(m=>m.name===mod.name),before=oldView.modules.find(m=>m.name===mod.name);
      if(old.placeholder)changes.push({kind:'placeholder',module:mod.name,message:mod.name+'：以真實 RTL 替換介面預留'});
      for(const port of old.ports)if(!mod.ports.some(x=>x.name===port.name)){changes.push({kind:'removed',module:mod.name,port:port.name,message:mod.name+'.'+port.name+' 已移除；既有接線保留待修正'});orphanBindings.push(...p.connections.filter(c=>p.instances.some(i=>i.id===c.instance&&i.module===mod.name)&&c.port===port.name));}
      for(const port of mod.ports) {
        const previous=old.ports.find(x=>x.name===port.name);
        if(!previous)changes.push({kind:'added',module:mod.name,port:port.name,message:mod.name+'.'+port.name+' 新增，請設定接線或明確空接'});
        else {if(previous.direction!==port.direction)changes.push({kind:'direction',module:mod.name,port:port.name,before:previous.direction,after:port.direction,message:mod.name+'.'+port.name+' 方向 '+previous.direction+' → '+port.direction});if(!!previous.signed!==!!port.signed)changes.push({kind:'signed',module:mod.name,port:port.name,message:mod.name+'.'+port.name+' signed 屬性變更'});}
      }
      for(const inst of p.instances.filter(i=>i.module===mod.name)) {
        const outer=context(oldView).context,a=core().resolveParameters(before,inst.parameters||{},outer),b=core().resolveParameters(mod,inst.parameters||{},outer);
        for(const port of mod.ports){const previous=before.ports.find(x=>x.name===port.name);if(!previous)continue;try {const aw=core().parseRange(previous.range,a.context).width,bw=core().parseRange(port.range,b.context).width;if(aw!==bw)changes.push({kind:'width',module:mod.name,instance:inst.id,port:port.name,before:aw,after:bw,message:inst.name+'.'+port.name+' 位寬 '+aw+' → '+bw});}catch(e){changes.push({kind:'unresolved',module:mod.name,instance:inst.id,port:port.name,message:inst.name+'.'+port.name+' 位寬待確認：'+e.message});}}
      }
      const replacement=clone(mod);delete replacement.originalSource;replacement.placeholder=false;p.modules[p.modules.indexOf(old)]=replacement;
    }
    p.rtlSources=arr(p.rtlSources).filter(f=>f.name!==filename).concat(parsed.sources);
    return {project:p,changes,issues,orphanBindings};
  }

  // These two source strings are byte-for-byte copies of the supplied tutorial.
  return {planInstances,parseInterface,makePlaceholder,addTopInterface,previewAutoConnect,applyAutoConnect,retireReplacedSources,previewReplacement,
    fixtures:()=>[],tutorialTasks:()=>[],createTutorial:()=>{throw Error('請使用公開版完整範本。');},previewTutorialStep:()=>{throw Error('請切換一般編輯。');},completeTutorial:()=>{throw Error('請使用公開版完整範本。');}};
});
