(function(root,factory){const api=factory();root.WIUSignalTableModel=api;if(typeof module==='object')module.exports=api;})(globalThis,function(){
'use strict';
const fields=['name','bits','direction','side','group','comment','condition','waveType'];
const aliases={name:'name',signal:'name','訊號名稱':'name','名稱':'name',bits:'bits',width:'bits',range:'bits','位寬':'bits',direction:'direction',dir:'direction','方向':'direction',side:'side','位置':'side',group:'group','群組':'group',comment:'comment','註解':'comment','備註':'comment',wavetype:'waveType',wave:'waveType','波形類型':'waveType',condition:'condition',ifdef:'condition','條件':'condition'};
const dirs={in:'input',input:'input',out:'output',output:'output','i/o':'inout',inout:'inout'};
const sides={l:'left',left:'left','左':'left','左側':'left',r:'right',right:'right','右':'right','右側':'right'};
function parse(text,{startField='name',columns=fields}={}){
 const lines=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');while(lines.length&&!lines.at(-1).trim())lines.pop();
 if(!lines.length)return {rows:[],errors:['請貼上至少一列。'],fields:[]};
 const first=lines[0].split('\t'),header=first.map(x=>aliases[x.trim().toLowerCase()]);
 const hasHeader=first.length>1&&header.every(Boolean);let used=hasHeader?header:columns.slice(Math.max(0,columns.indexOf(startField)));
 const errors=[];if(hasHeader&&new Set(header).size!==header.length)errors.push('欄位標題重複。');
 const rows=lines.slice(hasHeader?1:0).map((line,i)=>{const cells=line.split('\t'),row={};if(!line.trim()){errors.push('第 '+(i+1)+' 列空白；間隔請用「插入間隔」。');return row;}
  if(cells.length>used.length){errors.push('第 '+(i+1)+' 列欄位過多。');return row;}
  cells.forEach((value,n)=>{const f=used[n],v=f==='comment'?value:value.trim();row[f]=f==='direction'?(dirs[v.toLowerCase()]||v):f==='side'?(sides[v.toLowerCase()]||v):v;});return row;
 });
 return {rows,errors,fields:used.slice(0,Math.max(...lines.slice(hasHeader?1:0).map(l=>l.split('\t').length),0))};
}
function validateName(name){const n=String(name??'').trim().replace(/^\/\/\s*/,'');return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(n)?'':'名稱需以英文字母或底線開頭，後接英數、底線或 $；空白間隔請用專用按鈕。';}
function condition(value){const v=String(value||'').trim();if(!v)return null;const m=/^`?(ifdef|ifndef)\s+([A-Za-z_][A-Za-z0-9_$]*)$/.exec(v);if(!m)throw Error('條件請填 ifdef FPGA 或 ifndef FPGA。');return {kind:m[1],macro:m[2]};}
function plan(current,parsed,{mode='append',startId=null,targetIds=null,defaultSide='left',validateWidth=()=>'',validateSignalName=()=>''}={}){
 const rows=current.map(r=>({...r})),errors=parsed.errors.map(message=>({row:0,field:'',message})),changed=[];
 const at=rows.findIndex(r=>r.id===startId),targets=targetIds||rows.slice(Math.max(0,at)).filter(r=>!r.spacer).map(r=>r.id);
 if(mode==='overwrite'&&at<0)errors.push({row:0,field:'',message:'請先選取覆寫起點。'});
 parsed.rows.forEach((patch,i)=>{
  let row;
  if(mode==='overwrite'){row=rows.find(r=>r.id===targets[i]);if(!row){errors.push({row:i+1,field:'',message:'超出可覆寫列數；改用新增列或減少資料。'});return;}if(row.spacer){errors.push({row:i+1,field:'',message:'間隔列不能覆寫成訊號。'});return;}Object.assign(row,patch);}
  else{row={id:null,name:'',bits:'1',direction:defaultSide==='right'?'output':'input',side:defaultSide,group:'',comment:'',condition:'',...patch};changed.push(row);return;}
  changed.push(row);
 });
 if(mode==='append')rows.push(...changed);
 for(const [i,r] of changed.entries()){
  const add=(field,message)=>{if(message)errors.push({row:i+1,field,message});};
  add('name',validateName(r.name)||validateSignalName(r.name));add('bits',!String(r.bits).trim()?'位寬不可空白。':validateWidth(r.bits));
  if(!['input','output','inout'].includes(r.direction))add('direction','方向只能是 IN、OUT、I/O。');
  if(!['left','right'].includes(r.side))add('side','位置只能是左或右。');
  if(r.waveType&&!['auto','signal','data','clock'].includes(r.waveType))add('waveType','波形類型只能是 auto、signal、data、clock。');
  try{condition(r.condition);}catch(e){add('condition',e.message);}
  if(r.name&&!/^\s*\/\//.test(r.name)&&rows.some(x=>x!==r&&!x.spacer&&!/^\s*\/\//.test(x.name)&&x.name===r.name))add('name','重複名稱：'+r.name);
 }
 return {rows,changed,errors};
}
function reorder(rows,ids,targetId,after=false){
 const chosen=new Set(ids),target=rows.find(r=>r.id===targetId);if(!target||chosen.has(targetId))return rows.map(r=>({...r}));
 const moving=rows.filter(r=>chosen.has(r.id)).map(r=>({...r,side:target.side})),rest=rows.filter(r=>!chosen.has(r.id)).map(r=>({...r})),at=rest.findIndex(r=>r.id===targetId)+(after?1:0);
 rest.splice(at,0,...moving);return rest;
}
function boundary(rows,ids,end=false){let result=rows.map(r=>({...r}));const selected=new Set(ids);for(const side of ['left','right']){const chosen=result.filter(r=>r.side===side&&selected.has(r.id)).map(r=>r.id),rest=result.filter(r=>r.side===side&&!selected.has(r.id));if(chosen.length&&rest.length)result=reorder(result,chosen,(end?rest.at(-1):rest[0]).id,end);}return result;}
function deleteIds(clicked,selected,batch=false){return batch?[...new Set(selected)]:[clicked];}
function defaults(selected,side='left'){return {side:selected?.side||side,direction:selected?.direction||(side==='right'?'output':'input')};}
return {fields,parse,plan,reorder,validateName,condition,deleteIds,defaults,boundary};
});
