(function(root,factory){
  'use strict';
  const get=(key,file)=>root&&root[key]||(typeof require==='function'?require(file):null);
  const api=factory(get('WIUCore','./assembly-core.js'),get('WIUDefines','./assembly-defines.js'),get('WIUParser','./assembly-parser.js'),get('WIUToolchainAssets','./assembly-toolchain-assets.js'));
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WIUBundle=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C,D,P,A){
  'use strict';
  const arr=x=>Array.isArray(x)?x:[],str=x=>x==null?'':String(x),clone=x=>JSON.parse(JSON.stringify(x)),encode=s=>new TextEncoder().encode(s);
  function defaults(){return {outputTies:[],profileName:'current',includeReferences:false,dualMode:true,profiles:[]};}
  function normalize(config){const c=config||{};return {outputTies:arr(c.outputTies).map(r=>({port:str(r.port).trim(),expr:str(r.expr).trim()})),profileName:str(c.profileName||'current').trim(),includeReferences:c.includeReferences===true,dualMode:c.dualMode!==false,profiles:arr(c.profiles).map(p=>({name:str(p.name).trim(),defineConfig:D.normalize(p.defineConfig)}))};}
  function safePath(value){const s=str(value);if(!s||s.length>200||s.includes('\\')||s.startsWith('/')||s.split('/').some(p=>!p||p==='.'||p==='..'||!/^[-A-Za-z0-9_.$]+$/.test(p)))throw Error('檔案路徑只能包含英數、底線、連字號、$ 與目錄，且不能跳出資料夾：'+s);return s;}
  function parameters(p){return Array.isArray(p.parameters)?p.parameters:Object.entries(p.parameters||{}).map(([name,value])=>({name,value}));}
  function validate(project,config){
    const c=normalize(config||project.bundleConfig),errors=[],warnings=[],outputs=[];
    const error=(code,message,port)=>errors.push({severity:'error',code,message,port:port||'',ref:{type:'bundle',id:port||code}});
    let p,context={};
    try{const prep=D.resolveProject(project);p=prep.project;for(const i of prep.issues)if(i.severity==='error')errors.push(i);const r=C.resolveParameters({parameters:parameters(p)},{});context=r.context;r.errors.forEach(e=>error('STUB_PARAMETER',e.message));}catch(e){error('STUB_CONFIG',e.message);return {errors,warnings,outputs,project,context,config:c};}
    if(!C.validName(p.top))error('STUB_TOP','請先輸入合法的 Top module 名稱。');
    if(!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(c.profileName)||c.profileName==='all')error('PROFILE_NAME','組態名稱以英數或底線開頭，可含連字號；all 為保留名稱。');
    const ports=arr(p.nets).filter(n=>n.direction!=='wire'),outMap=new Map(ports.filter(n=>n.direction==='output').map(n=>[n.name,n]));
    const seen=new Set(),ties=new Map();
    for(const row of c.outputTies){
      if(seen.has(row.port))error('STUB_DUPLICATE','同一個 output 不可設定兩次：'+row.port,row.port);seen.add(row.port);
      if(!outMap.has(row.port))error('STUB_OUTPUT','找不到完整的 Top output：'+row.port+'。僅支援整個 output，請勿使用 bit-select 左值。',row.port);
      if(!row.expr||/[\r\n;]/.test(row.expr))error('STUB_EXPRESSION','請為 '+row.port+' 輸入單行運算式，不含 assign 或分號。',row.port);
      ties.set(row.port,row.expr);
    }
    const portNames=new Set();for(const n of ports){
      if(!C.validName(n.name))error('STUB_PORT','不合法的 Top port 名稱：'+n.name,n.name);
      if(portNames.has(n.name))error('STUB_DUPLICATE_PORT','Top port 名稱重複：'+n.name,n.name);portNames.add(n.name);
      if(!['input','output','inout'].includes(n.direction))error('STUB_DIRECTION','Top port 方向必須是 input、output 或 inout：'+n.name,n.name);
      try{C.parseRange(n.range,context);}catch(e){error('STUB_RANGE',n.name+'：'+e.message,n.name);}
    }
    const graph=new Map();
    for(const [name,n] of outMap){
      try{
        const range=C.parseRange(n.range,context),expr=ties.has(name)?C.expandDefines(ties.get(name),project):range.width+"'d0";
        const info=C.expressionInfo(expr,ports,context);
        if(info.width!==range.width)warnings.push({severity:'warning',code:'STUB_WIDTH',message:name+' 是 '+range.width+' bit，右側是 '+info.width+' bit；保留原式，由 Verilog 指派規則補位或截斷，請核對意圖。',port:name});
        if(info.unsized)warnings.push({severity:'warning',code:'STUB_UNSIZED',message:name+' 使用未指定寬度的常數。',port:name});
        const refs=Array.from(new Set(info.refs.map(r=>r.name)));graph.set(name,refs.filter(r=>outMap.has(r)));
        if(refs.some(r=>ports.find(n=>n.name===r)?.direction==='inout'))warnings.push({severity:'warning',code:'STUB_INOUT_REF',message:name+' 讀取 inout；未被外部驅動時可能得到 Z/X。',port:name});
        outputs.push({port:name,range:n.range||'',width:range.width,expr,defaulted:!ties.has(name),refs});
      }catch(e){error('STUB_EXPRESSION',name+'：'+e.message,name);}
    }
    const done=new Set(),active=new Set();function visit(name,path){if(active.has(name)){error('STUB_CYCLE','Output 存在組合循環：'+path.concat(name).join(' → '),name);return;}if(done.has(name))return;active.add(name);for(const next of graph.get(name)||[])visit(next,path.concat(name));active.delete(name);done.add(name);}for(const name of graph.keys())visit(name,[]);
    const profileNames=new Set([c.profileName]);for(const profile of c.profiles){if(!/^[A-Za-z0-9_][-A-Za-z0-9_]*$/.test(profile.name)||profile.name==='all'||profileNames.has(profile.name))error('PROFILE_NAME','儲存的組態名稱重複或不合法：'+profile.name);profileNames.add(profile.name);D.validate(profile.defineConfig).forEach(i=>errors.push(i));}
    if(c.profiles.length>8)error('PROFILE_LIMIT','最多儲存 8 個額外組態。');
    for(const module of arr(p.modules).filter(m=>m.placeholder&&arr(p.instances).some(i=>i.module===m.name)))warnings.push({severity:'warning',code:'BUNDLE_PLACEHOLDER',module:module.name,message:module.name+' 仍是介面預留 RTL；產物是可連接的骨架，不代表真實功能。'});
    return {errors,warnings,outputs,project:p,context,config:c};
  }
  function assertValid(result){if(result.errors.length){const e=Error(result.errors.map(i=>i.message).join('\n'));e.issues=result.errors;throw e;}}
  function outputOrigin(output){return output.defaulted?'DEFAULT: no Empty override was entered; full-width zero.':'USER SET: explicit Empty override.';}
  function stub(project,config){
    const r=validate(project,config);assertValid(r);const p=r.project,ports=arr(p.nets).filter(n=>n.direction!=='wire'),pars=parameters(p),regular=pars.filter(p=>!p.local),lines=['// WIU single-configuration stub. Compile this OR the normal Top, never both.'];
    let header='module '+p.top;if(regular.length)header+=' #(\n'+regular.map(p=>'  parameter '+(p.type?'integer ':'')+p.name+' = '+p.value).join(',\n')+'\n)';
    lines.push(header+' (',ports.map(n=>'  '+n.name).join(',\n'),');');
    pars.filter(p=>p.local).forEach(p=>lines.push('localparam '+(p.type?'integer ':'')+p.name+' = '+p.value+';'));
    ports.forEach(n=>lines.push(n.direction+' '+(n.signed?'signed ':'')+(n.range?n.range+' ':'')+n.name+';'));
    lines.push('// The whole Top is replaced: no child instances or child logic remain.','// Inout ports remain undriven. Only output ports are assigned.');r.outputs.forEach(o=>lines.push('// '+o.port+' - '+outputOrigin(o),'assign '+o.port+' = '+o.expr+';'));lines.push('endmodule','');
    const overrides=r.outputs.filter(o=>!o.defaulted);
    const cfg=['// WIU output.cfg: optional overrides for the empty/stub implementation only.','// Consumed by gen_empty.py, not by the normal Top wiring generator.','// Do not add this file to a normal RTL filelist.','// An output omitted here keeps the original gen_empty.py default: zero.','// Explicit overrides cover whole outputs at full width; intentional zero is retained.',...(overrides.length?overrides.flatMap(o=>['// '+o.port+' - '+outputOrigin(o),'assign '+o.port+' = '+o.expr+';']):['// No overrides selected. All Empty outputs use the default zero.']),'',''].join('\n');
    return {configText:cfg,verilog:lines.join('\n'),outputs:r.outputs,warnings:r.warnings};
  }
  function wiringReview(project,config,mode){
    const r=validate(project,config);assertValid(r);const p=r.project;
    const bindings=arr(p.instances).flatMap(instance=>{
      const module=arr(p.modules).find(m=>m.name===instance.module);
      return arr(module&&module.ports).map(port=>{
        const binding=arr(p.connections).find(c=>c.instance===instance.id&&c.port===port.name),expr=binding?str(binding.expr):null;
        let kind=expr===null?'UNCONFIGURED':!expr.trim()?'OPEN':'CONNECTED';
        if(expr&&port.direction==='input'&&C.expressionInfo(expr,p.nets||[],r.context).refs.length===0)kind='CONSTANT INPUT';
        return {instance:instance.name,module:instance.module,port:port.name,direction:port.direction,expr,kind};
      });
    });
    return {mode,top:p.top,ports:arr(p.nets).filter(n=>n.direction!=='wire').map(n=>({name:n.name,direction:n.direction,range:n.range||''})),bindings,assigns:arr(p.assigns).map(a=>({target:a.target,expr:a.expr})),emptyOutputs:r.outputs};
  }
  function reviewText(top,reviews){
    const cell=value=>str(value).replace(/[^\x00-\x7f]/g,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'&#124;').replace(/[\r\n]/g,' ');
    const row=values=>'| '+values.map(cell).join(' | ')+' |';
    const lines=['# '+top+' - wiring review','','Generated from the same resolved per-mode project used for the normal RTL and org. This is a connection inventory, not a simulation or a company gen_top execution report.','','## Choose the implementation','','- Normal: '+top+'.v retains child instances. Compile with a normal filelist.','- Optional Empty: '+top+'.empty.v replaces the entire Top with default-zero outputs plus explicit overrides from modes/MODE/'+top+'.output.cfg. Compile with an empty filelist, never alongside the normal Top.','- output.cfg is consumed only by gen_empty.py. It lists explicit overrides only; omitted outputs retain the default zero. Its values are not the normal circuit outputs.','- OPEN means the parent instance has .port(). The child source and its internal assignments remain unchanged. Leaving a child output open does not create a Top port or an Empty output assignment.','','The tables below list actual connections and Empty values separately; functional output values must be derived from the child RTL or verified in a simulator.',''];
    for(const review of reviews){
      lines.push('## Mode: '+review.mode,'','### Normal Top interface','','| Top port | Direction | Range |','| --- | --- | --- |',...review.ports.map(p=>row([p.name,p.direction,p.range||'1 bit'])),'','### Normal child connections','','| Instance | Child port | Direction | Normal connection | Intent |','| --- | --- | --- | --- | --- |',...review.bindings.map(b=>row([b.instance,b.port,b.direction,b.expr===null?'UNCONFIGURED':'.'+b.port+'('+b.expr+')',b.kind])),'');
      if(review.assigns.length)lines.push('### Normal Top assignments','','```verilog',...review.assigns.map(a=>'assign '+a.target+' = '+a.expr+';'),'```','');
      lines.push('### Optional Empty outputs','','| Top output | Width | Empty value | Why this value |','| --- | --- | --- | --- |',...review.emptyOutputs.map(o=>row([o.port,o.width,o.expr,outputOrigin(o)])),...(review.emptyOutputs.length?[]:['No Top outputs.']), '','Empty has no child instances. The normal connection table above does not apply to it.','');
    }
    return lines.join('\n');
  }
  function profileProjects(project,config){
    const c=normalize(config||project.bundleConfig);
    const make=(name,defineConfig)=>{
      const next=D.plan(project,defineConfig,P).project,inactiveBindings=[];
      // Only a binding proven valid in the source configuration can become
      // inactive in another mode. Unknown pins and new target pins still fail.
      if(c.dualMode&&!exportIssues(project).length)next.connections=arr(next.connections).filter(binding=>{
        const inst=arr(project.instances).find(i=>i.id===binding.instance),before=inst&&arr(project.modules).find(m=>m.name===inst.module),after=inst&&arr(next.modules).find(m=>m.name===inst.module);
        if(before&&after&&arr(before.ports).some(p=>p.name===binding.port)&&!arr(after.ports).some(p=>p.name===binding.port)){
          inactiveBindings.push({instance:inst.name,module:inst.module,port:binding.port,expr:binding.expr,reason:'Port is inactive after preprocessing this mode; original binding is retained in the saved WIU project.'});return false;
        }return true;
      });
      return {name,project:next,inactiveBindings};
    };
    if(!c.dualMode)return [{name:c.profileName,project}].concat(c.profiles.map(p=>make(p.name,p.defineConfig)));
    const entries=['asic','fpga'].map(name=>{
      const explicit=c.profiles.find(profile=>profile.name===name),dc=clone(explicit?explicit.defineConfig:D.normalize(project.defineConfig));
      if(!explicit){const existing=dc.rows.find(row=>row.name==='FPGA');dc.rows=dc.rows.map(row=>row.name==='FPGA'?{...row,enabled:name==='fpga'}:row);if(name==='fpga'&&!existing)dc.rows.push({name:'FPGA',value:'',enabled:true,comment:'FPGA branch selector',group:''});}
      const hasFPGA=dc.rows.some(row=>row.enabled&&row.name==='FPGA');
      if(hasFPGA!==(name==='fpga'))throw Error('組態 '+name+' 的 FPGA 旗標不正確；fpga 必須啟用 FPGA，asic 必須停用。');
      return make(name,dc);
    });
    return entries.concat(c.profiles.filter(p=>!['asic','fpga'].includes(p.name)).map(p=>make(p.name,p.defineConfig)));
  }
  const asciiJson=value=>JSON.stringify(value,null,2).replace(/[^\x00-\x7f]/g,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0'))+'\n';
  function modeHeader(p,name){return (name==='asic'?'// Explicitly select the ASIC branch even if FPGA was defined earlier.\n`undef FPGA\n':'')+D.exportHeader(p.defineConfig);}
  function assertModeSelector(p,mode){
    if(!['asic','fpga'].includes(mode))return;
    const expected=mode==='fpga',probe='\n\n`ifdef FPGA\nWIU_MODE_FPGA_ENABLED\n`else\nWIU_MODE_FPGA_DISABLED\n`endif\n';
    for(const [name,text]of sourceMap(p)){
      const result=D.preprocess(text+probe,p.defineConfig,name);
      if(result.issues.some(i=>i.severity==='error'))continue; // Normal export validation reports the parse error.
      const actual=result.text.trimEnd().endsWith('WIU_MODE_FPGA_ENABLED');
      if(actual!==expected){const error=Error('組態 '+mode+' 的來源 '+name+' 改變了 FPGA 旗標。請將模式選擇保留在 Defines，避免同一個 .v 的分支與子模組不一致。');error.issues=[{severity:'error',code:'BUNDLE_MODE_SELECTOR',message:error.message}];throw error;}
    }
  }
  function assertSourceIsolation(project,mode,sources){
    const entries=[...sources],config=D.normalize(project.defineConfig),allText=entries.map(row=>row[1]).concat(config.includes.map(f=>f.text),JSON.stringify(config.rows)).join('\n');
    let token='WIU_FILE_MACRO_SCOPE_GUARD';while(allText.includes(token))token+='_X';
    const virtualConfig={...config,includes:config.includes.concat(entries.map(([name,text])=>({name,text})))},wrapper=entries.map(([name],index)=>token+'_BEGIN_'+index+'\n`include "'+name+'"\n'+token+'_END_'+index).join('\n');
    let virtualName='__wiu_macro_scope_check__.v';const usedNames=new Set(virtualConfig.includes.map(f=>f.name));while(usedNames.has(virtualName))virtualName='_'+virtualName;
    const cumulative=D.preprocess(wrapper,virtualConfig,virtualName),tokens=text=>JSON.stringify(str(text).match(/"(?:\\.|[^"\\])*"|\\[^\s]+|[A-Za-z_$][\w$]*|[0-9][\w'?]*|[^\s]/g)||[]);
    const fail=(file,detail)=>{const error=Error('組態 '+mode+' 的 RTL 編譯順序會改變 macro 狀態'+(file?'（'+file+'）':'')+'。請將跨檔共用值移至 Defines，或在各檔結束前還原本地 macro。'+detail);error.issues=[{severity:'error',code:'BUNDLE_MACRO_STATE',message:error.message}];throw error;};
    if(cumulative.issues.some(i=>i.severity==='error'))fail('',cumulative.issues.filter(i=>i.severity==='error').map(i=>i.message).join(' '));
    for(const [index,[name,text]]of entries.entries()){
      const begin=token+'_BEGIN_'+index+'\n',end='\n'+token+'_END_'+index,start=cumulative.text.indexOf(begin),finish=cumulative.text.indexOf(end,start+begin.length);
      if(start<0||finish<0)fail(name,'Unable to delimit a source preprocessing snapshot.');
      const sequential=cumulative.text.slice(start+begin.length,finish).trim(),independent=D.preprocess(text,config,name);
      if(independent.issues.some(i=>i.severity==='error')||tokens(sequential)!==tokens(independent.text))fail(name,'Its compiled content differs from the source reviewed in WIU.');
    }
  }
  function sourceMap(project){const found=new Map(D.sourcesFor(project).map(f=>[f.name,f.text]));for(const module of arr(project.modules)){const name=module.sourceFilename||module.filename||module.name+'.v';if(!found.has(name)&&module.source)found.set(name,module.source);}return found;}
  // The runner creates module.v aliases inside its isolated work directory. Only
  // this export snapshot uses canonical filenames; raw source identities stay intact.
  function orgSnapshot(project){const sources=sourceMap(project);return {...project,modules:arr(project.modules).map(module=>{const name=module.sourceFilename||module.filename||module.name+'.v';return str(sources.get(name)).trim()?{...module,filename:module.name+'.v'}:module;})};}
  function exportIssues(project){return C.validate(orgSnapshot(project),{target:'org'}).concat(C.validate(project,{target:'verilog'})).filter(i=>i.severity==='error');}
  function files(project,config){
    const c=normalize(config||project.bundleConfig),list=[],paths=new Set(),modes=[],reviews=[],root='model/current/';
    assertValid(validate(project,c));
    if(c.dualMode)assertValid({errors:exportIssues(project)});
    const add=(path,text,description,kind)=>{safePath(path);const key=path.toLowerCase();if(paths.has(key))throw Error('套件檔案路徑重複：'+path);paths.add(key);text=str(text);list.push({path,text,description,kind:kind||'generated',bytes:encode(text).length});};
    const put=(path,text,description,kind)=>add(root+path,text,description,kind);
    for(const entry of profileProjects(project,c)){
      const p=entry.project,mode=entry.name; if(c.dualMode)assertModeSelector(p,mode); const issues=exportIssues(p);if(issues.length){const e=Error('組態 '+mode+'：\n'+issues.map(i=>i.message).join('\n'));e.issues=issues;throw e;}
      const s=stub(p,c),prefix='modes/'+mode+'/',top=p.top,header=D.fileName(p),sourcesByName=sourceMap(p),usedModules=new Set(arr(p.instances).map(i=>i.module));
      const moduleFiles={};for(const name of usedModules){const m=arr(p.modules).find(m=>m.name===name),file=m&&(m.sourceFilename||m.filename||m.name+'.v');if(!file||!sourcesByName.has(file)||!sourcesByName.get(file).trim())throw Error('缺少 '+name+' 的 RTL 原始碼。請匯入完整 RTL，套件不會以空殼代替真實模組。');moduleFiles[name]=safePath(file);}
      safePath(header);const workPaths=new Map(),sourceFiles=[];
      const reserve=(path,role)=>{safePath(path);const key=path.toLowerCase();if(workPaths.has(key))throw Error('組態 '+mode+' 的工作檔衝突：'+path+'（'+role+' / '+workPaths.get(key)+'）');workPaths.set(key,role);};
      [top+'.v',top+'.v.org',top+'.empty.v',top+'.output.cfg',header,'gen_empty.py'].forEach(name=>reserve(name,'generated'));
      put(prefix+top+'.v.org',C.exportOrg(orgSnapshot(p)),'Company gen_top constraints and template; module filename aliases are supplied by the runner');
      put(prefix+top+'.v',C.exportVerilog(p),'Direct website-generated normal Top candidate');
      put(prefix+top+'.empty.v',s.verilog,'Direct website-generated replacement stub');
      put(prefix+top+'.output.cfg',s.configText,'Optional Empty overrides only; omitted outputs default to zero');
      put(prefix+header,modeHeader(p,mode),'Mode-specific define header with an empty final line');
      for(const [name,text]of sourcesByName){reserve(name,'RTL source');put(prefix+'src/'+name,text,'Preserved user RTL source','rtl');sourceFiles.push({path:'src/'+name,target:name,role:'rtl'});}
      for(const f of D.normalize(p.defineConfig).includes){reserve(f.name,'include source');put(prefix+'src/'+f.name,f.text,'Preserved user include source','include');sourceFiles.push({path:'src/'+f.name,target:f.name,role:'include'});}
      for(const [module,name]of Object.entries(moduleFiles)){const alias=module+'.v';if(alias!==name&&workPaths.has(alias.toLowerCase())){const existing=sourcesByName.get(alias);if(existing!==sourcesByName.get(name))throw Error('gen_top 模組別名與檔案衝突：'+alias+'；請整理 RTL 檔名後重試。');}}
      assertSourceIsolation(p,mode,sourcesByName);
      const view=C.projectView(p),resolved=C.resolveParameters({parameters:parameters(view)},{}),ports=arr(view.nets).filter(n=>n.direction!=='wire').map(n=>({name:n.name,direction:n.direction,signed:!!n.signed,...C.parseRange(n.range,resolved.context)}));
      const includeDirs=Array.from(new Set([prefix.slice(0,-1),prefix+'src'].concat(sourceFiles.map(f=>(prefix+f.path).split('/').slice(0,-1).join('/'))))),baseList=includeDirs.map(dir=>'+incdir+'+dir).concat(prefix+header);
      put(prefix+'normal.f',baseList.concat(prefix+top+'.v',sourceFiles.filter(f=>f.role==='rtl').map(f=>prefix+f.path)).join('\n')+'\n','Normal mode filelist; invoke the compiler from model/current');
      put(prefix+'empty.f',baseList.concat(prefix+top+'.empty.v').join('\n')+'\n','Stub mode filelist; compile separately from normal RTL');
      const placeholders=arr(p.modules).filter(m=>m.placeholder&&usedModules.has(m.name)).map(m=>m.name);
      reviews.push(wiringReview(p,c,mode));
      modes.push({name:mode,directory:prefix.slice(0,-1),top,defineFile:header,sourceFiles,moduleFiles,ports,outputs:s.outputs.map(o=>({name:o.port,expr:o.defaulted?"'d0":o.expr,width:o.width,defaulted:o.defaulted,websiteExpr:o.expr})),instances:arr(p.instances).map(i=>({module:i.module,name:i.name})),placeholders,inactiveBindings:entry.inactiveBindings||[],warnings:validate(p,c).warnings.concat((entry.inactiveBindings||[]).map(binding=>({severity:'warning',code:'BUNDLE_INACTIVE_BINDING',message:binding.instance+'.'+binding.port+' is inactive in '+mode+'; its original binding remains in the saved project.'}))),hasFPGA:D.normalize(p.defineConfig).rows.some(r=>r.enabled&&r.name==='FPGA')});
    }
    if(c.dualMode){
      for(const suffix of ['.v','.empty.v']){
        const branch=name=>list.find(f=>f.path===root+'modes/'+name+'/'+project.top+suffix).text.replace(/`include "([^"\n]+)"/g,(_,file)=>'`include "modes/'+name+'/'+file+'"').trimEnd();
        put(project.top+suffix,'// WIU dual-mode candidate. FPGA is first; ASIC is the default branch.\n// Compile with one matching normal-<mode>.f or empty-<mode>.f filelist.\n`ifdef FPGA\n'+branch('fpga')+'\n`else\n'+branch('asic')+'\n`endif // FPGA\n','FPGA-first and ASIC-second implementations in one file');
      }
      for(const mode of modes.filter(m=>['asic','fpga'].includes(m.name)))for(const [kind,suffix]of [['normal','.v'],['empty','.empty.v']]){
        const original=list.find(f=>f.path===root+mode.directory+'/'+kind+'.f').text;
        put(kind+'-'+mode.name+'.f',original.split('\n').map(line=>line===mode.directory+'/'+project.top+suffix?project.top+suffix:line).join('\n'),'Merged '+kind+' Top filelist for '+mode.name+'; invoke from model/current');
      }
    }
    if(!c.dualMode){
      const mode=modes.find(m=>m.name===c.profileName);
      for(const [kind,suffix]of [['normal','.v'],['empty','.empty.v']]){
        const rtl=list.find(f=>f.path===root+mode.directory+'/'+project.top+suffix).text.replace(/`include "([^"\n]+)"/g,(_,file)=>'`include "'+mode.directory+'/'+file+'"');
        put(project.top+suffix,rtl,'Current single-configuration '+kind+' Top candidate');
        const original=list.find(f=>f.path===root+mode.directory+'/'+kind+'.f').text;
        put(kind+'.f',original.split('\n').map(line=>line===mode.directory+'/'+project.top+suffix?project.top+suffix:line).join('\n'),'Current '+kind+' filelist; invoke from model/current');
      }
    }
    const saved=clone(project);saved.bundleConfig=c;put(project.top+'.wiu.json',asciiJson({format:'WrapItfUp-assembly',version:62,project:saved}),'Reloadable WIU project with all user data preserved');
    put('README.md',readme(project,c,modes),'Public design package guide','readme');
    return list;
  }
  function referenceFiles(){return [];}
  function readme(p,c,modes){return '# '+p.top+'\n\nPublic design export. Compile normal RTL and child sources together. Compile Empty RTL separately. This package does not include external generators, internal examples or reference documents.\n';}
  function manifest(list){return list.map(({path,bytes,description,kind})=>({path,bytes,description,kind}));}
  const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function zip(list){
    if(list.length>65535)throw Error('ZIP 檔案數量超過上限。');const chunks=[],central=[],seen=new Set();let offset=0;
    const block=n=>new Uint8Array(n),write16=(b,o,v)=>new DataView(b.buffer).setUint16(o,v,true),write32=(b,o,v)=>new DataView(b.buffer).setUint32(o,v,true);
    for(const file of list){safePath(file.path);const key=file.path.toLowerCase();if(seen.has(key))throw Error('ZIP 路徑重複：'+file.path);seen.add(key);const name=encode(file.path),data=file.data instanceof Uint8Array?file.data:encode(str(file.text)),crc=crc32(data);if(data.length>0xffffffff||offset+data.length>0xffffffff)throw Error('ZIP 大小超過上限。');const h=block(30+name.length);write32(h,0,0x04034b50);write16(h,4,20);write16(h,6,0x800);write16(h,12,33);write32(h,14,crc);write32(h,18,data.length);write32(h,22,data.length);write16(h,26,name.length);h.set(name,30);chunks.push(h,data);const c=block(46+name.length);write32(c,0,0x02014b50);write16(c,4,20);write16(c,6,20);write16(c,8,0x800);write16(c,14,33);write32(c,16,crc);write32(c,20,data.length);write32(c,24,data.length);write16(c,28,name.length);write32(c,42,offset);c.set(name,46);central.push(c);offset+=h.length+data.length;}
    const centralSize=central.reduce((n,c)=>n+c.length,0),end=block(22);write32(end,0,0x06054b50);write16(end,8,list.length);write16(end,10,list.length);write32(end,12,centralSize);write32(end,16,offset);const out=block(offset+centralSize+22);let pos=0;for(const chunk of chunks.concat(central,[end])){out.set(chunk,pos);pos+=chunk.length;}return out;
  }
  return {defaults,normalize,validate,stub,files,referenceFiles,zip,manifest,profileProjects,exportIssues,safePath,orgSnapshot,sourceMap,assertSourceIsolation,assertModeSelector,wiringReview,reviewText};
});
