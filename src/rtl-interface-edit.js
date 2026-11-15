/* Source-backed interface edits. Only a uniquely located physical declaration
 * is rewritten. The implementation body and sibling modules stay in place;
 * the candidate is reparsed before the workbook can commit one undo action. */
(function(root,factory){const api=factory(root);root.WIURtlInterfaceEdit=api;if(typeof module==='object')module.exports=api;})(globalThis,function(root){
'use strict';
const parser=()=>root.WIUParser||(typeof require==='function'?require('./assembly-parser'):null);
const mask=s=>parser().stripComments(s).replace(/"(?:\\[\s\S]|[^"\\])*"/g,x=>x.replace(/[^\r\n]/g,' '));
const compact=s=>String(s||'').replace(/\s/g,'');
const params=m=>JSON.stringify((m.parameters||[]).map(p=>[p.name,compact(p.value),compact(p.type),!!p.local]));
const shape=m=>JSON.stringify(m.ports.map(p=>[p.name,p.direction,compact(p.range),!!p.signed]).sort((a,b)=>a[0].localeCompare(b[0])));
const key=m=>params(m)+'|'+shape(m);
const error=message=>{throw Error('介面修改未套用：'+message+'。原 RTL 與接線保持不變。');};
function closeAt(s,start){const opens={'(':')','[':']','{':'}'},stack=[];for(let i=start;i<s.length;i++){if(opens[s[i]])stack.push(opens[s[i]]);else if(')]}'.includes(s[i])){if(stack.pop()!==s[i])error('RTL 括號不完整');if(!stack.length)return i;}}error('RTL 括號不完整');}
function parts(s,start,end){const a=parser().splitTop(mask(s.slice(start,end)),',');let at=start;return a.filter((x,i)=>x.trim()||a.length>1).map(x=>{const row={start:at,end:at+x.length,raw:s.slice(at,at+x.length)};at+=x.length+1;return row;});}
function parseRows(rows){let prefix=null;return rows.map(row=>{
 const clean=mask(row.raw),m=/^\s*(?:(input|output|inout)\s+)?((?:(?:wire|reg|logic|tri|tri0|tri1|wand|wor|uwire|var|bit|signed|unsigned)\b\s*)*)(\[[^\]]+\]\s*)?([A-Za-z_][\w$]*)\s*$/.exec(clean);
 if(!m)error('這份 RTL 的接腳宣告含尚未支援的型別、陣列或巨集，請使用「更新 RTL」修改該宣告');
 if(m[1])prefix={direction:m[1],type:m[2].trim(),range:(m[3]||'').trim()};
 else if(m[2]||m[3])error('接腳繼承宣告不明，請將方向與型別寫完整');
 if(!prefix)error('找不到接腳方向宣告');
 return {...row,...prefix,name:m[4]};
 });}
function inspect(p,m,physical){
 const filename=m.sourceFilename||m.filename||m.name+'.v',rows=(p.rtlSources||[]).filter(f=>f.name===filename);
 if(rows.length>1)error(filename+' 有重複來源');
 const text=rows[0]?.text??m.originalSource??m.source;
 if(!text)error('找不到 '+m.name+' 的完整 RTL 來源，請先匯入');
 const scan=physical(text),owned=scan.spans.filter(s=>s.name===m.name);
 if(scan.ambiguous||owned.length!==1)error(m.name+' 的實體宣告不是唯一一份（可能有多個條件版本），請使用「更新 RTL」同步修改各版本');
 const span=owned[0],source=text.slice(span.start,span.end),clean=mask(source);
 const decl=/\bmodule\s+(?:(?:automatic|static)\s+)?([A-Za-z_][\w$]*)/.exec(clean);
 if(!decl||decl[1]!==m.name)error('無法定位 module 宣告');
 let at=decl.index+decl[0].length;const ws=()=>{while(/\s/.test(clean[at]||'')&&at<clean.length)at++;};ws();
 if(clean[at]==='#'){at++;ws();if(clean[at]!=='(')error('參數宣告無法定位');at=closeAt(clean,at)+1;ws();}
 let open=at,close=at;if(clean[at]==='('){close=closeAt(clean,at);at=close+1;ws();}else open=close=-1;
 if(clean[at]!==';')error('接腳宣告中含條件式或巨集，請使用「更新 RTL」修改該宣告');
 const headerEnd=at+1,header=open<0?'':clean.slice(open+1,close);
 if(/`(?:ifdef|ifndef|else|elsif|endif|include|define|undef)\b/.test(header))error('接腳清單含條件式或 include，請使用「更新 RTL」同步修改各組態');
 const active=parser().parseRtl(text,{config:p.defineConfig,filename}),old=active.modules.find(x=>x.name===m.name);
 if(!old||active.issues.some(x=>x.severity==='error')||key(old)!==key(m))error('保存的接腳與 RTL 解析結果不一致，請先使用「更新 RTL」核對來源');
 const ansi=/\b(input|output|inout)\b/.test(header)||!header.trim(),groups=[];
 let declRows=[];
 if(ansi)declRows=open<0?[]:parseRows(parts(source,open+1,close));
 else{
  const body=clean.slice(headerEnd).replace(/\b(function|task)\b[\s\S]*?\bend(?:function|task)\b/g,x=>x.replace(/[^\r\n]/g,' '));
  for(const hit of body.matchAll(/\b(input|output|inout)\b[^;]*;/g)){
   const start=headerEnd+hit.index,end=start+hit[0].length;
   const found=parseRows(parts(source,start,end-1));groups.push({start,end,rows:found});declRows.push(...found);
  }
 }
 if(declRows.length!==m.ports.length||m.ports.some(p=>!declRows.some(d=>d.name===p.name)))error('找不到全部接腳的實體宣告，請使用「更新 RTL」核對');
 const localBody=clean.slice(headerEnd);const bodyChars=localBody.split('');for(const g of groups)for(let i=g.start-headerEnd;i<g.end-headerEnd;i++)bodyChars[i]=' ';
 const body=bodyChars.join('');
 // Source-link scripts must not silently compile an older external file after GUI edits.
 if((p.companyConfig?.sources||[]).some(l=>l.path&&((l.moduleId&&l.moduleId===m.id)||l.module===m.name)))error('此模組設定了外部 RTL 路徑；先在RTL／工作包的來源設定改用專案內 RTL，即可編輯');
 return {filename,text,span,source,clean,open,close,headerEnd,ansi,groups,declRows,body};
}
function status(p,m,physical){
 if(m.top||m.interfaceOnly)return {reason:'',reserved:[]};
 try{const info=inspect(p,m,physical),ports=new Set(m.ports.map(p=>p.name));return {reason:'',reserved:[...new Set((info.clean.match(/[A-Za-z_][\w$]*/g)||[]).filter(n=>!ports.has(n)))],note:'可新增與修改接腳；同步更新 RTL 宣告，保留內部邏輯。'};}
 catch(e){return {reason:e.message,reserved:[]};}
}
function patch(p,old,next,physical,mayInstantiate){
 const info=inspect(p,old,physical),{source,clean,headerEnd}=info;
 if(old.name!==next.name)error('RTL 模組名稱同時影響其他來源的 instantiation，請使用「更新 RTL」改名');
 if(params(old)!==params(next))error('RTL 參數定義需連同內部使用位置核對，請使用「更新 RTL」修改參數');
 const byId=new Map(next.ports.map(p=>[p.id,p])),oldByName=new Map(old.ports.map(p=>[p.name,p]));
 const added=next.ports.filter(n=>!old.ports.some(p=>p.id===n.id));
 const removed=old.ports.filter(p=>!byId.has(p.id)),renamed=new Map(old.ports.flatMap(p=>{const n=byId.get(p.id);return n&&p.name!==n.name?[[p.name,n.name]]:[];}));
 const changed=old.ports.filter(p=>{const n=byId.get(p.id);return !n||p.name!==n.name||p.direction!==n.direction||compact(p.range)!==compact(n.range)||!!p.signed!==!!n.signed;});
 const reserved=new Set((clean.match(/[A-Za-z_][\w$]*/g)||[]).filter(n=>!oldByName.has(n)));
 for(const n of [...added,...next.ports.filter(n=>old.ports.some(p=>p.id===n.id&&p.name!==n.name))])if(reserved.has(n.name))error(n.name+' 已在 RTL 內部使用，請選擇其他接腳名稱');
 const tokens=[...info.body.matchAll(/[A-Za-z_][\w$]*/g)];
 const references=name=>tokens.filter(t=>t[0]===name&&!/[.$]\s*$/.test(info.body.slice(0,t.index)));
 for(const r of removed)if(references(r.name).length)error(r.name+' 仍被內部邏輯使用；請先使用「更新 RTL」移除相關邏輯，再刪除接腳');
 if(renamed.size&&/\b(function|task|class)\b|`(?:define|include)\b/.test(info.body))error('接腳改名涉及 function、task 或巨集的作用範圍，請使用「更新 RTL」核對引用');
 if(changed.length){
  const outside=info.text.slice(0,info.span.start)+info.text.slice(info.span.end);
  const other=[outside,...(p.rtlSources||[]).filter(f=>f.name!==info.filename).map(f=>f.text),...(p.defineConfig?.includes||[]).map(f=>f.text)];
  if(other.some(s=>mayInstantiate(s,old.name)))error('其他 RTL 內部也實例化了 '+old.name+'；改既有接腳前請使用「更新 RTL」同步修改其引用（仍可直接新增接腳）');
 }
 const comments=raw=>(String(raw).match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g)||[]).map(s=>'  '+s+'\n').join('');
 function declaration(n,entry){
  const previous=entry&&oldByName.get(entry.name);
  const type=(entry?entry.type:'wire').replace(/\b(?:signed|unsigned)\b/g,'').trim();
  if(previous&&previous.direction!==n.direction&&/\b(reg|var)\b/.test(type))error(n.name+' 使用 '+type+'，方向修改需要同時核對內部驅動，請使用「更新 RTL」');
  if(previous&&compact(previous.range)!==compact(n.range)&&new RegExp('\\b(?:reg|wire|logic)\\s+(?:signed\\s+)?(?:\\[[^\\]]+\\]\\s*)?'+previous.name+'\\b').test(info.body))error(n.name+' 在模組內另有型別／位寬宣告，請使用「更新 RTL」一併修改');
  const range=previous&&compact(previous.range)===compact(n.range)?entry.range:n.range;
  return n.direction+' '+(type?type+' ':'')+(n.signed?'signed ':entry?.type.includes('unsigned')?'unsigned ':'')+(range?range+' ':'')+n.name;
 }
 const edits=[];const replace=(start,end,text)=>edits.push({start,end,text});
 if(info.ansi){
  const entries=info.declRows.flatMap(entry=>{const n=byId.get(oldByName.get(entry.name).id);return n?[{n,entry}]:[];}).concat(added.map(n=>({n})));
  // Keep physical port order stable for positional users. GUI visual order is independent.
  const content='\n'+entries.map(({n,entry},i)=>comments(entry?.raw)+'  '+declaration(n,entry)+(i<entries.length-1?',':'')).join('\n')+'\n';
  if(info.open<0)replace(headerEnd-1,headerEnd-1,'('+content+')');else replace(info.open+1,info.close,content);
 }else{
  const existing=parts(source,info.open+1,info.close);const names=existing.flatMap(entry=>{const name=mask(entry.raw).trim(),n=byId.get(oldByName.get(name)?.id);if(!oldByName.has(name))error('舊式 port 表達式尚未支援圖面修改');return n?[comments(entry.raw)+'  '+n.name]:[];}).concat(added.map(n=>'  '+n.name));
  replace(info.open+1,info.close,'\n'+names.join(',\n')+'\n');
  for(const group of info.groups){const text=group.rows.map(entry=>{const n=byId.get(oldByName.get(entry.name).id);return comments(entry.raw)+(n?declaration(n,entry)+';':'');}).filter(Boolean).join('\n  ');replace(group.start,group.end,text);}
  if(added.length)replace(headerEnd,headerEnd,'\n  '+added.map(n=>declaration(n)+';').join('\n  ')+'\n');
 }
 // Rename real identifiers, never comments, strings, hierarchical members or
 // named child-port labels. A named .port(signal) keeps its external port name.
 for(const t of tokens){if(!renamed.has(t[0]))continue;const before=info.body.slice(0,t.index),after=info.body.slice(t.index+t[0].length);
  if(/\.\s*$/.test(before)){if(!/^\s*\(/.test(after))error('接腳使用隱含或階層式 .'+t[0]+' 引用，請使用「更新 RTL」核對');continue;}
  if(/[$`]\s*$/.test(before))error('接腳名稱與巨集或系統識別字相同，請使用「更新 RTL」核對');
  replace(headerEnd+t.index,headerEnd+t.index+t[0].length,renamed.get(t[0]));
 }
 let moduleText=source;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))moduleText=moduleText.slice(0,e.start)+e.text+moduleText.slice(e.end);
 const text=info.text.slice(0,info.span.start)+moduleText+info.text.slice(info.span.end);
 const parsed=parser().parseRtl(text,{config:p.defineConfig,filename:info.filename}),updated=parsed.modules.find(m=>m.name===old.name);
 if(!updated||parsed.issues.some(i=>i.severity==='error')||key(updated)!==key(next))error('更新後的 RTL 宣告與圖面不一致，請使用「更新 RTL」核對');
 return {filename:info.filename,text,module:updated};
}
return {status,patch};
});
