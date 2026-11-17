/* View-only culling: full scene/model remains the source for editing and exports. */
(function(root){'use strict';
const rect=(x,y,width,height)=>({x,y,width:Math.max(1,width),height:Math.max(1,height)});
function intersects(a,b){return a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;}
function contains(a,b){return !!a&&b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height;}
function itemBounds(s){if(s.points){const xs=s.points.map(p=>p[0]),ys=s.points.map(p=>p[1]);return rect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));}if(s.type==='line')return rect(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.abs(s.x2-s.x1),Math.abs(s.y2-s.y1));return rect(s.x,s.y,s.width||1,s.height||1);}
function visibleItem(s,v){if(!v)return true;if(v.overview&&['directional-port','port-name','port-comment','top-port-name','unconfigured','open','net-label','net-label-background','net-label-legend','pin-label-leader'].includes(s.role))return false;if(!intersects(itemBounds(s),v))return false;
 if(s.type==='path')return s.points.some((p,i)=>i&&intersects(rect(Math.min(p[0],s.points[i-1][0]),Math.min(p[1],s.points[i-1][1]),Math.abs(p[0]-s.points[i-1][0]),Math.abs(p[1]-s.points[i-1][1])),v));
 return true;
}
function windowRect({width,height},viewWidth,viewHeight,zoom,pan,padding=180){const x=-pan.x/zoom,y=-pan.y/zoom,p=padding/zoom;return {...rect(Math.max(0,x-p),Math.max(0,y-p),Math.min(width,x+viewWidth/zoom+p)-Math.max(0,x-p),Math.min(height,y+viewHeight/zoom+p)-Math.max(0,y-p)),overview:zoom<.35};}
const api={rect,intersects,contains,itemBounds,visibleItem,windowRect};root.WIUSceneViewport=api;if(typeof module==='object')module.exports=api;
})(globalThis);
