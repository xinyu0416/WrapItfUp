/* Read-only electrical endpoint index shared by diagram navigation and review. */
(function(root){'use strict';
const dep=(key,file)=>root[key]||(typeof require==='function'?require('./'+file):null);
const C=dep('WIUCore','assembly-core'),G=dep('WIUGraphWiring','graph-wiring'),W=dep('WIUWorkbook','workbook');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function refs(expr,p,resolved){const result=[];try{const walk=n=>{if(!n||typeof n!=='object')return;if(n.kind==='ref'||n.kind==='select'){let range=null;if(n.kind==='select')try{const effective=resolved?.project||C.projectView(p),context=resolved?.context||C.resolveParameters({parameters:effective.parameters||[]},{}).context,info=C.expressionInfo(n,resolved?.nets||effective.nets,context).refs[0];range=[info.low,info.high];}catch{}result.push({name:n.name,range});return;}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);};walk(C.parseExpression(C.expandDefines(expr,p)));}catch{}return result;}
function index(p){
 const effective=C.projectView(p),resolved={project:effective,context:C.resolveParameters({parameters:effective.parameters||[]},{}).context,nets:new Map(effective.nets.map(n=>[n.name,n]))};
 const diagrams=new Map(),netMap=new Map(p.nets.map(n=>[n.name,{net:n,drivers:[],loads:[],bidirectional:[]} ]));
 const group=e=>{const id=e.top?'top':p.modules.find(m=>m.name===e.module)?.id;if(!id)return '—';if(!diagrams.has(id))diagrams.set(id,W.makeDiagram(p,id));const d=diagrams.get(id),pin=e.top?e.net:e.port;for(const side of ['left','right']){const s=d.signals[side].find(s=>s.id===pin.id||s.name===pin.name);if(s)return W.groupLabel(d,side,s.groupId)||'—';}return pin.group||'—';};
 const ends=G.endpoints(p).map(e=>({...e,instanceName:e.top?'Top':e.instanceName,group:group(e),pin:e.top?e.net.name:e.port.name,direction:e.top?e.net.direction:e.port.direction,range:e.top?e.net.range:e.port.range}));
 const byKey=new Map(ends.map(e=>[e.key,e]));
 function add(e,expr){for(const ref of refs(expr,p,resolved)){const n=netMap.get(ref.name);if(!n)continue;const key=e.role==='source'?'drivers':e.role==='sink'?'loads':'bidirectional';n[key].push({...e,via:expr,bits:ref.range});}}
 for(const e of ends)add(e,e.top?e.net.name:e.expr||'');
 for(const a of p.assigns){const base={key:'assign::'+a.id,assign:a,instanceName:'assign',group:'運算',pin:a.target,direction:'assign',width:null,range:'',label:a.target+' = '+a.expr};add({...base,role:'source'},a.target);add({...base,role:'sink'},a.expr);}
 const net=name=>{const n=netMap.get(name);if(!n)return {drivers:[],loads:[],bidirectional:[]};const unique=rows=>{
  const pins=new Map();
  for(const e of rows){
   const k=e.key+'|'+e.via,prior=pins.get(k);
   if(!prior)pins.set(k,{...e,bitRanges:[e.bits]});
   else if(!prior.bitRanges.some(r=>String(r)===String(e.bits))){prior.bitRanges.push(e.bits);prior.bits=null;}
  }
  return [...pins.values()];
 };return {...n,drivers:unique(n.drivers),loads:unique(n.loads),bidirectional:unique(n.bidirectional)};};
 const peers=key=>{const e=byKey.get(key);if(!e)return [];const out=[];for(const r of refs(e.top?e.net.name:e.expr||'',p,resolved)){const n=netMap.get(r.name);if(!n)continue;const list=e.role==='source'?n.loads:e.role==='sink'?n.drivers:[...n.drivers,...n.loads];for(const peer of [...list,...n.bidirectional])if(peer.key!==key&&(!r.range||!peer.bits||Math.max(r.range[0],peer.bits[0])<=Math.min(r.range[1],peer.bits[1])))out.push({...peer,net:r.name});}return [...new Map(out.map(e=>[e.key+'|'+e.via,e])).values()];};
 return {ends,byKey,net,peers};
}
function endpointHTML(e){return '<span class="r132-endpoint"><span class="r132-instance">'+esc(e.instanceName)+'</span><span class="r132-group">'+esc(e.group)+'</span><strong>'+esc(e.pin)+'</strong></span>';}
function destinationHTML(e,peers){if(e?.expr==null&&!e?.top)return '<span class="a-warn">尚未設定</span>';if(e?.expr===''&&!e?.top)return '刻意不接 NC';if(peers.length)return peers.map(p=>'<div class="r132-peer">'+endpointHTML(p)+(p.assign?'<code>'+esc(p.label)+'</code>':p.via&&p.via!==p.net?'<small>綁定：'+esc(p.via)+'</small>':'')+'</div>').join('');return '<span>'+esc(e?.expr||e?.net?.name||'—')+'</span><small>沒有可定位的另一端</small>';}
function viewAt(point,width,height,zoom){const z=Math.max(.85,Math.min(1.25,zoom||1));return {zoom:z,pan:{x:width/2-point.x*z,y:height/2-point.y*z}};}
const api={index,refs,endpointHTML,destinationHTML,viewAt};root.WIUNetReview=api;if(typeof module==='object')module.exports=api;
})(globalThis);
