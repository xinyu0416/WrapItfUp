/* r96: electrical truth is the resolved project, never SVG coordinates.
 * Audit the render-only connectivity against bound RTL ports before export.
 * Complex expressions are intentionally not guessed into a one-wire net.
 */
(function(root){'use strict';
const C=root.WIUCore||(typeof require==='function'?require('./assembly-core'):null);
const A=root.WIUActions||(typeof require==='function'?require('./assembly-actions'):null);
function audit(project,scene){
 const issue=[],add=(code,message)=>issue.push({code,message});
 const p=C.projectView(project),inst=new Map(p.instances.map(i=>[i.id,i])),mods=new Map(p.modules.map(m=>[m.name,m])),netById=new Map(p.nets.map(n=>[n.id,n])),netByName=new Map(p.nets.map(n=>[n.name,n]));
 const binding=new Map(p.connections.map(c=>[c.instance+'::'+c.port,c]));
 const alias=new Map((p.assigns||[]).filter(a=>C.validName(a.target)&&C.validName(a.expr)).map(a=>[a.target,a.expr]));
 const aliasMatches=(from,to)=>{let v=to,seen=new Set();while(!seen.has(v)){if(v===from)return true;seen.add(v);v=alias.get(v);if(!v)break;}return false;};
 const detail=key=>{
  if(key.startsWith('top::')){const n=netById.get(key.slice(5));return n?{role:n.direction==='input'?'source':n.direction==='output'?'sink':'inout',net:n.name,top:true}:null;}
  const cut=key.indexOf('::');if(cut<0)return null;
  const id=key.slice(0,cut),portName=key.slice(cut+2),i=inst.get(id),m=mods.get(i?.module),port=m?.ports.find(p=>p.name===portName),c=binding.get(id+'::'+portName);
  return port?{role:port.direction==='output'?'source':port.direction==='input'?'sink':'inout',net:c?.expr||'',port:portName,instance:id,top:false}:null;
 };
 const seen=new Map();
 for(const e of scene.edges){
  const source=detail(e.source),target=detail(e.target);
  if(!source||!target||!scene.points[e.source]||!scene.points[e.target]){add('MISSING_ENDPOINT',e.net+': source/target does not exist');continue;}
  if(source.role==='sink'&&!e.bidirectional)add('REVERSED_SOURCE',e.net+' starts at an input: '+e.source);
  if(target.role==='source'&&!e.bidirectional)add('REVERSED_TARGET',e.net+' ends at an output: '+e.target);
  if(!source.top&&!aliasMatches(source.net,e.net))add('MISMAPPED_SOURCE',e.net+' does not follow output binding '+e.source+'='+source.net);
  if(source.top&&!aliasMatches(source.net,e.net))add('MISMAPPED_TOP_SOURCE',e.net+' does not follow Top input '+source.net);
  if(!target.top&&target.net!==e.net)add('MISMAPPED_SINK',e.net+' differs from sink '+e.target+'='+target.net);
  if(target.top&&target.net!==e.net)add('MISMAPPED_TOP_SINK',e.net+' differs from Top output '+target.net);
  const key=e.net+'|'+e.source+'|'+e.target;
  if(seen.has(key))add('DUPLICATE_ROUTE',e.net+': duplicate source→sink '+e.source+'→'+e.target);
  seen.set(key,true);
 }
 // Every directly bound input whose full net is driven must appear exactly
 // once in the visual topology. A symbolic slice/concat is not a full net;
 // it is handled by the RTL validator, never silently painted as a full wire.
 const targets=new Map();for(const e of scene.edges)targets.set(e.target,(targets.get(e.target)||0)+1);
 const driverNames=new Set(p.nets.filter(n=>n.direction==='input').map(n=>n.name));
 for(const c of p.connections){const i=inst.get(c.instance),m=mods.get(i?.module),port=m?.ports.find(x=>x.name===c.port);if(port?.direction==='output'&&C.validName(c.expr))driverNames.add(c.expr);}
 for(const c of p.connections){const i=inst.get(c.instance),m=mods.get(i?.module),port=m?.ports.find(x=>x.name===c.port);
  if(port?.direction!=='input'||!C.validName(c.expr)||!netByName.has(c.expr)||!driverNames.has(c.expr))continue;
  const count=targets.get(c.instance+'::'+c.port)||0;
  if(count!==1)add('INCOMPLETE_FANOUT',i.name+'.'+c.port+' ('+c.expr+') must have exactly one logical source, found '+count);
 }
 return issue;
}
const api={audit};root.WIUElectricalAudit=api;if(typeof module==='object')module.exports=api;
})(globalThis);
