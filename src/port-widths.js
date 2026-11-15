(function(root,factory){const api=factory(root);if(typeof module==='object')module.exports=api;root.WIUPortWidths=api;})(globalThis,function(root){
'use strict';
const core=()=>root.WIUCore||(typeof require==='function'?require('./assembly-core.js'):null);
function parseDefinitions(text,reserved=[]){
 const C=core(),seen=new Set(reserved),rows=[];
 for(const [index,line] of String(text).split(/\r?\n/).entries()){
  if(!line.trim())continue;
  const m=/^\s*(?:parameter\s+)?(?:(integer|int)\s+)?([A-Za-z_][\w$]*)\s*=\s*(.+?)\s*$/.exec(line);
  if(!m)throw Error('第 '+(index+1)+' 行：請寫 NAME = expression，例如 DATA_W = 512。');
  const [,type,name,value]=m;
  if(!C.validName(name))throw Error(name+' 不是合法的參數名稱。');
  if(seen.has(name))throw Error(name+' 與參數、接腳或 Top 內部名稱重複。');
  seen.add(name);C.parseExpression(value);rows.push({name,value,type:type||'',local:false});
 }
 return rows;
}
function defaults(parameters,project){
 const C=core(),expanded=parameters.map(p=>({...p,value:C.expandDefines(p.value,project)}));
 const result=C.resolveParameters({parameters:expanded},{});
 if(result.errors.length)throw Error(result.errors.map(x=>x.name+'：'+x.message).join('；'));
 return result.context;
}
function width(range,parameters,project){
 try{const C=core(),expanded=C.expandDefines(range,project),context=defaults(requiredDefinitions([expanded],parameters,project),project);return {...C.parseRange(expanded,context),parameterized:/[A-Za-z_$`]/.test(range)};}
 catch(e){return {error:e.message};}
}
// A bare expression is a bit count. Bracketed text is an explicit packed range.
// Store only canonical ranges, so the company exporter sees ordinary RTL.
function rangeFromInput(value){
 const C=core(),text=String(value||'').trim();if(!text||text==='1')return '';
 if(/^\[.*\]$/.test(text)){const match=/^\[(.+):(.+)\]$/.exec(text);if(!match)throw Error('範圍請寫 [MSB:LSB]，例如 [31:0]。');C.parseExpression(match[1]);C.parseExpression(match[2]);return '['+match[1].trim()+':'+match[2].trim()+']';}
 const unit=/^(\d+)\s*(B|bytes?|bits?|b)?$/i.exec(text);
 if(unit){const bytes=unit[2]==='B'||/^byte/i.test(unit[2]||''),n=Number(unit[1])*(bytes?8:1);if(!Number.isSafeInteger(n)||n<1||n>1048576)throw Error('位元數需為 1 到 1048576 的正整數。');return n===1?'':'['+(n-1)+':0]';}
 C.parseExpression(text);return '['+(/^[A-Za-z_][\w$]*$/.test(text)?text:'('+text+')')+'-1:0]';
}
function widthInput(range){const s=String(range||''),n=/^\[(\d+):0\]$/.exec(s),expr=/^\[\((.+)\)-1:0\]$/.exec(s);return n?String(Number(n[1])+1):expr?expr[1]:/^\[[A-Za-z_][\w$]*-1:0\]$/.test(s)?s.slice(1,-5):s||'1';}
function referencedParameters(range){
 const C=core(),m=/^\[(.+):(.+)\]$/.exec(range);if(!m)return [];
 const names=new Set();function walk(node){if(!node||typeof node!=='object')return;if(node.kind==='ref'||node.kind==='select')names.add(node.name);for(const v of Object.values(node))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(walk);else walk(v);}}
 walk(C.parseExpression(m[1]));walk(C.parseExpression(m[2]));return [...names];
}
function planWidth(value,definitions,project,values={},reserved=[]){
 const range=rangeFromInput(value),expanded=core().expandDefines(range,project),refs=referencedParameters(expanded),parameters=definitions.map(p=>({...p})),added=[];
 for(const name of refs){if(!core().validName(name))throw Error('參數名稱不合法：'+name);const old=parameters.find(p=>p.name===name),raw=String(Object.prototype.hasOwnProperty.call(values,name)?values[name]:'').trim();if(!old&&reserved.includes(name))throw Error(name+' 已是接腳或內部名稱，請換一個參數名稱。');if(raw){core().parseExpression(raw);if(old)old.value=raw;else{parameters.push({name,value:raw,type:'',local:false});added.push(name);}}}
 const missing=refs.filter(n=>!parameters.some(p=>p.name===n));if(missing.length)return {range,refs,missing,parameters,added};
 const info=width(range,parameters,project);if(info.error)return {range,refs,missing,parameters,added,error:info.error};
 // A bit-count expression must be positive; an explicit ascending range is legal.
 if(!String(value).trim().startsWith('[')&&!/^\d+\s*(?:B|bytes?|bits?|b)?$/i.test(String(value).trim())){const n=core().evaluateInteger(core().expandDefines(String(value),project),defaults(parameters,project));if(n<1)throw Error('位元數運算結果必須大於 0。');}
 return {range,refs,missing,parameters,added,width:info.width};
}
function requiredDefinitions(ranges,parameters,project){
 const needed=new Set(),visit=name=>{if(needed.has(name))return;needed.add(name);const p=parameters.find(x=>x.name===name);if(p)referencedParameters('['+core().expandDefines(p.value,project)+':0]').forEach(visit);};
 for(const range of ranges)referencedParameters(core().expandDefines(range,project)).forEach(visit);
 return parameters.filter(p=>needed.has(p.name));
}
// Incomplete lines never erase the port list or invalidate unrelated widths.
function previewDefinitions(text,ports,project,reserved=[]){
 const definitions=[],errors=[],seen=new Set(reserved);
 for(const [index,line] of String(text).split(/\r?\n/).entries()){
  if(!line.trim())continue;
  try{const p=parseDefinitions(line,[...seen])[0];definitions.push(p);seen.add(p.name);}
  catch(e){errors.push({line:index+1,message:e.message.replace(/^第 1 行：/,'')});}
 }
 let context={};try{context=defaults(definitions,project);}catch(e){errors.push({message:e.message});}
 return {definitions,context,errors,ports:ports.map(p=>({...p,info:width(p.range||'',definitions,project)}))};
}
function clipboardParameters(items,parameters,project){
 const ranges=items.map(x=>core().expandDefines(rangeFromInput(x.bits),project));
 const definitions=requiredDefinitions(ranges,parameters,project).map(p=>({...p,value:core().expandDefines(p.value,project)}));
 return {ranges,definitions};
}
function pasteParameterPlan(items,snapshot,destination,project,reserved=[]){
 const source=snapshot?.definitions||[],ranges=snapshot?.ranges||items.map(x=>{try{return rangeFromInput(x.bits);}catch(e){throw Error(x.name+'：'+e.message);}}),names=new Set();
 for(const range of ranges)referencedParameters(range).forEach(n=>names.add(n));
 for(const p of source){names.add(p.name);referencedParameters('['+p.value+':0]').forEach(n=>names.add(n));}
 const rows=[...names].map(name=>({name,source:source.find(p=>p.name===name)?.value,destination:destination.find(p=>p.name===name)?.value}));
 const used=new Set([...reserved,...destination.map(p=>p.name),...items.map(x=>x.name)]),mapping=Object.create(null);
 for(const p of source){let name=p.name,i=2;while(used.has(name))name=p.name+'_'+i++;used.add(name);mapping[p.name]=name;}
 const rewrite=text=>String(text).replace(/\d+'[sS]?[bBoOdDhH][0-9a-fA-F_xXzZ?]+|[A-Za-z_][\w$]*/g,t=>Object.prototype.hasOwnProperty.call(mapping,t)?mapping[t]:t);
 const parameters=destination.concat(source.map(p=>({...p,name:mapping[p.name],value:rewrite(p.value)})));
 const copied=items.map((p,i)=>({...p,bits:rewrite(ranges[i])||'1'}));
 const sourceErrors=rows.filter(r=>r.source===undefined).map(r=>'來源未宣告 '+r.name);
 for(const p of copied){const info=width(rangeFromInput(p.bits),parameters,project);if(info.error)sourceErrors.push(p.name+'：'+info.error);}
 const destinationErrors=items.flatMap(p=>{const info=width(rangeFromInput(p.bits),destination,project);return info.error?[p.name+'：'+info.error]:[];});
 return {rows,mapping,parameters,items:copied,sourceErrors:[...new Set(sourceErrors)],destinationErrors};
}
return {parseDefinitions,defaults,width,rangeFromInput,widthInput,referencedParameters,planWidth,requiredDefinitions,previewDefinitions,clipboardParameters,pasteParameterPlan};
});
