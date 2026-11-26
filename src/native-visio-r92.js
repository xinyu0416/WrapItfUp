/* r97 live-reference routed Visio export based on Windows-tested r92 02E: scene → routed electrical graph → 1D connectors.
 * All wires are real ConnectorToolDataObject shapes with BOTH ends GlueTo
 * explicit connection point cells. Draw/group modules before connecting.
 */
(function(root){'use strict';
const R=root.WIUNativeRoutingR92||(typeof require==='function'?require('./native-routing-r92'):null);
const unit=66;
const q=s=>'"'+String(s??'').replace(/"/g,'""').replace(/[\r\n]/g,' ')+'"';
const f=x=>Number(Number(x).toFixed(6));
const rgb=c=>{const h=(/^#[0-9a-f]{6}$/i.test(c||'')?c:'#39465b').slice(1);return 'RGB('+[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(',')+')';};
function exportVbs(scene,{metadata='',name='wrapper-r92-routed',limit=Infinity}={}){
 const plan=R.build(scene,{limit});
 if(plan.issues.some(i=>['block-clearance','no-safe-route'].includes(i.type)))throw Error('Visio 路由仍有不安全的 Pad / Block 區域，請移動 Block 或檢查端點：'+plan.issues.filter(i=>['block-clearance','no-safe-route'].includes(i.type)).slice(0,4).map(i=>i.net).join(', '));
 const B=scene.bounds,X=x=>f((x-B.x)/unit),Y=y=>f((B.y+B.height-y)/unit),v=[],pos=new Map(),owners=new Map(),nodeId=new Map();
 const add=(...lines)=>v.push(...lines),cell=(key,val)=>add('shp.CellsU('+q(key)+').FormulaU = '+q(val));
 add(metadata,"' WrapItfUp r97 ROUTED NATIVE Connector export — validated 02E direct Shape reference", "' Each WIU_SEG is a 1D Visio connector; all endpoints glue to connection points.",
  "' Route guide points are 2D Visio shapes and remain movable; do not group routed connectors.",
  'Option Explicit',
  'Dim app, doc, page, fso, tracePath, outPath, shp, owner, sel, grp, chars, netLayer, phase, failNo, failDesc, ts, cpRow, localX, localY, edgeCount, glueCount, anchorCount, terminalCount',
  'On Error Resume Next',
  'Set fso = CreateObject("Scripting.FileSystemObject")',
  'tracePath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'-report.txt')+')',
  'outPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'.vsdx')+')',
  'Set ts = fso.CreateTextFile(tracePath, True, True)',
  'ts.WriteLine "WrapItfUp r97 · native routed connector diagnostic — 02E direct Shape reference"',
  'ts.WriteLine "This records VBS execution, not verified circuit functionality."',
  'ts.WriteLine '+q(`Expected: ${plan.stats.uniqueStraightSegments} unique net segments, ${plan.stats.visualBranches} graphical branches, ${plan.stats.anchorCount} guides`) ,
  'ts.Close',
  'phase = "Start Visio"',
  'Set app = CreateObject("Visio.Application")','CheckError phase',
  'app.Visible = True','Set doc = app.Documents.Add("")','CheckError "Create document"',
  'Set page = doc.Pages.Item(1)','CheckError "Get page"',
  'page.PageSheet.CellsU("PageWidth").FormulaU = '+q(f(B.width/unit)+' in'),
  'page.PageSheet.CellsU("PageHeight").FormulaU = '+q(B.height/unit+' in'),
  'page.PageSheet.CellsU("RouteStyle").FormulaU = "1"',
  'page.PageSheet.CellsU("LineJumpCode").FormulaU = "1"',
  'page.PageSheet.CellsU("LineJumpStyle").FormulaU = "1"',
  'page.PageSheet.CellsU("LineJumpFactorX").FormulaU = "0.28"',
  'page.PageSheet.CellsU("LineJumpFactorY").FormulaU = "0.28"',
  'CheckError "Configure page"',
  'app.ScreenUpdating = False',
  'CheckError "Disable screen updating"',
  'edgeCount=0','glueCount=0','anchorCount=0','terminalCount=0');
 // Index static objects exactly as the original scene does. Never pretend
 // the native jump-curve paths and original net labels are topology shapes.
 for(let i=0;i<scene.items.length;i++){
  const s=scene.items[i];
  if(['connection','wire-junction','net-label-background','net-label','net-label-legend','routing-diagnostic'].includes(s.role))continue;
  const n='WIU_'+i;pos.set(i,n);
  add('phase = '+q('Draw '+(s.role||s.type)+' ['+i+']'));
  if(s.type==='path'||s.type==='polygon'){
   const pts=s.type==='polygon'?[...s.points,s.points[0]]:s.points;
   const xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]),minX=Math.min(...xx),maxX=Math.max(...xx),minY=Math.min(...yy),maxY=Math.max(...yy);
   add(`Set shp = page.DrawRectangle(${X(minX)}, ${Y(maxY)}, ${X(Math.max(minX+.01,maxX))}, ${Y(Math.min(maxY-.01,minY))})`,
       'CheckError phase','shp.DeleteSection 10','shp.AddSection 10','shp.AddRow 10, 0, 137');
   for(let j=0;j<pts.length;j++){add('shp.AddRow 10, '+(j+1)+', '+(j===0?'138':'139'));
    cell('Geometry1.X'+(j+1),f((pts[j][0]-minX)/unit)+' in');cell('Geometry1.Y'+(j+1),f((maxY-pts[j][1])/unit)+' in');}
   cell('LineColor',rgb(s.color));cell('LineWeight',f((s.weight||1)*72/unit)+' pt');cell('FillPattern',s.fill?'1':'0');if(s.fill)cell('FillForegnd',rgb(s.fill));
  }else if(s.type==='line'){
   add(`Set shp = page.DrawLine(${X(s.x1)}, ${Y(s.y1)}, ${X(s.x2)}, ${Y(s.y2)})`);
   cell('LineColor',rgb(s.color));cell('LineWeight',f((s.weight||1)*72/unit)+' pt');cell('LinePattern',s.dash?'2':'1');
  }else if(s.type==='ellipse'){
   add(`Set shp = page.DrawOval(${X(s.x)}, ${Y(s.y+s.height)}, ${X(s.x+s.width)}, ${Y(s.y)})`);
   cell('LinePattern',s.weight>0?'1':'0');cell('LineColor',rgb(s.color));cell('LineWeight',f((s.weight||0)*72/unit)+' pt');cell('FillPattern','1');cell('FillForegnd',rgb(s.fill||s.color));
  }else{
   add(`Set shp = page.DrawRectangle(${X(s.x)}, ${Y(s.y+s.height)}, ${X(s.x+s.width)}, ${Y(s.y)})`);
   if(s.type==='rect'){
    cell('LinePattern',s.dash?'2':'1');cell('LineColor',rgb(s.color));cell('LineWeight',f((s.weight||1)*72/unit)+' pt');cell('FillPattern',s.fill?'1':'0');if(s.fill)cell('FillForegnd',rgb(s.fill));
   }else{
    cell('LinePattern','0');cell('FillPattern','0');add('shp.Text = '+q(s.text));cell('Char.Font','FONT("Calibri")');cell('Char.AsianFont','FONT("Calibri")');cell('Char.Size',f(s.size*72/unit)+' pt');cell('Char.Style',s.bold?'1':'0');cell('Char.Color',rgb(s.color));
    cell('LeftMargin','0 in');cell('RightMargin','0 in');cell('TopMargin','0 in');cell('BottomMargin','0 in');cell('Para.HorzAlign',s.align==='end'?'2':s.align==='middle'?'1':'0');cell('VerticalAlign','1');
    cell('TxtWidth','MAX(Width,TEXTWIDTH(TheText)+0.02 in)');cell('TxtHeight','Height');cell('TxtPinX',s.align==='end'?'Width':s.align==='middle'?'Width/2':'0');cell('TxtLocPinX',s.align==='end'?'TxtWidth':s.align==='middle'?'TxtWidth/2':'0');cell('TxtPinY','Height/2');cell('TxtLocPinY','TxtHeight/2');
    let offset=0;for(const run of s.runs||[]){add('Set chars = shp.Characters','chars.Begin = '+offset,'chars.End = '+(offset+run.text.length),'chars.CharProps(2) = '+(run.style|(s.bold?1:0)));offset+=run.text.length;}
   }
  }
  add('shp.NameU = '+q(n),'CheckError phase');
  if(s.ownerInstance){const a=owners.get(s.ownerInstance)||[];a.push(n);owners.set(s.ownerInstance,a);}
  if(i===scene.items.findIndex(x=>x.role==='top-boundary'))add("' WIU_TOP_BOUNDARY: connection points added below, before connectors");
 }
 add('Mark "Static shapes completed"');
 // A movable Block must include its labels/glyphs (all ownerInstance artwork).
 const ownerShapes=new Map();let groupIndex=0;
 for(const [id,names] of owners){const groupName='WIU_MODULE_'+groupIndex++;
  add('phase = '+q('Group module '+id),'Set sel = app.ActiveWindow.Selection','sel.DeselectAll');
  for(const n of names)add('sel.Select page.Shapes.ItemU('+q(n)+'), 2');
  add('Set grp = sel.Group','CheckError phase','grp.NameU = '+q(groupName),'CheckError phase');
  ownerShapes.set(id,groupName);
 }
 add('Mark "Module groups completed"');
 // Explicit stable port connection points. Each existing electrical terminal
 // gets an actual row in the 2D owner's Connection Points section.
 const terminalCP=new Map();const terminals=new Map();
 for(const node of plan.nodes)if(node.terminal){const slot=terminals.get(node.terminal);if(slot)slot.ids.push(node.id);else terminals.set(node.terminal,{node,ids:[node.id]});}
 const topIndex=scene.items.findIndex(x=>x.role==='top-boundary');
 if(topIndex<0)throw Error('Top border missing; cannot glue');
 for(const [key,entry] of terminals){const {node,ids}=entry;const p=scene.points[key];if(!p)throw Error('Port missing: '+key);
  const group=p.instance?ownerShapes.get(p.instance):pos.get(topIndex);
  if(!group)throw Error('Port owner group missing: '+key);
  const name='WIU_CP_'+terminals.size+'_'+terminalCP.size;for(const id of ids)terminalCP.set(id,name);
  add('phase = '+q('Create connection point '+key),
      'Set owner = page.Shapes.ItemU('+q(group)+')',
      'If owner.SectionExists(7,0) = 0 Then owner.AddSection 7',
      'CheckError phase',
      'cpRow = owner.AddRow(7, -2, 153)','CheckError phase',
      // Calculate point in owner's local frame ONCE; later move keeps the
      // relative CP fixed (no page/world-coordinate formula).
      'localX = '+X(node.x)+' - owner.CellsU("PinX").ResultIU + owner.CellsU("LocPinX").ResultIU',
      'localY = '+Y(node.y)+' - owner.CellsU("PinY").ResultIU + owner.CellsU("LocPinY").ResultIU',
      'owner.CellsSRC(7,cpRow,0).FormulaU = Replace(CStr(localX), ",", ".") & " in"',
      'owner.CellsSRC(7,cpRow,1).FormulaU = Replace(CStr(localY), ",", ".") & " in"',
      'CheckError phase','terminalCount = terminalCount + 1',
      // The row index is recorded on an inert variable; no page coordinates
      // are used for glue once the CP has been created.
      'Call RememberPoint('+q(name)+', '+q(group)+', cpRow)');
 }
 add('Mark "All port connection points created"');
 // Visio layers provide net-level selection/hide without grouping live glued
 // connectors (grouping wires can break pin glue and autorouting).
 const netNames=[...new Set(plan.edges.map(e=>e.net))].sort();
 for(const name of netNames){
  add('phase = '+q('Create net layer '+name),
      'Set netLayer = page.Layers.Add('+q('WIU_NET_'+name)+')',
      'CheckError phase');
 }
 add('Mark "Net layers created"');
 // Guide nodes are actual Visio 2D objects with a real center connection point.
 // Only branch nodes (degree >= 3) are visible filled dots.
 let guide=0;
 for(const node of plan.nodes){if(node.terminal)continue;const visible=node.degree>=3,diam=visible?6.5:1.6;
  const id='WIU_GUIDE_'+guide++;nodeId.set(node.id,id);
  add('phase = '+q('Create '+(visible?'junction':'bend')+' guide '+guide+' '+node.net),
      `Set shp = page.DrawOval(${X(node.x-diam/2)}, ${Y(node.y+diam/2)}, ${X(node.x+diam/2)}, ${Y(node.y-diam/2)})`,
      'CheckError phase','shp.NameU = '+q(id));
  cell('LinePattern','0');cell('FillPattern',visible?'1':'0');
  if(visible)cell('FillForegnd',rgb(scene.style?.monochrome?'#222222':'#39465b'));
  // Small invisible point is non-obstructing; Visio may still recognize it as
  // a shape during rerouting. Its location is intended as an editable waymark.
  add('If shp.SectionExists(7,0) = 0 Then shp.AddSection 7',
      'cpRow = shp.AddRow(7, -2, 153)',
      'shp.CellsSRC(7,cpRow,0).FormulaU = "Width/2"',
      'shp.CellsSRC(7,cpRow,1).FormulaU = "Height/2"',
      'CheckError phase',
      'Set netLayer = page.Layers.ItemU('+q('WIU_NET_'+node.net)+')',
      'netLayer.Add shp, 1', 'CheckError phase','anchorCount = anchorCount + 1',
      'Call RememberPoint('+q('WIU_CP_GUIDE_'+guide)+', '+q(id)+', cpRow)');
 }
 add('Mark "All guide connection points created"');
 const guideRefs=new Map([...nodeId.keys()].map((id,k)=>[id,'WIU_CP_GUIDE_'+(k+1)]));
 const refNode=node=>node.terminal?terminalCP.get(node.id):guideRefs.get(node.id);
 // Maps above also have a stable ordinal; no generated script indexes by geometry.
 const nodeMap=new Map(plan.nodes.map(n=>[n.id,n]));
 let idx=0;const labelChoices=new Map();
 const netColor=new Map(plan.routes.map(r=>[r.net,r.color||'#64758b']));
  for(const s of plan.edges){const len=Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y),horizontal=s.a.y===s.b.y;
  const best=labelChoices.get(s.net);if(horizontal&&(!best||len>best.len))labelChoices.set(s.net,{key:s.key,len});}
 for(const s of plan.edges){const na=s.net+'|'+R.clean([s.a])[0].x+','+R.clean([s.a])[0].y,nb=s.net+'|'+R.clean([s.b])[0].x+','+R.clean([s.b])[0].y;
  const a=nodeMap.get(na),b=nodeMap.get(nb);if(!a||!b)throw Error('Atomic segment point missing: '+s.net);
  const ra=refNode(a),rb=refNode(b);if(!ra||!rb)throw Error('Native connection point reference missing: '+s.net+' A '+na+' ('+ra+') B '+nb+' ('+rb+')');
  const mx=(s.a.x+s.b.x)/2,my=(s.a.y+s.b.y)/2,tag='WIU_SEG_'+idx;
  // Direction belongs to the visible I/O pad, not to the connector.
  add('phase = '+q('Draw connector '+idx+' '+s.net),
      'Set shp = page.Drop(app.ConnectorToolDataObject, '+X(mx)+', '+Y(my)+')',
      'CheckError phase', 'shp.NameU = '+q(tag),
      'shp.CellsU("ShapeRouteStyle").FormulaU = "2"',
      'shp.CellsU("LineColor").FormulaU = '+q(rgb(scene.style?.monochrome?'#333333':netColor.get(s.net))),
      'shp.CellsU("LineWeight").FormulaU = "1.25 pt"',
      'shp.CellsU("BeginArrow").FormulaU = '+q('0'),
      'shp.CellsU("EndArrow").FormulaU = '+q('0'),
      'shp.CellsU("FillPattern").FormulaU = "0"',
      'shp.CellsU("Geometry1.NoFill").FormulaU = "TRUE"',
      'CheckError phase',
      'Set netLayer = page.Layers.ItemU('+q('WIU_NET_'+s.net)+')',
      'netLayer.Add shp, 1', 'CheckError phase',
      'Call GluePoint('+q(tag)+', "BeginX", '+q(ra)+')',
      'Call GluePoint('+q(tag)+', "EndX", '+q(rb)+')',
      'edgeCount = edgeCount + 1');
  const label=labelChoices.get(s.net);
  if(scene.style?.showWireNames&&label?.key===s.key&&label.len>Math.max(115,s.net.length*7.5)){
   add('shp.Text = '+q(s.net),
       'shp.CellsU("Char.Font").FormulaU = '+q('FONT("Calibri")'),
       'shp.CellsU("Char.Size").FormulaU = "9 pt"',
       'shp.CellsU("TxtWidth").FormulaU = "TEXTWIDTH(TheText)+0.10 in"',
       'shp.CellsU("TxtHeight").FormulaU = "0.24 in"',
       'CheckError phase');
   labelChoices.delete(s.net);
  }
  idx++;
  if(idx%25===0)add('Mark '+q('Native connectors '+idx+'/'+plan.edges.length));
 }
 add('Mark "All routed connectors glued"',
  'phase = "Validate endpoint count"',
  'If edgeCount <> '+plan.edges.length+' Or glueCount <> '+(plan.edges.length*2)+' Then Err.Raise 513, "WrapItfUp", "Missing native segment or endpoint"',
  'CheckError phase',
  'app.ScreenUpdating = True',
  'CheckError "Enable screen updating"',
  'If fso.FileExists(outPath) Then',
  ' If MsgBox("Replace existing Visio file?" & vbCrLf & outPath, vbYesNo + vbQuestion, "WrapItfUp") <> vbYes Then WScript.Quit 0',
  'End If','phase = "Save drawing"','doc.SaveAs outPath','CheckError phase',
  'app.ActiveWindow.ViewFit = 1',
  'Mark "Saved successfully; inspect Visio visually"',
  'MsgBox '+q('Native routed Visio generated. Connectors: '+plan.edges.length+', glues: '+(plan.edges.length*2)+'.')+' & vbCrLf & "Please visually inspect routes and move a Block to verify pin glue." & vbCrLf & "Log: " & tracePath, vbInformation, "WrapItfUp r97"',
  'Sub RememberPoint(tag, ownerName, rowIndex)',
  ' Dim entry',
  ' If pointStore Is Nothing Then Set pointStore = CreateObject("Scripting.Dictionary")',
  ' pointStore.Add tag, Array(ownerName, rowIndex)',
  'End Sub',
  'Sub GluePoint(edgeShapeName, endCell, tag)',
  ' Dim arr, pinOwner, wire, pinCell, afterCount',
  ' phase = "Glue " & edgeShapeName & " " & endCell & " " & tag',
  ' If Not pointStore.Exists(tag) Then Err.Raise 514, "WrapItfUp", "Unknown connection point " & tag',
  ' CheckError phase',
  ' arr = pointStore.Item(tag)',
  ' Set pinOwner = page.Shapes.ItemU(CStr(arr(0)))',
  ' CheckError phase & " / owner shape"',
  ' Set wire = shp',
  ' CheckError phase & " / live connector reference"',
  ' If wire Is Nothing Then Err.Raise 515, "WrapItfUp", "The live connector reference is Nothing"',
  ' CheckError phase & " / non-null live connector"',
  ' Set pinCell = pinOwner.CellsSRC(7, CLng(arr(1)), 0)',
  ' CheckError phase & " / connection point cell"',
  ' If glueCount < 4 Then',
  '  Mark "DIRECT connector: expected=" & edgeShapeName & " actual=" & wire.NameU & " shapeID=" & CStr(wire.ID) & " CP row=" & CStr(arr(1))',
  '  CheckError phase & " / diagnostic live shape"',
  ' End If',
  ' wire.CellsU(endCell).GlueTo pinCell',
  ' CheckError phase & " / actual Cell.GlueTo"',
  ' If glueCount < 4 Then',
  '  afterCount = wire.Connects.Count',
  '  CheckError phase & " / read actual Connects"',
  '  Mark "AFTER glue: edge=" & edgeShapeName & " end=" & endCell & " connects=" & CStr(afterCount)',
  ' End If',
  ' glueCount = glueCount + 1',
  'End Sub',
  'Sub Mark(message)',
  ' Dim logfile',
  ' Set logfile = fso.OpenTextFile(tracePath, 8, True, -1)',
  ' logfile.WriteLine Now & " | " & message & " | segments=" & edgeCount & " glues=" & glueCount',
  ' logfile.Close',
  'End Sub',
  'Sub CheckError(stepName)',
  ' If Err.Number <> 0 Then',
  '  failNo = Err.Number : failDesc = Err.Description : Err.Clear',
  '  On Error Resume Next',
  '  If Not (app Is Nothing) Then app.ScreenUpdating = True',
  '  Err.Clear',
  '  Mark "FAILED " & stepName & " | " & failNo & " " & failDesc',
  '  MsgBox "Failed: " & stepName & vbCrLf & "Error " & failNo & ": " & failDesc & vbCrLf & "See " & tracePath, vbCritical, "WrapItfUp r97"',
  '  WScript.Quit 1',
  ' End If',
  'End Sub');
 // Required by Option Explicit; declare as script-level dictionary.
 v.splice(v.findIndex(x=>x.startsWith('Dim app, doc'))+1,0,'Dim pointStore','Set pointStore = CreateObject("Scripting.Dictionary")');
 return {vbs:v.join('\r\n'),plan};
}
const api={exportVbs};root.WIUNativeVisioR92=api;if(typeof module==='object')module.exports=api;
})(globalThis);
