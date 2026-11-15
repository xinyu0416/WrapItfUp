(function(root,factory){const api=factory(root);root.WIUFindReplaceCore=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const core=()=>root.WIUCore||(typeof require==='function'?require('./assembly-core'):null);
function occurrences(value,query,options={}){
 if(!query)return [];const escaped=String(query).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp(escaped,options.caseSensitive===false?'gi':'g'),out=[];let hit;
 while((hit=re.exec(String(value)))){const start=hit.index,end=start+hit[0].length,word=c=>!!c&&/[A-Za-z0-9_$]/.test(c);if(options.wholeWord&&(word(value[start-1])||word(value[end])))continue;out.push({start,end,text:hit[0]});}
 return out;
}
function plan(rows,options={}){
 const targets=options.ids?new Set(options.ids):null,field=options.field||'name',matches=[],changes=[];
 for(const row of rows){if(row.kind!==field||targets&&!targets.has(row.id))continue;const before=String(row.value??''),hits=occurrences(before,options.query,options);
  for(const hit of hits)matches.push({...hit,id:row.id,kind:field,side:row.side,label:row.label,key:row.id+':'+hit.start});
  const selected=options.onlyMatch?hits.filter(h=>row.id+':'+h.start===options.onlyMatch):hits;if(!selected.length)continue;
  let after=before;for(const hit of selected.slice().reverse())after=after.slice(0,hit.start)+String(options.replacement??'')+after.slice(hit.end);
  if(options.overrides&&Object.prototype.hasOwnProperty.call(options.overrides,row.id))after=options.overrides[row.id];
  if(after!==before)changes.push({id:row.id,kind:field,side:row.side,label:row.label,before,after,count:selected.length});
 }
 const errors=[],conflicts=new Set(),changed=new Map(changes.map(c=>[c.id,c]));
 for(const c of changes){if(field==='name'&&!/^\/\//.test(c.after)&&!core().validName(c.after)){errors.push(c.label+'：取代後不是合法名稱「'+c.after+'」');conflicts.add(c.id);}if(field==='group'&&!c.after.trim()){errors.push('群組名稱不能為空白');conflicts.add(c.id);}}
 if(field==='name'&&changes.length){const buckets=new Map(),fold=s=>options.caseInsensitiveNames?s.toLowerCase():s,reserved=new Set((options.reserved||[]).map(fold));
  for(const row of rows.filter(r=>r.kind==='name')){const value=changed.get(row.id)?.after??row.value;if(!value||/^\/\//.test(value))continue;const key=fold(value);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({...row,value});}
  for(const [name,group] of buckets){if(!group.some(r=>changed.has(r.id)))continue;if(group.length>1||reserved.has(name)){group.forEach(r=>conflicts.add(r.id));errors.push('名稱「'+group[0].value+'」重複'+(reserved.has(name)?'（參數或內部名稱）':'：'+group.map(r=>r.label).join('、')));}}
 }
 if(options.locked&&changes.length&&field==='name')errors.unshift(options.locked);
 return {matches,changes,errors,conflicts:[...conflicts],field};
}
return {occurrences,plan};
});
