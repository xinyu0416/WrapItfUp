'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),I=require('../src/issue-review-r131'),T=require('../src/track-space-r106'),f=require('./fixtures/dense-top.cjs'),C=require('../src/assembly-core');
test('all 46 pending pins identify their instance, signal and reason without expanding details',()=>{
 const p=f(1,23);p.connections=[];const issues=C.validate(p).filter(x=>x.code==='UNCONFIGURED_PIN');assert.equal(issues.length,46);
 const text=I.render(p,issues),rows=I.rows(p,issues);assert.equal((text.match(/data-issue-row/g)||[]).length,46);
 for(const r of rows){assert.equal(r.owner,'u_cell_p0');assert.ok(text.includes('<code>'+r.signal+'</code>'));assert.equal(r.binding,'未設定');assert.match(r.reason,/尚未選擇/);}
 const html=I.render(p,[{code:'X',message:'bad <script>',ref:{type:'net',id:'missing'}}]);assert.ok(html.includes('bad &lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('expansion keeps horizontal control bars and locked block dimensions rigid',()=>{
 const b={instance:{id:'bar'},shape:'bar',x:100,y:100,width:300,height:100},scene={placed:[b],points:{},edges:[{net:'a',points:[[110,120,900,120],[700,250,950,250]]},{net:'b',points:[[110,121,900,121],[700,251,950,251]]}]};
 const map=T.make(scene,{});assert.ok(map);assert.equal(T.mapped(map.x,400)-T.mapped(map.x,100),300);assert.equal(T.mapped(map.y,200)-T.mapped(map.y,100),100);assert.ok(T.mapped(map.y,251)-T.mapped(map.y,250)>1);
 scene.placed=[{...b,shape:'block'}];const locked=T.make(scene,{bar:{x:100,y:100}});assert.equal(T.mapped(locked.y,200)-T.mapped(locked.y,100),100);
});
