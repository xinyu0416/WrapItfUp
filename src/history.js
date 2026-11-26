/* Scoped, conditional patches: undo never restores another page's snapshot. */
(function(root){'use strict';
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
// Normalizers can rebuild the same record with a different insertion order.
// Only document values matter for conflict checks; array order remains significant.
function same(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
 const keys=x=>Object.keys(x).filter(k=>x[k]!==undefined),ak=keys(a),bk=keys(b);
 return ak.length===bk.length&&ak.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&same(a[k],b[k]));
}
function changes(a,b,path=[],out=[]){
 if(same(a,b))return out;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(object(a)&&object(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))changes(a[k],b[k],path.concat(k),out);}
 else if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>!v?.id||v.id===b[i]?.id)){for(let i=0;i<a.length;i++)changes(a[i],b[i],path.concat(i),out);}
 else out.push({path,before:copy(a),after:copy(b)});
 return out;
}
function apply(project,entry,reverse){const p=copy(project),patch=entry.patch||changes(JSON.parse(entry.before),JSON.parse(entry.after));
 for(const c of patch){let parent=p;for(const k of c.path.slice(0,-1)){if(parent?.[k]===undefined)throw Error('此修改已有後續相依變更；請先復原相關頁的修改。');parent=parent[k];}const k=c.path.at(-1),expect=reverse?c.after:c.before,value=reverse?c.before:c.after;if(!same(parent[k],expect)&&c.path.join('.')==='orgEdited')continue;if(!same(parent[k],expect))throw Error('此修改已有後續相依變更；請先復原相關頁的修改。');if(value===undefined)delete parent[k];else parent[k]=copy(value);}
 return p;
}
const api={changes,apply};root.WIUHistory=api;if(typeof module==='object')module.exports=api;
})(globalThis);
