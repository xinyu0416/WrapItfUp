'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),zlib=require('node:zlib');
const assets=require('../src/delivery-assets'),T=require('../src/delivery-transfer');
test('shipped Python, compressed receiver and simulator evidence agree with the source and CLI contract',()=>{
 const source=name=>path.join(__dirname,'../tools/delivery',name);
 assert.equal(assets.runner,fs.readFileSync(source('run_wiu.py'),'utf8'));
 assert.equal(assets.receiver,fs.readFileSync(source('receive_wiu.py'),'utf8'));
 assert.equal(zlib.inflateSync(Buffer.from(assets.receiverZlib64,'base64')).toString(),assets.receiver);
 cp.execFileSync('python3',[path.join(__dirname,'fixtures/runner-check.py'),source('run_wiu.py')],{timeout:20000});
});
test('a same-length receipt from a different package cannot mark the active transfer received',async()=>{
 const a=await T.prepare([{path:'file.txt',text:'first'}],'/tmp'),b=await T.prepare([{path:'file.txt',text:'other'}],'/tmp');
 const n=a.chunks.length,receipt='RECEIVED '+n+'/'+n+' package='+a.id;
 assert.equal(b.chunks.length,n);assert.equal(T.receipt(a,receipt).received,true);assert.equal(T.receipt(b,receipt).received,false);
});
