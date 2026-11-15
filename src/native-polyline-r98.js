/* Collapse bend-to-bend graph segments into one editable 1D shape per
 * uninterrupted electrical chain. Branches/real terminals remain endpoints.
 * This is a pure planner; page drawing coordinates come only from the scene.
 */
(function(root){'use strict';
const key=(net,p)=>net+'|'+Math.round(p.x*1000)/1000+','+Math.round(p.y*1000)/1000;
function chains(plan){
 const nodes=new Map(plan.nodes.map(n=>[n.id,n]));
 const adj=new Map();
 for(let i=0;i<plan.edges.length;i++){const e=plan.edges[i];for(const p of [e.a,e.b]){const id=key(e.net,p);if(!adj.has(id))adj.set(id,[]);adj.get(id).push(i);}}
 const terminals=new Set(plan.nodes.filter(n=>n.terminal||n.degree!==2).map(n=>n.id)),visited=new Set(),result=[];
 for(let i=0;i<plan.edges.length;i++){
  if(visited.has(i))continue;const start=plan.edges[i],a=key(start.net,start.a),b=key(start.net,start.b);
  let current=terminals.has(a)?a:terminals.has(b)?b:a;
  const path=[nodes.get(current)],edgeIds=[];
  if(!path[0])throw Error('Missing polyline vertex: '+current);
  let index=i;
  while(index!==undefined&&!visited.has(index)){
   visited.add(index);edgeIds.push(index);const edge=plan.edges[index];
   const na=key(edge.net,edge.a),nb=key(edge.net,edge.b),next=current===na?nb:current===nb?na:null;
   if(!next)throw Error('Broken electrical chain: '+edge.net);
   const node=nodes.get(next);if(!node)throw Error('Missing polyline vertex: '+next);
   path.push(node);current=next;
   if(terminals.has(current))break;
   index=(adj.get(current)||[]).find(j=>!visited.has(j));
  }
  if(path.length<2)throw Error('Polyline empty');
  if(path[0].id===path.at(-1).id){
   // A same-net cycle can arise from valid fanout branches that meet again.
   // A single Visio 1D connector with coincident Begin/End risks collapsing;
   // split the geometric loop at two distinct real vertices instead. No edge
   // is lost or duplicated; both split vertices become guide CPs in Visio.
   if(edgeIds.length<2)throw Error('Degenerate one-edge electrical loop: '+start.net);
   const half=Math.floor(edgeIds.length/2),pieces=[{nodes:path.slice(0,half+1),ids:edgeIds.slice(0,half)},{nodes:path.slice(half),ids:edgeIds.slice(half)}];
   if(path[0].id===path[half].id)throw Error('Degenerate cycle midpoint: '+start.net);
   for(const part of pieces)result.push({net:start.net,points:part.nodes.map(n=>({x:n.x,y:n.y})),begin:part.nodes[0],end:part.nodes.at(-1),edgeIds:part.ids,cycleSplit:true});
  }else result.push({net:start.net,points:path.map(n=>({x:n.x,y:n.y})),begin:path[0],end:path.at(-1),edgeIds});
 }
 if(visited.size!==plan.edges.length)throw Error('Unvisited net segment');
 return result;
}
const api={chains};root.WIUNativePolylineR98=api;if(typeof module==='object')module.exports=api;
})(globalThis);
