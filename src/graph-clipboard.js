/* Top selections become signal rows; insertion stays in the existing editors. */
(function(root,factory){
 const api=factory(root);root.WIUGraphClipboard=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis,function(root){
 'use strict';
 const C=root.WIUCore||(typeof require==='function'?require('./assembly-core'):null);
 const W=root.WIUWorkbook||(typeof require==='function'?require('./workbook'):null);
 const G=root.WIUGraphWiring||(typeof require==='function'?require('./graph-wiring'):null);
 const P=root.WIUPortClipboard||(typeof require==='function'?require('./port-clipboard'):null);
 function rows(project,{object=null,pins=[],nets=[],groups=[]}={}){
  const ends=G.endpoints(project),byKey=new Map(ends.map(e=>[e.key,e]));
  const chosen=new Map(),netNames=new Set(nets),diagrams=new Map();
  const add=(end,group)=>{if(end&&!chosen.has(end.key))chosen.set(end.key,{end,group});};
  const instance=object?.kind==='instance'&&project.instances.find(i=>i.id===object.id);
  if(pins.length){for(const key of pins)add(byKey.get(key));}
  else if(instance){for(const e of ends)if(e.instance===instance.id)add(e);}
  else if(groups.length){
   for(const g of groups)for(const name of g.members||[]){
    const key=g.instance?g.instance+'::'+name:'top::'+project.nets.find(n=>n.name===name)?.id;
    add(byKey.get(key),g.name);
   }
  }else if(object?.kind==='pin'&&netNames.size<=1)add(byKey.get(object.id));
  else{
   const top=C.resolveParameters({parameters:project.parameters||[]},{});
   for(const net of project.nets)if(netNames.has(net.name)){
    let width=null;
    try{if(top.errors.length)throw Error(top.errors.join('; '));width=C.parseRange(C.expandDefines(net.range||'',project),top.context).width;}catch{}
    add({key:'net::'+net.id,net,top:true,width});
   }
  }
  return [...chosen.values()].map(({end,group})=>{
   const port=end.top?end.net:end.port;
   if(!Number.isSafeInteger(end.width)||end.width<1)throw Error(port.name+' 的位寬尚未解析，請先修正位寬。');
   if(group===undefined){
    const module=end.top?W.moduleOf(project,'top'):project.modules.find(m=>m.name===end.module);
    if(module){
     if(!diagrams.has(module.id))diagrams.set(module.id,W.makeDiagram(project,module.id));
     const d=diagrams.get(module.id);
     for(const side of ['left','right']){
      const signal=d.signals[side].find(s=>s.id===port.id||s.name===port.name);
      if(signal){group=W.groupLabel(d,side,signal.groupId);break;}
     }
    }
   }
   return {name:port.name,bits:String(end.width),waveType:P.resolvedType(port,end.width),group:group||''};
  });
 }
 return {rows};
});
