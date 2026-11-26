/* A reviewable alternative for congested orthogonal diagrams. Side corridors carry
   pin escapes. Disjoint net spans may reuse the same horizontal channel. */
(function(root){
  'use strict';
  const pitchX=24,pitchY=36,clear=80;
  function candidate(project,before,graph){
    if(before.style.route!=='orthogonal'||before.placed.some(b=>b.shape==='bar')||
       project.workbook.layoutLocks?.length||!before.edges.length)return null;
    const p={...project,workbook:{...project.workbook,graphPositions:{},wireRoutes:{}}};
    const netAt=new Map();
    for(const e of before.edges)for(const key of [e.source,e.target]){
      if(!netAt.has(key))netAt.set(key,new Set());
      netAt.get(key).add(e.net);
    }
    const points=Object.values(before.points);
    const outerCount=side=>points.filter(pt=>pt.outerSide===side).reduce((n,pt)=>Math.max(n,pt.index+1),0);
    const outer={pitch:pitchX,start:56,left:outerCount('left'),right:outerCount('right')};
    const snapshot={...graph.snapshotScene(p,before),routes:{},placed:{},inputPositions:{},inputManualRoutes:{},
      autoSize:{topLanes:outer,extraRight:0,extraBottom:0}};
    let x=before.topBoundary.left+outer.left*pitchX+2*clear;
    const access=new Map(),blocks=[...before.placed].sort((a,b)=>a.x-b.x||a.y-b.y);
    for(const b of blocks){
      const sides={};
      for(const side of ['left','right']){
        sides[side]=points.filter(pt=>pt.instance===b.instance.id&&pt.side===side&&netAt.has(pt.key)).sort((a,b)=>b.y-a.y);
      }
      const bx=Math.ceil(x+sides.left.length*pitchX+clear);
      const location={x:bx,y:Math.max(128,b.y)};
      p.workbook.graphPositions[b.instance.id]=location;snapshot.placed[b.instance.id]=location;
      for(const side of ['left','right'])sides[side].forEach((pt,index)=>{
        const offset=clear+index*pitchX;
        access.set(pt.key,side==='left'?bx-offset:bx+b.width+offset);
      });
      x=bx+b.width+sides.right.length*pitchX+2*clear;
      snapshot.autoSize.extraRight=sides.right.length*pitchX+2*clear;
    }
    snapshot.inputPositions=p.workbook.graphPositions;
    p.workbook.graphAutoR99=snapshot;
    const placed=graph.create(p,{fast:true});
    for(const pt of Object.values(placed.points))if(pt.outerSide)access.set(pt.key,pt.trackX);
    // Two logical names at one physical Top input can share only its initial pad escape.
    const splitSources={};
    for(const [key,names] of netAt){
      if(names.size===1)continue;
      if(names.size!==2||!placed.points[key]?.outerSide||placed.edges.some(e=>e.target===key))return null;
      splitSources[key]=[...names][1];
    }
    const escapeX=(edge,key)=>{
      const pt=placed.points[key];
      return splitSources[key]===edge.net?pt.x+(pt.side==='right'?28:-28):access.get(key);
    };
    const ids=new Map(p.nets.map(n=>[n.name,n.id]));
    snapshot.autoSize.splitSourceIds=Object.fromEntries(Object.entries(splitSources).map(([key,name])=>[key,ids.get(name)]));
    const spans=new Map();
    for(const edge of placed.edges){
      const a=escapeX(edge,edge.source),b=escapeX(edge,edge.target);
      if(!Number.isFinite(a)||!Number.isFinite(b))return null;
      const s=spans.get(edge.net)||{name:edge.net,left:Infinity,right:-Infinity};
      s.left=Math.min(s.left,a,b);s.right=Math.max(s.right,a,b);spans.set(edge.net,s);
    }
    const firstY=placed.topBoundary.bottom+clear;
    const pins=placed.edges.flatMap(e=>[e.source,e.target].map(key=>{
      const pin=placed.points[key],track=escapeX(e,key);
      return {net:e.net,left:Math.min(pin.x,track),right:Math.max(pin.x,track),y:pin.y};
    }));
    const planned=[...spans.values()];
    const axisY=placed.topBoundary.headerBottom+clear;
    const rows=new Map(),near=(a,b,gap)=>a.left<=b.right+gap&&a.right>=b.left-gap;
    // Prefer the nearest available row. A row may pass through gaps between
    // blocks, provided it clears pad escapes, elbows and other horizontal wires.
    const ys=new Map();
    for(const pin of pins){if(!ys.has(pin.net))ys.set(pin.net,[]);ys.get(pin.net).push(pin.y);}
    for(const s of planned.sort((a,b)=>(b.right-b.left)-(a.right-a.left)||a.left-b.left)){
      const avoid=placed.placed.filter(b=>near(s,{left:b.x,right:b.x+b.width},34))
        .map(b=>[b.y-35,b.y+b.height+35]);
      for(const pin of pins)if(pin.net!==s.name&&near(s,pin,34))avoid.push([pin.y-34,pin.y+34]);
      const locations=ys.get(s.name).sort((a,b)=>a-b),mid=locations[Math.floor(locations.length/2)];
      const wanted=Math.max(0,Math.round((mid-axisY)/pitchY));
      for(let delta=0;;delta++){
        const alternatives=delta?[wanted-delta,wanted+delta]:[wanted];
        const lane=alternatives.find(k=>k>=0&&!avoid.some(([lo,hi])=>axisY+k*pitchY>=lo&&axisY+k*pitchY<=hi)
          &&!(rows.get(k)||[]).some(used=>near(s,used,pitchY)));
        if(lane===undefined)continue;
        if(!rows.has(lane))rows.set(lane,[]);
        rows.get(lane).push(s);s.y=axisY+lane*pitchY;break;
      }
    }
    const fallback=()=>{
      const ends=[];
      for(const s of planned.sort((a,b)=>a.left-b.left||a.right-b.right)){
        let lane=ends.findIndex(end=>s.left-end>pitchY);
        if(lane<0)lane=ends.length;
        ends[lane]=s.right;s.y=firstY+lane*pitchY;
      }
    };
    const build=()=>{
      snapshot.autoSize={...snapshot.autoSize,extraBottom:Math.max(0,Math.max(...planned.map(s=>s.y))+clear-placed.topBoundary.bottom)};
      for(const edge of placed.edges){
        const a=placed.points[edge.source],b=placed.points[edge.target],ax=escapeX(edge,edge.source),bx=escapeX(edge,edge.target),y=spans.get(edge.net).y;
        const pts=[{x:a.x,y:a.y},{x:ax,y:a.y},{x:ax,y},{x:bx,y},{x:bx,y:b.y},{x:b.x,y:b.y}];
        snapshot.routes[edge.routeKey]={source:edge.source,target:edge.target,points:pts.map(p=>[p.x,p.y]),manual:false};
      }
      return {project:p,scene:graph.create(p,{full:true})};
    };
    const compact=build(),q=compact.scene.routeQualityR98?.summary,c=compact.scene.crossingSummary;
    if(q&&!q.finalInvalid&&!q.parallelSpacing?.count&&!c.unresolved&&!c.overlaps)return compact;
    fallback();
    return build();
  }
  const api={candidate};root.WIUChannelLayout=api;if(typeof module==='object')module.exports=api;
})(globalThis);
