/* WIU build configuration: bounded object macros and conditional source selection.
 * Deliberately not a complete SystemVerilog preprocessor. No eval or filesystem access.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WIUDefines=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const IDENT=/^[A-Za-z_][A-Za-z0-9_$]*$/;
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const LIMIT=12*1024*1024,MAX_ROWS=2048;
  const issue=(code,message,extra)=>Object.assign({severity:'error',code,message,ref:{type:'defines',id:'defines'}},extra||{});
  const fail=(code,message)=>{const e=Error(message);e.code=code;throw e;};
  function defaults(){return {rows:[],includes:[],fileName:'wiu_defines.vh'};}
  function normalize(value){
    const c=value==null?defaults():value;
    if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Define 設定必須是物件。');
    const rows=c.rows==null?[]:c.rows,includes=c.includes==null?[]:c.includes;
    if(!Array.isArray(rows)||rows.length>MAX_ROWS||!Array.isArray(includes)||includes.length>256)throw Error('Define／引用檔數量無效或過多。');
    const out={fileName:c.fileName||'',rows:[],includes:[]};
    if(typeof out.fileName!=='string')throw Error('Define 檔名必須是文字。');
    for(const r of rows){
      if(!r||typeof r!=='object')throw Error('Define 每列必須是物件。');
      const row={};for(const k of ['name','value','comment','group']){if(r[k]!=null&&typeof r[k]!=='string')throw Error('Define '+k+' 必須是文字。');row[k]=r[k]||'';}
      if(r.enabled!=null&&typeof r.enabled!=='boolean')throw Error('Define 啟用狀態必須是布林值。');
      row.enabled=r.enabled!==false;out.rows.push(row);
    }
    for(const f of includes){if(!f||typeof f.name!=='string'||typeof f.text!=='string')throw Error('引用檔需要名稱與完整原文。');if(f.text.length>LIMIT)throw Error('引用檔過大。');out.includes.push({name:f.name,text:f.text});}
    return out;
  }
  function fileName(project){const c=normalize(project.defineConfig);return c.fileName||((IDENT.test(project.top||'')?project.top:'wrapper_top')+'.defines.vh');}
  function pathName(name,base){
    if(typeof name!=='string'||/[\x00-\x1f\\]/.test(name)||name.startsWith('/')||/^[A-Za-z]:/.test(name))fail('INCLUDE_PATH','引用檔必須使用專案內的相對路徑：'+name);
    const parts=(base?base.split('/').slice(0,-1):[]).concat(name.split('/')),out=[];
    for(const p of parts){if(!p||p==='.')continue;if(p==='..'){if(!out.length)fail('INCLUDE_PATH','引用路徑超出專案：'+name);out.pop();}else out.push(p);}
    if(!out.length)fail('INCLUDE_PATH','引用檔名不能空白。');return out.join('/');
  }
  // Replaces comments with spaces; keeps strings and line positions intact.
  function cleanComments(source){
    let out='',state='code';
    for(let i=0;i<source.length;i++){const c=source[i],n=source[i+1];
      if(state==='line'){if(c==='\n'){state='code';out+='\n';}else out+=' ';continue;}
      if(state==='block'){if(c==='*'&&n==='/'){out+='  ';i++;state='code';}else out+=c==='\n'?'\n':' ';continue;}
      if(state==='string'){out+=c;if(c==='\\'&&n!==undefined)out+=source[++i];else if(c==='"')state='code';continue;}
      if(c==='/'&&n==='/'){out+='  ';i++;state='line';}else if(c==='/'&&n==='*'){out+='  ';i++;state='block';}else{out+=c;if(c==='"')state='string';}
    }
    if(state==='block')fail('PREPROCESS_COMMENT','區塊註解缺少結尾。');return out;
  }
  function expand(text,env,stack){
    text=String(text==null?'':text);stack=stack||[];
    if(stack.length>32)fail('MACRO_DEPTH','Macro 展開層數超過 32。');
    let out='';
    for(let i=0;i<text.length;){const c=text[i],n=text[i+1];
      if(c==='"'){let end=i+1;for(;end<text.length;end++){if(text[end]==='\\'){end++;continue;}if(text[end]==='"'){end++;break;}}out+=text.slice(i,end);i=end;continue;}
      if(c==='/'&&n==='/'){const end=text.indexOf('\n',i);if(end<0){out+=text.slice(i);break;}out+=text.slice(i,end+1);i=end+1;continue;}
      if(c==='/'&&n==='*'){const end=text.indexOf('*/',i+2);if(end<0)fail('PREPROCESS_COMMENT','Macro 值的區塊註解缺少結尾。');out+=text.slice(i,end+2);i=end+2;continue;}
      if(c==='\\'){let end=i+1;while(end<text.length&&!/\s/.test(text[end]))end++;out+=text.slice(i,end);i=end;continue;}
      if(c==='`'){
        const m=/^`([A-Za-z_][A-Za-z0-9_$]*)/.exec(text.slice(i));
        if(!m)fail('MACRO_UNSUPPORTED','不支援 token paste、macro quoting 或不完整的反引號。');
        const name=m[1];if(!env.has(name))fail('MACRO_UNDEFINED','尚未定義 `'+name+'。請在 Defines 新增值或加入引用檔。');
        if(stack.includes(name))fail('MACRO_CYCLE','Macro 循環參照：'+stack.concat(name).join(' → '));
        out+=expand(env.get(name),env,stack.concat(name));i+=m[0].length;
      }else{out+=c;i++;}
      if(out.length>LIMIT)fail('MACRO_SIZE','Macro 展開結果過大。');
    }
    return out;
  }
  function validate(config){
    let c;try{c=normalize(config);}catch(e){return [issue('DEFINE_CONFIG',e.message)];}
    const issues=[],seen=new Set(),groups=new Map();
    if(c.fileName&&!/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.(vh|v|svh)$/i.test(c.fileName))issues.push(issue('DEFINE_FILENAME','下載檔名請使用英數、底線、連字號與 .vh／.v／.svh 副檔名。'));
    for(const r of c.rows){
      if(!IDENT.test(r.name))issues.push(issue('DEFINE_NAME','Macro 名稱無效：'+(r.name||'（空白）')));
      if(seen.has(r.name))issues.push(issue('DEFINE_DUPLICATE','Macro 名稱重複：'+r.name));seen.add(r.name);
      if(/[\r\n\u2028\u2029]/.test(r.value+r.comment+r.group)||/\\\s*$/.test(r.value)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(r.value))issues.push(issue('DEFINE_MULTILINE','每列只支援單行 object macro：'+r.name));
      if(r.value!==r.value.trim()||/\/\*|\*\/|\/\//.test(r.value))issues.push(issue('DEFINE_VALUE','Macro 值請去除前後空白，註解請填在備註欄：'+r.name));
      if(r.enabled&&r.group){const old=groups.get(r.group);if(old)issues.push(issue('DEFINE_EXCLUSIVE','互斥組 '+r.group+' 同時啟用了 '+old+' 與 '+r.name+'。'));groups.set(r.group,r.name);}
    }
    const paths=new Set();for(const f of c.includes)try{const n=pathName(f.name);if(paths.has(n))issues.push(issue('INCLUDE_DUPLICATE','引用檔路徑重複：'+n));paths.add(n);if(c.fileName&&n===c.fileName)issues.push(issue('INCLUDE_SHADOW','引用檔不能覆蓋要下載的 define 檔：'+n));}catch(e){issues.push(issue(e.code,e.message));}
    const env=new Map(c.rows.filter(r=>r.enabled).map(r=>[r.name,r.value]));
    for(const r of c.rows.filter(r=>r.enabled))try{expand(r.value,env,[r.name]);}catch(e){issues.push(issue(e.code,e.message));}
    return issues;
  }
  function fingerprint(config){const c=normalize(config);return JSON.stringify({rows:c.rows.filter(r=>r.enabled).map(r=>[r.name,r.value]),includes:c.includes.map(f=>[f.name,f.text]),fileName:c.fileName});}
  function marker(config){const s=fingerprint(config);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
  function exportHeader(config){
    const c=normalize(config),errors=validate(c);if(errors.length){const e=Error(errors.map(i=>i.message).join('\n'));e.issues=errors;throw e;}
    const lines=['// WIU define configuration '+marker(c),'// Defined with value 0 still satisfies `ifdef. Disabled rows are omitted.'];
    for(const r of c.rows){if(r.comment)lines.push('// '+r.name+': '+r.comment);if(r.enabled)lines.push('`define '+r.name+(r.value?' '+r.value:''));else lines.push('// Disabled: '+r.name);}
    // Two LF bytes = terminated last content line PLUS a real empty final line.
    return lines.join('\n').replace(/[\r\n]+$/,'')+'\n\n';
  }
  function importHeader(text){
    text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    const clean=cleanComments(text),rows=[],lines=clean.split('\n'),original=text.split('\n');
    for(let i=0;i<lines.length;i++){
      const s=lines[i].trim();if(!s)continue;
      const m=/^`define\s+([A-Za-z_][A-Za-z0-9_$]*)([\s\S]*)$/.exec(s);
      if(!m||m[2].startsWith('(')||/\\\s*$/.test(m[2]))fail('DEFINE_IMPORT','第 '+(i+1)+' 行不是單行 object define。條件、include guard 或函式巨集請保留原檔，使用「加入引用檔」。');
      const cm=/\/\/(.*)$/.exec(original[i]);rows.push({name:m[1],value:m[2].trim(),enabled:true,comment:cm?cm[1].trim():'',group:''});
    }
    const errors=validate({rows});if(errors.length)throw Error(errors.map(i=>i.message).join('\n'));return rows;
  }
  function preprocess(source,config,filename){
    const c=normalize(config),issues=validate(c),env=new Map(c.rows.filter(r=>r.enabled).map(r=>[r.name,r.value])),files=new Map();
    for(const f of c.includes)try{files.set(pathName(f.name),f.text);}catch{}
    if(c.fileName&&!issues.length)files.set(c.fileName,exportHeader(c));
    const dependencies=new Set();let total=0;
    const report=(code,message,file,line)=>issues.push(issue(code,message,{file,line}));
    function run(text,file,chain){
      if(chain.length>16){report('INCLUDE_DEPTH','引用檔巢狀超過 16 層。',file,1);return '';}
      if(text.length>LIMIT){report('SOURCE_SIZE','RTL／引用檔超過 12 MB。',file,1);return '';}
      text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');let clean;
      try{clean=cleanComments(text);}catch(e){report(e.code,e.message,file,1);return '';}
      const lines=clean.split('\n'),raw=text.split('\n'),out=[],stack=[];let active=true;
      for(let i=0;i<lines.length;i++){
        const d=/^\s*`([A-Za-z_][A-Za-z0-9_$]*)([\s\S]*)$/.exec(lines[i]);
        const cmd=d&&d[1],arg=d&&d[2].trim();
        try{
          if(cmd==='ifdef'||cmd==='ifndef'){
            if(!IDENT.test(arg))fail('CONDITIONAL_SYNTAX','`'+cmd+' 後須為單一 macro 名稱。');
            const yes=cmd==='ifdef'?env.has(arg):!env.has(arg);stack.push({parent:active,taken:yes,elseSeen:false});active=active&&yes;out.push('');continue;
          }
          if(cmd==='elsif'){
            if(!stack.length||stack[stack.length-1].elseSeen||!IDENT.test(arg))fail('CONDITIONAL_SYNTAX','`elsif 的位置或條件不合法。');
            const s=stack[stack.length-1],yes=env.has(arg);active=s.parent&&!s.taken&&yes;s.taken=s.taken||yes;out.push('');continue;
          }
          if(cmd==='else'){
            if(!stack.length||stack[stack.length-1].elseSeen||arg)fail('CONDITIONAL_SYNTAX','`else 重複、無對應條件或含多餘文字。');
            const s=stack[stack.length-1];active=s.parent&&!s.taken;s.taken=true;s.elseSeen=true;out.push('');continue;
          }
          if(cmd==='endif'){
            if(!stack.length||arg)fail('CONDITIONAL_SYNTAX','`endif 無對應條件或含多餘文字。');active=stack.pop().parent;out.push('');continue;
          }
          if(!active){out.push('');continue;}
          if(cmd==='define'){
            const m=/^([A-Za-z_][A-Za-z0-9_$]*)([\s\S]*)$/.exec(arg);
            if(!m||m[2].startsWith('(')||/\\\s*$/.test(m[2]))fail('MACRO_UNSUPPORTED','目前不支援函式巨集或多行 define；請在公司流程預處理後再匯入。');
            const value=m[2].trim();if(env.has(m[1])&&env.get(m[1])!==value)fail('MACRO_REDEFINED','Macro '+m[1]+' 與目前設定不同，請消除重複來源後重試。');
            env.set(m[1],value);out.push('');continue;
          }
          if(cmd==='undef'){
            if(!IDENT.test(arg))fail('MACRO_UNDEF','`undef 後須為單一 macro 名稱。');env.delete(arg);out.push('');continue;
          }
          if(cmd==='include'){
            const m=/^"([^"\n]+)"$/.exec(arg);if(!m)fail('INCLUDE_SYNTAX','include 目前只支援明確的雙引號相對檔名。');
            const relative=pathName(m[1],file),direct=pathName(m[1]),name=files.has(relative)?relative:direct;
            if(chain.includes(name))fail('INCLUDE_CYCLE','引用檔循環：'+chain.concat(name).join(' → '));
            if(!files.has(name))fail('INCLUDE_MISSING','找不到引用檔 '+m[1]+'。請在 Defines 加入原始檔。');
            dependencies.add(name);out.push(run(files.get(name),name,chain.concat(name)));continue;
          }
          if(cmd&&['timescale','default_nettype','resetall','celldefine','endcelldefine'].includes(cmd)){out.push(raw[i]);continue;}
          // A macro may legitimately start a code line. Unknown compiler directives fail closed.
          const expanded=expand(lines[i],env);total+=expanded.length;if(total>LIMIT)fail('MACRO_SIZE','預處理內容超過 12 MB。');out.push(expanded);
        }catch(e){report(e.code||'PREPROCESS_FAILED',e.message,file,i+1);out.push('');}
      }
      if(stack.length)report('CONDITIONAL_BOUNDARY','條件編譯缺少 `endif。',file,lines.length);
      return out.join('\n');
    }
    const text=run(String(source||''),filename||'pasted.v',[filename||'pasted.v']);
    return {text,issues,dependencies:[...dependencies],key:fingerprint(c)};
  }
  function expandValue(text,config){const c=normalize(config);return expand(text,new Map(c.rows.filter(r=>r.enabled).map(r=>[r.name,r.value])));}
  function resolveProject(project){
    if(!project||!project.defineConfig)return {project:project||{},issues:[]};
    const c=normalize(project.defineConfig),issues=validate(c),env=new Map(c.rows.filter(r=>r.enabled).map(r=>[r.name,r.value]));
    const ex=(s,ref)=>{try{const value=expand(s,env);if(String(s||'').includes('`')&&!value.trim())fail('MACRO_EMPTY_VALUE','無值旗標不能作為連線、位寬或參數值；請填明確值，空接請使用「刻意留空」。');return value;}catch(e){issues.push(issue(e.code,e.message,{ref:ref||{type:'defines',id:'defines'}}));return String(s||'');}};
    const ps=value=>Array.isArray(value)?value.map(p=>({...p,value:ex(p.value)})):Object.fromEntries(Object.entries(value||{}).map(([k,v])=>[k,ex(v)]));
    const p={...project,parameters:ps(project.parameters),nets:(project.nets||[]).map(n=>({...n,range:ex(n.range,{type:'net',id:n.id})})),instances:(project.instances||[]).map(i=>({...i,parameters:ps(i.parameters)})),connections:(project.connections||[]).map(x=>({...x,expr:ex(x.expr,{type:'connection',id:x.id})})),assigns:(project.assigns||[]).map(x=>({...x,target:ex(x.target,{type:'assign',id:x.id}),expr:ex(x.expr,{type:'assign',id:x.id})}))};
    const key=fingerprint(c);
    p.modules=(project.modules||[]).map(m=>{
      if(m.preprocessKey!==undefined&&m.preprocessKey!==key)issues.push(issue('DEFINE_STALE','Define 組態已改變但 '+m.name+' 尚未重新解析。請到 Defines 預覽並套用。'));
      return {...m,parameters:ps(m.parameters),ports:(m.ports||[]).map(port=>({...port,range:ex(port.range,{type:'module',id:m.name})}))};
    });
    return {project:p,issues};
  }
  function sourcesFor(project){
    const found=new Map((project.rtlSources||[]).map(f=>[f.name,{name:f.name,text:f.text}]));
    for(const m of project.modules||[]){const name=m.sourceFilename||m.filename||m.name+'.v';if(!found.has(name)&&m.originalSource)found.set(name,{name,text:m.originalSource});}
    return [...found.values()];
  }
  function plan(project,config,parser){
    const c=normalize(config),errors=validate(c);if(errors.length)throw Error(errors.map(i=>i.message).join('\n'));
    const next=JSON.parse(JSON.stringify(project));next.defineConfig=c;next.rtlSources=sourcesFor(project);
    const rebuilt=[],sourceNames=new Set(),seen=new Set();
    for(const f of next.rtlSources){
      sourceNames.add(f.name);const parsed=parser.parseRtl(f.text,{config:c,filename:f.name});
      // A define edit re-elaborates the same file; it does not implement a
      // placeholder's functionality. Keep provenance outside the active module
      // list too, so a conditionally absent module remains a placeholder when
      // enabled again. Exact source text guards against transferring that label
      // to newly imported RTL with the same filename/module name.
      const sourceRow=(project.rtlSources||[]).find(row=>row.name===f.name);
      const saved=sourceRow&&sourceRow.placeholderProvenance;
      const provenance=new Map(saved&&saved.text===f.text&&Array.isArray(saved.modules)?saved.modules.filter(m=>m&&typeof m.name==='string').map(m=>[m.name,m]):[]);
      const previous=(project.modules||[]).filter(m=>m.placeholder===true&&(m.sourceFilename||m.filename||m.name+'.v')===f.name);
      if(previous.length){
        const prior=parser.parseRtl(f.text,{config:project.defineConfig,filename:f.name});
        for(const old of previous){
          const same=prior.modules.find(m=>m.name===old.name&&String(m.source).trim()===String(old.source).trim());
          if(same&&!prior.issues.some(i=>i.severity==='error'))provenance.set(old.name,{name:old.name,interfaceOnly:old.interfaceOnly===true,reason:typeof old.placeholderReason==='string'?old.placeholderReason:'介面預留：output 接零，不代表真實功能。'});
        }
      }
      if(provenance.size)f.placeholderProvenance={text:f.text,modules:[...provenance.values()]};
      for(const m of parsed.modules){
        const placeholder=provenance.get(m.name);
        if(placeholder){m.placeholder=true;m.placeholderReason=placeholder.reason;if(placeholder.interfaceOnly)m.interfaceOnly=true;}
        if(seen.has(m.name))m.issues.push(issue('DUPLICATE_MODULE','不同來源出現同名 module：'+m.name));seen.add(m.name);rebuilt.push(m);
      }
      if(!parsed.modules.length&&parsed.issues.some(x=>x.severity==='error')){
        for(const old of project.modules||[])if((old.sourceFilename||old.filename||old.name+'.v')===f.name)rebuilt.push({...old,preprocessKey:fingerprint(c),issues:parsed.issues});
      }
    }
    next.modules=(project.modules||[]).filter(m=>!sourceNames.has(m.sourceFilename||m.filename||m.name+'.v')).concat(rebuilt);
    // Legacy imports that discarded file-level directives cannot be safely reconstructed.
    for(const m of next.modules)if(!m.originalSource&&(m.issues||[]).some(i=>i.code==='FILE_PREPROCESSOR_UNRESOLVED'))m.issues.push(issue('ORIGINAL_SOURCE_REQUIRED','舊專案沒有保存完整檔案條件；請重新匯入 '+m.name+' 的完整 RTL。'));
    const changes=[];
    const defineChanges=[];
    for(const name of new Set(normalize(project.defineConfig).rows.concat(c.rows).map(r=>r.name))){
      const before=normalize(project.defineConfig).rows.find(r=>r.name===name),after=c.rows.find(r=>r.name===name),desc=r=>r&&r.enabled?(r.value||'已定義（无值旗標）'):'未定義';
      if(desc(before)!==desc(after))defineChanges.push({name,before:desc(before),after:desc(after)});
    }
    for(const name of new Set((project.modules||[]).concat(next.modules).map(m=>m.name))){
      const before=(project.modules||[]).find(m=>m.name===name),after=next.modules.find(m=>m.name===name);
      if(!before||!after){changes.push({module:name,port:'（整個 module）',before:before?'存在':'未啟用',after:after?'存在':'未啟用'});continue;}
      for(const pin of new Set(before.ports.concat(after.ports).map(p=>p.name))){
        const a=before.ports.find(p=>p.name===pin),b=after.ports.find(p=>p.name===pin),desc=p=>p?p.direction+' '+(p.range||'1 bit'):'不存在';
        if(desc(a)!==desc(b))changes.push({module:name,port:pin,before:desc(a),after:desc(b)});
      }
      if(JSON.stringify(before.parameters)!==JSON.stringify(after.parameters))changes.push({module:name,port:'參數預設值',before:before.parameters.map(p=>p.name+'='+p.value).join(', '),after:after.parameters.map(p=>p.name+'='+p.value).join(', ')});
    }
    const Core=typeof WIUCore!=='undefined'?WIUCore:typeof require==='function'?require('./assembly-core.js'):null;
    if(Core){
      const signatures=p=>{
        const e=resolveProject(p).project,map=new Map(),pars=Array.isArray(e.parameters)?e.parameters:Object.entries(e.parameters||{}).map(([name,value])=>({name,value})),ctx=Core.resolveParameters({parameters:pars},{}).context;
        const description=(port,context)=>{try{const r=Core.parseRange(port.range,context);return port.direction+' ['+r.msb+':'+r.lsb+'] · '+r.width+' bit';}catch{return port.direction+' '+(port.range||'1 bit')+'（未解析）';}};
        for(const n of e.nets)map.set('net:'+n.id,{module:n.direction==='wire'?'內部 net':'Top',port:n.name,value:description(n,ctx)});
        for(const i of e.instances){const m=e.modules.find(m=>m.name===i.module);if(!m)continue;const inner=Core.resolveParameters(m,i.parameters,ctx).context;for(const port of m.ports)map.set('pin:'+i.id+':'+port.name,{module:i.name,port:port.name,value:description(port,inner)});}
        return map;
      };
      const before=signatures(project),after=signatures(next);
      for(const [key,a]of before){const b=after.get(key);if(b&&a.value!==b.value)changes.push({module:b.module,port:b.port,before:a.value,after:b.value});}
    }
    for(const m of next.modules)if(next.rtlSources.some(f=>f.name===m.sourceFilename))delete m.originalSource;
    next.orgEdited=true;return {project:next,changes,defineChanges};
  }
  return {defaults,normalize,validate,fileName,fingerprint,marker,exportHeader,importHeader,preprocess,expandValue,resolveProject,plan,sourcesFor,pathName};
});
