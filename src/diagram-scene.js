/* A single measured scene drives browser SVG and editable Visio shapes. */
(function(root){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=s=>'"'+String(s??'').replace(/"/g,'""').replace(/[\r\n]/g,' ')+'"';
const font='Calibri, Arial, sans-serif',unit=66;
function text(value,x,y,align,options={},measure){
 const size=options.size||11,bold=!!options.bold,width=Math.ceil(Math.max(1,measure(String(value),`${bold?700:400} ${size}px ${font}`))*1.14+12);
 return {type:'text',text:String(value),x:align==='end'?x-width:align==='middle'?x-width/2:x,y:y-size*.85,width,height:size*1.7,align,size,bold,color:'#222222',...options};
}
function bounds(items){const xs=[],ys=[];for(const s of items){if(s.points){xs.push(...s.points.map(p=>p[0]));ys.push(...s.points.map(p=>p[1]));}else if(s.type==='line'){xs.push(s.x1,s.x2);ys.push(s.y1,s.y2);}else{xs.push(s.x,s.x+s.width);ys.push(s.y,s.y+s.height);}}return {x:Math.min(...xs)-24,y:Math.min(...ys)-24,width:Math.max(...xs)-Math.min(...xs)+48,height:Math.max(...ys)-Math.min(...ys)+48};}
function svg(scene){
 const b=scene.bounds;return `<svg id="diagramSvg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" xmlns="http://www.w3.org/2000/svg"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="white"/>`+scene.items.map((s,i)=>{
  const owner=s.ownerInstance?' data-owner-instance="'+esc(s.ownerInstance)+'"':'';
  const groupClick=s.group&&['group-name','group-header'].includes(s.role)?' data-graph-group="'+esc(s.group)+'" role="button" tabindex="0" aria-label="追蹤 Group '+esc(s.text||s.group)+'"':'';
  if(s.type==='path'||s.type==='polygon'){
   const pts=s.points,closed=s.type==='polygon',p=pts.at(-1),prev=pts.at(-2),first=pts[0],second=pts[1],arrow=(a,b)=>{const angle=Math.atan2(a[1]-b[1],a[0]-b[0]),dx=Math.cos(angle),dy=Math.sin(angle);return `<polygon points="${a[0]},${a[1]} ${a[0]-7*dx+3*dy},${a[1]-7*dy-3*dx} ${a[0]-7*dx-3*dy},${a[1]-7*dy+3*dx}" fill="${s.color}"/>`;};
   return `<g${owner} data-net="${esc(s.net||'')}" ${s.role==='wire-jump' ? 'data-net-label="'+esc(s.net||'')+'"' : ''} ${s.role==='connection'?'data-wire-net="'+esc(s.net||'')+'" data-wire-source="'+esc(s.source||'')+'" data-wire-target="'+esc(s.target||'')+'"':''}><${closed?'polygon':'polyline'} points="${pts.map(p=>p.join(',')).join(' ')}" fill="${s.fill||'none'}" stroke="${s.color}" stroke-width="${s.weight||1}" stroke-linejoin="round"/>${s.role==='connection'?'<polyline class="r86-wire-hit" data-wire-hit="'+esc(s.net||'')+'" tabindex="0" role="button" aria-label="選取 net '+esc(s.net||'')+'；Ctrl 加選" points="'+pts.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="transparent" stroke-width="15"/>':''}${s.endArrow?arrow(p,prev):''}${s.startArrow?arrow(first,second):''}<\/g>`;
  }
  if(s.type==='ellipse')return `<ellipse${owner} ${s.net?'data-net-label="'+esc(s.net)+'"':''} cx="${s.x+s.width/2}" cy="${s.y+s.height/2}" rx="${s.width/2}" ry="${s.height/2}" fill="${s.fill||s.color}" stroke="${s.color}" stroke-width="${s.weight||0}"/>`;
  if(s.type==='rect')return `<rect${owner}${groupClick} ${s.net?'data-net-label="'+esc(s.net)+'"':''} x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.fill||'none'}" stroke="${s.color}" stroke-width="${s.weight||1}" ${s.dash?'stroke-dasharray="5 4"':''}/>`;
  if(s.type==='line'){
   const angle=Math.atan2(s.y2-s.y1,s.x2-s.x1),arrow=(x,y,a)=>{const dx=Math.cos(a),dy=Math.sin(a);return `<polygon points="${x},${y} ${x-7*dx+3.5*dy},${y-7*dy-3.5*dx} ${x-7*dx-3.5*dy},${y-7*dy+3.5*dx}" fill="${s.color}"/>`;};
   return `<g${owner}><line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.color}" stroke-width="${s.weight||1}" ${s.dash?'stroke-dasharray="4 3"':''}/>${s.endArrow?arrow(s.x2,s.y2,angle):''}${s.startArrow?arrow(s.x1,s.y1,angle+Math.PI):''}<\/g>`;
  }
  const x=s.align==='end'?s.x+s.width:s.align==='middle'?s.x+s.width/2:s.x;
  const textShape=`<text${owner} ${s.net?'data-net-label="'+esc(s.net)+'"':''} data-scene-text="${i}" x="${x}" y="${s.y+s.height/2}" text-anchor="${s.align||'start'}" dominant-baseline="central" class="${s.className||''}" style="text-anchor:${s.align||'start'};font-family:${font};font-size:${s.size}px;font-weight:${s.bold?700:400};fill:${s.color};white-space:pre">${s.runs?.length?s.runs.map(r=>`<tspan style="font-weight:${r.style&1?700:s.bold?700:400};font-style:${r.style&2?'italic':'normal'};text-decoration:${r.style&4?'underline':'none'}">${esc(r.text)}<\/tspan>`).join(''):esc(s.text)}<\/text>`;
  if(s.role==='group-name'&&s.group){
    const hitX=s.x-12,hitY=s.y-9,hitW=Math.max(120,s.width+24),hitH=Math.max(32,s.height+17);
    return `<g${groupClick} class="r103-graph-group-target"><rect x="${hitX}" y="${hitY}" width="${hitW}" height="${hitH}" fill="transparent" stroke="none" pointer-events="all"/>${textShape}<\/g>`;
  }
  return textShape;
 }).join('')+'<\/svg>';
}
function vbs(scene,{metadata='',name='wrapper',nativeConnectors=false}={}){
 const v=[metadata,"' WrapItfUp r76 — same scene as browser artwork preview","Option Explicit",'Dim app, doc, page, fso, outPath, shp, chars, phase, sel, grp, owner, trace, tracePath, edgeCount, gluedCount, px, py, failNo, failDesc','phase = "Start Visio"','On Error Resume Next','Set app = CreateObject("Visio.Application")','CheckError phase','app.Visible = True','Set doc = app.Documents.Add("")','CheckError "Create document"','Set page = doc.Pages.Item(1)','Set fso = CreateObject("Scripting.FileSystemObject")','outPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'.vsdx')+')'];
 const b=scene.bounds,X=x=>(x-b.x)/unit,Y=y=>(b.y+b.height-y)/unit,num=x=>Number(x.toFixed(6)),cell=(key,formula)=>v.push('shp.CellsU('+q(key)+').FormulaU = '+q(formula));
 v.push('page.PageSheet.CellsU("PageWidth").FormulaU = '+q(num(b.width/unit)+' in'),'page.PageSheet.CellsU("PageHeight").FormulaU = '+q(num(b.height/unit)+' in'));
 const rgb=c=>{const h=(/^#[0-9a-f]{6}$/i.test(c)?c:'#222222').slice(1);return 'RGB('+[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(',')+')';};
 const netShapes=new Map();
 // Native mode deliberately uses Visio's own routing, GlueToPos and line jumps.
 // Fixed geometry remains available for pixel-identical archive export.
 const nativeOwners=new Map(),nativeEdges=[],topIndex=scene.items.findIndex(s=>s.role==='top-boundary');
 const nativeLabelNets=new Set((scene.items||[]).filter(s=>s.role==='net-label').map(s=>s.net));
 if(nativeConnectors){
  v.push("' WIU_NATIVE_CONNECTORS_EXPERIMENTAL: an editable Visio routing test, not a pixel-identical export");
  v.push('tracePath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'-test.txt')+')',
   'page.PageSheet.CellsU("RouteStyle").FormulaU = "1"',
   'page.PageSheet.CellsU("LineJumpCode").FormulaU = "1"',
   'page.PageSheet.CellsU("LineJumpStyle").FormulaU = "1"',
   'page.PageSheet.CellsU("LineJumpFactorX").FormulaU = "0.35"',
   'page.PageSheet.CellsU("LineJumpFactorY").FormulaU = "0.35"',
   'CheckError "Configure native connector routing"',
   'edgeCount = 0','gluedCount = 0');
 }
 const labeledNets=new Set();
 for(let i=0;i<scene.items.length;i++){
  const s=scene.items[i];
  if(nativeConnectors && ['net-label','net-label-background','net-label-legend','wire-junction'].includes(s.role))continue;
  v.push('phase = '+q('Draw '+(s.role||s.type)+' '+(s.text||'')+' ['+i+']'));
  // In native mode each electrical branch is ONE Visio dynamic connector.
  // There are no sampled polylines or drawn-on top half-circle jumps.
  if(nativeConnectors && s.role==='connection'){
   const pts=s.points||[],a=scene.points?.[s.source],b=scene.points?.[s.target];
   if(!a||!b||pts.length<2)throw Error('Native Visio: endpoint metadata missing for '+s.net+' '+s.source+' to '+s.target);
   const left=pts[0],right=pts[pts.length-1],mx=(left[0]+right[0])/2,my=(left[1]+right[1])/2;
   v.push("' WIU_NATIVE_EDGE="+q([i,s.net,s.source,s.target].join(' | ')));
   v.push(`Set shp = page.Drop(app.ConnectorToolDataObject, ${num(X(mx))}, ${num(Y(my))})`);
   cell('BeginX',num(X(a.x))+' in');cell('BeginY',num(Y(a.y))+' in');
   cell('EndX',num(X(b.x))+' in');cell('EndY',num(Y(b.y))+' in');
   cell('FillPattern','0');cell('Geometry1.NoFill','TRUE');cell('ShapeRouteStyle','1');cell('ConLineRouteExt',scene.style?.route==='curve'?'2':'0');
   cell('LineColor',rgb(s.color));cell('LineWeight',num((s.weight||1)*72/unit)+' pt');
   cell('BeginArrow',s.startArrow?'5':'0');cell('EndArrow',s.endArrow?'5':'0');
   const labelKey=s.net+(s.selection||'');
   if((scene.style?.showWireNames||s.selection) && nativeLabelNets.has(s.net) && !labeledNets.has(labelKey)){
    // Dynamic connector text travels with its own line when it is rerouted.
    v.push('shp.Text = '+q(s.net+(s.selection||'')));
    cell('Char.Font','FONT("Calibri")');cell('Char.Size','9 pt');
    cell('Char.Color',rgb(s.color));cell('TxtWidth','TEXTWIDTH(TheText)+0.08 in');cell('TxtHeight','0.22 in');
    labeledNets.add(labelKey);
   }
   v.push('shp.NameU = '+q('WIU_'+i),'CheckError phase','edgeCount = edgeCount + 1');
   nativeEdges.push({i,net:s.net,source:s.source,target:s.target});
   continue;
  }
  if(s.type==='path'||s.type==='polygon'){
   const pts=s.type==='polygon'?[...s.points,s.points[0]]:s.points,minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
   v.push(`Set shp = page.DrawRectangle(${num(X(minX))}, ${num(Y(maxY))}, ${num(X(Math.max(minX+.01,maxX)))}, ${num(Y(Math.min(maxY-.01,minY)))})`,'shp.DeleteSection 10','shp.AddSection 10','shp.AddRow 10, 0, 137');
   pts.forEach((p,j)=>{v.push('shp.AddRow 10, '+(j+1)+', '+(j===0?'138':'139'));cell('Geometry1.X'+(j+1),num((p[0]-minX)/unit)+' in');cell('Geometry1.Y'+(j+1),num((maxY-p[1])/unit)+' in');});
   cell('LineColor',rgb(s.color));cell('LineWeight',num((s.weight||1)*72/unit)+' pt');cell('FillPattern',s.role==='connection'?'0':s.fill?'1':'0');if(s.role==='connection')cell('Geometry1.NoFill','TRUE');if(s.fill&&s.role!=='connection')cell('FillForegnd',rgb(s.fill));cell('BeginArrow',s.startArrow?'5':'0');cell('EndArrow',s.endArrow?'5':'0');
  }else if(s.type==='line'){
   v.push(`Set shp = page.DrawLine(${num(X(s.x1))}, ${num(Y(s.y1))}, ${num(X(s.x2))}, ${num(Y(s.y2))})`);cell('LineColor',rgb(s.color));cell('LineWeight',num((s.weight||1)*72/unit)+' pt');cell('LinePattern',s.dash?'2':'1');cell('FillPattern','0');cell('Geometry1.NoFill','TRUE');cell('BeginArrow',s.startArrow?'5':'0');cell('EndArrow',s.endArrow?'5':'0');
  }else{
   v.push(`Set shp = page.DrawRectangle(${num(X(s.x))}, ${num(Y(s.y+s.height))}, ${num(X(s.x+s.width))}, ${num(Y(s.y))})`);
   if(s.type==='ellipse'){v.pop();v.push(`Set shp = page.DrawOval(${num(X(s.x))}, ${num(Y(s.y+s.height))}, ${num(X(s.x+s.width))}, ${num(Y(s.y))})`);cell('LinePattern','0');cell('FillPattern','1');cell('FillForegnd',rgb(s.fill||s.color));}
   else if(s.type==='rect'){cell('LinePattern',s.dash?'2':'1');cell('LineColor',rgb(s.color));cell('LineWeight',num((s.weight||1)*72/unit)+' pt');cell('FillPattern',s.fill?'1':'0');if(s.fill)cell('FillForegnd',rgb(s.fill));}
   else{
    cell('LinePattern','0');cell('FillPattern','0');v.push('shp.Text = '+q(s.text));cell('Char.Font','FONT("Calibri")');cell('Char.AsianFont','FONT("Calibri")');cell('Char.Size',num(s.size*72/unit)+' pt');cell('Char.Style',s.bold?'1':'0');cell('Char.Color',rgb(s.color));
    cell('LeftMargin','0 in');cell('RightMargin','0 in');cell('TopMargin','0 in');cell('BottomMargin','0 in');cell('Para.HorzAlign',s.align==='end'?'2':s.align==='middle'?'1':'0');cell('VerticalAlign','1');
    // Use the shared measured box. The formula prevents Visio introducing line
    // breaks if its font metrics differ slightly from the browser's metrics.
    cell('TxtWidth','MAX(Width,TEXTWIDTH(TheText)+0.02 in)');cell('TxtHeight','Height');
    cell('TxtPinX',s.align==='end'?'Width':s.align==='middle'?'Width/2':'0');cell('TxtLocPinX',s.align==='end'?'TxtWidth':s.align==='middle'?'TxtWidth/2':'0');cell('TxtPinY','Height/2');cell('TxtLocPinY','TxtHeight/2');
    let offset=0;for(const r of s.runs||[]){v.push('Set chars = shp.Characters','chars.Begin = '+offset,'chars.End = '+(offset+r.text.length),'chars.CharProps(2) = '+(r.style|(s.bold?1:0)));offset+=r.text.length;}
   }
  }
  v.push('shp.NameU = '+q('WIU_'+i),'CheckError phase');
  if(nativeConnectors){
   if(s.ownerInstance){if(!nativeOwners.has(s.ownerInstance))nativeOwners.set(s.ownerInstance,[]);nativeOwners.get(s.ownerInstance).push('WIU_'+i);}
   if(s.role==='top-boundary'){
    // The top envelope is not an obstacle for all its own internal wires.
    cell('ShapePermeableX','1');cell('ShapePermeableY','1');
   }else if(s.role!=='instance'){
    cell('ShapePermeableX','1');cell('ShapePermeableY','1');
   }
  }
  if(s.groupObject){if(!netShapes.has(s.groupObject))netShapes.set(s.groupObject,[]);netShapes.get(s.groupObject).push('WIU_'+i);}
 }
 if(nativeConnectors){
  // The whole visible module becomes a movable group. Port attachment uses
  // the group's REAL Visio bounding box, not an assumed browser rectangle.
  const ownerName=new Map();let gix=0;
  for(const [instance,names] of nativeOwners){
   const groupName='WIU_MODULE_'+gix++;
   if(names.length<2)throw Error('Native Visio: module group is incomplete: '+instance);
   v.push('phase = '+q('Group module '+instance),'Set sel = app.ActiveWindow.Selection','sel.DeselectAll');
   for(const n of names)v.push('sel.Select page.Shapes.ItemU('+q(n)+'), 2');
   v.push('Set grp = sel.Group','grp.NameU = '+q(groupName),'CheckError phase');
   ownerName.set(instance,groupName);
  }
  // Glue to the module group at precisely its current port coordinate. This
  // is static glue, not gluing to the central pin of the whole module.
  for(const edge of nativeEdges){
   const c='WIU_'+edge.i;
   for(const [end,key] of [['Begin',edge.source],['End',edge.target]]){
    const pt=scene.points[key];const ownerId=key.startsWith('top::')?null:pt?.instance;
    const anchor=ownerId?ownerName.get(ownerId):('WIU_'+topIndex);
    if(!pt||!anchor)throw Error('Native Visio: missing glued owner for '+key);
    v.push('phase = '+q('Glue '+end+' '+edge.net+' ('+key+')'),
     'Set shp = page.Shapes.ItemU('+q(c)+')',
     'Set owner = page.Shapes.ItemU('+q(anchor)+')',
     // Group width/height may differ from the original rectangle because
     // the hexagon port glyphs protrude by 7 px. Use the actual Visio bbox.
     'px = ('+num(X(pt.x))+' - owner.CellsU("PinX").ResultIU + owner.CellsU("Width").ResultIU / 2) / owner.CellsU("Width").ResultIU',
     'py = ('+num(Y(pt.y))+' - owner.CellsU("PinY").ResultIU + owner.CellsU("Height").ResultIU / 2) / owner.CellsU("Height").ResultIU',
     'shp.CellsU('+q(end+'X')+').GlueToPos owner, px, py',
     'CheckError phase', 'gluedCount = gluedCount + 1');
   }
  }
  v.push('phase = "Check native connections"',
   'If gluedCount <> edgeCount * 2 Then Err.Raise 513, "WrapItfUp", "Not all connector endpoints glued"',
   'CheckError phase');
 }else{
  for(const [name,names] of netShapes){v.push('Set sel = app.ActiveWindow.Selection','sel.DeselectAll');for(const n of names)v.push('sel.Select page.Shapes.ItemU('+q(n)+'), 2');v.push('Set grp = sel.Group','grp.NameU = '+q(name),'CheckError '+q('Group '+name));}
 }
 if(nativeConnectors){
  v.push("' Native report: if GlueToPos fails, CheckError logs the net and terminal.");
 }
 v.push('If fso.FileExists(outPath) Then','  If MsgBox("Replace existing Visio file?" & vbCrLf & outPath, vbYesNo + vbQuestion, "WrapItfUp") <> vbYes Then WScript.Quit 0','End If','doc.SaveAs outPath','CheckError "Save " & outPath','app.ActiveWindow.ViewFit = 1',...(nativeConnectors?[ 
  'Set trace = fso.CreateTextFile(tracePath, True, True)',
  'trace.WriteLine "WrapItfUp r91 NATIVE CONNECTOR EXPERIMENT"',
  'trace.WriteLine "Expected native connector shapes: " & edgeCount',
  'trace.WriteLine "Endpoint glues succeeded: " & gluedCount',
  'trace.WriteLine "Move a full WIU_MODULE group; confirm every associated connector follows."',
  'trace.WriteLine "Check automatic line jumps and connector rerouting; compare fixed-geometry export."',
  'trace.Close',
  'MsgBox "Created native Visio Connector drawing:" & vbCrLf & outPath & vbCrLf & "Connectors: " & edgeCount & ", glued endpoints: " & gluedCount & vbCrLf & "Report: " & tracePath, vbInformation, "WrapItfUp r91"'
 ]:['MsgBox "Created editable Visio drawing:" & vbCrLf & outPath, vbInformation, "WrapItfUp"']),...(nativeConnectors?[
  'Sub CheckError(stepName)',
  '  If Err.Number <> 0 Then',
  '    failNo = Err.Number',
  '    failDesc = Err.Description',
  '    Err.Clear',
  '    On Error Resume Next',
  '    If Len(tracePath) > 0 Then',
  '      Set trace = fso.CreateTextFile(tracePath, True, True)',
  '      If Err.Number = 0 Then',
  '        trace.WriteLine "WrapItfUp r91 native Connector FAILED"',
  '        trace.WriteLine "Phase: " & stepName',
  '        trace.WriteLine "Error: " & failNo & " : " & failDesc',
  '        trace.WriteLine "Connectors before failure: " & edgeCount',
  '        trace.WriteLine "Glue operations before failure: " & gluedCount',
  '        trace.Close',
  '      End If',
  '    End If',
  '    MsgBox "Failed: " & stepName & vbCrLf & "Error " & failNo & ": " & failDesc & vbCrLf & "Visio result has NOT passed verification." & vbCrLf & "Report: " & tracePath, vbCritical, "WrapItfUp r91"',
  '    WScript.Quit 1',
  '  End If',
  'End Sub'
 ]:['Sub CheckError(stepName)','  If Err.Number <> 0 Then','    MsgBox "Failed: " & stepName & vbCrLf & "Error " & Err.Number & ": " & Err.Description & vbCrLf & "The new drawing has not been verified. Check the installed Visio/font environment.", vbCritical, "WrapItfUp"','    WScript.Quit 1','  End If','End Sub']));return v.join('\r\n');
}
const api={text,bounds,svg,vbs,unit};root.WIUDiagramScene=api;if(typeof module==='object')module.exports=api;
})(globalThis);
