/* WIU assembly source import. Bounded preprocessing is explicit; no eval or silent port guessing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WIUParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;
  const DIR = /^(input|output|inout)\b/;
  const TYPES = /^(?:(?:wire|reg|logic|tri|tri0|tri1|wand|wor|uwire|var|bit|signed|unsigned)\b\s*)+/;
  function issue(list, severity, code, message, extra) { const item = Object.assign({severity,code,message},extra || {}); list.push(item); return item; }
  function stripComments(text) {
    let out = '', mode = '', quote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i+1];
      if (mode === 'line') { if (c === '\n') { mode=''; out+='\n'; } else out+=' '; continue; }
      if (mode === 'block') { if (c === '*' && n === '/') {out+='  ';i++;mode='';} else out+=c==='\n'?'\n':' '; continue; }
      if (quote) {out+=c;if(c==='\\'&&i+1<text.length)out+=text[++i];else if(c==='"')quote=false;continue;}
      if (c === '"') {quote=true;out+=c;continue;}
      if (c==='/'&&n==='/'){mode='line';out+='  ';i++;continue;}
      if (c==='/'&&n==='*'){mode='block';out+='  ';i++;continue;}
      out+=c;
    }
    return out;
  }
  function splitTop(text, separator) {
    const out=[];let start=0,p=0,b=0,c=0,quote=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];if(quote){if(ch==='\\')i++;else if(ch==='"')quote=false;continue;}
      if(ch==='"'){quote=true;continue;} if(ch==='(')p++;else if(ch===')')p--;else if(ch==='[')b++;else if(ch===']')b--;else if(ch==='{')c++;else if(ch==='}')c--;
      if(ch===separator&&p===0&&b===0&&c===0){out.push(text.slice(start,i));start=i+1;}
    }
    out.push(text.slice(start));return out;
  }
  function balanced(text,start,open,close){
    if(text[start]!==open)return null;let depth=0,quote=false;
    for(let i=start;i<text.length;i++){const c=text[i];if(quote){if(c==='\\')i++;else if(c==='"')quote=false;continue;}if(c==='"'){quote=true;continue;}if(c===open)depth++;if(c===close&&!--depth)return {text:text.slice(start+1,i),end:i+1};}
    return null;
  }
  function ws(text,pos){while(/\s/.test(text[pos]||'')&&pos<text.length)pos++;return pos;}
  function commentFor(source,name){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('\\b'+escaped+'\\b[^\\n]*?//([^\\n]*)');const m=re.exec(source);return m?m[1].trim():'';
  }
  function parseParameters(text,issues){
    const out=[];let inheritedType='',inheritedLocal=false;
    for(let raw of splitTop(text,',')){
      raw=raw.trim();const keyword=/^(parameter|localparam)\s+/.exec(raw);
      if(keyword){inheritedType='';inheritedLocal=keyword[1]==='localparam';raw=raw.slice(keyword[0].length);}
      if(!raw)continue;
      const eq=raw.indexOf('=');if(eq<0){issue(issues,'error','PARAMETER_SYNTAX','無法解析參數宣告：'+raw);continue;}
      const lhs=raw.slice(0,eq).trim(), value=raw.slice(eq+1).trim();const nameMatch=/([A-Za-z_][A-Za-z0-9_$]*)\s*$/.exec(lhs);
      if(!nameMatch||!value){issue(issues,'error','PARAMETER_SYNTAX','無法解析參數宣告：'+raw);continue;}
      const declaredType=lhs.slice(0,nameMatch.index).trim();if(declaredType)inheritedType=declaredType;
      const type=inheritedType;
      if(/\btype\b/.test(type))issue(issues,'error','TYPE_PARAMETER','型別參數需要外部 elaboration：'+nameMatch[1]);
      out.push({name:nameMatch[1],value,type,local:inheritedLocal,source:raw});
    }return out;
  }
  function parsePortChunk(raw,inherited,issues,source){
    raw=raw.trim();if(!raw)return {state:inherited,port:null};
    const dm=DIR.exec(raw);let state=Object.assign({},inherited||{});
    if(dm){state={direction:dm[1],range:'',signed:false};raw=raw.slice(dm[0].length).trim();}
    if(!state.direction){issue(issues,'error','PORT_DIRECTION','無法判定 port 方向：'+raw);return {state,port:null};}
    if(dm||TYPES.test(raw)||raw[0]==='['){
      let prefix='';const tm=TYPES.exec(raw);if(tm){prefix=tm[0];raw=raw.slice(tm[0].length).trim();}
      if(/\bsigned\b/.test(prefix))state.signed=true;if(/\bunsigned\b/.test(prefix))state.signed=false;
      if(raw[0]==='['){const r=balanced(raw,0,'[',']');if(!r){issue(issues,'error','PORT_RANGE','port range 括號不完整：'+raw);return {state,port:null};}state.range='['+r.text.trim()+']';raw=raw.slice(r.end).trim();if(raw[0]==='['){issue(issues,'error','MULTIDIMENSIONAL_PORT','多維 packed array 尚未原生解析：'+raw);return {state,port:null};}}
    }
    const match=/^([A-Za-z_][A-Za-z0-9_$]*)([\s\S]*)$/.exec(raw);
    if(!match){issue(issues,'error','PORT_SYNTAX','無法解析 port，原文已保留：'+raw);return {state,port:null};}
    const tail=match[2].trim();
    if(tail){issue(issues,'error','PORT_UNSUPPORTED','port 含未支援的陣列或預設值，原文已保留：'+raw);return {state,port:{name:match[1],direction:state.direction,range:state.range||'',signed:!!state.signed,comment:commentFor(source,match[1]),unsupported:true,source:raw}};}
    return {state,port:{name:match[1],direction:state.direction,range:state.range||'',signed:!!state.signed,comment:commentFor(source,match[1])}};
  }
  function parseRtlRaw(source){
    source=String(source||'');const issues=[],modules=[];const clean=stripComments(source);const moduleRe=/\bmodule\s+(?:(?:automatic|static)\s+)?([A-Za-z_][A-Za-z0-9_$]*)/g;let mm;
    while((mm=moduleRe.exec(clean))){
      const name=mm[1],local=[],start=mm.index;let cursor=ws(clean,moduleRe.lastIndex),paramText='';
      if(clean[cursor]==='#'){cursor=ws(clean,cursor+1);const params=balanced(clean,cursor,'(',')');if(!params){issue(local,'error','MODULE_HEADER','參數括號不完整：'+name);issues.push(...local);continue;}paramText=params.text;cursor=ws(clean,params.end);}
      let header='',headerStart=cursor;
      if(clean[cursor]==='('){const hp=balanced(clean,cursor,'(',')');if(!hp){issue(local,'error','MODULE_HEADER','port 括號不完整：'+name);issues.push(...local);continue;}header=hp.text;cursor=ws(clean,hp.end);}
      if(clean[cursor]!==';'){issue(local,'error','MODULE_HEADER','module header 結尾缺少分號：'+name);issues.push(...local);continue;}
      const endRe=/\bendmodule\b/g;endRe.lastIndex=cursor+1;const em=endRe.exec(clean);if(!em){issue(local,'error','MISSING_ENDMODULE','缺少 endmodule：'+name);issues.push(...local);continue;}
      const body=clean.slice(cursor+1,em.index).replace(/\b(function|task)\b[\s\S]*?\bend(?:function|task)\b/g,m=>m.replace(/[^\n]/g,' ')),moduleSource=source.slice(start,em.index+em[0].length),ports=[],parameters=parseParameters(paramText,local);
      const directives=moduleSource.match(/^\s*`(?:ifdef|ifndef|else|elsif|endif|include|define|undef)\b[^\n]*/gm)||[];
      if(directives.length)issue(local,'error','PREPROCESSOR_UNRESOLVED','module '+name+' 含前處理條件或 include；未執行 elaboration，原文已保留。',{blocking:true});
      const headerClean=header.replace(/^\s*`[^\n]*/gm,'');
      if(/\b(?:input|output|inout)\b/.test(headerClean)){
        let state=null;for(const chunk of splitTop(headerClean,',')){const p=parsePortChunk(chunk,state,local,moduleSource);state=p.state;if(p.port)ports.push(p.port);}
      } else {
        const order=splitTop(headerClean,',').map(x=>x.trim()).filter(Boolean),declared=new Map();
        for(const statement of splitTop(body,';')){
          const s=statement.trim();if(!DIR.test(s))continue;
          let state=null;for(const chunk of splitTop(s,',')){const p=parsePortChunk(chunk,state,local,moduleSource);state=p.state;if(p.port){if(declared.has(p.port.name))issue(local,'error','DUPLICATE_PORT','重複宣告 port：'+p.port.name);declared.set(p.port.name,p.port);}}
        }
        for(const pname of order){if(!IDENT.test(pname)){issue(local,'error','CLASSIC_PORT_SYNTAX','未支援的 classic port 表達式：'+pname);continue;}if(declared.has(pname))ports.push(declared.get(pname));else issue(local,'error','UNDECLARED_PORT','header 中的 port 缺少方向宣告：'+pname);}
        for(const [pname] of declared)if(!order.includes(pname))issue(local,'error','PORT_NOT_IN_HEADER','方向宣告未列入 module header：'+pname);
      }
      for(const s of splitTop(body,';')){if(/^\s*(?:parameter|localparam)\b/.test(s))for(const p of parseParameters(s,local)){if(!parameters.some(x=>x.name===p.name)){p.local=/^\s*localparam/.test(s);parameters.push(p);}}}
      const seen=new Set();for(const p of ports){if(seen.has(p.name))issue(local,'error','DUPLICATE_PORT','重複 port：'+p.name);seen.add(p.name);}
      modules.push({name,ports,parameters,source:moduleSource,issues:local});for(const item of local)issues.push(Object.assign({module:name},item));moduleRe.lastIndex=em.index+em[0].length;
    }
    if(!modules.length)issue(issues,'error','NO_MODULE','未找到可解析的 module 宣告。');
    let outside=source;for(const m of modules)outside=outside.replace(m.source,m.source.replace(/[^\n]/g,' '));
    if(/^\s*`(?:ifdef|ifndef|else|elsif|endif|include|define|undef)\b/m.test(outside)){for(const m of modules){const e=issue(m.issues,'error','FILE_PREPROCESSOR_UNRESOLVED','檔案層級含前處理設定；匯入介面前須確認有效組態。',{blocking:true});issues.push(Object.assign({module:m.name},e));}}
    const names=new Set();for(const m of modules){if(names.has(m.name))issue(issues,'error','DUPLICATE_MODULE','重複 module：'+m.name);names.add(m.name);}
    return {modules,issues};
  }
  function parseRtl(source,options){
    if(!options)return parseRtlRaw(source);
    const D=typeof WIUDefines!=='undefined'?WIUDefines:typeof require==='function'?require('./assembly-defines.js'):null;
    if(!D)throw Error('Define parser 尚未載入。');
    const pp=D.preprocess(source,options.config,options.filename),result=parseRtlRaw(pp.text);
    if(!result.modules.length&&!pp.issues.length&&!/\bmodule\b/.test(pp.text))result.issues=[{severity:'warning',code:'NO_ACTIVE_MODULE',message:'目前 define 組態沒有啟用任何 module。請確認條件。'}];
    result.issues.push(...pp.issues);
    const name=options.filename||(result.modules[0]?.name||'pasted')+'.v';
    for(const m of result.modules){m.originalSource=String(source);m.sourceFilename=name;m.filename=name;m.preprocessKey=pp.key;m.includeDependencies=pp.dependencies;m.issues.push(...pp.issues);}
    result.sources=[{name,text:String(source)}];return result;
  }
  function tokenize(text){
    const out=[];let start=-1,p=0,b=0,c=0,q=false;
    for(let i=0;i<=text.length;i++){const x=text[i]||' ';if(start<0){if(/\s/.test(x))continue;start=i;}if(q){if(x==='\\')i++;else if(x==='"')q=false;continue;}if(x==='"')q=true;else if(x==='(')p++;else if(x===')')p--;else if(x==='[')b++;else if(x===']')b--;else if(x==='{')c++;else if(x==='}')c--;if(/\s/.test(x)&&!p&&!b&&!c){out.push(text.slice(start,i));start=-1;}}
    return out;
  }
  function declarations(source){
    const result=[];const clean=stripComments(source);const re=/(?:^|[;\n])\s*(input|output|inout|wire)\s+([^;]+);/g;let m;
    while((m=re.exec(clean))){let state={direction:m[1],range:'',signed:false};for(let part of splitTop(m[2],',')){part=part.trim();let tm=TYPES.exec(part);if(tm){state.signed=/\bsigned\b/.test(tm[0]);part=part.slice(tm[0].length).trim();}if(part[0]==='['){const r=balanced(part,0,'[',']');if(!r)continue;state.range='['+r.text.trim()+']';part=part.slice(r.end).trim();}if(IDENT.test(part))result.push(Object.assign({name:part},state));}re.lastIndex=Math.max(m.index+1,re.lastIndex-1);}
    return result;
  }
  function generatedInstances(source){
    const out=[];const clean=stripComments(source);
    for(let statement of splitTop(clean,';')){
      statement=statement.trim();const tm=/^([A-Za-z_][A-Za-z0-9_$]*)\s+/.exec(statement);if(!tm||/^(?:module|input|output|inout|wire|reg|logic|assign|parameter|localparam|endmodule)$/.test(tm[1]))continue;
      let pos=ws(statement,tm[0].length),params=[];
      if(statement[pos]==='#'){pos=ws(statement,pos+1);const pp=balanced(statement,pos,'(',')');if(!pp)continue;params=splitTop(pp.text,',');pos=ws(statement,pp.end);}
      const im=/^([A-Za-z_][A-Za-z0-9_$]*)/.exec(statement.slice(pos));if(!im)continue;pos=ws(statement,pos+im[0].length);const ports=balanced(statement,pos,'(',')');if(!ports)continue;
      const bindings=[];for(const p of splitTop(ports.text,',')){const pm=/^\s*\.([A-Za-z_][A-Za-z0-9_$]*)\s*\(/.exec(p);if(!pm)continue;const val=balanced(p,p.indexOf('(',pm.index),'(',')');if(val)bindings.push({port:pm[1],expr:val.text.trim()});}
      const parameters={};for(const p of params){const pm=/^\s*\.([A-Za-z_][A-Za-z0-9_$]*)\s*\(/.exec(p);if(!pm)continue;const val=balanced(p,p.indexOf('(',pm.index),'(',')');if(val)parameters[pm[1]]=val.text.trim();}
      out.push({module:tm[1],name:im[1],bindings,parameters});
    }return out;
  }
  function blockStateAfter(line,inside){
    let quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i],next=line[i+1];
      if(inside){if(ch==='*'&&next==='/'){inside=false;i++;}continue;}
      if(quoted){if(ch==='\\')i++;else if(ch==='"')quoted=false;continue;}
      if(ch==='"'){quoted=true;continue;}
      if(ch==='/'&&next==='/')break;
      if(ch==='/'&&next==='*'){inside=true;i++;}
    }
    return inside;
  }
  function directiveComment(text){
    let quoted=false,escaped=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];if(escaped){escaped=false;continue;}
      if(ch==='\\'&&quoted){escaped=true;continue;}
      if(ch==='"')quoted=!quoted;
      if(ch==='#'&&!quoted)return text.slice(0,i).trimEnd();
    }
    return text;
  }
  function importOrg(source, suppliedModules, options){
    source=String(source||'');suppliedModules=Array.isArray(suppliedModules)?suppliedModules:[];
    const issues=[],project={schema:1,top:'top',modules:suppliedModules.map(m=>Object.assign({},m)),instances:[],nets:[],connections:[],assigns:[],formats:[],advanced:'',prelude:'',originalOrg:source,importUnresolved:[]};
    const layoutApi=globalThis.WIUOrgLayout||(typeof require==='function'?require('./org-layout'):null);
    const layout=layoutApi.reader(), netNotes=new Map(), layoutLines=new Set();
    const lines=source.split(/\r?\n/),active=[],raw=[],generated=[];let inGenerated=false,inC=false,conditionalDepth=0,blockComment=false,seq=0;
    const id=(kind)=>'import_'+kind+'_'+(++seq);
    const unresolved=(code,message,extra)=>{const e=issue(issues,'warning',code,message,Object.assign({blocking:true},extra));project.importUnresolved.push(e);return e;};
    // Only the teaching template's empty FPGA placeholder is inert. A realtek
    // directive is semantically active even though Verilog calls it a comment.
    function emptyFpgaSectionEnd(start){
      if(!/^\s*`ifdef\s+FPGA\s*(?:\/\/[^\n]*)?$/.test(lines[start]))return -1;
      for(let end=start+1;end<lines.length;end++){
        if(/^\s*`endif\s*(?:\/\/[^\n]*)?$/.test(lines[end])){
          const body=lines.slice(start+1,end).join('\n');
          if(/\brealtek\b|`/.test(body)||!body.split('\n').every(line=>/^\s*(?:\/\/[^\n]*)?$/.test(line)))return -1;
          return end;
        }
        if(/^\s*`/.test(lines[end]))return -1;
      }
      return -1;
    }
    for(let i=0;i<lines.length;i++){
      const line=lines[i],wasBlock=blockComment;blockComment=blockStateAfter(line,blockComment);
      if(wasBlock){(inGenerated?generated:raw).push(line);continue;}
      const m=/^\s*\/\/\s*realtek\s+(\S+)(?:\s+([\s\S]*))?$/.exec(directiveComment(line));
      if(!inGenerated&&!inC&&!conditionalDepth){const end=emptyFpgaSectionEnd(i);if(end>=0){
        const fragment={kind:'empty-fpga-placeholder',line:i+1,source:lines.slice(i,end+1).join('\n')};
        (project.importPreservedFragments||(project.importPreservedFragments=[])).push(fragment);
        issue(issues,'warning','EMPTY_FPGA_SECTION_PRESERVED','空的 FPGA 區塊沒有接線或邏輯作用；原文已保存，工作包會保留這個空區塊。',{line:i+1,blocking:false});
        i=end;continue;
      }}
      if(!inGenerated&&!inC&&/^\s*`(?:ifdef|ifndef)\b/.test(line)){conditionalDepth++;raw.push(line);if(conditionalDepth===1)unresolved('CONDITIONAL_SOURCE_PRESERVED','條件編譯區段完整保留，未將其中指令視為無條件連線。',{line:i+1});continue;}
      if(conditionalDepth){raw.push(line);if(/^\s*`endif\b/.test(line))conditionalDepth--;continue;}
      if(m&&m[1]==='begin'){if(inGenerated)unresolved('GENERATED_BOUNDARY','巢狀 realtek begin，請核對原文。',{line:i+1});inGenerated=true;continue;}
      if(m&&m[1]==='end'){if(!inGenerated)unresolved('GENERATED_BOUNDARY','沒有對應 begin 的 realtek end。',{line:i+1});inGenerated=false;continue;}
      if(inGenerated){generated.push(line);continue;}
      if(inC){raw.push(line);if(m&&m[1]==='c_code'&&(m[2]||'').trim()==='end')inC=false;continue;}
      if(m&&m[1]==='c_code'&&(m[2]||'').trim()==='begin'){inC=true;raw.push(line);unresolved('C_CODE_PRESERVED','C code 已保留，僅由公司 gen_top 執行；直接 Verilog 不包含其執行結果。',{line:i+1});continue;}
      if(m){
        const meta=['input','output','inout','port','wire'].includes(m[1])?layout.member():null;
        active.push({kind:m[1],args:(m[2]||'').trim(),line:i+1,raw:line,meta});
      }else{
        const note=/^\s*\/\/ Note ([A-Za-z_][\w$]*) \| (.*)$/.exec(line);
        const consumed=note||layout.consume(line);
        if(note)netNotes.set(note[1],note[2]);
        if(!consumed)raw.push(line);
        else if(options?.recoverSavedLayout){layoutLines.add(raw.length);raw.push(line);}
      }
    }
    layout.finish();project.orgLayout=layout.layout;
    if(conditionalDepth)unresolved('CONDITIONAL_BOUNDARY','條件編譯缺少 endif。');
    if(inGenerated)unresolved('GENERATED_BOUNDARY','realtek begin 缺少 end。');if(inC)unresolved('C_CODE_BOUNDARY','c_code begin 缺少 end。');
    const fullRtl=parseRtl(source),topMod=fullRtl.modules[0];if(topMod){project.top=topMod.name;if(topMod.parameters.length)project.parameters=topMod.parameters.map(p=>Object.assign({},p));}
    const genText=generated.join('\n'),genDecls=declarations(genText),genBindings=generatedInstances(genText),declMap=new Map(genDecls.map(n=>[n.name,n]));
    if(topMod)for(const p of topMod.ports)if(!declMap.has(p.name))declMap.set(p.name,p);
    const aliases=new Map(),netMap=new Map();
    function addNet(name,range,direction,extra){
      let n=netMap.get(name);if(n){if(range)n.range=range;if(direction&&direction!=='wire')n.direction=direction;Object.assign(n,extra||{});return n;}
      const d=declMap.get(name)||{};n=Object.assign({id:id('net'),name,range:range||d.range||'',direction:direction||d.direction||'wire',signed:!!d.signed,comment:'',group:''},extra||{});netMap.set(name,n);project.nets.push(n);return n;
    }
    function instancesFor(token,line){
      const m=/^([A-Za-z_][A-Za-z0-9_$]*)(?:\.(\d+)(?:-(\d+))?)?$/.exec(token);if(!m){const exact=project.instances.filter(x=>x.name===token);if(exact.length===1)return exact;unresolved('INSTANCE_REFERENCE','無法解析 instance 參照：'+token,{line});return [];}
      if(m[2]!==undefined){const lo=Number(m[2]),hi=m[3]===undefined?lo:Number(m[3]),arr=[];if(hi<lo||hi-lo>10000){unresolved('INSTANCE_RANGE','instance range 無效或過大：'+token,{line});return arr;}for(let k=lo;k<=hi;k++){const inst=aliases.get(m[1]+'.'+k);if(inst)arr.push(inst);else unresolved('MISSING_INSTANCE','找不到 instance：'+m[1]+'.'+k,{line});}return arr;}
      if(aliases.has(token))return [aliases.get(token)];const list=project.instances.filter(x=>x.module===token);if(list.length===1)return list;unresolved('INSTANCE_REFERENCE','instance 參照不存在或不唯一：'+token,{line});return [];
    }
    for(const d of active.filter(d=>d.kind==='inst')){
      for(const token of tokenize(d.args)){
        const m=/^([A-Za-z_][A-Za-z0-9_$]*)(?:\.(\d+)(?:-(\d+))?)?(?:\.([A-Za-z_][A-Za-z0-9_$]*))?$/.exec(token);
        if(!m){raw.push('// realtek inst '+token);unresolved('INST_SYNTAX','未支援的 inst 語法已保留：'+token,{line:d.line});continue;}
        const indexed=m[2]!==undefined,lo=indexed?(m[3]!==undefined?Number(m[2]):0):0,hi=indexed?Number(m[3]===undefined?m[2]:m[3]):0;
        if(hi<lo||hi-lo>10000||(m[4]&&lo!==hi)){raw.push('// realtek inst '+token);unresolved('INST_RANGE','inst range 或自訂名稱無效：'+token,{line:d.line});continue;}
        for(let k=lo;k<=hi;k++){
          const key=indexed?m[1]+'.'+k:m[1];if(aliases.has(key)){unresolved('DUPLICATE_INSTANCE','重複 instance 設定：'+key,{line:d.line});continue;}
          // Scalar .0 creates <module>_inst, not _inst_0.
          // Keep the .0 alias so explicit module.0.port references still resolve.
          const scalarZero=indexed&&m[3]===undefined&&hi===0;
          const inst={id:id('instance'),name:m[4]||(m[1]+'_inst'+(indexed&&!scalarZero?'_'+k:'')),module:m[1],parameters:{},orgRef:key,orgIndex:indexed?k:null};project.instances.push(inst);aliases.set(key,inst);
          if(m[4]){inst.orgCustomName=true;unresolved('CUSTOM_INSTANCE_UNVERIFIED','已保留自訂 instance 名稱；公司工具的 endpoint 命名須實測：'+token,{line:d.line,blocking:false});}
        }
      }
    }
    for(const d of active.filter(d=>['input','output','inout','wire','port'].includes(d.kind))){
      const tokens=tokenize(d.args);
      for(const token of tokens){
        const m=/^([A-Za-z_][A-Za-z0-9_$]*)(?:\.(\[[\s\S]+\]))?$/.exec(token);if(!m){raw.push('// realtek '+d.kind+' '+token);unresolved('NET_DECLARATION','無法解析 net 宣告：'+token,{line:d.line});continue;}
        const dir=d.kind==='port'?(declMap.get(m[1])||{}).direction:d.kind;
        const net=addNet(m[1],m[2]||'',dir||'wire',{group:d.meta?.group||'',orgPortAuto:d.kind==='port',orgRangeSpecified:!!m[2],origin:'directive'});
        if(d.meta?.prior.length && token===tokens[0])project.orgLayout.before[net.id]=d.meta.prior;
        if(d.kind==='port'&&!dir)unresolved('PORT_DIRECTION_UNRESOLVED','port 自動方向尚未解析：'+m[1],{line:d.line});
      }
    }
    for(const [name,text] of netNotes)if(netMap.has(name))netMap.get(name).comment=text;
    const supported=new Set(['inst','input','output','inout','wire','port','format','conn','assign','param','comment']);
    for(const d of active){
      if(d.kind==='format'){for(const f of tokenize(d.args))if(!project.formats.includes(f))project.formats.push(f);continue;}
      if(d.kind==='conn'){
        const tokens=tokenize(d.args),expr=tokens.shift();if(expr===undefined||!tokens.length){raw.push(d.raw);unresolved('CONN_SYNTAX','conn 缺少目標或 port。',{line:d.line});continue;}
        for(const endpoint of tokens){const em=/^(?:(i|o|io):)?([A-Za-z_][A-Za-z0-9_$]*(?:\.\d+(?:-\d+)?)?)\.([A-Za-z_][A-Za-z0-9_$]*)$/.exec(endpoint);if(!em){raw.push('// realtek conn '+expr+' '+endpoint);unresolved('CONN_ENDPOINT','無法解析 conn endpoint：'+endpoint,{line:d.line});continue;}
          const endpointInstances=instancesFor(em[2],d.line);if(!endpointInstances.length)raw.push('// realtek conn '+expr+' '+endpoint);
          for(const inst of endpointInstances){const old=project.connections.find(c=>c.instance===inst.id&&c.port===em[3]);if(old){unresolved('DUPLICATE_BINDING','同一 pin 有多個 conn，原文已保留：'+endpoint,{line:d.line});raw.push('// realtek conn '+expr+' '+endpoint);continue;}project.connections.push({id:id('connection'),instance:inst.id,port:em[3],expr:expr==='""'?'':expr,orgDirection:em[1]||'',origin:'directive'});}
        }continue;
      }
      if(d.kind==='assign'){
        const m=/^(.+?)\s*=\s*([\s\S]+?)\s*;?$/.exec(d.args);if(!m){raw.push(d.raw);unresolved('ASSIGN_SYNTAX','無法解析 assign：'+d.args,{line:d.line});continue;}project.assigns.push({id:id('assign'),target:m[1].trim(),expr:m[2].replace(/;\s*$/,'').trim()});continue;
      }
      if(d.kind==='param'){
        for(const token of tokenize(d.args)){const pm=/^([A-Za-z_][A-Za-z0-9_$]*(?:\.\d+(?:-\d+)?)?)\.([A-Za-z_][A-Za-z0-9_$]*)\.([\s\S]+)$/.exec(token);if(!pm){raw.push('// realtek param '+token);unresolved('PARAM_SYNTAX','無法解析 param：'+token,{line:d.line});continue;}const parameterInstances=instancesFor(pm[1],d.line);if(!parameterInstances.length)raw.push('// realtek param '+token);for(const inst of parameterInstances){if(Object.prototype.hasOwnProperty.call(inst.parameters,pm[2]))unresolved('DUPLICATE_PARAM','重複 parameter override：'+token,{line:d.line});inst.parameters[pm[2]]=pm[3];}}continue;
      }
      if(d.kind==='comment'){const cm=/^([A-Za-z_][A-Za-z0-9_$]*)\.(\/\/[\s\S]*)$/.exec(d.args);if(cm){const n=addNet(cm[1],'',null);n.comment=cm[2].slice(2).trim();n.orgCommentDirective=true;}else{raw.push(d.raw);unresolved('COMMENT_SYNTAX','未支援的 comment 已保留：'+d.args,{line:d.line});}continue;}
      if(!supported.has(d.kind)){raw.push(d.raw);unresolved('DIRECTIVE_PRESERVED','進階指令已保留，尚未原生解讀：'+d.kind,{line:d.line});}
    }
    const C=typeof WIUCore!=='undefined'?WIUCore:typeof require==='function'?require('./assembly-core.js'):null;
    const compact=text=>String(text||'').replace(/\s+/g,'');
    // Resolve any legacy parameter snapshot before interpreting current RTL
    // widths. Explicit param directives always win and disagreement blocks.
    for(const g of genBindings){const inst=project.instances.find(i=>i.name===g.name&&i.module===g.module);if(!inst)continue;let used=0;
      for(const [k,v] of Object.entries(g.parameters)){if(!(k in inst.parameters)){inst.parameters[k]=v;used++;}else if(compact(inst.parameters[k])!==compact(v))unresolved('GENERATED_PARAMETER_STALE','生成區域參數與目前 param 指令不同：'+g.name+'.'+k,{instance:inst.id});}
      if(used)issue(issues,'warning','GENERATED_PARAMETERS_RECOVERED','從生成區域還原 '+g.name+' 的 '+used+' 個參數覆寫；請核對是否仍符合原始設定。',{instance:inst.id});
    }
    let topContext={};try{if(C)topContext=C.resolveParameters({parameters:project.parameters||[]},{},{}).context;}catch{}
    function portShape(inst,port){
      const mod=project.modules.find(m=>m.name===inst.module);
      if(!mod||port.unsupported||(mod.issues||[]).some(e=>e.severity==='error'))return null;
      try{if(C){const resolved=C.resolveParameters(mod,inst.parameters,topContext);if(resolved.errors.length)return null;const r=C.parseRange(port.range,resolved.context);return {range:!r.raw?'':'['+r.msb+':'+r.lsb+']',signed:!!port.signed};}}catch{return null;}
      if(!port.range||/^\[\d+:\d+\]$/.test(compact(port.range)))return {range:compact(port.range),signed:!!port.signed};
      return null;
    }
    function sameRange(a,b){try{if(C){const x=C.parseRange(a,topContext),y=C.parseRange(b,topContext);return x.msb===y.msb&&x.lsb===y.lsb&&!!x.raw===!!y.raw;}}catch{return false;}return compact(a)===compact(b);}
    // Reconstruct implicit Top bindings from current source interfaces, never
    // from a potentially stale generated instance. Export then makes them explicit.
    for(const inst of project.instances){
      const mod=project.modules.find(m=>m.name===inst.module);if(!mod)continue;let count=0;
      for(const port of mod.ports||[]){
        const n=netMap.get(port.name);if(!n||n.origin!=='directive'||n.direction==='wire'||project.connections.some(c=>c.instance===inst.id&&c.port===port.name))continue;
        const shape=portShape(inst,port);
        if(!shape||n.direction!==port.direction||(n.orgRangeSpecified&&!sameRange(n.range,shape.range))){unresolved('IMPLICIT_TOP_INTERFACE_CONFLICT','同名 Top 接腳與目前 RTL 介面不相容，未自動連接：'+inst.name+'.'+port.name,{instance:inst.id,net:n.id});continue;}
        project.connections.push({id:id('connection'),instance:inst.id,port:port.name,expr:n.name,origin:'implicit-top'});count++;
      }
      if(count)issue(issues,'warning','IMPLICIT_TOP_BINDINGS_RECONSTRUCTED','依目前 RTL 介面重建 '+inst.name+' 的 '+count+' 條同名 Top 接線；請核對後匯出，工作包沿用同名 Top 隱式接線。',{instance:inst.id,blocking:false});
    }
    // Omitted directive ranges are inferred only when every directly attached
    // current-source port agrees. This also detects stale generated wire widths.
    for(const n of project.nets.filter(n=>n.origin==='directive'&&!n.orgRangeSpecified)){
      const shapes=project.connections.filter(c=>c.expr===n.name).map(c=>{const inst=project.instances.find(i=>i.id===c.instance),mod=inst&&project.modules.find(m=>m.name===inst.module),port=mod&&(mod.ports||[]).find(p=>p.name===c.port);return port&&portShape(inst,port);});
      if(!shapes.length||shapes.some(s=>!s))continue;
      if(shapes.some(s=>!sameRange(s.range,shapes[0].range)||s.signed!==shapes[0].signed)){unresolved('IMPLICIT_NET_INTERFACE_CONFLICT','未指定範圍的訊號連到不同的 RTL 介面，請明確設定：'+n.name,{net:n.id});continue;}
      // A width-less directive can connect a scalar to [0:0]. Keep the saved
      // interface spelling when both address the same single bit.
      const saved=declMap.get(n.name), inferred=shapes[0].range;
      const bitZero=range=>range===''||compact(range)==='[0:0]';
      n.range=saved && bitZero(saved.range) && bitZero(inferred)?saved.range:inferred;
      n.signed=shapes[0].signed;n.rangeOrigin='current-rtl';
    }
    for(const g of genBindings){
      const inst=project.instances.find(i=>i.name===g.name&&i.module===g.module);
      if(!inst){unresolved('GENERATED_INSTANCE_STALE','生成區域含目前 inst 指令沒有的實例：'+g.name);continue;}
      const mod=project.modules.find(m=>m.name===inst.module),seen=new Set();let used=0;
      for(const b of g.bindings){
        if(seen.has(b.port)){unresolved('GENERATED_BINDING_DUPLICATE','生成區域重複綁定接腳：'+g.name+'.'+b.port,{instance:inst.id});continue;}seen.add(b.port);
        if(mod&&!(mod.ports||[]).some(p=>p.name===b.port)){unresolved('GENERATED_PORT_STALE','生成區域接腳已不在目前 RTL：'+g.name+'.'+b.port,{instance:inst.id});continue;}
        const expected=project.connections.find(c=>c.instance===inst.id&&c.port===b.port);
        if(expected){if(compact(expected.expr)!==compact(b.expr))unresolved('GENERATED_BINDING_STALE','生成快照與目前指令／同名規則不同：'+g.name+'.'+b.port+'，快照為 '+(b.expr||'(open)')+'，目前為 '+(expected.expr||'(open)')+'。請先核對原始 org。',{instance:inst.id});}
        else{project.connections.push({id:id('connection'),instance:inst.id,port:b.port,expr:b.expr,origin:'generated'});used++;}
      }
      for(const expected of project.connections.filter(c=>c.instance===inst.id&&c.origin!=='generated'))if(!seen.has(expected.port))unresolved('GENERATED_BINDING_MISSING','生成快照缺少目前接線：'+g.name+'.'+expected.port,{instance:inst.id});
      if(used)issue(issues,'warning','GENERATED_BINDINGS_RECOVERED','從生成區域還原 '+g.name+' 的 '+used+' 個連線；生成區域可能是舊結果，請核對。',{instance:inst.id});
    }
    if(genBindings.length)for(const inst of project.instances)if(!genBindings.some(g=>g.name===inst.name&&g.module===inst.module))unresolved('GENERATED_INSTANCE_MISSING','生成快照缺少目前 inst 指令的實例：'+inst.name,{instance:inst.id});
    for(const g of genDecls){const n=netMap.get(g.name);if(n&&n.origin==='directive'&&(!sameRange(n.range,g.range)||n.direction!==g.direction||!!n.signed!==!!g.signed))unresolved('GENERATED_DECLARATION_STALE','生成快照宣告與目前指令／RTL 介面不同：'+g.name,{net:n.id});}
    for(const inst of project.instances){if(!project.modules.some(m=>m.name===inst.module))unresolved('MISSING_CHILD_RTL','請匯入 '+inst.module+' 的 RTL，以核對所有 port、方向與位寬。',{instance:inst.id,module:inst.module});}
    for(const n of genDecls)if(!netMap.has(n.name))addNet(n.name,n.range,n.direction,{origin:'generated'});
    function inferFromExpression(expr,contextRange){
      const match=/^([A-Za-z_][A-Za-z0-9_$]*)(?:\[([^\]]+)\])?$/.exec(expr);if(!match)return;
      if(netMap.has(match[1])){const existing=netMap.get(match[1]);if(existing.inferredRange&&match[2]){const bits=/^\s*(\d+)\s*(?::\s*(\d+)\s*)?$/.exec(match[2]);const known=/^\[(\d+):0\]$/.exec(existing.range);if(bits&&known)existing.range='['+Math.max(Number(known[1]),Number(bits[1]),Number(bits[2]||bits[1]))+':0]';}return;}
      let range=declMap.has(match[1])?declMap.get(match[1]).range:'';
      if(!range&&match[2]){const bits=/^\s*(\d+)\s*(?::\s*(\d+)\s*)?$/.exec(match[2]);if(bits)range='['+Math.max(Number(bits[1]),Number(bits[2]||bits[1]))+':0]';}
      if(!range&&contextRange)range=contextRange;const n=addNet(match[1],range,'wire',{origin:'inferred',inferredRange:true});issue(issues,'warning','INFERRED_NET','從連線推定內部 net '+n.name+(range?' '+range:'')+'，請核對宣告。',{net:n.id});
    }
    for(const c of project.connections){const inst=project.instances.find(i=>i.id===c.instance),mod=inst&&project.modules.find(m=>m.name===inst.module),port=mod&&(mod.ports||[]).find(p=>p.name===c.port);inferFromExpression(c.expr,port&&port.range);}
    for(const a of project.assigns)inferFromExpression(a.target,'');
    const strType=t=>String(t||'').trim();
    const advancedText=rows=>rows.join('\n').replace(/^[ \t]*(parameter|localparam)\s+(?:(integer|int)\s+)?([A-Za-z_][\w$]*)\s*=\s*([^;\n]+);[ \t]*$/gm,(line,kind,type,name,value)=>{
      const def=topMod?.parameters.find(p=>p.name===name);
      return def&&!!def.local===(kind==='localparam')&&compact(def.value)===compact(value)&&strType(def.type)===strType(type)?'':line;
    }).trim();
    const rawText=advancedText(raw.filter((line,index)=>!layoutLines.has(index)));project.advanced=rawText;
    const rawCode=stripComments(rawText).trim();if(rawCode){project.importLayoutUnsafe=true;unresolved('HANDWRITTEN_CODE_PRESERVED','手寫程式或前處理內容已保留；直接 Verilog 無法保證與公司生成結果等價。');}
    const filename=String(options&&options.filename||'').split(/[\\/]/).pop(),fileTop=filename.replace(/(?:\.v)?\.org$/i,'');
    if(filename&&/^[A-Za-z_][A-Za-z0-9_$]*$/.test(fileTop)){
      project.originalOrgFilename=filename;
      if(!topMod)project.top=fileTop;
      else if(topMod.name!==fileTop)unresolved('TOP_FILENAME_MISMATCH','檔名 '+filename+' 與 module '+topMod.name+' 不一致；公司流程要求兩者一致。');
    }
    if(!topMod&&project.top==='top'&&fileTop!=='top')unresolved('TOP_NAME_MISSING','未找到 module 名稱，請設定 top 名稱。');
    if(!project.instances.length)issue(issues,'warning','NO_INSTANCES','未找到可解析的 inst 指令；空模組流程需另設定 -noinst。');
    const result={project,issues};
    if(options?.recoverSavedLayout)result.previousAdvanced=advancedText(raw);
    return result;
  }
  return {parseRtl,importOrg,stripComments,splitTop};
});
