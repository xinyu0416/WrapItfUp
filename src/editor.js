
(()=>{
window.addEventListener('keydown',cancelInlineDragOnEscape,true);
// r128: all canvas text fields use the draft/commit handler below.


const COLORS=["#68778c","#806596","#5d427c","#8c6f4e","#4f6382","#856d96"];

const TEMPLATE_BYTES=192512;
const TEMPLATE_HASH="8447f0e348b6";
const uid=()=>Math.random().toString(36).slice(2,10);
const signal=(name,bits="1",direction="input",groupId=null,formatRuns=[],lineColor="#1d1d1f",textColor="#1d1d1f",comment="",conditionId=null)=>({id:uid(),name,bits,direction,groupId,formatRuns,lineColor,textColor,comment,conditionId});
const group=(name,color)=>({id:uid(),name,color,formatRuns:[]});
const compileCondition=(kind="ifdef",macro="FPGA")=>({id:uid(),kind:kind==="ifndef"?"ifndef":"ifdef",macro:cleanMacroLabel(macro)||"FPGA"});
function defaultLayout(){return {blockX:650,blockY:48,blockWidth:500,blockHeight:420,leftSignalX:530,rightSignalX:1270}}
function fresh(){
  const lp=group("From PM_CPU",COLORS[0]),lr=group("From RX_TM",COLORS[1]),lt=group("TX Packet Sender",COLORS[3]);
  const rg=group("Global Signal",COLORS[0]),rp=group("PCS TX Lanes",COLORS[0]),rt=group("Timestamp",COLORS[1]),ra=group("APB Interface",COLORS[2]);
  return {moduleName:"Ethernet Wrapper",moduleFormatRuns:[],showGrid:false,layout:defaultLayout(),conditions:{left:[],right:[]},groups:{left:[lp,lr,lt],right:[rg,rp,rt,ra]},signals:{left:[signal("MCK_INT_X","1","input",lp.id),signal("TS_MISMATCH_X","1","input",lp.id),signal("LPI_IDLEREQ_X","1","input",lp.id),signal("LPI_IDLEACK_X","1","output",lp.id),signal("PAUSE_X","1","input",lr.id),signal("PFC_X","8","input",lr.id),signal("RDY_X","1","output",lt.id),signal("DATA_X","256","input",lt.id),signal("BCNT_X","5","input",lt.id),signal("TS_ID","80","input",null)],right:[signal("MII_CLK","1","input",rg.id),signal("REG_CLK","1","input",rg.id),signal("TX_RST_X","1","input",rg.id),signal("REG_RST_X","1","input",rg.id),signal("PRESETn_X","1","input",rg.id),signal("TXEN_L0","64","output",rp.id),signal("TXC_L0","8","output",rp.id),signal("TXEN_L1","64","output",rp.id),signal("TXC_L1","8","output",rp.id),signal("HETS_VLD_X","1","output",rt.id),signal("HETS_X","80","input",rt.id),signal("SFD_X","2","input",rt.id),signal("PADDR","16","input",ra.id),signal("PWDATA","32","input",ra.id),signal("PENABLE","1","input",ra.id),signal("PWRITE","1","input",ra.id),signal("PRDATA","32","output",ra.id)]}};
}
let state=fresh()
let side="left",dragId=null,dropInfo=null,pointerDrag=null;
const rowSelection={left:new Set(),right:new Set()},selectionAnchor={left:null,right:null};
let rowClipboard=null,nameFormatTarget=null,activeGroupId={left:null,right:null},activeConditionId={left:null,right:null},colorTarget="line";
const history={undo:[],redo:[],tx:null,applying:false,limit:120};
let previewMetrics={width:1800,height:720},previewContentBounds={x:0,y:20,width:1800,height:680},presentationContentBounds={x:0,y:20,width:1800,height:680},previewView={scale:1,x:0,y:0,fit:true},previewPan=null,blockResize=null,signalRailDrag=null;let presentationOpen=false,presentView={scale:1,x:0,y:0,fit:true},presentPan=null,presentHudTimer=null,ownsPresentationFullscreen=false;
function clampPreviewScale(v){return Math.max(.12,Math.min(6,v))}
function updateZoomReadout(){const z=document.querySelector("#zoomReadout");if(z)z.textContent=`${Math.round(previewView.scale*100)}%`}
function getRowCanvasHeight(){return Math.max(470,125+Math.max(state.signals.left.length,state.signals.right.length)*31)}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function cleanBitsText(v){return String(v??"").replace(/[\r\n\t]+/g," ").trimStart().slice(0,512)}
function isCommentedLabel(v){return /^\s*\/\//.test(String(v??""))}
function stripCommentPrefix(v){return String(v??"").replace(/^\s*\/\/\s?/,"")}
function cleanSignalNameLive(v){const raw=String(v??"").replace(/[\r\n\t]+/g," "),off=isCommentedLabel(raw),body=stripCommentPrefix(raw).replace(/\s+/g,"_");return (off?"//":"")+body}
function cleanMacroLabel(v){const raw=String(v??""),off=isCommentedLabel(raw);let x=stripCommentPrefix(raw).replace(/^\s*`(?:ifdef|ifndef)\s+/i,"").replace(/[\r\n\t ]+/g,"_").replace(/[^A-Za-z0-9_$]/g,"_").replace(/_+/g,"_");if(x&&!/^[A-Za-z_]/.test(x))x="_"+x;x=x.slice(0,48);return (off?"//":"")+x}
function cleanMacroLabelLive(v){const raw=String(v??"");if(/^\s*\/$/.test(raw))return "/";return cleanMacroLabel(raw)}
function cleanMacroName(v){let x=stripCommentPrefix(v).replace(/^\s*`(?:ifdef|ifndef)\s+/i,"").replace(/[\r\n\t ]+/g,"_").replace(/[^A-Za-z0-9_$]/g,"_").replace(/_+/g,"_");if(x&&!/^[A-Za-z_]/.test(x))x="_"+x;return x.slice(0,48)}
function isScalarBits(v){const t=String(v??"").trim().replace(/\s+/g,"");return /^(?:1|1b|b|1bit|1-bit)$/i.test(t)&&!/(?:^|\d)B$/.test(t)}
function isBusBits(v){const t=String(v??"").trim();return t!==""&&!isScalarBits(t)}
function isSpacerSignal(s){return !String(s?.name??"").trim()}
function cleanCommentLive(v){return String(v??"").replace(/[\r\n\t]+/g," ").replace(/^\s*\/\/\s?/,"").slice(0,220)}
function cleanComment(v){return cleanCommentLive(v).trim()}
function commentPreviewText(v,max=38){const s=cleanComment(v);return s.length<=max?s:s.slice(0,Math.max(1,max-1)).trimEnd()+"…"}
function commentDiagramText(v,maxPx){return cleanComment(v)}
function lengthToRange(v){const t=String(v??"").trim();if(!t)return "";const explicit=t.match(/^\[\s*([^:\]]+)\s*:\s*([^\]]+)\s*\]$/);if(explicit)return `[${explicit[1].trim()}:${explicit[2].trim()}]`;if(t==="B")return "[7:0]";if(t==="b")return "";let m=t.match(/^(\d+)\s*B$/);if(m){const n=Number(m[1])*8;return Number.isFinite(n)&&n>1?`[${n-1}:0]`:""}m=t.match(/^(\d+)\s*(?:byte|bytes)$/i);if(m){const n=Number(m[1])*8;return Number.isFinite(n)&&n>1?`[${n-1}:0]`:""}m=t.match(/^(\d+)\s*(?:b|bit|bits|-bit)$/i);if(m){const n=Number(m[1]);return Number.isFinite(n)&&n>1?`[${n-1}:0]`:""}m=t.match(/^(\d+)$/);if(m){const n=Number(m[1]);return Number.isFinite(n)&&n>1?`[${n-1}:0]`:""}try{return window.WIUPortWidths?.rangeFromInput(t)||""}catch{return ""}}

/* RTL_IMPORT_PARSER_BEGIN */
function stripVerilogCommentsForImport(src){
  const s=String(src??"");let out="",i=0,mode="code",quote="",escNext=false;
  while(i<s.length){
    const c=s[i],n=s[i+1]||"";
    if(mode==="line"){if(c==="\n"){out+="\n";mode="code"}else out+=" ";i++;continue}
    if(mode==="block"){if(c==="*"&&n==="/"){out+="  ";i+=2;mode="code";continue}out+=c==="\n"?"\n":" ";i++;continue}
    if(mode==="string"){out+=c;if(escNext){escNext=false;i++;continue}if(c==="\\"){escNext=true;i++;continue}if(c===quote)mode="code";i++;continue}
    if(c==="/"&&n==="/"){out+="  ";i+=2;mode="line";continue}
    if(c==="/"&&n==="*"){out+="  ";i+=2;mode="block";continue}
    if(c==='"'){quote=c;mode="string";out+=c;i++;continue}
    out+=c;i++;
  }
  return out;
}
function rtlImportFindMatchingParen(s,open){
  let depth=0,quote="",escNext=false;
  for(let i=open;i<s.length;i++){const c=s[i];
    if(quote){if(escNext){escNext=false;continue}if(c==="\\"){escNext=true;continue}if(c===quote)quote="";continue}
    if(c==='"'){quote=c;continue}
    if(c==="(")depth++;else if(c===")"){depth--;if(depth===0)return i}
  }
  return -1;
}
function rtlImportMacro(v){let x=String(v??"").trim().replace(/[^A-Za-z0-9_$]/g,"_").replace(/_+/g,"_");if(x&&!/^[A-Za-z_]/.test(x))x="_"+x;return x.slice(0,48)}
function rtlImportRangeToBits(range){
  if(!range)return "1";
  const raw=String(range).trim().replace(/\s+/g," ");
  const m=raw.match(/^\[\s*(-?\d+)\s*:\s*(-?\d+)\s*\]$/);
  if(m){const a=Number(m[1]),b=Number(m[2]);if(Number.isFinite(a)&&Number.isFinite(b)&&b===0&&a>=0)return String(a+1)}
  return raw;
}
function rtlImportSplitNames(rest){
  const out=[];let buf="",sq=0,pa=0,br=0,quote="",escNext=false;
  const push=()=>{const x=buf.trim();buf="";if(x)out.push(x)};
  for(let i=0;i<rest.length;i++){const c=rest[i];
    if(quote){buf+=c;if(escNext){escNext=false;continue}if(c==="\\"){escNext=true;continue}if(c===quote)quote="";continue}
    if(c==='"'){quote=c;buf+=c;continue}
    if(c==="[")sq++;else if(c==="]")sq=Math.max(0,sq-1);else if(c==="(")pa++;else if(c===")")pa=Math.max(0,pa-1);else if(c==="{")br++;else if(c==="}")br=Math.max(0,br-1);
    if(c===","&&sq===0&&pa===0&&br===0)push();else buf+=c;
  }
  push();return out;
}
function rtlImportParseDeclBuffer(buf,condStack,where,warnings,errors){
  const s=String(buf||"").trim().replace(/[;,]\s*$/,"").trim();if(!s)return [];
  const m=s.match(/^(input|output|inout)\b([\s\S]*)$/i);if(!m)return [];
  // r103: preserve the ENTIRE nested branch path; never flatten into one macro.
  const direction=m[1].toLowerCase(),signed=/\bsigned\b/.test(m[2]);let rest=m[2].trim();
  const rangeMatch=rest.match(/\[[^\]\r\n]+\]/),range=rangeMatch?rangeMatch[0]:"",bits=rtlImportRangeToBits(range);
  if(rangeMatch)rest=rest.slice(0,rangeMatch.index)+rest.slice(rangeMatch.index+rangeMatch[0].length);
  rest=rest.replace(/\b(?:wire|reg|logic|tri|tri0|tri1|wand|wor|uwire|signed|unsigned|var|supply0|supply1)\b/gi," ").replace(/\s+/g," ").trim();
  const cond=condStack.length?{kind:condStack[0].opening,macro:condStack[0].openingMacro,
    path:condStack.map(c=>({scope:c.scope,opening:c.opening,openingMacro:c.openingMacro,branch:c.branch,macro:c.macro,ordinal:c.ordinal,branches:(c.branches||[]).map(b=>({...b}))}))}:null,ports=[];
  for(const item of rtlImportSplitNames(rest)){
    let x=item.replace(/=.*$/,"").trim().replace(/[;,)]+$/,"").trim();if(!x)continue;
    const unpacked=/\[[^\]]+\]\s*$/.test(x);if(unpacked){errors.push(`${where}: unpacked array "${x}" is not supported. Import blocked.`);x=x.replace(/\s*\[[^\]]+\]\s*$/,"").trim()}
    const nm=x.match(/([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);if(!nm){warnings.push(`${where}: could not read port fragment "${item.trim()}".`);continue}
    const prefix=x.slice(0,nm.index).trim();
    if(prefix&&!/^(?:wire|reg|logic|tri|signed|unsigned|\s)*$/i.test(prefix))errors.push(`${where}: unsupported port type before "${nm[1]}": "${prefix}".`);
    ports.push({name:nm[1],direction,bits,signed,range:range||"",condition:cond});
  }
  return ports;
}
function rtlImportParseDeclText(text,where){
  const lines=String(text||"").replace(/;/g,";\n").replace(/,\s*(?=(?:input|output|inout)\b)/gi,",\n").split(/\r?\n/),ports=[],warnings=[],errors=[],stack=[];let buf="",bufCond=[],inherited="";
  const flush=()=>{if(!buf.trim())return;ports.push(...rtlImportParseDeclBuffer(buf,bufCond,where,warnings,errors));const m=buf.match(/^(input|output|inout)\b/);if(m){const r=buf.match(/\[[^\]]+\]/);inherited=m[1]+(/\bsigned\b/.test(buf)?" signed":"")+(r?" "+r[0]:"")}buf="";bufCond=[]};
  for(let raw of lines){
    const line=raw.trim();if(!line)continue;
    const d=line.match(/^`(ifdef|ifndef)\s+([A-Za-z_$][A-Za-z0-9_$]*)/i);
    if(d){flush();const opening=d[1].toLowerCase(),macro=rtlImportMacro(d[2]);stack.push({scope:'branch_'+uid(),opening,openingMacro:macro,branch:opening,macro,ordinal:0,hasElse:false,branches:[{ordinal:0,branch:opening,macro}]});continue}
    if(/^`endif\b/i.test(line)){flush();if(stack.length)stack.pop();else errors.push(`${where}: unmatched \`endif.`);continue}
    if(/^`(?:else|elsif)\b/i.test(line)){
      flush();const branch=line.match(/^`(else|elsif)\b(?:\s+([A-Za-z_$][A-Za-z0-9_$]*))?/i);
      if(!stack.length){errors.push(`${where}: unmatched ${line}.`);continue;}
      const top=stack[stack.length-1],kind=branch[1].toLowerCase();
      if(top.hasElse){errors.push(`${where}: ${kind} after else is invalid.`);continue;}
      if(kind==='elsif'&&!branch[2]){errors.push(`${where}: elsif requires a macro.`);continue;}
      top.ordinal++;top.branch=kind;top.macro=kind==='elsif'?rtlImportMacro(branch[2]):'';
      top.branches.push({ordinal:top.ordinal,branch:kind,macro:top.macro});
      if(kind==='else')top.hasElse=true;
      continue;
    }
    if(/^`/.test(line)){flush();if(where.endsWith(" header"))errors.push(`${where}: unsupported directive or macro expansion: ${line}`);continue}
    const dm=line.match(/^(input|output|inout)\b/i);
    if(dm){flush();buf=line;bufCond=stack.map(x=>({...x}));if(/;\s*$/.test(line))flush();continue}
    if(buf){buf+=" "+line;if(/;\s*$/.test(line))flush()}else if(where.endsWith(" header")&&inherited){buf=inherited+" "+line.replace(/^,/,"");bufCond=stack.map(x=>({...x}))}
  }
  flush();if(stack.length)errors.push(`${where}: ${stack.length} unterminated preprocessor condition(s) reached end of module.`);
  return {ports,warnings,errors};
}
function rtlImportHeaderNames(header){
  if(/\b(?:input|output|inout)\b/i.test(header))return [];
  return rtlImportSplitNames(header).map(x=>{const m=x.trim().match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);return m?m[1]:null}).filter(Boolean);
}
function parseVerilogModulesForImport(source){
  const cleaned=stripVerilogCommentsForImport(source),starts=[];let m,re=/\bmodule\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  while((m=re.exec(cleaned)))starts.push({name:m[1],start:m.index,afterName:re.lastIndex});
  const modules=[];
  for(let i=0;i<starts.length;i++){
    const st=starts[i],segEnd=i+1<starts.length?starts[i+1].start:cleaned.length;let p=st.afterName,parameters="";
    while(/\s/.test(cleaned[p]||""))p++;
    if(cleaned[p]==="#"){const po=cleaned.indexOf("(",p);if(po<0||po>=segEnd){modules.push({name:st.name,ports:[],unresolved:[],warnings:[],errors:["Parameter list is incomplete."],conditions:[]});continue}const pc=rtlImportFindMatchingParen(cleaned,po);if(pc<0||pc>=segEnd){modules.push({name:st.name,ports:[],unresolved:[],warnings:[],errors:["Parameter list has no matching ')'."],conditions:[]});continue}parameters=cleaned.slice(po+1,pc).trim();p=pc+1}
    while(/\s/.test(cleaned[p]||""))p++;
    const open=cleaned[p]==="("?p:-1;
    if(open<0||open>=segEnd){modules.push({name:st.name,ports:[],unresolved:[],warnings:[],errors:["Module port list '(' was not found."],conditions:[]});continue}
    const close=rtlImportFindMatchingParen(cleaned,open);
    if(close<0||close>=segEnd){modules.push({name:st.name,ports:[],unresolved:[],warnings:[],errors:["Module port list has no matching ')'."],conditions:[]});continue}
    const header=cleaned.slice(open+1,close),body=cleaned.slice(close+1,segEnd).split(/\bendmodule\b/)[0].replace(/\b(?:function|task)\b[\s\S]*?\bend(?:function|task)\b/g,""),hp=rtlImportParseDeclText(header,`${st.name} header`),bp=/\b(?:input|output|inout)\b/.test(header)?{ports:[],warnings:[],errors:[]}:rtlImportParseDeclText(body,`${st.name} body`);
    const ports=[],seen=new Map(),warnings=[...hp.warnings,...bp.warnings],errors=[...hp.errors,...bp.errors];
    for(const port of [...hp.ports,...bp.ports]){if(seen.has(port.name)){const prev=seen.get(port.name);if(prev.direction!==port.direction||prev.bits!==port.bits||prev.signed!==port.signed)errors.push(`${st.name}: duplicate declaration for ${port.name}; first declaration kept.`);continue}seen.set(port.name,port);ports.push(port)}
    const listed=rtlImportHeaderNames(header),unresolved=listed.filter(n=>!seen.has(n));
    if(unresolved.length)errors.push(`${st.name}: ${unresolved.length} header-only port name(s) have no input/output/inout declaration in the pasted text.`);
    if(!ports.length)errors.push(unresolved.length?`No direction declarations were found. Cannot infer ${unresolved.join(", ")} from names alone.`:"No input/output/inout declarations were found.");
    const condMap=new Map();for(const port of ports)if(port.condition){const k=JSON.stringify(port.condition.path||[port.condition.kind,port.condition.macro]);condMap.set(k,port.condition)}
    if(listed.length)ports.sort((a,b)=>listed.indexOf(a.name)-listed.indexOf(b.name));
    modules.push({name:st.name,parameters,ports,unresolved,warnings:[...new Set(warnings)],errors:[...new Set(errors)],conditions:[...condMap.values()]});
  }
  return modules;
}
/* RTL_IMPORT_PARSER_END */

let rtlImportModules=[],rtlImportTimer=null,rtlImportAnalyzedSource="",rtlImportReturnFocus=null;
function rtlImportSelected(){const sel=$("#rtlImportModule"),idx=Number(sel?.value);return Number.isInteger(idx)&&idx>=0?rtlImportModules[idx]||null:null}
function rtlImportOpen(){finishActiveEditHistory();rtlImportReturnFocus=document.activeElement;const b=$("#rtlImportBackdrop");if(!b)return;b.hidden=false;document.body.style.overflow="hidden";setTimeout(()=>$("#rtlImportSource")?.focus(),0);rtlImportAnalyze()}
function rtlImportClose(){const b=$("#rtlImportBackdrop");if(!b)return;b.hidden=true;document.body.style.overflow="";clearTimeout(rtlImportTimer);rtlImportReturnFocus?.focus?.({preventScroll:true})}
function rtlImportAnalyze(){
  const source=$("#rtlImportSource")?.value||"",previous=$("#rtlImportModule")?.selectedOptions?.[0]?.textContent||"";
  clearTimeout(rtlImportTimer);rtlImportAnalyzedSource=source;rtlImportModules=parseVerilogModulesForImport(source);
  const sel=$("#rtlImportModule");if(!sel)return;
  sel.innerHTML=rtlImportModules.length?rtlImportModules.map((m,i)=>`<option value="${i}">${esc(m.name)} · ${m.ports.length} ports${m.errors.length?" · ⚠":""}<\/option>`).join(""):'<option value="">No module detected<\/option>';
  if(previous){const opt=[...sel.options].find(o=>o.textContent.startsWith(previous.split(" · ")[0]+" ·"));if(opt)sel.value=opt.value}
  rtlImportRenderSelected();
}
function rtlImportRenderSelected(){
  const mod=rtlImportSelected(),summary=$("#rtlImportSummary"),tbody=$("#rtlImportPreview"),apply=$("#rtlImportApply");if(!summary||!tbody||!apply)return;
  if(!mod){summary.innerHTML='<div class="rtl-import-empty">No Verilog module detected yet.<\/div>';tbody.innerHTML="";apply.disabled=true;return}
  const counts={input:0,output:0,inout:0};mod.ports.forEach(p=>counts[p.direction]++);
  const messages=[];
  if(mod.errors.length)messages.push(`<div class="rtl-import-message error">${mod.errors.map(esc).join("<br>")}<\/div>`);
  if(mod.warnings.length)messages.push(`<div class="rtl-import-message warn">${mod.warnings.map(esc).join("<br>")}<\/div>`);
  if(!mod.errors.length&&!mod.unresolved.length)messages.push(`<div class="rtl-import-message ok">Ready · comments are ignored · Module Name and port widths will be imported automatically.<\/div>`);
  summary.innerHTML=`<div class="rtl-import-module-name">module ${esc(mod.name)}<\/div><div class="rtl-import-stats"><span class="rtl-import-stat input">${counts.input} INPUT<\/span><span class="rtl-import-stat output">${counts.output} OUTPUT<\/span><span class="rtl-import-stat inout">${counts.inout} INOUT<\/span><span class="rtl-import-stat cond">${mod.conditions.length} CONDITION<\/span>${mod.unresolved.length?`<span class="rtl-import-stat">${mod.unresolved.length} UNRESOLVED<\/span>`:""}<\/div>${messages.join("")}`;
  tbody.innerHTML=mod.ports.map(p=>`<tr><td><span class="pdir ${p.direction}">${p.direction}<\/span><\/td><td>${esc(p.bits)}<\/td><td title="${esc(p.name)}">${esc(p.name)}<\/td><td class="pcond">${p.condition?esc(conditionDirectiveText(p.condition)):""}<\/td><\/tr>`).join("");
  apply.disabled=!!mod.errors.length||!!mod.unresolved.length||!mod.ports.length;
}
function rtlImportApplySelected(){
  if(rtlImportAnalyzedSource!==$("#rtlImportSource").value)rtlImportAnalyze();
  const mod=rtlImportSelected();if(!mod||mod.errors.length||mod.unresolved.length||!mod.ports.length)return;
  finishActiveEditHistory();
  const inoutSide=$("#rtlImportInoutSide")?.value==="left"?"left":"right",before=snapshotState();
  const next={moduleName:mod.name,parameters:mod.parameters||"",moduleFormatRuns:[],showGrid:false,layout:defaultLayout(),rtlOrder:[],conditions:{left:[],right:[]},groups:{left:[],right:[]},signals:{left:[],right:[]}};
  const condCache={left:new Map(),right:new Map()},condId=(which,c)=>{
    if(!c)return null;const key=JSON.stringify(c.path||[c.kind,c.macro]);
    if(condCache[which].has(key))return condCache[which].get(key);
    const obj=compileCondition(c.kind,c.macro);
    if(c.path)obj.path=c.path.map(step=>({...step}));
    next.conditions[which].push(obj);condCache[which].set(key,obj.id);return obj.id;
  };
  for(const p of mod.ports){const which=p.direction==="input"?"left":p.direction==="output"?"right":inoutSide,id=condId(which,p.condition),s=signal(p.name,p.bits,p.direction,null,[],"#1d1d1f","#1d1d1f","",id);s.signed=!!p.signed;next.signals[which].push(s);next.rtlOrder.push(s.id)}
  state=next;ensureLayoutState();side="left";activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};clearAllSelections();nameFormatTarget=null;previewView.fit=true;commitHistorySnapshot(before);render();rtlImportClose();requestAnimationFrame(()=>fitPreview());
  const c={input:0,output:0,inout:0};mod.ports.forEach(p=>c[p.direction]++);toast(`Imported ${mod.name} · ${c.input} input · ${c.output} output · ${c.inout} inout`);
}

function rtlDirection(d){return d==="inout"?"inout":d==="output"?"output":"input"}
function svIdentifier(value,fallback="rtl_template"){let s=stripCommentPrefix(value).trim().replace(/\s+/g,"_").replace(/[^A-Za-z0-9_$]/g,"_").replace(/_+/g,"_");if(!s)s=fallback;if(!/^[A-Za-z_]/.test(s))s=`m_${s}`;return s}
function rtlModuleName(){return svIdentifier(state.moduleName||"rtl_template")}
function rtlPortCore(sig){const range=lengthToRange(sig.bits),dir=rtlDirection(sig.direction),name=svIdentifier(sig.name,"unnamed_port");return `${dir}${sig.signed?" signed":""}${range?` ${range}`:""} ${name}`}
function rtlPortText(sig,isLast=false){const c=cleanComment(sig.comment),decl=`  ${rtlPortCore(sig)}${isLast?"":","}`;return c?`${decl} // ${c}`:decl}
function rtlPortConditionalText(sig,commaMode="anchor"){const c=cleanComment(sig.comment),core=rtlPortCore(sig),decl=commaMode==="trailing"?`  ${core},`:commaMode==="leading"?`  , ${core}`:`  ${core}`;return c?`${decl} // ${c}`:decl}
function rtlCommentedPortText(sig){const c=cleanComment(sig.comment),decl=`// ${rtlPortCore(sig)}`;return c?`${decl}  // ${c}`:decl}
function rtlGroupComment(g){const off=isCommentedLabel(g?.name),name=stripCommentPrefix(g?.name||"Interface").trim()||"Interface";return off?`//===== ${name} =====//  // COMMENTED OUT`:`//===== ${name} =====//`}
function conditionById(which,id){return state.conditions?.[which]?.find(c=>c.id===id)||null}
function conditionDirectiveText(c){
 if(!c)return '';
 if(Array.isArray(c.path)&&c.path.length){return c.path.map(p=>'`'+p.branch+(p.branch==='else'?'':' '+(cleanMacroName(p.branch==='elsif'?p.macro:p.openingMacro)||'FPGA'))).join(' / ');}
 return `\`${c.kind==="ifndef"?"ifndef":"ifdef"} ${cleanMacroName(c.macro)||"FPGA"}`;
}
function conditionText(c){if(!c)return "";return `${isCommentedLabel(c.macro)?"// ":""}${conditionDirectiveText(c)}`}
function groupIsCommented(which,id){return groupAncestors(which,id).some(g=>isCommentedLabel(g.name))}
function conditionIsCommented(which,id){const c=conditionById(which,id);return !!c&&isCommentedLabel(c.macro)}
function signalIsCommented(which,sig){return isCommentedLabel(sig?.name)||groupIsCommented(which,sig?.groupId)||conditionIsCommented(which,sig?.conditionId)}
function allRtlSignalRefs(){const out=[];for(const which of ["left","right"])for(const sig of state.signals[which])if(!isSpacerSignal(sig))out.push({id:sig.id,which,sig});return out}
function reconcileRtlOrder(){const refs=allRtlSignalRefs(),valid=new Set(refs.map(x=>x.id)),seen=new Set(),next=[];for(const id of Array.isArray(state.rtlOrder)?state.rtlOrder:[]){const key=String(id||"");if(valid.has(key)&&!seen.has(key)){seen.add(key);next.push(key)}}for(const x of refs)if(!seen.has(x.id)){seen.add(x.id);next.push(x.id)}state.rtlOrder=next;return next}
function orderedRtlRefs(){const refs=allRtlSignalRefs(),map=new Map(refs.map(x=>[x.id,x]));return reconcileRtlOrder().map(id=>map.get(id)).filter(Boolean)}
function activeConditionForRef(ref){const c=conditionById(ref.which,ref.sig.conditionId);return c&&!isCommentedLabel(c.macro)?c:null}
function activeRtlRefs(){return orderedRtlRefs().filter(ref=>!signalIsCommented(ref.which,ref.sig))}
function rtlConditionAudit(){const refs=activeRtlRefs();const names=new Map();for(const r of refs){const name=svIdentifier(r.sig.name,"unnamed_port"),bits=String(r.sig.bits||"").trim();if(names.has(name))return {ok:false,hasConditions:false,anchorIndex:-1,message:`Duplicate active RTL port: ${name}. Rename or comment out one port.`};names.set(name,true);if(bits&&!isScalarBits(bits)&&!lengthToRange(bits))return {ok:false,hasConditions:false,anchorIndex:-1,message:`Invalid width for ${name}: ${bits}. Use 1, 8, 8B or [WIDTH-1:0].`}}const conditional=refs.filter(activeConditionForRef);if(!conditional.length)return {ok:true,hasConditions:false,anchorIndex:refs.length?refs.length-1:-1,message:""};for(const r of conditional){const c=activeConditionForRef(r);if(!cleanMacroName(c?.macro))return {ok:false,hasConditions:true,anchorIndex:-1,message:"IFDEF/IFNDEF macro name is empty."}}let anchorIndex=-1;for(let i=refs.length-1;i>=0;i--){if(!activeConditionForRef(refs[i])){anchorIndex=i;break}}if(anchorIndex<0)return {ok:false,hasConditions:true,anchorIndex:-1,message:"ANSI Verilog needs at least one active unconditional port when active IFDEF/IFNDEF ports are used. Commented-out ports do not count."};return {ok:true,hasConditions:true,anchorIndex,message:""}}
function buildRtlLines(){
 const refs=orderedRtlRefs(),activeRefs=activeRtlRefs(),audit=rtlConditionAudit(),out=[],seenGroups=new Set(),activeIndex=new Map(activeRefs.map((r,i)=>[r.id,i]));
 let active=[],commentedCond=null;
 const cPath=c=>c?(Array.isArray(c.path)&&c.path.length?c.path:[{scope:c.id,opening:c.kind,openingMacro:c.macro,branch:c.kind,macro:c.macro,ordinal:0}]):[];
 const closeTo=(depth)=>{while(active.length>depth){out.push({type:'directive',close:true,text:'`endif',condition:active.at(-1)});active.pop()}};
 const closeCommented=()=>{if(commentedCond){out.push({type:'directive',commented:true,close:true,text:'// `endif',condition:commentedCond});commentedCond=null}};
 const directive=p=>'`'+p.branch+(p.branch==='else'?'':' '+(cleanMacroName(p.branch==='elsif'?p.macro:p.openingMacro)||'FPGA'));
 const switchPath=(next)=>{
   let common=0;
   while(common<active.length&&common<next.length&&active[common].scope===next[common].scope&&active[common].ordinal===next[common].ordinal)common++;
   if(common<active.length&&common<next.length&&active[common].scope===next[common].scope&&next[common].ordinal>active[common].ordinal){
     // Switch branch within the SAME `ifdef without closing its frame.
     closeTo(common+1);
     const newBranch=next[common];
     const skipped=(newBranch.branches||[]).filter(b=>b.ordinal>active[common].ordinal&&b.ordinal<=newBranch.ordinal);
     if(skipped.length)for(const b of skipped)out.push({type:'directive',text:directive({...newBranch,branch:b.branch,macro:b.macro}),branch:true,condition:newBranch});
     else out.push({type:'directive',text:directive(newBranch),branch:true,condition:newBranch});
     active[common]=newBranch;common++;
   }else closeTo(common);
   for(let j=common;j<next.length;j++){
     const p=next[j];
     if(['elsif','else'].includes(p.branch)){
       // The source may have no ports in its first branch; retain opener.
       out.push({type:'directive',text:'`'+p.opening+' '+(cleanMacroName(p.openingMacro)||'FPGA'),open:true,condition:p});
       const skipped=(p.branches||[]).filter(b=>b.ordinal>0&&b.ordinal<=p.ordinal);
       if(skipped.length)for(const b of skipped)out.push({type:'directive',text:directive({...p,branch:b.branch,macro:b.macro}),branch:true,condition:p});
       else out.push({type:'directive',text:directive(p),branch:true,condition:p});
     }else out.push({type:'directive',text:directive(p),open:true,condition:p});
     active.push(p);
   }
 };
 for(const ref of refs){
   const {which,sig}=ref,g=groupById(which,sig.groupId),gkey=g?`${which}:${g.id}`:'',c=conditionById(which,sig.conditionId);
   const groupOff=!!g&&isCommentedLabel(g.name),condOff=!!c&&(isCommentedLabel(c.macro)||groupOff),disabled=signalIsCommented(which,sig);
   if(g&&gkey&&!seenGroups.has(gkey)){closeTo(0);closeCommented();seenGroups.add(gkey);out.push({type:'group',text:rtlGroupComment(g),color:g.color,which,group:g,groupKey:gkey,commented:isCommentedLabel(g.name)})}
   if(condOff){closeTo(0);if(commentedCond?.id!==c.id){closeCommented();commentedCond=c;out.push({type:'directive',commented:true,open:true,text:'// '+conditionDirectiveText(c),condition:c})}out.push({type:'decl',sig,which,id:sig.id,commented:true});continue}
   closeCommented();switchPath(cPath(c));
   if(disabled){out.push({type:'decl',sig,which,id:sig.id,commented:true});continue}
   const portIndex=activeIndex.get(sig.id)??-1,commaMode=audit.hasConditions?(portIndex<audit.anchorIndex?'trailing':portIndex===audit.anchorIndex?'anchor':'leading'):'normal';
   out.push({type:'decl',sig,which,id:sig.id,commaMode,conditionalStyle:audit.hasConditions});
 }
 closeTo(0);closeCommented();return out;
}
function rtlPortHtml(sig,isLast=false){const range=lengthToRange(sig.bits),c=cleanComment(sig.comment),dir=rtlDirection(sig.direction),name=esc(svIdentifier(sig.name,"unnamed_port"));return `<span class="rtl-dir">${dir}<\/span>${sig.signed?" signed":""}${range?` <span class="rtl-range">${esc(range)}<\/span>`:""} ${name}<span class="rtl-port-comma">${isLast?"":","}<\/span>${c?` <span class="rtl-comment">// ${esc(c)}<\/span>`:""}`}
function rtlPortConditionalHtml(sig,commaMode="anchor"){const range=lengthToRange(sig.bits),c=cleanComment(sig.comment),dir=rtlDirection(sig.direction),name=esc(svIdentifier(sig.name,"unnamed_port")),lead=commaMode==="leading"?'<span class="rtl-leading-comma">, <\/span>':"",tail=commaMode==="trailing"?'<span class="rtl-port-comma">,<\/span>':"";return `${lead}<span class="rtl-dir">${dir}<\/span>${sig.signed?" signed":""}${range?` <span class="rtl-range">${esc(range)}<\/span>`:""} ${name}${tail}${c?` <span class="rtl-comment">// ${esc(c)}<\/span>`:""}`}
function rtlCommentedPortHtml(sig){return `<span class="rtl-disabled">${esc(rtlCommentedPortText(sig))}<\/span>`}
// r101: fold comment Groups in the RTL preview without touching RTL source/order.
const rtlFoldedGroupsR101=new Set();
function rtlFoldKeyR101(groupKey){return rtlModuleName()+"::"+groupKey}
function rtlGroupFoldedR101(groupKey){return !!groupKey&&rtlFoldedGroupsR101.has(rtlFoldKeyR101(groupKey))}
function rtlFoldedDirectivesR101(lines){
 const stack=[],hidden=new Set();
 for(let i=0;i<lines.length;i++){
  const x=lines[i];if(x.type!=="directive")continue;
  if(x.open){stack.push(i);continue}
  if(x.close){const from=stack.pop();if(from===undefined)continue;
   const decl=lines.slice(from+1,i).filter(y=>y.type==="decl");
   if(decl.length&&decl.every(d=>rtlGroupFoldedR101(rtlRefGroupKey({which:d.which,sig:d.sig})))){
    hidden.add(from);hidden.add(i);
   }
  }
 }
 return hidden;
}
function renderRtlDeclarations(){
 const body=$("#rtlRows");if(!body)return;
 const audit=rtlConditionAudit(),lines=buildRtlLines();
 const activeDecls=lines.filter(x=>x.type==="decl"&&!x.commented),lastId=activeDecls.length?activeDecls.at(-1).id:null;
 const moduleName=esc(rtlModuleName());
 const rows=[`<tr class="rtl-module-row"><td class="rtl-grip-cell"></td><td><span class="rtl-keyword">module</span> <span class="rtl-module-name">${moduleName}</span>${state.parameters?" #( "+esc(state.parameters)+" )":""} (</td></tr>`];
 if(!audit.ok)rows.push(`<tr class="rtl-warning"><td class="rtl-grip-cell">⚠</td><td>${esc(audit.message)}</td></tr>`);
 const hideDirective=rtlFoldedDirectivesR101(lines);
 for(let i=0;i<lines.length;i++){
  const x=lines[i];
  if(x.type==="group"){
   const collapsed=rtlGroupFoldedR101(x.groupKey),n=rtlGroupMemberIds(x.groupKey).length;
   rows.push(`<tr class="rtl-group ${x.commented?"rtl-commented-row":""} ${collapsed?"rtl-group-folded":""}" data-rtl-group-key="${esc(x.groupKey)}"><td class="rtl-grip-cell"><button type="button" class="rtl-group-drag" data-rtl-group-drag="${esc(x.groupKey)}" title="整組移動 RTL 宣告；折疊不改變輸出順序">↕</button></td><td title="${esc(x.text)}"><button type="button" class="rtl-group-fold-toggle" data-rtl-group-toggle="${esc(x.groupKey)}" aria-expanded="${!collapsed}" title="${collapsed?'展開':'收合'} ${esc(x.group.name)} 的 RTL 宣告">${collapsed?'▸':'▾'}</button><span class="rtl-group-comment">${esc(x.text)}</span><span class="rtl-group-hint">${collapsed?`已收合 · ${n} ports`:'整組可拖曳'}</span></td></tr>`);
  }else if(x.type==="directive"){
   if(hideDirective.has(i))continue;
   rows.push(`<tr class="rtl-directive ${x.commented?"rtl-commented-row":""}"><td class="rtl-grip-cell"></td><td><span class="rtl-cond">${esc(x.text)}</span></td></tr>`);
  }else{
   const groupKey=rtlRefGroupKey({which:x.which,sig:x.sig});
   if(rtlGroupFoldedR101(groupKey))continue;
   const shown=x.commented?rtlCommentedPortText(x.sig):x.conditionalStyle?rtlPortConditionalText(x.sig,x.commaMode):rtlPortText(x.sig,x.id===lastId),
    html=x.commented?rtlCommentedPortHtml(x.sig):x.conditionalStyle?rtlPortConditionalHtml(x.sig,x.commaMode):rtlPortHtml(x.sig,x.id===lastId);
   rows.push(`<tr class="${x.commented?"rtl-commented-row":""}" data-rtl-id="${esc(x.id)}" data-rtl-side="${x.which}" data-rtl-member-of="${esc(groupKey)}"><td class="rtl-grip-cell"><button type="button" class="rtl-drag" data-rtl-drag="${esc(x.id)}" title="Drag this declaration only">↕</button></td><td title="${esc(shown.trim())}">${html}</td></tr>`);
  }
 }
 rows.push(`<tr class="rtl-module-end"><td class="rtl-grip-cell"></td><td>);</td></tr>`);
 body.innerHTML=rows.join("");
 $("#rtlCopy").disabled=!audit.ok;$("#rtlCopy").title=audit.ok?"Copy Verilog declaration":audit.message;
}
function rtlText(){const audit=rtlConditionAudit(),lines=buildRtlLines(),activeDecls=lines.filter(x=>x.type==="decl"&&!x.commented),lastId=activeDecls.length?activeDecls.at(-1)?.id:null,out=["// Verilog-2001 ANSI · // at the start of Signal / Group / IFDEF name comments it out",`module ${rtlModuleName()}${state.parameters?" #( "+state.parameters+" )":""} (`,""];if(!audit.ok)out.push(`// ERROR: ${audit.message}`);for(const x of lines){if(x.type==="group"){if(out.at(-1)!=="")out.push("");out.push(x.text)}else if(x.type==="directive")out.push(x.text);else if(x.commented)out.push(rtlCommentedPortText(x.sig));else out.push(x.conditionalStyle?rtlPortConditionalText(x.sig,x.commaMode):rtlPortText(x.sig,x.id===lastId))}out.push(");");return out.join("\r\n")}
async function copyRtlText(){const audit=rtlConditionAudit();if(!audit.ok){toast(audit.message);return}const value=rtlText();try{await navigator.clipboard.writeText(value);toast(audit.hasConditions?"RTL copied · IFDEF commas are ANSI-safe":"RTL declaration copied")}catch{const ta=document.createElement("textarea");ta.value=value;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("RTL declaration copied")}catch{toast("Copy failed")}ta.remove()}}
function colorValue(v,fallback){const s=String(v||"").trim();return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():fallback}
function lineColorOf(s){return colorValue(s?.lineColor,"#1d1d1f")}
function textColorOf(s){return colorValue(s?.textColor,"#1d1d1f")}
function normalizeFormatRuns(runs,len){if(!Array.isArray(runs)||!len)return [];const out=[];for(const r of runs){let a=Math.max(0,Math.min(len,Math.floor(+r?.start||0))),b=Math.max(0,Math.min(len,Math.floor(+r?.end||0))),style=Math.max(0,Math.min(3,Math.floor(+r?.style||0)));if(b<a)[a,b]=[b,a];if(style&&b>a)out.push({start:a,end:b,style})}return out}
function formatMask(sig){const n=String(sig?.name??"").length,m=Array(n).fill(0);for(const r of normalizeFormatRuns(sig?.formatRuns,n))for(let i=r.start;i<r.end;i++)m[i]|=r.style;return m}
function maskToRuns(mask){const out=[];for(let i=0;i<mask.length;){const style=mask[i];let j=i+1;while(j<mask.length&&mask[j]===style)j++;if(style)out.push({start:i,end:j,style});i=j}return out}
function formatState(sig,flag){const m=formatMask(sig);if(!m.length)return "off";const n=m.filter(v=>v&flag).length;return n===0?"off":n===m.length?"on":"mixed"}
function toggleNameFormat(sig,flag,start,end){const name=String(sig?.name??"");if(!name)return;let a=Math.max(0,Math.min(name.length,+start||0)),b=Math.max(0,Math.min(name.length,+end||0));if(b<a)[a,b]=[b,a];if(a===b){a=0;b=name.length}const m=formatMask(sig),all=true;let remove=true;for(let i=a;i<b;i++)if(!(m[i]&flag)){remove=false;break}for(let i=a;i<b;i++)m[i]=remove?(m[i]&~flag):(m[i]|flag);sig.formatRuns=maskToRuns(m)}
function styledNameSvg(sig){const name=String(sig?.name??"");if(!name)return "";const m=formatMask(sig);let out="",i=0;while(i<name.length){const st=m[i],a=i;while(i<name.length&&m[i]===st)i++;const attrs=`${st&1?' font-weight="800"':''}${st&2?' font-style="italic"':''}`;out+=`<tspan${attrs}>${esc(name.slice(a,i))}<\/tspan>`}return out}
function styledNameHtml(sig){const name=String(sig?.name??"");if(!name)return "";const m=formatMask(sig);let out="",i=0;while(i<name.length){const st=m[i],a=i;while(i<name.length&&m[i]===st)i++;const cls=st===3?'bi':st===1?'b':st===2?'i':'';const txt=esc(name.slice(a,i));out+=st===3?`<span class="bi">${txt}<\/span>`:st===1?`<b>${txt}<\/b>`:st===2?`<i>${txt}<\/i>`:`<span>${txt}<\/span>`}return out}
function moduleFormatObject(){return {name:String(state.moduleName||""),formatRuns:normalizeFormatRuns(state.moduleFormatRuns,String(state.moduleName||"").length)}}
function styledTextSvgRange(obj,start,end){const name=String(obj?.name??""),m=formatMask(obj);let out="",i=Math.max(0,start|0),stop=Math.min(name.length,end==null?name.length:end|0);while(i<stop){const st=m[i]||0,a=i;while(i<stop&&(m[i]||0)===st)i++;out+=`<tspan${st&1?' font-weight="850"':''}${st&2?' font-style="italic"':''}>${esc(name.slice(a,i))}<\/tspan>`}return out}
function formatObjectForTarget(target){if(!target)return null;if(target.kind==="module")return moduleFormatObject();if(target.kind==="group")return groupById(target.side,target.id);return state.signals[target.side]?.find(r=>r.id===target.id)||null}
function commitFormatObject(target,obj){if(target?.kind==="module")state.moduleFormatRuns=normalizeFormatRuns(obj?.formatRuns,String(state.moduleName||"").length)}
function findFormatInput(target){if(!target)return null;if(target.kind==="module")return $("[data-inline-module]");if(target.kind==="group")return $(`.inline-group-label[data-side="${target.side}"][data-inline-group="${target.id}"] input[data-inline-group-name]`);return findNameInput(target.side,target.id)}
function formatRangeState(sig,flag,start=0,end=null){const m=formatMask(sig),n=m.length;if(!n)return "off";let a=Math.max(0,Math.min(n,+start||0)),b=end==null?n:Math.max(0,Math.min(n,+end||0));if(b<a)[a,b]=[b,a];if(a===b){a=0;b=n}let hit=0;for(let i=a;i<b;i++)if(m[i]&flag)hit++;return hit===0?"off":hit===b-a?"on":"mixed"}
function rememberNameSelection(input){if(!input)return;let target=null;if(input.matches?.('#rows input[data-act="name"],.signal-card input[data-act="name"]')){const card=input.closest(".signal-card"),tr=input.closest("tr"),which=card?.dataset.side||side,id=card?.dataset.id||tr?.dataset.id||null;target={kind:"signal",side:which,id,start:input.selectionStart??0,end:input.selectionEnd??0};side=which}else if(input.matches?.("[data-inline-group-name]")){const wrap=input.closest(".inline-group-label"),which=wrap?.dataset.side,id=wrap?.dataset.inlineGroup;if(which&&id){target={kind:"group",side:which,id,start:input.selectionStart??0,end:input.selectionEnd??0};side=which;activeGroupId[which]=id}}else if(input.matches?.("[data-inline-module]"))target={kind:"module",start:input.selectionStart??0,end:input.selectionEnd??0};if(!target)return;nameFormatTarget=target;updateFormatToolbar()}
function selectedRowsAll(){const out=[];for(const which of ["left","right"])for(const r of state.signals[which])if(rowSelection[which].has(r.id))out.push({which,sig:r});return out}function selectedSideContext(){const hits=selectedRowsAll(),sides=[...new Set(hits.map(x=>x.which))];return {hits,sides,which:sides.length===1?sides[0]:null}}function updateDirectionAssignToolbar(){const sel=$("#directionAssignSelect");if(!sel)return;const hits=selectedRowsAll();if(!hits.length){sel.disabled=true;sel.innerHTML='<option value="">select<\/option>';return}const dirs=[...new Set(hits.map(x=>x.sig.direction||"input"))],mixed=dirs.length>1;sel.disabled=false;sel.innerHTML=`${mixed?'<option value="__mixed__">— mixed —<\/option>':''}<option value="input">IN<\/option><option value="output">OUT<\/option><option value="inout">I/O ↔<\/option>`;sel.value=mixed?"__mixed__":dirs[0]}function assignSelectedDirection(value){if(!["input","output","inout"].includes(value))return false;const hits=selectedRowsAll();if(!hits.length)return false;withHistory(()=>{for(const x of hits)x.sig.direction=value});render();toast(`${hits.length} signal${hits.length===1?"":"s"} → ${directionLabel(value)}`);return true}function updateGroupAssignToolbar(){const tool=$("#groupAssignTool"),sel=$("#groupAssignSelect");if(!tool||!sel)return;const {hits,sides,which}=selectedSideContext();tool.classList.remove("mixed");if(!hits.length){sel.disabled=true;sel.innerHTML='<option value="">select signal<\/option>';return}if(!which){sel.disabled=true;tool.classList.add("mixed");sel.innerHTML='<option value="">mixed sides<\/option>';return}const gids=[...new Set(hits.map(x=>x.sig.groupId||""))],groups=state.groups[which],mixed=gids.length>1;sel.disabled=false;sel.innerHTML=`${mixed?'<option value="__mixed__">— mixed —<\/option>':''}<option value="">No group<\/option>${groups.map(g=>`<option value="${g.id}">${esc(g.name)}<\/option>`).join("")}<option value="__new__">+ New group…<\/option>`;if(mixed){tool.classList.add("mixed");sel.value="__mixed__"}else sel.value=gids[0]||"";sel.title=`${which.toUpperCase()} · ${hits.length} selected`}
function assignSelectedGroup(value){const {hits,which}=selectedSideContext();if(!hits.length||!which)return false;if(value==="__mixed__")return false;let gid=value||null,label="No group";withHistory(()=>{if(value==="__new__"){const g=group(`Group ${state.groups[which].length+1}`,COLORS[state.groups[which].length%COLORS.length]);state.groups[which].push(g);gid=g.id;label=g.name}else if(gid){label=groupById(which,gid)?.name||"Group"}for(const x of hits)x.sig.groupId=gid});activeGroupId[which]=gid;side=which;render();toast(`${hits.length} signal${hits.length===1?"":"s"} → ${label}`);return true}function nextConditionMacro(sides,base="FPGA"){let n=base,i=2;const used=new Set(sides.flatMap(w=>(state.conditions?.[w]||[]).map(c=>cleanMacroName(c.macro))));while(used.has(n)){n=`${base}_${i++}`}return n}
function updateConditionAssignToolbar(){const tool=$("#conditionAssignTool"),sel=$("#conditionAssignSelect");if(!tool||!sel)return;const {hits,sides,which}=selectedSideContext();tool.classList.remove("mixed");if(!hits.length){sel.disabled=true;sel.innerHTML='<option value="">select signal<\/option>';return}if(!which){sel.disabled=false;tool.classList.add("mixed");sel.innerHTML='<option value="__mixed__">— mixed sides —<\/option><option value="">No IFDEF<\/option><option value="__new_ifdef__">+ `ifdef on both…<\/option><option value="__new_ifndef__">+ `ifndef on both…<\/option>';sel.value="__mixed__";return}const ids=[...new Set(hits.map(x=>x.sig.conditionId||""))],conds=state.conditions?.[which]||[],mixed=ids.length>1;sel.disabled=false;sel.innerHTML=`${mixed?'<option value="__mixed__">— mixed —<\/option>':''}<option value="">No IFDEF<\/option>${conds.map(c=>`<option value="${c.id}">${esc(conditionText(c))}<\/option>`).join("")}<option value="__new_ifdef__">+ \`ifdef…<\/option><option value="__new_ifndef__">+ \`ifndef…<\/option>`;sel.value=mixed?"__mixed__":ids[0]||"";sel.title=`${which.toUpperCase()} · ${hits.length} selected`}
function focusConditionMacro(which,id){requestAnimationFrame(()=>{const n=$(`.inline-condition-label[data-side="${which}"][data-inline-condition="${id}"] input[data-condition-macro]`);n?.focus({preventScroll:true});try{n?.select()}catch{}})}
function syncInlineCommentedState(){
  for(const which of ["left","right"]){
    for(const sig of state.signals[which]){const off=signalIsCommented(which,sig),card=$(`.signal-card[data-side="${which}"][data-id="${sig.id}"]`),bit=$(`.line-length-editor[data-side="${which}"][data-id="${sig.id}"]`),note=$(`.signal-comment-editor[data-side="${which}"][data-id="${sig.id}"]`);card?.classList.toggle("commented-label",off);const rich=card?.querySelector(".name-rich");if(rich)rich.style.color=off?"#8c939a":textColorOf(sig);if(bit)bit.style.color=off?"#8c939a":textColorOf(sig);note?.classList.toggle("commented-label",off)}
    for(const g of state.groups[which]){const off=isCommentedLabel(g.name),lab=$(`.inline-group-label[data-side="${which}"][data-inline-group="${g.id}"]`),chip=$(`[data-group-select="${g.id}"]`);lab?.classList.toggle("commented-label",off);lab?.previousElementSibling?.classList?.toggle("commented-label",off);chip?.classList.toggle("commented-label",off);const dot=chip?.querySelector(".group-dot");if(dot)dot.style.background=off?"#9aa0a6":g.color}
    for(const c of state.conditions[which]){const off=isCommentedLabel(c.macro),lab=$(`.inline-condition-label[data-side="${which}"][data-inline-condition="${c.id}"]`);lab?.classList.toggle("commented-label",off);lab?.previousElementSibling?.classList?.toggle("commented-label",off)}
  }
}

function createConditionForSelected(kind="ifdef"){if(window.WIUProjectHost?.isDiagramActive()&&window.WIUProjectHost.requestConditionEdit()===false)return false;const hits=selectedRowsAll();if(!hits.length){toast("Select signal(s) first, then + IFDEF / IFNDEF");return false}const sides=[...new Set(hits.map(x=>x.which))],macro=nextConditionMacro(sides,"FPGA"),created={};withHistory(()=>{for(const which of sides){const c=compileCondition(kind,macro);state.conditions[which].push(c);created[which]=c;for(const x of hits)if(x.which===which)x.sig.conditionId=c.id;activeConditionId[which]=c.id}});render();const first=sides[0];focusConditionMacro(first,created[first].id);toast(`${hits.length} signal${hits.length===1?"":"s"} → \`${kind} ${macro}`);return true}
function assignSelectedCondition(value){const {hits,sides,which}=selectedSideContext();if(!hits.length)return false;if(value==="__mixed__")return false;if(value==="__new_ifdef__"||value==="__new_ifndef__")return createConditionForSelected(value==="__new_ifndef__"?"ifndef":"ifdef");withHistory(()=>{for(const x of hits)x.sig.conditionId=value&&which?value:null});if(which)activeConditionId[which]=value||null;render();toast(`${hits.length} signal${hits.length===1?"":"s"} → ${value&&which?conditionText(conditionById(which,value)):"No IFDEF"}`);return true}function findNameInput(which,id){return $(`.signal-card[data-side="${which}"][data-id="${id}"] input[data-act="name"]`)||$(`#rows tr[data-id="${id}"] input[data-act="name"]`)}function toolbarFormatState(flag){if(nameFormatTarget){const obj=formatObjectForTarget(nameFormatTarget);if(obj)return formatRangeState(obj,flag,nameFormatTarget.start,nameFormatTarget.end)}const rows=selectedRowsAll().map(x=>x.sig);if(!rows.length)return "off";const states=rows.map(r=>formatRangeState(r,flag,0,String(r.name||"").length));return states.every(x=>x==="on")?"on":states.every(x=>x==="off")?"off":"mixed"}
function updateFormatToolbar(){for(const [id,flag] of [["#boldBtn",1],["#italicBtn",2]]){const b=$(id);if(!b)continue;b.classList.remove("on","mixed");const st=toolbarFormatState(flag);if(st!=="off")b.classList.add(st)}}
function applyToolbarFormat(flag){let targets=[],restore=null,activeObj=null;if(nameFormatTarget){activeObj=formatObjectForTarget(nameFormatTarget);if(activeObj){targets=[[activeObj,nameFormatTarget.start,nameFormatTarget.end]];restore={...nameFormatTarget}}}if(!targets.length)targets=selectedRowsAll().map(x=>x.sig).filter(r=>!isSpacerSignal(r)).map(r=>[r,0,String(r.name||"").length]);if(!targets.length){toast("Select text, a Group, Block, or signal first");return}withHistory(()=>{targets.forEach(([obj,a,b])=>toggleNameFormat(obj,flag,a,b));if(restore&&activeObj)commitFormatObject(restore,activeObj)});renderGroups();renderRows();renderDiagram();save();if(restore)requestAnimationFrame(()=>{const n=findFormatInput(restore);n?.focus();try{n?.setSelectionRange(restore.start,restore.end)}catch{}rememberNameSelection(n)});else updateFormatToolbar()}
function styleTargetRows(){const selected=selectedRowsAll().map(x=>x.sig).filter(r=>!isSpacerSignal(r));if(selected.length)return selected;if(nameFormatTarget?.kind==="signal"){const s=state.signals[nameFormatTarget.side]?.find(r=>r.id===nameFormatTarget.id);if(s&&!isSpacerSignal(s))return [s]}return []}
function commonColor(rows,key,fallback){if(!rows.length)return fallback;const vals=[...new Set(rows.map(r=>colorValue(r?.[key],fallback)))];return vals[0]||fallback}
function groupTargetsForColor(){const out=[];const seen=new Set();for(const {which,sig} of selectedRowsAll()){if(!sig.groupId)continue;const key=which+":"+sig.groupId;if(seen.has(key))continue;const g=groupById(which,sig.groupId);if(g){seen.add(key);out.push(g)}}if(out.length)return out;for(const which of ["left","right"]){const active=activeGroupId[which],g=active&&groupById(which,active);if(g)out.push(g)}return out}
function updateColorToolbar(){$$("[data-color-target]").forEach(b=>b.classList.toggle("active",b.dataset.colorTarget===colorTarget))}
function applySignalColor(kind,value){const rows=styleTargetRows();if(!rows.length){toast("Select one or more signals first");return}withHistory(()=>rows.forEach(r=>r[kind]=colorValue(value,kind==="lineColor"?"#111b23":"#050505")));renderRows();renderDiagram();save();updateColorToolbar()}
function applyGroupColor(value){const gs=groupTargetsForColor();if(!gs.length){toast("Select Group chips or signals in Groups first");return}withHistory(()=>gs.forEach(g=>g.color=colorValue(value,"#1287a8")));renderGroups();renderDiagram();renderRtlDeclarations();save();updateColorToolbar()}
function applyPaletteColor(value){if(colorTarget==="line")applySignalColor("lineColor",value);else if(colorTarget==="text")applySignalColor("textColor",value);else applyGroupColor(value)}
function nextDirection(d){return d==="input"?"output":d==="output"?"inout":"input"}
function directionLabel(d){return d==="input"?"IN":d==="output"?"OUT":"I/O"}
function styleSpec(sig){return normalizeFormatRuns(sig?.formatRuns,String(sig?.name??"").length).map(r=>`${r.start},${r.end},${r.style}`).join(";")}
function save(){ensureLayoutState();document.title=String(state.moduleName||"Untitled")+" · WrapItfUp "+(window.WIURelease?.label||"r74");const n=$("#projectName");if(n){n.textContent=state.moduleName||"Untitled";n.title="Edit Block name · RTL: "+rtlModuleName()}renderDesk()}
function toast(t){const n=$("#toast");n.textContent=t;n.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.remove("show"),1700)}
function snapshotState(){return JSON.stringify(state)}
function updateHistoryUI(){$("#undoBtn")?.toggleAttribute("disabled",history.undo.length===0);$("#redoBtn")?.toggleAttribute("disabled",history.redo.length===0)}
function beginHistory(){if(history.applying||history.tx!==null)return;history.tx=snapshotState()}
function endHistory(){if(history.applying||history.tx===null)return;const before=history.tx,after=snapshotState();history.tx=null;if(before!==after){history.undo.push(before);if(history.undo.length>history.limit)history.undo.shift();history.redo.length=0}updateHistoryUI()}
function withHistory(fn){beginHistory();try{fn()}finally{endHistory()}}
function commitHistorySnapshot(before){if(history.applying||before==null)return false;const after=snapshotState();if(before===after){updateHistoryUI();return false}history.undo.push(before);if(history.undo.length>history.limit)history.undo.shift();history.redo.length=0;updateHistoryUI();return true}
function finishActiveEditHistory(){const active=document.activeElement;if(isHistoryField(active)){try{active.blur()}catch{}}if(history.tx!==null)endHistory()}
function clearSelection(which=side){rowSelection[which].clear();selectionAnchor[which]=null}
function clearAllSelections(){clearSelection("left");clearSelection("right")}
function restoreSnapshot(text){history.applying=true;try{state=JSON.parse(text)}finally{history.applying=false}clearAllSelections();nameFormatTarget=null;activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};render()}
function undo(){if(history.tx!==null)endHistory();if(!history.undo.length){toast("Nothing to undo");return}const current=snapshotState(),prev=history.undo.pop();history.redo.push(current);restoreSnapshot(prev);updateHistoryUI();toast("Undo")}
function redo(){if(history.tx!==null)endHistory();if(!history.redo.length){toast("Nothing to redo");return}const current=snapshotState(),next=history.redo.pop();history.undo.push(current);restoreSnapshot(next);updateHistoryUI();toast("Redo")}
function isEditableTarget(el){return !!el?.closest?.('input,textarea,select,[contenteditable="true"]')}
function isHistoryField(el){return !!el?.matches?.('[data-desk-field],[data-inspect-field],#rows input[data-act="name"],#rows input[data-act="bits"],#rows input[data-act="comment"],#groupBar input[type="text"],.signal-card input,.inline-group-label input,.inline-condition-label input,.line-length-editor,.block-title-editor input,.block-title-editor textarea,.signal-comment-editor input')}
function selectAllRows(){clearAllSelections();let total=0;for(const which of ["left","right"]){const set=rowSelection[which];state.signals[which].forEach(r=>{set.add(r.id);total++});selectionAnchor[which]=state.signals[which][0]?.id||null}renderRows();renderInlineSelectionState();updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar();toast(`${total} signals selected · both sides`)}
function selectedRowsInOrder(){const set=rowSelection[side];return state.signals[side].filter(r=>set.has(r.id))}
function deleteSelectedRows(){const hits=selectedRowsAll();if(!hits.length)return false;const n=hits.length;withHistory(()=>{for(const which of ["left","right"]){const set=rowSelection[which];state.signals[which]=state.signals[which].filter(r=>!set.has(r.id))}});clearAllSelections();render();if(!window.WIUAssemblyDialogOpen)toast(`${n} 列已刪除；可復原`);return true}
function isBitField(el){return !!el?.matches?.('.line-length-editor,#rows input[data-act="bits"]')}
function selectedBitTargets(){return selectedRowsAll().map(({which,sig})=>({which,sig,el:$(`.line-length-editor[data-side="${which}"][data-id="${sig.id}"]`)||$(`#rows tr[data-id="${sig.id}"] input[data-act="bits"]`)}))}
function refreshBitSelectionState(){$$(".line-length-editor").forEach(el=>{const which=el.dataset.side;el.classList.toggle("bit-selected",!!which&&rowSelection[which]?.has(el.dataset.id))})}

function focusSelectedName(){const hit=selectedRowsAll()[0];if(!hit)return;side=hit.which;const el=findNameInput(hit.which,hit.sig.id);el?.focus();el?.select();rememberNameSelection(el)}
function moveRowSelection(delta,extend=false){const rows=state.signals[side];if(!rows.length)return;const set=rowSelection[side],ids=rows.map(r=>r.id);let at=selectionAnchor[side]?ids.indexOf(selectionAnchor[side]):-1;if(at<0)at=delta>0?-1:rows.length;const next=Math.max(0,Math.min(rows.length-1,at+delta)),id=ids[next];if(extend&&selectionAnchor[side]){const anchor=ids.indexOf(selectionAnchor[side]);set.clear();for(let i=Math.min(anchor,next);i<=Math.max(anchor,next);i++)set.add(ids[i])}else{clearAllSelections();set.add(id);selectionAnchor[side]=id}renderRows();renderInlineSelectionState();updateFormatToolbar();updateColorToolbar()}

function conditionDescriptor(which,sig){const c=conditionById(which,sig?.conditionId);return c?{sourceSide:which,id:c.id,kind:c.kind,macro:c.macro,path:c.path?c.path.map(x=>({...x})):null}:null}
function ensureConditionOnSide(which,desc,cache=null){if(!desc?.macro)return null;const macro=cleanMacroLabel(desc.macro)||"FPGA",kind=desc.kind==="ifndef"?"ifndef":"ifdef",key=`${which}:${desc.sourceSide||""}:${desc.id||""}:${kind}:${macro}:${JSON.stringify(desc.path||[])}`;if(cache?.has(key))return cache.get(key);let c=null;if(desc.id)c=state.conditions[which].find(x=>x.id===desc.id)||null;if(!c)c=state.conditions[which].find(x=>x.kind===kind&&cleanMacroLabel(x.macro)===macro)||null;if(!c){c=compileCondition(kind,macro);if(desc.path)c.path=desc.path.map(x=>({...x}));state.conditions[which].push(c)}if(cache)cache.set(key,c.id);return c.id}
function copyPayloadFromSelection(){const hits=selectedRowsAll();if(!hits.length)return null;const items=hits.map(({which,sig:r})=>{const gd=groupDescriptor(which,r),cd=conditionDescriptor(which,r);return {sourceSide:which,name:r.name,bits:r.bits,signed:!!r.signed,direction:r.direction,groupId:r.groupId,groupName:gd?.name||"",groupColor:gd?.color||"",groupFormatRuns:gd?.formatRuns||[],group:gd,conditionId:r.conditionId,condition:cd,comment:cleanComment(r.comment),formatRuns:normalizeFormatRuns(r.formatRuns,String(r.name||"").length),lineColor:lineColorOf(r),textColor:textColorOf(r)}});const plain=items.map(x=>[x.name,x.bits,x.direction,x.groupName,x.comment].join("\t")).join("\r\n");return {format:"WrapperSignalRows",version:5,sourceSide:"mixed",items,text:plain}}
function normalizeClipboardRows(text,fallback="input"){return String(text||"").split(/\r?\n/).filter(x=>x.trim()).map(line=>{const c=line.split("\t");if(c.length>=2)return {name:String(c[0]||"SIGNAL").trim(),bits:cleanBitsText(c[1]||"1")||"1",direction:/^inout|^i\/?o/i.test(c[2]||"")?"inout":/^out/i.test(c[2]||"")?"output":/^in/i.test(c[2]||"")?"input":fallback,groupName:String(c[3]||"").trim(),group:{name:String(c[3]||"").trim()},comment:cleanComment(c[4]||""),groupId:null};const parsed=parsePaste(line,fallback,null)[0];return parsed?{name:parsed.name,bits:parsed.bits,direction:parsed.direction,groupId:null,groupName:"",comment:parsed.comment||""}:null}).filter(Boolean)}
function groupById(which,id){return state.groups[which].find(g=>g.id===id)||null}
function signalLayout(which){const rows=state.signals[which],start=84,pitch=31;return rows.map((s,i)=>({...s,y:start+i*pitch}))}
function getContentYBounds(target=state){const n=Math.max(target?.signals?.left?.length||0,target?.signals?.right?.length||0);if(!n)return {top:48,bottom:132};const first=84,last=84+(n-1)*31;return {top:first-36,bottom:last+36}}
function ensureLayoutState(target=state){if(!target.layout||typeof target.layout!=="object")target.layout=defaultLayout();let x=+target.layout.blockX,y=+target.layout.blockY,w=+target.layout.blockWidth,h=+target.layout.blockHeight,leftX=+target.layout.leftSignalX,rightX=+target.layout.rightSignalX;if(!Number.isFinite(x))x=650;if(!Number.isFinite(y))y=48;if(!Number.isFinite(w))w=500;if(!Number.isFinite(h))h=420;if(!Number.isFinite(leftX))leftX=530;if(!Number.isFinite(rightX))rightX=1270;const bounds=getContentYBounds(target),dynamicMinW=contentDrivenBlockMinWidth(target),minW=Math.max(320,dynamicMinW),maxW=1700,minY=24,minH=Math.max(contentDrivenBlockMinHeight(target),bounds.bottom-bounds.top),wireGap=DEFAULT_WIRE_MIN,railMin=120,railMax=1830;leftX=Math.max(railMin,Math.min(900,leftX));rightX=Math.max(900,Math.min(railMax,rightX));const neededSpan=Math.min(railMax-railMin,minW+wireGap*2);if(rightX-leftX<neededSpan){const railCenter=(leftX+rightX)/2;leftX=Math.max(railMin,railCenter-neededSpan/2);rightX=Math.min(railMax,railCenter+neededSpan/2);if(rightX-leftX<neededSpan){if(leftX<=railMin+.01)rightX=Math.min(railMax,leftX+neededSpan);else leftX=Math.max(railMin,rightX-neededSpan)}}const blockLeftMin=leftX+wireGap,blockRightMax=rightX-wireGap,available=Math.max(320,blockRightMax-blockLeftMin),oldCenter=x+w/2;let desiredW=Math.max(minW,w);desiredW=Math.min(maxW,available,desiredW);if(desiredW>w+.01)x=oldCenter-desiredW/2;w=desiredW;x=Math.max(blockLeftMin,Math.min(x,blockRightMax-w));h=Math.max(minH,h);y=Math.max(minY,Math.min(y,bounds.top));target.layout={blockX:x,blockY:y,blockWidth:w,blockHeight:h,leftSignalX:leftX,rightSignalX:rightX};return target.layout}
function getCanvasHeight(){const l=ensureLayoutState();return Math.max(getRowCanvasHeight(),Math.ceil(l.blockY+l.blockHeight+48))}
function updateBlockOverlay(){const l=ensureLayoutState(),s=previewView.scale,o=document.querySelector("#blockOverlay");if(o){o.style.left=`${previewView.x+l.blockX*s}px`;o.style.top=`${previewView.y+l.blockY*s}px`;o.style.width=`${Math.max(8,l.blockWidth*s)}px`;o.style.height=`${Math.max(8,l.blockHeight*s)}px`}const top=previewView.y+Math.max(3,(l.blockY-24)*s);for(const which of ["left","right"]){const h=document.querySelector(`[data-rail-handle="${which}"]`);if(!h)continue;const x=(which==="left"?l.leftSignalX:l.rightSignalX);h.style.left=`${previewView.x+x*s}px`;h.style.top=`${top}px`}}
function renderGroups(){const bar=$("#groupBar"),items=state.groups[side],active=activeGroupId[side];bar.innerHTML=`<button class="ungrouped" data-drop-group="" title="Drag here to ungroup">No group<\/button>${items.map(g=>`<div class="group-chip ${active===g.id?"active":""} ${isCommentedLabel(g.name)?"commented-label":""}" data-drop-group="${g.id}" data-group-select="${g.id}"><span class="group-dot" style="background:${isCommentedLabel(g.name)?"#9aa0a6":g.color}"><\/span><input type="text" value="${esc(g.name)}" data-gname="${g.id}" aria-label="Group name" title="Prefix // to comment out this whole group"><button data-gdelete="${g.id}" title="Delete group">×<\/button><\/div>`).join("")}<button class="add-group" id="addGroup">+ Group<\/button>`}
function renderRows(){const rows=state.signals[side],groups=state.groups[side],tbody=$("#rows"),selected=rowSelection[side];tbody.innerHTML=rows.map((r,i)=>`<tr data-id="${r.id}" class="${selected.has(r.id)?"selected":""} ${signalIsCommented(side,r)?"commented-label":""}" aria-selected="${selected.has(r.id)}"><td class="rowhead" title="Click row area to select · Ctrl multi-select · Shift range"><span class="color-line-dot" style="background:${lineColorOf(r)}"><\/span><button class="handle" data-drag="${r.id}" title="Drag to reorder / group">↕<\/button><span class="rownum">${i+1}<\/span><button class="dir ${r.direction}" data-act="direction" title="IN → OUT → I/O">${directionLabel(r.direction)}<\/button><\/td><td class="cell name-cell"><div class="name-rich" style="color:${textColorOf(r)}" aria-hidden="true">${styledNameHtml(r)}<\/div><input value="${esc(r.name)}" placeholder="SIGNAL_NAME / blank = spacing" data-act="name" spellcheck="false"><\/td><td class="cell bits"><input value="${esc(r.bits)}" data-act="bits" inputmode="text" placeholder="8 / 8b" title="Length: 8, 8b, 8B, [7:0]; other text becomes scalar in RTL declaration"><\/td><td class="group-select"><select data-act="group"><option value="">— none —<\/option>${groups.map(g=>`<option value="${g.id}" ${r.groupId===g.id?"selected":""}>${esc(g.name)}<\/option>`).join("")}<\/select><\/td><td class="cell comment"><input value="${esc(r.comment||"")}" data-act="comment" placeholder="optional note" title="Full comment; Preview/Visio show a short annotation"><\/td><td><button class="delete" data-act="delete" title="Delete">×<\/button><\/td><\/tr>`).join("");const lc=state.signals.left.length,rc=state.signals.right.length,n=side==="left"?lc:rc,sp=state.signals[side].filter(isSpacerSignal).length;$("#leftCount").textContent=lc;$("#rightCount").textContent=rc;$("#sideCount").textContent=`${n} rows${sp?` · ${sp} spacer`:""}${selected.size?` · ${selected.size} selected`:""}`;updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar();updateConditionAssignToolbar();syncDeskSelection()}
function conditionSegments(which,laid){const out=[];for(let i=0;i<laid.length;i++){const sig=laid[i];if(!sig.conditionId||isSpacerSignal(sig))continue;const c=conditionById(which,sig.conditionId);if(!c)continue;let last=out.at(-1);if(last&&last.conditionId===sig.conditionId&&last.lastIndex===i-1){last.y2=sig.y+11;last.lastIndex=i}else out.push({conditionId:sig.conditionId,kind:c.kind,macro:c.macro,y1:sig.y-11,y2:sig.y+11,firstIndex:i,lastIndex:i})}return out}
function conditionGeometry(seg,which,lineX){const left=which==="left",x=left?lineX-CONDITION_RAIL_GAP:lineX+CONDITION_RAIL_GAP,labelW=conditionLabelWidthPx(which,seg.conditionId),labelX=left?x-CONDITION_LABEL_GAP-labelW:x+CONDITION_LABEL_GAP;return {...seg,x,labelX,labelW,left}}
let __measureCanvas=null;function measureTextPx(text,font='600 10.5px Calibri, "Microsoft JhengHei", Arial, sans-serif'){const t=String(text??'');try{__measureCanvas=__measureCanvas||document.createElement('canvas');const c=__measureCanvas.getContext('2d');c.font=font;return c.measureText(t).width}catch{return t.length*6.2}}
function signalDisplayWidthPx(s){return Math.max(72,measureTextPx(String(s?.name||""),`${600} ${STENCIL_TEXT_PX}px Calibri, "Microsoft JhengHei", Arial, sans-serif`)+12)}

const STENCIL_TEXT_PT=8,STENCIL_TEXT_PX=STENCIL_TEXT_PT*96/72,PORT_NAME_CARD_MIN=104,PORT_NAME_CARD_MAX=560,PORT_NAME_CARD_PAD=62,PORT_NAME_EDGE_PAD=8,BLOCK_TITLE_SIDE_GAP=18,BLOCK_INNER_PAD=12,DEFAULT_WIRE_MIN=180;
function richNameMeasurePx(s){const name=String(s?.name||"");if(!name)return 0;const mask=formatMask(s);let total=0,start=0,style=mask[0]||0;const add=end=>{if(end<=start)return;const seg=name.slice(start,end),weight=(style&1)?800:600,italic=(style&2)?"italic ":"";total+=measureTextPx(seg,`${italic}${weight} ${STENCIL_TEXT_PX}px Calibri, "Microsoft JhengHei", Arial, sans-serif`)};for(let i=1;i<=name.length;i++){const next=i<name.length?(mask[i]||0):-1;if(i===name.length||next!==style){add(i);start=i;style=next}}return total}
function portNameCardWidth(s){const w=richNameMeasurePx(s);return Math.max(PORT_NAME_CARD_MIN,Math.min(PORT_NAME_CARD_MAX,Math.ceil(w*1.04+PORT_NAME_CARD_PAD)))}
function portLaneWidth(which,target=state){const rows=(target?.signals?.[which]||[]).filter(s=>!isSpacerSignal(s));return rows.length?Math.max(PORT_NAME_CARD_MIN,...rows.map(portNameCardWidth)):PORT_NAME_CARD_MIN}
function moduleCenterReserve(target=state){const name=String(target?.moduleName||"").trim()||"Block",font='650 19px Calibri, "Microsoft JhengHei", Arial, sans-serif',tokens=name.split(/\s+/).filter(Boolean);const longest=Math.max(...(tokens.length?tokens:[name]).map(t=>measureTextPx(t,font)),0);return Math.max(150,Math.min(240,Math.ceil(longest*1.04+34)))}
function contentDrivenBlockMinWidth(target=state){const left=portLaneWidth("left",target),right=portLaneWidth("right",target),center=moduleCenterReserve(target);return Math.ceil(BLOCK_INNER_PAD*2+left+right+BLOCK_TITLE_SIDE_GAP*2+center)}
function contentDrivenBlockMinHeight(target=state){const lc=target?.signals?.left?.length||0,rc=target?.signals?.right?.length||0,n=Math.max(lc,rc,1),rowsH=(n-1)*31+72;return Math.max(220,rowsH)}
function blockTitleSafeMetrics(layout,target=state){const leftLane=portLaneWidth("left",target),rightLane=portLaneWidth("right",target),x=layout.blockX+BLOCK_INNER_PAD+leftLane+BLOCK_TITLE_SIDE_GAP,right=layout.blockX+layout.blockWidth-BLOCK_INNER_PAD-rightLane-BLOCK_TITLE_SIDE_GAP;return {x,right,width:Math.max(120,right-x),cx:(x+right)/2,leftLane,rightLane,lane:Math.max(leftLane,rightLane)}}

const COMMENT_LANE_MIN_W=190,COMMENT_LANE_MAX_W=520,COMMENT_LANE_GAP=28,GROUP_OUTER_GAP=18,NAME_BLOCK_GAP=16,GROUP_RAIL_GAP=30,GROUP_LABEL_RESERVE=220,CONDITION_RAIL_GAP=18,CONDITION_LABEL_MIN=132,CONDITION_LABEL_RESERVE=220,CONDITION_LABEL_GAP=7,CONDITION_GROUP_GAP=14,CONDITION_COLOR="#7c3aed";
function commentLaneWidth(which){const rows=state.signals?.[which]||[],font='500 11.5px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Microsoft JhengHei",sans-serif';let w=COMMENT_LANE_MIN_W;for(const s of rows){if(isSpacerSignal(s))continue;const c=cleanComment(s.comment);if(!c)continue;w=Math.max(w,Math.ceil(measureTextPx("// "+c,font)+18))}return Math.max(COMMENT_LANE_MIN_W,w)}
function sideHasConditions(which){return (state.conditions?.[which]||[]).some(c=>state.signals[which]?.some(s=>s.conditionId===c.id&&!isSpacerSignal(s)))}
function effectiveCommentLaneWidth(which){return commentLaneWidth(which)}
function conditionLabelWidthPx(which,conditionId){const c=conditionById(which,conditionId);if(!c)return CONDITION_LABEL_MIN;const macro=String(c.macro||"FPGA").trim(),kind=c.kind==="ifndef"?"ifndef":"ifdef",w=measureTextPx(`${kind} ${macro}`,'700 10px Consolas, "Cascadia Mono", monospace')+78;return Math.max(132,Math.min(220,Math.ceil(w)))}
function sideConditionLabelWidth(which){if(!sideHasConditions(which))return 0;let w=CONDITION_LABEL_MIN;for(const c of state.conditions?.[which]||[]){if(!state.signals[which]?.some(sig=>sig.conditionId===c.id&&!isSpacerSignal(sig)))continue;w=Math.max(w,conditionLabelWidthPx(which,c.id))}return Math.min(CONDITION_LABEL_RESERVE,w)}
function groupRailOffset(which){if(!sideHasConditions(which))return GROUP_RAIL_GAP;return CONDITION_RAIL_GAP+CONDITION_LABEL_GAP+sideConditionLabelWidth(which)+CONDITION_GROUP_GAP}
function groupRailX(which,lineX){const left=which==="left",d=groupRailOffset(which);return left?lineX-d:lineX+d}
function inlineCardWidthForSignal(s){return portNameCardWidth(s)}
function inlineCardWidthForSide(which){const rows=state.signals[which].filter(s=>!isSpacerSignal(s));return rows.length?Math.max(PORT_NAME_CARD_MIN,...rows.map(inlineCardWidthForSignal)):PORT_NAME_CARD_MIN}
function bracketPath(x,y1,y2,left){const cap=12;return left?`M ${x+cap} ${y1} H ${x} V ${y2} H ${x+cap}`:`M ${x-cap} ${y1} H ${x} V ${y2} H ${x-cap}`}
function inlineCardHtml(s,which,lineX,cardW,layout){const selected=rowSelection[which].has(s.id),selectedTotal=selectedRowsAll().length,left=which==="left",g=groupById(which,s.groupId),commented=signalIsCommented(which,s),gcolor=commented?"#9aa0a6":(g?.color||"#cbd5e1"),x=left?layout.blockX+PORT_NAME_EDGE_PAD:layout.blockX+layout.blockWidth-cardW-PORT_NAME_EDGE_PAD,y=s.y-12,dragCount=selected?rowSelection[which].size:1,dragTitle=dragCount>1?`Drag ${dragCount} selected signals together · across Left/Right supported`:"Drag to reorder signal · across Left/Right supported";if(isSpacerSignal(s)){const gx=left?layout.blockX+18:layout.blockX+layout.blockWidth-70;return `<div class="inline-gap ${selected?"selected":""}" data-side="${which}" data-id="${s.id}" style="left:${gx}px;top:${s.y-9}px"><button class="card-handle" data-card-drag="${s.id}" title="${dragTitle}">↕<\/button><button class="gap-edit" data-gap-edit title="Spacer row · click to turn it back into an editable signal">gap<\/button><button class="card-delete" data-inline-delete title="Delete gap">×<\/button><\/div>`}return `<div class="signal-card inner-name ${which} ${selected?"selected":""} ${selected&&selectedTotal>1?"multi-selected":""} ${commented?"commented-label":""}" data-side="${which}" data-id="${s.id}" style="left:${x}px;top:${y}px;width:${cardW}px;--group-color:${gcolor}"><button class="card-handle" data-card-drag="${s.id}" title="${dragTitle}">↕<\/button><div class="inline-name-cell"><div class="name-rich" style="color:${commented?"#8c939a":textColorOf(s)}" aria-hidden="true">${styledNameHtml(s)}<\/div><input data-act="name" value="${esc(s.name)}" placeholder="signal_name" spellcheck="false" title="${esc(s.name)}"><\/div><button class="card-delete" data-inline-delete title="刪除此訊號；可復原">×<\/button><\/div>`}
function inlineCommentHtml(s,which,lane){if(isSpacerSignal(s))return "";const selected=rowSelection[which].has(s.id),value=cleanCommentLive(s.comment),y=s.y-11,font='500 11.5px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Microsoft JhengHei",sans-serif',idleW=value?Math.min(lane.width,Math.max(72,Math.ceil(measureTextPx("// "+value,font)+24))):118,w=selected?lane.width:idleW;return `<div class="signal-comment-editor ${which} ${selected?"selected":""} ${value?"":"empty"}" data-side="${which}" data-id="${s.id}" style="left:${lane.x}px;top:${y}px;width:${w}px;--comment-lane-width:${lane.width}px" title="Single click to edit comment"><span class="comment-prefix">//<\/span><input data-act="comment" value="${esc(value)}" placeholder="Describe interface purpose / usage…" title="Signal description · single click edits · full text stays in RTL / metadata" spellcheck="false"><\/div>`}
function wrapTextRanges(value,maxWidth,font='650 19px Calibri, "Microsoft JhengHei", Arial, sans-serif'){const raw=String(value??""),ranges=[];if(!raw)return [{start:0,end:0,text:""}];let lineStart=0;const flush=end=>{ranges.push({start:lineStart,end,text:raw.slice(lineStart,end)});lineStart=end};for(let i=0;i<raw.length;){if(raw[i]==="\n"){flush(i);i++;lineStart=i;continue}let j=i+1;if(/[A-Za-z0-9_]/.test(raw[i]))while(j<raw.length&&/[A-Za-z0-9_./:-]/.test(raw[j]))j++;else if(/\s/.test(raw[i]))while(j<raw.length&&/\s/.test(raw[j])&&raw[j]!=="\n")j++;const token=raw.slice(i,j),trial=raw.slice(lineStart,j).replace(/\s+$/,"");if(i>lineStart&&measureTextPx(trial,font)>maxWidth){flush(i);continue}if(i===lineStart&&measureTextPx(token,font)>maxWidth){let k=i+1,last=i;while(k<=j){if(k>last+1&&measureTextPx(raw.slice(last,k),font)>maxWidth){ranges.push({start:last,end:k-1,text:raw.slice(last,k-1)});last=k-1}k++}lineStart=last;i=j;continue}i=j}if(lineStart<=raw.length)ranges.push({start:lineStart,end:raw.length,text:raw.slice(lineStart)});return ranges.filter((r,i,a)=>r.start<r.end||a.length===1)}
function moduleSvgText(layout){const safe=blockTitleSafeMetrics(layout),obj=moduleFormatObject(),lines=wrapTextRanges(obj.name,safe.width),cx=safe.cx,cy=layout.blockY+layout.blockHeight/2,lineH=23,start=cy-(lines.length-1)*lineH/2;return `<text x="${cx}" y="${start}" text-anchor="middle" dominant-baseline="middle" class="modtitle">${lines.map((ln,i)=>`<tspan x="${cx}" y="${start+i*lineH}">${styledTextSvgRange(obj,ln.start,ln.end)}<\/tspan>`).join("")}<\/text>`}
function syncModuleEditorVisual(el){if(!el||!el.matches?.("[data-inline-module]"))return;const cs=getComputedStyle(el),fontPx=parseFloat(cs.fontSize)||19,lineRatio=parseFloat(cs.lineHeight);const lineH=Number.isFinite(lineRatio)&&lineRatio>fontPx?lineRatio:fontPx*1.18,lines=Math.max(1,String(el.value||"").split(/\n/).length),inner=Math.max(1,el.clientHeight),top=Math.max(0,(inner-lines*lineH)/2);el.style.paddingTop=`${top}px`;el.style.paddingBottom=`0px`}
function inlineBlockTitleHtml(layout){const safe=blockTitleSafeMetrics(layout),cx=safe.cx,cy=layout.blockY+layout.blockHeight/2,w=Math.max(180,Math.min(safe.width,360)),lineCount=Math.max(1,String(state.moduleName||"").split(/\n/).length),h=Math.max(38,Math.min(96,16+lineCount*23)),obj=moduleFormatObject();return `<div class="block-title-editor" style="left:${cx-w/2}px;top:${cy-h/2}px;width:${w}px;height:${h}px"><div class="module-rich" aria-hidden="true">${styledNameHtml(obj)}<\/div><textarea class="module-inline" data-inline-module aria-label="Module name" title="模組名稱 · 雙擊編輯；Enter / F2">${esc(state.moduleName)}<\/textarea><\/div>`}
function inlineGroupHtml(g,which){const left=which==="left",item=groupById(which,g.groupId);if(!item)return "";const y=(g.y1+g.y2)/2-13,active=activeGroupId[which]===item.id,commented=isCommentedLabel(item.name),color=commented?"#9aa0a6":item.color,nameCell=`<div class="group-name-cell excel-label-cell"><div class="group-rich" aria-hidden="true">${styledNameHtml(item)}<\/div><input class="excel-text-label" data-inline-group-name value="${esc(item.name)}" spellcheck="false" title="Group Name · first click selects all · prefix // comments out the whole group"><\/div>`,dot=`<span class="group-dot" style="background:${color}"><\/span>`,del=`<button class="label-delete" data-inline-group-delete title="移除這層群組；接腳與其他層保留">×<\/button>`;return `<div class="inline-group-bracket ${which} ${commented?"commented-label":""}" style="left:${g.x}px;top:${g.y1}px;height:${Math.max(22,g.y2-g.y1)}px;--group-color:${color}"><\/div><div class="inline-group-label unified-label-card ${which} ${active?"active":""} ${commented?"commented-label":""}" data-inline-group="${item.id}" data-side="${which}" data-drop-group="${item.id}" style="left:${g.labelX}px;top:${y}px;width:${Math.max(g.labelW,118)}px;--group-color:${color}">${left?`${nameCell}${dot}${del}`:`${del}${dot}${nameCell}`}<\/div>`}
function inlineConditionHtml(seg,which){const c=conditionById(which,seg.conditionId);if(!c)return "";const structured=Array.isArray(c.path)&&c.path.length>0,desc=structured?conditionDirectiveText(c):c.macro;const g=conditionGeometry(seg,which,which==="left"?ensureLayoutState().leftSignalX:ensureLayoutState().rightSignalX),y=(seg.y1+seg.y2)/2-13,active=activeConditionId[which]===c.id,commented=isCommentedLabel(c.macro),kind=c.kind==="ifndef"?"ifndef":"ifdef";return `<div class="inline-condition-bracket ${which} ${commented?"commented-label":""}" style="left:${g.x}px;top:${seg.y1}px;height:${Math.max(22,seg.y2-seg.y1)}px"><\/div><div class="inline-condition-label unified-label-card ${which} ${active?"active":""} ${commented?"commented-label":""}" data-inline-condition="${c.id}" data-side="${which}" data-drop-condition="${c.id}" style="left:${g.labelX}px;top:${y}px;width:${Math.max(g.labelW,132)}px"><button class="condition-kind-toggle" data-condition-kind-toggle ${structured?"disabled":""} title="${structured?"Imported condition branch path · preserved (edit in RTL source and re-import)":"Click to toggle ifdef / ifndef"}">&#96;${structured?c.path.at(-1).branch:kind}<\/button><div class="condition-name-cell excel-label-cell"><input class="excel-text-label" data-condition-macro value="${esc(desc)}" ${structured?"readonly":""} spellcheck="false" title="${structured?"完整層級分支："+esc(desc)+" · 修改請重新匯入 RTL，避免意外改變分支語意":"Macro Name · first click selects all · prefix // comments out this condition and its ports"}"><\/div><button class="label-delete" data-condition-delete title="Remove IFDEF/IFNDEF condition (signals stay)">×<\/button><\/div>`}
function inlineEditorHtml(L,R,LG,RG,layout,h){const CL=commentLaneGeometry("left",L,layout.leftSignalX,true),CR=commentLaneGeometry("right",R,layout.rightSignalX,true),ELG=LG.map(g=>editorGroupGeometry(g,"left",L,layout.leftSignalX,CL)),ERG=RG.map(g=>editorGroupGeometry(g,"right",R,layout.rightSignalX,CR)),LC=conditionSegments("left",L),RC=conditionSegments("right",R);return `<div class="inline-editor-layer" id="inlineLayer" style="height:${h}px"><div class="inline-help">Excel edit: first click selects all · ←/→ places caret · Enter ↓ / Shift+Enter ↑ · Tab moves sideways · // comments out Name/Group/IFDEF/IFNDEF · drag ↕<\/div>${inlineBlockTitleHtml(layout)}${L.map(s=>inlineLengthHtml(s,"left",layout)).join("")}${R.map(s=>inlineLengthHtml(s,"right",layout)).join("")}${L.map(s=>inlineCardHtml(s,"left",layout.leftSignalX,inlineCardWidthForSignal(s),layout)).join("")}${R.map(s=>inlineCardHtml(s,"right",layout.rightSignalX,inlineCardWidthForSignal(s),layout)).join("")}${L.map(s=>inlineCommentHtml(s,"left",CL)).join("")}${R.map(s=>inlineCommentHtml(s,"right",CR)).join("")}${ELG.map(g=>inlineGroupHtml(g,"left")).join("")}${ERG.map(g=>inlineGroupHtml(g,"right")).join("")}${LC.map(g=>inlineConditionHtml(g,"left")).join("")}${RC.map(g=>inlineConditionHtml(g,"right")).join("")}<\/div>`}
function renderInlineSelectionState(){const multi=$('#r128-multi');if(multi){multi.setAttribute('aria-pressed',String(multiSelectMode));multi.textContent='多選：'+(multiSelectMode?'開':'關');}for(const el of $$(".signal-card,.inline-gap,.line-length-editor,.signal-comment-editor")){const which=el.dataset.side,id=el.dataset.id;el.classList.toggle("selected",!!rowSelection[which]?.has(id))}refreshBitSelectionState();for(const el of $$(".inline-group-label")){el.classList.toggle("active",activeGroupId[el.dataset.side]===el.dataset.inlineGroup)}for(const el of $$(".inline-condition-label")){el.classList.toggle("active",activeConditionId[el.dataset.side]===el.dataset.inlineCondition)}}
function bestResizeHandleRatio(rows,layout){const top=layout.blockY,bottom=layout.blockY+layout.blockHeight,ys=(rows||[]).filter(s=>!isSpacerSignal(s)&&s.y>top+16&&s.y<bottom-16).map(s=>s.y).sort((a,b)=>a-b),candidates=[top+28,bottom-28];for(let i=0;i<ys.length-1;i++)candidates.push((ys[i]+ys[i+1])/2);if(!ys.length)candidates.push((top+bottom)/2);let best=candidates[0],score=-1;for(const y of candidates){const d=ys.length?Math.min(...ys.map(v=>Math.abs(v-y))):999;if(d>score){score=d;best=y}}return Math.max(.10,Math.min(.90,(best-top)/Math.max(1,layout.blockHeight)))}
function blockOverlayHtml(layout,L,R){const wy="50",ey="50";return `<div id="blockOverlay" class="block-overlay" style="--w-y:${wy}%;--e-y:${ey}%"><div class="resize-handle nw" role="button" tabindex="0" aria-label="調整區塊 nw（方向鍵；Shift 加速）" data-handle="nw" title="Resize width + height"><\/div><div class="resize-handle n" role="button" tabindex="0" aria-label="調整區塊 n（方向鍵；Shift 加速）" data-handle="n" title="Resize Block height"><\/div><div class="resize-handle ne" role="button" tabindex="0" aria-label="調整區塊 ne（方向鍵；Shift 加速）" data-handle="ne" title="Resize width + height"><\/div><div class="resize-handle e" role="button" tabindex="0" aria-label="調整區塊 e（方向鍵；Shift 加速）" data-handle="e" title="Resize Block width"><\/div><div class="resize-handle se" role="button" tabindex="0" aria-label="調整區塊 se（方向鍵；Shift 加速）" data-handle="se" title="Resize width + height"><\/div><div class="resize-handle s" role="button" tabindex="0" aria-label="調整區塊 s（方向鍵；Shift 加速）" data-handle="s" title="Resize Block height"><\/div><div class="resize-handle sw" role="button" tabindex="0" aria-label="調整區塊 sw（方向鍵；Shift 加速）" data-handle="sw" title="Resize width + height"><\/div><div class="resize-handle w" role="button" tabindex="0" aria-label="調整區塊 w（方向鍵；Shift 加速）" data-handle="w" title="Resize Block width"><\/div><\/div><div class="signal-rail-handle" data-rail-handle="left" title="Drag LEFT signal rail to change wire length">L ↔<\/div><div class="signal-rail-handle" data-rail-handle="right" title="Drag RIGHT signal rail to change wire length">↔ R<\/div>`}
function renderDiagram(live=false){if(live)return renderDiagramNow(true);return window.WIUInteractionR128.paint("diagram",()=>renderDiagramNow(false));}
function renderDiagramNow(live=false){const L=signalLayout("left"),R=signalLayout("right"),LG=groupSegments("left",L),RG=groupSegments("right",R),LC=conditionSegments("left",L),RC=conditionSegments("right",R),layout=ensureLayoutState(),h=getCanvasHeight(),W=1950,bx=layout.blockX,br=bx+layout.blockWidth,by=layout.blockY,bh=layout.blockHeight,lineL=layout.leftSignalX,lineR=layout.rightSignalX,labelL=lineL-28,labelR=lineR+28,CL=commentLaneGeometry("left",L,lineL,false),CR=commentLaneGeometry("right",R,lineR,false),LGG=LG.map(g=>groupGeometry(g,"left",L,layout,CL)),RGG=RG.map(g=>groupGeometry(g,"right",R,layout,CR));previewMetrics={width:W,height:h};const lineColors=[...new Set([...L.map(s=>({s,which:"left"})),...R.map(s=>({s,which:"right"}))].filter(x=>!isSpacerSignal(x.s)).map(x=>signalIsCommented(x.which,x.s)?"#9aa0a6":lineColorOf(x.s)))],markerId=new Map(lineColors.map((c,i)=>[c,`arr${i}`])),markers=lineColors.map((c,i)=>`<marker id="arr${i}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0L7 4L0 8z" fill="${c}"/><\/marker>`).join("");let out=`<svg id="diagramSvg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg"><defs>${markers}<\/defs><rect width="${W}" height="${h}" fill="#fff"/><rect x="${bx}" y="${by}" width="${layout.blockWidth}" height="${bh}" fill="#fff" stroke="#111" stroke-width="1.25"/>${moduleSvgText(layout)}`;
  function drawSignal(s,left){if(isSpacerSignal(s))return;const which=left?"left":"right",edge=left?bx:br,outer=left?lineL:lineR,isInput=s.direction==="input",isInout=s.direction==="inout",startX=left?((isInput||isInout)?outer:edge):((isInput||isInout)?outer:edge),endX=left?((isInput||isInout)?edge:outer):((isInput||isInout)?edge:outer),bus=isBusBits(s.bits),busX=edge+(outer-edge)*0.62,nameX=left?edge+PORT_NAME_EDGE_PAD:edge-PORT_NAME_EDGE_PAD,nameY=s.y,commented=signalIsCommented(which,s),lineColor=commented?"#9aa0a6":lineColorOf(s),textColor=commented?"#8c939a":textColorOf(s),mid=markerId.get(lineColor)||"arr0",markerEnd=`url(#${mid})`,markerStart=isInout?markerEnd:"",next=nextDirection(s.direction),dirTitle=`${s.name||"signal"} · ${directionLabel(s.direction)} · 點線段選取；Shift 選取範圍`;const arrowTitle=`${s.name||"signal"} · ${directionLabel(s.direction)} → ${directionLabel(next)} · 點擊切換方向（可復原）`;const hitArrow=(x)=>`<circle class="dir-arrow-hit" role="button" tabindex="0" aria-label="${esc(arrowTitle)}" data-direction-toggle data-side="${which}" data-id="${s.id}" cx="${x}" cy="${s.y}" r="14"><title>${esc(arrowTitle)}<\/title><\/circle>`;const hitLine=`<line class="dir-line-hit" data-direction-toggle data-side="${which}" data-id="${s.id}" x1="${Math.min(edge,outer)}" x2="${Math.max(edge,outer)}" y1="${s.y}" y2="${s.y}"><title>${esc(dirTitle)}<\/title><\/line>`;out+=`<g><line class="signal-wire" x1="${startX}" x2="${endX}" y1="${s.y}" y2="${s.y}" stroke="${lineColor}" stroke-width="${bus?1.4:1.05}" ${markerStart?`marker-start="${markerStart}"`:""} marker-end="${markerEnd}"/><text x="${nameX}" y="${nameY}" text-anchor="${left?"start":"end"}" dominant-baseline="middle" class="sig" fill="${textColor}">${styledNameSvg(s)}<\/text>${bus?`<line x1="${busX-6}" x2="${busX+6}" y1="${s.y+6}" y2="${s.y-6}" stroke="${lineColor}" stroke-width="1.1"/><text x="${busX}" y="${s.y-11.5}" text-anchor="middle" class="bittext" fill="${textColor}">${esc(s.bits)}<\/text>`:""}${hitLine}${hitArrow(endX)}${isInout?hitArrow(startX):""}<\/g>`}
  function drawComment(s,left,lane){const c=commentDiagramText(s.comment,lane.width-12);if(!c||isSpacerSignal(s))return;const x=lane.x,color=signalIsCommented(left?"left":"right",s)?"#8c939a":"#555b63";out+=`<text x="${x}" y="${s.y}" text-anchor="start" dominant-baseline="middle" class="sig-comment" data-side="${left?"left":"right"}" data-id="${s.id}" fill="${color}">// ${esc(c)}<\/text>`}
  L.forEach(s=>drawSignal(s,true));R.forEach(s=>drawSignal(s,false));L.forEach(s=>drawComment(s,true,CL));R.forEach(s=>drawComment(s,false,CR));
  for(const g of LGG){const item=groupById("left",g.groupId);out+=`<path class="grp-bracket" d="${bracketPath(g.x,g.y1,g.y2,true)}" fill="none" stroke="${isCommentedLabel(item?.name)?"#9aa0a6":g.color}" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="round"/><text x="${g.labelX}" y="${(g.y1+g.y2)/2}" text-anchor="start" dominant-baseline="middle" class="grp" fill="${isCommentedLabel(item?.name)?"#8c939a":g.color}">${styledNameSvg(item||g)}<\/text>`}
  for(const g of RGG){const item=groupById("right",g.groupId);out+=`<path class="grp-bracket" d="${bracketPath(g.x,g.y1,g.y2,false)}" fill="none" stroke="${isCommentedLabel(item?.name)?"#9aa0a6":g.color}" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="round"/><text x="${g.labelX}" y="${(g.y1+g.y2)/2}" text-anchor="start" dominant-baseline="middle" class="grp" fill="${isCommentedLabel(item?.name)?"#8c939a":g.color}">${styledNameSvg(item||g)}<\/text>`}  for(const seg of LC){const c=conditionById("left",seg.conditionId),g=conditionGeometry(seg,"left",lineL);if(!c)continue;out+=`<path d="${bracketPath(g.x,g.y1,g.y2,true)}" fill="none" stroke="${isCommentedLabel(c.macro)?"#9aa0a6":CONDITION_COLOR}" stroke-width="1.35" stroke-dasharray="4 3"/><text x="${g.labelX+g.labelW}" y="${(g.y1+g.y2)/2}" text-anchor="end" dominant-baseline="middle" class="cond" fill="${isCommentedLabel(c.macro)?"#8c939a":CONDITION_COLOR}">${esc(conditionText(c))}<\/text>`}
  for(const seg of RC){const c=conditionById("right",seg.conditionId),g=conditionGeometry(seg,"right",lineR);if(!c)continue;out+=`<path d="${bracketPath(g.x,g.y1,g.y2,false)}" fill="none" stroke="${isCommentedLabel(c.macro)?"#9aa0a6":CONDITION_COLOR}" stroke-width="1.35" stroke-dasharray="4 3"/><text x="${g.labelX}" y="${(g.y1+g.y2)/2}" text-anchor="start" dominant-baseline="middle" class="cond" fill="${isCommentedLabel(c.macro)?"#8c939a":CONDITION_COLOR}">${esc(conditionText(c))}<\/text>`}
  const hasLeftGroup=LGG.length>0,hasRightGroup=RGG.length>0,leftHasComments=L.some(s=>cleanComment(s.comment)),rightHasComments=R.some(s=>cleanComment(s.comment)),minLeftGroup=hasLeftGroup?Math.min(...LGG.map(g=>g.labelX-g.labelW-20)):labelL-100,maxRightGroup=hasRightGroup?Math.max(...RGG.map(g=>g.labelX+g.labelW+20)):labelR+100,leftCondGeo=LC.map(g=>conditionGeometry(g,"left",lineL)),rightCondGeo=RC.map(g=>conditionGeometry(g,"right",lineR)),minLeftCond=leftCondGeo.length?Math.min(...leftCondGeo.map(g=>g.labelX-8)):minLeftGroup,maxRightCond=rightCondGeo.length?Math.max(...rightCondGeo.map(g=>g.labelX+g.labelW+8)):maxRightGroup,minPX=Math.min(minLeftGroup,minLeftCond,leftHasComments?CL.x-14:minLeftGroup),maxPX=Math.max(maxRightGroup,maxRightCond,rightHasComments?CR.x+CR.width+14:maxRightGroup),minY=Math.max(0,Math.min(by,84)-26),maxY=Math.min(h,Math.max(by+bh,84+(Math.max(L.length,R.length)-1)*31)+30);presentationContentBounds={x:minPX,y:minY,width:maxPX-minPX,height:Math.max(120,maxY-minY)};const eCL=commentLaneGeometry("left",L,lineL,true),eCR=commentLaneGeometry("right",R,lineR,true),eLG=LG.map(g=>editorGroupGeometry(g,"left",L,lineL,eCL)),eRG=RG.map(g=>editorGroupGeometry(g,"right",R,lineR,eCR)),leftCards=L.filter(s=>!isSpacerSignal(s)).map(s=>layout.blockX+12),rightCards=R.filter(s=>!isSpacerSignal(s)).map(s=>layout.blockX+layout.blockWidth-12),editorMin=Math.min(minPX,...leftCards,leftHasComments?eCL.x:minPX,...eLG.map(g=>g.labelX-4)),editorMax=Math.max(maxPX,...rightCards,rightHasComments?eCR.x+eCR.width:maxPX,...eRG.map(g=>g.labelX+g.labelW+4));previewContentBounds={x:editorMin,y:minY,width:editorMax-editorMin,height:Math.max(120,maxY-minY)};const spacerCount=[...L,...R].filter(isSpacerSignal).length,visibleCount=L.length+R.length-spacerCount;out+="<\/svg>";out=sharedDiagramMarkup(out);mountDiagramMarkup(out+blockOverlayHtml(layout,L,R)+inlineEditorHtml(L,R,LG,RG,layout,h),live);$("#diagramCount").textContent=`${visibleCount} signals${spacerCount?` · ${spacerCount} gaps`:""}`;$("#qaState").textContent=`${selectedRowsAll().length?selectedRowsAll().length+" selected":"inline edit"}`;requestAnimationFrame(()=>previewView.fit?fitPreview():applyPreviewTransform());if(presentationOpen)refreshPresentationSvg();prepareCanvasLabels()}
function render(){return window.WIUInteractionR128.paint("sheet",renderNow);}
function renderNow(){ensureLayoutState();$$('.tab').forEach(b=>b.classList.toggle("active",b.dataset.side===side));renderGroups();renderRows();renderDiagram();renderRtlDeclarations();save();updateHistoryUI();renderDesk();renderGroupPanel();refreshFindPanel()}
function parsePaste(text,fallback,groupId){return text.split(/\r?\n/).filter(x=>x.trim()&&!/^\s*\/\//.test(x)).map(line=>{const parts=line.split(/\/\/(.*)/s),comment=cleanComment(parts[1]||""),raw=(parts[0]||"").trim();let t=raw.replace(/[;,]$/,""),range=t.match(/\[\s*([^:\]]+)\s*:\s*([^\]]+)\s*\]/),cols=t.split(/\t|\s{2,}/).filter(Boolean);let name=cols[0]||t,bits=cols[1]||"1";if(range){bits=`[${range[1].trim()}:${range[2].trim()}]`;name=t.replace(range[0],"").replace(/;.*$/," ").trim().split(/\s+/).at(-1)}else{const p=t.replace(/;.*$/," ").trim().split(/\s+/),last=p.at(-1)||"";if(/^(?:\d+(?:b|B|bit|bits|-bit)?|\[[^\]]+\])$/i.test(last)&&p.length>1){bits=p.pop();name=p.at(-1)}else name=p.at(-1)}const direction=/^inout\b/i.test(t)?"inout":/^output\b/i.test(t)?"output":/^input\b/i.test(t)?"input":fallback;name=String(name||"").replace(/^(input|output|inout|wire|logic|reg)\s+/i,"").replace(/;$/g,"");return signal(name,cleanBitsText(bits)||"1",direction,groupId,[],"#111b23","#050505",comment)})}
function clearDropClasses(){$$("#rows tr").forEach(tr=>tr.classList.remove("drop-before","drop-after","dragging"));$$('[data-drop-group]').forEach(x=>x.classList.remove("drop-target"))}
function commitReorder(){if(!dragId||!dropInfo)return false;const rows=state.signals[side],from=rows.findIndex(x=>x.id===dragId),target=rows.findIndex(x=>x.id===dropInfo.id);if(from<0||target<0||from===target)return false;const [moving]=rows.splice(from,1);let at=rows.findIndex(x=>x.id===dropInfo.id)+(dropInfo.before?0:1);rows.splice(at,0,moving);return true}
function updatePointerDrop(x,y){if(!dragId)return;clearDropClasses();$(`#rows tr[data-id="${dragId}"]`)?.classList.add("dragging");const groupTarget=document.elementFromPoint(x,y)?.closest("[data-drop-group]");if(groupTarget){groupTarget.classList.add("drop-target");dropInfo=null;return}const tr=document.elementFromPoint(x,y)?.closest("#rows tr");if(!tr||tr.dataset.id===dragId)return;const box=tr.getBoundingClientRect(),before=y<box.top+box.height/2;tr.classList.add(before?"drop-before":"drop-after");dropInfo={id:tr.dataset.id,before}}
$("#rows").addEventListener("input",e=>{const tr=e.target.closest("tr"),r=state.signals[side].find(x=>x.id===tr?.dataset.id),a=e.target.dataset.act;if(!r)return;if(a==="name"){const next=cleanSignalNameLive(e.target.value);if(next!==r.name)r.formatRuns=[];r.name=next;e.target.value=next;const rich=tr.querySelector(".name-rich");if(rich)rich.innerHTML=styledNameHtml(r);rememberNameSelection(e.target)}if(a==="bits"){if(history.tx===null)beginHistory();r.bits=cleanBitsText(e.target.value)}if(a==="comment")r.comment=cleanCommentLive(e.target.value);renderDiagram();renderRtlDeclarations();save();updateFormatToolbar()});
$("#rows").addEventListener("change",e=>{if(e.target.dataset.act!=="group")return;const tr=e.target.closest("tr"),r=state.signals[side].find(x=>x.id===tr?.dataset.id);if(r){withHistory(()=>{r.groupId=e.target.value||null});renderDiagram();renderRtlDeclarations();save()}});
$("#rows").addEventListener("click",e=>{const b=e.target.closest("button"),tr=b?.closest("tr");if(!b||!tr)return;const rows=state.signals[side],i=rows.findIndex(x=>x.id===tr.dataset.id),a=b.dataset.act;if(i<0)return;if(a==="direction"){withHistory(()=>{rows[i].direction=nextDirection(rows[i].direction)});render()}if(a==="delete"){withHistory(()=>rows.splice(i,1));rowSelection[side].delete(tr.dataset.id);if(nameFormatTarget?.id===tr.dataset.id)nameFormatTarget=null;render()}});
$("#rows").addEventListener("focusin",e=>{if(e.target.matches?.('input[data-act="name"]'))rememberNameSelection(e.target)});
$("#rows").addEventListener("select",e=>{if(e.target.matches?.('input[data-act="name"]'))rememberNameSelection(e.target)},true);
$("#rows").addEventListener("keyup",e=>{if(e.target.matches?.('input[data-act="name"]'))rememberNameSelection(e.target)});
$("#rows").addEventListener("mouseup",e=>{if(e.target.matches?.('input[data-act="name"]'))rememberNameSelection(e.target)});


$("#rows").addEventListener("pointerdown",e=>{const bit=e.target.closest?.('input[data-act="bits"]'),tr=bit?.closest("tr");if(bit&&tr&&(e.shiftKey||e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();finishActiveEditHistory();selectRow(tr.dataset.id,e,side);$("#rows").focus?.({preventScroll:true});return}},true);

$("#rows").addEventListener("pointerdown",e=>{const name=e.target.closest?.('input[data-act="name"]'),tr=name?.closest("tr");if(name&&tr&&(e.shiftKey||e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();finishActiveEditHistory();selectRow(tr.dataset.id,e,side);$("#rows").focus?.({preventScroll:true});return}},true);

$("#rows").addEventListener("pointerdown",e=>{const tr=e.target.closest("tr"),h=e.target.closest("[data-drag]");if(tr&&(e.ctrlKey||e.metaKey||e.shiftKey)&&!h&&!e.target.closest(".delete")){e.preventDefault();selectRow(tr.dataset.id,e);return}if(tr&&e.target.closest(".rowhead")&&!e.target.closest("button,[data-drag]")){selectRow(tr.dataset.id,e);return}if(!h)return;e.preventDefault();if(!rowSelection[side].has(h.dataset.drag)){rowSelection[side].clear();rowSelection[side].add(h.dataset.drag);selectionAnchor[side]=h.dataset.drag;renderRows()}beginHistory();dragId=h.dataset.drag;pointerDrag={id:dragId,pointerId:e.pointerId};h.setPointerCapture?.(e.pointerId);h.closest("tr")?.classList.add("dragging")});
$("#rows").addEventListener("pointermove",e=>{if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;e.preventDefault();updatePointerDrop(e.clientX,e.clientY)});
$("#rows").addEventListener("pointerup",e=>{if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-drop-group]"),sig=state.signals[side].find(x=>x.id===dragId);let msg="Signal order updated";if(target&&sig){sig.groupId=target.dataset.dropGroup||null;msg=sig.groupId?"Signal assigned to group":"Signal is now ungrouped"}else if(!commitReorder())msg="Drag cancelled";pointerDrag=null;dragId=null;dropInfo=null;clearDropClasses();endHistory();render();toast(msg)});
$("#rows").addEventListener("pointercancel",()=>{pointerDrag=null;dragId=null;dropInfo=null;clearDropClasses();history.tx=null});
$("#groupBar").addEventListener("input",e=>{const g=state.groups[side].find(x=>x.id===e.target.dataset.gname);if(!g)return;if(history.tx===null)beginHistory();g.name=e.target.value;syncInlineCommentedState();const inl=$(`.inline-group-label[data-side="${side}"][data-inline-group="${g.id}"] input[data-inline-group-name]`);if(inl&&inl!==e.target)inl.value=g.name;renderRows();renderRtlDeclarations();save()});
$("#groupBar").addEventListener("focusout",e=>{if(e.target.matches?.("input[data-gname]")){finishActiveEditHistory();renderDiagram();updateGroupAssignToolbar();save()}},true);
$("#groupBar").addEventListener("click",e=>{if(e.target.id==="addGroup"){let g;withHistory(()=>{g=group(`Group ${state.groups[side].length+1}`,COLORS[state.groups[side].length%COLORS.length]);state.groups[side].push(g)});activeGroupId[side]=g.id;render();setTimeout(()=>$(`[data-gname='${g.id}']`)?.select());return}const del=e.target.dataset.gdelete;if(del){withHistory(()=>{removeCanvasGroup(side,del)});if(activeGroupId[side]===del)activeGroupId[side]=null;render();return}const chip=e.target.closest("[data-group-select]");if(chip&&!e.target.matches("input")){activeGroupId[side]=chip.dataset.groupSelect;renderGroups();updateColorToolbar()}});
$$('.tab').forEach(b=>b.onclick=()=>{side=b.dataset.side;nameFormatTarget=null;render()});
$("#addSignal").onclick=()=>{let r;withHistory(()=>{r=signal("signal_name","1","input",null);state.signals[side].push(r)});rowSelection[side].clear();rowSelection[side].add(r.id);selectionAnchor[side]=r.id;render();setTimeout(()=>{const n=$("#rows tr:last-child input[data-act=name]");n?.focus();try{n?.select()}catch{}},0)};

$("#resetBtn").onclick=()=>{if(confirm("Reset all signals, groups, and IFDEF conditions?")){withHistory(()=>{state=fresh();side="left"});activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};clearAllSelections();render();toast("Default template restored")}};
document.addEventListener("focusin",e=>{if(isHistoryField(e.target))beginHistory()});document.addEventListener("beforeinput",e=>{if(isHistoryField(e.target)&&history.tx===null)beginHistory()},true);document.addEventListener("focusout",e=>{if(isHistoryField(e.target))endHistory()});



function rgb(hex){const n=parseInt(String(hex).slice(1),16)||0;return `${n>>16},${n>>8&255},${n&255}`}
function vbq(s){return String(s??"").replace(/"/g,'""')}
function downloadUtf16(name,text){const a=new Uint8Array(2+text.length*2);a[0]=255;a[1]=254;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a[2+i*2]=c&255;a[3+i*2]=c>>8}showVisioDownload(name,a)}
function downloadUtf8(name,text,type="application/json"){const u=URL.createObjectURL(new Blob([text],{type})),l=document.createElement("a");l.href=u;l.download=name;l.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function safeProjectName(){let n=String(state.moduleName||"wrapper").trim();try{n=n.normalize("NFKC")}catch{}n=n.replace(/[<>:"\/\\|?*\x00-\x1F]/g,"_").replace(/\s+/g,"_").replace(/[. ]+$/g,"");return n.slice(0,80)||"wrapper"}
function makeProject(){finishActiveEditHistory();if(window.WIUProjectHost)return window.WIUProjectHost.snapshot();return {format:"WrapItfUp",version:5,savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(state))}}
function encodeState(obj){const json=JSON.stringify(obj);return btoa(unescape(encodeURIComponent(json)))}
function decodeState(text){return JSON.parse(decodeURIComponent(escape(atob(text))))}
const WRAP_STATE_KEYWORD="WrapItfUp",WRAP_STATE_TAG="WRAPPINUP_STATE";
function makeEmbeddedStateText(encoded){return `${WRAP_STATE_TAG}_BEGIN\n${WRAP_STATE_TAG}:${encoded}\n${WRAP_STATE_TAG}_END`}
function makeEmbeddedStateChunks(encoded,chunkSize=180,prefix=""){const chunks=[];for(let i=0;i<encoded.length;i+=chunkSize)chunks.push(`${prefix}${WRAP_STATE_TAG}_CHUNK:${encoded.slice(i,i+chunkSize)}`);return [`${prefix}${WRAP_STATE_TAG}_BEGIN`,...chunks,`${prefix}${WRAP_STATE_TAG}_END`].join("\n")}
function extractEncodedStatesFromText(text){const src=String(text||""),out=[],single=new RegExp(`${WRAP_STATE_TAG}:([A-Za-z0-9+/=]+)`,"g");let m;while((m=single.exec(src)))out.push(m[1]);const lines=src.split(/\r?\n/);let collecting=false,current=[];for(const raw of lines){const line=raw.replace(/^\s*[';%#]+\s?/,"").trim();if(line.includes(`${WRAP_STATE_TAG}_BEGIN`)){collecting=true;current=[];continue}if(collecting&&line.includes(`${WRAP_STATE_TAG}_END`)){if(current.length)out.push(current.join(""));collecting=false;current=[];continue}if(collecting){const mm=line.match(new RegExp(`${WRAP_STATE_TAG}_CHUNK:([A-Za-z0-9+/=]+)`));if(mm)current.push(mm[1])}}return [...new Set(out.filter(Boolean))]}
function decodeProjectCarrierText(arrayBuffer,name=""){const bytes=new Uint8Array(arrayBuffer);if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder("utf-16le").decode(bytes.subarray(2));if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff){const swapped=new Uint8Array(bytes.length-2);for(let i=2;i+1<bytes.length;i+=2){swapped[i-2]=bytes[i+1];swapped[i-1]=bytes[i]}return new TextDecoder("utf-16le").decode(swapped)}if(/\.pdf$/i.test(name))return new TextDecoder("latin1").decode(bytes);return new TextDecoder("utf-8").decode(bytes)}
function u32be(value){return new Uint8Array([(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255])}
function concatBytes(...parts){const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function pngTextChunk(keyword,text){const enc=new TextEncoder(),type=enc.encode("tEXt"),data=concatBytes(enc.encode(keyword),new Uint8Array([0]),enc.encode(text)),crc=crc32(concatBytes(type,data));return concatBytes(u32be(data.length),type,data,u32be(crc))}
async function pngBlobWithState(blob,encoded){const bytes=new Uint8Array(await blob.arrayBuffer()),sig=bytes.slice(0,8),chunks=[sig];let offset=8,inserted=false;while(offset+12<=bytes.length){const len=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0,end=offset+12+len,type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(type==="IEND"&&!inserted){chunks.push(pngTextChunk(WRAP_STATE_KEYWORD,makeEmbeddedStateText(encoded)));inserted=true}chunks.push(bytes.slice(offset,end));offset=end}return new Blob([concatBytes(...chunks)],{type:"image/png"})}
function extractEncodedStatesFromPngBuffer(arrayBuffer){const bytes=new Uint8Array(arrayBuffer),dec=new TextDecoder("utf-8"),texts=[];let offset=8;while(offset+12<=bytes.length){const len=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0,type=String.fromCharCode(...bytes.slice(offset+4,offset+8)),ds=offset+8,de=ds+len;if(type==="tEXt"){const data=bytes.slice(ds,de),zero=data.indexOf(0);if(zero>0&&dec.decode(data.slice(0,zero)).startsWith(WRAP_STATE_KEYWORD))texts.push(dec.decode(data.slice(zero+1)))}offset=de+4}return extractEncodedStatesFromText(texts.join("\n"))}
function exportSvgText(encoded){finishActiveEditHistory();renderDiagram();const src=$("#diagramSvg"),clone=src.cloneNode(true);clone.removeAttribute("style");clone.querySelectorAll(".dir-arrow-hit,.dir-line-hit").forEach(n=>n.remove());const b=presentationContentBounds;clone.setAttribute("viewBox",`${b.x} ${b.y} ${b.width} ${b.height}`);clone.setAttribute("width",String(Math.ceil(b.width)));clone.setAttribute("height",String(Math.ceil(b.height)));const bg=clone.querySelector("rect");if(bg){bg.setAttribute("x",String(b.x));bg.setAttribute("y",String(b.y));bg.setAttribute("width",String(b.width));bg.setAttribute("height",String(b.height))}const ns="http://www.w3.org/2000/svg",meta=document.createElementNS(ns,"metadata");meta.setAttribute("id","wrappinup-state");meta.textContent=makeEmbeddedStateText(encoded);clone.insertBefore(meta,clone.firstChild);const style=document.createElementNS(ns,"style");style.textContent=`.sig{font:600 10.667px Calibri,'Microsoft JhengHei',Arial,sans-serif}.sig-comment{font:500 10.667px Calibri,'Microsoft JhengHei',Arial,sans-serif;fill:#555b63}.grp{font:600 10.667px Calibri,'Microsoft JhengHei',Arial,sans-serif}.cond{font:700 10.667px Consolas,'Cascadia Mono',monospace}.bittext{font:600 10.667px Calibri,'Microsoft JhengHei',Arial,sans-serif}.modtitle{font:650 19px Calibri,'Microsoft JhengHei',Arial,sans-serif;fill:#050505}.modsub{font:600 10.667px Calibri,'Microsoft JhengHei',Arial,sans-serif;fill:#050505}`;clone.insertBefore(style,clone.firstChild);return new XMLSerializer().serializeToString(clone)}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),900)}
function imageFromSvg(svgText){return new Promise((resolve,reject)=>{const blob=new Blob([svgText],{type:"image/svg+xml;charset=utf-8"}),u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(u);reject(e)};img.src=u})}
async function renderExportCanvas(scale=3){const encoded=encodeState(makeProject()),svgText=exportSvgText(encoded),w=Math.ceil(presentationContentBounds.width),h=Math.ceil(presentationContentBounds.height),img=await imageFromSvg(svgText),canvas=document.createElement("canvas");canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);const ctx=canvas.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.setTransform(scale,0,0,scale,0,0);ctx.drawImage(img,0,0,w,h);return {canvas,encoded,svgText,w,h}}
function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality))}
function pdfBytesWithJpeg(jpegBytes,imageWidth,imageHeight,pageCssWidth,pageCssHeight,encoded){const enc=new TextEncoder(),parts=[],offsets=[0];let size=0;const push=v=>{const b=typeof v==="string"?enc.encode(v):v;parts.push(b);size+=b.length},obj=(n,body)=>{offsets[n]=size;push(`${n} 0 obj\n${body}\nendobj\n`)};const pageW=Math.max(72,pageCssWidth*.75),pageH=Math.max(72,pageCssHeight*.75);push("%PDF-1.4\n%WrapItfUp reloadable\n");push(`%${makeEmbeddedStateText(encoded).replace(/\n/g,"\n%") }\n`);obj(1,"<< /Type /Catalog /Pages 2 0 R >>");obj(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>");obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);offsets[4]=size;push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);push(jpegBytes);push("\nendstream\nendobj\n");const content=`q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;obj(5,`<< /Length ${content.length} >>\nstream\n${content}endstream`);const xref=size;push("xref\n0 6\n0000000000 65535 f \n");for(let i=1;i<=5;i++)push(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);return concatBytes(...parts)}
async function downloadReloadablePng(){try{const {canvas,encoded}=await renderExportCanvas(3),png=await canvasBlob(canvas,"image/png");if(!png)throw new Error("PNG blob failed");const carrier=await pngBlobWithState(png,encoded),buf=await carrier.arrayBuffer();verifyCarrierEncoded(extractEncodedStatesFromPngBuffer(buf),encoded,"PNG");downloadBlob(carrier,`${projectNameFromEncoded(encoded)}.png`);markWorkspaceSaved(encoded);toast(`Reloadable PNG verified · ${currentCommentCount()} comments saved`)}catch(e){console.error(e);toast(`PNG export failed · ${e?.message||e}`)}}
async function downloadReloadablePdf(){try{const {canvas,encoded,w,h}=await renderExportCanvas(2.5),jpg=await canvasBlob(canvas,"image/jpeg",.96);if(!jpg)throw new Error("JPEG blob failed");const bytes=new Uint8Array(await jpg.arrayBuffer()),pdf=pdfBytesWithJpeg(bytes,canvas.width,canvas.height,w,h,encoded),buf=pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength);verifyCarrierEncoded(extractEncodedStatesFromText(decodeProjectCarrierText(buf,"test.pdf")),encoded,"PDF");downloadBlob(new Blob([pdf],{type:"application/pdf"}),`${projectNameFromEncoded(encoded)}.pdf`);markWorkspaceSaved(encoded);toast(`Reloadable PDF verified · ${currentCommentCount()} comments saved`)}catch(e){console.error(e);toast(`PDF export failed · ${e?.message||e}`)}}

function currentCommentCount(){return [...state.signals.left,...state.signals.right].filter(s=>cleanComment(s.comment)).length}
function verifyVbsCarrierDeterministic(){const project=makeProject(),encoded=encodeState(project),vbs=makeVbs(encoded),found=extractEncodedStatesFromText(vbs);return found.includes(encoded)}
function verifyCarrierEncoded(encodedList,expectedEncoded,label){if(window.WIUProjectHost){const raw=decodeState(expectedEncoded);if(raw.schemaVersion!==undefined){if(!encodedList.includes(expectedEncoded))throw Error(label+" project metadata verification failed");window.WIUProjectHost.read(raw);return {ok:true,scope:"project"};}}if(!Array.isArray(encodedList)||!encodedList.includes(expectedEncoded))throw new Error(`${label} project metadata verification failed`);let raw=null;try{raw=decodeState(expectedEncoded)}catch(err){throw new Error(`${label} state decode failed: ${err?.message||err}`)}const audit=projectCarrierAudit(raw),expectedComments=[...raw.state.signals.left,...raw.state.signals.right].filter(s=>cleanComment(s.comment)).length;if(!audit.ok)throw new Error(`${label} project audit failed: ${audit.error||"invalid state"}`);if(audit.comments!==expectedComments)throw new Error(`${label} comment verification failed (${audit.comments}/${expectedComments})`);return audit}

function projectCarrierAudit(raw){if(raw.schemaVersion!==undefined){try{window.WIUProjectHost.read(raw);return {ok:true,scope:"project"};}catch(e){return {ok:false,error:e.message};}}try{const p=normalizeProjectState(raw),all=[...p.signals.left,...p.signals.right];return {ok:true,left:p.signals.left.length,right:p.signals.right.length,comments:all.filter(s=>cleanComment(s.comment)).length,groups:p.groups.left.length+p.groups.right.length,conditions:(p.conditions?.left?.length||0)+(p.conditions?.right?.length||0),rtlOrder:p.rtlOrder.length}}catch(err){return {ok:false,error:String(err?.message||err)}}}
async function loadProjectFile(file){
 if(!file)return;const name=String(file.name||"");if(/\.v$/i.test(name)){rtlImportOpen();$("#rtlImportSource").value=await file.text();rtlImportAnalyze();return}
 if(file.size>64*1024*1024)throw new Error("File exceeds 64 MB");
 const buf=await file.arrayBuffer();let encoded=[];
 if(/\.png$/i.test(name))encoded=extractEncodedStatesFromPngBuffer(buf);else if(/\.(pdf|svg|vbs)$/i.test(name))encoded=extractEncodedStatesFromText(decodeProjectCarrierText(buf,name));else throw new Error("Use original WrapItfUp PNG, PDF, SVG, VBS or Verilog .v");
 if(!encoded.length)throw new Error("No editable WrapItfUp data. Use the original export, not a screenshot or re-saved image.");
 const workbooks=encoded.map(x=>decodeState(x)).filter(x=>x.schemaVersion!==undefined);if(workbooks.length){if(workbooks.length!==encoded.length||new Set(workbooks.map(x=>JSON.stringify(x))).size!==1)throw Error("Conflicting workbook metadata");window.WIUProjectHost.load(workbooks[0]);return;}if(window.WIUProjectHost){const originals=encoded.map(x=>decodeState(x));if(new Set(originals.map(x=>JSON.stringify(x.state||x))).size!==1)throw Error("Conflicting legacy metadata");window.WIUProjectHost.loadLegacy(originals[0]);return;}
 const candidates=[];let lastErr;
 for(const x of encoded){try{candidates.push(normalizeProjectState(decodeState(x)))}catch(e){lastErr=e}}
 if(!candidates.length)throw new Error(lastErr?.message||"Invalid project metadata");
 if(new Set(candidates.map(p=>JSON.stringify(p))).size>1)throw new Error("Conflicting project snapshots found. Load the original export.");
 finishActiveEditHistory();const before=snapshotState();state=candidates[0];side="left";activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};clearAllSelections();nameFormatTarget=null;previewView.fit=true;commitHistorySnapshot(before);render();
 markWorkspaceSaved(null,"已載入");toast(`Loaded ${state.moduleName} · ${state.signals.left.length+state.signals.right.length} rows · Ctrl+Z undo`)
}
function normalizeProjectState(raw){const src=raw&&raw.state&&["WrapperSignalStudio","WrapItfUp","WrapItfUp"].includes(raw.format)?raw.state:raw;if(!src||typeof src!=="object"||!src.signals||!Array.isArray(src.signals.left)||!Array.isArray(src.signals.right)||typeof src.moduleName!=="string")throw new Error("Invalid project: missing module name or signal lists");const ids=new Set();for(const which of ["left","right"]){for(const list of [src.signals[which],src.groups?.[which]||[],src.conditions?.[which]||[]]){if(!Array.isArray(list))throw new Error("Invalid project list");for(const item of list){if(!item||typeof item!=="object")throw new Error("Invalid project row");if(item.id){if(!/^[A-Za-z0-9_-]+$/.test(item.id)||ids.has(item.id))throw new Error("Invalid or duplicate row ID");ids.add(item.id)}}}}const rawLayout=src.layout||{},next={parameters:String(src.parameters||""),moduleName:String(src.moduleName??"Ethernet Wrapper"),moduleFormatRuns:normalizeFormatRuns(src.moduleFormatRuns,String(src.moduleName??"Ethernet Wrapper").length),showGrid:false,layout:{blockX:Number.isFinite(+rawLayout.blockX)?+rawLayout.blockX:650,blockY:Number.isFinite(+rawLayout.blockY)?+rawLayout.blockY:48,blockWidth:Number.isFinite(+rawLayout.blockWidth)?+rawLayout.blockWidth:500,blockHeight:Number.isFinite(+rawLayout.blockHeight)?+rawLayout.blockHeight:420,leftSignalX:Number.isFinite(+rawLayout.leftSignalX)?+rawLayout.leftSignalX:530,rightSignalX:Number.isFinite(+rawLayout.rightSignalX)?+rawLayout.rightSignalX:1270},rtlOrder:Array.isArray(src.rtlOrder)?src.rtlOrder.map(x=>String(x||"")).filter(Boolean):[],conditions:{left:[],right:[]},groups:{left:[],right:[]},signals:{left:[],right:[]}};for(const which of ["left","right"]){const cs=Array.isArray(src.conditions?.[which])?src.conditions[which]:[];next.conditions[which]=cs.map(c=>({id:String(c?.id||uid()),kind:c?.kind==="ifndef"?"ifndef":"ifdef",macro:cleanMacroLabel(c?.macro)||"FPGA",path:Array.isArray(c?.path)?c.path.map(x=>({scope:String(x.scope||uid()),opening:x.opening==='ifndef'?'ifndef':'ifdef',openingMacro:cleanMacroLabel(x.openingMacro||x.macro)||'FPGA',branch:['elsif','else'].includes(x.branch)?x.branch:(x.opening==='ifndef'?'ifndef':'ifdef'),macro:cleanMacroLabel(x.macro||''),ordinal:Math.max(0,Number(x.ordinal)||0),branches:Array.isArray(x.branches)?x.branches.map(b=>({ordinal:Math.max(0,Number(b.ordinal)||0),branch:['elsif','else'].includes(b.branch)?b.branch:(x.opening==='ifndef'?'ifndef':'ifdef'),macro:cleanMacroLabel(b.macro||'')})):null})):null}));const validConditions=new Set(next.conditions[which].map(c=>c.id));const gs=Array.isArray(src.groups?.[which])?src.groups[which]:[];next.groups[which]=gs.map((g,i)=>{const name=String(g?.name||`Group ${i+1}`);return {id:String(g?.id||uid()),...(g?.originId&&/^[A-Za-z0-9_-]+$/.test(String(g.originId))?{originId:String(g.originId)}:{}),parentId:g?.parentId?String(g.parentId):null,name,color:colorValue(g?.color,COLORS[i%COLORS.length]),formatRuns:normalizeFormatRuns(g?.formatRuns,name.length)}});const validGroups=new Set(next.groups[which].map(g=>g.id));for(const g of next.groups[which]){const seen=new Set([g.id]);let p=g.parentId;while(p){if(!validGroups.has(p)||seen.has(p))throw Error("Invalid group parent or cycle");seen.add(p);p=next.groups[which].find(x=>x.id===p).parentId;}}const ss=Array.isArray(src.signals?.[which])?src.signals[which]:[];next.signals[which]=ss.map(r=>({id:String(r?.id||uid()),signed:!!r?.signed,name:String(r?.name||""),bits:cleanBitsText(r?.bits??"1"),direction:r?.direction==="inout"?"inout":r?.direction==="output"?"output":"input",groupId:validGroups.has(String(r?.groupId??""))?String(r.groupId):null,conditionId:validConditions.has(String(r?.conditionId??""))?String(r.conditionId):null,formatRuns:normalizeFormatRuns(r?.formatRuns,String(r?.name||"").length),lineColor:colorValue(r?.lineColor,"#111b23"),textColor:colorValue(r?.textColor,"#050505"),comment:cleanComment(r?.comment)}))}ensureLayoutState(next);return next}

document.addEventListener("copy",handlePortCopy);
document.addEventListener("cut",handlePortCopy);
document.addEventListener("paste",handlePortPaste,true);
window.addEventListener("keydown",e=>{if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||e.target.closest?.("#r73-editor,#r74-find")||(e.altKey&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))||((e.ctrlKey||e.metaKey)&&["z","y"].includes(e.key.toLowerCase())&&e.target.matches?.("input:not([readonly]),textarea:not([readonly])")))return;if(!$("#quickHelp").hidden){if(e.key==="Escape"){e.preventDefault();closeQuickHelp()}trapDialogTab(e,$("#quickHelp"));return}if(!$("#rtlImportBackdrop")?.hidden){if(e.key==="Escape"){e.preventDefault();rtlImportClose()}else if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();rtlImportApplySelected()}else trapDialogTab(e,$("#rtlImportDialog"));return}if(handleWorkspaceKey(e))return;const k=String(e.key||"").toLowerCase(),mod=e.ctrlKey||e.metaKey,editing=isEditableTarget(e.target),plainF5=e.key==="F5"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey;if(plainF5&&!presentationOpen){e.preventDefault();e.stopPropagation();enterPresentation();return}if(presentationOpen)return;if(editing&&e.key==="Escape"){e.preventDefault();if(history.tx!==null){const before=history.tx;history.tx=null;history.applying=true;try{state=JSON.parse(before)}finally{history.applying=false}render();toast("Edit cancelled")}else e.target.blur();return}if(editing&&e.key==="Enter"&&!e.altKey&&!e.ctrlKey&&!e.metaKey){if(e.target.matches?.("[data-inline-module]")&&e.shiftKey)return;e.preventDefault();if(moveExcelSignalEditor(e.target,"Enter",e.shiftKey))return;e.target.blur();return}if(editing&&e.key==="Tab"&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&excelFieldInfo(e.target)){e.preventDefault();if(moveExcelSignalEditor(e.target,"Tab",e.shiftKey))return}if(mod&&(k==="b"||k==="i")){if(e.target?.matches?.('.signal-card input[data-act="name"],#rows input[data-act="name"]')||rowSelection[side].size){e.preventDefault();if(e.target?.matches?.('.signal-card input[data-act="name"],#rows input[data-act="name"]'))rememberNameSelection(e.target);applyToolbarFormat(k==="b"?1:2);return}}if(mod&&(k==="z"||k==="y")){e.preventDefault();if(k==="y"||(k==="z"&&e.shiftKey))redo();else undo();return}if(editing&&isBitField(e.target)&&mod&&e.key==="Delete"){e.preventDefault();finishActiveEditHistory();if(!rowSelection[e.target.dataset.side||side]?.has(e.target.dataset.id)){clearAllSelections();const which=e.target.dataset.side||side,id=e.target.dataset.id||e.target.closest("tr")?.dataset.id;if(id)rowSelection[which].add(id)}deleteSelectedRows();return}if(mod&&(k==="c"||k==="x")&&keyboardContext!=="rtl"&&!editing&&selectedRowsAll().length>1){finishActiveEditHistory();previewCanvas?.focus?.({preventScroll:true});return}if(mod&&k==="c"&&keyboardContext==="rtl"&&!editing){e.preventDefault();copyRtlText();return}if(mod&&k==="s"){e.preventDefault();if(e.shiftKey){$("#vbsBtn").click();toast("Reloadable VBS downloaded · Ctrl+Shift+S")}else $("#pngBtn").click();return}if(mod&&k==="o"){e.preventDefault();$("#loadProjectBtn").click();return}if(editing)return;if(!mod&&k==="f"){e.preventDefault();fitPreview();return}if(e.key==="?"){e.preventDefault();openQuickHelp();return}if(mod&&k==="a"){e.preventDefault();selectAllRows();return}if(e.key==="Delete"||e.key==="Backspace"){if(selectedRowsAll().length){e.preventDefault();deleteSelectedRows()}return}if(e.key==="Enter"||e.key==="F2"){if(selectedRowsAll().length){e.preventDefault();focusSelectedName()}return}if(e.key==="Escape"){if(selectedRowsAll().length){e.preventDefault();clearAllSelections();renderRows();renderInlineSelectionState();updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar()}return}if(e.key==="ArrowDown"){e.preventDefault();moveRowSelection(1,e.shiftKey);return}if(e.key==="ArrowUp"){e.preventDefault();moveRowSelection(-1,e.shiftKey);return}
if(!mod&&!e.altKey&&["w","a","s","d"].includes(k)){e.preventDefault();const step=e.shiftKey?180:72;let dx=0,dy=0;if(k==="d")dx=-step;else if(k==="a")dx=step;else if(k==="s")dy=-step;else if(k==="w")dy=step;if(dx||dy){nudgePreview(dx,dy);previewCanvas?.focus?.({preventScroll:true})}return}},true);
const workspace=$("#workspace"),splitter=$("#splitter");let splitDrag=null;
function setEditorWidth(px,savePref=true){if(!workspace||window.innerWidth<=760)return;const min=340,max=Math.max(min,window.innerWidth*.48),w=Math.max(min,Math.min(max,px));workspace.style.gridTemplateColumns=`${w}px 5px minmax(0,1fr)`;if(savePref)try{localStorage.setItem("wrapitfup-editor-width",String(Math.round(w)))}catch{}if(previewView.fit)requestAnimationFrame(fitPreview)}
try{const saved=+localStorage.getItem("wrapitfup-editor-width");if(saved>0)setEditorWidth(saved,false)}catch{}
splitter?.addEventListener("pointerdown",e=>{e.preventDefault();splitDrag={pointerId:e.pointerId,startX:e.clientX,startW:workspace.getBoundingClientRect().width-$(".preview-pane").getBoundingClientRect().width-5};splitter.setPointerCapture?.(e.pointerId);splitter.classList.add("dragging")});
splitter?.addEventListener("pointermove",e=>{if(!splitDrag||e.pointerId!==splitDrag.pointerId)return;setEditorWidth(splitDrag.startW+(e.clientX-splitDrag.startX))});
function endSplit(e){if(!splitDrag||(e?.pointerId!=null&&e.pointerId!==splitDrag.pointerId))return;splitDrag=null;splitter.classList.remove("dragging")}splitter?.addEventListener("pointerup",endSplit);splitter?.addEventListener("pointercancel",endSplit);splitter?.addEventListener("dblclick",()=>setEditorWidth(window.innerWidth*.32));
const presentation=$("#presentation"),presentStage=$("#presentStage"),presentHud=$("#presentHud");
function refreshPresentationSvg(){if(!presentationOpen||!presentStage)return;const scene=sharedDiagramScene();presentationContentBounds=scene.bounds;presentStage.innerHTML=window.WIUDiagramScene.svg(scene).replace("diagramSvg","presentationSvg");applyPresentTransform()}
function updatePresentZoom(){const z=$("#presentZoom");if(z)z.textContent=`${Math.round(presentView.scale*100)}%`}
function applyPresentTransform(){if(presentStage)presentStage.style.transform=`translate3d(${presentView.x}px,${presentView.y}px,0) scale(${presentView.scale})`;updatePresentZoom()}
function fitPresentation(){if(!presentationOpen||!presentation)return;const r=presentation.getBoundingClientRect(),b=presentationContentBounds,m=Math.max(10,Math.min(22,Math.min(r.width,r.height)*.018)),aw=Math.max(1,r.width-m*2),ah=Math.max(1,r.height-m*2),s=Math.max(.08,Math.min(8,Math.min(aw/b.width,ah/b.height)));presentView={scale:s,x:(r.width-b.width*s)/2-b.x*s,y:(r.height-b.height*s)/2-b.y*s,fit:true};applyPresentTransform()}
function revealPresentHud(delay=1500){if(!presentHud)return;presentHud.classList.add("visible");clearTimeout(presentHudTimer);presentHudTimer=setTimeout(()=>presentHud.classList.remove("visible"),delay)}
function enterPresentation(){if(presentationOpen)return;presentationOpen=true;presentation.classList.add("open");presentation.setAttribute("aria-hidden","false");refreshPresentationSvg();requestAnimationFrame(()=>{fitPresentation();presentation.focus({preventScroll:true});revealPresentHud(1800)});ownsPresentationFullscreen=false;if(!document.fullscreenElement&&presentation.requestFullscreen){try{const p=presentation.requestFullscreen({navigationUI:"hide"});p?.then?.(()=>{ownsPresentationFullscreen=document.fullscreenElement===presentation}).catch?.(()=>{})}catch{}}}
function exitPresentation(){if(!presentationOpen)return;presentationOpen=false;presentation.classList.remove("open","dragging");presentation.setAttribute("aria-hidden","true");presentPan=null;clearTimeout(presentHudTimer);if(ownsPresentationFullscreen&&document.fullscreenElement&&document.exitFullscreen){try{document.exitFullscreen()?.catch?.(()=>{})}catch{}}ownsPresentationFullscreen=false;$("#canvas")?.focus?.({preventScroll:true})}
presentation?.addEventListener("wheel",e=>{if(!presentationOpen)return;e.preventDefault();const r=presentation.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,old=presentView.scale,next=Math.max(.08,Math.min(8,old*Math.exp(-e.deltaY*.00125))),wx=(px-presentView.x)/old,wy=(py-presentView.y)/old;presentView={scale:next,x:px-wx*next,y:py-wy*next,fit:false};applyPresentTransform();revealPresentHud()},{passive:false});
presentation?.addEventListener("pointerdown",e=>{if(e.button!==0||e.target.closest(".present-hud"))return;e.preventDefault();presentView.fit=false;presentPan={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:presentView.x,originY:presentView.y};presentation.setPointerCapture?.(e.pointerId);presentation.classList.add("dragging");presentHud.classList.remove("visible")});
presentation?.addEventListener("pointermove",e=>{if(!presentPan||e.pointerId!==presentPan.pointerId)return;e.preventDefault();presentView.x=presentPan.originX+(e.clientX-presentPan.startX);presentView.y=presentPan.originY+(e.clientY-presentPan.startY);applyPresentTransform()});
function endPresentPan(e){if(!presentPan||(e?.pointerId!=null&&e.pointerId!==presentPan.pointerId))return;presentPan=null;presentation.classList.remove("dragging");revealPresentHud()}presentation?.addEventListener("pointerup",endPresentPan);presentation?.addEventListener("pointercancel",endPresentPan);presentation?.addEventListener("mousemove",()=>{if(presentationOpen&&!presentPan)revealPresentHud()});
window.addEventListener("keydown",e=>{if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||e.target.closest?.("#r73-editor,#r74-find")||(e.altKey&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))||((e.ctrlKey||e.metaKey)&&["z","y"].includes(e.key.toLowerCase())&&e.target.matches?.("input:not([readonly]),textarea:not([readonly])")))return;if(!presentationOpen)return;const k=String(e.key||"").toLowerCase(),handled=e.key==="F5"||e.key==="Escape"||["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)||["w","a","s","d","f"].includes(k);if(handled){e.preventDefault();e.stopPropagation()}if(e.key==="Escape"){exitPresentation();return}if(e.key==="F5"||k==="f"){fitPresentation();revealPresentHud();return}const step=e.shiftKey?180:72;let dx=0,dy=0;if(e.key==="ArrowRight"||k==="d")dx=-step;else if(e.key==="ArrowLeft"||k==="a")dx=step;else if(e.key==="ArrowDown"||k==="s")dy=-step;else if(e.key==="ArrowUp"||k==="w")dy=step;if(dx||dy){presentView.fit=false;presentView.x+=dx;presentView.y+=dy;applyPresentTransform();revealPresentHud()}},true);
document.addEventListener("fullscreenchange",()=>{if(presentationOpen&&ownsPresentationFullscreen&&!document.fullscreenElement){ownsPresentationFullscreen=false;exitPresentation()}});
$("#presentBtn").onclick=enterPresentation;$("#presentFit").onclick=()=>{fitPresentation();revealPresentHud()};$("#presentExit").onclick=exitPresentation;
let keyboardContext="diagram";
$("#rtlPanel")?.addEventListener("pointerdown",()=>{keyboardContext="rtl"},true);
$("#rtlPanel")?.addEventListener("focusin",()=>{keyboardContext="rtl"});
$("#canvas")?.addEventListener("pointerdown",()=>{keyboardContext="diagram"},true);
const previewCanvas=$("#canvas");
let inlineDrag=null,inlineDrop=null,inlinePointerDrag=null;
let previewPanPending=null,spacePanHeld=false;
document.addEventListener("keydown",e=>{if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||e.target.closest?.("#r73-editor,#r74-find")||(e.altKey&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))||((e.ctrlKey||e.metaKey)&&["z","y"].includes(e.key.toLowerCase())&&e.target.matches?.("input:not([readonly]),textarea:not([readonly])")))return;if(e.code==="Space"&&!isEditableTarget(e.target)&&!presentationOpen){spacePanHeld=true;previewCanvas?.classList.add("space-pan-ready")}},true);
document.addEventListener("keyup",e=>{if(e.code==="Space"){spacePanHeld=false;previewCanvas?.classList.remove("space-pan-ready")}},true);
window.addEventListener("blur",()=>{spacePanHeld=false;previewCanvas?.classList.remove("space-pan-ready")});
function preserveInlineFocus(el,fn){const card=el?.closest?.(".signal-card"),which=card?.dataset.side,id=card?.dataset.id,act=el?.dataset.act,a=el?.selectionStart,b=el?.selectionEnd;fn();if(which&&id&&act)requestAnimationFrame(()=>{const n=$(`.signal-card[data-side="${which}"][data-id="${id}"] [data-act="${act}"]`);n?.focus({preventScroll:true});try{if(a!=null)n.setSelectionRange(a,b)}catch{}if(act==="name")rememberNameSelection(n)})}
function focusAndSelectSignalName(which,id){requestAnimationFrame(()=>{const n=findNameInput(which,id);if(!n)return;n.focus({preventScroll:true});try{n.select()}catch{}rememberNameSelection(n)})}

$("#addLeftSignal").onclick=()=>addInlineSignal("left");$("#addRightSignal").onclick=()=>addInlineSignal("right");$("#addGroupInline").onclick=addInlineGroup;


previewCanvas?.addEventListener("pointerdown",e=>{
  const bit=e.target.closest?.(".line-length-editor");
  if(!bit||!(e.shiftKey||e.ctrlKey||e.metaKey)||e.button!==0)return;
  e.preventDefault();
  e.stopPropagation();
  finishActiveEditHistory();
  selectRow(bit.dataset.id,e,bit.dataset.side);
  previewCanvas.focus?.({preventScroll:true});
},true);


previewCanvas?.addEventListener("click",e=>{const arrow=e.target.closest?.("[data-direction-toggle]"),gapEdit=e.target.closest?.("[data-gap-edit]"),del=e.target.closest("[data-inline-delete]"),card=e.target.closest(".signal-card,.inline-gap"),cond=e.target.closest(".inline-condition-label"),grp=e.target.closest(".inline-group-label");if(grp&&e.target.matches("[data-inline-group-delete]")){e.preventDefault();e.stopPropagation();const which=grp.dataset.side,id=grp.dataset.inlineGroup;withHistory(()=>{removeCanvasGroup(which,id)});if(activeGroupId[which]===id)activeGroupId[which]=null;render();toast("Group deleted · signals kept as ungrouped");return}if(cond&&e.target.matches("[data-condition-kind-toggle]")){e.preventDefault();e.stopPropagation();const which=cond.dataset.side,c=conditionById(which,cond.dataset.inlineCondition);if(c&&!c.path){withHistory(()=>{c.kind=c.kind==="ifndef"?"ifdef":"ifndef"});render();focusConditionMacro(which,c.id);toast(conditionText(c))}return}if(cond&&e.target.matches("[data-condition-delete]")){e.preventDefault();e.stopPropagation();const which=cond.dataset.side,id=cond.dataset.inlineCondition;withHistory(()=>{state.conditions[which]=state.conditions[which].filter(c=>c.id!==id);state.signals[which].forEach(sig=>{if(sig.conditionId===id)sig.conditionId=null})});if(activeConditionId[which]===id)activeConditionId[which]=null;render();toast("Condition removed · signals kept");return}if(cond&&!e.target.matches("input,select,button")){side=cond.dataset.side;activeConditionId[side]=cond.dataset.inlineCondition;renderInlineSelectionState();updateConditionAssignToolbar();focusExcelText(cond.querySelector("input[data-condition-macro]"),true);return}if(gapEdit&&card){e.preventDefault();e.stopPropagation();const which=card.dataset.side,s=state.signals[which]?.find(r=>r.id===card.dataset.id);if(s){withHistory(()=>{s.name=allocatePortNames(["signal_name"],portNamesInUse())[0];s.formatRuns=[]});side=which;clearAllSelections();rowSelection[which].add(s.id);selectionAnchor[which]=s.id;render();focusAndSelectSignalName(which,s.id);toast("Gap converted to editable signal")}return}if(arrow){e.preventDefault();e.stopPropagation();const which=arrow.dataset.side,s=state.signals[which]?.find(r=>r.id===arrow.dataset.id);if(s){if(e.shiftKey||e.ctrlKey||e.metaKey)selectRow(s.id,e,which);else if(arrow.classList.contains("dir-arrow-hit"))cyclePortDirection(which,s.id);else{finishActiveEditHistory();selectRow(s.id,e,which);syncDeskSelection()}}return}if(del&&card){e.preventDefault();e.stopPropagation();const which=card.dataset.side,id=card.dataset.id;withHistory(()=>{state.signals[which]=state.signals[which].filter(r=>r.id!==id)});rowSelection[which].delete(id);if(selectionAnchor[which]===id)selectionAnchor[which]=null;render();return}if(grp&&!e.target.matches("input,button")){const which=grp.dataset.side;side=which;activeGroupId[which]=grp.dataset.inlineGroup;renderInlineSelectionState();updateColorToolbar();focusExcelText(grp.querySelector("input[data-inline-group-name]"),true);return}if(card&&!isEditableTarget(e.target)&&!e.target.closest("[data-card-drag]")){selectRow(card.dataset.id,e,card.dataset.side)}});
previewCanvas?.addEventListener("change",e=>{const cond=e.target.closest?.(".inline-condition-label");if(cond&&e.target.matches("[data-condition-kind]")){const which=cond.dataset.side,c=conditionById(which,cond.dataset.inlineCondition);if(c){withHistory(()=>{c.kind=e.target.value==="ifndef"?"ifndef":"ifdef"});render();toast(conditionText(c))}}});
previewCanvas?.addEventListener("input",e=>{if(e.target.matches("[data-inline-module]")){const next=e.target.value;if(next!==state.moduleName)state.moduleFormatRuns=[];state.moduleName=next;const rich=e.target.closest(".block-title-editor")?.querySelector(".module-rich");if(rich)rich.innerHTML=styledNameHtml(moduleFormatObject());renderRtlDeclarations();save();syncModuleEditorVisual(e.target);rememberNameSelection(e.target);return}if(e.target.matches("[data-line-length]")){const which=e.target.dataset.side,s=state.signals[which]?.find(r=>r.id===e.target.dataset.id);if(!s)return;if(history.tx===null)beginHistory();side=which;s.bits=cleanBitsText(e.target.value);renderRows();renderRtlDeclarations();save();renderDiagram(true);return}const note=e.target.closest(".signal-comment-editor");if(note&&e.target.matches('[data-act="comment"]')){const which=note.dataset.side,s=state.signals[which]?.find(r=>r.id===note.dataset.id);if(!s)return;if(history.tx===null)beginHistory();side=which;s.comment=cleanCommentLive(e.target.value);syncPortCommentVisuals(which);renderRtlDeclarations();save();return}const card=e.target.closest(".signal-card"),cond=e.target.closest(".inline-condition-label"),grp=e.target.closest(".inline-group-label");if(cond&&e.target.matches("[data-condition-macro]")){const which=cond.dataset.side,c=conditionById(which,cond.dataset.inlineCondition);if(c&&!c.path){if(history.tx===null)beginHistory();c.macro=cleanMacroLabelLive(e.target.value);e.target.value=c.macro;syncInlineCommentedState();renderRtlDeclarations();save()}return}if(cond&&e.target.matches("[data-condition-kind]"))return;if(grp&&e.target.matches("[data-inline-group-name]")){const which=grp.dataset.side,g=groupById(which,grp.dataset.inlineGroup);if(g){if(history.tx===null)beginHistory();const next=e.target.value;if(next!==g.name)g.formatRuns=[];g.name=next;const rich=grp.querySelector(".group-rich");if(rich)rich.innerHTML=styledNameHtml(g);syncInlineCommentedState();const topInput=$(`[data-gname='${g.id}']`);if(topInput&&topInput!==e.target)topInput.value=g.name;renderRtlDeclarations();save();rememberNameSelection(e.target)}return}if(!card)return;const which=card.dataset.side,s=state.signals[which].find(r=>r.id===card.dataset.id),act=e.target.dataset.act;if(!s||!act)return;side=which;if(act==="name"){if(history.tx===null)beginHistory();const next=cleanSignalNameLive(e.target.value);if(next!==s.name)s.formatRuns=[];s.name=next;e.target.value=next;const rich=card.querySelector(".name-rich");if(rich)rich.innerHTML=styledNameHtml(s);syncInlineCommentedState();rememberNameSelection(e.target);renderRows();renderRtlDeclarations();save();renderDiagram(true);updateFormatToolbar();return}renderRows();renderRtlDeclarations();save();updateFormatToolbar()});
previewCanvas?.addEventListener("change",e=>{if(e.target.matches("[data-line-length]")){renderDiagram();renderRtlDeclarations();save()}});
previewCanvas?.addEventListener("focusin",e=>{const card=e.target.closest?.(".signal-card"),len=e.target.matches?.("[data-line-length]")?e.target:null,note=e.target.closest?.(".signal-comment-editor"),target=card||len||note;if(target&&target.dataset.side&&!rowSelection[target.dataset.side].has(target.dataset.id)){clearAllSelections();rowSelection[target.dataset.side].add(target.dataset.id);selectionAnchor[target.dataset.side]=target.dataset.id;side=target.dataset.side;renderInlineSelectionState();updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar();updateConditionAssignToolbar()}if(e.target.matches?.('.signal-card input[data-act="name"]'))rememberNameSelection(e.target);if(e.target.matches?.('[data-inline-module]'))syncModuleEditorVisual(e.target);if(isBitField(e.target))refreshBitSelectionState()});previewCanvas?.addEventListener("select",e=>{if(e.target.matches?.('.signal-card input[data-act="name"]'))rememberNameSelection(e.target)});
function showInlineInsertionLine(targetSide,clientY){
 const canvas=previewCanvas.getBoundingClientRect(),layout=ensureLayoutState();
 const center=canvas.left+previewView.x+(layout.blockX+layout.blockWidth/2)*previewView.scale;
 const left=targetSide==='left'?canvas.left:Math.max(canvas.left,center);
 const right=targetSide==='right'?canvas.right:Math.min(canvas.right,center);
 const inset=Math.min(12,Math.max(0,(right-left)/6));
 let line=$('#r109-inline-drop-line');
 if(!line){
  line=document.createElement('div');line.id='r109-inline-drop-line';line.setAttribute('aria-hidden','true');
  line.style.cssText='position:absolute;pointer-events:none;z-index:60;height:0;border-top:3px solid var(--accent,#007aff);box-shadow:0 0 0 1px #fff;';
  previewCanvas.append(line);
 }
 line.style.left=(left+inset-canvas.left)+'px';
 line.style.width=Math.max(1,right-left-2*inset)+'px';
 line.style.top=(Math.max(canvas.top+2,Math.min(canvas.bottom-3,clientY))-canvas.top)+'px';
 line.hidden=false;
}
function cancelInlineDragOnEscape(e){
 if(e.key!=='Escape'||!inlinePointerDrag)return;
 e.preventDefault();e.stopImmediatePropagation();finishInlinePointerDrag(e,true);
}
window.addEventListener('blur',()=>finishInlinePointerDrag(null,true));
function clearInlineDropVisuals(){
 const intent=$('#dragIntent');if(intent)intent.hidden=true;
 const line=$('#r109-inline-drop-line');if(line)line.hidden=true;
 $$('.signal-card,.inline-gap').forEach(row=>row.classList.remove('drop-before','drop-after','dragging'));
 $$('.inline-group-label,.inline-condition-label').forEach(label=>label.classList.remove('drop-target'));
 previewCanvas?.classList.remove('drag-side-left','drag-side-right');inlineDrop=null;
}
function screenDropSide(clientX){const r=previewCanvas.getBoundingClientRect(),l=ensureLayoutState(),cx=r.left+previewView.x+(l.blockX+l.blockWidth/2)*previewView.scale;return clientX<cx?"left":"right"}
function markInlineDraggedRows(){if(!inlineDrag)return;for(const id of inlineDrag.ids)$(`.signal-card[data-side="${inlineDrag.sourceSide}"][data-id="${id}"],.inline-gap[data-side="${inlineDrag.sourceSide}"][data-id="${id}"]`)?.classList.add("dragging")}
function updateInlinePointerDrop(clientX,clientY){
 if(!inlineDrag)return;
 clearInlineDropVisuals();markInlineDraggedRows();
 const canvas=previewCanvas.getBoundingClientRect();
 if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||clientX<canvas.left||clientX>canvas.right||clientY<canvas.top||clientY>canvas.bottom)return;
 const targetSide=screenDropSide(clientX),hit=document.elementFromPoint(clientX,clientY);
 const condition=hit?.closest?.('.inline-condition-label'),group=hit?.closest?.('.inline-group-label');
 previewCanvas.classList.add(targetSide==='left'?'drag-side-left':'drag-side-right');
 // Dropping directly on a label remains an explicit grouping action.
 if(condition?.dataset.side===targetSide&&condition.closest('#canvas')===previewCanvas){
  condition.classList.add('drop-target');inlineDrop={kind:'condition',targetSide,conditionId:condition.dataset.inlineCondition};
 }else if(group?.dataset.side===targetSide&&group.closest('#canvas')===previewCanvas){
  group.classList.add('drop-target');inlineDrop={kind:'group',targetSide,groupId:group.dataset.inlineGroup};
 }else{
  const cards=Array.from(previewCanvas.querySelectorAll('.signal-card,.inline-gap'));
  const byId=new Map(cards.filter(card=>card.dataset.side===targetSide).map(card=>[card.dataset.id,card]));
  const moving=targetSide===inlineDrag.sourceSide?new Set(inlineDrag.ids):new Set();
  const rows=state.signals[targetSide].filter(row=>!moving.has(row.id)).map(row=>{
   const card=byId.get(row.id),box=card?.getBoundingClientRect();return {row,card,box};
  }).filter(entry=>entry.box&&entry.box.height>0);
  const next=rows.find(entry=>clientY<entry.box.top+entry.box.height/2);
  const target=next||rows.at(-1),before=!!next;
  if(target){
   target.card.classList.add(before?'drop-before':'drop-after');
   inlineDrop={kind:'row',targetSide,targetId:target.row.id,before};
   showInlineInsertionLine(targetSide,before?target.box.top:target.box.bottom);
  }else{
   inlineDrop={kind:'append',targetSide};
   const firstTop=Math.min(...cards.map(card=>card.getBoundingClientRect()).filter(box=>box.height>0).map(box=>box.top));
   showInlineInsertionLine(targetSide,Number.isFinite(firstTop)?firstTop:clientY);
  }
 }
 showDeskDropIntent();
}
function commitInlineMove(clientX){if(!inlineDrag)return false;const sourceSide=inlineDrag.sourceSide,targetSide=inlineDrop?.targetSide||screenDropSide(clientX)||sourceSide,sourceRows=state.signals[sourceSide],movingSet=new Set(inlineDrag.ids),movingRows=sourceRows.filter(r=>movingSet.has(r.id));if(!movingRows.length)return false;const sourceGroups=new Map(movingRows.map(r=>[r.id,groupDescriptor(sourceSide,r)])),sourceConditions=new Map(movingRows.map(r=>[r.id,conditionDescriptor(sourceSide,r)]));let clonedGroups=0,clonedConditions=0;withHistory(()=>{const sourceRemaining=sourceRows.filter(r=>!movingSet.has(r.id));if(targetSide===sourceSide){if(inlineDrop?.kind==="group"){for(const r of movingRows)r.groupId=inlineDrop.groupId;state.signals[sourceSide]=sourceRows}else if(inlineDrop?.kind==="condition"){for(const r of movingRows)r.conditionId=inlineDrop.conditionId;state.signals[sourceSide]=sourceRows}else if(inlineDrop?.kind==="row"){const targetIndex=sourceRemaining.findIndex(r=>r.id===inlineDrop.targetId),at=targetIndex<0?sourceRemaining.length:targetIndex+(inlineDrop.before?0:1);state.signals[sourceSide]=[...sourceRemaining.slice(0,at),...movingRows,...sourceRemaining.slice(at)]}else state.signals[sourceSide]=[...sourceRemaining,...movingRows]}else{state.signals[sourceSide]=sourceRemaining;const dest=state.signals[targetSide],targetRow=inlineDrop?.kind==="row"?dest.find(r=>r.id===inlineDrop.targetId):null,explicitGroup=inlineDrop?.kind==="group"?inlineDrop.groupId:null,explicitCondition=inlineDrop?.kind==="condition"?inlineDrop.conditionId:null,groupCache=new Map(),conditionCache=new Map(),groupsBefore=state.groups[targetSide].length,conditionsBefore=state.conditions[targetSide].length;for(const r of movingRows){if(explicitGroup)r.groupId=explicitGroup;else{const gd=sourceGroups.get(r.id);r.groupId=gd?ensureGroupOnSide(targetSide,gd,groupCache,null,true):null}if(explicitCondition)r.conditionId=explicitCondition;else{const cd=sourceConditions.get(r.id);r.conditionId=cd?ensureConditionOnSide(targetSide,cd,conditionCache):null}}clonedGroups=Math.max(0,state.groups[targetSide].length-groupsBefore);clonedConditions=Math.max(0,state.conditions[targetSide].length-conditionsBefore);let at=dest.length;if(inlineDrop?.kind==="row"){const ti=dest.findIndex(r=>r.id===inlineDrop.targetId);if(ti>=0)at=ti+(inlineDrop.before?0:1)}state.signals[targetSide]=[...dest.slice(0,at),...movingRows,...dest.slice(at)]}});clearAllSelections();for(const r of movingRows)rowSelection[targetSide].add(r.id);selectionAnchor[targetSide]=movingRows[0]?.id||null;side=targetSide;if(inlineDrop?.kind==="group")activeGroupId[targetSide]=inlineDrop.groupId;if(inlineDrop?.kind==="condition")activeConditionId[targetSide]=inlineDrop.conditionId;const crossed=sourceSide!==targetSide,n=movingRows.length,dropKind=inlineDrop?.kind;clearInlineDropVisuals();inlineDrag=null;render();toast(crossed?`${n} signal${n===1?"":"s"} moved ${sourceSide.toUpperCase()} → ${targetSide.toUpperCase()}${clonedGroups?` · ${clonedGroups} group${clonedGroups===1?"":"s"} preserved`:""}${clonedConditions?` · ${clonedConditions} IFDEF preserved`:""}`:dropKind==="condition"?`${n} signal${n===1?"":"s"} assigned to IFDEF`:`${n} row${n===1?"":"s"} moved together`);return true}
previewCanvas?.addEventListener("pointerdown",e=>{const h=e.target.closest?.("[data-card-drag]"),card=h?.closest(".signal-card,.inline-gap");if(!h||!card||e.button!==0)return;e.preventDefault();e.stopPropagation();const sourceSide=card.dataset.side,rows=state.signals[sourceSide],set=rowSelection[sourceSide];if(!set.has(card.dataset.id)){clearAllSelections();set.add(card.dataset.id);selectionAnchor[sourceSide]=card.dataset.id;side=sourceSide;renderInlineSelectionState();updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar()}const ids=rows.filter(r=>set.has(r.id)).map(r=>r.id);inlineDrag={sourceSide,ids};inlinePointerDrag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,dragging:false};try{previewCanvas.setPointerCapture(e.pointerId)}catch{}markInlineDraggedRows()});
previewCanvas?.addEventListener("pointermove",e=>{if(!inlinePointerDrag||inlinePointerDrag.pointerId!==e.pointerId)return;const dist=Math.hypot(e.clientX-inlinePointerDrag.startX,e.clientY-inlinePointerDrag.startY);if(!inlinePointerDrag.dragging&&dist<4)return;inlinePointerDrag.dragging=true;e.preventDefault();updateInlinePointerDrop(e.clientX,e.clientY)});
function finishInlinePointerDrag(e,cancel=false){
 if(!inlinePointerDrag||(e?.pointerId!=null&&inlinePointerDrag.pointerId!==e.pointerId))return;
 const pointerId=inlinePointerDrag.pointerId,moved=inlinePointerDrag.dragging&&!cancel;
 inlinePointerDrag=null;
 try{previewCanvas.releasePointerCapture(pointerId);}catch{}
 if(moved){
  updateInlinePointerDrop(e?.clientX,e?.clientY);
  if(inlineDrop&&commitInlineMove(e.clientX))return;
 }
 clearInlineDropVisuals();inlineDrag=null;
}
previewCanvas?.addEventListener("pointerup",e=>finishInlinePointerDrag(e,false));
previewCanvas?.addEventListener("pointercancel",e=>finishInlinePointerDrag(e,true));

function applyPreviewTransform(){const tr=`translate3d(${previewView.x}px,${previewView.y}px,0) scale(${previewView.scale})`,svg=document.querySelector("#diagramSvg"),layer=document.querySelector("#inlineLayer");if(svg)svg.style.transform=tr;if(layer){layer.style.transform=tr;layer.style.setProperty('--r128-edit-scale',String(1/previewView.scale));}updateZoomReadout();updateBlockOverlay()}
function fitPreview(){const c=document.querySelector("#canvas");if(!c)return;const r=c.getBoundingClientRect(),b=previewContentBounds,m=Math.max(8,Math.min(16,Math.min(r.width,r.height)*.016)),aw=Math.max(1,r.width-m*2),ah=Math.max(1,r.height-m*2),s=clampPreviewScale(Math.min(aw/b.width,ah/b.height));previewView={scale:s,x:(r.width-b.width*s)/2-b.x*s,y:(r.height-b.height*s)/2-b.y*s,fit:true};applyPreviewTransform()}
function nudgePreview(dx,dy){previewView.fit=false;previewView.x+=dx;previewView.y+=dy;applyPreviewTransform()}
function applyBlockResize(clientX,clientY){if(!blockResize)return;const s=blockResize.scale||1,dx=(clientX-blockResize.startX)/s,dy=(clientY-blockResize.startY)/s,h=blockResize.handle,start=blockResize.start,gap=DEFAULT_WIRE_MIN,minW=contentDrivenBlockMinWidth(state),maxW=1700;let x=start.blockX,y=start.blockY,w=start.blockWidth,hh=start.blockHeight;if(h.includes("e"))w=start.blockWidth+dx;if(h.includes("s"))hh=start.blockHeight+dy;if(h.includes("w")){x=start.blockX+dx;w=start.blockWidth-dx}if(h.includes("n")){y=start.blockY+dy;hh=start.blockHeight-dy}const leftLimit=120+gap,rightLimit=1830-gap;if(h.includes("w")){const right=start.blockX+start.blockWidth;x=Math.max(leftLimit,Math.min(x,right-minW));w=right-x}else if(h.includes("e"))w=Math.max(minW,Math.min(maxW,rightLimit-start.blockX,w));else{x=Math.max(leftLimit,Math.min(x,rightLimit-minW));w=Math.max(minW,Math.min(maxW,Math.min(w,rightLimit-x)))}state.layout={...state.layout,blockX:x,blockY:y,blockWidth:w,blockHeight:hh,leftSignalX:Math.min(start.leftSignalX,x-gap),rightSignalX:Math.max(start.rightSignalX,x+w+gap)};ensureLayoutState();renderDiagram(true);applyPreviewTransform();save()}
function endBlockResize(e){if(!blockResize||(e?.pointerId!=null&&blockResize.pointerId!==e.pointerId))return;try{if(e?.target?.hasPointerCapture?.(blockResize.pointerId))e.target.releasePointerCapture(blockResize.pointerId)}catch{}try{if(previewCanvas.hasPointerCapture?.(blockResize.pointerId))previewCanvas.releasePointerCapture(blockResize.pointerId)}catch{}blockResize=null;previewCanvas.classList.remove("is-resizing");endHistory();toast("Block resized")}
function applySignalRailDrag(clientX){if(!signalRailDrag)return;const dx=(clientX-signalRailDrag.startX)/(signalRailDrag.scale||1),l=ensureLayoutState(),gap=DEFAULT_WIRE_MIN;if(signalRailDrag.which==="left")l.leftSignalX=Math.max(120,Math.min(l.blockX-gap,signalRailDrag.startValue+dx));else l.rightSignalX=Math.min(1830,Math.max(l.blockX+l.blockWidth+gap,signalRailDrag.startValue+dx));renderDiagram(true);applyPreviewTransform();save()}
function endSignalRailDrag(e){if(!signalRailDrag||(e?.pointerId!=null&&signalRailDrag.pointerId!==e.pointerId))return;try{previewCanvas.releasePointerCapture(signalRailDrag.pointerId)}catch{}signalRailDrag=null;previewCanvas.classList.remove("is-rail-dragging");endHistory();toast("Signal rail moved · VBS geometry updated")}
$("#fitBtn").onclick=()=>{fitPreview();previewCanvas.focus({preventScroll:true})};
previewCanvas.addEventListener("wheel",e=>{e.preventDefault();const r=previewCanvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;previewView.fit=false;const old=previewView.scale,next=clampPreviewScale(old*Math.exp(-e.deltaY*.00125)),wx=(px-previewView.x)/old,wy=(py-previewView.y)/old;previewView.scale=next;previewView.x=px-wx*next;previewView.y=py-wy*next;applyPreviewTransform()},{passive:false});
function isInlineTextEditor(el){return !!el?.matches?.('[data-inline-module],.signal-card input[data-act="name"],.signal-comment-editor input[data-act="comment"],.line-length-editor,.inline-group-label input,.inline-condition-label input')}
function isExcelDiagramText(el){return !!el?.matches?.('[data-inline-module],.signal-card input[data-act="name"],.signal-comment-editor input[data-act="comment"],.line-length-editor,.inline-group-label input[data-inline-group-name],.inline-condition-label input[data-condition-macro]')}
let excelSelectAllPending=null;
function excelFieldInfo(el){if(!el)return null;const tr=el.closest?.('#rows tr');if(tr&&el.matches?.('input[data-act="name"],input[data-act="bits"],input[data-act="comment"]'))return {kind:el.dataset.act,side,id:tr.dataset.id,surface:'table'};if(el.matches?.('.signal-card input[data-act="name"]')){const c=el.closest('.signal-card');return {kind:'name',side:c?.dataset.side,id:c?.dataset.id,surface:'diagram'}}if(el.matches?.('.line-length-editor'))return {kind:'bits',side:el.dataset.side,id:el.dataset.id,surface:'diagram'};if(el.matches?.('.signal-comment-editor input[data-act="comment"]')){const c=el.closest('.signal-comment-editor');return {kind:'comment',side:c?.dataset.side,id:c?.dataset.id,surface:'diagram'}}if(el.matches?.('[data-inline-group-name]')){const c=el.closest('.inline-group-label');return {kind:'group',side:c?.dataset.side,id:c?.dataset.inlineGroup,surface:'diagram'}}if(el.matches?.('[data-condition-macro]')){const c=el.closest('.inline-condition-label');return {kind:'condition',side:c?.dataset.side,id:c?.dataset.inlineCondition,surface:'diagram'}}if(el.matches?.('[data-inline-module]'))return {kind:'module',surface:'diagram'};return null}
function signalFieldElement(which,id,kind,surface='diagram'){if(surface==='table'){if(which!==side)return null;return $(`#rows tr[data-id="${id}"] input[data-act="${kind}"]`)}if(kind==='name')return $(`.signal-card[data-side="${which}"][data-id="${id}"] input[data-act="name"]`);if(kind==='bits')return $(`.line-length-editor[data-side="${which}"][data-id="${id}"]`);if(kind==='comment')return $(`.signal-comment-editor[data-side="${which}"][data-id="${id}"] input[data-act="comment"]`);return null}
function focusExcelText(el,selectAll=true){if(!el)return false;el.focus({preventScroll:true});if(selectAll)requestAnimationFrame(()=>{if(document.activeElement===el){try{el.select()}catch{try{el.setSelectionRange(0,String(el.value||'').length)}catch{}}}});return true}
function nextSignalId(which,id,delta){const rows=state.signals[which]||[],i=rows.findIndex(r=>r.id===id);if(i<0)return null;for(let j=i+delta;j>=0&&j<rows.length;j+=delta)if(!isSpacerSignal(rows[j]))return rows[j].id;return null}
function visualSignalFieldOrder(which,surface='diagram'){return surface==='table'?['name','bits','comment']:(which==='left'?['comment','bits','name']:['name','bits','comment'])}
function moveExcelSignalEditor(el,key,shift=false){const info=excelFieldInfo(el);if(!info||!['name','bits','comment'].includes(info.kind))return false;if(key==='Enter'){const next=nextSignalId(info.side,info.id,shift?-1:1);if(!next){el.blur();return true}finishActiveEditHistory();return focusExcelText(signalFieldElement(info.side,next,info.kind,info.surface),true)}if(key==='Tab'){const order=visualSignalFieldOrder(info.side,info.surface),i=order.indexOf(info.kind),nextKind=order[i+(shift?-1:1)];if(!nextKind){const nextRow=nextSignalId(info.side,info.id,shift?-1:1);if(!nextRow){el.blur();return true}const wrapKind=shift?order.at(-1):order[0];finishActiveEditHistory();return focusExcelText(signalFieldElement(info.side,nextRow,wrapKind,info.surface),true)}finishActiveEditHistory();return focusExcelText(signalFieldElement(info.side,info.id,nextKind,info.surface),true)}return false}
let inlineCommitTimer=null;
function scheduleInlineDiagramCommit(){clearTimeout(inlineCommitTimer);inlineCommitTimer=setTimeout(()=>{inlineCommitTimer=null;if(isInlineTextEditor(document.activeElement)||workspaceTextTarget(document.activeElement))return;finishActiveEditHistory();renderDiagram();renderRtlDeclarations();save()},90)}
previewCanvas.addEventListener("focusin",e=>{clearTimeout(inlineCommitTimer);if(e.target.matches?.('[data-inline-module],[data-inline-group-name],.signal-card input[data-act="name"]'))rememberNameSelection(e.target);const grp=e.target.closest?.(".inline-group-label"),cond=e.target.closest?.(".inline-condition-label");if(grp){side=grp.dataset.side;activeGroupId[side]=grp.dataset.inlineGroup;grp.classList.add("active")}if(cond){side=cond.dataset.side;activeConditionId[side]=cond.dataset.inlineCondition;cond.classList.add("active")}if(e.target.matches?.('[data-inline-module]'))syncModuleEditorVisual(e.target)});
previewCanvas.addEventListener("focusout",e=>{if(isInlineTextEditor(e.target))scheduleInlineDiagramCommit()},true);
previewCanvas.addEventListener("select",e=>{if(e.target.matches?.('[data-inline-module],[data-inline-group-name],.signal-card input[data-act="name"]'))rememberNameSelection(e.target)},true);
previewCanvas.addEventListener("keyup",e=>{if(e.target.matches?.('[data-inline-module],[data-inline-group-name],.signal-card input[data-act="name"]'))rememberNameSelection(e.target)});
previewCanvas.addEventListener("mouseup",e=>{if(e.target.matches?.('[data-inline-module],[data-inline-group-name],.signal-card input[data-act="name"]'))rememberNameSelection(e.target)});
previewCanvas.addEventListener("pointerdown",e=>{const el=e.target.closest?.('input,textarea');if(e.button===0&&isExcelDiagramText(el)&&document.activeElement!==el&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!spacePanHeld)excelSelectAllPending={el,pointerId:e.pointerId}} ,true);
previewCanvas.addEventListener("pointerup",e=>{const p=excelSelectAllPending;excelSelectAllPending=null;if(p&&p.pointerId===e.pointerId&&document.activeElement===p.el)requestAnimationFrame(()=>{if(document.activeElement===p.el){try{p.el.select()}catch{}}})},true);
let sheetSelectAllPending=null;
document.addEventListener("pointerdown",e=>{const el=e.target.closest?.('#rows input[data-act="name"],#rows input[data-act="bits"],#rows input[data-act="comment"],#groupBar input[type="text"]');if(e.button===0&&el&&document.activeElement!==el&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)sheetSelectAllPending={el,pointerId:e.pointerId}},true);
document.addEventListener("pointerup",e=>{const p=sheetSelectAllPending;sheetSelectAllPending=null;if(p&&p.pointerId===e.pointerId&&document.activeElement===p.el)requestAnimationFrame(()=>{if(document.activeElement===p.el){try{p.el.select()}catch{}}})},true);

previewCanvas.addEventListener("pointerdown",e=>{const forcePan=(e.button===1)||(e.button===0&&spacePanHeld);if(forcePan){e.preventDefault();e.stopPropagation();finishActiveEditHistory();previewCanvas.focus({preventScroll:true});previewView.fit=false;previewPanPending={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:previewView.x,originY:previewView.y,force:true};try{previewCanvas.setPointerCapture(e.pointerId)}catch{}previewCanvas.classList.add("pan-ready");return}const handle=e.target.closest?.(".resize-handle");if(handle){e.preventDefault();e.stopPropagation();previewCanvas.focus({preventScroll:true});previewView.fit=false;finishActiveEditHistory();beginHistory();blockResize={pointerId:e.pointerId,handle:handle.dataset.handle,startX:e.clientX,startY:e.clientY,start:{...ensureLayoutState()},scale:previewView.scale||1};try{previewCanvas.setPointerCapture(e.pointerId)}catch{}previewCanvas.classList.add("is-resizing");return}const inlineCard=e.target.closest(".signal-card,.inline-gap"),lineLen=e.target.closest?.(".line-length-editor");if((inlineCard||lineLen)&&(e.ctrlKey||e.metaKey||e.shiftKey)){const t=inlineCard||lineLen;e.preventDefault();e.stopPropagation();selectRow(t.dataset.id,e,t.dataset.side);return}if(e.target.closest(".signal-card,.inline-gap,.inline-group-label,.inline-condition-label,.line-length-editor,.block-title-editor,.signal-comment-editor,[data-direction-toggle]"))return;const rail=e.target.closest("[data-rail-handle]");if(rail){e.preventDefault();e.stopPropagation();previewCanvas.focus({preventScroll:true});previewView.fit=false;const l=ensureLayoutState(),which=rail.dataset.railHandle;beginHistory();signalRailDrag={pointerId:e.pointerId,which,startX:e.clientX,startValue:which==="left"?l.leftSignalX:l.rightSignalX,scale:previewView.scale||1};try{previewCanvas.setPointerCapture(e.pointerId)}catch{}previewCanvas.classList.add("is-rail-dragging");return}if(e.button!==0)return;e.preventDefault();previewCanvas.focus({preventScroll:true});previewView.fit=false;previewPanPending={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:previewView.x,originY:previewView.y,force:false};try{previewCanvas.setPointerCapture(e.pointerId)}catch{}previewCanvas.classList.add("pan-ready")});

window.addEventListener("pointermove",e=>{if(blockResize&&blockResize.pointerId===e.pointerId){applyBlockResize(e.clientX,e.clientY)}},{passive:true});
window.addEventListener("pointerup",e=>{if(blockResize&&blockResize.pointerId===e.pointerId)endBlockResize(e)});
window.addEventListener("pointercancel",e=>{if(blockResize&&blockResize.pointerId===e.pointerId)endBlockResize(e)});

previewCanvas.addEventListener("pointermove",e=>{if(signalRailDrag&&signalRailDrag.pointerId===e.pointerId){e.preventDefault();applySignalRailDrag(e.clientX);return}if(blockResize&&blockResize.pointerId===e.pointerId){e.preventDefault();applyBlockResize(e.clientX,e.clientY);return}if(previewPanPending&&previewPanPending.pointerId===e.pointerId&&!previewPan){const dx=e.clientX-previewPanPending.startX,dy=e.clientY-previewPanPending.startY,dist=Math.hypot(dx,dy);if(previewPanPending.force||dist>=6){previewPan={...previewPanPending};previewCanvas.classList.remove("pan-ready");previewCanvas.classList.add("is-dragging")}}if(!previewPan||previewPan.pointerId!==e.pointerId)return;e.preventDefault();previewView.x=previewPan.originX+(e.clientX-previewPan.startX);previewView.y=previewPan.originY+(e.clientY-previewPan.startY);applyPreviewTransform()});
function endPreviewPan(e){const pid=e?.pointerId;if(previewPan&&pid!=null&&previewPan.pointerId!==pid)return;if(previewPanPending&&pid!=null&&previewPanPending.pointerId!==pid)return;const releaseId=previewPan?.pointerId??previewPanPending?.pointerId;try{if(releaseId!=null)previewCanvas.releasePointerCapture(releaseId)}catch{}previewPan=null;previewPanPending=null;previewCanvas.classList.remove("is-dragging","pan-ready")}
previewCanvas.addEventListener("pointerup",e=>{endSignalRailDrag(e);endBlockResize(e);endPreviewPan(e)});previewCanvas.addEventListener("pointercancel",e=>{endSignalRailDrag(e);endBlockResize(e);endPreviewPan(e)});previewCanvas.addEventListener("dblclick",e=>{if(e.target.closest?.(".signal-card,.inline-gap,.inline-group-label,.inline-condition-label,.line-length-editor,.block-title-editor,.signal-comment-editor,[data-direction-toggle],[data-rail-handle],.resize-handle"))return;fitPreview()});
window.addEventListener("resize",()=>{if(previewView.fit)requestAnimationFrame(fitPreview);else requestAnimationFrame(applyPreviewTransform);if(presentationOpen&&presentView.fit)requestAnimationFrame(fitPresentation)});$("#undoBtn").onclick=undo;$("#redoBtn").onclick=redo;$("#boldBtn").addEventListener("pointerdown",e=>e.preventDefault());$("#italicBtn").addEventListener("pointerdown",e=>e.preventDefault());$("#boldBtn").onclick=()=>applyToolbarFormat(1);$("#italicBtn").onclick=()=>applyToolbarFormat(2);$$('[data-color-target]').forEach(b=>b.onclick=()=>{colorTarget=b.dataset.colorTarget;updateColorToolbar()});$("#colorPalette").onclick=e=>{const sw=e.target.closest("[data-swatch]");if(sw)applyPaletteColor(sw.dataset.swatch)};$("#directionAssignSelect").addEventListener("change",e=>assignSelectedDirection(e.target.value));$("#groupAssignSelect").addEventListener("change",e=>assignSelectedGroup(e.target.value));$("#conditionAssignSelect").addEventListener("change",e=>assignSelectedCondition(e.target.value));$("#addIfdefInline").onclick=()=>createConditionForSelected("ifdef");$("#addIfndefInline").onclick=()=>createConditionForSelected("ifndef");

let rtlDrag=null,rtlDrop=null;
function rtlRefGroupKey(ref){const g=groupById(ref.which,ref.sig.groupId);return g?`${ref.which}:${g.id}`:""}
function rtlGroupMemberIds(groupKey){return orderedRtlRefs().filter(ref=>rtlRefGroupKey(ref)===groupKey).map(ref=>ref.id)}
function clearRtlDropClasses(){$$("#rtlRows tr").forEach(tr=>tr.classList.remove("rtl-dragging","rtl-group-member-dragging","rtl-drop-before","rtl-drop-after"))}
function markRtlDragSource(){if(!rtlDrag)return;if(rtlDrag.kind==="group"){$$("#rtlRows tr").forEach(tr=>{if(tr.dataset.rtlGroupKey===rtlDrag.groupKey)tr.classList.add("rtl-dragging");if(tr.dataset.rtlId&&rtlDrag.ids.includes(tr.dataset.rtlId))tr.classList.add("rtl-group-member-dragging")})}else $(`#rtlRows tr[data-rtl-id="${rtlDrag.id}"]`)?.classList.add("rtl-dragging")}
function rtlTargetRowFromPoint(x,y){const direct=document.elementFromPoint(x,y)?.closest("#rtlRows tr");if(direct&&(direct.dataset.rtlId||direct.dataset.rtlGroupKey))return direct;const rows=[...document.querySelectorAll("#rtlRows tr")].filter(tr=>tr.dataset.rtlId||tr.dataset.rtlGroupKey);let best=null,bestDist=Infinity;for(const tr of rows){const b=tr.getBoundingClientRect();if(x<b.left-24||x>b.right+24)continue;const cy=(b.top+b.bottom)/2,d=Math.abs(y-cy);if(d<bestDist&&d<=Math.max(22,b.height*.9)){best=tr;bestDist=d}}return best}
function rtlDropDescriptor(tr,before){if(!tr)return null;if(tr.dataset.rtlGroupKey)return {kind:"group",groupKey:tr.dataset.rtlGroupKey,before};if(tr.dataset.rtlId)return {kind:"signal",id:tr.dataset.rtlId,before};return null}
function rtlDropIsInsideSource(drop){if(!drop||!rtlDrag)return true;if(rtlDrag.kind==="signal")return drop.kind==="signal"&&drop.id===rtlDrag.id;if(drop.kind==="group")return drop.groupKey===rtlDrag.groupKey;return rtlDrag.ids.includes(drop.id)}
function updateRtlDrop(x,y){if(!rtlDrag)return;clearRtlDropClasses();markRtlDragSource();const tr=rtlTargetRowFromPoint(x,y);if(!tr){rtlDrop=null;return}const box=tr.getBoundingClientRect(),rel=(y-box.top)/Math.max(1,box.height),before=rel<0.5,drop=rtlDropDescriptor(tr,before);if(rtlDropIsInsideSource(drop)){rtlDrop=null;return}tr.classList.add(before?"rtl-drop-before":"rtl-drop-after");rtlDrop=drop}
function commitRtlReorder(){if(!rtlDrag||!rtlDrop)return false;const order=reconcileRtlOrder().slice(),movingIds=rtlDrag.kind==="group"?rtlDrag.ids.slice():[rtlDrag.id],movingSet=new Set(movingIds),moving=order.filter(id=>movingSet.has(id));if(!moving.length)return false;const remaining=order.filter(id=>!movingSet.has(id));let at=-1;if(rtlDrop.kind==="signal"){const ti=remaining.indexOf(rtlDrop.id);if(ti<0)return false;at=ti+(rtlDrop.before?0:1)}else{const targetIds=allRtlSignalRefs().filter(ref=>rtlRefGroupKey(ref)===rtlDrop.groupKey).map(ref=>ref.id).filter(id=>remaining.includes(id));if(!targetIds.length)return false;const idxs=targetIds.map(id=>remaining.indexOf(id)).filter(i=>i>=0);if(!idxs.length)return false;at=rtlDrop.before?Math.min(...idxs):Math.max(...idxs)+1}at=Math.max(0,Math.min(remaining.length,at));remaining.splice(at,0,...moving);if(remaining.join("\u0001")===order.join("\u0001"))return false;state.rtlOrder=remaining;return true}
// r101: separate Group folding gesture from the existing whole-Group drag handle.
$("#rtlRows").addEventListener("click",e=>{
 const btn=e.target.closest("[data-rtl-group-toggle]");if(!btn)return;
 e.preventDefault();e.stopPropagation();
 const key=rtlFoldKeyR101(btn.dataset.rtlGroupToggle);
 if(rtlFoldedGroupsR101.has(key))rtlFoldedGroupsR101.delete(key);else rtlFoldedGroupsR101.add(key);
 const scroll=$("#rtlPanel .rtl-wrap"),top=scroll?.scrollTop||0;
 renderRtlDeclarations();if(scroll)scroll.scrollTop=top;
});
$("#rtlRows").addEventListener("pointerdown",e=>{const gh=e.target.closest("[data-rtl-group-drag]"),rh=e.target.closest("[data-rtl-drag]");if(!gh&&!rh)return;e.preventDefault();e.stopPropagation();finishActiveEditHistory();const historyBefore=snapshotState();if(gh){const groupKey=gh.dataset.rtlGroupDrag,ids=rtlGroupMemberIds(groupKey);if(!ids.length)return;rtlDrag={kind:"group",groupKey,ids,pointerId:e.pointerId,historyBefore}}else rtlDrag={kind:"signal",id:rh.dataset.rtlDrag,ids:[rh.dataset.rtlDrag],pointerId:e.pointerId,historyBefore};rtlDrop=null;try{(gh||rh).setPointerCapture(e.pointerId)}catch{}markRtlDragSource()});
$("#rtlRows").addEventListener("pointermove",e=>{if(!rtlDrag||rtlDrag.pointerId!==e.pointerId)return;e.preventDefault();updateRtlDrop(e.clientX,e.clientY)});
function finishRtlDrag(e,cancel=false){if(!rtlDrag||rtlDrag.pointerId!==e.pointerId)return;const wasGroup=rtlDrag.kind==="group",historyBefore=rtlDrag.historyBefore;let changed=false;if(!cancel)changed=commitRtlReorder();rtlDrag=null;rtlDrop=null;clearRtlDropClasses();if(changed)commitHistorySnapshot(historyBefore);renderRtlDeclarations();if(changed){save();toast(wasGroup?"Whole RTL group reordered · Ctrl+Z to undo":"RTL declaration reordered · Ctrl+Z to undo")}}
$("#rtlRows").addEventListener("pointerup",e=>finishRtlDrag(e,false));
$("#rtlRows").addEventListener("pointercancel",e=>finishRtlDrag(e,true));

window.addEventListener("pointermove",e=>{if(!rtlDrag||rtlDrag.pointerId!==e.pointerId)return;updateRtlDrop(e.clientX,e.clientY)},{passive:true});
window.addEventListener("pointerup",e=>{if(!rtlDrag||rtlDrag.pointerId!==e.pointerId)return;finishRtlDrag(e,false)});
window.addEventListener("pointercancel",e=>{if(!rtlDrag||rtlDrag.pointerId!==e.pointerId)return;finishRtlDrag(e,true)});


$("#rtlCopy").onclick=copyRtlText;$("#rtlToggle").onclick=()=>{const p=$("#rtlPanel"),willCollapse=!p.classList.contains("collapsed");if(willCollapse){const h=p.getBoundingClientRect().height;if(h>RTL_PANEL_MIN_HEIGHT)p.dataset.userHeight=String(Math.round(h));p.classList.add("collapsed");p.style.height="30px";p.style.flexBasis="30px";$("#rtlToggle").textContent="▸"}else{p.classList.remove("collapsed");$("#rtlToggle").textContent="▾";setRtlPanelHeight(+(p.dataset.userHeight||RTL_PANEL_DEFAULT_HEIGHT),{persist:false,expand:false})}};
const RTL_PANEL_HEIGHT_KEY="wrapitfup_rtl_panel_height_v1",RTL_PANEL_DEFAULT_HEIGHT=190,RTL_PANEL_MIN_HEIGHT=110,DIAGRAM_MIN_HEIGHT=180;
let rtlPanelResize=null;
function rtlPanelMaxHeight(){const ws=$("#workspace"),h=ws?.clientHeight||window.innerHeight-60;return Math.max(RTL_PANEL_MIN_HEIGHT,Math.min(h-70,h-DIAGRAM_MIN_HEIGHT-10))}
function clampRtlPanelHeight(h){return Math.max(RTL_PANEL_MIN_HEIGHT,Math.min(rtlPanelMaxHeight(),Math.round(+h||RTL_PANEL_DEFAULT_HEIGHT)))}
function setRtlPanelHeight(h,{persist=false,expand=true}={}){const panel=$("#rtlPanel");if(!panel)return;const value=clampRtlPanelHeight(h);if(expand&&panel.classList.contains("collapsed")){panel.classList.remove("collapsed");$("#rtlToggle").textContent="▾"}panel.style.height=`${value}px`;panel.style.flexBasis=`${value}px`;panel.dataset.userHeight=String(value);$("#rtlPanelResizer")?.setAttribute("aria-valuenow",String(value));if(persist)try{localStorage.setItem(RTL_PANEL_HEIGHT_KEY,String(value))}catch{}}
function restoreRtlPanelHeight(){let value=RTL_PANEL_DEFAULT_HEIGHT;try{const saved=+localStorage.getItem(RTL_PANEL_HEIGHT_KEY);if(Number.isFinite(saved)&&saved>0)value=saved}catch{}setRtlPanelHeight(value,{persist:false,expand:false})}
$("#rtlPanelResizer")?.addEventListener("pointerdown",e=>{if(e.button!==0)return;e.preventDefault();const panel=$("#rtlPanel");if(panel.classList.contains("collapsed")){const remembered=+(panel.dataset.userHeight||RTL_PANEL_DEFAULT_HEIGHT);setRtlPanelHeight(remembered,{expand:true})}rtlPanelResize={pointerId:e.pointerId,startY:e.clientY,startH:panel.getBoundingClientRect().height};$("#rtlPanelResizer").classList.add("dragging");document.body.classList.add("rtl-panel-resizing");try{$("#rtlPanelResizer").setPointerCapture(e.pointerId)}catch{}});
window.addEventListener("pointermove",e=>{if(!rtlPanelResize||rtlPanelResize.pointerId!==e.pointerId)return;const h=rtlPanelResize.startH+(rtlPanelResize.startY-e.clientY);setRtlPanelHeight(h,{persist:false,expand:true})},{passive:true});
function finishRtlPanelResize(e){if(!rtlPanelResize||rtlPanelResize.pointerId!==e.pointerId)return;const panel=$("#rtlPanel"),value=+(panel.dataset.userHeight||panel.getBoundingClientRect().height);rtlPanelResize=null;$("#rtlPanelResizer").classList.remove("dragging");document.body.classList.remove("rtl-panel-resizing");setRtlPanelHeight(value,{persist:true,expand:true});toast(`RTL panel ${Math.round(value)} px`)}
window.addEventListener("pointerup",finishRtlPanelResize);
window.addEventListener("pointercancel",finishRtlPanelResize);
$("#rtlPanelResizer")?.addEventListener("dblclick",()=>{setRtlPanelHeight(RTL_PANEL_DEFAULT_HEIGHT,{persist:true,expand:true});toast("RTL panel reset")});
window.addEventListener("resize",()=>{const panel=$("#rtlPanel");if(!panel||panel.classList.contains("collapsed"))return;setRtlPanelHeight(+(panel.dataset.userHeight||panel.getBoundingClientRect().height),{persist:false,expand:false})});
restoreRtlPanelHeight();


$("#importRtlBtn").onclick=rtlImportOpen;
$("#rtlImportClose").onclick=rtlImportClose;
$("#rtlImportCancel").onclick=rtlImportClose;
$("#rtlImportApply").onclick=rtlImportApplySelected;
$("#rtlImportModule").onchange=rtlImportRenderSelected;
$("#rtlImportInoutSide").onchange=rtlImportRenderSelected;
$("#rtlImportSource").addEventListener("input",()=>{clearTimeout(rtlImportTimer);$("#rtlImportApply").disabled=true;rtlImportTimer=setTimeout(rtlImportAnalyze,120)});
$("#rtlImportBackdrop").addEventListener("pointerdown",e=>{if(e.target===$("#rtlImportBackdrop"))rtlImportClose()});

$("#loadProjectBtn").onclick=()=>$("#projectFile").click();
$("#projectFile").addEventListener("change",async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{await loadProjectFile(file)}catch(err){console.error(err);toast(`Load failed · ${err?.message||"use original WrapItfUp PNG/PDF/SVG/VBS"}`)}});
$("#vbsBtn").onclick=()=>{try{const project=makeProject(),encoded=encodeState(project),name=projectNameFromEncoded(encoded)+".vbs",vbs=makeVbs(encoded,12);verifyCarrierEncoded(extractEncodedStatesFromText(vbs),encoded,"VBS");downloadUtf16(name,vbs);markWorkspaceSaved(encoded);toast(`Visio VBS 已產生；若未自動下載，請點右下方檔名或下載含說明的 ZIP。`)}catch(e){console.error(e);toast(`VBS export failed · ${e?.message||e}`)}};
$("#pngBtn").onclick=downloadReloadablePng;$("#pdfBtn").onclick=downloadReloadablePdf;$("#svgBtn").onclick=()=>{try{const encoded=encodeState(makeProject()),svg=exportSvgText(encoded);verifyCarrierEncoded(extractEncodedStatesFromText(svg),encoded,"SVG");downloadBlob(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),projectNameFromEncoded(encoded)+".svg");markWorkspaceSaved(encoded);toast(`Reloadable SVG verified · ${currentCommentCount()} comments saved`)}catch(e){console.error(e);toast(`SVG export failed · ${e?.message||e}`)}};
function projectNameFromEncoded(encoded){if(window.WIUProjectHost&&decodeState(encoded).schemaVersion!==undefined)return window.WIUProjectHost.carrierName(decodeState(encoded));const name=decodeState(encoded).state.moduleName;return String(name||"wrapper").normalize("NFKC").replace(/[<>:"/\\|?*\x00-\x1F]/g,"_").replace(/\s+/g,"_").replace(/[. ]+$/g,"").slice(0,80)||"wrapper"}
function trapDialogTab(e,root){if(e.key!=="Tab")return;const els=[...root.querySelectorAll('button:not([disabled]),textarea,select,input:not([hidden])')].filter(x=>x.getClientRects().length);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
let helpReturnFocus=null;
function openQuickHelp(){finishActiveEditHistory();helpReturnFocus=document.activeElement;$("#quickHelp").hidden=false;$("#helpClose").focus()}
function closeQuickHelp(){$("#quickHelp").hidden=true;helpReturnFocus?.focus?.({preventScroll:true})}
$("#helpBtn").onclick=openQuickHelp;$("#helpClose").onclick=closeQuickHelp;
$("#quickHelp").onclick=e=>{if(e.target===$("#quickHelp"))closeQuickHelp()};
$("#projectName").onclick=()=>focusExcelText($("[data-inline-module]"));
$("#blankBtn").onclick=()=>{finishActiveEditHistory();withHistory(()=>{state={moduleName:"untitled",moduleFormatRuns:[],parameters:"",showGrid:false,layout:defaultLayout(),rtlOrder:[],signals:{left:[],right:[]},groups:{left:[],right:[]},conditions:{left:[],right:[]}}});clearAllSelections();activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};previewView.fit=true;render();focusExcelText($("[data-inline-module]"));toast("New empty Block · Ctrl+Z restores previous work")};
$("#rtlFileBtn").onclick=()=>$("#rtlSourceFile").click();
$("#rtlSourceFile").onchange=async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;try{$("#rtlImportSource").value=await file.text();rtlImportAnalyze()}catch(err){toast("Could not read RTL file: "+err.message)}};

/* v55.2: same project model, fixed-scale table and selection inspector. */
let deskReady=false,deskAnchor=null,deskSavedState=null,deskSavedLabel='範例 · 尚未匯出',deskSignature='',deskIssueList=[];
function workspaceTextTarget(el){return !!el?.matches?.('#signalSearch,[data-desk-field],[data-inspect-field]')}
function deskRefs(){return ['left','right'].flatMap(which=>state.signals[which].map(sig=>({which,sig})))}
function visibleDeskRefs(){const q=String($('#signalSearch')?.value||'').trim().toLowerCase(),f=$('#signalSideFilter')?.value||'all',d=$('#signalDirFilter')?.value||'all';return deskRefs().filter(({which,sig})=>(f==='all'||f===which)&&(d==='all'||d===sig.direction)&&(!q||[sig.name,sig.comment,sig.bits,groupById(which,sig.groupId)?.name,conditionById(which,sig.conditionId)?.macro].join(' ').toLowerCase().includes(q)))}
function deskSig(id){return deskRefs().find(x=>x.sig.id===id)}
function workspaceIssues(){const out=[],names=new Map();for(const r of activeRtlRefs()){const n=svIdentifier(r.sig.name,'unnamed_port'),bits=String(r.sig.bits||'').trim();if(names.has(n))out.push({id:r.sig.id,message:`${n}：重複的 RTL 名稱`});names.set(n,true);if(bits&&!isScalarBits(bits)&&!lengthToRange(bits))out.push({id:r.sig.id,message:`${n}：無法解讀位寬「${bits}」`})}const audit=rtlConditionAudit();if(!audit.ok&&!out.length)out.push({id:activeRtlRefs()[0]?.sig.id,message:audit.message});return out}
function updateDeskStatus(){if(!deskReady)return;const snap=JSON.stringify(state),dirty=deskSavedState!==null&&snap!==deskSavedState,n=$('#projectStatus');n.textContent=dirty?'有未匯出變更':deskSavedLabel;n.classList.toggle('dirty',dirty);deskIssueList=workspaceIssues();$('#issueToggle').textContent=deskIssueList.length?`⚠ ${deskIssueList.length} 個問題`:'✓ RTL 檢查通過';$('#issueToggle').classList.toggle('has-issues',!!deskIssueList.length);$('#issueTray').innerHTML=deskIssueList.map((x,i)=>`<button data-issue="${i}">${esc(x.message)}${x.id?' · 定位 →':''}<\/button>`).join('');if(!deskIssueList.length)$('#issueTray').hidden=true;$('#workspaceTotals').textContent=`${deskRefs().filter(x=>!isSpacerSignal(x.sig)).length} 訊號 · ${state.groups.left.length+state.groups.right.length} 群組`}
function markWorkspaceSaved(encoded,label='匯出已產生'){if(encoded&&window.WIUProjectHost&&decodeState(encoded).schemaVersion!==undefined){window.WIUProjectHost.markSaved();deskSavedState=JSON.stringify(state);deskSavedLabel=label;updateDeskStatus();return;}if(!deskReady)return;deskSavedState=encoded?JSON.stringify(decodeState(encoded).state):JSON.stringify(state);deskSavedLabel=label;updateDeskStatus()}
function renderDesk(){if(!deskReady)return;const refs=visibleDeskRefs(),signature=JSON.stringify(refs.map(({which,sig})=>[which,sig,groupById(which,sig.groupId)?.name,conditionById(which,sig.conditionId)?.macro]));if(signature!==deskSignature&&!$('#signalTableRows').contains(document.activeElement)){deskSignature=signature;$('#signalTableRows').innerHTML=refs.map(({which,sig:s})=>{const g=groupById(which,s.groupId),c=conditionById(which,s.conditionId);return `<tr data-desk-id="${s.id}" data-side="${which}" class="${signalIsCommented(which,s)?'disabled-port':''}"><td><input type="checkbox" data-desk-select="${s.id}" aria-label="選取 ${esc(s.name||'間隔')}"><\/td><td><input data-desk-field="name" data-id="${s.id}" value="${esc(s.name)}" title="${esc(s.name)}" aria-label="${esc(s.name||'間隔')} 名稱" placeholder="間隔列" spellcheck="false"><div class="desk-row-sub" title="${esc([which==='left'?'左側':'右側',g?.name,c?conditionText(c):''].filter(Boolean).join(' · '))}">${esc([which==='left'?'左':'右',g?.name||'未分組',c?conditionText(c):''].filter(Boolean).join(' · '))}<\/div><\/td><td><input data-desk-field="bits" data-id="${s.id}" value="${esc(s.bits)}" aria-label="${esc(s.name)} 位寬" spellcheck="false"><\/td><td><select data-desk-direction="${s.id}" aria-label="${esc(s.name)} 方向">${['input','output','inout'].map(d=>`<option value="${d}" ${d===s.direction?'selected':''}>${d==='input'?'IN':d==='output'?'OUT':'I/O'}<\/option>`).join('')}<\/select><\/td><td><button class="desk-locate" data-desk-locate="${s.id}" title="在圖面定位" aria-label="定位 ${esc(s.name||'間隔')}">◎<\/button><\/td><\/tr>`}).join('')}
 $('#signalResultCount').textContent=`顯示 ${refs.length} / ${deskRefs().length} 列`;$('#signalsEmpty').hidden=!!refs.length;$('#signalsEmpty').textContent=deskRefs().length?'沒有符合的訊號。可清除篩選重新查看。':'尚無訊號。從下方新增，或匯入 RTL。';syncDeskSelection();updateDeskStatus()}
function commonDeskValue(hits,field){const values=[...new Set(hits.map(x=>String(x.sig[field]??'')))];return values.length===1?values[0]:null}
function syncDeskSelection(){if(!deskReady)return;const hits=selectedRowsAll(),visible=visibleDeskRefs(),count=hits.length,chosenIds=new Set(hits.map(x=>x.sig.id));for(const tr of $$('#signalTableRows tr')){const chosen=chosenIds.has(tr.dataset.deskId);tr.classList.toggle('chosen',chosen);tr.setAttribute('aria-selected',String(chosen));tr.querySelector('[type=checkbox]').checked=chosen}const selectedVisible=visible.filter(x=>rowSelection[x.which].has(x.sig.id)).length;$('#selectVisibleSignals').checked=!!visible.length&&selectedVisible===visible.length;$('#selectVisibleSignals').indeterminate=selectedVisible>0&&selectedVisible<visible.length;$('#selectVisibleSignals').disabled=!visible.length;$('#selectionCount').textContent=count?`已選 ${count} 列${count>selectedVisible?` · ${count-selectedVisible} 列在篩選外`:''}`:'未選取訊號';$('#inspectorTitle').textContent=count>1?`批次屬性 · ${count} 列`:'選取屬性';$('#inspectorEmpty').hidden=!!count;
 for(const [id,field] of [['inspectName','name'],['inspectBits','bits'],['inspectComment','comment']]){const el=$('#'+id);el.disabled=!count||(field==='name'&&count!==1);if(document.activeElement===el)continue;const value=count?commonDeskValue(hits,field):'';el.value=value??'';el.placeholder=field==='name'&&count>1?'多選時請逐筆編輯名稱':value===null?'不同值 · 輸入後套用全部':field==='bits'?'1 / 8 / [W-1:0]':field==='comment'?'介面用途或備註':''}
 const signed=$('#inspectSigned');signed.disabled=!count;if(document.activeElement!==signed){const vals=new Set(hits.map(x=>!!x.sig.signed));signed.value=!count?'0':vals.size>1?'':hits[0].sig.signed?'1':'0'}
 for(const id of ['moveSignalsLeft','moveSignalsRight','moveSignalsUp','moveSignalsDown','locateSelected','clearSelected','duplicateSelected','deleteSelected'])$('#'+id).disabled=!count;
 const sides=[...new Set(hits.map(x=>x.which==='left'?'左側':'右側'))];$('#positionSummary').textContent=count?sides.join(' + ')+` · ${count} 列`:'尚未選取';$('#addGroupInline').disabled=!count||sides.length>1;$('#addGroupInline').title=sides.length>1?'群組需建立於同一側，請先選取單側訊號':'將選取訊號建立為群組';$('#addIfdefInline').disabled=!count;$('#addIfndefInline').disabled=!count;updatePortWidthHint();
}
function locateDeskSignal(id){const ref=deskSig(id);if(!ref)return;const node=$$('.signal-card[data-id]').find(e=>e.dataset.id===id);if(!node)return;const r=previewCanvas.getBoundingClientRect(),b=node.getBoundingClientRect(),panel=findPanel&&!findPanel.hidden?findPanel.getBoundingClientRect():null,right=panel?Math.min(r.right,panel.left-16):r.right;const x=(b.left+b.width/2-r.left-previewView.x)/previewView.scale,y=(b.top+b.height/2-r.top-previewView.y)/previewView.scale;previewView.fit=false;previewView.scale=Math.max(.85,Math.min(1.25,previewView.scale));previewView.x=Math.max(120,right-r.left)/2-x*previewView.scale;previewView.y=r.height/2-y*previewView.scale;applyPreviewTransform();const tr=$$('#signalTableRows tr[data-desk-id]').find(e=>e.dataset.deskId===id);tr?.scrollIntoView({block:'nearest'});$('#selectionCount').textContent='定位：'+ref.sig.name;}
function toggleDeskPanel(which,force){finishActiveEditHistory();const shell=$('#workbench'),className=which==='signals'?'signals-open':'inspect-open',open=typeof force==='boolean'?force:!shell.classList.contains(className);shell.classList.toggle(className,open);if(open&&window.innerWidth<1280)shell.classList.remove(which==='signals'?'inspect-open':'signals-open');$('#toggleSignalTable').setAttribute('aria-pressed',String(shell.classList.contains('signals-open')));$('#toggleInspector').setAttribute('aria-pressed',String(shell.classList.contains('inspect-open')));requestAnimationFrame(()=>{if(previewView.fit)fitPreview();else applyPreviewTransform()});renderDesk()}
function commitDeskField(el){const f=el.dataset.deskField||el.dataset.inspectField,hits=el.dataset.id?[deskSig(el.dataset.id)].filter(Boolean):selectedRowsAll();if(!hits.length||!['name','bits','comment'].includes(f))return;if(f==='name'&&hits.length>1)return;if(history.tx===null)beginHistory();previewView.fit=false;const v=f==='name'?cleanSignalNameLive(el.value):f==='bits'?cleanBitsText(el.value):cleanCommentLive(el.value);for(const x of hits){if(f==='name'&&x.sig.name!==v)x.sig.formatRuns=[];x.sig[f]=v}if(el.value!==v)el.value=v;deskSignature='';renderDiagram();renderRtlDeclarations();save();syncDeskSelection()}
function moveDeskSelection(target){finishActiveEditHistory();const hits=selectedRowsAll(),moving=hits.filter(x=>x.which!==target);if(!moving.length)return;previewView.fit=false;withHistory(()=>{const gc=new Map(),cc=new Map();for(const {which,sig} of moving){const gd=groupDescriptor(which,sig),cd=conditionDescriptor(which,sig);state.signals[which]=state.signals[which].filter(s=>s.id!==sig.id);sig.groupId=gd?ensureGroupOnSide(target,gd,gc,null,true):null;sig.conditionId=cd?ensureConditionOnSide(target,cd,cc):null;state.signals[target].push(sig)}});clearAllSelections();for(const h of hits)rowSelection[target].add(h.sig.id);side=target;render();requestAnimationFrame(()=>locateDeskSignal(moving[0].sig.id));toast(`${moving.length} 列移至${target==='left'?'左':'右'}側 · 方向、群組、條件保留`)}
function reorderDeskSelection(delta){finishActiveEditHistory();previewView.fit=false;withHistory(()=>{for(const which of ['left','right']){const a=state.signals[which],set=rowSelection[which];if(delta<0){for(let i=1;i<a.length;i++)if(set.has(a[i].id)&&!set.has(a[i-1].id))[a[i-1],a[i]]=[a[i],a[i-1]]}else{for(let i=a.length-2;i>=0;i--)if(set.has(a[i].id)&&!set.has(a[i+1].id))[a[i+1],a[i]]=[a[i],a[i+1]]}}});render()}
function handleWorkspaceKey(e){if(!deskReady)return false;const el=e.target,field=el.dataset?.deskField||el.dataset?.inspectField,mod=e.ctrlKey||e.metaKey;if(!workspaceTextTarget(el)&&!el.closest?.('#signalsPanel select,#inspectorPanel select'))return false;
 if(el.id==='signalSearch'){if(e.key==='Escape'){e.preventDefault();el.value='';renderDesk();el.blur()}if(e.key==='Enter'){e.preventDefault();const r=visibleDeskRefs()[0];if(r){setDeskSelection(r.sig.id);locateDeskSignal(r.sig.id)}}return true}
 if(mod&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();finishActiveEditHistory();if(e.key.toLowerCase()==='y'||e.shiftKey)redo();else undo();renderDesk();return true}if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();$('#saveProjectBtn').click();return true}
 if(e.key==='Tab'&&(el.dataset.deskField||el.dataset.deskDirection)){const cols=['name','bits','direction'],id=el.dataset.id||el.dataset.deskDirection,refs=visibleDeskRefs();let r=refs.findIndex(x=>x.sig.id===id),c=cols.indexOf(el.dataset.deskField||'direction')+(e.shiftKey?-1:1);if(c<0){c=2;r--}if(c>2){c=0;r++}const next=refs[r];if(next){e.preventDefault();el.blur();const target=cols[c]==='direction'?$(`[data-desk-direction="${next.sig.id}"]`):$(`[data-desk-field="${cols[c]}"][data-id="${next.sig.id}"]`);focusExcelText(target)}return true}
 if(e.key==='Escape'){e.preventDefault();if(history.tx!==null){const old=history.tx;history.tx=null;state=JSON.parse(old);el.blur();render()}else el.blur();return true}
 if(e.key==='Enter'&&field){e.preventDefault();if(el.dataset.deskField){const refs=visibleDeskRefs(),at=refs.findIndex(x=>x.sig.id===el.dataset.id),next=refs[at+(e.shiftKey?-1:1)];el.blur();if(next)focusExcelText($(`[data-desk-field="${field}"][data-id="${next.sig.id}"]`))}else el.blur();return true}
 return true;
}
function showDeskDropIntent(){const n=$('#dragIntent');if(!n||!inlineDrop)return;const d=inlineDrop,w=d.targetSide==='left'?'左側':'右側';n.textContent=d.kind==='group'?`移至${w} · 加入群組 ${groupById(d.targetSide,d.groupId)?.name||''}`:d.kind==='condition'?`移至${w} · 套用 ${conditionText(conditionById(d.targetSide,d.conditionId))}`:`移至${w} · 保留方向、群組、條件`;n.hidden=false}
let deskSelectPending=null;
document.addEventListener('pointerdown',e=>{if(e.target.matches('[data-desk-field],[data-inspect-field]')&&e.target!==document.activeElement&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)deskSelectPending=e.target});
document.addEventListener('pointerup',()=>{const el=deskSelectPending;deskSelectPending=null;if(el&&document.activeElement===el)requestAnimationFrame(()=>{if(document.activeElement===el)el.select()})});
// Mount existing format and assignment tools in the inspector without duplicating IDs.
const formatRoot=$('.format-tools');for(const id of ['directionAssignTool','groupAssignTool','conditionAssignTool'])$('#assignmentTools').appendChild($('#'+id));$('#formatToolHost').appendChild(formatRoot);
$('#toggleSignalTable').onclick=()=>toggleDeskPanel('signals');$('#closeSignals').onclick=()=>toggleDeskPanel('signals',false);$('#toggleInspector').onclick=()=>toggleDeskPanel('inspect');$('#closeInspector').onclick=()=>toggleDeskPanel('inspect',false);
for(const id of ['signalSearch','signalSideFilter','signalDirFilter'])$('#'+id).addEventListener(id==='signalSearch'?'input':'change',()=>{deskSignature='';renderDesk()});$('#clearFilters').onclick=()=>{$('#signalSearch').value='';$('#signalSideFilter').value='all';$('#signalDirFilter').value='all';deskSignature='';renderDesk()};
$('#selectVisibleSignals').onchange=e=>{finishActiveEditHistory();for(const x of visibleDeskRefs())if(e.target.checked)rowSelection[x.which].add(x.sig.id);else rowSelection[x.which].delete(x.sig.id);renderRows();renderInlineSelectionState();syncDeskSelection()};
$('#signalTableRows').addEventListener('click',e=>{const tr=e.target.closest('[data-desk-id]');if(!tr)return;if(e.target.closest('[data-desk-locate]')){setDeskSelection(tr.dataset.deskId);locateDeskSignal(tr.dataset.deskId);return}if(e.target.matches('[data-desk-select]')){setDeskSelection(tr.dataset.deskId,e,true);return}if(!e.target.matches('input,select,button'))setDeskSelection(tr.dataset.deskId,e)});
$('#signalTableRows').addEventListener('change',e=>{const id=e.target.dataset.deskDirection;if(!id)return;finishActiveEditHistory();const x=deskSig(id);if(!x)return;withHistory(()=>x.sig.direction=e.target.value);previewView.fit=false;render()});
for(const root of [$('#signalsPanel'),$('#inspectorPanel')]){root.addEventListener('focusin',e=>{const el=e.target;if(el.dataset.deskDirection){setDeskSelection(el.dataset.deskDirection);return}if(!el.matches('[data-desk-field],[data-inspect-field]'))return;clearTimeout(inlineCommitTimer);previewView.fit=false;if(el.dataset.id){const ref=deskSig(el.dataset.id);if(ref){clearAllSelections();rowSelection[ref.which].add(ref.sig.id);side=ref.which;deskAnchor=ref.sig.id;selectionAnchor[ref.which]=ref.sig.id;renderRows();renderInlineSelectionState();syncDeskSelection()}}beginHistory()});root.addEventListener('input',e=>{if(e.target.matches('[data-desk-field],[data-inspect-field]'))commitDeskField(e.target)});root.addEventListener('focusout',e=>{if(!e.target.matches('[data-desk-field],[data-inspect-field]'))return;endHistory();setTimeout(()=>{if(!workspaceTextTarget(document.activeElement))renderDesk()},0)});}
$('#inspectSigned').onchange=e=>{if(!['0','1'].includes(e.target.value))return;finishActiveEditHistory();withHistory(()=>selectedRowsAll().forEach(x=>x.sig.signed=e.target.value==='1'));render()};
$('#tableAddLeft').onclick=()=>addInlineSignal('left');$('#tableAddRight').onclick=()=>addInlineSignal('right');$('#tableGap').onclick=()=>{finishActiveEditHistory();let s;withHistory(()=>{s=signal('','1','input',null);const a=state.signals[side],indices=a.map((x,i)=>rowSelection[side].has(x.id)?i:-1),at=Math.max(...indices,-1);a.splice(at<0?a.length:at+1,0,s)});clearAllSelections();rowSelection[side].add(s.id);previewView.fit=false;render();locateDeskSignal(s.id)};
$('#moveSignalsLeft').onclick=()=>moveDeskSelection('left');$('#moveSignalsRight').onclick=()=>moveDeskSelection('right');$('#moveSignalsUp').onclick=()=>reorderDeskSelection(-1);$('#moveSignalsDown').onclick=()=>reorderDeskSelection(1);$('#duplicateSelected').onclick=duplicateDeskSelection;$('#deleteSelected').onclick=()=>{finishActiveEditHistory();deleteSelectedRows()};$('#clearSelected').onclick=()=>{finishActiveEditHistory();clearAllSelections();renderRows();renderInlineSelectionState();syncDeskSelection()};$('#locateSelected').onclick=()=>{const x=selectedRowsAll()[0];if(x)locateDeskSignal(x.sig.id)};
$('#issueToggle').onclick=()=>{$('#issueTray').hidden=!$('#issueTray').hidden};$('#issueTray').onclick=e=>{const b=e.target.closest('[data-issue]');if(!b)return;const x=deskIssueList[Number(b.dataset.issue)];if(x?.id){setDeskSelection(x.id);locateDeskSignal(x.id)}};
$('#saveProjectBtn').onclick=()=>$('#svgBtn').click();
previewCanvas.addEventListener('focusin',e=>{if(!isInlineTextEditor(e.target))return;previewView.fit=false;const card=e.target.closest('.signal-card,.signal-comment-editor'),id=card?.dataset.id||e.target.dataset.id,which=card?.dataset.side||e.target.dataset.side;if(id&&which){if(!rowSelection[which].has(id)){clearAllSelections();rowSelection[which].add(id);selectionAnchor[which]=id;}side=which;deskAnchor=selectionAnchor[which]||id;refreshPortSelection()}});
previewCanvas.addEventListener('input',()=>{syncDeskSelection();updateDeskStatus()});
$('#exportOptions').addEventListener('click',e=>{if(e.target.closest('button'))$('#exportOptions').open=false});
deskReady=true;$('#workbench').classList.toggle('signals-open',window.innerWidth>=980);$('#workbench').classList.toggle('inspect-open',window.innerWidth>=1380);$('#toggleSignalTable').setAttribute('aria-pressed',String(window.innerWidth>=980));$('#toggleInspector').setAttribute('aria-pressed',String(window.innerWidth>=1380));

/* r70: creation allocates names; explicit renames still use normal validation.
 * Included inside the original editor closure. A port's ID is independent of
 * its name. Only a trusted local cut pasted back into the same sheet reuses IDs.
 */
function portEditNotice(message){const modal=document.querySelector('dialog[open]');if(modal){let note=modal.querySelector('[data-inline-notice]');if(!note){note=document.createElement('p');note.dataset.inlineNotice='';note.className='r121-error';note.setAttribute('role','alert');(modal.querySelector('.a-dialog-content')||modal).append(note);}note.textContent=message;return;}if(window.WIUProjectHost?.portNotice)window.WIUProjectHost.portNotice(message);else toast(message);}
function allocatePortNames(requested,occupied){return window.WIUInteractionR128.allocateNames(requested,occupied);}

function portClipboardScope(){return window.WIUProjectHost?.portEditContext?.()||{project:'legacy',module:state.moduleName,reserved:[],reason:''};}
function portNamesInUse(excludeIds=[]){
  const excluded=new Set(excludeIds),names=[];
  for(const which of ['left','right'])for(const s of state.signals[which]){
    if(!excluded.has(s.id)&&s.name&&!isCommentedLabel(s.name))names.push(svIdentifier(s.name,'unnamed_port'));
  }
  return names.concat(portClipboardScope().reserved||[]);
}
function planPortNames(items,excludeIds=[]){
  const names=items.map(x=>String(x.name??'').trim()),out=allocatePortNames(names,portNamesInUse(excludeIds));
  return {items:items.map((x,i)=>({...x,name:out[i]})),renames:names.flatMap((name,i)=>name!==out[i]?[{from:name,to:out[i]}]:[])};
}
function portEditAllowed(){
  const reason=portClipboardScope().reason;
  if(reason){portEditNotice(reason);return false;}return true;
}
function commitPortCreation(change){
  if(!portEditAllowed())return false;
  finishActiveEditHistory();const before=snapshotState();
  try{withHistory(change);}
  catch(e){history.tx=null;state=normalizeProjectState(JSON.parse(before));render();portEditNotice(e.message);return false;}
  // The workbook bridge restores the previous sheet if parsing or applying fails.
  // Do not report success or select newly allocated IDs when that happens.
  return snapshotState()!==before;
}
function reportPortCreation(action,created,renames=[]){
  const detail=renames.slice(0,3).map(x=>x.from+' → '+x.to).join('、');
  portEditNotice(action+' '+created.length+' 個接腳'+(detail?'；同名已編號：'+detail+(renames.length>3?' 等 '+renames.length+' 筆':''):'')+'。Ctrl/Cmd+Z 復原。');
}
function selectCreatedPorts(created){
  clearAllSelections();for(const x of created)rowSelection[x.which].add(x.sig.id);
  if(created.length){side=created.at(-1).which;selectionAnchor[side]=created.at(-1).sig.id;}
  render();
}
// Copying every member creates another editable interface. A partial selection
// remains in its current group, while a cut keeps the original group identity.
function completeSelectedGroups(hits){
  const selected=new Set(hits.map(x=>x.sig.id));
  return ['left','right'].flatMap(which=>state.groups[which].filter(g=>{
    const members=groupMembers(which,g.id);
    return members.length>0&&members.every(s=>selected.has(s.id));
  }).map(g=>which+'::'+g.id));
}
function insertAfterSelected(which){
  const rows=state.signals[which],selected=rows.map((r,i)=>rowSelection[which].has(r.id)?i:-1);
  const last=Math.max(...selected,-1);
  return last>=0?last+1:rows.length;
}
function addInlineSignal(which){
  if(!portEditAllowed())return false;
  finishActiveEditHistory();previewView.fit=false;side=which;
  const name=allocatePortNames(['signal_name'],portNamesInUse())[0];let r;
  if(!commitPortCreation(()=>{r=signal(name,'1',which==='right'?'output':'input',null);state.signals[which].splice(insertAfterSelected(which),0,r);} ))return false;
  selectCreatedPorts([{which,sig:r}]);
  requestAnimationFrame(()=>{if(rowSelection[which].has(r.id)){locateDeskSignal(r.id);focusAndSelectSignalName(which,r.id);}});
  portEditNotice('已在所選接腳正下方新增 '+name+'；無選取時加在該側最後。Ctrl/Cmd+Z 復原。');return true;
}
function addInlineSpacer(which=side){
  if(!portEditAllowed())return false;
  finishActiveEditHistory();previewView.fit=false;side=which;let r;
  if(!commitPortCreation(()=>{r=signal('','1',which==='right'?'output':'input',null);state.signals[which].splice(insertAfterSelected(which),0,r);} ))return false;
  selectCreatedPorts([{which,sig:r}]);
  portEditNotice('已在選取列下方加入空白間隔（預設為空格，不產生 RTL port）。');return true;
}

function pasteRowItems(items,options={}){
  if(!Array.isArray(items)||!items.length||!portEditAllowed())return false;
  const here=portClipboardScope(),from=options.payload?.origin;
  if(!options.parameterReviewed&&(!from||from.project!==here.project||from.module!==here.module)&&window.WIUProjectHost?.portPastePlan){
    let review;try{review=window.WIUProjectHost.portPastePlan(items,options.payload?.parameterSnapshot);}catch(e){portEditNotice('貼上未套用：'+e.message+'。請修正剪貼簿的位寬後重試。');return false;}
    if(review.rows.length){window.WIUProjectHost.reviewPortPaste(review,from,mode=>pasteRowItems(mode==='source'?review.items:items,{...options,parameterReviewed:true,parameters:mode==='source'?review.parameters:null}));return true;}
  }
  finishActiveEditHistory();
  const targetSide=options.side||side,rows=state.signals[targetSide],replaceId=options.replaceId||null;
  const replaceAt=replaceId?rows.findIndex(r=>r.id===replaceId):-1;
  if(replaceId&&replaceAt<0)return false;
  let insertAt=rows.length;
  if(replaceAt>=0)insertAt=replaceAt;
  else{const at=rows.map((r,i)=>rowSelection[targetSide].has(r.id)?i:-1);insertAt=Math.max(...at,-1)+1;if(insertAt===0)insertAt=rows.length;}
  const plan=planPortNames(items,replaceId?[replaceId]:[]),created=[];
  const scope=portClipboardScope(),origin=options.payload?.origin;
  const sameModule=origin?.project===scope.project&&origin?.module===scope.module;
  const independentGroups=new Set(sameModule&&options.payload?.operation!=='cut'&&Array.isArray(options.payload?.completeGroups)?options.payload.completeGroups:[]);
  const localCut=options.payload?.operation==='cut'&&options.payload?.cutToken&&rowClipboard?.cutToken===options.payload.cutToken&&origin?.project===scope.project&&origin?.module===scope.module;
  const usedIds=new Set(['left','right'].flatMap(w=>[...state.signals[w],...state.groups[w],...state.conditions[w]].map(x=>x.id)));
  if(!commitPortCreation(()=>{
    if(options.parameters)state.parameters=options.parameters.map(p=>(p.local?'localparam ':'parameter ')+(p.type?p.type+' ':'')+p.name+' = '+p.value).join(', ');
    const gc=new Map(),cc=new Map();
    for(const [i,x] of plan.items.entries()){
      const gd=x.group||((x.groupName||x.groupId)?{sourceSide:x.sourceSide,id:x.groupId,name:x.groupName,color:x.groupColor,formatRuns:x.groupFormatRuns}:null);
      const cd=x.condition||((x.conditionId)?{sourceSide:x.sourceSide,id:x.conditionId,kind:x.conditionKind||'ifdef',macro:x.conditionMacro||'FPGA'}:null);
      // Group/condition IDs are sheet-local. Across sheets match descriptors,
      // never a coincidentally equal ID from an unrelated destination group.
      const gid=gd?.name?ensureGroupOnSide(targetSide,{...gd,id:sameModule?gd.id:null},gc,independentGroups,sameModule):null,cid=cd?.macro?ensureConditionOnSide(targetSide,{...cd,id:sameModule?cd.id:null},cc):null;
      const r=Object.assign(signal(x.name,cleanBitsText(x.bits||'1')||'1',x.direction==='output'?'output':x.direction==='inout'?'inout':'input',gid,normalizeFormatRuns(x.formatRuns,x.name.length),colorValue(x.lineColor,'#111b23'),colorValue(x.textColor,'#050505'),cleanComment(x.comment),cid),{signed:!!x.signed});
      if(i===0&&replaceId)r.id=replaceId;
      else if(localCut&&x.sourceId&&!usedIds.has(x.sourceId))r.id=x.sourceId;
      usedIds.add(r.id);created.push({which:targetSide,sig:r});
    }
    state.signals[targetSide].splice(insertAt,replaceId?1:0,...created.map(x=>x.sig));
  }))return false;
  selectCreatedPorts(created);reportPortCreation('已貼上',created,plan.renames);return true;
}
function duplicateDeskSelection(){
  if(!portEditAllowed())return false;finishActiveEditHistory();
  const hits=selectedRowsAll();if(!hits.length)return false;
  const plan=planPortNames(hits.map(x=>x.sig)),created=[],independentGroups=new Set(completeSelectedGroups(hits));
  if(!commitPortCreation(()=>{
    const groupCache=new Map();
    hits.forEach(({which,sig},i)=>{const copy=JSON.parse(JSON.stringify(plan.items[i]));copy.id=uid();
      const descriptor=groupDescriptor(which,sig);
      copy.groupId=descriptor?ensureGroupOnSide(which,descriptor,groupCache,independentGroups,true):null;
      state.signals[which].splice(state.signals[which].findIndex(x=>x.id===sig.id)+1,0,copy);created.push({which,sig:copy});});
  }))return false;
  selectCreatedPorts(created);reportPortCreation('已複製',created,plan.renames);return true;
}
function portClipboardBlocked(target){
  return window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||!$('#rtlImportBackdrop').hidden||!$('#quickHelp').hidden||workspaceTextTarget(target)||isEditableTarget(target);
}
function capturePortClipboard(cut=false){
  if(cut&&!portEditAllowed())return null;
  finishActiveEditHistory();const payload=copyPayloadFromSelection();if(!payload)return null;
  payload.origin=portClipboardScope();delete payload.origin.reserved;delete payload.origin.reason;
  payload.origin.moduleName=state.moduleName;
  payload.parameterSnapshot=window.WIUProjectHost?.portWidthClipboard?.(payload.items);
  payload.operation=cut?'cut':'copy';if(cut)payload.cutToken=uid();
  const hits=selectedRowsAll();payload.completeGroups=completeSelectedGroups(hits);payload.items.forEach((x,i)=>x.sourceId=hits[i].sig.id);
  return payload;
}
function finishPortClipboard(payload){
  if(payload.operation==='cut'){
    const scope=portClipboardScope();if(payload.origin?.project!==scope.project||payload.origin?.module!==scope.module){portEditNotice('已切換模組，未剪下任何接腳；請重新選取。');return false;}
    const ids=new Set(payload.items.map(x=>x.sourceId));
    if(!commitPortCreation(()=>{for(const w of ['left','right'])state.signals[w]=state.signals[w].filter(s=>!ids.has(s.id));}))return false;
    clearAllSelections();render();
  }
  rowClipboard=payload;
  portEditNotice('已'+(payload.operation==='cut'?'剪下':'複製')+' '+payload.items.length+' 個接腳；貼上撞名會自動編號。'+(payload.operation==='cut'?'Ctrl/Cmd+Z 可還原剪下。':''));return true;
}
function handlePortCopy(e){
  if(portClipboardBlocked(e.target))return;
  const p=capturePortClipboard(e.type==='cut');if(!p||!e.clipboardData)return;
  try{e.clipboardData.setData('text/plain',p.text);try{e.clipboardData.setData('application/x-wrapper-signal-rows',JSON.stringify(p));}catch{}
    e.preventDefault();finishPortClipboard(p);
  }catch{portEditNotice('無法寫入剪貼簿，接腳未移除。');}
}
function pastePortNameLines(text,which,id){
  finishActiveEditHistory();const original=state.signals[which].find(s=>s.id===id);if(!original)return false;
  const items=normalizeClipboardRows(text).map(x=>({...original,...x,group:groupDescriptor(which,original),condition:conditionDescriptor(which,original)}));
  // Names-only lists inherit the selected row's direction, width and appearance.
  const lines=String(text).split(/\r?\n/).filter(x=>x.trim()&&!/^\s*\/\//.test(x));
  items.forEach((x,i)=>{if(/^[A-Za-z_][A-Za-z0-9_$]*$/.test(lines[i]?.trim()||'')){x.direction=original.direction;x.bits=original.bits;x.signed=!!original.signed;x.comment=original.comment;x.lineColor=original.lineColor;x.textColor=original.textColor;x.formatRuns=[];}});
  return pasteRowItems(items,{side:which,replaceId:id,parameterReviewed:true,payload:{origin:portClipboardScope()}});
}
function handlePortPaste(e){
  if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||!$('#rtlImportBackdrop').hidden||!$('#quickHelp').hidden)return;
  const plain=e.clipboardData?.getData('text/plain')||e.clipboardData?.getData('text')||'',el=e.target;
  if(el.id==='r73-edit-value'&&canvasEdit?.kind==='name'&&/\r?\n/.test(plain.trim())){const ref={...canvasEdit};e.preventDefault();e.stopPropagation();closeCanvasEditor(false);pastePortNameLines(plain,ref.which,ref.id);return;}
  if((el.dataset?.act==='name'||el.dataset?.deskField==='name'||el.dataset?.inspectField==='name')&&/\r?\n/.test(plain.trim())){
    const id=el.dataset.id||el.closest?.('[data-id]')?.dataset.id||selectedRowsAll()[0]?.sig.id;
    const ref=deskSig(id);if(!ref)return;e.preventDefault();e.stopPropagation();pastePortNameLines(plain,ref.which,id);return;
  }
  if(portClipboardBlocked(el))return;
  let p=null;try{const raw=e.clipboardData?.getData('application/x-wrapper-signal-rows');if(raw){const parsed=JSON.parse(raw);if(parsed.format==='WrapperSignalRows'&&Array.isArray(parsed.items))p=parsed;}}catch{}
  if(rowClipboard&&plain===rowClipboard.text)p=rowClipboard;
  const target=el.closest?.('[data-side]')?.dataset.side,effectiveSide=['left','right'].includes(target)?target:side;
  if(!p&&plain)p={items:normalizeClipboardRows(plain,effectiveSide==='right'?'output':'input')};
  if(!p?.items?.length)return;
  e.preventDefault();e.stopPropagation();
  pasteRowItems(p.items,{side:effectiveSide,payload:p});
}
async function copyPortSelection(cut=false){
  const p=capturePortClipboard(cut);if(!p)return;
  let system=false;try{await navigator.clipboard.writeText(p.text);system=true;}catch{}
  if(finishPortClipboard(p)&&!system)portEditNotice('已'+(cut?'剪下':'複製')+'到本頁剪貼簿；請用畫布上方的「貼上」。'+(cut?'Ctrl/Cmd+Z 可還原。':''));
}
async function pastePortSelection(){
  const start=portClipboardScope(),same=()=>{const now=portClipboardScope();return now.project===start.project&&now.module===start.module;};
  let text='';try{text=await navigator.clipboard.readText();}catch{
    if(!same()){portEditNotice('已切換模組，請在目標模組重新貼上。');return;}
    if(rowClipboard){pasteRowItems(rowClipboard.items,{payload:rowClipboard});return;}
    window.WIUProjectHost?.pastePortText?.();return;
  }
  if(!same()){portEditNotice('已切換模組，請在目標模組重新貼上。');return;}
  if(rowClipboard&&text===rowClipboard.text){pasteRowItems(rowClipboard.items,{payload:rowClipboard});return;}
  if(text.trim())pasteRowItems(normalizeClipboardRows(text,side==='right'?'output':'input'));else window.WIUProjectHost?.pastePortText?.();
}
function portEditingApi(){return {copy:()=>copyPortSelection(false),cut:()=>copyPortSelection(true),paste:pastePortSelection,duplicate:duplicateDeskSelection,pasteText:text=>pasteRowItems(normalizeClipboardRows(text,side==='right'?'output':'input')),delete:deleteSelectedRows,targetSide:()=>side,selectionCount:()=>selectedRowsAll().length,spacer:addInlineSpacer};}

window.WIUPortEditing=portEditingApi();
/* r71: update comments in place, and resolve each selection gesture once.
 * Kept inside the native editor closure. No input DOM replacement while typing:
 * composition, caret position and the current edit's Undo boundary stay intact.
 */
function syncPortCommentVisuals(which){
  const layout=ensureLayoutState(),rows=signalLayout(which),lane=commentLaneGeometry(which,rows,which==='left'?layout.leftSignalX:layout.rightSignalX,true);
  const svg=$('#diagramSvg');
  for(const s of rows){
    const value=cleanCommentLive(s.comment),selected=rowSelection[which].has(s.id);
    const box=$(`.signal-comment-editor[data-side="${which}"][data-id="${s.id}"]`);
    if(box){
      box.classList.toggle('empty',!value);box.classList.toggle('selected',selected);
      box.style.left=lane.x+'px';box.style.setProperty('--comment-lane-width',lane.width+'px');
      const font='500 11.5px -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Microsoft JhengHei",sans-serif';
      box.style.width=(selected?lane.width:value?Math.min(lane.width,Math.max(72,Math.ceil(measureTextPx('// '+value,font)+24))):118)+'px';
      const input=box.querySelector('input');if(input&&input!==document.activeElement)input.value=value;
    }
    if(!svg)continue;
    let label=svg.querySelector(`.sig-comment[data-side="${which}"][data-id="${s.id}"]`);
    const shown=isSpacerSignal(s)?'':commentDiagramText(value,lane.width-12);
    if(!shown){label?.remove();continue;}
    if(!label){label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('class','sig-comment');label.setAttribute('data-side',which);label.setAttribute('data-id',s.id);svg.appendChild(label);}
    for(const [key,val] of Object.entries({x:lane.x,y:s.y,'text-anchor':'start','dominant-baseline':'middle',fill:signalIsCommented(which,s)?'#8c939a':'#555b63'}))label.setAttribute(key,String(val));
    label.textContent='// '+shown;
  }
}
function refreshPortSelection(){
  for(const tr of $$('#rows tr[data-id]')){const chosen=rowSelection[side].has(tr.dataset.id);tr.classList.toggle('selected',chosen);tr.setAttribute('aria-selected',String(chosen));}
  const n=$('#sideCount');if(n)n.textContent=state.signals[side].length+' rows'+(rowSelection[side].size?' · '+rowSelection[side].size+' selected':'');
  renderInlineSelectionState();updateFormatToolbar();updateColorToolbar();updateDirectionAssignToolbar();updateGroupAssignToolbar();updateConditionAssignToolbar();syncDeskSelection();
}
function applyPortRangeSelection(refs,id,anchor,event={},toggle=false){
  const at=refs.findIndex(x=>x.sig.id===id);if(at<0)return anchor;
  const ref=refs[at],start=refs.findIndex(x=>x.sig.id===anchor),add=event.ctrlKey||event.metaKey||multiSelectMode;
  if(event.shiftKey&&start>=0){
    if(!add)clearAllSelections();
    for(const x of refs.slice(Math.min(start,at),Math.max(start,at)+1))rowSelection[x.which].add(x.sig.id);
    // clearAllSelections also clears per-side anchors. Restore the original
    // start, so another Shift click can grow OR shrink the same range.
  }else if(toggle||add){const set=rowSelection[ref.which];set.has(id)?set.delete(id):set.add(id);anchor=id;}
  else{clearAllSelections();rowSelection[ref.which].add(id);anchor=id;}
  const source=refs.find(x=>x.sig.id===anchor);if(source)selectionAnchor[source.which]=anchor;
  side=ref.which;nameFormatTarget=null;return anchor;
}
function selectRow(id,event={},which=side){
  const refs=state.signals[which].map(sig=>({which,sig}));
  const anchor=applyPortRangeSelection(refs,id,selectionAnchor[which],event);
  if(anchor)deskAnchor=anchor;
  refreshPortSelection();
}
function setDeskSelection(id,event={},forceToggle=false){
  finishActiveEditHistory();
  let refs=visibleDeskRefs();
  if(!refs.some(x=>x.sig.id===id)){const ref=deskSig(id);if(!ref)return;refs=[ref];}
  deskAnchor=applyPortRangeSelection(refs,id,deskAnchor,event,forceToggle);
  refreshPortSelection();
}
function portPointerTarget(target){
  const tr=target.closest?.('#signalTableRows [data-desk-id]');
  if(tr)return {id:tr.dataset.deskId,which:tr.dataset.side,surface:'desk'};
  const diagram=target.closest?.('#canvas .signal-card,#canvas .inline-gap,#canvas .line-length-editor,#canvas .signal-comment-editor,#canvas [data-direction-toggle]');
  if(diagram)return {id:diagram.dataset.id,which:diagram.dataset.side,surface:'diagram'};
  const old=target.closest?.('#rows tr[data-id]');
  return old?{id:old.dataset.id,which:side,surface:'diagram'}:null;
}
function handlePortModifierPointer(e){
  handlePortModifierPointer.pending=null;
  if(e.button!==0||!(e.shiftKey||e.ctrlKey||e.metaKey||multiSelectMode))return;
  const hit=portPointerTarget(e.target);if(!hit)return;
  // Shift in the already focused text field still extends a text selection.
  if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.target===document.activeElement&&isEditableTarget(e.target))return;
  e.preventDefault();e.stopImmediatePropagation();
  finishActiveEditHistory();clearTimeout(inlineCommitTimer);
  if(hit.surface==='desk')setDeskSelection(hit.id,e);else selectRow(hit.id,e,hit.which);
  handlePortModifierPointer.pending=hit;
  previewCanvas.focus?.({preventScroll:true});
}
function handlePortSelectionClick(e){
  const hit=portPointerTarget(e.target),pending=handlePortModifierPointer.pending;
  handlePortModifierPointer.pending=null;
  if(hit&&pending&&hit.id===pending.id&&hit.surface===pending.surface){e.preventDefault();e.stopImmediatePropagation();}
}
function cyclePortDirection(which,id){
  if(!portEditAllowed())return false;
  finishActiveEditHistory();clearTimeout(inlineCommitTimer);
  const sig=state.signals[which]?.find(s=>s.id===id);if(!sig||isSpacerSignal(sig))return false;
  const next=nextDirection(sig.direction);
  if(!commitPortCreation(()=>{sig.direction=next;}))return false;
  clearAllSelections();rowSelection[which].add(id);selectionAnchor[which]=id;deskAnchor=id;side=which;
  render();portEditNotice(sig.name+' → '+directionLabel(next)+'；Ctrl/Cmd+Z 復原。');return true;
}
function handlePortArrowKey(e){
  const arrow=e.target.closest?.('.dir-arrow-hit');
  if(!arrow||!['Enter',' '].includes(e.key))return;
  e.preventDefault();e.stopImmediatePropagation();
  cyclePortDirection(arrow.dataset.side,arrow.dataset.id);
}
document.addEventListener('pointerdown',handlePortModifierPointer,true);
document.addEventListener('click',handlePortSelectionClick,true);
previewCanvas?.addEventListener('keydown',handlePortArrowKey,true);

/* r72: refresh geometry without detaching the active editor or its ancestors. */
// Pan and zoom belong to previewView. Browser focus/selection can otherwise
// scroll this overflow-hidden viewport and displace the transformed drawing.
function resetNativeViewportScroll(viewport=$('#canvas')){
  if(!viewport)return;
  viewport.scrollLeft=0;
  viewport.scrollTop=0;
}
function syncLiveDiagramElement(old,fresh){
  const editor=old.matches('input,textarea,select');
  for(const a of [...old.attributes])if(!fresh.hasAttribute(a.name)&&!(editor&&a.name==='value'))old.removeAttribute(a.name);
  for(const a of [...fresh.attributes])if(!(editor&&a.name==='value'))old.setAttribute(a.name,a.value);
  if(editor)return;
  // Rich labels can change their span structure while editing their sibling input.
  if(old.matches('.name-rich,.module-rich,.group-rich')){old.innerHTML=fresh.innerHTML;return;}
  if(old.childNodes.length!==fresh.childNodes.length)return;
  [...old.childNodes].forEach((node,i)=>{const other=fresh.childNodes[i];
    if(node.nodeType===3&&other.nodeType===3)node.textContent=other.textContent;
    else if(node.nodeType===1&&other.nodeType===1&&node.tagName===other.tagName)syncLiveDiagramElement(node,other);
  });
}
function liveDiagramKey(el){return [el.tagName,el.classList[0],el.dataset.side||'',el.dataset.id||el.dataset.inlineGroup||el.dataset.inlineCondition||''].join('|');}
function mountDiagramMarkup(markup,live){
  const canvas=$('#canvas'),oldLayer=$('#inlineLayer');
  resetNativeViewportScroll(canvas);
  if(!live||!oldLayer){canvas.innerHTML=markup;return;}
  const fragment=document.createElement('div');fragment.innerHTML=markup;
  const freshLayer=fragment.querySelector('#inlineLayer');
  const keyed=children=>{const counts=new Map();return [...children].map(el=>{const base=liveDiagramKey(el),n=counts.get(base)||0;counts.set(base,n+1);return [base+'|'+n,el];});};
  const existing=new Map(keyed(oldLayer.children));
  // A blank name changes a card to a spacer. Defer this structural conversion
  // until blur; never discard an in-progress input (including IME composition).
  const next=keyed(freshLayer.children);
  if(next.length!==existing.size||next.some(([key])=>!existing.has(key)))return;
  oldLayer.style.cssText=freshLayer.style.cssText;
  for(const [key,el] of next)syncLiveDiagramElement(existing.get(key),el);
  canvas.querySelector('#diagramSvg')?.replaceWith(fragment.querySelector('#diagramSvg'));
  for(const selector of ['#blockOverlay','[data-rail-handle="left"]','[data-rail-handle="right"]']){
    const old=canvas.querySelector(selector),fresh=fragment.querySelector(selector);if(old&&fresh)syncLiveDiagramElement(old,fresh);
  }
}
function updatePortWidthHint(){
  const hint=$('#portWidthHint');if(!hint)return;
  const hits=selectedRowsAll(),raw=hits.length?commonDeskValue(hits,'bits'):null;
  hint.classList.remove('width-error');
  if(raw===null){hint.textContent=hits.length?'所選訊號位寬不同；輸入會套用至全部。':'位寬可填 512 或 [DATA_W-1:0]。';return;}
  const range=lengthToRange(raw);
  if(raw&&!range&&!isScalarBits(raw)){hint.textContent='無法解讀位寬。參數請寫成 [DATA_W-1:0]，先在「參數與位寬」定義 DATA_W。';hint.classList.add('width-error');return;}
  const info=window.WIUProjectHost?.widthInfo(range);
  if(!info){hint.textContent='位寬可填 512 或 [DATA_W-1:0]。';return;}
  hint.textContent=info.error?'無法計算：'+info.error:'模組預設：'+info.width+' bits'+(info.parameterized?'；instance 可覆寫參數。':'。');
  hint.classList.toggle('width-error',!!info.error);
}
document.getElementById('portParameterSettings')?.addEventListener('click',()=>window.WIUProjectHost?.parameterSettings());
document.getElementById('canvas')?.addEventListener('scroll',e=>resetNativeViewportScroll(e.currentTarget),{passive:true});

// A port belongs to a leaf; a leaf can belong to a PORT-level parent.
function groupAncestors(which,id){const out=[],seen=new Set();let g=groupById(which,id);while(g&&!seen.has(g.id)){seen.add(g.id);out.push(g);g=groupById(which,g.parentId);}return out;}
function groupLane(which,id){const children=state.groups[which].filter(g=>g.parentId===id);return children.length?1+Math.max(...children.map(g=>groupLane(which,g.id))):0;}
function usedGroupLanes(which){const used=new Set(state.signals[which].flatMap(s=>groupAncestors(which,s.groupId).map(g=>g.id))),widths=[];for(const g of state.groups[which])if(used.has(g.id)){const lane=groupLane(which,g.id);widths[lane]=Math.max(widths[lane]||0,groupAutoWidth(g));}return widths;}
function groupLaneOffset(which,id){return usedGroupLanes(which).slice(0,groupLane(which,id)).reduce((a,w)=>a+w+36,0);}
function groupSegments(which,laid){const out=[];for(const g of state.groups[which]){let last=null;for(let i=0;i<laid.length;i++){const s=laid[i];if(isSpacerSignal(s)||!groupAncestors(which,s.groupId).some(x=>x.id===g.id)){last=null;continue;}if(last&&last.lastIndex===i-1){last.y2=s.y+11;last.lastIndex=i;}else{last={groupId:g.id,name:g.name,color:g.color,y1:s.y-11,y2:s.y+11,firstIndex:i,lastIndex:i};out.push(last);}}}return out;}
function groupDescriptor(which,sig){const g=groupById(which,sig?.groupId);return g?{sourceSide:which,id:g.id,originId:g.originId||g.id,name:g.name,color:colorValue(g.color,'#007aff'),formatRuns:normalizeFormatRuns(g.formatRuns,String(g.name||'').length),parent:g.parentId?groupDescriptor(which,{groupId:g.parentId}):null}:null;}
function ensureGroupOnSide(which,desc,cache=null,independentGroups=null,preserveIdentity=false){
 if(!desc?.name)return null;const parentId=desc.parent?ensureGroupOnSide(which,desc.parent,cache,independentGroups,preserveIdentity):null,key=JSON.stringify([which,desc.sourceSide,desc.id,desc.name,parentId]);if(cache?.has(key))return cache.get(key);
 const independent=independentGroups?.has(desc.sourceSide+'::'+desc.id),originId=desc.originId||desc.id;
 let g=!independent&&desc.id?state.groups[which].find(x=>x.id===desc.id&&x.name===desc.name&&(x.parentId||null)===parentId):null;
 // Names can legitimately repeat after a full interface copy. Within a sheet,
 // crossing sides may only reunite a group with its own compatible counterpart.
 if(!g&&!independent&&preserveIdentity&&originId)g=state.groups[which].find(x=>
  (x.originId||x.id)===originId&&x.name===desc.name&&(x.parentId||null)===parentId&&
  colorValue(x.color,'#007aff')===colorValue(desc.color,'#007aff')&&
  JSON.stringify(normalizeFormatRuns(x.formatRuns,String(x.name||'').length))===JSON.stringify(normalizeFormatRuns(desc.formatRuns,String(desc.name||'').length)));
 if(!g&&!independent&&!preserveIdentity)g=state.groups[which].find(x=>x.name===desc.name&&(x.parentId||null)===parentId);
 if(!g){g=group(String(desc.name),colorValue(desc.color,COLORS[state.groups[which].length%COLORS.length]));g.parentId=parentId;g.formatRuns=normalizeFormatRuns(desc.formatRuns,String(g.name||'').length);if(preserveIdentity&&!independent&&originId)g.originId=originId;state.groups[which].push(g);}if(cache)cache.set(key,g.id);return g.id;
}
function createSelectionGroup(parent=false,nameOverride=null){
 const hits=selectedRowsAll();if(!hits.length){portEditNotice('請先選取接腳，再建立群組。');return false;}const which=hits[0].which;
 if(hits.some(x=>x.which!==which)){portEditNotice('請一次選取同一側的接腳。');return false;}
 const selected=new Set(hits.map(x=>x.sig.id)),leafIds=new Set(hits.map(x=>x.sig.groupId).filter(Boolean));
 if(parent){
  for(const id of leafIds){if(groupAncestors(which,id).length>1||state.groups[which].some(g=>g.parentId===id)){portEditNotice('已有兩層群組；請先刪除外層標示（會保留內層與接腳），再重組。');return false;}
   if(state.signals[which].some(s=>s.groupId===id&&!selected.has(s.id))){portEditNotice('建立外層前，請選取該內層群組的全部接腳。');return false;}}
 }
 let made;withHistory(()=>{made=group(nameOverride||(parent?'PORT '+state.groups[which].filter(g=>state.groups[which].some(c=>c.parentId===g.id)).length:'Interface '+(state.groups[which].length+1)),COLORS[state.groups[which].length%COLORS.length]);
  if(!parent){const parents=new Set(hits.map(x=>groupById(which,x.sig.groupId)?.parentId||null));if(parents.size===1)made.parentId=[...parents][0];}
  state.groups[which].push(made);
  for(const {sig} of hits){if(parent&&sig.groupId)groupById(which,sig.groupId).parentId=made.id;else sig.groupId=made.id;}
 });side=which;activeGroupId[which]=made.id;render();portEditNotice(parent?'已建立外層 PORT 群組，保留內層 interface。雙擊名稱修改。':'已建立內層 interface 群組。雙擊名稱修改。');return true;
}
function addInlineGroup(){return createSelectionGroup(selectedRowsAll().some(x=>x.sig.groupId));}
function removeCanvasGroup(which,id){const g=groupById(which,id);for(const child of state.groups[which])if(child.parentId===id)child.parentId=g?.parentId||null;state.groups[which]=state.groups[which].filter(x=>x.id!==id);for(const sig of state.signals[which])if(sig.groupId===id)sig.groupId=g?.parentId||null;}

/* Diagram text edits in its own field. Drafts commit only after validation.
 * There is no floating text dialog; model/history/export remain the owners. */
let canvasEdit=null,canvasEditor=null,canvasContext=null;
const directNameEdits=new WeakMap(),canvasDrafts=new Map();
let multiSelectMode=false;
const canvasDraftKey=ref=>JSON.stringify([portClipboardScope().project,portClipboardScope().module,ref.kind,ref.which||'',ref.id]);
function groupAutoWidth(item){return Math.max(118,Math.ceil(richNameMeasurePx(item)*1.14+62));}
function sideGroupWidth(which){const widths=usedGroupLanes(which);return widths.reduce((a,w)=>a+w,0)+Math.max(0,widths.length-1)*36;}
function groupGeometry(seg,which,laid,layout,lane){return editorGroupGeometry(seg,which,laid,which==='left'?layout.leftSignalX:layout.rightSignalX,lane);}
function editorGroupGeometry(seg,which,laid,lineX,lane){const x=groupRailX(which,lineX)+(which==='left'?-1:1)*groupLaneOffset(which,seg.groupId),labelW=groupAutoWidth(groupById(which,seg.groupId)||seg);return {...seg,x,labelX:which==='left'?x-labelW-12:x+12,labelW,maxCard:0,hasNotes:true};}
function commentLaneGeometry(which,laid,lineX,editor=false){const left=which==='left',width=effectiveCommentLaneWidth(which),gx=groupRailX(which,lineX),reserve=sideGroupWidth(which),outer=left?gx-reserve-12:gx+reserve+12,x=left?outer-COMMENT_LANE_GAP-width:outer+COMMENT_LANE_GAP;return {x,width,inner:left?x+width:x,outer:left?x:x+width,left};}
function inlineLengthHtml(s,which,layout){
 if(isSpacerSignal(s))return '';const left=which==='left',edge=left?layout.blockX:layout.blockX+layout.blockWidth,outer=left?layout.leftSignalX:layout.rightSignalX,available=Math.abs(outer-edge)-24,w=Math.min(available,Math.max(42,Math.ceil(measureTextPx(String(window.WIUPortWidths?.widthInput(s.bits)||s.bits),'600 12px Calibri, Arial, sans-serif'))+22)),x=(edge+outer-w)/2;
 return `<input readonly role="button" tabindex="-1" class="line-length-editor ${!isBusBits(s.bits)?'scalar':''} ${rowSelection[which].has(s.id)?'selected':''}" data-line-length data-side="${which}" data-id="${s.id}" data-act="bits" value="${esc(window.WIUPortWidths?.widthInput(s.bits)||s.bits)}" style="left:${x}px;top:${s.y-27}px;width:${w}px;color:${signalIsCommented(which,s)?'#8c939a':textColorOf(s)}">`;
}
function canvasSignalRows(){return ['left','right'].flatMap(which=>state.signals[which].map(s=>({...s,side:which})));}
function canvasFieldTarget(el){
  if(!el?.closest)return null;
  const module=el.closest('.block-title-editor');if(module)return {kind:'module',id:'module-title',anchor:module};
  const g=el.closest('.inline-group-label');if(g&&el.matches('[data-inline-group-name],.group-rich,.group-name-cell'))return {kind:'group',which:g.dataset.side,id:g.dataset.inlineGroup,anchor:g};
  const s=el.closest('.signal-card,.line-length-editor,.signal-comment-editor');if(!s)return null;
  const kind=s.matches('.line-length-editor')?'bits':s.matches('.signal-comment-editor')?'comment':el.matches('[data-act="name"],.name-rich,.inline-name-cell')?'name':null;
  return kind?{kind,which:s.dataset.side,id:s.dataset.id,anchor:s}:null;
}
function canvasItem(ref){return ref.kind==='module'?state:ref.kind==='group'?groupById(ref.which,ref.id):state.signals[ref.which]?.find(s=>s.id===ref.id);}
function canvasSetConflicts(ids=[]){
  const chosen=new Set(ids);
  for(const el of $$('.signal-card,#signalTableRows tr[data-desk-id]')){const id=el.dataset.id||el.dataset.deskId;el.classList.toggle('r73-conflict',chosen.has(id));if(chosen.has(id))el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');}
}
function canvasConflictState(ref,value){
  const conflicts=window.WIUCanvasEditing.nameConflicts(canvasSignalRows(),ref.id,value,portClipboardScope().reserved||[]);
  const text=String(value).trim();
  if(text&&!text.startsWith('//')&&!window.WIUCore.validName(text))return {conflicts,error:'名稱需以英文字母或底線開頭，後接英數字、底線或 $；例如 tx_data。'};
  return {conflicts,error:conflicts.length?'「'+text+'」已使用；紅框標示本列與同名列。改名尚未套用。':''};
}
function inlineCanvasInput(ref){
 const selector={module:'[data-inline-module]',group:'[data-inline-group-name]',bits:'[data-line-length]',comment:'[data-act="comment"]',name:'[data-act="name"]'}[ref.kind];
 if(ref.anchor?.matches?.(selector))return ref.anchor;
 const fromAnchor=ref.anchor?.querySelector?.(selector);if(fromAnchor)return fromAnchor;
 return ref.kind==='name'?signalFieldElement(ref.which,ref.id,'name'):ref.kind==='module'?$('#inlineLayer [data-inline-module]'):ref.kind==='group'?$(`.inline-group-label[data-inline-group="${ref.id}"] [data-inline-group-name]`):ref.kind==='bits'?$(`.line-length-editor[data-side="${ref.which}"][data-id="${ref.id}"]`):$(`.signal-comment-editor[data-side="${ref.which}"][data-id="${ref.id}"] [data-act="comment"]`);
}
function closeCanvasEditor(apply=false){
 if(!canvasEdit)return true;if(apply)return applyCanvasEditor();
 const ref=canvasEdit;canvasEdit=null;
 ref.input.value=ref.original;ref.input.removeAttribute('aria-invalid');ref.input.classList.remove('r84-invalid');
 ref.errorLabel?.remove();canvasDrafts.delete(canvasDraftKey(ref));window.WIUTextEditing?.reset(ref.input);return true;
}
function canvasWidthPlan(value,values={}){return window.WIUProjectHost?.portWidthPlan(value,values);}
function positionCanvasEditor(){
 if(!canvasEdit?.errorLabel)return;const {input,errorLabel}=canvasEdit;
 errorLabel.style.left=input.offsetLeft+'px';errorLabel.style.top=(input.offsetTop+input.offsetHeight+4)+'px';
}
function refreshCanvasEditor(){
 if(!canvasEdit)return;const ref=canvasEdit,input=ref.input;
 ref.error='';ref.plan=null;
 try{
  const locked=['name','bits','module'].includes(ref.kind)&&portClipboardScope().reason;if(locked)throw Error(locked);
  if(ref.kind==='name')ref.error=canvasConflictState(ref,input.value).error;
  if(ref.kind==='module')ref.error=window.WIUProjectHost?.moduleNameError(input.value)||'';
  if(ref.kind==='bits'){
   const plan=canvasWidthPlan(input.value);if(!plan)throw Error('位寬解析器尚未就緒。');ref.plan=plan;
   ref.error=plan.missing.length?'未宣告 '+plan.missing.join('、')+'；請先在模組設定填入參數預設值。':plan.error||'';
  }
 }catch(e){ref.error=e.message;}
 input.setAttribute('aria-invalid',String(!!ref.error));input.classList.toggle('r84-invalid',!!ref.error);
 input.title=ref.error||'原位輸入 · Enter / Tab 套用 · Esc 取消';
 if(ref.error&&!ref.errorLabel){ref.errorLabel=document.createElement('small');ref.errorLabel.className='r84-field-error';ref.errorLabel.setAttribute('role','status');input.parentElement.append(ref.errorLabel);}
 if(ref.errorLabel){ref.errorLabel.textContent=ref.error;ref.errorLabel.hidden=!ref.error;positionCanvasEditor();}
}
function beginCanvasField(ref,input){
 if(canvasEdit?.input===input)return;
 if(canvasEdit&&!applyCanvasEditor()){canvasDrafts.set(canvasDraftKey(canvasEdit),{...canvasEdit,anchor:null,input:null,errorLabel:null,value:canvasEdit.input.value});canvasEdit.errorLabel?.remove();canvasEdit=null;portEditNotice('錯誤輸入已保留；修正或 Esc 取消後才能儲存。');}
 if(history.tx!==null)endHistory();const item=canvasItem(ref);if(!item)return;
 canvasEdit={...ref,input,original:input.value,scope:JSON.stringify([portClipboardScope().project,portClipboardScope().module]),targets:ref.kind==='bits'&&selectedRowsAll().some(x=>x.sig.id===ref.id)?selectedRowsAll().map(x=>x.sig.id):[ref.id]};
 const draft=canvasDrafts.get(canvasDraftKey(ref));if(draft){input.value=draft.value;canvasEdit.original=ref.kind==='name'?item.name:draft.original;}
 refreshCanvasEditor();
}
function openCanvasEditor(ref){
 if(!ref||!canvasItem(ref))return;
 const input=inlineCanvasInput(ref);if(!input)return;
 input.readOnly=false;beginCanvasField(ref,input);input.focus({preventScroll:true});input.select();
}
function applyCanvasEditor(){
 if(!canvasEdit)return true;
 if(canvasEdit.scope!==JSON.stringify([portClipboardScope().project,portClipboardScope().module])){closeCanvasEditor(false);return false;}
 refreshCanvasEditor();if(canvasEdit.error)return false;
 const ref=canvasEdit,value=ref.input.value,plan=ref.plan;
 if(value===ref.original){closeCanvasEditor(false);return true;}
 canvasEdit=null;history.tx=null;ref.errorLabel?.remove();canvasDrafts.delete(canvasDraftKey(ref));ref.input.defaultValue=value;window.WIUTextEditing?.reset(ref.input);return commitCanvasField(ref,value,plan);
}
// Capture draft input before the retained native handlers can mutate state.
// Enter/Tab commits one history step, Escape cancels, blur commits valid text.
function inlineCanvasRef(el){const ref=canvasFieldTarget(el);return ref&&el.matches?.('input,textarea')?ref:null;}
function inlineCanvasNext(ref,step,tab=false){
 if(!['name','bits','comment'].includes(ref.kind))return null;
 const fs=['name','bits','comment'];let kind=ref.kind,id=ref.id;
 if(tab){const next=fs.indexOf(kind)+step;if(next>=0&&next<fs.length)return {...ref,kind:fs[next],anchor:null};kind=step>0?'name':'comment';}
 id=nextSignalId(ref.which,id,step);return id?{kind,which:ref.which,id}:null;
}
document.addEventListener('focusin',e=>{const ref=inlineCanvasRef(e.target);if(ref)beginCanvasField(ref,e.target);},true);
document.addEventListener('input',e=>{const ref=inlineCanvasRef(e.target);if(!ref)return;e.stopImmediatePropagation();beginCanvasField(ref,e.target);refreshCanvasEditor();},true);
document.addEventListener('change',e=>{if(inlineCanvasRef(e.target))e.stopImmediatePropagation();},true);
document.addEventListener('blur',e=>{if(canvasEdit?.input===e.target&&!applyCanvasEditor()){canvasDrafts.set(canvasDraftKey(canvasEdit),{...canvasEdit,input:null,anchor:null,errorLabel:null,value:canvasEdit.input.value});}},true);
window.addEventListener('keydown',e=>{
 const ref=inlineCanvasRef(e.target);if(!ref||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeCanvasEditor(false);e.target.blur();return;}
 if(!['Enter','Tab'].includes(e.key))return;
 e.preventDefault();e.stopImmediatePropagation();const next=inlineCanvasNext(ref,e.shiftKey?-1:1,e.key==='Tab');
 if(!applyCanvasEditor())return;
 e.target.blur();if(next)openCanvasEditor(next);else previewCanvas.focus({preventScroll:true});
},true);
function commitCanvasField(ref,value,plan=null){
  const item=canvasItem(ref);if(!item)return false;
  if(['name','bits','module'].includes(ref.kind)&&!portEditAllowed())return false;
  if(ref.kind==='name'){const result=canvasConflictState(ref,value);if(result.error){portEditNotice(result.error);return false;}}
  if(ref.kind==='module'){const error=window.WIUProjectHost?.moduleNameError(value);if(error){portEditNotice(error);return false;}}
  if(ref.kind==='bits'&&(!plan||plan.error||plan.missing.length)){portEditNotice('請先補齊位寬與參數。');return false;}
  const before=snapshotState();
  try{
    if(ref.kind==='bits'){
      for(const s of ['left','right'].flatMap(w=>state.signals[w]))if((ref.targets||[ref.id]).includes(s.id))s.bits=plan.range||'1';
      state.parameters=plan.parameters.map(p=>(p.local?'localparam ':'parameter ')+(p.type?p.type+' ':'')+p.name+' = '+p.value).join(', ');
    }else if(ref.kind==='module'){state.moduleName=String(value).trim();state.moduleFormatRuns=[];}else if(ref.kind==='group'){item.name=String(value).replace(/[\r\n]+/g,' ');item.formatRuns=[];}
    else if(ref.kind==='comment')item.comment=cleanCommentLive(value);
    else{item.name=cleanSignalNameLive(value);item.formatRuns=[];}
    const accepted=commitHistorySnapshot(before);render();
    return accepted;
  }catch(e){state=normalizeProjectState(JSON.parse(before));render();portEditNotice(e.message);return false;}
}
function prepareCanvasLabels(){
  for(const el of $$('#inlineLayer [data-act="name"],#inlineLayer [data-act="comment"],#inlineLayer [data-line-length],#inlineLayer [data-inline-group-name],#inlineLayer [data-inline-module]')){
    const ref=canvasFieldTarget(el),item=ref&&canvasItem(ref);if(!ref||!item)continue;const inline=true;el.readOnly=false;el.tabIndex=0;el.setAttribute('role','textbox');
    const label=ref.kind==='module'?'模組 '+state.moduleName:ref.kind==='group'?'群組 '+item.name:ref.kind==='bits'?item.name+' 位寬 '+item.bits:ref.kind==='comment'?item.name+' 註解':item.name;
    el.setAttribute('aria-label',label);el.title=label+' · '+(ref.kind==='name'?'直接輸入 · Enter / Tab 下一個名稱 · Shift 反向 · Esc 取消':'原位輸入 · Enter / Tab 套用 · Esc 取消');
    if(ref.kind==='comment'&&!item.comment)el.placeholder='＋ 註解';
    const draft=canvasDrafts.get(canvasDraftKey(ref));if(draft){el.value=draft.value;el.setAttribute('aria-invalid','true');el.title=draft.error;}
  }
  for(const el of $$('.line-length-editor')){const sig=state.signals[el.dataset.side]?.find(s=>s.id===el.dataset.id),info=sig&&window.WIUProjectHost?.widthInfo?.(lengthToRange(sig.bits));el.classList.toggle('r73-width-error',!!info?.error);if(info?.error){el.title='本模組未能解析：'+info.error+'；點擊補上宣告';el.setAttribute('aria-invalid','true');}}
  const existing=window.WIUCanvasEditing?.duplicateSets(canvasSignalRows())||[];
  canvasSetConflicts(existing.flatMap(g=>g.rows.map(s=>s.id)));
  if(canvasEdit?.conflicts?.length)canvasSetConflicts([canvasEdit.id,...canvasEdit.conflicts.map(x=>x.id).filter(Boolean)]);
  if(typeof findSession!=='undefined'&&findSession)refreshFindPanel();
}
function canvasLabelPointer(e){
 if(e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey)return;
 const ref=canvasFieldTarget(e.target);if(!ref||ref.kind==='name')return;
 if(e.target.matches('input,textarea'))return;
 e.preventDefault();e.stopImmediatePropagation();openCanvasEditor(ref);
}
function canvasLabelClick(e){
 const ref=canvasFieldTarget(e.target);if(!ref||ref.kind==='name'||e.target.matches('input,textarea'))return;
 e.preventDefault();e.stopImmediatePropagation();openCanvasEditor(ref);
}
function openCanvasContext(e){
  const hit=portPointerTarget(e.target);if(!hit||hit.surface!=='diagram')return;e.preventDefault();
  if(!rowSelection[hit.which].has(hit.id))selectRow(hit.id,{},hit.which);
  if(!canvasContext){canvasContext=document.createElement('div');canvasContext.id='r73-context';canvasContext.setAttribute('role','menu');document.body.append(canvasContext);}
  const actions=[['name','改名　Enter'],['bits','編輯位寬'],['comment','編輯註解'],['direction','切換方向'],['group','建立內層 interface 群組'],['parent','建立外層 PORT 群組'],['left','移至左側'],['right','移至右側'],['up','上移　Alt+↑'],['down','下移　Alt+↓'],['duplicate','複製一份　Ctrl+D'],['delete','刪除　Delete']];
  canvasContext.innerHTML=actions.map(([id,label])=>'<button role="menuitem" data-canvas-command="'+id+'">'+label+'<\/button>').join('');canvasContext.hidden=false;
  canvasContext.style.left=Math.min(e.clientX,window.innerWidth-220)+'px';canvasContext.style.top=Math.max(60,Math.min(e.clientY,window.innerHeight-canvasContext.offsetHeight-12))+'px';
  canvasContext.onclick=event=>{const command=event.target.closest('[data-canvas-command]')?.dataset.canvasCommand;if(!command)return;canvasContext.hidden=true;
    if(command==='name'){focusExcelText(signalFieldElement(hit.which,hit.id,'name'),true);return;}
    if(['bits','comment'].includes(command))openCanvasEditor({kind:command,which:hit.which,id:hit.id,anchor:$(`.signal-card[data-id="${hit.id}"]`)});
    else if(command==='direction')cyclePortDirection(hit.which,hit.id);else if(command==='group')createSelectionGroup(false);else if(command==='parent')createSelectionGroup(true);
    else if(command==='left'||command==='right')moveDeskSelection(command);else if(command==='up'||command==='down')reorderDeskSelection(command==='up'?-1:1);
    else if(command==='duplicate')duplicateDeskSelection();else if(command==='delete')deleteSelectedRows();
  };
}
function canvasDirectKey(e){
  if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||window.WIUManualOpen||(isEditableTarget(e.target)&&!e.target.readOnly)||e.target.closest?.('#r73-editor,#r74-find'))return;
  if(e.key==='Escape'){closeCanvasEditor(false);if(canvasContext)canvasContext.hidden=true;clearAllSelections();refreshPortSelection();return;}
  const moduleRef=canvasFieldTarget(e.target);if(moduleRef?.kind==='module'&&['Enter','F2'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();openCanvasEditor(moduleRef);return;}
  const hit=selectedRowsAll()[0];if(!hit)return;
  if(['Enter','F2'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();focusExcelText(signalFieldElement(hit.which,hit.sig.id,'name'),true);}
  else if(e.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='ArrowUp'||e.key==='ArrowDown')reorderDeskSelection(e.key==='ArrowUp'?-1:1);else moveDeskSelection(e.key==='ArrowLeft'?'left':'right');}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();e.stopImmediatePropagation();duplicateDeskSelection();}
}
document.addEventListener('pointerdown',canvasLabelPointer,true);
document.addEventListener('click',canvasLabelClick,true);
document.addEventListener('dblclick',canvasLabelClick,true);
document.addEventListener('contextmenu',openCanvasContext);
document.addEventListener('keydown',canvasDirectKey,true);
document.addEventListener('click',e=>{if(canvasContext&&!e.target.closest?.('#r73-context'))canvasContext.hidden=true;});
window.addEventListener('resize',()=>{if(canvasEdit)positionCanvasEditor(canvasEdit);});
// The full-width table/properties editors use the same conflict check. Invalid
// drafts never enter the model and therefore cannot lock direction changes.
function directNameRef(el){
 if(el?.closest?.('#inlineLayer')||el?.readOnly||!(el?.dataset?.deskField==='name'||el?.dataset?.inspectField==='name'||el?.dataset?.act==='name'))return null;
 const id=el.dataset.id||el.closest?.('[data-id]')?.dataset.id||selectedRowsAll()[0]?.sig.id;
 const row=deskSig(id);return row?{kind:'name',which:row.which,id,anchor:el}:null;
}
function directNameFeedback(el,result){
 el.setAttribute('aria-invalid',String(!!result.error));el.classList.toggle('r73-conflict',!!result.error);
 let message=el.parentElement?.querySelector('.r73-name-error');
 if(!message&&result.error){message=document.createElement('small');message.className='r73-name-error';message.style.color='#b52228';message.setAttribute('role','status');el.parentElement?.append(message);}
 if(message){message.textContent=result.error||'';message.hidden=!result.error;}
 const ref=directNameRef(el);canvasSetConflicts(result.conflicts?.length&&ref?[ref.id,...result.conflicts.map(c=>c.id).filter(Boolean)]:[]);
}
document.addEventListener('focusin',e=>{const ref=directNameRef(e.target);if(ref)directNameEdits.set(e.target,{ref,original:canvasItem(ref).name,formatRuns:canvasItem(ref).formatRuns,error:false});},true);
document.addEventListener('input',e=>{
 const ref=directNameRef(e.target);if(!ref)return;const result=canvasConflictState(ref,e.target.value),edit=directNameEdits.get(e.target);if(edit)edit.error=!!result.error;directNameFeedback(e.target,result);
 if(result.error){e.stopImmediatePropagation();e.preventDefault();}
},true);
document.addEventListener('blur',e=>{
 const edit=directNameEdits.get(e.target);if(!edit)return;directNameEdits.delete(e.target);
 if(edit.error){const item=canvasItem(edit.ref);if(item){item.name=edit.original;item.formatRuns=edit.formatRuns||[];e.target.value=item.name;}directNameFeedback(e.target,{error:'',conflicts:[]});portEditNotice('改名未套用，保留「'+edit.original+'」。其他操作可繼續。');}
},true);

/* Transient pointer state belongs to a sheet, never to a loaded project. */
function resetDiagramInteraction(){
 finishInlinePointerDrag(null,true);
 for(const gesture of [blockResize,signalRailDrag,previewPan,previewPanPending]){
  if(gesture?.pointerId!=null)try{if(previewCanvas.hasPointerCapture?.(gesture.pointerId))previewCanvas.releasePointerCapture(gesture.pointerId);}catch{}
 }
 blockResize=null;signalRailDrag=null;previewPan=null;previewPanPending=null;spacePanHeld=false;
 previewCanvas.classList?.remove('is-resizing','is-rail-dragging','is-dragging','pan-ready');
 clearTimeout(inlineCommitTimer);inlineCommitTimer=null;
}
function keyboardResizeBlock(handle,key,shift=false){
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return false;
 finishActiveEditHistory();beginHistory();previewView.fit=false;
 blockResize={handle,startX:0,startY:0,start:{...ensureLayoutState()},scale:previewView.scale||1};
 const amount=(shift?20:2)*blockResize.scale;
 applyBlockResize(key==='ArrowRight'?amount:key==='ArrowLeft'?-amount:0,key==='ArrowDown'?amount:key==='ArrowUp'?-amount:0);
 endBlockResize();return true;
}
previewCanvas.addEventListener('keydown',e=>{const handle=e.target.closest?.('[data-handle]');if(handle&&keyboardResizeBlock(handle.dataset.handle,e.key,e.shiftKey)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('blur',()=>{if(blockResize)endBlockResize();if(signalRailDrag)endSignalRailDrag();resetDiagramInteraction();});
function showVisioDownload(name,bytes){
 let panel=document.getElementById('r75-visio-download');if(panel){for(const a of panel.querySelectorAll('a'))URL.revokeObjectURL(a.href);panel.remove();}
 panel=document.createElement('div');panel.id='r75-visio-download';panel.setAttribute('role','status');document.body.append(panel);
 const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));link.download=name;link.textContent='下載 '+name;panel.append(link);
 const note=document.createElement('span');note.textContent='目前介面圖 · Calibri 12 pt · Windows Visio → .vsdx';panel.append(note);
 if(window.WIUBundle){
  const readme='WrapItfUp r75 - Visio interface diagram\n\nFiles: '+name+' and README.txt.\n\n1. Extract both files to a writable Windows folder.\n2. Microsoft Visio desktop must be installed. Run '+name+'.\n3. The script creates an editable .vsdx beside itself and asks before replacing it.\n\nThis draws the CURRENT module interface, not the Top instance wiring graph.\nText uses Calibri 12 pt (Latin, Asian and complex-script font settings).\nBlock, arrows, labels, widths, comments and groups are editable Visio shapes.\nThe shared scene is drawn directly; no separate stencil is needed.\nThe VBS also carries the complete WrapItfUp project for Open project recovery.\nUse Save project / Ctrl+S for a regular .wiu.json backup of all modules, wiring and layout.\n\nNo Windows Visio execution was available in the r75 test environment.\nFollow your organization policy for running scripts; do not disable security controls.\n';
  const zip=document.createElement('a');zip.href=URL.createObjectURL(new Blob([window.WIUBundle.zip([{path:name,data:bytes},{path:'README.txt',text:readme}])],{type:'application/zip'}));zip.download=name.replace(/\.vbs$/i,'-visio.zip');zip.textContent='下載 ZIP（VBS＋說明）';panel.append(zip);
 }
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','關閉 Visio 下載提示');close.onclick=()=>{for(const a of panel.querySelectorAll('a'))URL.revokeObjectURL(a.href);panel.remove();};panel.append(close);link.click();
}

function sceneTextRuns(item){const mask=formatMask(item),name=String(item?.name||''),runs=[];for(let i=0;i<name.length;i++){const style=mask[i]||0,last=runs[runs.length-1];if(last?.style===style)last.text+=name[i];else runs.push({text:name[i],style});}return runs;}
function sharedDiagramScene(){
 const D=window.WIUDiagramScene,layout=ensureLayoutState(),items=[],L=signalLayout('left'),R=signalLayout('right');
 const line=(x1,y1,x2,y2,options={})=>items.push({type:'line',x1,y1,x2,y2,color:'#222222',weight:1,...options});
 const label=(value,x,y,align,options={})=>{const t=D.text(value,x,y,align,options,measureTextPx);items.push(t);return t;};
 items.push({type:'rect',x:layout.blockX,y:layout.blockY,width:layout.blockWidth,height:layout.blockHeight,color:'#222222',fill:'#ffffff',weight:1.25,role:'block'});
 const safe=blockTitleSafeMetrics(layout),obj=moduleFormatObject(),titleLines=wrapTextRanges(obj.name,safe.width,'700 16.5px Calibri, Arial, sans-serif'),cy=layout.blockY+layout.blockHeight/2;
 titleLines.forEach((t,i)=>label(t.text,safe.cx,cy+(i-(titleLines.length-1)/2)*22,'middle',{size:16.5,bold:true,className:'modtitle',role:'module'}));
 for(const [which,rows] of [['left',L],['right',R]]){
  const left=which==='left',edge=left?layout.blockX:layout.blockX+layout.blockWidth,outer=left?layout.leftSignalX:layout.rightSignalX,lane=commentLaneGeometry(which,rows,outer,false);
  for(const s of rows){if(isSpacerSignal(s))continue;
   const muted=signalIsCommented(which,s),color=muted?'#9aa0a6':lineColorOf(s),tc=muted?'#8c939a':textColorOf(s),input=s.direction==='input'||s.direction==='inout',from=input?outer:edge,to=input?edge:outer,bus=isBusBits(s.bits),busX=(edge+outer)/2;
   line(from,s.y,to,s.y,{color,weight:bus?1.4:1.05,startArrow:s.direction==='inout',endArrow:true,role:'signal'});
   label(s.name,left?edge+PORT_NAME_EDGE_PAD:edge-PORT_NAME_EDGE_PAD,s.y,left?'start':'end',{bold:true,color:tc,runs:sceneTextRuns(s),className:'sig',role:'port'});
   if(bus)line(busX-6,s.y+6,busX+6,s.y-6,{color,role:'bus-slash'});
   let showWidth=!!String(s.bits??'').trim()&&!isScalarBits(s.bits);
   if(showWidth&&window.WIUPortWidths){
    try{const range=window.WIUPortWidths.rangeFromInput(s.bits),info=window.WIUProjectHost?.widthInfo?.(range)||window.WIUPortWidths.width(range,[],{});showWidth=info.width!==1;}catch{}
   }
   if(showWidth)label(window.WIUPortWidths?.widthInput(s.bits)||s.bits||'1',busX,s.y-15,'middle',{color:tc,className:'bittext',role:'width'});
   const comment=cleanComment(s.comment);if(comment)label('// '+comment,lane.x,s.y,'start',{color:muted?'#8c939a':'#555b63',className:'sig-comment',role:'comment'});
  }
  for(const seg of groupSegments(which,rows)){
   const g=groupGeometry(seg,which,rows,layout,lane),item=groupById(which,g.groupId),color=isCommentedLabel(item?.name)?'#9aa0a6':g.color,cap=g.x+(left?10:-10);
   line(g.x,g.y1,g.x,g.y2,{color,weight:1.7});line(g.x,g.y1,cap,g.y1,{color,weight:1.7});line(g.x,g.y2,cap,g.y2,{color,weight:1.7});
   label(g.name,left?g.x-12:g.x+12,(g.y1+g.y2)/2,left?'end':'start',{bold:true,color,runs:sceneTextRuns(item||g),className:'grp',role:'group'});
  }
  for(const seg of conditionSegments(which,rows)){
   const c=conditionById(which,seg.conditionId),g=conditionGeometry(seg,which,outer);if(!c)continue;const color=isCommentedLabel(c.macro)?'#9aa0a6':CONDITION_COLOR,cap=g.x+(left?10:-10);
   line(g.x,g.y1,g.x,g.y2,{color,dash:true});line(g.x,g.y1,cap,g.y1,{color,dash:true});line(g.x,g.y2,cap,g.y2,{color,dash:true});label(conditionText(c),g.x+(left?-12:12),(g.y1+g.y2)/2,left?'end':'start',{color,className:'cond',role:'condition'});
  }
 }
 return {width:1950,height:getCanvasHeight(),items,bounds:D.bounds(items)};
}
function sharedDiagramMarkup(legacy){const scene=sharedDiagramScene();presentationContentBounds=scene.bounds;previewContentBounds={...scene.bounds};const hits=legacy.match(/<(?:line|circle) class="dir-(?:line|arrow)-hit"[\s\S]*?<\/(?:line|circle)>/g)||[];return window.WIUDiagramScene.svg(scene).replace('<\/svg>',hits.join('')+'<\/svg>');}
function makeVbs(projectEncodedOverride=null,fontPt=12){
 const encoded=projectEncodedOverride||encodeState(makeProject());
 return window.WIUDiagramScene.vbs(sharedDiagramScene(),{metadata:makeEmbeddedStateChunks(encoded,180,"' "),name:safeProjectName()});
}
function toggleArtworkPreview(){const on=document.body.classList.toggle('r76-artwork');$('#toggleArtworkPreview')?.setAttribute('aria-pressed',String(on));renderDiagram();}

function groupMembers(which,id){return state.signals[which].filter(s=>!isSpacerSignal(s)&&groupAncestors(which,s.groupId).some(g=>g.id===id));}
function setGroupColor(which,id,color){if(!/^#[0-9a-f]{6}$/i.test(color)||!groupById(which,id))return false;withHistory(()=>groupById(which,id).color=color);render();return true;}
function renderGroupPanel(){
 const panel=$('#r76-groups');if(!panel||panel.hidden)return;const list=$('#r76-group-list'),open=new Set([...list.querySelectorAll('details[open]')].map(d=>d.dataset.group)),q=($('#r76-group-search')?.value||'').trim().toLowerCase();
 list.innerHTML=['left','right'].map(which=>{const groups=state.groups[which].filter(g=>!q||[g.name,...groupMembers(which,g.id).map(s=>s.name)].join(' ').toLowerCase().includes(q));if(!groups.length)return '';return '<h3>'+ (which==='left'?'左側':'右側')+'<\/h3>'+groups.map(g=>{const members=groupMembers(which,g.id),key=which+':'+g.id,parent=groupById(which,g.parentId);return `<details data-group="${esc(key)}" ${open.has(key)?'open':''}><summary><span class="r76-color-dot" style="background:${esc(g.color)}"><\/span><span>${esc(g.name)}${parent?'<small>'+esc(parent.name)+' / 內層<\/small>':''}<\/span><small>${members.length} 訊號<\/small><\/summary><div class="r76-group-tools"><label>顏色 <input type="color" data-group-color="${esc(g.id)}" data-side="${which}" value="${esc(g.color)}" aria-label="${esc(g.name)} 顏色"><\/label><button data-group-select="${esc(g.id)}" data-side="${which}">選取成員<\/button><button data-group-rename="${esc(g.id)}" data-side="${which}">改名<\/button><\/div><ul>${members.map(s=>`<li><button data-group-locate="${esc(s.id)}">${esc(s.name)}<\/button><small>${esc(s.direction==='input'?'IN':s.direction==='output'?'OUT':'I/O')}<\/small><\/li>`).join('')||'<li>尚無訊號<\/li>'}<\/ul><\/details>`;}).join('');}).join('')||'<p class="desk-empty">沒有符合的群組。先在圖面選取訊號，再從「編輯」建立群組。<\/p>';
}
function setupR76Panels(){
 const toggle=document.createElement('button');toggle.id='toggleGroups';toggle.className='btn';toggle.textContent='群組';toggle.setAttribute('aria-pressed','false');$('#toggleSignalTable').after(toggle);
 const art=document.createElement('button');art.id='toggleArtworkPreview';art.className='btn';art.textContent='成圖預覽';art.title='網頁 SVG 與 Visio 使用同一份排版；再次點擊返回編輯';art.setAttribute('aria-pressed','false');$('#toggleInspector').after(art);art.onclick=toggleArtworkPreview;
 const panel=document.createElement('aside');panel.id='r76-groups';panel.className='desk-panel';panel.hidden=true;panel.setAttribute('aria-label','群組清單');panel.innerHTML='<div class="desk-panel-header"><b>群組<\/b><button class="btn" aria-label="收合群組">×<\/button><\/div><div class="desk-search"><input id="r76-group-search" type="search" placeholder="搜尋群組或成員訊號" aria-label="搜尋群組"><\/div><div id="r76-group-list"><\/div>';
 $('#signalsPanel').after(panel);
 const show=on=>{panel.hidden=!on;toggle.setAttribute('aria-pressed',String(on));if(on){$('#workbench').classList.remove('signals-open','inspect-open');$('#toggleSignalTable').setAttribute('aria-pressed','false');$('#toggleInspector').setAttribute('aria-pressed','false');}renderGroupPanel();};
 toggle.onclick=()=>show(panel.hidden);panel.querySelector('.desk-panel-header button').onclick=()=>show(false);
 for(const id of ['toggleSignalTable','toggleInspector'])$('#'+id).addEventListener('click',()=>show(false));
 $('#r76-group-search').addEventListener('input',renderGroupPanel);
 panel.addEventListener('change',e=>{if(e.target.dataset.groupColor)setGroupColor(e.target.dataset.side,e.target.dataset.groupColor,e.target.value);});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const which=b.dataset.side,id=b.dataset.groupSelect||b.dataset.groupRename;if(b.dataset.groupLocate){setDeskSelection(b.dataset.groupLocate);locateDeskSignal(b.dataset.groupLocate);}else if(b.dataset.groupSelect){clearAllSelections();side=which;for(const s of groupMembers(which,id))rowSelection[which].add(s.id);render();}else if(b.dataset.groupRename){const anchor=$$('.inline-group-label').find(el=>el.dataset.inlineGroup===id&&el.dataset.side===which);if(anchor)openCanvasEditor({kind:'group',which,id,anchor});}});
}
setupR76Panels();

let findPanel=null,findSession=null,findLast={query:'',replacement:'',field:'name',caseSensitive:true,wholeWord:false};
function findRows(){const rows=[];for(const side of ['left','right']){for(const s of state.signals[side])if(!isSpacerSignal(s)){rows.push({id:s.id,side,kind:'name',value:s.name,label:s.name},{id:s.id,side,kind:'comment',value:s.comment||'',label:s.name});}for(const g of state.groups[side])rows.push({id:g.id,side,kind:'group',value:g.name,label:groupAncestors(side,g.id).reverse().map(x=>x.name).join(' / ')});}return rows;}
function findScopeIds(field){if(!findSession||findPanel.querySelector('#r74-find-scope').value!=='selected')return null;if(field!=='group')return findSession.selection;return [...new Set(findSession.selection.flatMap(id=>{const r=deskSig(id);return r?groupAncestors(r.which,r.sig.groupId).map(g=>g.id):[];}))];}
function findOptions(extra={}){const scope=portClipboardScope(),field=findPanel.querySelector('#r74-find-field').value;return {query:findPanel.querySelector('#r74-find-query').value,replacement:findPanel.querySelector('#r74-find-replacement').value,field,ids:findScopeIds(field),caseSensitive:findPanel.querySelector('#r74-find-case').checked,wholeWord:findPanel.querySelector('#r74-find-word').checked,reserved:scope.reserved,caseInsensitiveNames:scope.module==='top',locked:scope.reason,...extra};}
function clearFindMarks(){for(const el of $$('.r74-match,.r74-current,.r74-conflict'))el.classList.remove('r74-match','r74-current','r74-conflict');}
function closeFindPanel(){if(!findSession)return;const o=findOptions();findLast={query:o.query,replacement:o.replacement,field:o.field,caseSensitive:o.caseSensitive,wholeWord:o.wholeWord};findSession=null;findPanel.hidden=true;clearFindMarks();}
function findLabelNodes(id,kind){return kind==='group'?$$('.inline-group-label[data-inline-group="'+id+'"]'):$$('.signal-card[data-id="'+id+'"],#signalTableRows tr[data-desk-id="'+id+'"]');}
function findMarkedText(value,options){let html='',at=0;for(const hit of window.WIUFindReplaceCore.occurrences(value,options.query,options)){html+=esc(value.slice(at,hit.start))+'<mark>'+esc(value.slice(hit.start,hit.end))+'</mark>';at=hit.end;}return html+esc(value.slice(at));}
function refreshFindPanel(reset=false){
 if(!findSession||!findPanel)return;if(findSession.scope!==JSON.stringify([portClipboardScope().project,portClipboardScope().module])){closeFindPanel();return;}
 findSession.numbered=null;findPanel.querySelector('[data-find-numbered]').hidden=true;
 const opts=findOptions(),plan=window.WIUFindReplaceCore.plan(findRows(),opts);findSession.plan=plan;if(reset)findSession.index=0;findSession.index=Math.max(0,Math.min(findSession.index,plan.matches.length-1));const current=plan.matches[findSession.index];
 clearFindMarks();for(const m of plan.matches)for(const el of findLabelNodes(m.id,m.kind))el.classList.add('r74-match');if(current)for(const el of findLabelNodes(current.id,current.kind))el.classList.add('r74-current');if(findSession.mode==='replace')for(const id of plan.conflicts)for(const el of findLabelNodes(id,opts.field))el.classList.add('r74-conflict');
 const summary=findPanel.querySelector('#r74-find-status');summary.textContent=!opts.query?'輸入要尋找的文字。':plan.matches.length?(findSession.index+1)+' / '+plan.matches.length+' 處 · '+new Set(plan.matches.map(m=>m.id)).size+' 列'+(findSession.mode==='replace'?' · 將修改 '+plan.changes.length+' 列':''):'找不到符合的文字；可調整範圍或大小寫設定。';
 const error=findPanel.querySelector('#r74-find-error');error.textContent=findSession.mode==='replace'?plan.errors.join('；'):'';error.hidden=!error.textContent;
 const list=findPanel.querySelector('#r74-find-results'),rows=findRows();list.innerHTML=(findSession.mode==='replace'?plan.changes:plan.matches.filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i)).map(c=>'<button type="button" data-find-locate="'+esc(c.id)+'" class="'+(plan.conflicts.includes(c.id)?'r74-error-row':'')+'"><span>'+esc(c.label)+'</span>'+(findSession.mode==='replace'?'<del>'+findMarkedText(c.before,opts)+'</del><strong>→ '+esc(c.after||'（清空）')+'</strong>':'<div>'+findMarkedText(String(rows.find(r=>r.id===c.id&&r.kind===opts.field)?.value||''),opts)+'</div>')+'</button>').join('');
 for(const b of findPanel.querySelectorAll('[data-find-move]'))b.disabled=!plan.matches.length;
 for(const [action,only] of [['one',true],['all',false]]){const b=findPanel.querySelector('[data-find-apply="'+action+'"]'),p=only&&current?window.WIUFindReplaceCore.plan(findRows(),findOptions({onlyMatch:current.key})):plan;b.disabled=!p.changes.length||!!p.errors.length;b.title=p.errors.join('；')||(!p.changes.length?'沒有可套用的變更':'套用後可一次復原');}
 findPanel.querySelector('[data-find-unique]').hidden=findSession.mode!=='replace'||opts.field!=='name'||!plan.conflicts.length||!!opts.locked;
 const hint=findPanel.querySelector('#r74-find-hint');hint.textContent=opts.field==='name'?'只取代訊號名稱；接線依 port 身分同步更新。參數與位寬不受字串取代影響。':opts.field==='group'?'取代群組標示；選取範圍包含接腳所屬的內、外兩層群組。':'取代接腳註解；空白取代值表示刪除符合文字。';
}
function locateFindItem(id,kind){if(kind==='group'){const side=findRows().find(r=>r.kind==='group'&&r.id===id)?.side,s=side&&state.signals[side].find(s=>groupAncestors(side,s.groupId).some(g=>g.id===id));if(s)locateDeskSignal(s.id);}else locateDeskSignal(id);}
function nextFindMatch(delta=1){if(!findSession)return;refreshFindPanel();const n=findSession.plan.matches.length;if(!n)return;findSession.index=(findSession.index+delta+n)%n;const m=findSession.plan.matches[findSession.index];locateFindItem(m.id,m.kind);refreshFindPanel();}
function commitFindChanges(plan){
 if(!plan.changes.length||plan.errors.length)return false;const before=snapshotState();
 // A stale preview may never write into another sheet or silently overwrite a newer value.
 const rows=findRows();for(const c of plan.changes){if(rows.find(r=>r.id===c.id&&r.kind===c.kind)?.value!==c.before){portEditNotice('內容已變更，請重新確認取代預覽。');return false;}}
 try{for(const c of plan.changes){const item=c.kind==='group'?groupById(c.side,c.id):state.signals[c.side].find(s=>s.id===c.id);if(c.kind==='comment')item.comment=c.after;else{item.name=c.after;item.formatRuns=[];}}
  const accepted=commitHistorySnapshot(before);render();return accepted;
 }catch(e){state=normalizeProjectState(JSON.parse(before));render();portEditNotice('取代未套用：'+e.message);return false;}
}
function applyFindChanges(all){if(!findSession)return;refreshFindPanel();const current=findSession.plan.matches[findSession.index],plan=window.WIUFindReplaceCore.plan(findRows(),findOptions(all?{}:{onlyMatch:current?.key}));if(!commitFindChanges(plan))return;refreshFindPanel();portEditNotice('已取代 '+plan.changes.length+' 列；Ctrl/Cmd+Z 可復原整筆取代。');}
function numberFindConflicts(){if(!findSession)return;const plan=findSession.plan,used=portNamesInUse(plan.changes.map(c=>c.id)),names=allocatePortNames(plan.changes.map(c=>c.after),used),overrides=Object.fromEntries(plan.changes.map((c,i)=>[c.id,names[i]])),next=window.WIUFindReplaceCore.plan(findRows(),findOptions({overrides}));if(next.errors.length){portEditNotice(next.errors.join('；'));return;}
 // Numbering is shown in the replacement preview, then confirmed separately.
 findSession.numbered=next;findPanel.querySelector('#r74-find-error').hidden=false;findPanel.querySelector('#r74-find-error').textContent='已產生不重複名稱，請核對下列結果後按「套用編號結果」。';findPanel.querySelector('#r74-find-results').innerHTML=next.changes.map(c=>'<button type="button" data-find-locate="'+esc(c.id)+'"><span>'+esc(c.label)+'</span><del>'+esc(c.before)+'</del><strong>→ '+esc(c.after)+'</strong></button>').join('');findPanel.querySelector('[data-find-numbered]').hidden=false;
}
function openFindPanel(mode='find'){
 if(canvasEdit&&!applyCanvasEditor()){portEditNotice('請先修正或取消目前的文字編輯，再尋找／取代。');return false;}finishActiveEditHistory();
 if(findSession&&!document.activeElement?.closest?.('#r74-find'))closeFindPanel();
 if(!findPanel){findPanel=document.createElement('section');findPanel.id='r74-find';findPanel.setAttribute('role','dialog');findPanel.setAttribute('aria-modal','false');findPanel.setAttribute('aria-label','尋找與取代');document.body.append(findPanel);
  findPanel.innerHTML='<header><strong id="r74-find-title"></strong><button data-find-mode="find">尋找 Ctrl+F</button><button data-find-mode="replace">取代 Ctrl+H</button><button data-find-close aria-label="關閉尋找與取代">×</button></header><div class="r74-find-fields"><label>尋找<input id="r74-find-query" spellcheck="false" placeholder="例如 p0_"></label><label data-replace-only>取代為<input id="r74-find-replacement" spellcheck="false" placeholder="例如 p1_（可留空）"></label><div class="r74-find-options"><label>範圍<select id="r74-find-scope"></select></label><label>內容<select id="r74-find-field"><option value="name">訊號名稱</option><option value="comment">接腳註解</option><option value="group">群組名稱</option></select></label></div><div class="r74-find-flags"><label><input type="checkbox" id="r74-find-case" checked>區分大小寫</label><label><input type="checkbox" id="r74-find-word">完整字詞</label><small>一般文字</small></div></div><p id="r74-find-status" role="status"></p><div class="r74-find-nav"><button data-find-move="-1">上一個 Shift+F3</button><button data-find-move="1">下一個 F3</button></div><p id="r74-find-error" class="r73-error" role="alert" hidden></p><button data-find-unique hidden>預覽不重複名稱（自動編號）</button><div id="r74-find-results"></div><small id="r74-find-hint"></small><footer data-replace-only><button data-find-numbered hidden>套用編號結果</button><button data-find-apply="one">取代目前</button><button data-find-apply="all" class="primary">全部取代</button></footer>';
  findPanel.addEventListener('input',()=>{if(findSession)findSession.numbered=null;findPanel.querySelector('[data-find-numbered]').hidden=true;refreshFindPanel(true);const m=findSession?.plan?.matches[0];if(m)locateFindItem(m.id,m.kind);});
  findPanel.addEventListener('change',()=>refreshFindPanel(true));
  findPanel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeFindPanel();previewCanvas.focus();}else if(e.key==='Enter'&&!e.isComposing){e.preventDefault();nextFindMatch(e.shiftKey?-1:1);}});
  findPanel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-find-close')){closeFindPanel();previewCanvas.focus();}else if(b.dataset.findMode)openFindPanel(b.dataset.findMode);else if(b.dataset.findMove)nextFindMatch(Number(b.dataset.findMove));else if(b.dataset.findApply)applyFindChanges(b.dataset.findApply==='all');else if(b.dataset.findLocate){const matches=findSession.plan.matches;findSession.index=Math.max(0,matches.findIndex(m=>m.id===b.dataset.findLocate));locateFindItem(b.dataset.findLocate,findOptions().field);refreshFindPanel();}else if(b.hasAttribute('data-find-unique'))numberFindConflicts();else if(b.hasAttribute('data-find-numbered')){const plan=findSession.numbered;if(plan&&commitFindChanges(plan)){b.hidden=true;findSession.numbered=null;refreshFindPanel();portEditNotice('已取代並編號；可一次復原。');}}});
 }
 if(!findSession){const selection=selectedRowsAll().map(x=>x.sig.id);findSession={selection,index:0,scope:JSON.stringify([portClipboardScope().project,portClipboardScope().module])};findPanel.querySelector('#r74-find-scope').innerHTML=(selection.length?'<option value="selected">開啟時選取的 '+selection.length+' 個訊號</option>':'')+'<option value="module">目前模組全部訊號</option>';for(const [id,value] of [['query',findLast.query],['replacement',findLast.replacement],['field',findLast.field]])findPanel.querySelector('#r74-find-'+id).value=value;findPanel.querySelector('#r74-find-case').checked=findLast.caseSensitive;findPanel.querySelector('#r74-find-word').checked=findLast.wholeWord;}
 findSession.mode=mode;findPanel.hidden=false;findPanel.querySelector('#r74-find-title').textContent=state.moduleName;for(const el of findPanel.querySelectorAll('[data-replace-only]'))el.hidden=mode!=='replace';findPanel.querySelector('[data-find-numbered]').hidden=true;refreshFindPanel();const input=findPanel.querySelector('#r74-find-query');input.focus();input.select();return true;
}
window.WIUFindReplace={open:openFindPanel,close:closeFindPanel,next:nextFindMatch,isOpen:()=>!!findSession};


/* Injected inside the original editor closure; shares the workbook history. */
window.WIUBridge={
  getPorts(){
    const issues=[],refs=activeRtlRefs().filter(r=>String(r.sig.name||'').trim());
    if(!window.WIUCore.validName(state.moduleName))issues.push({severity:'error',code:'TOP_NAME',message:'圖面 module 名稱需為合法 Verilog 識別字；請先移除空白或特殊字元。'});
    if(refs.some(r=>r.sig.conditionId))issues.push({severity:'error',code:'CONDITIONAL_INTERFACE',message:'圖面含條件編譯 ports，請先決定實際組態；本版不會把不同分支默默合併。'});
    for(const r of refs){const bits=String(r.sig.bits||'').trim();if(bits&&!lengthToRange(bits)&&!['1','1b','1bit','1 bit','b'].includes(bits.toLowerCase()))issues.push({severity:'error',code:'PORT_RANGE',message:r.sig.name+' 的位寬無法安全轉換：'+bits});}
    const parsed=window.WIUParser.parseRtl(rtlText()+'\nendmodule\n',{config:window.WIUProjectHost?.config()});
    issues.push(...parsed.issues.filter(x=>x.severity==='error'));
    const module=parsed.modules[0];
    if(!module)issues.push({severity:'error',code:'NO_INTERFACE',message:'無法讀取圖面介面。'});
    return {top:state.moduleName,parameters:module?.parameters||[],ports:(module?.ports||[]).map(p=>{
      const ref=refs.find(r=>r.sig.name===p.name),g=ref?groupById(ref.which,ref.sig.groupId):null;
      return {name:p.name,range:p.range,direction:p.direction,signed:!!p.signed,comment:p.comment||ref?.sig.comment||'',group:ref?groupAncestors(ref.which,ref.sig.groupId).reverse().map(x=>x.name).join(' / '):''};
    }),issues};
  },
  setDiagram(raw){
    const next=normalizeProjectState(raw);
    finishActiveEditHistory();const before=snapshotState();
    state=next;side='left';activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};
    clearAllSelections();nameFormatTarget=null;previewView.fit=true;
    commitHistorySnapshot(before);render();markWorkspaceSaved(null,'已載入');
  },
  setPorts(top,ports,parameters=[]){
    const params=Array.isArray(parameters)?parameters:Object.entries(parameters).map(([name,value])=>({name,value}));
    if(params.some(p=>p.local))throw Error('介面圖無法保存 top localparam；請保留在組裝工作區。');
    const next={moduleName:top,parameters:params.map(p=>'parameter '+(p.type?p.type+' ':'')+p.name+' = '+p.value).join(', '),signals:{left:[],right:[]},groups:{left:[],right:[]},conditions:{left:[],right:[]},rtlOrder:[],layout:{...state.layout}};
    for(const p of ports){
      const which=p.direction==='output'?'right':'left';let groupId=null;
      if(p.group){let group=next.groups[which].find(g=>g.name===p.group);if(!group){group={id:uid(),name:p.group,color:COLORS[next.groups[which].length%COLORS.length],formatRuns:[]};next.groups[which].push(group);}groupId=group.id;}
      const sig={id:uid(),name:p.name,bits:p.range||'1',direction:p.direction,signed:!!p.signed,comment:p.comment||'',groupId,conditionId:null,formatRuns:[]};
      next.signals[which].push(sig);next.rtlOrder.push(sig.id);
    }
    this.setDiagram(next);
    toast('Top 名稱與 '+ports.length+' 個 ports 已同步；可用復原還原原圖。');
  }
};
// Attach the mature interface editor to the active workbook module.
{
 const legacyCommit=commitHistorySnapshot,legacyEnd=endHistory,legacyUndo=undo,legacyRedo=redo,legacyUpdate=updateHistoryUI;
 let loading=false,lastRejectedMessage='';
 const originalToast=toast;toast=function(message){if(lastRejectedMessage){const error=lastRejectedMessage;lastRejectedMessage='';window.WIUProjectHost?.reportRejected(error);return;}return originalToast(message);};
 WIUBridge.finish=()=>{if(canvasEdit&&!applyCanvasEditor()){canvasDrafts.set(canvasDraftKey(canvasEdit),{...canvasEdit,anchor:null,input:null,errorLabel:null,value:canvasEdit.input.value});canvasEdit.errorLabel?.remove();canvasEdit=null;portEditNotice('錯誤輸入已保留；修正或 Esc 取消後才能儲存。');}finishActiveEditHistory();};
 WIUBridge.prepareSave=function(){if(canvasEdit&&!applyCanvasEditor()){window.WIUSignalTable?.setMode('diagram');locateDeskSignal(canvasEdit.id);portEditNotice('尚未儲存：請先修正或取消目前紅色欄位；編輯內容仍保留。');const ref={...canvasEdit,input:null,anchor:null};window.WIUInteractionR128.paint('focus-draft',()=>openCanvasEditor(ref));return false;}const project=window.__WIU_ASSEMBLY__?.getProject(),draft=[...canvasDrafts.values()].find(d=>{const [pid,mid]=JSON.parse(d.scope);return pid===portClipboardScope().project&&(!project||mid==='top'||project.modules.some(m=>m.id===mid));});if(draft){const mid=JSON.parse(draft.scope)[1];if(mid!==portClipboardScope().module)window.WIUProjectHost?.openModuleByName(mid==='top'?project.top:project.modules.find(m=>m.id===mid)?.name);window.WIUSignalTable?.setMode('diagram');locateDeskSignal(draft.id);window.WIUInteractionR128.paint('focus-draft',()=>openCanvasEditor(draft));portEditNotice('尚未儲存：請先修正或 Esc 取消保留的錯誤輸入。');return false;}const edit=directNameEdits.get(document.activeElement);if(edit?.error){portEditNotice('尚未儲存：請先修正目前紅色名稱。');return false;}finishActiveEditHistory();return true;};
 WIUBridge.loadSheet=function(raw){closeCanvasEditor(false);closeFindPanel();resetDiagramInteraction();activeGroupId={left:null,right:null};activeConditionId={left:null,right:null};selectionAnchor.left=null;selectionAnchor.right=null;nameFormatTarget=null;previewView.fit=true;loading=true;try{state=normalizeProjectState(raw);history.undo.length=0;history.redo.length=0;history.tx=null;clearAllSelections();render();}finally{loading=false;}};
 WIUBridge.workspaceScale=()=>previewView.scale;
 WIUBridge.workspaceZoom=function(mode){
   const c=document.getElementById('canvas');if(!c)return;if(mode==='all'){fitPreview();return;}
   const r=c.getBoundingClientRect(),b=previewContentBounds;
   if(mode==='in'||mode==='out'){const old=previewView.scale||1,next=Math.max(.08,Math.min(8,old*(mode==='in'?1.2:1/1.2)));previewView={scale:next,x:r.width/2-(r.width/2-previewView.x)*next/old,y:r.height/2-(r.height/2-previewView.y)*next/old,fit:false};}
   else{let box=b;if(mode==='selection'){const rows=selectedRowsAll();if(!rows.length){portEditNotice('請先選取要定位的接腳。');return;}const nodes=rows.map(x=>document.querySelector('.signal-card[data-id="'+CSS.escape(x.sig.id)+'"]')).filter(Boolean);if(nodes.length){const rects=nodes.map(n=>n.getBoundingClientRect()),scale=previewView.scale||1;const left=Math.min(...rects.map(x=>x.left)),top=Math.min(...rects.map(x=>x.top)),right=Math.max(...rects.map(x=>x.right)),bottom=Math.max(...rects.map(x=>x.bottom));box={x:(left-r.left-previewView.x)/scale,y:(top-r.top-previewView.y)/scale,width:(right-left)/scale,height:(bottom-top)/scale};}}const zoom=mode==='selection'?Math.min(1.5,(r.width-80)/Math.max(1,box.width),(r.height-80)/Math.max(1,box.height)):1;previewView={scale:zoom,x:(r.width-box.width*zoom)/2-box.x*zoom,y:mode==='selection'?(r.height-box.height*zoom)/2-box.y*zoom:24-box.y,fit:false};}
   applyPreviewTransform();window.dispatchEvent(new CustomEvent('wiu-viewport-change'));
 };
 WIUBridge.exportSheetVbs=function(raw,project){
   const prior=state,priorLoading=loading,oldBounds={...presentationContentBounds},oldPreview={...previewContentBounds};
   loading=true;try{state=normalizeProjectState(raw);const encoded=encodeState(project);const out=makeVbs(encoded,12);verifyCarrierEncoded(extractEncodedStatesFromText(out),encoded,'VBS');return out;}
   finally{state=prior;loading=priorLoading;presentationContentBounds=oldBounds;previewContentBounds=oldPreview;}
 };
 WIUBridge.rtl=()=>rtlText()+"\nendmodule\n";
 WIUBridge.rename=name=>{withHistory(()=>state.moduleName=name);render();};
 WIUBridge.raw=()=>JSON.parse(JSON.stringify(state));
 WIUBridge.uiSnapshot=()=>({view:{...previewView},side,left:[...rowSelection.left],right:[...rowSelection.right],activeGroupId:{...activeGroupId},activeConditionId:{...activeConditionId},selectionAnchor:{...selectionAnchor},multiSelectMode});
 WIUBridge.restoreUi=ui=>{if(!ui)return;Object.assign(previewView,ui.view||{});side=ui.side==='right'?'right':'left';rowSelection.left=new Set(ui.left||[]);rowSelection.right=new Set(ui.right||[]);activeGroupId=ui.activeGroupId||{left:null,right:null};activeConditionId=ui.activeConditionId||{left:null,right:null};Object.assign(selectionAnchor,ui.selectionAnchor||{});multiSelectMode=!!ui.multiSelectMode;render();};
 WIUBridge.parseSheet=function(raw,config){const prior=state;loading=true;try{state=normalizeProjectState(raw);const parsed=this.getPorts();return parsed;}finally{state=prior;loading=false;}};
 commitHistorySnapshot=function(before){const host=window.WIUProjectHost;if(!loading&&host?.isDiagramActive()){if(before===snapshotState())return false;lastRejectedMessage='';const result=host.diagramChanged(JSON.parse(JSON.stringify(state)),WIUBridge.getPorts());if(result?.status!=='accepted')lastRejectedMessage=result?.message||'修改尚未套用。';updateHistoryUI();return result?.status==='accepted';}return legacyCommit(before);};
 endHistory=function(){if(!loading&&window.WIUProjectHost?.isDiagramActive()){if(history.applying||history.tx===null)return;const before=history.tx;history.tx=null;commitHistorySnapshot(before);return;}return legacyEnd();};
 undo=function(){if(window.WIUProjectHost)return window.WIUProjectHost.undo();return legacyUndo();};
 redo=function(){if(window.WIUProjectHost)return window.WIUProjectHost.redo();return legacyRedo();};
 updateHistoryUI=function(){legacyUpdate();if(window.WIUProjectHost){for(const id of ['undoBtn','deskUndoBtn']){const b=document.getElementById(id);if(b)b.disabled=!window.WIUProjectHost.canUndo();}for(const id of ['redoBtn','deskRedoBtn']){const b=document.getElementById(id);if(b)b.disabled=!window.WIUProjectHost.canRedo();}}};
 const install=()=>{if(!window.WIUProjectHost)return;const blank=document.getElementById('blankBtn');if(blank){blank.textContent='新增模組';blank.onclick=()=>window.WIUProjectHost.newModule();}const imp=document.getElementById('importRtlBtn');if(imp)imp.onclick=()=>window.WIUProjectHost.importRtl();const load=document.getElementById('loadProjectBtn');if(load)load.onclick=()=>window.WIUProjectHost.open();for(const id of ['undoBtn','deskUndoBtn']){const b=document.getElementById(id);if(b)b.onclick=()=>undo();}for(const id of ['redoBtn','deskRedoBtn']){const b=document.getElementById(id);if(b)b.onclick=()=>redo();}};
 window.addEventListener('load',install);WIUBridge.install=install;
}

/* Installed inside the original editor closure. Model, RTL and workbook history
 * remain the owners; this replaces the old narrow form-list presentation. */
{
 const model=window.WIUSignalTableModel, panel=$('#signalsPanel'),body=$('#signalTableRows');
 const prefsKey='wiu-signal-table-r120';let prefs={};try{prefs=JSON.parse(localStorage.getItem(prefsKey)||'{}');}catch{}
 const grid={mode:['diagram','table','split'].includes(prefs.mode)?prefs.mode:'split',widths:prefs.widths||{},columns:prefs.columns||{split:{group:false,comment:false,condition:false},table:{group:true,comment:false,condition:false}},drafts:new Map(),signature:'',editing:null,drag:null};
 const persist=()=>{try{localStorage.setItem(prefsKey,JSON.stringify({mode:grid.mode,widths:grid.widths,columns:grid.columns}));}catch{}};
 const scope=()=>{const s=portClipboardScope();return s.project+'::'+state.moduleName;};
 const key=(id,field)=>scope()+'::'+id+'::'+field;
 const basic=['name','bits','direction','side'];
 const transient=new Set();const baseVisible=visibleDeskRefs;visibleDeskRefs=()=>{const ids=new Set(baseVisible().map(v=>v.sig.id));return deskRefs().filter(r=>transient.has(scope()+'::'+r.sig.id)||ids.has(r.sig.id));};
 const labels={name:'訊號名稱',bits:'位寬',direction:'方向',side:'圖面側',group:'群組',comment:'註解',condition:'條件'};
 const cols=()=>basic.concat(['group','comment','condition'].filter(f=>grid.columns[grid.mode==='table'?'table':'split']?.[f]));
 const rowData=()=>deskRefs().map(({which,sig})=>({...sig,side:which,spacer:isSpacerSignal(sig),group:groupById(which,sig.groupId)?.name||'',condition:(()=>{const c=conditionById(which,sig.conditionId);return c?c.kind+' '+c.macro:'';})()}));
 const safeFocus=el=>{el?.focus({preventScroll:true});if(el?.select)el.select();};
 function widthError(value){const v=String(value).trim(),range=lengthToRange(v);if(!isScalarBits(v)&&!range)return '位寬請填正整數或 [DATA_W-1:0]。';const info=window.WIUProjectHost?.widthInfo?.(range||'');return info?.error||'';}
 function fieldError(id,f,value){const ref=deskSig(id);if(!ref)return '此列已不存在。';if(f==='name'){const error=model.validateName(value);if(error)return error;const result=canvasConflictState({kind:'name',which:ref.which,id},value);return result.error||'';}if(f==='bits')return widthError(value);if(f==='condition'){try{model.condition(value);}catch(e){return e.message;}}return '';}
 function feedback(el,error){if(!el?.parentElement)return;el.setAttribute('aria-invalid',String(!!error));let note=el.parentElement.querySelector('.r120-field-error');if(!note){note=document.createElement('small');note.className='r120-field-error';note.setAttribute('role','status');el.parentElement.append(note);}note.textContent=error||'';note.hidden=!error;}
 function currentValue(ref,f){if(f==='group')return groupById(ref.which,ref.sig.groupId)?.name||'';if(f==='condition'){const c=conditionById(ref.which,ref.sig.conditionId);return c?c.kind+' '+c.macro:'';}return String(ref.sig[f]??'');}
 function writeValue(ref,f,value){
  if(f==='group'){ref.sig.groupId=value.trim()?ensureGroupOnSide(ref.which,{name:value.trim()},new Map()):null;return;}
  if(f==='condition'){const c=model.condition(value);ref.sig.conditionId=c?ensureConditionOnSide(ref.which,c,new Map()):null;return;}
  if(f==='name'){ref.sig.name=String(value).trim();ref.sig.formatRuns=[];}else ref.sig[f]=f==='bits'?cleanBitsText(value):cleanCommentLive(value);
 }
 function commitField(el){
  if(!el?.matches?.('[data-grid-field]'))return true;const f=el.dataset.gridField,id=el.dataset.id,ref=deskSig(id);if(!ref)return true;
  const error=fieldError(id,f,el.value);feedback(el,error);
  if(error){grid.drafts.set(key(id,f),{value:el.value,error,id,field:f,scope:scope(),module:state.moduleName});return false;}
  grid.drafts.delete(key(id,f));const value=f==='comment'?el.value:el.value.trim();if(currentValue(ref,f)===value){el.defaultValue=el.value;return true;}
  if(!portEditAllowed())return false;finishActiveEditHistory();previewView.fit=false;
  withHistory(()=>writeValue(ref,f,value));grid.signature='';render();el.defaultValue=el.value;return true;
 }
 function inputHtml(ref,f){const id=ref.sig.id,draft=grid.drafts.get(key(id,f)),value=draft?.value??currentValue(ref,f),error=draft?.error||'';
  const parents=f==='group'?groupAncestors(ref.which,ref.sig.groupId).filter(g=>g.id!==ref.sig.groupId).map(g=>g.name).reverse().join(' / '):'';
  return (parents?'<small class="r121-group-path">'+esc(parents)+' /</small>':'')+'<input data-grid-field="'+f+'" data-id="'+id+'" data-grid-cell="'+f+'" value="'+esc(value)+'" aria-label="'+esc((ref.sig.name||'新訊號')+' '+labels[f])+'" aria-invalid="'+!!error+'" spellcheck="false"'+(f==='group'?' list="r120-groups-'+ref.which+'"':'')+' placeholder="'+(f==='group'?'—':f==='condition'?'—':f==='comment'?'':f==='bits'?'1 / 8 / [W-1:0]':'訊號名稱')+'"><small class="r120-field-error" role="status" '+(!error?'hidden':'')+'>'+esc(error)+'</small>';
 }
 function dirHtml(ref){const s=ref.sig;return '<button type="button" class="r120-direction" data-grid-cell="direction" data-grid-dir="'+s.id+'" aria-expanded="false" aria-label="'+esc(s.name)+' 方向">'+({input:'IN',output:'OUT',inout:'I/O'}[s.direction])+'</button><div class="r120-direction-choices" role="group" aria-label="選擇方向" hidden>'+[['input','IN'],['output','OUT'],['inout','I/O']].map(([v,t])=>'<button type="button" data-grid-set-dir="'+s.id+'" data-value="'+v+'" aria-label="設定 '+esc(s.name)+' 為 '+t+'" aria-pressed="'+(s.direction===v)+'">'+t+'</button>').join('')+'</div>';}
 function rowHtml(ref){const s=ref.sig,id=s.id,gap=isSpacerSignal(s),fs=cols(),isFirst=state.signals[ref.which][0]?.id===id;
  const select='<td class="r120-select"><input type="checkbox" data-desk-select="'+id+'" aria-label="選取 '+esc(s.name||'間隔')+'"></td>';
  const grip='<td class="r120-grip-cell"><button type="button" data-grid-grip="'+id+'" aria-label="移動 '+esc(s.name||'間隔')+'" title="拖曳排序；Alt＋上下鍵移動所選列">⠿</button></td>';
  const actions='<td class="r120-row-actions"><button type="button" data-grid-delete="'+id+'" aria-label="刪除 '+esc(s.name||'間隔')+'" title="刪除此列；可復原">×</button></td>';
  if(gap)return '<tr data-desk-id="'+id+'" data-side="'+ref.which+'" class="r120-gap-row">'+select+grip+'<td colspan="'+fs.length+'"><span class="r120-gap-line"></span><span>空白間隔 · '+(ref.which==='left'?'左側':'右側')+'</span><button type="button" data-grid-convert="'+id+'" title="轉成訊號，可復原">轉成訊號</button></td>'+actions+'</tr>';
  return '<tr data-desk-id="'+id+'" data-side="'+ref.which+'" class="'+(isFirst?'r120-side-start ':'')+(signalIsCommented(ref.which,s)?'disabled-port':'')+'">'+select+grip+fs.map(f=>'<td class="r120-col-'+f+'">'+(f==='direction'?dirHtml(ref):f==='side'?'<button type="button" data-grid-side="'+id+'" data-grid-cell="side" aria-label="'+esc(s.name)+' 位置" title="切換左／右側；保留訊號方向">'+(ref.which==='left'?'左':'右')+'</button>':inputHtml(ref,f))+'</td>').join('')+actions+'</tr>';
 }
 const table=panel.querySelector('table'),visibleToggle=$('#selectVisibleSignals');
 table.classList.add('r120-signal-table');const colgroup=document.createElement('colgroup');table.prepend(colgroup);
 const columnsMenu=document.createElement('details');columnsMenu.className='r69-menu r120-column-menu';columnsMenu.innerHTML='<summary>欄位</summary><div></div>';panel.querySelector('.desk-search').append(columnsMenu);
 const datalists=document.createElement('div');datalists.hidden=true;panel.append(datalists);
 const tail=document.createElement('button');tail.type='button';tail.className='r120-add-row';tail.textContent='＋ 新增訊號列';tail.onclick=()=>addSignal(true);panel.querySelector('.signal-scroll').append(tail);
 function setWidths(){const which=grid.mode==='table'?'table':'split',stored=grid.widths[which]||{},defaults=which==='table'?{name:250,bits:110,direction:80,side:62,group:155,comment:260,condition:150}:{name:176,bits:92,direction:65,side:48,group:125,comment:180,condition:140};let width=74;
  for(const el of colgroup.querySelectorAll('[data-grid-col]')){const field=el.dataset.gridCol,w=stored[field]||defaults[field];el.style.width=w+'px';width+=w;}table.style.minWidth=width+'px';
 }
 function renderHeader(){const fs=cols();table.querySelector('thead').innerHTML='<tr><th class="r120-select"></th><th class="r120-grip-cell"></th>'+fs.map(f=>'<th scope="col">'+labels[f]+'<span data-grid-resize="'+f+'" role="separator" aria-orientation="vertical" aria-label="調整'+labels[f]+'欄寬" tabindex="0"></span></th>').join('')+'<th class="r120-row-actions"></th></tr>';table.querySelector('th').append(visibleToggle);
  colgroup.innerHTML='<col style="width:26px"><col style="width:22px">'+fs.map(f=>'<col data-grid-col="'+f+'">').join('')+'<col style="width:26px">';setWidths();
  const kind=grid.mode==='table'?'table':'split';columnsMenu.querySelector('div').innerHTML=['group','comment','condition'].map(f=>'<label><input type="checkbox" data-grid-column="'+f+'" '+(grid.columns[kind]?.[f]?'checked':'')+'> '+labels[f]+'</label>').join('')+'<button type="button" data-grid-reset-width>重設欄寬</button>';
 }
 renderDesk=function(){return window.WIUInteractionR128.paint('signal-table',renderDeskNow);};
 function renderDeskNow(){if(!deskReady)return;for(const [k,v] of grid.drafts)if(v.scope===scope()&&!deskSig(v.id))grid.drafts.delete(k);const refs=visibleDeskRefs(),sig=JSON.stringify([scope(),refs.map(x=>[x.which,x.sig,groupById(x.which,x.sig.groupId)?.name,conditionById(x.which,x.sig.conditionId)?.macro]),cols(),grid.mode]);
  if(sig!==grid.signature&&!body.querySelector('[data-grid-field]:focus')){grid.signature=sig;renderHeader();body.innerHTML=refs.map(rowHtml).join('');datalists.innerHTML=['left','right'].map(w=>'<datalist id="r120-groups-'+w+'">'+state.groups[w].map(g=>'<option value="'+esc(g.name)+'"></option>').join('')+'</datalist>').join('');}
  renderDraftNotice();const count=refs.filter(x=>!isSpacerSignal(x.sig)).length,gaps=refs.length-count;$('#signalResultCount').textContent=count+' 個訊號'+(gaps?' · '+gaps+' 個間隔':'')+' / '+deskRefs().filter(x=>!isSpacerSignal(x.sig)).length+' 個訊號';
  $('#signalsEmpty').hidden=!!refs.length;$('#signalsEmpty').textContent=deskRefs().length?'沒有符合的訊號，請清除篩選。':'尚無訊號。按「新增訊號」或貼上表格開始。';
  const temp=refs.filter(x=>transient.has(scope()+'::'+x.sig.id)&&!baseVisible().some(v=>v.sig.id===x.sig.id)).length;$('#signalResultCount').textContent+=(temp?' · 暫顯 '+temp+' 個新增項目（篩選保留）':'');$('#clearFilters').hidden=!($('#signalSearch').value||$('#signalSideFilter').value!=='all'||$('#signalDirFilter').value!=='all');
  syncDeskSelection();updateDeskStatus();for(const issue of deskIssueList){const tr=body.querySelector('[data-desk-id="'+CSS.escape(issue.id||'')+'"]');if(tr){tr.classList.add('r120-invalid-row');tr.title=issue.message;const field=tr.querySelector('[data-grid-field="'+(/位寬/.test(issue.message)?'bits':'name')+'"]');if(field&&!grid.drafts.has(key(issue.id,field.dataset.gridField)))feedback(field,issue.message);}}
 };
 const priorSync=syncDeskSelection;
 syncDeskSelection=function(){priorSync();if(!deskReady)return;const hits=selectedRowsAll(),onlyGaps=hits.length>0&&hits.every(x=>isSpacerSignal(x.sig));$('#inspectorPanel').classList.toggle('r120-gap-selection',onlyGaps);$('#inspectorPanel').classList.toggle('r120-grid-properties',grid.mode!=='diagram');$('#inspectorPanel').classList.toggle('r121-multi',hits.length>1);for(const f of ['group','condition'])$('#inspectorPanel').classList.toggle('r120-grid-'+f+'-visible',grid.mode!=='diagram'&&hits.length===1&&cols().includes(f));
  $('#addGroupInline').disabled=!hits.some(x=>!isSpacerSignal(x.sig))||new Set(hits.map(x=>x.which)).size>1;
  for(const b of document.querySelectorAll('[data-r120-selected-action]'))b.disabled=!hits.length;
  const label=$('[data-r120-selection]');if(label)label.textContent=hits.length?'已選 '+hits.length+' 列':'選取列可批次編輯';
 };
 for(const id of ['signalSearch','signalSideFilter','signalDirFilter'])$('#'+id).addEventListener('input',()=>{transient.clear();renderDesk();});
 const gapHint=document.createElement('p');gapHint.className='r120-gap-hint';gapHint.textContent='空白間隔只調整圖面留白，不產生 RTL 接腳。可拖曳、移動或刪除。';$('#inspectorPanel .inspector-scroll').prepend(gapHint);
 const priorTextTarget=workspaceTextTarget;workspaceTextTarget=el=>!!el?.matches?.('[data-grid-field]')||priorTextTarget(el);
 panel.addEventListener('focusin',e=>{const el=e.target;if(!el.matches('[data-grid-field]'))return;grid.editing=el;const id=el.dataset.id,ref=deskSig(id);if(ref&&!rowSelection[ref.which].has(id))setDeskSelection(id);});
 panel.addEventListener('input',e=>{const el=e.target;if(!el.matches('[data-grid-field]')||e.isComposing)return;const f=el.dataset.gridField,error=fieldError(el.dataset.id,f,el.value);grid.drafts.set(key(el.dataset.id,f),{value:el.value,error,id:el.dataset.id,field:f,scope:scope(),module:state.moduleName});feedback(el,error);renderDraftNotice();});
 panel.addEventListener('focusout',e=>{if(!e.target.matches('[data-grid-field]'))return;if(grid.editing===e.target)grid.editing=null;commitField(e.target);requestAnimationFrame(()=>renderDesk());});
 function focusCell(id,field){const el=body.querySelector('[data-desk-id="'+CSS.escape(id)+'"] [data-grid-cell="'+field+'"]');safeFocus(el);el?.scrollIntoView({block:'nearest',inline:'nearest'});}
 panel.addEventListener('keydown',e=>{
  const el=e.target;if(e.isComposing)return;if(e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();addSignal();return;}if(el.matches('[data-grid-resize]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const kind=grid.mode==='table'?'table':'split',f=el.dataset.gridResize,col=colgroup.querySelector('[data-grid-col="'+f+'"]');grid.widths[kind]||={};grid.widths[kind][f]=Math.max(f==='name'?120:48,parseFloat(col.style.width)+(e.key==='ArrowRight'?10:-10));setWidths();persist();return;}
  const cell=el.closest('[data-grid-cell]'),tr=el.closest('[data-desk-id]');if(e.altKey&&tr&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();if(!rowSelection[tr.dataset.side].has(tr.dataset.deskId))setDeskSelection(tr.dataset.deskId);reorderDeskSelection(e.key==='ArrowUp'?-1:1);return;}
  if(el.matches('[data-grid-field]')&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();grid.drafts.delete(key(el.dataset.id,el.dataset.gridField));const ref=deskSig(el.dataset.id);el.value=currentValue(ref,el.dataset.gridField);feedback(el,'');el.blur();renderDraftNotice();return;}
  if(!cell||!tr||!['Enter','Tab'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;
  if(el.matches('[data-grid-field]')&&!commitField(el)){e.preventDefault();e.stopImmediatePropagation();return;}
  e.preventDefault();e.stopImmediatePropagation();const rows=visibleDeskRefs().filter(x=>!isSpacerSignal(x.sig)),fs=cols();let r=rows.findIndex(x=>x.sig.id===tr.dataset.deskId),c=fs.indexOf(cell.dataset.gridCell),delta=e.shiftKey?-1:1;
  if(e.key==='Tab'){c+=delta;if(c>=fs.length){c=0;r++;}if(c<0){c=fs.length-1;r--;}}else r+=delta;
  el.blur();grid.signature='';renderDesk();if(rows[r])focusCell(rows[r].sig.id,fs[c]);else{focusCell(tr.dataset.deskId,cell.dataset.gridCell);portEditNotice('已到表格邊界；按 Alt＋N 新增訊號。');}
 },true);
 function closeDirections(){for(const el of body.querySelectorAll('.r120-direction-choices:not([hidden])'))el.hidden=true;for(const b of body.querySelectorAll('[data-grid-dir]'))b.setAttribute('aria-expanded','false');}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.r120-col-direction'))closeDirections();});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.gridConvert){if(!portEditAllowed())return;const ref=deskSig(b.dataset.gridConvert);finishActiveEditHistory();withHistory(()=>{ref.sig.name=allocatePortNames(['signal_name'],portNamesInUse())[0];ref.sig.formatRuns=[];});grid.signature='';render();focusCell(ref.sig.id,'name');return;}
  if(b.dataset.gridDir){const picker=b.nextElementSibling,open=picker.hidden;closeDirections();picker.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)picker.querySelector('[aria-pressed=true]')?.focus();return;}
  if(b.dataset.gridSetDir){if(!portEditAllowed())return;const ref=deskSig(b.dataset.gridSetDir);finishActiveEditHistory();withHistory(()=>{ref.sig.direction=b.dataset.value;});grid.signature='';render();return;}
  if(b.dataset.gridSide){setDeskSelection(b.dataset.gridSide);moveDeskSelection(deskSig(b.dataset.gridSide).which==='left'?'right':'left');grid.signature='';renderDesk();return;}
  if(b.dataset.gridDelete){const ref=deskSig(b.dataset.gridDelete);if(ref){clearAllSelections();for(const id of model.deleteIds(ref.sig.id,[]))rowSelection[ref.which].add(id);}if(portEditAllowed())deleteSelectedRows();grid.signature='';renderDesk();return;}
  if(b.hasAttribute('data-grid-reset-width')){grid.widths[grid.mode==='table'?'table':'split']={};setWidths();persist();}
 });
 columnsMenu.addEventListener('change',e=>{if(!e.target.dataset.gridColumn)return;const kind=grid.mode==='table'?'table':'split';grid.columns[kind]||={};grid.columns[kind][e.target.dataset.gridColumn]=e.target.checked;grid.signature='';renderDesk();persist();});
 let dragFrame=0,dragY=0,dragX=0;function edgeScroll(){if(!grid.drag){dragFrame=0;return;}const sc=panel.querySelector('.signal-scroll'),r=sc.getBoundingClientRect(),v=dragY<r.top+36?-14:dragY>r.bottom-36?14:0;if(v){sc.scrollTop+=v;updateDropTarget();}dragFrame=requestAnimationFrame(edgeScroll);}
 function moveBoundary(end){const ids=selectedRowsAll().map(x=>x.sig.id);if(!ids.length)return;commitRows(model.boundary(rowData(),ids,end),'已移動所選列；保留各列圖面側，可復原。');}
 let resize=null;table.addEventListener('pointerdown',e=>{const grip=e.target.closest('[data-grid-resize]');if(!grip)return;e.preventDefault();const col=colgroup.querySelector('[data-grid-col="'+grip.dataset.gridResize+'"]');resize={field:grip.dataset.gridResize,x:e.clientX,width:parseFloat(col.style.width),kind:grid.mode==='table'?'table':'split'};grip.setPointerCapture(e.pointerId);});
 table.addEventListener('pointermove',e=>{if(!resize)return;grid.widths[resize.kind]||={};grid.widths[resize.kind][resize.field]=Math.max(resize.field==='name'?120:48,Math.min(700,resize.width+e.clientX-resize.x));setWidths();});
 const endResize=()=>{if(resize){resize=null;persist();}};table.addEventListener('pointerup',endResize);table.addEventListener('pointercancel',endResize);
 function commitRows(rows,notice){if(!portEditAllowed())return false;finishActiveEditHistory();const beforeCommit=snapshotState();previewView.fit=false;const prior=new Map(deskRefs().map(x=>[x.sig.id,x])),groups=new Map(),conditions=new Map();
  withHistory(()=>{const next={left:[],right:[]};for(const row of rows){const old=prior.get(row.id),sameGroup=old&&groupById(old.which,old.sig.groupId)?.name===row.group,sameCondition=old&&currentValue(old,'condition')===row.condition;
    const item=old?{...old.sig}:signal(row.name,row.bits,row.direction);item.name=row.name;item.bits=row.bits;item.direction=row.direction;item.comment=row.comment||'';
    if(old&&old.sig.name!==item.name)item.formatRuns=[];
    item.groupId=row.group?ensureGroupOnSide(row.side,sameGroup?groupDescriptor(old.which,old.sig):{name:row.group},groups,null,!!sameGroup):null;
    const cond=sameCondition?conditionDescriptor(old.which,old.sig):model.condition(row.condition);item.conditionId=cond?ensureConditionOnSide(row.side,cond,conditions):null;
    row.id=item.id;next[row.side].push(item);}state.signals=next;});
  grid.signature='';render();const changed=snapshotState()!==beforeCommit;if(notice&&changed&&!window.WIUAssemblyDialogOpen)portEditNotice(notice);return changed?true:window.WIUAssemblyDialogOpen?'pending':false;
 }
 body.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-grid-grip]');if(!b)return;e.preventDefault();const ref=deskSig(b.dataset.gridGrip);if(!rowSelection[ref.which].has(ref.sig.id))setDeskSelection(ref.sig.id);grid.drag={id:ref.sig.id,ids:selectedRowsAll().map(x=>x.sig.id),startY:e.clientY,moved:false,target:null,after:false};b.setPointerCapture(e.pointerId);});
 function updateDropTarget(){const drag=grid.drag;if(!drag?.moved)return;for(const tr of body.querySelectorAll('.r120-drop-before,.r120-drop-after'))tr.classList.remove('r120-drop-before','r120-drop-after');const tr=document.elementFromPoint(dragX,dragY)?.closest('#signalTableRows [data-desk-id]');if(tr&&!drag.ids.includes(tr.dataset.deskId)){const r=tr.getBoundingClientRect();drag.target=tr.dataset.deskId;drag.after=dragY>r.top+r.height/2;tr.classList.add(drag.after?'r120-drop-after':'r120-drop-before');}}
 body.addEventListener('pointermove',e=>{const drag=grid.drag;if(!drag)return;dragY=e.clientY;dragX=e.clientX;if(!dragFrame)dragFrame=requestAnimationFrame(edgeScroll);if(Math.abs(e.clientY-drag.startY)>4)drag.moved=true;if(!drag.moved)return;updateDropTarget();});
 function finishRowDrag(cancel=false){const drag=grid.drag;if(!drag)return;grid.drag=null;cancelAnimationFrame(dragFrame);dragFrame=0;for(const tr of body.querySelectorAll('.r120-drop-before,.r120-drop-after'))tr.classList.remove('r120-drop-before','r120-drop-after');if(cancel||!drag.moved||!drag.target)return;commitRows(model.reorder(rowData(),drag.ids,drag.target,drag.after),'已移動 '+drag.ids.length+' 列；方向與條件保留，可復原。');clearAllSelections();for(const id of drag.ids){const r=deskSig(id);if(r)rowSelection[r.which].add(id);}refreshPortSelection();}
 body.addEventListener('pointerup',()=>finishRowDrag());body.addEventListener('pointercancel',()=>finishRowDrag(true));
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&grid.drag){e.preventDefault();finishRowDrag(true);}},true);
 function addSignal(tail=false,forcedSide=null){if(!portEditAllowed())return;finishActiveEditHistory();const chosen=selectedRowsAll().find(x=>!isSpacerSignal(x.sig)),defaults=model.defaults(chosen?{side:chosen.which,direction:chosen.sig.direction}:null,$('#signalSideFilter').value==='all'?side:$('#signalSideFilter').value),which=forcedSide||defaults.side;if(forcedSide)defaults.direction=forcedSide==='left'?'input':'output';let made;
  withHistory(()=>{made=signal(allocatePortNames(['signal_name'],portNamesInUse())[0],'1',defaults.direction);state.signals[which].splice(tail?state.signals[which].length:insertAfterSelected(which),0,made);});
  if(!deskSig(made.id))return;transient.add(scope()+'::'+made.id);clearAllSelections();rowSelection[which].add(made.id);side=which;grid.signature='';render();requestAnimationFrame(()=>{if(grid.mode==='diagram')focusAndSelectSignalName(which,made.id);else focusCell(made.id,'name');});
 }
 function addGap(){if(!portEditAllowed())return;finishActiveEditHistory();const which=side;let made;withHistory(()=>{made=signal('','1','input');state.signals[which].splice(insertAfterSelected(which),0,made);});if(!deskSig(made.id))return;transient.add(scope()+'::'+made.id);clearAllSelections();rowSelection[which].add(made.id);grid.signature='';render();body.querySelector('[data-desk-id="'+CSS.escape(made.id)+'"]')?.scrollIntoView({block:'nearest'});}

 const draftNotice=document.createElement('div');draftNotice.className='r121-draft-notice';draftNotice.hidden=true;draftNotice.setAttribute('role','status');document.body.append(draftNotice);
 function pendingDrafts(){const p=window.__WIU_ASSEMBLY__?.getProject();return [...grid.drafts.values()].filter(x=>x.error&&x.scope.startsWith(portClipboardScope().project+'::')&&(!p||x.module===p.top||p.modules.some(m=>m.name===x.module)));}
 function locateDraft(p){if(!p)return;window.WIUProjectHost?.openModuleByName?.(p.module);setMode('table');$('#signalSearch').value='';$('#signalSideFilter').value='all';$('#signalDirFilter').value='all';grid.signature='';renderDesk();requestAnimationFrame(()=>focusCell(p.id,p.field));}
 function renderDraftNotice(){const pending=pendingDrafts();draftNotice.hidden=!pending.length;const p=pending[0];const html=p?'<span>'+pending.length+' 個未套用欄位 · '+esc(p.module)+' · '+labels[p.field]+'：'+esc(p.error)+'</span><button type="button" data-locate-draft>前往修正</button>':'';if(draftNotice.innerHTML!==html)draftNotice.innerHTML=html;document.body.classList.toggle('r121-has-drafts',!!pending.length);}
 draftNotice.addEventListener('click',e=>{if(e.target.closest('[data-locate-draft]'))locateDraft(pendingDrafts()[0]);});
 function setMode(mode){if(!['diagram','table','split'].includes(mode))return;commitField(grid.editing);const scroll=panel.querySelector('.signal-scroll'),saved={top:scroll.scrollTop,left:scroll.scrollLeft};grid.mode=mode;document.body.dataset.signalView=mode;document.body.classList.toggle('r110-table-wide',mode==='table');$('#workbench').classList.toggle('signals-open',mode!=='diagram');$('#toggleSignalTable').setAttribute('aria-pressed',String(mode!=='diagram'));grid.signature='';renderDesk();scroll.scrollTop=saved.top;scroll.scrollLeft=saved.left;for(const b of document.querySelectorAll('button[data-signal-view]'))b.setAttribute('aria-pressed',String(b.dataset.signalView===mode));syncDeskSelection();persist();window.dispatchEvent(new Event('resize'));}
 const priorToggle=toggleDeskPanel;toggleDeskPanel=function(which,force){if(which==='signals'){setMode((force===false||force===undefined&&grid.mode!=='diagram')?'diagram':'split');return;}priorToggle(which,force);if(grid.mode!=='diagram')$('#workbench').classList.add('signals-open');};
 let oldBounds=null;const resizeObserver=new ResizeObserver(()=>{const canvas=$('#canvas'),r=canvas.getBoundingClientRect();if(r.width<50||r.height<50)return;if(!oldBounds){oldBounds=r;return;}if(r.width===oldBounds.width&&r.height===oldBounds.height)return;oldBounds=r;requestAnimationFrame(()=>{if(previewView.fit){fitPreview();return;}const ids=selectedRowsAll().map(x=>x.sig.id),nodes=ids.map(id=>canvas.querySelector('.signal-card[data-id="'+CSS.escape(id)+'"]')).filter(Boolean);if(!nodes.length)return;const rects=nodes.map(n=>n.getBoundingClientRect()),left=Math.min(...rects.map(x=>x.left)),right=Math.max(...rects.map(x=>x.right)),top=Math.min(...rects.map(x=>x.top)),bottom=Math.max(...rects.map(x=>x.bottom));const dx=right>r.right-24?r.right-24-right:left<r.left+24?r.left+24-left:0,dy=bottom>r.bottom-24?r.bottom-24-bottom:top<r.top+24?r.top+24-top:0;previewView.x+=dx;previewView.y+=dy;applyPreviewTransform();});});resizeObserver.observe($('#canvas'));
 const oldSnapshot=WIUBridge.uiSnapshot,oldRestore=WIUBridge.restoreUi,oldPrepare=WIUBridge.prepareSave,oldFinish=WIUBridge.finish;
 WIUBridge.uiSnapshot=()=>({...oldSnapshot(),signalTable:{mode:grid.mode,search:$('#signalSearch').value,side:$('#signalSideFilter').value,direction:$('#signalDirFilter').value,scroll:panel.querySelector('.signal-scroll').scrollTop}});
 WIUBridge.restoreUi=ui=>{oldRestore(ui);if(ui?.signalTable){const t=ui.signalTable;$('#signalSearch').value=t.search||'';$('#signalSideFilter').value=t.side||'all';$('#signalDirFilter').value=t.direction||'all';setMode(t.mode||grid.mode);panel.querySelector('.signal-scroll').scrollTop=t.scroll||0;}};
 WIUBridge.prepareSave=()=>{if(!commitField(grid.editing))return false;const project=window.__WIU_ASSEMBLY__?.getProject(),pending=[...grid.drafts.values()].find(x=>x.error&&x.scope.startsWith(portClipboardScope().project+'::')&&(!project||x.module===project.top||project.modules.some(m=>m.name===x.module)));if(pending){portEditNotice(pending.module+' 尚有未套用的欄位：'+pending.error);locateDraft(pending);renderDraftNotice();return false;}return oldPrepare();};
 WIUBridge.finish=()=>{commitField(grid.editing);oldFinish();};
 const groupDialog=document.createElement('dialog');groupDialog.className='a-dialog r120-group-dialog';groupDialog.setAttribute('aria-label','建立群組');document.body.append(groupDialog);
 $('#addGroupInline').onclick=()=>{if(!portEditAllowed())return;commitField(grid.editing);const hits=selectedRowsAll().filter(x=>!isSpacerSignal(x.sig));if(!hits.length)return;const which=hits[0].which;if(hits.some(x=>x.which!==which)){portEditNotice('請先選取同一側的訊號。');return;}const hasGroup=hits.some(x=>x.sig.groupId);
  groupDialog.innerHTML='<div class="a-dialog-head"><h2>建立群組</h2><button type="button" data-group-close aria-label="關閉建立群組">×</button></div><div class="a-dialog-content"><p>套用至 '+hits.length+' 個'+(which==='left'?'左側':'右側')+'訊號。</p><label>群組名稱<input id="r120-group-name" value="Interface '+(state.groups[which].length+1)+'" spellcheck="false"></label>'+(hasGroup?'<label class="r120-parent-group"><input type="checkbox" id="r120-group-parent" checked> 建立外層群組，保留原本的內層群組</label>':'')+'<p>已有群組要調整成員，可直接在訊號表的群組欄輸入名稱。</p></div><div class="a-dialog-foot"><button type="button" data-group-close>取消</button><button type="button" data-group-apply class="a-primary">建立群組</button></div>';window.WIUAssemblyDialogOpen=true;groupDialog.showModal();safeFocus($('#r120-group-name'));
 };
 const applyGroup=()=>{const input=$('#r120-group-name'),name=input.value.trim();if(!name){input.setCustomValidity('請輸入群組名稱。');input.reportValidity();return;}const success=createSelectionGroup(!!$('#r120-group-parent')?.checked,name);if(success){groupDialog.close();const kind=grid.mode==='table'?'table':'split';grid.columns[kind]||={};grid.columns[kind].group=true;grid.signature='';renderDesk();persist();}};
 groupDialog.addEventListener('click',e=>{if(e.target.closest('[data-group-close]'))groupDialog.close();if(e.target.closest('[data-group-apply]'))applyGroup();});groupDialog.addEventListener('input',e=>e.target.setCustomValidity?.(''));groupDialog.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='r120-group-name'){e.preventDefault();applyGroup();}});groupDialog.addEventListener('close',()=>{window.WIUAssemblyDialogOpen=!!document.querySelector('dialog[open]')||!!window.WIUManualOpen;});
 const pasteDialog=document.createElement('dialog');pasteDialog.className='a-dialog r120-paste-dialog';pasteDialog.setAttribute('aria-label','貼上訊號表');document.body.append(pasteDialog);let pasteState=null;const pasteDrafts=new Map();let pasteApplied=false;
 function showPaste(text='',options={}){if(!commitField(grid.editing)){renderDraftNotice();return;}pasteApplied=false;if(!text&&!options.fresh){const saved=pasteDrafts.get(scope());if(saved){text=saved.text;options={...saved.options,...options};}}const selected=selectedRowsAll().find(x=>!isSpacerSignal(x.sig)),startId=options.startId||selected?.sig.id||null;pasteState={startId,startField:options.startField||'name',mode:options.mode||'append',before:null,plan:null,options,targetIds:options.targetIds||null,scope:scope()};
  pasteDialog.innerHTML='<div class="a-dialog-head"><h2>貼上訊號表</h2><button type="button" data-paste-close aria-label="關閉貼上訊號表">×</button></div><div class="a-dialog-content"><p>可貼 Excel 多列資料。欄位：名稱、位寬、方向、圖面側、群組、註解、條件；也接受有標題的欄位。</p><div class="r120-paste-modes"><label><input type="radio" name="r120-paste-mode" value="append" '+(pasteState.mode==='append'?'checked':'')+'> 新增列</label><label><input type="radio" name="r120-paste-mode" value="overwrite" '+(pasteState.mode==='overwrite'?'checked':'')+' '+(!startId?'disabled':'')+'> 從選取列覆寫</label></div><label>資料<textarea id="r120-paste-text" rows="7" spellcheck="false" placeholder="name&#9;width&#9;direction&#9;side&#9;group&#10;req&#9;8&#9;IN&#9;left&#9;Request">'+esc(text)+'</textarea></label><div id="r120-paste-preview" aria-live="polite"></div></div><div class="a-dialog-foot"><button type="button" data-paste-clear>清空草稿</button><button type="button" data-paste-close>關閉並保留草稿</button><button type="button" data-paste-preview>預覽</button><button type="button" data-paste-apply class="a-primary" disabled>套用</button></div>';
  window.WIUAssemblyDialogOpen=true;pasteDialog.showModal();$('#r120-paste-text').focus();if(text)previewPaste();
 }
 function previewPaste(paint=true){const ps=pasteState,mode=pasteDialog.querySelector('[name=r120-paste-mode]:checked').value,parsed=model.parse($('#r120-paste-text').value,{startField:mode==='append'?'name':ps.startField,columns:mode==='append'?model.fields:cols()});const refs=visibleDeskRefs().filter(x=>!isSpacerSignal(x.sig)),at=refs.findIndex(x=>x.sig.id===ps.startId);ps.parsed=parsed;ps.mode=mode;ps.before=snapshotState();ps.plan=model.plan(rowData(),parsed,{mode,startId:ps.startId,targetIds:ps.targetIds||refs.slice(Math.max(0,at)).map(x=>x.sig.id),defaultSide:side,validateWidth:widthError,validateSignalName:name=>{const n=String(name).trim();if(n.startsWith('//'))return '';return !window.WIUCore.validName(n)?'名稱不可使用 Verilog 保留字。':(portClipboardScope().reserved||[]).includes(n)?'此名稱已用於參數或其他物件。':'';}});
  if(!paint){const area=$('#r120-paste-preview');for(const b of area.querySelectorAll('[data-paste-error-row]'))b.remove();const summary=area.querySelector('p');if(summary)summary.textContent=ps.plan.changed.length+' 列 · '+(mode==='append'?'新增':'覆寫指定列')+' · '+(ps.plan.errors.length?ps.plan.errors.length+' 個問題':'檢查通過，尚未套用');const table=area.querySelector('.r120-paste-table');for(const e of ps.plan.errors){const b=document.createElement('button');b.type='button';b.className='r120-paste-error';b.dataset.pasteErrorRow=e.row;b.dataset.field=e.field;b.textContent=(e.row?'第 '+e.row+' 列 · ':'')+(labels[e.field]||'')+' '+e.message;table.before(b);}const original=new Map(rowData().map(r=>[r.id,r]));for(const input of area.querySelectorAll('[data-paste-row]')){const n=Number(input.dataset.pasteRow),f=input.dataset.field,old=original.get(ps.plan.changed[n]?.id);input.setAttribute('aria-invalid',String(ps.plan.errors.some(e=>e.row===n+1&&e.field===f)));let small=input.parentElement.querySelector('small');if(old&&String(old[f]??'')!==input.value){if(!small){small=document.createElement('small');input.after(small);}small.textContent='原：'+(old[f]||'—');}else small?.remove();}pasteDialog.querySelector('[data-paste-apply]').disabled=!!ps.plan.errors.length||!ps.plan.changed.length;let note=pasteDialog.querySelector('[data-inline-validation]');if(!note){note=document.createElement('p');note.dataset.inlineValidation='';note.setAttribute('role','status');$('#r120-paste-preview').prepend(note);}note.textContent=ps.plan.errors.length?ps.plan.errors.map(e=>'第 '+e.row+' 列 '+(labels[e.field]||'')+'：'+e.message).join('；'):'修改已重新檢查，可套用。';return;}
  const p=ps.plan,original=new Map(rowData().map(r=>[r.id,r]));
  $('#r120-paste-preview').innerHTML='<p>'+p.changed.length+' 列 · '+(mode==='append'?'新增':'覆寫指定列')+' · '+(p.errors.length?p.errors.length+' 個問題':'檢查通過，尚未套用')+'</p><p>覆寫依目前顯示順序；下方逐列列出原訊號。可直接編輯預覽格，修改後會重新檢查。</p>'+p.errors.map(e=>'<button type="button" class="r120-paste-error" data-paste-error-row="'+e.row+'" data-field="'+e.field+'">'+(e.row?'第 '+e.row+' 列 · ':'')+(labels[e.field]||'')+' '+esc(e.message)+'</button>').join('')+'<div class="r120-paste-table"><table><thead><tr><th>原訊號</th>'+model.fields.map(f=>'<th>'+labels[f]+'</th>').join('')+'</tr></thead><tbody>'+parsed.rows.map((patch,i)=>{const r=p.changed[i]||patch,old=original.get(r.id);return '<tr><td>'+(old?esc(old.name):'新增')+'</td>'+model.fields.map(f=>'<td><input aria-label="預覽第 '+(i+1)+' 列 '+labels[f]+'" data-paste-row="'+i+'" data-field="'+f+'" value="'+esc(r[f]??'')+'">'+(old&&String(old[f]??'')!==String(r[f]??'')?'<small>原：'+esc(old[f]||'—')+'</small>':'')+'</td>').join('')+'</tr>';}).join('')+'</tbody></table></div>';pasteDialog.querySelector('[data-paste-apply]').disabled=!!p.errors.length||!p.changed.length;

 }
 pasteDialog.addEventListener('input',()=>{pasteDialog.querySelector('[data-paste-apply]').disabled=true;});pasteDialog.addEventListener('change',e=>{if(!e.target.matches('[data-paste-row]'))pasteDialog.querySelector('[data-paste-apply]').disabled=true;});
 pasteDialog.addEventListener('click',e=>{const err=e.target.closest('[data-paste-error-row]');if(err){const i=Number(err.dataset.pasteErrorRow)-1;const field=pasteDialog.querySelector('[data-paste-row="'+i+'"][data-field="'+(err.dataset.field||'name')+'"]');safeFocus(field||$('#r120-paste-text'));field?.scrollIntoView({block:'nearest'});}if(e.target.closest('[data-paste-clear]')){pasteDrafts.delete(scope());$('#r120-paste-text').value='';$('#r120-paste-preview').innerHTML='';pasteDialog.querySelector('[data-paste-apply]').disabled=true;}if(e.target.closest('[data-paste-close]'))pasteDialog.close();if(e.target.closest('[data-paste-preview]'))previewPaste();if(e.target.closest('[data-paste-apply]')){const ps=pasteState;if(ps.before!==snapshotState()){portEditNotice('介面已變更，請重新預覽。');previewPaste();return;}const plan=ps.plan;if(!plan||plan.errors.length)return;let rows=plan.rows;if(ps.mode==='append'&&ps.startId){const added=new Set(plan.changed),rest=rows.filter(x=>!added.has(x)),at=rest.findIndex(x=>x.id===ps.startId);rest.splice(at+1,0,...plan.changed);rows=rest;}const savedText=$('#r120-paste-text').value,savedOptions={...ps.options,startId:ps.startId,startField:ps.startField,mode:ps.mode};pasteApplied=false;pasteDrafts.set(ps.scope,{text:savedText,options:savedOptions});pasteDialog.close();window.WIUAssemblyDialogOpen=!!document.querySelector('dialog[open]')||!!window.WIUManualOpen;const outcome=commitRows(rows,'已'+(ps.mode==='append'?'新增':'修改')+' '+plan.changed.length+' 列；整批可一次復原。');if(outcome===true){pasteApplied=true;pasteDrafts.delete(ps.scope);}else if(outcome===false){showPaste(savedText,savedOptions);portEditNotice(rows.some(r=>r.condition)?'尚未套用：共用介面不接受未解析的條件編譯 ports。請先移除條件，或於 RTL 匯入流程決定組態；草稿已保留。':'尚未套用：目前共用介面未接受這項修改，或資料沒有改變。草稿已保留，可修正後重試。');return;}clearAllSelections();for(const row of plan.changed){const r=deskSig(row.id);if(r)rowSelection[r.which].add(row.id);}refreshPortSelection();}});
 pasteDialog.addEventListener('close',()=>{if(!pasteApplied&&pasteState)pasteDrafts.set(pasteState.scope,{text:$('#r120-paste-text').value,options:{...pasteState.options,startId:pasteState.startId,startField:pasteState.startField,mode:pasteDialog.querySelector('[name=r120-paste-mode]:checked').value}});window.WIUAssemblyDialogOpen=!!document.querySelector('dialog[open]')||!!window.WIUManualOpen;});
 pasteDialog.addEventListener('input',e=>{if(!e.target.matches('[data-paste-row]'))return;const rows=pasteState.parsed.rows.map((p,i)=>({...pasteState.plan.changed[i],...p}));for(const el of pasteDialog.querySelectorAll('[data-paste-row]'))rows[Number(el.dataset.pasteRow)][el.dataset.field]=el.value;$('#r120-paste-text').value=model.fields.join('\t')+'\n'+rows.map(r=>model.fields.map(f=>String(r[f]??'').replace(/[\t\r\n]/g,' ')).join('\t')).join('\n');previewPaste(false);});
 window.addEventListener('paste',e=>{if(window.WIUAssemblyActive||window.WIUAssemblyDialogOpen||!e.target.matches?.('[data-grid-field]'))return;const text=e.clipboardData?.getData('text/plain')||'';if(!/[\t\r\n]/.test(text.trim()))return;e.preventDefault();e.stopImmediatePropagation();showPaste(text,{mode:'overwrite',startId:e.target.dataset.id,startField:e.target.dataset.gridField});},true);
 window.WIUSignalTable={setMode,mode:()=>grid.mode,add:addSignal,addSide:which=>addSignal(false,which),spacer:addGap,paste:showPaste,batch:()=>{const selected=selectedRowsAll().filter(x=>!isSpacerSignal(x.sig)),ids=selected.map(x=>x.sig.id),rows=rowData().filter(x=>ids.includes(x.id));if(!rows.length)return;showPaste(model.fields.join('\t')+'\n'+rows.map(r=>model.fields.map(f=>String(r[f]??'').replace(/[\t\r\n]/g,' ')).join('\t')).join('\n'),{fresh:true,mode:'overwrite',startId:rows[0].id,targetIds:rows.map(r=>r.id)});},moveBoundary,defaults:()=>{const r=selectedRowsAll().find(x=>!isSpacerSignal(x.sig));return model.defaults(r?{side:r.which,direction:r.sig.direction}:null,$('#signalSideFilter').value==='all'?side:$('#signalSideFilter').value);},pending:pendingDrafts,syncDrafts:renderDraftNotice,locateDraft:()=>locateDraft(pendingDrafts()[0]),refresh:()=>{grid.signature='';renderDesk();},select:id=>setDeskSelection(id),selection:()=>selectedRowsAll().map(x=>({id:x.sig.id,name:x.sig.name,side:x.which})),cancelDrafts:()=>{grid.drafts.clear();grid.signature='';renderDesk();}};
 $('#tableAddLeft').onclick=()=>{side='left';addSignal(false,'left');};$('#tableAddRight').onclick=()=>{side='right';addSignal(false,'right');};$('#tableGap').onclick=addGap;
 setMode(grid.mode);
}


window.__WSS_TEST__={getView:()=>({...previewView}),visibleDeskRefs,moveDeskSelection,duplicateDeskSelection,reorderDeskSelection,setDeskSelection,locateDeskSignal,parseVerilogModulesForImport,loadProjectFile,rtlImportApplySelected,copyPayloadFromSelection,makeVbs,getState:()=>state,makeProject,normalizeProjectState,isBusBits,undo,redo,selectAllRows,pasteRowItems,history,rowSelection,toggleNameFormat,styleSpec,styledNameSvg,styledNameHtml,encodeState,decodeState,makeEmbeddedStateChunks,decodeProjectCarrierText,projectCarrierAudit,verifyCarrierEncoded,verifyVbsCarrierDeterministic,currentCommentCount,pngBlobWithState,extractEncodedStatesFromPngBuffer,exportSvgText,pdfBytesWithJpeg,extractEncodedStatesFromText,applyToolbarFormat,enterPresentation,exitPresentation,fitPresentation,applySignalColor,applyGroupColor,buildRtlLines,rtlText,rtlConditionAudit,conditionById,conditionSegments,createConditionForSelected,assignSelectedCondition,updateConditionAssignToolbar,rtlModuleName,rtlPortText,rtlGroupComment,svIdentifier,reconcileRtlOrder,orderedRtlRefs,rtlGroupMemberIds,rtlRefGroupKey,commitRtlReorder,rtlGroupFoldedR101,lengthToRange,commentPreviewText,renderRtlDeclarations,assignSelectedGroup,assignSelectedDirection,updateGroupAssignToolbar,updateDirectionAssignToolbar,safeProjectName,groupGeometry,editorGroupGeometry,conditionGeometry,groupRailX,sideConditionLabelWidth,bestResizeHandleRatio,signalIsCommented,isCommentedLabel,cleanMacroLabel,cleanMacroLabelLive,conditionDirectiveText,activeRtlRefs,inlineCardWidthForSignal,inlineCardWidthForSide,screenDropSide,commitInlineMove,render,moveExcelSignalEditor,signalFieldElement};render();deskSavedState=JSON.stringify(state);renderDesk();
const multiTools=document.createElement('span');multiTools.className='r128-selection-tools';multiTools.innerHTML='<button type="button" id="r128-multi" aria-pressed="false">多選：關</button><button type="button" id="r128-clear">清除選取</button>';$('#toggleSignalTable')?.parentElement?.append(multiTools);
$('#r128-multi').onclick=()=>{multiSelectMode=!multiSelectMode;$('#r128-multi').setAttribute('aria-pressed',String(multiSelectMode));$('#r128-multi').textContent='多選：'+(multiSelectMode?'開':'關');portEditNotice(multiSelectMode?'點訊號可逐項加入／取消；平移和縮放保留選取。要輸入文字時先關閉多選。':'可直接點名稱編輯；Ctrl／Shift 仍可多選。');};$('#r128-clear').onclick=()=>{clearAllSelections();refreshPortSelection();};
const initialVbs=makeVbs();$("#vbsAudit").textContent=JSON.stringify({length:initialVbs.length,hasEmbedded:initialVbs.includes("EmbeddedStencilBase64")&&initialVbs.includes("ADODB.Stream"),uniqueTempStencil:initialVbs.includes("fso.GetTempName")&&!initialVbs.includes(`WSS-NIC-${TEMPLATE_HASH}.vss`),safeTempWrite:initialVbs.includes("Cannot write embedded stencil to Windows TEMP"),hiddenStencilOpen:initialVbs.includes("STENCIL_OPEN_FLAGS = 458")&&!initialVbs.includes("visOpenDocked"),usesCoreMasters:["block","signal name","multi bit"].every(x=>initialVbs.includes(x)),connectorMaster:initialVbs.includes("連接器2"),calibri:initialVbs.includes('FONT(""Calibri"")'),jhenghei:initialVbs.includes('FONT(""Microsoft JhengHei"")'),forbidden:/新細明體|PMingLiU/i.test(initialVbs),bitMasterRaised:initialVbs.includes("busX, y + 0.105"),freeTextBits:isBusBits("8b")&&isBusBits("[7:0]")&&!isBusBits("1b"),projectRoundTrip:normalizeProjectState(makeProject()).signals.left.length===state.signals.left.length,visioTextWidthParity:initialVbs.includes("TEXTWIDTH(TheText)+0.10 in")&&initialVbs.includes("leftNameShapes")&&initialVbs.includes("rightNameShapes"),cleanGroupBracket:initialVbs.includes("pg.DrawLine(x, y1, x, y2)"),portLabelsInsideBlock:true,historyReady:typeof undo==="function"&&typeof redo==="function",resizableBlock:typeof applyBlockResize==="function",spacerRows:isSpacerSignal({name:""})&&!isSpacerSignal({name:"A"}),newSignalEditable:true,gapReopenEditable:true,shiftNameRangeSelect:true,ctrlNameToggleSelect:true,multiDeleteSelected:true,multiClipboardAcrossSides:true,bitUndoReliable:true,bitModifierSelection:true,bitCtrlDelete:true,clipboardPreservesGroups:true,crossSideDragPreservesGroups:true,richNameFormatting:initialVbs.includes("ApplyTextRunsRecursive"),inoutReady:initialVbs.includes("isInout"),reloadableMetadata:typeof pngBlobWithState==="function"&&typeof pdfBytesWithJpeg==="function"&&typeof makeEmbeddedStateChunks==="function",reloadableVbs:initialVbs.includes("WRAPPINUP_STATE_CHUNK:"),vbsCarrierDeterministic:verifyVbsCarrierDeterministic(),carrierSelfVerify:typeof verifyCarrierEncoded==="function",presentationReady:typeof enterPresentation==="function",colorReady:initialVbs.includes("lineColorFormula")&&initialVbs.includes("textColorFormula"),railGeometryReady:initialVbs.includes("layout.leftSignalX")===false&&initialVbs.includes("AddInterfaceGroup"),commentReady:initialVbs.includes("AddSignalComment")&&initialVbs.includes('ApplyFonts n, "8 pt"'),rtlDeclarationReady:lengthToRange("8B")==="[63:0]"&&lengthToRange("1B")==="[7:0]"&&lengthToRange("B")==="[7:0]"&&lengthToRange("8b")==="[7:0]"&&lengthToRange("b")==="",inlineLengthOnWire:typeof inlineLengthHtml==="function",inlineBlockTitle:typeof inlineBlockTitleHtml==="function",multiRowDrag:true&&lengthToRange("[1:3]")==="[1:3]",crossSideDrag:true,innerNameLayout:true,nameInsideBlock:true,contentDrivenBlock:true,commentSpaces:true,shortDefaultWires:true,mirroredPortNameAlignment:true,vbsMirroredPortText:true,portNameEdgePadShared:true,portNameWireYAligned:true,waveASecondStencilFont8pt:true,unifiedPortTextSize:true,rtlDragOrder:true,rtlGroupDrag:true,arrowClickDirection:true,wireClickDirection:true,waveASecondDragHandle:true,waveASecondDropRule:true,waveASecondIconVocabulary:true,rtlLargeDropTargets:true,rtlPanelResizable:true,rtlPanelHeightPersisted:true,rtlUndoReliable:true,rtlCtrlCopy:true,verilogOnly:true,rtlSourceImport:true,multiModuleDetection:true,commentIgnoringParser:true,classicVerilogPortImport:true,conditionalPortImport:true,verilogAnsiPorts:true,compactImplicitNetPorts:true,noRegPorts:true,singleSourceRtlComments:true,noInternalWireRegEmission:true,noHandWrittenSynchronizerEmission:true,rtlVisibleByDefault:true,independentBlockRails:true,largeBlockResizeHitZones:true,editFirstTextFields:true,stableNameCommentTyping:true,seamlessEditorToEditorFocus:true,blankPanThreshold:true,spacePanAnywhere:true,noInvisibleEmptyCommentHitbox:true,edgeBandResize:true,resizeEdgeTracksBlockHeight:true,fullSignalNameDisplay:true,excelFirstClickSelectAll:true,excelEnterVertical:true,excelTabHorizontal:true,commentPrefixDisable:true,commentedGroupDirectives:true,liveCommentedVisuals:true,tableExcelNavigation:true,inlineGroupDelete:true,explicitIfndefButton:true,resizePriorityHitTest:true,resizeHandlesAvoidSignalRows:true,resizeOverlayUnobtrusive:true,alwaysReadyBlockHandles:true,editorWASDSafeContext:true,ctrlAAllSides:true,groupAssignReady:typeof assignSelectedGroup==="function",ifdefReady:typeof createConditionForSelected==="function"&&typeof rtlConditionAudit==="function",ifdefSeparateFromGroup:true,ifdefBetweenGroupAndWire:true,ifdefNoUnusedLane:true,ifdefClipboardReady:true,ifdefCrossSideReady:true,ifdefVisioReady:initialVbs.includes("AddInterfaceCondition"),directionAssignReady:typeof assignSelectedDirection==="function",deleteControlAwayFromArrow:true,stableBlockNameEditing:true,unifiedRichText:initialVbs.includes("ApplyTextRunsRecursive wrapper")&&initialVbs.includes("AddInterfaceGroup")&&typeof moduleFormatObject==="function",externalCommentLane:typeof commentLaneGeometry==="function",commentSlashAligned:true,commentLaneAutoWidth:true,vbsCommentTextWidth:true&&initialVbs.includes("AddSignalComment")});
// Shared read-only presentation for Top wiring and module interfaces.
// Installed inside the retained native editor after its presentation controls.
{
 let presentationDrawing=null,presentationReturn=null,presentationPreview=null;
 let presentationSession=0,presentationBackground=[];
 const nativePresentationRefresh=refreshPresentationSvg,nativePresentationExit=exitPresentation;

 refreshPresentationSvg=function(){
  if(!presentationOpen||!presentStage)return;
  if(presentationDrawing){
   presentationContentBounds=presentationDrawing.bounds;
   presentStage.innerHTML=window.WIUTopScene.svg(presentationDrawing).replace('topSceneSvg','presentationSvg');
   applyPresentTransform();
  }else nativePresentationRefresh();
  // Scene SVGs also serve the editable workspace. The presentation copy has
  // no keyboard targets or delegated editing controls.
  for(const element of presentStage.querySelectorAll('[tabindex],[role="button"],[data-action]')){
   element.removeAttribute('tabindex');element.removeAttribute('role');element.removeAttribute('data-action');
  }
  presentStage.style.pointerEvents='none';
 };

 function openDrawingPresentation(scene=null,options={}){
  if(presentationOpen){fitPresentation();revealPresentHud();return true;}
  if(!presentation||!presentStage)return false;
  presentationDrawing=scene;
  presentationReturn=options.returnFocus||document.activeElement;
  presentationPreview={...previewView};
  presentationOpen=true;
  presentation.classList.add('open');
  presentation.setAttribute('aria-hidden','false');
  presentation.setAttribute('role','dialog');
  presentation.setAttribute('aria-modal','true');
  presentation.setAttribute('aria-label',options.label||'模組介面看圖模式');
  try{refreshPresentationSvg();}catch(error){
   presentationOpen=false;presentation.classList.remove('open');presentation.setAttribute('aria-hidden','true');
   presentation.removeAttribute('aria-modal');
   presentationDrawing=null;presentationReturn=null;presentationPreview=null;throw error;
  }
  presentationBackground=[...document.body.children].filter(element=>element!==presentation)
   .map(element=>({element,inert:!!element.inert}));
  for(const {element} of presentationBackground)element.inert=true;
  presentation.focus({preventScroll:true});
  const session=++presentationSession;
  requestAnimationFrame(()=>{if(!presentationOpen||session!==presentationSession)return;fitPresentation();revealPresentHud(1800);});
  ownsPresentationFullscreen=false;
  if(!document.fullscreenElement&&document.fullscreenEnabled!==false&&presentation.requestFullscreen){
   try{
    const pending=presentation.requestFullscreen({navigationUI:'hide'});
    pending?.then?.(()=>{
     if(presentationOpen&&session===presentationSession)ownsPresentationFullscreen=document.fullscreenElement===presentation;
     else if(document.fullscreenElement===presentation)document.exitFullscreen?.()?.catch?.(()=>{});
    }).catch?.(()=>{});
   }catch{}
  }
  return true;
 }

 exitPresentation=function(){
  if(!presentationOpen)return;
  ++presentationSession;
  const returnFocus=presentationReturn,previousView=presentationPreview;
  nativePresentationExit();
  for(const {element,inert} of presentationBackground)element.inert=inert;
  presentationBackground=[];
  presentationDrawing=null;presentationReturn=null;presentationPreview=null;
  presentation.removeAttribute('aria-modal');
  if(previousView){Object.assign(previewView,previousView);applyPreviewTransform();}
  if(returnFocus?.isConnected)returnFocus.focus?.({preventScroll:true});
 };

 function presentationKeydown(event){
  if(!presentationOpen)return;
  if(event.key==='Escape'){event.preventDefault();exitPresentation();return;}
  if(event.key==='Tab'){
   event.preventDefault();revealPresentHud();
   const buttons=[$('#presentFit'),$('#presentExit')].filter(Boolean);
   const index=buttons.indexOf(document.activeElement);
   const next=index<0?(event.shiftKey?buttons.length-1:0):(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;
   buttons[next]?.focus({preventScroll:true});return;
  }
  const key=String(event.key||'').toLowerCase();
  if(event.ctrlKey||event.metaKey||event.altKey){
   if((event.ctrlKey||event.metaKey)&&['z','y','v','x','d'].includes(key))event.preventDefault();
   return;
  }
  if(['Delete','Backspace'].includes(event.key)){event.preventDefault();return;}
  if(key==='f'){event.preventDefault();fitPresentation();revealPresentHud();return;}
  const direction={arrowup:[0,1],w:[0,1],arrowdown:[0,-1],s:[0,-1],arrowleft:[1,0],a:[1,0],arrowright:[-1,0],d:[-1,0]}[key];
  if(direction){
   event.preventDefault();const step=event.shiftKey?180:72;
   presentView.fit=false;presentView.x+=direction[0]*step;presentView.y+=direction[1]*step;
   applyPresentTransform();revealPresentHud();
  }
 }

 window.WIUPresentation={
  isOpen:()=>presentationOpen,
  open:openDrawingPresentation,
  close:()=>exitPresentation(),
  fit:()=>{fitPresentation();revealPresentHud();},
  keydown:presentationKeydown
 };
 enterPresentation=()=>window.WIUProjectHost?.presentDrawing?window.WIUProjectHost.presentDrawing():openDrawingPresentation();
 if($('#presentBtn'))$('#presentBtn').onclick=()=>enterPresentation();
 if($('#presentExit'))$('#presentExit').onclick=()=>exitPresentation();
}

})();
