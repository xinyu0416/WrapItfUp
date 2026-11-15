(function(root,factory){
  'use strict';
  const get=(name,file)=>root[name]||(typeof require==='function'?require(file):null);
  const api=factory(get('WIUCore','./assembly-core.js'),get('WIUDefines','./assembly-defines.js'),get('WIUBundle','./assembly-bundle.js'),get('WIUToolchainAssets','./assembly-toolchain-assets.js'));
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WIUCompany=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C,D,B,A){
  'use strict';
  const assets=typeof require==='function'?require('./delivery-assets'):globalThis.WIUDeliveryAssets;
  const clone=x=>JSON.parse(JSON.stringify(x)),arr=x=>Array.isArray(x)?x:[];
  const formats=['commented_inst_pin','commented_port','constraint_port_order','keep_inst_port_order','disable_unconstraint_port'];
  function fail(code,message){const error=Error(message);error.issues=[{severity:'error',code,message}];throw error;}
  function header(config){
    const errors=D.validate(config);if(errors.length){const e=Error(errors.map(i=>i.message).join('\n'));e.issues=errors;throw e;}
    const lines=D.normalize(config).rows.filter(r=>r.enabled).map(r=>'`define '+r.name+(r.value?' '+r.value:''));
    return lines.length?lines.join('\n')+'\n\n':'\n';
  }
  function stub(project,config){
    const result=B.stub(project,config),order=B.normalize(config||project.bundleConfig).outputTies.map(r=>r.port);
    result.outputs.sort((a,b)=>order.indexOf(a.port)-order.indexOf(b.port));
    return {...result,configText:result.outputs.filter(o=>!o.defaulted).map(o=>'assign '+o.port+' = '+o.expr+';').join('\n')+(result.outputs.some(o=>!o.defaulted)?'\n':''),verilog:result.verilog.split('\n').filter(line=>!/^\s*\/\//.test(line)).join('\n')};
  }
  // r94: emit verified company-parser compatible *org only*. Original project,
  // child RTL, normal Top, assigns and instance override expressions stay intact.
  function companyCompatibility(project){
    const p=clone(project),log=[];
    const declared=new Set((Array.isArray(p.parameters)?p.parameters:Object.keys(p.parameters||{}).map(name=>({name}))).map(x=>x.name));
    p.nets=arr(p.nets).map(net=>{
      if(net.direction!=='input')return net;
      const value=String(net.range||'');
      const m=/^\[\s*\(\s*([A-Za-z_][\w$]*)\s*\/\s*([1-9]\d*)\s*\)\s*-\s*(\d+)\s*:\s*(\d+)\s*\]$/.exec(value);
      if(!m||!declared.has(m[1]))return net;
      const simplified='['+m[1]+'/'+m[2]+'-'+m[3]+':'+m[4]+']';
      // Both forms are the same Verilog arithmetic parse tree at this scope.
      // Restrict to exactly the proven parenthesized division expression.
      log.push({kind:'range',name:net.name,from:value,to:simplified});
      return {...net,range:simplified};
    });
    const topNames=new Set(p.nets.map(n=>n.name));
    p.assigns=arr(p.assigns).map(a=>{
      const expr=String(a.expr||'').trim();
      if(/^[A-Za-z_][\w$]*$/.test(expr)&&topNames.has(expr)&&/(?:clk|clock)/i.test(a.target+' '+expr)){
        const to='('+expr+')';log.push({kind:'assign',name:a.target,from:expr,to});return {...a,expr:to};
      }
      return a;
    });
    return {project:p,log};
  }
  function org(project,options){
    const modified=companyCompatibility(project),p=modified.project,resolved=C.projectView(p),mapping=C.instanceMapping(resolved);
    p.nets=arr(p.nets).map(n=>({...n,comment:'',group:''}));
    p.formats=[...new Set(formats.concat(arr(p.formats)))];
    const upper=arr(resolved.nets).some(n=>/[A-Z]/.test(n.name))||arr(resolved.modules).some(m=>arr(m.ports).some(n=>/[A-Z]/.test(n.name)));
    const keepCase=upper||p.formats.includes('case_sensitive');
    const raw=C.exportOrg(p,options),lines=raw.split('\n'),out=[],grouped=new Map();let inGenerated=false,inserted=false,formatsAdded=false,section=0;
    for(const c of arr(resolved.connections)){
      const inst=mapping.find(m=>m.id===c.instance);if(!inst)continue;
      const mod=arr(resolved.modules).find(m=>m.name===inst.module),port=mod&&arr(mod.ports).find(n=>n.name===c.port);
      const expr=String(c.expr||'').replace(/\s/g,'');
      const same=arr(resolved.nets).some(n=>n.direction!=='wire'&&n.name===c.port&&n.name===expr);
      if(same)continue;
      const key=expr||'""',prefix=p.formats.includes('connect_with_direction')&&port?({input:'i:',output:'o:',inout:'io:'}[port.direction]||''):'';
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(prefix+inst.endpoint+'.'+c.port);
    }
    for(const line of lines){
      if(/^\/\/ realtek begin$/.test(line)){inGenerated=true;section++;if(section===7&&!arr(p.assigns).length)continue;out.push(line);continue;}
      if(/^\/\/ realtek end$/.test(line)){inGenerated=false;if(section===7&&!arr(p.assigns).length)continue;out.push(line);continue;}
      if(inGenerated&&section===7&&!arr(p.assigns).length)continue;
      if(/^\/\/ (?:WIU |Edit directives |Compile ALL |gen_top:)/.test(line))continue;
      if(!inGenerated&&line.startsWith('// realtek format ')){
        if(!formatsAdded){for(const name of p.formats)out.push('// realtek format '+name);if(keepCase&&!p.formats.includes('case_sensitive'))out.push('// realtek format case_sensitive');formatsAdded=true;}
        continue;
      }
      if(!inGenerated&&/^\/\/ realtek conn\s/.test(line)){
        if(!inserted){for(const [expr,endpoints]of grouped)out.push('// realtek conn '+expr+' '+endpoints.join(' '));inserted=true;}
        continue;
      }
      const wire=!inGenerated&&/^\/\/ realtek wire ([A-Za-z_][\w$]*)\.\[[^\]]+\]$/.exec(line);
      if(wire){
        const bindings=arr(resolved.connections).filter(c=>c.expr===wire[1]);
        const net=arr(resolved.nets).find(n=>n.name===wire[1]);
        const inferable=bindings.length&&bindings.every(c=>{
          const i=arr(resolved.instances).find(i=>i.id===c.instance),m=i&&arr(resolved.modules).find(m=>m.name===i.module),port=m&&arr(m.ports).find(p=>p.name===c.port);
          return port&&String(port.range||'').replace(/\s/g,'')===String(net.range||'').replace(/\s/g,'')&&!Object.keys(i.parameters||{}).length;
        });
        if(inferable){out.push('// realtek wire '+wire[1]);continue;}
      }
      out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g,'\n\n').trimEnd()+'\n';
  }
  function verilog(project,options){
    const clean=clone(project);clean.nets=arr(clean.nets).map(n=>({...n,comment:''}));
    return C.exportVerilog(clean,options).split('\n').filter(line=>!/^\/\/ (?:Generated by WrapItfUp|WIU configuration|Compile ALL)/.test(line)).join('\n');
  }
  function sourceMap(project){return B.sourceMap(project);}
  function scriptConfig(project){
    const c=project.companyConfig||{};
    const field=(name,otherwise)=>c[name]===undefined?otherwise:String(c[name]).trim();
    return {genTop:field('genTop','gen_top_verilog_sysv'),genEmpty:field('genEmpty','./gen_empty.py'),python:field('python','python'),genTopArgs:arr(c.genTopArgs),pythonArgs:arr(c.pythonArgs),launcher:arr(c.launcher),environmentScript:field('environmentScript',''),verification:c.verification||{},asicDefine:field('asicDefine',''),fpgaDefine:field('fpgaDefine',''),sources:arr(c.sources).map(s=>({moduleId:String(s.moduleId||''),module:String(s.module||''),path:String(s.path||'').trim()}))};
  }
  function literalPath(value,label,optional=false){
    if(!value&&optional)return '';
    if(!value||value.length>1024||/^[-~]/.test(value)||/[\x00-\x1f\x7f'"`$!;|&<>\\*?\[\]{}()#]/.test(value))fail('COMPANY_SCRIPT_PATH',label+' 請填 Linux 檔案路徑或單一指令名稱；可含空白，不接受 shell 指令、~ 或 $ 變數。');
    return value;
  }
  function scriptPlan(project){
    if(!C.validName(project.top))fail('COMPANY_SCRIPT_TOP','Top 名稱需以英文字母或底線開頭，後續可用字母、數字、底線或 $；不可含減號。例如 bad_name、mac_top。');
    const c=scriptConfig(project),top=project.top;
    for(const [key,label]of [['genTop','gen_top'],['genEmpty','gen_empty.py'],['python','Python'],['asicDefine','ASIC define'],['fpgaDefine','FPGA define']])literalPath(c[key],label,['asicDefine','fpgaDefine'].includes(key));
    for(const row of c.sources)literalPath(row.path,'RTL '+(row.module||row.moduleId),true);
    const used=new Set(arr(project.instances).map(i=>i.module));
    const sources=arr(project.modules).filter(m=>used.has(m.name)).map(m=>{
      const rows=c.sources.filter(s=>s.moduleId?m.id===s.moduleId:s.module===m.name);
      if(rows.length>1)fail('COMPANY_SCRIPT_SOURCE','同一模組有重複的公司路徑設定：'+m.name);
      const path=rows[0]?.path||'';
      return {moduleId:m.id||'',module:m.name,source:m.sourceFilename||m.filename||m.name+'.v',target:m.name+'.v',path,external:!!path};
    });
    for(const key of ['genTopArgs','pythonArgs','launcher'])if(!c[key].every(x=>typeof x==='string'&&!/[\x00-\x1f]/.test(x)))fail('COMPANY_SCRIPT_ARGS',key+' 必須逐項填入參數。');
    const required=[top+'.v.org',top+'.output.cfg',c.asicDefine||'./'+top+'_asic_define.v',c.fpgaDefine||'./'+top+'_fpga_define.v',c.genEmpty,...sources.filter(s=>s.external).map(s=>s.path),...sources.filter(s=>!s.external).map(s=>'./'+s.target)];
    return {top,filename:'gen_top_'+top+'.sh',config:c,sources,required:[...new Set(required)],asicDefine:c.asicDefine||'./'+top+'_asic_define.v',fpgaDefine:c.fpgaDefine||'./'+top+'_fpga_define.v'};
  }
  function script(project,aliases=[]){
    if(typeof project==='string')throw Error('Please provide a project for export.');
    const plan=scriptPlan(project);
    return '#!/bin/csh -f\n# WrapItfUp r95: run from the extracted package directory.\n# Edit delivery-config.json for Top/tools/arguments/source links/environment.\n# Python 3 runs this helper; config.python is independently used for company gen_empty.\n# Each run creates runs/run-*/output; downloaded RTL is never overwritten.\nif ( ! -f delivery-config.json || ! -f run_wiu.py ) then\n  echo "Run from the extracted package directory containing delivery-config.json and run_wiu.py."\n  exit 1\nendif\nwhich python3 >& /dev/null\nif ( $status != 0 ) then\n  echo "Missing Python 3 for run_wiu.py. Load your company Python 3 environment and retry."\n  exit 1\nendif\npython3 run_wiu.py generate\nexit $status\n';
  }

  function prepare(project,config){
    const cfg={...B.normalize(config||project.bundleConfig),dualMode:true,includeReferences:false};
    if(cfg.profiles.some(p=>!['asic','fpga'].includes(p.name)))fail('COMPANY_PROFILES','公司範例只產生 ASIC／FPGA。請移除其他命名快照，或提供該組態的原始執行範例。');
    const entries=B.profileProjects(project,cfg),modes={};
    for(const entry of entries){
      const p=entry.project,errors=B.exportIssues(p).concat(B.validate(p,cfg).errors);
      if(errors.length){const error=Error(errors.map(i=>i.message).join('\n'));error.issues=errors;throw error;}
      B.assertModeSelector(p,entry.name);B.assertSourceIsolation(p,entry.name,sourceMap(p));
      if(!p.instances.length)fail('COMPANY_NO_INSTANCES','原始腳本未使用 -noinst。請先加入子模組，或提供空 Top 的公司範例。');
      for(const instance of p.instances){
        const module=p.modules.find(m=>m.name===instance.module),name=module.sourceFilename||module.filename||module.name+'.v';
        if(p.modules.filter(m=>(m.sourceFilename||m.filename||m.name+'.v')===name).length>1)fail('COMPANY_MULTI_MODULE','公司範例使用一個檔案一個 module；'+name+' 含多個 module。請先拆檔，直接 RTL 匯出仍可使用。');
      }
      modes[entry.name]={project:p,org:org(B.orgSnapshot(p)),stub:stub(p,cfg),sources:sourceMap(p)};
    }
    const a=modes.asic,f=modes.fpga;
    if(a.org!==f.org)fail('COMPANY_MODE_ORG','ASIC／FPGA 的介面或接線不同，目前無法用範例中的同一份 org 表達。請提供這種條件接線的可執行 org；不會自動改用不同的生成流程。');
    if(a.stub.configText!==f.stub.configText)fail('COMPANY_MODE_CFG','ASIC／FPGA 需要不同的 Empty 覆寫，但原始腳本共用一份 output.cfg。請使用共用設定，或提供對應範例。');
    const rows=p=>D.normalize(p.defineConfig).rows.filter(r=>r.enabled&&r.name!=='FPGA').map(r=>[r.name,r.value]).sort((a,b)=>a[0].localeCompare(b[0]));
    if(JSON.stringify(rows(a.project))!==JSON.stringify(rows(f.project)))fail('COMPANY_MODE_DEFINES','原始流程讓 FPGA 繼承 ASIC defines。目前兩組有額外的新增、移除或改值；請先使用共用 defines 加 FPGA 旗標，或提供對應範例。');
    if(JSON.stringify([...a.sources])!==JSON.stringify([...f.sources])||JSON.stringify(D.normalize(a.project.defineConfig).includes)!==JSON.stringify(D.normalize(f.project.defineConfig).includes))fail('COMPANY_MODE_SOURCES','兩種模式需要不同來源檔；原始範例使用同一組 RTL。請提供對應的來源切換腳本。');
    return {config:cfg,modes};
  }
  function openPins(project){
    const mapping=new Map(C.instanceMapping(project).map(i=>[i.id,i.endpoint]));
    const pins=arr(project.connections).filter(c=>String(c.expr||'').trim()===''&&mapping.has(c.instance));
    return pins.length?['Explicit open directives in this design:','','```verilog',...pins.map(c=>'// realtek conn "" '+mapping.get(c.instance)+'.'+c.port),'```']:['This design has no explicitly open pins.'];
  }
  function readme(project,entries,aliases){return '# '+project.top+'\n\nGenerated by WrapItfUp Public.\n\n- Normal RTL retains instances and wiring. Empty RTL is a separate replacement with the same interface. Never compile both together.\n- Select normal-asic.f, normal-fpga.f, empty-asic.f or empty-fpga.f.\n- output.cfg affects Empty only; omitted outputs default to zero.\n- External gen_top/gen_empty executables are not included. Configure your own tools before using run_wiu.py.\n- Generated files must be reviewed and tested in your target environment.\n\n'+entries.map(e=>'- '+e.path+': '+e.description).join('\n')+'\n';}
  function pending(project){return ['外部 gen_top／gen_empty 與目標模擬環境需由使用者自行驗證。'];}
  function files(project,config){
    const prepared=prepare(project,config),a=prepared.modes.asic,f=prepared.modes.fpga,top=project.top,root='',list=[],paths=new Map(),aliases=[];
    const add=(path,text,description,kind='generated')=>{
      B.safePath(path);const key=path.toLowerCase();
      if(/\.(?:py|sh)$/i.test(path)&&kind!=='script')fail('COMPANY_SCRIPT_ASSET','目前設計下載僅包含設計檔案；請從 RTL／include 來源移除腳本：'+path);
      if(key==='readme.md'&&kind!=='readme')fail('COMPANY_FILE_COLLISION','README.md 為下載說明保留名稱，請重新命名匯入的來源檔案。');
      if(paths.has(key))fail('COMPANY_FILE_COLLISION','公司工作檔案名稱衝突：'+path);
      paths.set(key,text);list.push({path:root+path,text,description,kind,bytes:new TextEncoder().encode(text).length});
    };
    const asic=top+'_asic_define.v',fpga=top+'_fpga_define.v';
    add(top+'.v.org',a.org,'Company-compatible org (source project remains unchanged)');
    add('COMPATIBILITY-LOG.txt', ['WrapItfUp r95 company org compatibility adjustments',
      ...companyCompatibility(a.project).log.map(x=>x.kind+' '+x.name+': '+x.from+' => '+x.to),
      'These transformations apply only to exported .org. Shared company tools and generated RTL are never modified.',
''].join('\n'),'Inspectable company parser compatibility edits','report');
    add(top+'.output.cfg',a.stub.configText,'Explicit Empty overrides only; omitted outputs default to zero');
    add(asic,header(a.project.defineConfig),'Current shared defines; an empty file means no shared defines');
    add(fpga,'`define FPGA\n\n','FPGA selector; added to the shared ASIC defines');
    const usedModules=new Set(a.project.instances.map(i=>i.module));
    const usedFiles=new Set(a.project.modules.filter(m=>usedModules.has(m.name)).map(m=>m.sourceFilename||m.filename||m.name+'.v'));
    const sources=new Map([...a.sources].filter(([name])=>usedFiles.has(name)));
    const includes=D.normalize(a.project.defineConfig).includes;
    const generatedHeader=D.fileName(a.project);
    const includesGeneratedHeader=[...sources.values(),...includes.map(f=>f.text)].some(text=>[...text.matchAll(/^\s*`include\s+"([^"\n]+)"/gm)].some(m=>m[1]===generatedHeader));
    if(includesGeneratedHeader&&generatedHeader!==asic)add(generatedHeader,header(a.project.defineConfig),'Shared defines referenced by the preserved RTL include');
    for(const [name,text]of sources){
      const modules=a.project.modules.filter(m=>(m.sourceFilename||m.filename||m.name+'.v')===name),placeholder=modules.some(m=>m.placeholder);
      add(name,text,(placeholder?'Interface placeholder RTL, not a functional implementation':'Preserved RTL source')+(modules.length?'; module '+modules.map(m=>m.name).join(', '):''),'rtl');
    }
    for(const source of includes)add(source.name,source.text,'Preserved include source','include');
    for(const moduleName of new Set(a.project.instances.map(i=>i.module))){
      const module=a.project.modules.find(m=>m.name===moduleName),source=module.sourceFilename||module.filename||module.name+'.v',alias=moduleName+'.v';
      if(!sources.has(source))fail('COMPANY_SOURCE','缺少 '+moduleName+' 的 RTL 原始碼。');
      const parser=typeof require==='function'?require('./assembly-parser'):globalThis.WIUParser;
      for(const mode of [a,f]){
        const parsed=parser.parseRtl(sources.get(source),{config:mode.project.defineConfig,filename:source});
        if(!parsed.modules.some(m=>m.name===moduleName))fail('COMPANY_SOURCE_MODULE','org 選用 '+moduleName+'，但 '+source+' 沒有對應 module 宣告；請更新來源後再匯出。');
      }
      if(alias!==source){
        for(const mode of [a,f]){
          const original=D.preprocess(sources.get(source),mode.project.defineConfig,source),copied=D.preprocess(sources.get(source),mode.project.defineConfig,alias);
          // A header can change macro state without emitting any RTL text.
          // Keep include-bearing sources in their original directory; a unique
          // dependency list alone cannot capture repeated header side effects.
          const movedIncludes=source.includes('/')&&/^\s*`include\s/m.test(sources.get(source));
          if(movedIncludes||copied.issues.some(i=>i.severity==='error')||copied.text!==original.text||JSON.stringify(copied.dependencies)!==JSON.stringify(original.dependencies))fail('COMPANY_ALIAS_INCLUDE','含 include 的來源 '+source+' 無法移到套件根目錄作為 '+alias+'。請將來源放到根目錄並以模組同名 '+alias+' 重新匯入，同時調整引用檔路徑。');
        }
        add(alias,sources.get(source),'Module-name alias: exact copy of '+source+'; compile only one of the two files','alias');aliases.push([source,alias]);
      }
    }
    const branch=(mode,empty)=>empty?mode.stub.verilog:verilog(mode.project).replace(/^`include "[^"\n]+"\n/gm,'');
    const combine=empty=>'`ifdef FPGA\n'+branch(f,empty).trimEnd()+'\n`else\n'+branch(a,empty).trimEnd()+'\n`endif //FPGA\n';
    add(top+'.v',combine(false),'Website-generated normal RTL with child instances; FPGA and ASIC branches');
    add(top+'.empty.v',combine(true),'Website-generated replacement for the entire current module; compile instead of the normal RTL');
    add(scriptPlan(project).filename,script(project),'Configured C-shell entry: Top, define paths, tools and source links','script');
    const plan=scriptPlan(project);
    add('run_wiu.py',assets.runner,'Python 3 delivery helper; company tools remain external','script');
    const dirs=[...new Set(['.'].concat([...sources.keys(),...includes.map(i=>i.name)].map(name=>name.includes('/')?name.slice(0,name.lastIndexOf('/')):'.')))];
    const incs=dirs.map(dir=>'+incdir+'+dir);
    const aliasesOnly=new Set(aliases.map(([original])=>original));
    const rtlFiles=[...sources.keys()].filter(x=>!aliasesOnly.has(x)).concat(aliases.map(([,alias])=>alias));
    // A source alias and its original must never be compiled together.
    const makeFilelist=(name,fpgaMode,emptyMode)=>{
      const defs=[asic].concat(fpgaMode?[fpga]:[]);
      const sourcesForMode=emptyMode?[]:rtlFiles;
      add(name,(fpgaMode?['+define+FPGA']:[]).concat(incs,defs,[top+(emptyMode?'.empty.v':'.v')],sourcesForMode).join('\n')+'\n',
          (emptyMode?'Empty':'Normal')+' '+(fpgaMode?'FPGA':'ASIC')+' filelist; run in extracted root','filelist');
    };
    makeFilelist('normal-asic.f',false,false);makeFilelist('normal-fpga.f',true,false);
    makeFilelist('empty-asic.f',false,true);makeFilelist('empty-fpga.f',true,true);
    add('START-HERE.txt',[
      'WrapItfUp r95 - '+top,
      '1. Extract this package into an existing Linux working directory.',
      '2. Set company tools if the defaults are not on PATH: use the website Advanced settings before export.',
      '3. Run: python3 run_wiu.py diagnose',
      '4. Run: python3 run_wiu.py generate',
      '5. Use normal-asic.f / normal-fpga.f OR empty-asic.f / empty-fpga.f (never both).',
      'The .f files select pre-generated website RTL for quick compilation. Company generated RTL is under the run output directory.',
      'Linux generation is NOT simulation. Only check VCS logs, new build artifact, and TB PASS to claim test success.',''
    ].join('\n'),'One-page Linux instructions','guide');
    add('delivery-config.json',JSON.stringify({...plan,inputs:list.filter(f=>!['script','readme'].includes(f.kind)&&!f.path.endsWith('.empty.v')&&f.path!==top+'.v').map(f=>f.path),launcher:plan.config.launcher,environmentScript:plan.config.environmentScript,verification:plan.config.verification},null,2)+'\n','Editable tool paths, separate argument arrays, source links and optional verification commands','config');
    add('README.md',(pending(project).length?'# Pending company verification\n\n'+pending(project).map(n=>'- '+n).join('\n')+'\n\nThese are downloadable source candidates, not a claim that company regeneration passed. Preserve parameters, custom names and Top assignments. Review the normal and Empty outputs separately.\n\n':'')+readme(a.project,list,aliases,scriptPlan(project)),'Package contents, file selection, and company environment requirements','readme');
    return list;
  }
  function review(project,config){const prepared=prepare(project,config);return B.reviewText(project.top,Object.entries(prepared.modes).map(([name,mode])=>B.wiringReview(mode.project,prepared.config,name))).replaceAll('modes/MODE/','');}
  return {files,prepare,pending,org,verilog,header,stub,review,script,scriptConfig,scriptPlan,companyCompatibility};
});
