/* Geometry work is local, cancellable and isolated from the editor thread.
 * Reuse embedded sources in the standalone file; no network or extra payload. */
(function(root){'use strict';
const dependencies=['instance-layout.js','diagram-scene.js','release.js','assembly-defines.js','org-layout.js','assembly-core.js','assembly-parser.js','assembly-toolchain-assets.js','assembly-bundle.js','assembly-actions.js','diagram-style.js','routing-spacing-r98.js','routing-quality-r98.js','top-autosize-r98.js','native-routing-r92.js','native-polyline-r98.js','native-visio-r92.js','shared-jump-plan-r104.js','visio-live-geometry-r105.js','native-visio-polyline-r98.js','history.js','rtl-interface-edit.js','workbook.js','graph-layout.js','graph-wiring.js','wire-geometry.js','graph-electrical-audit.js','corner-untangle-r100.js','track-space-r106.js','routing-fast-r130.js','graph-viewport-r130.js','wire-labels.js','graph-scene.js','channel-layout.js','workflow-r118.js'];
function workerMain(){
 self.onmessage=({data})=>{try{
  const {project,kind,options={}}=data,G=self.WIUTopScene;
  self.WIURouteProgress=progress=>self.postMessage({progress});
  self.postMessage({progress:{phase:'計算圖面',done:0}});
  let result;
  if(kind==='export'){self.WIUInteractiveRouting=true;if(project.workbook.graphAutoR99?.pendingRouting){delete project.workbook.graphAutoR99.pendingRouting;project.workbook.graphAutoR99.settlingRouting=true;}G.create(project,{full:true});result=G.exportDrawing(G.withDrawingSnapshot(project),options);}
  else if(kind==='layout'){
   result=self.WIUWorkflowR118.layoutPlan(project,options.kind,G,self.WIUGraphLayout);
   result.before=G.layoutThumbnail(result.before);
   result.after=G.layoutThumbnail(result.after);
  }
  else{
   self.WIUInteractiveRouting=true;
   if(project.workbook.graphAutoR99?.pendingRouting){delete project.workbook.graphAutoR99.pendingRouting;project.workbook.graphAutoR99.settlingRouting=true;}
   const scene=G.create(project,{full:true});result={scene,snapshot:G.capture(project)};
  }
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message||String(error)});}};
}
function workerSource(doc){
 const sources=dependencies.map(name=>{const node=doc.querySelector('script[data-wiu-source="'+name+'"]');if(!node)throw Error('缺少繪圖程式 '+name);return node.textContent.trim()?node.textContent+'\n': 'importScripts('+JSON.stringify(node.src)+');\n';});
 return sources.join('\n;\n')+'\n;('+workerMain.toString()+')();';
}
function browserWorker(){
 const url=URL.createObjectURL(new Blob([workerSource(document)],{type:'text/javascript'}));
 try{const worker=new Worker(url);return {worker,dispose(){worker.terminate();URL.revokeObjectURL(url);}};}catch(e){URL.revokeObjectURL(url);throw e;}
}
function createRunner({makeWorker=browserWorker,timeout=30000}={}){
 let active=null;
 function cancel(message='已暫停背景整理'){if(!active)return;const job=active;active=null;clearTimeout(job.timer);job.dispose();const e=new Error(message);e.code='CANCELLED';job.reject(e);}
 function run(payload,onProgress=()=>{}){
  cancel('設計已更新，已取消舊的圖面計算');
  return new Promise((resolve,reject)=>{let handle;try{handle=makeWorker();}catch(e){reject(e);return;}
   const job={...handle,reject,timer:null};active=job;
   const finish=(error,value)=>{if(active!==job)return;active=null;clearTimeout(job.timer);job.dispose();error?reject(error):resolve(value);};
   job.worker.onmessage=({data})=>{if(active!==job)return;if(data.progress){onProgress(data.progress);return;}if(data.error)finish(new Error(data.error));else finish(null,data.result);};
   job.worker.onerror=e=>{e.preventDefault?.();finish(new Error(e.message||'背景繪圖無法啟動'));};
   job.timer=setTimeout(()=>{const e=new Error('整理超過 '+Math.round(timeout/1000)+' 秒，已暫停。可繼續接線、儲存、匯出 RTL，或按重新整理。');e.code='TIMEOUT';finish(e);},timeout);
   try{job.worker.postMessage(payload);}catch(e){finish(e);}
  });
 }
 return {run,cancel,get running(){return !!active;}};
}
const api={dependencies,workerSource,workerMain,createRunner};root.WIUGraphBackground=api;if(typeof module==='object')module.exports=api;
})(globalThis);
