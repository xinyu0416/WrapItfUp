(function(root,factory){const api=factory(root);root.WIUGraphWiring=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const C=root.WIUCore||(typeof require==='function'?require('./assembly-core'):null),A=root.WIUActions||(typeof require==='function'?require('./assembly-actions'):null);
function endpoints(p){
 const pv=C.projectView(p),raw=pv.parameters||[],defs=Array.isArray(raw)?raw:Object.entries(raw).map(([name,value])=>({name,value})),top=C.resolveParameters({parameters:defs},{});
 const width=(range,ctx,errors=[])=>{try{if(errors.length)throw Error(errors.join('; '));return {width:C.parseRange(C.expandDefines(range||'',p),ctx).width};}catch(e){return {width:null,error:e.message};}};
 return p.nets.filter(n=>n.direction!=='wire').map(n=>({key:'top::'+n.id,top:true,net:n,label:'Top.'+n.name,role:n.direction==='input'?'source':n.direction==='output'?'sink':'inout',...width(n.range,top.context,top.errors)})).concat(A.pinRows(p).map(r=>{const i=pv.instances.find(i=>i.id===r.instance),m=pv.modules.find(m=>m.name===i.module),ctx=C.resolveParameters(m,i.parameters,top.context);return {...r,top:false,label:r.instanceName+'.'+r.port.name,role:r.port.direction==='output'?'source':r.port.direction==='input'?'sink':'inout',...width(r.port.range,ctx.context,ctx.errors)};}));
}
function compatibility(a,b){if(!a||!b)return '找不到接腳';if(a.key===b.key)return '同一端點';if(a.width===null||b.width===null)return '位寬尚未解析：'+(a.error||b.error);if(a.width!==b.width)return '位寬不一致：'+a.width+' / '+b.width+' bits';if(a.role==='inout'||b.role==='inout')return a.role===b.role?'':'雙向接腳請連到另一個雙向接腳';return a.role===b.role?'需要一個驅動端與一個接收端':'';}
function plan(p,keyA,keyB){
 const all=endpoints(p),a=all.find(e=>e.key===keyA),b=all.find(e=>e.key===keyB),why=compatibility(a,b);if(why)throw Error(why);
 const trial=A.clone(p),changes=[],nets=[],assigns=[],replacements=[];
 const bind=(e,expr)=>{if(e.top)return;if(e.expr===expr)return;if(e.expr!=null)replacements.push({label:e.label,before:e.expr,after:expr});changes.push({instance:e.instance,port:e.port.name,expr});};
 const assign=(target,expr)=>{const same=trial.assigns.find(x=>x.target===target);if(same?.expr===expr)return;if(same)replacements.push({label:target,before:same.expr,after:expr});trial.assigns=trial.assigns.filter(x=>x.target!==target);const value={id:'graph_assign_'+target,target,expr};trial.assigns.push(value);assigns.push(value);};
 const top=a.top?a:b.top?b:null,pin=a.top?b:a;
 if(a.top&&b.top){if(a.role==='inout')throw Error('兩個 Top 雙向接腳不能以單向 assign 相接');const source=a.role==='source'?a:b,sink=a.role==='sink'?a:b;assign(sink.net.name,source.net.name);}
 else if(top){
  // Keep existing fanout when exposing an already wired child output.
  if(top.role==='sink'&&pin.expr&&pin.expr!==top.net.name)assign(top.net.name,pin.expr);
  else bind(pin,top.net.name);
 }else{
  const source=a.role==='source'?a:b.role==='source'?b:a,sink=source===a?b:a;
  let name=source.expr;
  if(name&&!C.validName(name))throw Error('此驅動端已接切片／拼接式；請用接腳「接線設定」調整，避免覆蓋既有 fanout');
  if(!name){const occupied=new Set(p.nets.map(n=>n.name.toLowerCase()).concat(p.instances.map(i=>i.name.toLowerCase()),(p.parameters||[]).map(x=>x.name.toLowerCase()))),base=(source.instanceName+'_'+source.port.name).replace(/[^A-Za-z0-9_$]/g,'_');name=base;let i=2;while(occupied.has(name.toLowerCase()))name=base+'_'+i++;nets.push({id:'graph_net_'+name,name,direction:'wire',range:a.width===1?'':'['+(a.width-1)+':0]',signed:false,comment:'',group:'',nameBinding:{mode:'instance-port',instanceId:source.instance,portId:source.port.id||null,portName:source.port.name,suffix:name.slice(base.length),lastGenerated:name}});}
  bind(source,name);bind(sink,name);
 }
 trial.nets.push(...nets);A.applyConnections(trial,changes);
 const signature=i=>JSON.stringify([i.code,i.ref,i.message]),prior=new Set(C.validate(p).filter(i=>i.severity==='error').map(signature));
 const added=C.validate(trial).filter(i=>i.severity==='error'&&!prior.has(signature(i)));
 if(added.length)throw Error(added.map(i=>i.message).join('\n'));
 return {project:trial,changes,nets,assigns,replacements,label:a.label+' ↔ '+b.label,changed:!!(changes.length||nets.length||assigns.length)};
}
return {endpoints,compatibility,plan};
});
