/* r100: Group -> full electrical net membership, including cross-group fanout.
 * This is a view selector only: it must never change connection or routing.
 */
(function(root){'use strict';
function groupNets(scene,group,project){
 if(!scene||!group)return [];
 const portIds=new Set();
 const members=new Set(group.members||[]);
 if(group.instance){for(const name of members)portIds.add(group.instance+'::'+name);}
 else if(group.moduleId==='top'){
  for(const p of project.nets||[])if(members.has(p.name))portIds.add('top::'+p.id);
 }
 return [...new Set(scene.edges.filter(e=>portIds.has(e.source)||portIds.has(e.target)).map(e=>e.net))];
}
function forKey(scene,key,project){
 const groups=(scene?.groups||[]).filter(x=>x.key===key);
 if(!groups.length)return null;
 // A Group can have more than one on-screen segment (e.g. split by port order).
 // Every segment is one logical Group; never silently drop members after the first.
 const nets=new Set();
 for(const group of groups)for(const net of groupNets(scene,group,project))nets.add(net);
 return {group:groups[0],groups,nets:[...nets]};
}
const api={groupNets,forKey};root.WIUGroupFocusR100=api;if(typeof module==='object')module.exports=api;
})(globalThis);
