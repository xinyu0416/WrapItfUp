(function (root, factory) {
  'use strict';
  const D=typeof WIUDefines!=='undefined'?WIUDefines:typeof require==='function'?require('./assembly-defines.js'):null;
  const api = factory(D);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIUCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;
  const KEYWORDS = new Set(('always and assign automatic begin buf case casex casez cell cmos config deassign default defparam design disable edge else end endcase endconfig endfunction endgenerate endmodule endprimitive endspecify endtable endtask event for force forever fork function generate genvar highz0 highz1 if ifnone incdir include initial inout input instance integer join large liblist library localparam macromodule medium module nand negedge nmos nor noshowcancelled not notif0 notif1 or output parameter pmos posedge primitive pull0 pull1 pulldown pullup pulsestyle_onevent pulsestyle_ondetect rcmos real realtime reg release repeat rnmos rpmos rtran rtranif0 rtranif1 scalared showcancelled signed small specify specparam strong0 strong1 supply0 supply1 table task time tran tranif0 tranif1 tri tri0 tri1 triand trior trireg unsigned use vectored wait wand weak0 weak1 while wire wor xnor xor logic bit interface modport package endpackage typedef struct union enum').split(' '));
  const FORMAT_OPTIONS = [
    'commented_inst_pin', 'commented_inst_pin_comment', 'commented_inst_pin_conn',
    'commented_port', 'commented_port_detail', 'disable_unconstraint_port',
    'constraint_port_order', 'keep_inst_port_order', 'case_sensitive',
    'no_inst_port_head_space', 'no_inst_port_space', 'commented_inst_comment',
    'commented_pin_comment', 'disable_auto_connect_bit_width_check',
    'keep_inst_port_parameter', 'connect_with_direction', 'verilog_2005',
    'inst_port_space_left_align', 'show_constraint_info_below'
  ];
  const MAX_BITS = 1048576;
  const arr = x => Array.isArray(x) ? x : [];
  const str = x => x == null ? '' : String(x);
  const validName = x => typeof x === 'string' && IDENT.test(x) && !KEYWORDS.has(x);
  const singleLine = x => !/[\r\n\u2028\u2029]/.test(str(x));
  const nameOf = x => x && (x.name || x.id) || '?';
  function maskBlockComments(source) {
    let out='',state='code';
    for(let i=0;i<source.length;i++) {
      const c=source[i],next=source[i+1];
      if(state==='block') {if(c==='*'&&next==='/'){out+='  ';i++;state='code';}else out+=c==='\n'?'\n':' ';continue;}
      if(state==='line'){out+=c;if(c==='\n')state='code';continue;}
      if(state==='string'){out+=c;if(c==='\\'&&next!==undefined){out+=next;i++;}else if(c==='"')state='code';continue;}
      if(c==='/'&&next==='*'){out+='  ';i++;state='block';}
      else if(c==='/'&&next==='/'){out+='//';i++;state='line';}
      else {out+=c;if(c==='"')state='string';}
    }
    if(state==='block')throw Error('Unterminated block comment in custom source');
    return out;
  }
  function newProject() {
    return {schema: 1, top: 'wrapper_top', modules: [], instances: [], nets: [], connections: [], assigns: [], formats: ['disable_unconstraint_port', 'case_sensitive', 'constraint_port_order', 'keep_inst_port_order'], advanced: '', prelude: '',defineConfig:D?D.defaults():undefined,rtlSources:[]};
  }
  function tokens(text) {
    const result = []; let i = 0;
    text = str(text);
    if (text.length > 16384) throw Error('Expression is too long');
    const re = /\s+|(?:\d[\d_]*)?'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ?_]+|'[01xXzZ]|\d[\d_]*|\$clog2\b|[A-Za-z_][A-Za-z0-9_$]*|===|!==|>>>|<<<|<<|>>|<=|>=|==|!=|&&|\|\||[(){}\[\],?:~!+\-*\/%&|^<>]/y;
    while (i < text.length) {
      re.lastIndex = i; const m = re.exec(text);
      if (!m) throw Error('Unsupported expression near “' + text.slice(i, i + 20) + '”');
      i = re.lastIndex;
      if (!/^\s+$/.test(m[0])) result.push(m[0]);
    }
    if (result.length > 4096) throw Error('Expression has too many tokens');
    return result;
  }
  const PRECEDENCE = {'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'===':6,'!==':6,'<':7,'<=':7,'>':7,'>=':7,'<<':8,'>>':8,'<<<':8,'>>>':8,'+':9,'-':9,'*':10,'/':10,'%':10};
  function parseExpression(text) {
    const ts = tokens(text); let i = 0, depth = 0;
    const eat = t => {if (ts[i] !== t) throw Error('Expected “' + t + '”'); i++;};
    function atom() {
      if (++depth > 100) throw Error('Expression nesting is too deep');
      const t = ts[i++]; let out;
      if (!t) throw Error('Missing expression');
      if (['~','!','+','-','&','|','^'].includes(t)) out = {kind:'unary',op:t,value:atom()};
      else if (t === '(') {out = expr(0); eat(')');}
      else if (t === '{') {
        const first = expr(0);
        if (ts[i] === '{') {
          i++; const parts = [expr(0)]; while (ts[i] === ',') {i++; parts.push(expr(0));} eat('}'); eat('}');
          out = {kind:'repeat',count:first,parts};
        } else {
          const parts = [first]; while (ts[i] === ',') {i++; parts.push(expr(0));} eat('}'); out={kind:'concat',parts};
        }
      } else if (t === '$clog2') {eat('('); const value=expr(0); eat(')'); out={kind:'clog2',value};}
      else if (/^(?:\d|')/.test(t)) out={kind:'literal',text:t};
      else if (IDENT.test(t)) out={kind:'ref',name:t};
      else throw Error('Unexpected token “' + t + '”');
      if (ts[i] === '[') {
        if (out.kind !== 'ref') throw Error('Only a named net can be selected');
        i++; const msb=expr(0); let lsb=msb;
        if(ts[i] === ':') {i++; lsb=expr(0);}
        eat(']'); out={kind:'select',name:out.name,msb,lsb,bit:msb===lsb};
      }
      depth--; return out;
    }
    function expr(min) {
      let left=atom();
      while (PRECEDENCE[ts[i]] >= min && PRECEDENCE[ts[i]] !== undefined) {
        const op=ts[i++]; left={kind:'binary',op,left,right:expr(PRECEDENCE[op]+1)};
      }
      if(min===0 && ts[i]==='?') {i++; const yes=expr(0);eat(':');left={kind:'ternary',test:left,yes,no:expr(0)};}
      return left;
    }
    if (!ts.length) throw Error('Missing expression');
    const result = expr(0);
    if (i !== ts.length) throw Error('Unexpected token “' + ts[i] + '”');
    return result;
  }
  function literalInfo(raw) {
    const text=raw.replace(/_/g,'');
    let m=/^(\d+)?'([sS]?)([bBoOdDhH])([0-9a-fA-FxXzZ?]+)$/.exec(text);
    if(m) {
      const width=m[1]?Number(m[1]):32, base={b:2,o:8,d:10,h:16}[m[3].toLowerCase()], digits=m[4];
      if (!Number.isSafeInteger(width)||width<1||width>MAX_BITS) throw Error('Literal width is outside the supported range');
      const valid={2:/^[01xXzZ?]+$/,8:/^[0-7xXzZ?]+$/,10:/^(?:[0-9]+|[xXzZ?]+)$/,16:/^[0-9a-fA-FxXzZ?]+$/}[base];
      if(!valid.test(digits)) throw Error('Invalid digits in literal ' + raw);
      let value=null;
      if(!/[xXzZ?]/.test(digits)) {
        value=BigInt((base===2?'0b':base===8?'0o':base===16?'0x':'')+digits);
        if(!m[1]&&value>0xffffffffn)throw Error('Use an explicitly sized literal for integers wider than 32 bits');
        const mod=1n<<BigInt(width); value%=mod;
        if(m[2] && value>=(mod>>1n))value-=mod;
      }
      return {width,value,signed:!!m[2],unsized:!m[1],literal:raw};
    }
    if(/^'[01xXzZ]$/.test(text)) throw Error('Unbased literal ' + raw + ' needs explicit bit width for portable Verilog');
    if(/^\d+$/.test(text)) {
      const value=BigInt(text);if(value>0x7fffffffn)throw Error('Use an explicitly sized literal for large integers');
      return {width:32,value,signed:true,unsized:true,literal:raw};
    }
    throw Error('Unsupported literal ' + raw);
  }
  const PARAM_TYPES = typeof Symbol==='function'?Symbol('parameterTypes'):'__wiuParameterTypes';
  function integerTyped(node,ctx,forceWidth,forceSigned) {
    const cast=(x,w,s)=>{const v=!s&&x.width!==undefined?BigInt.asUintN(x.width,x.value):x.value;return {value:s?BigInt.asIntN(w,v):BigInt.asUintN(w,v),width:w,signed:s};};
    const typeOf=n=> {
      if(n.kind==='literal')return literalInfo(n.text);
      if(n.kind==='ref') {if(!Object.prototype.hasOwnProperty.call(ctx,n.name))throw Error('Unresolved parameter '+n.name);return ctx[PARAM_TYPES]&&ctx[PARAM_TYPES][n.name]||{width:32,signed:true};}
      if(n.kind==='clog2')return {width:32,signed:true};
      if(n.kind==='unary'){const t=typeOf(n.value);return ['!','&','|','^'].includes(n.op)?{width:1,signed:false}:t;}
      if(n.kind==='binary') {
        const a=typeOf(n.left),b=typeOf(n.right);
        if(['==','!=','===','!==','<','<=','>','>=','&&','||'].includes(n.op))return {width:1,signed:false};
        if(['<<','>>','<<<','>>>'].includes(n.op))return a;
        return {width:Math.max(a.width,b.width),signed:a.signed&&b.signed};
      }
      if(n.kind==='ternary'){const a=typeOf(n.yes),b=typeOf(n.no);return {width:Math.max(a.width,b.width),signed:a.signed&&b.signed};}
      throw Error('Unsupported integer expression');
    };
    function run(n,expectedWidth,expectedSigned) {
      const native=typeOf(n),width=expectedWidth===undefined?native.width:Math.max(native.width,expectedWidth),signed=expectedSigned===undefined?!!native.signed:expectedSigned;
      const final=x=>cast(x,width,signed);
      if(n.kind==='literal'){const x=literalInfo(n.text);if(x.value===null)throw Error('X/Z cannot be used as an integer');return final(x);}
      if(n.kind==='ref')return final({value:BigInt(ctx[n.name]),width:native.width,signed:native.signed});
      if(n.kind==='clog2'){let v=run(n.value).value,out=0n;if(v<0n)throw Error('$clog2 argument is negative');v--;while(v>0n){out++;v>>=1n;}return final({value:out});}
      if(n.kind==='unary') {
        const reduce=['!','&','|','^'].includes(n.op),a=reduce?run(n.value):run(n.value,width,signed);let value;
        switch(n.op){case '+':value=a.value;break;case '-':value=-a.value;break;case '~':value=~a.value;break;case '!':value=a.value===0n?1n:0n;break;case '&':value=BigInt.asUintN(a.width,a.value)===(1n<<BigInt(a.width))-1n?1n:0n;break;case '|':value=a.value!==0n?1n:0n;break;case '^':{let bits=BigInt.asUintN(a.width,a.value);value=0n;while(bits){value^=bits&1n;bits>>=1n;}break;}}
        return final({value});
      }
      if(n.kind==='ternary'){return run(run(n.test).value!==0n?n.yes:n.no,width,signed);}
      if(n.kind==='binary') {
        const shift=['<<','>>','<<<','>>>'].includes(n.op),compare=['==','!=','===','!==','<','<=','>','>='].includes(n.op),logical=['&&','||'].includes(n.op);
        const ta=typeOf(n.left),tb=typeOf(n.right),ow=compare?Math.max(ta.width,tb.width):width,os=compare?ta.signed&&tb.signed:signed;
        const aa=logical?run(n.left):run(n.left,ow,os),bb=shift||logical?run(n.right):run(n.right,ow,os),a=aa.value,b=bb.value;let value;
        if(shift&&(b<0n||b>1024n))throw Error('Unsafe integer shift amount');
        if((n.op==='/'||n.op==='%')&&b===0n)throw Error('Division by zero');
        switch(n.op){case '+':value=a+b;break;case '-':value=a-b;break;case '*':value=a*b;break;case '/':value=a/b;break;case '%':value=a%b;break;case '&':value=a&b;break;case '|':value=a|b;break;case '^':value=a^b;break;case '<<':case '<<<':value=a<<b;break;case '>>':value=BigInt.asUintN(aa.width,a)>>b;break;case '>>>':value=aa.signed?a>>b:BigInt.asUintN(aa.width,a)>>b;break;case '==':case '===':value=a===b?1n:0n;break;case '!=':case '!==':value=a!==b?1n:0n;break;case '<':value=a<b?1n:0n;break;case '<=':value=a<=b?1n:0n;break;case '>':value=a>b?1n:0n;break;case '>=':value=a>=b?1n:0n;break;case '&&':value=a!==0n&&b!==0n?1n:0n;break;case '||':value=a!==0n||b!==0n?1n:0n;break;}
        return final({value});
      }
      throw Error('Unsupported integer expression');
    }
    return run(node,forceWidth,forceSigned);
  }
  function integerAST(node,ctx) {return integerTyped(node,ctx).value;}
  function evaluateInteger(expression,context) {
    const value=integerAST(parseExpression(expression),context||{});
    const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Integer exceeds safe supported range');return n;
  }
  function parseRange(range,context) {
    const raw=str(range).trim();if(!raw)return {msb:0,lsb:0,width:1,low:0,high:0,raw:''};
    if(!singleLine(raw))throw Error('Range must be a single line');
    const m=/^\[([\s\S]+):([\s\S]+)\]$/.exec(raw);if(!m)throw Error('Use a packed range such as [7:0]');
    const msb=evaluateInteger(m[1],context||{}),lsb=evaluateInteger(m[2],context||{}),width=Math.abs(msb-lsb)+1;
    if(width>MAX_BITS)throw Error('Range exceeds supported maximum width');
    return {msb,lsb,width,low:Math.min(msb,lsb),high:Math.max(msb,lsb),raw};
  }
  function resolveParameters(module,overrides,outerContext) {
    const defs=arr(module.parameters),context=Object.create(null),pending=new Map(),errors=[];
    Object.defineProperty(context,PARAM_TYPES,{value:Object.create(null)});
    const evaluate=(name,value,scope)=>{const def=defs.find(x=>x.name===name),type=str(def&&def.type).trim();
      if(type&&!['integer','int'].includes(type))throw Error('Unsupported typed parameter '+name+': '+type);
      let typed=integerTyped(parseExpression(value),scope,type?32:undefined);
      if(type)typed={value:BigInt.asIntN(32,typed.value),width:32,signed:true};
      const number=Number(typed.value);if(!Number.isSafeInteger(number))throw Error('Integer exceeds safe supported range');
      context[name]=number;context[PARAM_TYPES][name]={width:typed.width,signed:typed.signed};};
    for(const name of Object.keys(overrides||{}))if(!defs.some(p=>p.name===name))errors.push({name,message:'Unknown parameter '+name});
    for(const def of defs){if(Object.prototype.hasOwnProperty.call(overrides||{},def.name)){
      if(def.local){errors.push({name:def.name,message:'Cannot override localparam '+def.name});continue;}
      // Named instance overrides are expressions in the parent scope. Child defaults
      // are evaluated only in the child scope, never inherited by matching names.
      try{evaluate(def.name,str(overrides[def.name]),outerContext||{});}catch(e){errors.push({name:def.name,message:e.message});}
    }else pending.set(def.name,str(def.value));}
    for(let pass=0;pass<=defs.length&&pending.size;pass++){
      let changed=false;for(const [name,value] of pending)try{evaluate(name,value,context);pending.delete(name);changed=true;}catch(_){}
      if(!changed)break;
    }
    for(const [name,value] of pending){try{evaluate(name,value,context);}catch(e){errors.push({name,message:e.message});}}
    return {context,errors};
  }
  function instanceParameterRows(project,instance){
    const p=D?D.resolveProject(project).project:project,i=arr(p.instances).find(x=>x.id===instance.id)||instance,m=arr(p.modules).find(x=>x.name===i.module);
    if(!m)return [];
    const top=resolveParameters({parameters:topParameters(p)},{}),resolved=resolveParameters(m,i.parameters||{},top.context),names=new Set(topParameters(p).map(x=>x.name));
    return arr(m.parameters).map(def=>{const explicit=Object.prototype.hasOwnProperty.call(i.parameters||{},def.name),expression=str(explicit?(instance.parameters||{})[def.name]:(arr(project.modules).find(x=>x.name===instance.module)?.parameters||[]).find(x=>x.name===def.name)?.value??def.value),refs=[];
      if(explicit){try{const walk=n=>{if(!n||typeof n!=='object')return;if(n.kind==='ref'&&names.has(n.name))refs.push(n.name);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(parseExpression(expression));}catch(_){}}
      const source=def.local?'local':!explicit?'default':refs.length?'top':'override',sourceLabel={local:'模組 localparam',default:'模組預設',top:'引用 Top',override:'獨立覆寫'}[source],error=resolved.errors.find(e=>e.name===def.name)?.message;
      return {name:def.name,expression,value:resolved.context[def.name],source,sourceLabel,refs:[...new Set(refs)],error,text:def.name+' = '+(error?'未解析':resolved.context[def.name])+'  ·  '+sourceLabel+' ('+expression+')'};
    });
  }
  function expressionInfo(expression,nets,context) {
    const netMap=nets instanceof Map?nets:new Map(arr(nets).map(n=>[n.name,n]));
    context=context||{};
    const ast=typeof expression==='string'?parseExpression(expression):expression;
    function walk(n) {
      if(n.kind==='literal')return Object.assign(literalInfo(n.text),{refs:[],lvalue:false,ast:n});
      if(n.kind==='ref'||n.kind==='select') {
        const net=netMap.get(n.name);if(!net) {
          if(n.kind==='ref'&&Object.prototype.hasOwnProperty.call(context,n.name))return Object.assign({width:32,signed:true},context[PARAM_TYPES]&&context[PARAM_TYPES][n.name],{refs:[],lvalue:false,ast:n});
          throw Error('Unknown net '+n.name);
        }
        const r=parseRange(net.range,context);let low=r.low,high=r.high,width=r.width;
        if(n.kind==='select') {
          const msb=Number(integerAST(n.msb,context)),lsb=Number(integerAST(n.lsb,context));
          if(!Number.isSafeInteger(msb)||!Number.isSafeInteger(lsb))throw Error('Invalid selected range');
          low=Math.min(msb,lsb);high=Math.max(msb,lsb);width=high-low+1;
          if(low<r.low||high>r.high)throw Error(n.name+' selection is outside '+(net.range||'scalar'));
          if(!n.bit && msb!==lsb && (msb>lsb)!==(r.msb>r.lsb))throw Error(n.name+' part-select direction is reversed');
        }
        return {width,signed:n.kind==='ref'&&!!net.signed,refs:[{name:n.name,low,high}],lvalue:true,ast:n};
      }
      if(n.kind==='concat'||n.kind==='repeat') {
        const parts=n.parts.map(walk);const count=n.kind==='repeat'?Number(integerAST(n.count,context)):1;
        if(!Number.isSafeInteger(count)||count<1||count>MAX_BITS)throw Error('Invalid replication count');
        const width=parts.reduce((a,x)=>a+x.width,0)*count;if(width>MAX_BITS)throw Error('Expression exceeds supported maximum width');
        if(parts.some(x=>x.unsized))throw Error('Use sized constants inside a concatenation');
        return {width,signed:false,refs:parts.flatMap(x=>x.refs),lvalue:n.kind==='concat'&&parts.every(x=>x.lvalue),ast:n};
      }
      if(n.kind==='clog2')throw Error('$clog2 is supported in parameters and ranges, not runtime net expressions');
      if(n.kind==='unary') {const value=walk(n.value);return {width:['!','&','|','^'].includes(n.op)?1:value.width,signed:value.signed,refs:value.refs,lvalue:false,ast:n};}
      if(n.kind==='binary') {
        const a=walk(n.left),b=walk(n.right);const width=['==','!=','===','!==','<','<=','>','>=','&&','||'].includes(n.op)?1:['<<','>>','<<<','>>>'].includes(n.op)?a.width:Math.max(a.width,b.width);
        return {width,signed:a.signed&&b.signed,refs:a.refs.concat(b.refs),lvalue:false,ast:n};
      }
      if(n.kind==='ternary') {const t=walk(n.test),a=walk(n.yes),b=walk(n.no);return {width:Math.max(a.width,b.width),signed:a.signed&&b.signed,refs:t.refs.concat(a.refs,b.refs),lvalue:false,ast:n};}
      throw Error('Unsupported expression');
    }
    return walk(ast);
  }
  function instanceGroups(project) {
    const groups=new Map();arr(project.instances).forEach(i=>{if(!groups.has(i.module))groups.set(i.module,[]);groups.get(i.module).push(i);});
    return groups;
  }
  function standardGroup(group,module) {
    const names=new Set(group.map(i=>i.name));
    return names.size===group.length&&group.every((_,index)=>names.has(module+'_inst'+(group.length===1?'':'_'+index)));
  }
  function instanceMapping(project) {
    const groups=instanceGroups(project);
    return arr(project.instances).map(inst=> {
      const group=groups.get(inst.module),standard=standardGroup(group,inst.module),simple=standard&&group.length===1;
      const index=standard&&!simple?Number(inst.name.slice((inst.module+'_inst_').length)):group.indexOf(inst);
      const directive=standard?(simple?inst.module:inst.module+'.0-'+(group.length-1)):inst.module+'.'+index+'-'+index+'.'+inst.name;
      return {id:inst.id,name:inst.name,module:inst.module,index,simple,standard,custom:!standard,inst:directive,endpoint:simple?inst.module:inst.module+'.'+index};
    });
  }
  // This is a preview only. Callers apply the accepted names in one undoable edit.
  // Stable instance IDs keep connections and per-instance parameters unchanged.
  function standardNamesPlan(project) {
    const groups=instanceGroups(project),symbols=new Set(arr(project.nets).map(n=>n.name).concat(topParameters(project).map(p=>p.name)));
    const mappings=arr(project.instances).map(inst=>{
      const group=groups.get(inst.module),index=standardGroup(group,inst.module)&&group.length>1?Number(inst.name.slice((inst.module+'_inst_').length)):group.indexOf(inst);
      const to=inst.module+'_inst'+(group.length===1?'':'_'+index);
      return {id:inst.id,module:inst.module,from:inst.name,to,index,endpoint:group.length===1?inst.module:inst.module+'.'+index,changed:inst.name!==to};
    });
    const conflicts=mappings.filter(m=>symbols.has(m.to)).map(m=>({id:m.id,code:'SYMBOL_COLLISION',message:'gen_top standard instance name '+m.to+' conflicts with a net or top parameter'}));
    return {mappings,changes:mappings.filter(m=>m.changed),conflicts,ready:conflicts.length===0};
  }
  function topParameters(project) {
    const ps=Array.isArray(project.parameters)?project.parameters:Object.entries(project.parameters||{}).map(([name,value])=>({name,value}));
    return ps;
  }
  function validate(project,options) {
    let prepared;try{prepared=D?D.resolveProject(project):{project:project||{},issues:[]};}catch(e){return [{severity:'error',code:'DEFINE_CONFIG',message:e.message,ref:{type:'defines',id:'defines'}}];}
    const p=prepared.project,opt=options||{},issues=prepared.issues.slice(),seen=new Set();
    const add=(severity,code,message,ref)=>{const key=[severity,code,message,ref&&ref.id].join('|');if(!seen.has(key)){seen.add(key);issues.push({severity,code,message,ref});}};
    const err=(code,msg,ref)=>add('error',code,msg,ref),warn=(code,msg,ref)=>add('warning',code,msg,ref);
    const targetIssue=(target,code,msg,ref)=>add(opt.target===target?'error':'warning',code,msg,ref);
    const ref=(type,id)=>({type,id});
    if(!validName(p.top))err('TOP_NAME','Top module name must be a legal non-keyword Verilog identifier',ref('top',p.top));
    const modules=arr(p.modules),instances=arr(p.instances),nets=arr(p.nets),connections=arr(p.connections),assigns=arr(p.assigns);
    if(!instances.length)warn('NO_INSTANCES','No child instances: company gen_top may require -noinst');
    function duplicates(items,key,type) {const set=new Set();for(const x of items){const value=x&&x[key];if(set.has(value))err('DUPLICATE_'+type.toUpperCase(),'Duplicate '+type+' '+str(value),ref(type,x&&x.id||value));set.add(value);}}
    duplicates(modules,'name','module');duplicates(instances,'id','instance_id');duplicates(instances,'name','instance');duplicates(nets,'id','net_id');duplicates(nets,'name','net');duplicates(connections,'id','connection_id');duplicates(assigns,'id','assign_id');
    const moduleMap=new Map(modules.map(m=>[m.name,m])),netMap=new Map(nets.map(n=>[n.name,n])),instMap=new Map(instances.map(i=>[i.id,i]));
    const tp=topParameters(p);duplicates(tp,'name','top_parameter');
    tp.forEach(x=>{if(!validName(x.name)||!singleLine(x.value))err('PARAMETER_SYNTAX','Invalid top parameter '+nameOf(x),ref('top',p.top));});
    const topResolved=resolveParameters({parameters:tp},{});topResolved.errors.forEach(e=>err('TOP_PARAMETER',e.message,ref('top',p.top)));const topContext=topResolved.context;
    const symbolNames=new Set();
    for(const n of nets) {if(!validName(n.name))err('NET_NAME','Invalid net name '+str(n.name),ref('net',n.id));symbolNames.add(n.name);}
    for(const i of instances) {if(symbolNames.has(i.name))err('SYMBOL_COLLISION','Instance and net share name '+i.name,ref('instance',i.id));symbolNames.add(i.name);}
    for(const t of tp)if(symbolNames.has(t.name))err('SYMBOL_COLLISION','Parameter and net/instance share name '+t.name,ref('top',p.top));
    const cases=new Map(),ranges=new Map(),drivers=new Map(),sinks=new Map();
    const addUse=(table,r,owner,bidir)=>{if(!table.has(r.name))table.set(r.name,[]);table.get(r.name).push({low:r.low,high:r.high,owner,bidir:!!bidir});};
    for(const n of nets) {
      const nr=ref('net',n.id), lower=str(n.name).toLowerCase();
      if(cases.has(lower)&&cases.get(lower)!==n.name)targetIssue('org','ORG_CASE_COLLISION','gen_top rejects net names differing only in case: '+cases.get(lower)+' / '+n.name,nr);cases.set(lower,n.name);
      if(!['wire','input','output','inout'].includes(n.direction))err('NET_DIRECTION','Invalid direction for '+n.name,nr);
      if(!singleLine(n.comment)||!singleLine(n.group))err('COMMENT_NEWLINE','Comments and groups must be one line',nr);
      if(n.signed)targetIssue('org','ORG_SIGNED','Signed net '+n.name+' has no verified signed declaration directive; direct Verilog is supported',nr);
      try {const r=parseRange(n.range,topContext);ranges.set(n.name,r);if(n.direction==='input'||n.direction==='inout')addUse(drivers,{name:n.name,low:r.low,high:r.high},'top.'+n.name,n.direction==='inout');if(n.direction==='output')addUse(sinks,{name:n.name,low:r.low,high:r.high},'top.'+n.name);}catch(e){err('NET_RANGE',n.name+': '+e.message,{...nr,field:'range'});}
    }
    for(const m of modules) {
      const used=instances.some(i=>i.module===m.name),moduleIssue=used?err:warn;
      if(!validName(m.name))moduleIssue('MODULE_NAME','Invalid module name '+str(m.name),ref('module',m.name));
      if(used&&m.name===p.top)err('RECURSIVE_TOP','Child module name equals top '+p.top,ref('module',m.name));
      if(used){duplicates(arr(m.ports),'name','port');duplicates(arr(m.parameters),'name','parameter');}
      for(const port of arr(m.ports)){if(!validName(port.name)||!['input','output','inout'].includes(port.direction))moduleIssue('PORT_DECLARATION','Invalid port declaration in '+m.name+': '+str(port.name),ref('module',m.name));}
      for(const x of arr(m.parameters))if(!validName(x.name)||!singleLine(x.value))moduleIssue('PARAMETER_SYNTAX','Invalid parameter '+m.name+'.'+nameOf(x),ref('module',m.name));
      if(used&&m.filename && str(m.filename).split(/[\\/]/).pop().replace(/\.(?:sv|v|vp)$/i,'')!==m.name){if(m.sourceFilename&&arr(p.rtlSources).some(f=>f.name===m.sourceFilename))warn('MODULE_FILENAME_ALIAS','Module '+m.name+' uses '+m.sourceFilename+'; the full bundle creates a matching gen_top source alias. Standalone org requires that alias.',ref('module',m.name));else targetIssue('org','MODULE_FILENAME','Module '+m.name+' must use a matching source filename for gen_top',ref('module',m.name));}
      for(const issue of arr(m.issues))add(!used||issue.severity==='warning'&&!issue.blocking?'warning':'error','MODULE_IMPORT',(used?'':'Unused module ')+m.name+': '+(issue.message||str(issue)),ref('module',m.name));
    }
    const bindingMap=new Map();
    for(const c of connections) {
      const key=c.instance+'\u0000'+c.port;
      if(bindingMap.has(key))err('DUPLICATE_BINDING','Pin has more than one binding: '+c.port,ref('connection',c.id));bindingMap.set(key,c);
      const inst=instMap.get(c.instance),mod=inst&&moduleMap.get(inst.module);
      if(!inst)err('MISSING_INSTANCE','Connection refers to missing instance '+c.instance,ref('connection',c.id));
      else if(mod&&!arr(mod.ports).some(x=>x.name===c.port))err('MISSING_PORT',inst.name+' has no port '+c.port,ref('connection',c.id));
      if(!singleLine(c.expr))err('EXPRESSION_NEWLINE','Connection expressions must be one line',ref('connection',c.id));
    }
    for(const inst of instances) {
      const ir=ref('instance',inst.id),mod=moduleMap.get(inst.module);
      if(!validName(inst.name))err('INSTANCE_NAME','Invalid instance name '+str(inst.name),ir);
      if(!inst.id)err('INSTANCE_ID','Instance needs an ID',ir);
      if(!mod){err('MISSING_MODULE','Missing module definition '+inst.module,ir);continue;}
      const resolved=resolveParameters(mod,inst.parameters||{},topContext);
      resolved.errors.forEach(e=>err('PARAMETER_VALUE',inst.name+': '+e.message,ir));
      for(const [key,value] of Object.entries(inst.parameters||{})) {
        if(!validName(key)||!singleLine(value))err('PARAMETER_SYNTAX','Invalid parameter override '+inst.name+'.'+key,ir);
        if(arr(mod.parameters).some(x=>x.name===key&&x.local))err('LOCALPARAM_OVERRIDE','Cannot override localparam '+inst.name+'.'+key,ir);
        if(/[\s.]/.test(str(value)))targetIssue('org','ORG_PARAMETER_EXPRESSION','gen_top dot-separated override needs a verified simple value: '+inst.name+'.'+key,ir);
      }
      for(const port of arr(mod.ports)) {
        const c=bindingMap.get(inst.id+'\u0000'+port.name),owner=inst.name+'.'+port.name;
        if(!c){err('UNCONFIGURED_PIN','Set a connection or explicit open for '+owner,{...ir,port:port.name});continue;}
        const cr=ref('connection',c.id);
        if(c.orgDirection && c.orgDirection!==({input:'i',output:'o',inout:'io'}[port.direction]))err('DIRECTION_CONSTRAINT','Stored gen_top direction does not match '+owner+' ('+port.direction+')',cr);
        if(str(c.expr).trim()==='') {if(port.direction==='input'||port.direction==='inout')warn('OPEN_INPUT',owner+' is intentionally open; verify the floating input is intended',cr);continue;}
        let pr;try {pr=parseRange(port.range,resolved.context);}catch(e){err('PORT_RANGE',owner+': '+e.message,cr);continue;}
        try {
          const info=expressionInfo(str(c.expr).trim(),netMap,topContext);
          if(info.width!==pr.width)err('WIDTH_MISMATCH',owner+'：目前 '+c.expr+' 為 '+info.width+' bits；預期 '+pr.width+' bits（'+(port.range||'scalar')+'）',cr);
          if(info.unsized)warn('UNSIZED_CONSTANT',owner+' uses a 32-bit unsized literal; use an explicit width',cr);
          if(port.direction==='output'||port.direction==='inout') {
            if(!info.lvalue)err('OUTPUT_LVALUE',owner+' must drive a net, slice, or net concatenation',cr);
            else info.refs.forEach(r=>addUse(drivers,r,owner,port.direction==='inout'));
          }
          if(port.direction==='input'||port.direction==='inout')info.refs.forEach(r=>addUse(sinks,r,owner,port.direction==='inout'));
        }catch(e){err('CONNECTION_EXPRESSION',owner+': '+e.message,cr);}
      }
    }
    const assignmentDeps=[];
    for(const a of assigns) {
      const ar=ref('assign',a.id),owner='assign '+str(a.target);
      if(!singleLine(a.target)||!singleLine(a.expr)){err('EXPRESSION_NEWLINE','Assignment expressions must be one line',ar);continue;}
      try {
        const lhs=expressionInfo(str(a.target),netMap,topContext),rhs=expressionInfo(str(a.expr),netMap,topContext);
        assignmentDeps.push({id:a.id,lhs:lhs.refs,rhs:rhs.refs});
        if(!lhs.lvalue)err('ASSIGN_TARGET','Assignment target must be a net, slice, or net concatenation',ar);
        else lhs.refs.forEach(r=>addUse(drivers,r,owner));
        rhs.refs.forEach(r=>addUse(sinks,r,owner));
        if(lhs.width!==rhs.width)err('ASSIGN_WIDTH',owner+' is '+lhs.width+' bits; expression is '+rhs.width+' bits',ar);
      }catch(e){err('ASSIGN_EXPRESSION',owner+': '+e.message,ar);}
    }
    const overlap=(a,b)=>a.name===b.name&&Math.max(a.low,b.low)<=Math.min(a.high,b.high);
    const visiting=new Set(),visited=new Set();
    function visitAssign(index) {
      if(visiting.has(index)){err('ASSIGN_CYCLE','Continuous assignments contain a combinational dependency cycle',ref('assign',assignmentDeps[index].id));return;}
      if(visited.has(index))return;visiting.add(index);
      for(let next=0;next<assignmentDeps.length;next++)if(assignmentDeps[index].rhs.some(r=>assignmentDeps[next].lhs.some(l=>overlap(r,l))))visitAssign(next);
      visiting.delete(index);visited.add(index);
    }
    assignmentDeps.forEach((_,index)=>visitAssign(index));
    for(const n of nets) {
      const ds=drivers.get(n.name)||[],ss=sinks.get(n.name)||[],nr=ref('net',n.id);
      for(let a=0;a<ds.length;a++)for(let b=a+1;b<ds.length;b++)if(Math.max(ds[a].low,ds[b].low)<=Math.min(ds[a].high,ds[b].high)) {
        const msg=n.name+'['+Math.min(ds[a].high,ds[b].high)+':'+Math.max(ds[a].low,ds[b].low)+'] driven by '+ds[a].owner+' and '+ds[b].owner;
        if(ds[a].bidir||ds[b].bidir)warn('BIDIRECTIONAL_DRIVERS',msg+'; verify tri-state control',nr);else err('MULTIPLE_DRIVERS',msg,nr);
      }
      for(const s of ss) {
        const intervals=ds.filter(d=>d.owner!==s.owner||!d.bidir).map(d=>[Math.max(s.low,d.low),Math.min(s.high,d.high)]).filter(x=>x[0]<=x[1]).sort((a,b)=>a[0]-b[0]);
        let cursor=s.low;for(const [lo,hi]of intervals){if(lo>cursor)break;cursor=Math.max(cursor,hi+1);}
        if(cursor<=s.high) {const msg=n.name+' has undriven bits required by '+s.owner+' (starting at bit '+cursor+')';if(s.bidir)warn('BIDIRECTIONAL_UNDRIVEN',msg,nr);else err('UNDRIVEN_NET',msg,nr);}
      }
      if(!ds.length&&!ss.length)warn('UNUSED_NET','Unused '+n.direction+' '+n.name,nr);
      else if(!ss.length&&n.direction==='wire')warn('UNUSED_DRIVER','Internal net '+n.name+' has no sinks',nr);
    }
    for(const mapping of instanceMapping(p))if(mapping.custom)warn('ORG_CUSTOM_INSTANCE','公司 gen_top 相容性：'+mapping.name+' 使用自訂 instance 名稱；其 conn／param 重新命名尚未通過公司測試。這不是接線錯誤，不影響網站接線；公司交付前可預覽轉為標準名稱。',ref('instance',mapping.id));
    for(const format of arr(p.formats)) {
      if(!FORMAT_OPTIONS.includes(format))targetIssue('org','UNKNOWN_FORMAT','Unrecognized gen_top format '+str(format));
      if(!validName(format))err('FORMAT_SYNTAX','Invalid format token '+str(format));
      if(format==='disable_auto_connect_bit_width_check')warn('GEN_TOP_WIDTH_OVERRIDE','Company auto-connect width check disabled; WIU still rejects explicit width mismatches');
    }
    const raw=[['advanced',str(p.advanced)],['prelude',str(p.prelude)]];
    if(p.importLayoutUnsafe)err('IMPORT_LAYOUT_UNSAFE','Original source contains handwritten RTL whose placement cannot be preserved by regeneration; download originalOrg and review source regions',ref('advanced','advanced'));
    for(const unresolved of arr(p.importUnresolved)) {
      const message=typeof unresolved==='string'?unresolved:unresolved.message||'Imported source contains unresolved semantics';
      if(unresolved&&unresolved.blocking===false){warn('IMPORT_REVIEW',message,ref('advanced','advanced'));continue;}
      targetIssue('verilog','IMPORT_UNRESOLVED',message,ref('advanced','advanced'));
      if(opt.target==='org'&&!opt.allowRaw)err('IMPORT_ACK_REQUIRED','Imported unresolved source requires raw gen_top acknowledgement: '+message,ref('advanced','advanced'));
    }
    for(const [field,text] of raw)if(text.trim()) {
      let activeText;try {activeText=maskBlockComments(text);}catch(e){err('RAW_COMMENT_SYNTAX',e.message,ref(field,field));continue;}
      const active=activeText.split(/\r?\n/).filter(line=>line.trim()&&!/^\s*\/\/(?!\s*realtek\b)/.test(line));
      if(active.length) {
        targetIssue('verilog','RAW_SEMANTICS','Active '+field+' text is preserved for gen_top but is not interpreted; direct Verilog equivalence is unavailable',ref(field,field));
        if(opt.target==='org'&&!opt.allowRaw)err('RAW_ACK_REQUIRED','Export raw '+field+' only after acknowledging company-tool-only semantics',ref(field,field));
      }
      if(/^[ \t]*\/\/[ \t]*realtek[ \t]+(?:begin|end)\b/m.test(activeText))err('RAW_BOUNDARY','Custom text must not inject realtek generation boundaries',ref(field,field));
    }
    return issues;
  }
  function assertExport(project,options,target) {
    const opt=Object.assign({},options,{target}),issues=validate(project,opt),errors=issues.filter(x=>x.severity==='error');
    if(errors.length&&!opt.allowErrors){const e=Error(errors.map(x=>x.message).join('\n'));e.issues=issues;throw e;}
    return issues;
  }
  function canonicalRange(range) {return str(range).trim();}
  function netDeclaration(net) {return net.direction+' '+(net.signed?'signed ':'')+(canonicalRange(net.range)?canonicalRange(net.range)+' ':'')+net.name+';'+(net.comment?' // '+str(net.comment).replace(/[\r\n\u2028\u2029]/g,' '):'');}
  function nativeSections(p,org=false) {
    const ports=arr(p.nets).filter(n=>n.direction!=='wire'),allParameters=topParameters(p),parameters=allParameters.filter(x=>!x.local);
    let header='module '+p.top;
    if(parameters.length&&!org)header+=' #(\n'+parameters.map(x=>'  parameter '+(x.type?'integer ':'')+x.name+' = '+x.value).join(',\n')+'\n)';
    header+=' (';
    const connections=arr(p.connections),moduleMap=new Map(arr(p.modules).map(m=>[m.name,m]));
    const instances=arr(p.instances).map(inst=> {
      const mod=moduleMap.get(inst.module),params=Object.entries(inst.parameters||{});let result=inst.module;
      if(params.length)result+=' #(\n'+params.map(([name,value])=>'  .'+name+'('+value+')').join(',\n')+'\n)';
      result+=' '+inst.name+' (\n';
      result+=arr(mod&&mod.ports).map(port=>{const c=connections.find(x=>x.instance===inst.id&&x.port===port.name);return '  .'+port.name+'('+str(c&&c.expr)+')';}).join(',\n');
      return result+'\n);';
    }).join('\n\n');
    const locals=allParameters.filter(x=>x.local).map(x=>'localparam '+(x.type?'integer ':'')+x.name+' = '+x.value+';');
    return [header,ports.map(n=>'  '+n.name).join(',\n'),');',(org?[]:locals).concat(arr(p.nets).map(netDeclaration)).join('\n'),arr(p.assigns).map(a=>'assign '+a.target+' = '+a.expr+';').join('\n'),instances,'endmodule'];
  }
  function exportVerilog(project,options) {
    assertExport(project,options,'verilog');
    const p=D?D.resolveProject(project).project:project;
    return '// Generated by WrapItfUp. Structural Verilog; child modules are separate sources.\n'+definePreamble(project,false)+nativeSections(p).join('\n\n')+'\n';
  }
  function definePreamble(p,org){
    if(!D||!p.defineConfig||!(p.defineConfig.rows?.length||p.defineConfig.includes?.length))return '';
    const name=D.fileName(p);
    return '// WIU configuration '+D.marker(p.defineConfig)+'; Top expressions are expanded for this configuration.\n// Compile ALL child RTL with the same define configuration; Top inclusion alone is not sufficient across compilation units.\n'+(org?'// gen_top: supply -I '+name+' using your project generation script.\n':'`include "'+name+'"\n')+'\n';
  }
  function orgDirectiveNet(n) {return '// realtek '+n.direction+' '+n.name+(canonicalRange(n.range)?'.'+canonicalRange(n.range).replace(/\s/g,''):'');}
  function exportOrg(project,options) {
    assertExport(project,options,'org');
    const p=D?D.resolveProject(project).project:project,mapping=instanceMapping(p),byId=new Map(mapping.map(x=>[x.id,x]));
    const formats=Array.from(new Set(['disable_unconstraint_port','case_sensitive','constraint_port_order'].concat(arr(p.formats))));
    const lines=['// realtek begin', '// WIU gen_top source candidate. Company generator validation is still required.', '// Edit directives outside realtek begin/end; generated sections may be replaced.', '// realtek end', '', '// realtek begin', '', '// realtek end', ''];
    if(definePreamble(project,true))lines.push(definePreamble(project,true));
    if(str(p.prelude).trim())lines.push(str(p.prelude).trim(),'');
    formats.forEach(format=>lines.push('// realtek format '+format));
    Array.from(new Set(mapping.map(x=>x.inst))).forEach(inst=>lines.push('// realtek inst '+inst));
    arr(p.instances).forEach(inst=>{const map=byId.get(inst.id);Object.entries(inst.parameters||{}).forEach(([name,value])=>lines.push('// realtek param '+map.endpoint+'.'+name+'.'+value));});
    lines.push('');let lastGroup='';
    arr(p.nets).forEach(n=>{if(n.group&&n.group!==lastGroup){lines.push('// '+str(n.group));lastGroup=n.group;}lines.push(orgDirectiveNet(n));if(n.comment)lines.push('// realtek comment '+n.name+'.//'+str(n.comment));});
    lines.push('');
    arr(p.connections).forEach(c=>{
      const map=byId.get(c.instance);if(!map)return;
      const module=arr(p.modules).find(m=>m.name===map.module),port=arr(module&&module.ports).find(x=>x.name===c.port);
      const prefix=formats.includes('connect_with_direction')&&port?({input:'i:',output:'o:',inout:'io:'}[port.direction]||''):'';
      lines.push('// realtek conn '+(str(c.expr).trim()?str(c.expr).replace(/\s/g,''):'""')+' '+prefix+map.endpoint+'.'+c.port);
    });
    arr(p.assigns).forEach(a=>lines.push('// realtek assign '+a.target+' = '+a.expr+';'));
    if(str(p.advanced).trim())lines.push('',str(p.advanced).trim());
    lines.push('');
    nativeSections(p,true).forEach((section,index)=>{
      lines.push('// realtek begin',section,'// realtek end','');
      // Body declarations survive company regeneration. Do not place Top parameters
      // in the generated header or net-declaration section.
      if(index===2)for(const x of topParameters(p))lines.push((x.local?'localparam ':'parameter ')+(x.type?'integer ':'')+x.name+' = '+x.value+';');
    });
    return lines.join('\n');
  }
  function demoProject() {
    const p=newProject();p.top='dual_lane_wrapper';
    p.modules=[{name:'mac_pair',parameters:[],ports:[{name:'clk',direction:'input',range:''},{name:'rst',direction:'input',range:''},{name:'tx_data0',direction:'output',range:'[63:0]'},{name:'tx_data1',direction:'output',range:'[63:0]'},{name:'tx_valid',direction:'input',range:''},{name:'rx_ready',direction:'input',range:''},{name:'debug',direction:'output',range:'[7:0]'}],source:'',issues:[]},{name:'phy_link',parameters:[],ports:[{name:'clk',direction:'input',range:''},{name:'rst',direction:'input',range:''},{name:'tx_data',direction:'input',range:'[127:0]'},{name:'status',direction:'output',range:''}],source:'',issues:[]}];
    p.instances=[{id:'i_mac',name:'mac_pair_inst',module:'mac_pair',parameters:{}},{id:'i_phy',name:'phy_link_inst',module:'phy_link',parameters:{}}];
    p.nets=[{id:'n_clk',name:'clk',direction:'input',range:'',group:'Clock and reset'},{id:'n_reset',name:'fpga_rstb',direction:'input',range:'',group:'Clock and reset'},{id:'n_status',name:'link_up',direction:'output',range:'',group:'Status'},{id:'n_srst',name:'srst_etn',direction:'wire',range:'',group:'Internal nets'},{id:'n_tx',name:'txd_lane',direction:'wire',range:'[127:0]',group:'Internal nets',comment:'Two independent 64-bit lane slices'}];
    p.connections=[['i_mac','clk','clk'],['i_mac','rst','srst_etn'],['i_mac','tx_data0','txd_lane[63:0]'],['i_mac','tx_data1','txd_lane[127:64]'],['i_mac','tx_valid',"1'b0"],['i_mac','rx_ready',"1'b1"],['i_mac','debug',''],['i_phy','clk','clk'],['i_phy','rst','srst_etn'],['i_phy','tx_data','txd_lane'],['i_phy','status','link_up']].map((x,k)=>({id:'c_'+k,instance:x[0],port:x[1],expr:x[2]}));
    for(const m of p.modules)m.interfaceOnly=true;
    p.assigns=[{id:'a_reset',target:'srst_etn',expr:'~fpga_rstb'}];return p;
  }
  return {newProject,validate,exportVerilog,exportOrg,renderVerilog:(p,o)=>exportVerilog(p,Object.assign({},o,{allowErrors:true})),renderOrg:(p,o)=>exportOrg(p,Object.assign({},o,{allowErrors:true})),projectView:p=>D?D.resolveProject(p).project:p,expandDefines:(s,p)=>D&&p.defineConfig?D.expandValue(s,p.defineConfig):s,demoProject,parseExpression,evaluateInteger,parseRange,resolveParameters,instanceParameterRows,expressionInfo,instanceMapping,standardNamesPlan,validName,FORMAT_OPTIONS};
});
