/* Conservative, data-only wiring suggestions. Every candidate needs review. */
(function(root,factory){const api=factory(root);root.WIUConnectionReview=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const dep=(key,file)=>root[key]||(typeof require==='function'?require('./'+file):null),C=()=>dep('WIUCore','assembly-core'),A=()=>dep('WIUActions','assembly-actions'),I=()=>dep('WIUImportReview','import-review-r118');
function identity(name,instance=''){
 const parts=String(name).split('_'),last=parts.at(-1),hit=/^(?:p|port|lane|ch|channel)?(\d+)$/i.exec(last);
 let channel=hit?.[1]??null;if(hit)parts.pop();
 if(channel===null)channel=/(?:^|_)(?:p|port|lane|ch|channel|inst)_?(\d+)$/i.exec(instance)?.[1]??null;
 return {base:parts.join('_'),channel};
}
function match(a,b){const x=identity(a.port||a.name,a.instanceName),y=identity(b.port||b.name,b.instanceName);return x.base===y.base&&(x.channel===null||y.channel===null||x.channel===y.channel);}
function suggestions(project){
 const pins=[...I().pinMap(project).values()],top=C().resolveParameters({parameters:C().projectView(project).parameters||[]},{}).context;
 const netRows=project.nets.map(n=>{let width,error;try{width=C().parseRange(C().expandDefines(n.range,project),top).width;}catch(e){error=e.message;}return {...n,width,error};});
 const drivers=pins.filter(p=>p.direction==='output'&&!p.error&&p.expr!=='');
 const options=[],rows=[],reserved=new Set([...project.nets.map(n=>n.name),...project.instances.map(i=>i.name)]);
 const unique=base=>{let name=base,i=2;while(reserved.has(name))name=base+'_'+i++;reserved.add(name);return name;};
 for(const sink of pins.filter(p=>p.expr===null&&['input','output','inout'].includes(p.direction))){
  const candidates=[],add=(candidate)=>{candidate.id='option_'+options.length;candidate.target=sink;options.push(candidate);candidates.push(candidate);};
  if(!sink.error&&sink.direction==='input'){
   for(const n of netRows.filter(n=>n.direction==='input'&&!n.error&&n.width===sink.width&&!!n.signed===!!sink.signed&&match(sink,n)))add({kind:'existing',sourceLabel:'Top.'+n.name,net:n.name,reason:'Top input → instance input；方向、位寬及名稱相符'});
   for(const source of drivers.filter(p=>p.instance!==sink.instance&&p.width===sink.width&&!!p.signed===!!sink.signed&&match(p,sink))){
    if(source.expr!==null&&!/^[A-Za-z_][\w$]*$/.test(source.expr))continue;
    const existing=netRows.find(n=>n.name===source.expr);
    if(source.expr!==null&&!existing)continue;
    if(existing&&(existing.direction==='input'||existing.error||existing.width!==sink.width||!!existing.signed!==!!sink.signed))continue;
    const sc=identity(source.port,source.instanceName).channel,tc=identity(sink.port,sink.instanceName).channel;
    add({kind:'internal',source,sourceLabel:source.instanceName+'.'+source.port,net:existing?.name||null,reason:'output → input · '+sink.width+' bit'+(sc!==null&&tc!==null?' · 通道 '+tc+' 相符':' · 通道未完全標示，需確認用途')});
   }
  }
  if(!sink.error&&sink.direction!=='inout'){
   const direction=sink.direction==='input'?'input':'output',existing=netRows.find(n=>n.name===sink.port&&n.direction===direction&&n.width===sink.width&&!!n.signed===!!sink.signed&&!n.error);
   if(!candidates.length||direction==='output')add({kind:existing?'existing':'top',sourceLabel:direction==='input'?'Top 外部輸入':sink.instanceName+'.'+sink.port,net:existing?.name||unique(sink.port),direction,reason:existing?'沿用 Top '+direction:'新增 Top '+direction+'（需明確選擇，不會自動升成對外接腳）'});
  }
  rows.push({pin:sink,candidates,reason:sink.error|| (sink.direction==='inout'?'雙向接腳需人工確認三態與驅動':'')});
 }
 return {rows,options};
}
function apply(project,optionIds){
 const p=A().clone(project),plan=suggestions(project),options=optionIds.map(id=>plan.options.find(o=>o.id===id));
 if(options.some(o=>!o))throw Error('接線候選已變更，請重新預覽。');
 const targets=new Set(),sourceNets=new Map(),changes=[],nets=[],reserved=new Set([...p.nets.map(n=>n.name),...p.instances.map(i=>i.name)]);
 const create=(name,width,direction,signed)=>{let n=name,i=2;while(reserved.has(n))n=name+'_'+i++;reserved.add(n);const row={id:'review_net_'+n,name:n,range:width===1?'':'['+(width-1)+':0]',direction,signed:!!signed,group:'',comment:''};p.nets.push(row);nets.push(row);return n;};
 for(const o of options){const target=o.target,key=target.instance+'::'+target.port;if(targets.has(key))throw Error('同一接腳不能選擇多個候選。');targets.add(key);
  let net=o.net;
  if(o.kind==='internal'){
   const sk=o.source.instance+'::'+o.source.port;
   net=net||sourceNets.get(sk);
   if(!net){net=create(o.source.instanceName+'_'+o.source.port,o.source.width,'wire',o.source.signed);sourceNets.set(sk,net);changes.push({instance:o.source.instance,port:o.source.port,expr:net});}
  }else if(o.kind==='top')net=create(o.net,target.width,o.direction,target.signed);
  o.net=net;changes.push({instance:target.instance,port:target.port,expr:net});
 }
 const assigned=new Map();for(const c of changes){const key=c.instance+'::'+c.port;if(assigned.has(key)&&assigned.get(key)!==c.expr)throw Error('同一來源被指定到不同 net，請擇一接線或先建立共用 net。');assigned.set(key,c.expr);}
 const dedup=[...new Map(changes.map(c=>[c.instance+'::'+c.port,c])).values()];A().applyConnections(p,dedup);p.orgEdited=true;
 const key=i=>i.code+'|'+JSON.stringify(i.ref)+'|'+i.message,before=new Set(C().validate(project).filter(i=>i.severity==='error').map(key));
 const errors=C().validate(p).filter(i=>i.severity==='error'&&!before.has(key(i))&&i.code!=='UNCONFIGURED_PIN');
 if(errors.length)throw Error(errors.map(i=>i.message).join('\n'));
 return {project:p,changes:dedup,nets,options};
}
return {identity,suggestions,apply};
});
