/* Interface adapter. Naming, insertion and history remain in the port editor. */
(function(root,factory){
 const api=factory(root);
 root.WIUPortClipboard=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis,function(root){
 'use strict';
 const codec=()=>root.SignalClipboard||(typeof require==='function'?require('./signal-clipboard.js'):null);
 function waveType(value){return ['signal','data','clock'].includes(value)?value:'auto';}
 // Clock is a visual/waveform choice. Remember the explicit non-clock choice
 // without changing electrical width or direction; foreign rows have no history.
 function waveMetadata(row){
  const type=waveType(row?.waveType),prior=row?.beforeClockType;
  return {waveType:type,...(type==='clock'&&['auto','signal','data'].includes(prior)?{beforeClockType:prior}:{})};
 }
 function setWaveType(row,value){
  const next=waveType(value),current=waveType(row.waveType);
  if(next==='clock'&&current!=='clock')row.beforeClockType=current;
  if(next!=='clock')delete row.beforeClockType;
  row.waveType=next;
  return current!==next;
 }
 function toggleClock(row){return setWaveType(row,waveType(row.waveType)==='clock'?row.beforeClockType:'clock');}
 function resolvedType(signal,width){
  const chosen=waveType(signal.waveType);
  return chosen==='auto'?(width===1?'signal':'data'):chosen;
 }
 function encode(payload,resolveWidth){
  const signals=payload.items.flatMap((row,index)=>{
   if(!String(row.name||'').trim()||/^\s*\/\//.test(row.name))return [];
   const info=resolveWidth(row,index);
   if(info.skip)return [];
   const bits=Number.isSafeInteger(info.width)&&info.width>0?String(info.width):String(row.bits||'1');
   return [{name:row.name,bits,waveType:resolvedType(row,info.width),group:row.groupName||''}];
  });
  // A spacer-only copy still uses the editor's existing native representation.
  return signals.length?codec().encode('WrapItfUp',signals,payload):JSON.stringify(payload);
 }
 function decode(text,fallbackDirection,normalizeName){
  let envelope=codec().decode(text);
  if(!envelope){
   try{const native=JSON.parse(text);if(native?.format==='WrapperSignalRows'&&Array.isArray(native.items))return native;}catch{}
   return null;
  }
  if(envelope.source==='WrapItfUp'&&envelope.native?.format==='WrapperSignalRows'&&Array.isArray(envelope.native.items))return envelope.native;
  const items=envelope.signals.map(row=>({
   name:normalizeName(row.name),bits:row.bits||'1',waveType:waveType(row.waveType),
   direction:fallbackDirection,groupName:row.group||'',group:{name:row.group||''},comment:'',
  }));
  const renames=envelope.signals.flatMap((row,index)=>row.name!==items[index].name?[{from:row.name,to:items[index].name}]:[]);
  return {format:'WrapperSignalRows',version:5,items,renames,operation:'copy'};
 }
 return {waveType,waveMetadata,setWaveType,toggleClock,resolvedType,encode,decode};
});
