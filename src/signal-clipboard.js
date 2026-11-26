/* Versioned signal-row transport shared with WaveASecond. Editing belongs to each app. */
(function(root){
 'use strict';
 const FORMAT='SignalClipboard', VERSION=1, MAX_TEXT=16*1024*1024, MAX_SIGNALS=10000;
 const TYPES=new Set(['signal','data','clock']);
 function signals(value){
  if(!Array.isArray(value)||!value.length||value.length>MAX_SIGNALS)throw Error('Invalid signal clipboard row count.');
  return value.map(row=>{
   if(!row||typeof row.name!=='string'||row.name.length>4096)throw Error('Invalid signal clipboard name.');
   if(!TYPES.has(row.waveType))throw Error('Invalid signal clipboard waveform type.');
   if(typeof row.bits!=='string'||!row.bits.trim()||row.bits.length>4096)throw Error('Invalid signal clipboard width.');
   if(row.group!=null&&(typeof row.group!=='string'||row.group.length>4096))throw Error('Invalid signal clipboard group.');
   return {name:row.name,bits:row.bits,waveType:row.waveType,group:row.group||''};
  });
 }
 function encode(source,rows,native){
  if(typeof source!=='string'||!source.trim())throw Error('Missing clipboard source.');
  const data={format:FORMAT,version:VERSION,source,signals:signals(rows)};
  if(native!==undefined)data.native=native;
  const text=JSON.stringify(data);
  if(text.length>MAX_TEXT)throw Error('Signal clipboard is too large. Select fewer signals.');
  return text;
 }
 function decode(text){
  if(typeof text!=='string')return null;
  const trimmed=text.trim();
  if(!trimmed.startsWith('{'))return null;
  let data;
  try{data=JSON.parse(trimmed);}catch(error){
   if(/"format"\s*:\s*"SignalClipboard"/.test(trimmed))throw Error('Signal clipboard is incomplete. Copy the signals again.');
   return null;
  }
  if(!data||data.format!==FORMAT)return null;
  if(text.length>MAX_TEXT)throw Error('Signal clipboard is too large. Select fewer signals.');
  if(data.version!==VERSION)throw Error('Unsupported signal clipboard version.');
  if(typeof data.source!=='string'||!data.source.trim())throw Error('Missing clipboard source.');
  return {...data,signals:signals(data.signals)};
 }
 const api={FORMAT,VERSION,MAX_TEXT,MAX_SIGNALS,encode,decode};
 root.SignalClipboard=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
