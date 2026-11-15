/* UI semantics shared by history controls and the connection editor. */
(function(root){'use strict';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),arr=x=>Array.isArray(x)?x:[];
function bindingKind(expr){
 if(expr==null)return 'unset';if(expr==='')return 'open';
 const value=String(expr).trim();
 return /^(?:[+-]?\d+|(?:\d+)?'[sS]?[bBoOdDhH][0-9a-fA-F_xXzZ?]+|'[01xXzZ])$/.test(value)?'constant':'net';
}
function scopeName(project,scope){if(scope==='project')return '整個專案';if(scope==='top')return 'Top '+project.top;return '模組 '+(arr(project.modules).find(m=>m.id===scope)?.name||scope);}
function diffItems(before,after){const left=new Map(arr(before).map(x=>[x.id??x.name,x])),right=new Map(arr(after).map(x=>[x.id??x.name,x]));return {added:[...right].filter(([id])=>!left.has(id)).map(([,x])=>x),removed:[...left].filter(([id])=>!right.has(id)).map(([,x])=>x),changed:[...right].filter(([id,x])=>left.has(id)&&!same(left.get(id),x)).map(([id,x])=>({before:left.get(id),after:x}))};}
function historyLabel(before,after,scope){
 if(before.workbook?.projectId!==after.workbook?.projectId)return '切換專案資料';
 if(before.top!==after.top)return 'Top 改名：'+before.top+' → '+after.top;
 const modules=diffItems(before.modules,after.modules),instances=diffItems(before.instances,after.instances);
 if(modules.removed.length)return '刪除模組 '+modules.removed.map(x=>x.name).join('、');
 if(modules.added.length)return '新增模組 '+modules.added.map(x=>x.name).join('、');
 if(instances.removed.length)return '移除 '+instances.removed.map(x=>x.name).join('、');
 if(instances.added.length)return '加入 '+instances.added.map(x=>x.name).join('、');
 if(instances.changed.length){const x=instances.changed[0];if(x.before.name!==x.after.name)return 'Instance 改名：'+x.before.name+' → '+x.after.name;if(!same(x.before.parameters,x.after.parameters))return '修改 '+x.after.name+' 的參數覆寫';}
 if(modules.changed.length){const x=modules.changed[0];if(x.before.name!==x.after.name)return '模組改名：'+x.before.name+' → '+x.after.name;if(!same(x.before.parameters,x.after.parameters))return '修改 '+x.after.name+' 的預設參數';if(!same(x.before.ports,x.after.ports))return '修改 '+x.after.name+' 的共用介面';if(x.before.source!==x.after.source||x.before.originalSource!==x.after.originalSource)return '更新 '+x.after.name+' 的 RTL 來源';}
 if(!same(before.connections,after.connections)){const x=diffItems(before.connections,after.connections);const items=x.changed.map(x=>x.after).concat(x.added,x.removed);const c=items[0],inst=c&&arr(after.instances).find(i=>i.id===c.instance)||c&&arr(before.instances).find(i=>i.id===c.instance);return items.length===1&&c?'修改 '+(inst?.name||c.instance)+'.'+c.port+' 綁定':'修改 '+Math.max(1,items.length)+' 筆接腳綁定';}
 if(!same(before.nets,after.nets))return '修改 Top 接腳／內部線宣告';
 if(!same(before.assigns,after.assigns))return '修改訊號運算';
 if(!same(before.defineConfig,after.defineConfig))return '修改 Defines 組態';
 if(!same(before.rtlSources,after.rtlSources))return '更新 RTL 來源';
 if(!same(before.bundleConfig,after.bundleConfig)||!same(before.companyScript,after.companyScript))return '修改交付設定';
 if(!same(before.workbook?.graphPositions,after.workbook?.graphPositions))return '移動 Block／Top 接腳';
 if(!same(before.workbook?.wireRoutes,after.workbook?.wireRoutes)||!same(before.workbook?.graphAutoR99,after.workbook?.graphAutoR99))return '調整 Top 走線與配置';
 if(!same(before.workbook?.topStyle,after.workbook?.topStyle))return '修改 Top 圖面外觀';
 if(!same(before.workbook?.diagrams,after.workbook?.diagrams))return '修改 '+scopeName(after,scope)+' 的圖面';
 return '修改 '+scopeName(after,scope);
}
function actionScope(before,after,current,requested){
 const ids=xs=>arr(xs).map(x=>x.id);
 if(before.workbook?.projectId!==after.workbook?.projectId||!same(ids(before.modules),ids(after.modules))||!same(before.instances,after.instances))return 'project';
 return requested||current;
}
function historyEntry(list,scope){for(let i=list.length-1;i>=0;i--)if(list[i].scope===scope||list[i].scope==='project')return {entry:list[i],index:i};return null;}
function issueKey(issue){return String(issue.code||'')+'|'+JSON.stringify(issue.ref||{})+'|'+String(issue.ref?'':issue.message||'');}
const api={bindingKind,scopeName,historyLabel,historyEntry,actionScope,issueKey};root.WIUHistoryFlow=api;if(typeof module==='object')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
