'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const W=require('../src/workbook'),C=require('../src/assembly-core'),K=require('../src/assembly-company'),P=require('../src/assembly-parser'),H=require('../src/history'),UX=require('../src/interaction-r124');
const root=path.join(__dirname,'..');
const fixture=()=>W.read(JSON.parse(fs.readFileSync(path.join(root,'examples/ExampleTop.wiu.json')))).project;
test('public example validates and retains its full workbook through save/load',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(root,'examples/ExampleTop.wiu.json')));assert.equal(raw.appVersion,'125');const p=fixture();assert.deepEqual(C.validate(p),[]);assert.equal(p.instances.length,2);assert.equal(p.modules.length,2);
 assert.deepEqual(W.read(W.envelope(p)).project,p);
});
test('all generated files are byte-identical to the public r124.1 baseline for the same project',()=>{
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'expected-public.json')));
 assert.deepEqual(K.files(fixture()),expected);
});
test('standalone RTL matches the checked-in public example exactly',()=>{
 assert.equal(C.exportVerilog(fixture()),fs.readFileSync(path.join(root,'examples/ExampleTop.v'),'utf8'));
});
test('top rename, undo and redo preserve all generation inputs and geometry',()=>{
 const before=fixture(),after=UX.rename(before,'top','RenamedTop'),entry={patch:H.changes(before,after)};
 assert.equal(after.top,'RenamedTop');assert.match(C.exportVerilog(after),/module RenamedTop/);
 assert.deepEqual(H.apply(after,entry,true),before);assert.deepEqual(H.apply(before,entry,false),after);
 for(const key of ['modules','instances','connections','rtlSources'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(K.files(H.apply(after,entry,true)),K.files(before));
});
test('invalid and duplicate top names are rejected atomically',()=>{
 const p=fixture(),original=JSON.stringify(p);
 for(const name of ['','bad-name','1top',p.modules[0].name])assert.throws(()=>UX.rename(p,'top',name));
 assert.equal(JSON.stringify(p),original);
});
test('explicit collapse persists through search and project serialization',()=>{
 const p=fixture(),state=UX.disclosures({'module:example':false,design:true,invalid:42});
 assert.equal(UX.disclosureOpen(state,'module:example',true),false);
 assert.deepEqual(W.read(W.envelope(p,{railDisclosures:state})).workspace.railDisclosures,state);
});
test('RTL import preserves parameter expressions and separate source bytes',()=>{
 const text='module PublicUnit #(parameter WIDTH=8)(input clk, input [WIDTH-1:0] data_in, output [WIDTH-1:0] data_out); assign data_out=data_in; endmodule\n';
 const r=P.parseRtl(text,{filename:'PublicUnit.v'});
 assert.equal(r.modules[0].name,'PublicUnit');assert.equal(r.modules[0].ports[1].range,'[WIDTH-1:0]');assert.equal(r.sources[0].text,text);
});
test('all runtime code and styles except release metadata retain their reviewed baseline hashes',()=>{
 const baseline=require('./source-baseline.json');
 for(const file of baseline.files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex');assert.equal(hash,file.sha256,file.path);}
});
test('source build reproduces the public baseline HTML exactly after normalizing version metadata',async()=>{
 const {bundle}=await import('../tools/build.mjs'),baseline=require('./source-baseline.json');
 const normalized=(await bundle()).replace('<title>WrapItfUp Public r125</title>','<title>WrapItfUp Public r124.1</title>').replace(/(<script data-wiu-source="release.js">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+baseline.releaseSource+b);
 assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'),baseline.htmlSha256);
});
