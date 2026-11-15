(function(root){'use strict';
const styles=[['06','緊湊色籤'],['07','居中色籤'],['10','實線框'],['13','虛線框'],['14','側邊色條'],['15','雙底線']];
const palette=['#68778c','#806596','#5d427c','#8c6f4e','#4f6382','#856d96'];
function settings(p){const s=p.workbook?.topStyle||{};return {group:styles.some(x=>x[0]===s.group)?s.group:'06',route:s.route==='curve'?'curve':'orthogonal',showWireNames:s.showWireNames!==false,editWireRoutes:!!s.editWireRoutes,monochrome:!!s.monochrome,colors:s.colors||{}};}
function groupKey(module,side,id){return module+'::'+side+'::'+id;}
function color(p,key,index,name='',inherited){const semantic=/clk|clock|rst|reset/i.test(name)?0:/^apb/i.test(name)?1:/shared.packet|buffer/i.test(name)?2:/selection|transmit/i.test(name)?3:/mac/i.test(name)?4:/discard|txtm/i.test(name)?5:name?Array.from(name).reduce((n,c)=>n+c.charCodeAt(0),0)%palette.length:index;const c=settings(p).colors[key]||inherited||palette[semantic%palette.length];return settings(p).monochrome?'#333333':/^#[0-9a-f]{6}$/i.test(c)?c:palette[0];}
const api={styles,palette,settings,groupKey,color};root.WIUDiagramStyle=api;if(typeof module==='object')module.exports=api;
})(globalThis);
