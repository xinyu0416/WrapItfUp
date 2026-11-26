/* Drawing annotations are anchored along a branch, independently of its RTL name. */
(function(root){
  'use strict';
  function geometry(edge){
    let total=0;
    const segments=edge.points.map(([x,y,x2,y2])=>{
      const dx=x2-x,dy=y2-y,length=Math.hypot(dx,dy),start=total;
      total+=length;
      return {x,y,dx,dy,length,start};
    }).filter(s=>s.length>0);
    return {segments,total};
  }
  function fraction(edge,point){
    const {segments,total}=geometry(edge);
    let best=Infinity,at=.5;
    for(const s of segments){
      const t=Math.max(0,Math.min(1,((point.x-s.x)*s.dx+(point.y-s.y)*s.dy)/(s.length*s.length)));
      const distance=Math.hypot(s.x+t*s.dx-point.x,s.y+t*s.dy-point.y);
      if(distance<best){best=distance;at=(s.start+t*s.length)/total;}
    }
    return at;
  }
  function position(edge,at){
    const {segments,total}=geometry(edge),offset=Math.max(0,Math.min(1,at))*total;
    const s=segments.find(s=>s.start+s.length>=offset)||segments.at(-1);
    if(!s)return null;
    const t=(offset-s.start)/s.length;
    return {x:s.x+t*s.dx,y:s.y+t*s.dy};
  }
  function set(project,label,value){
    const text=value.trim();
    if(text.length>120||/[\r\n]/.test(text))throw Error('請輸入單行標籤, 最多 120 個字元.');
    const list=project.workbook.wireLabels||[],original=list.find(x=>x.id===label.id);
    if(text===String(original?.text||''))return;
    const next=list.filter(x=>x.id!==label.id);
    if(text)next.push({...label,text});
    if(next.length)project.workbook.wireLabels=next;else delete project.workbook.wireLabels;
  }
  const api={position,fraction,set};root.WIUWireLabels=api;if(typeof module==='object')module.exports=api;
})(globalThis);
