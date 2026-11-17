// Reproducible local geometry timings; not browser frame-rate or company RTL verification.
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {Worker} from 'node:worker_threads';
const require=createRequire(import.meta.url),S=require('../src/graph-scene'),W=require('../src/workbook'),B=require('../src/graph-background-r129'),fixture=require('../tests/fixtures/dense-top.cjs');
const code='const {parentPort}=require("node:worker_threads");globalThis.self=globalThis;self.postMessage=data=>parentPort.postMessage(data);'+B.dependencies.map(n=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8')).join('\n;\n')+';('+B.workerMain.toString()+')();parentPort.on("message",data=>self.onmessage({data}));';
const makeWorker=()=>{const w=new Worker(code,{eval:true}),proxy={postMessage:x=>w.postMessage(x)};w.on('message',data=>proxy.onmessage?.({data}));w.on('error',e=>proxy.onerror?.(e));return {worker:proxy,dispose:()=>w.terminate()};};
const results=[];for(const [n,k] of [[4,4],[8,8],[16,16],...(process.argv.includes('--large')?[[32,16]]:[])]){
 const p=fixture(n,k),start=performance.now(),scene=S.create(p,{fast:true}),quick=performance.now()-start;
 const added=W.createModule(p,'Unused').project,t=performance.now(),hit=S.create(added),unused=performance.now()-t;
 let last=performance.now(),maxGap=0,ticks=0;const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},10),runner=B.createRunner({makeWorker,timeout:30000}),r={instances:n,instancePins:n*k*2,edges:scene.edges.length,quickSceneMs:+quick.toFixed(1),unusedModuleCacheMs:+unused.toFixed(2),sameScene:scene===hit};
 const begin=performance.now();try{const {scene}=await runner.run({kind:'route',project:p});r.backgroundMs=Math.round(performance.now()-begin);r.invalidRoutes=scene.routeQualityR98?.summary.finalInvalid;r.spacingIssues=scene.routeQualityR98?.summary.parallelSpacing.count;}catch(e){r.error=e.code||e.message;}finally{clearInterval(timer);r.maxMainHeartbeatGapMs=+maxGap.toFixed(1);r.mainHeartbeatTicks=ticks;}results.push(r);
}
console.log(JSON.stringify(results,null,2));
