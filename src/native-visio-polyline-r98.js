/* r97 live-reference routed Visio export based on Windows-tested r92 02E: scene → routed electrical graph → 1D connectors.
 * All wires are real ConnectorToolDataObject shapes with BOTH ends GlueTo
 * explicit connection point cells. Draw/group modules before connecting.
 */
(function(root){'use strict';
const R=root.WIUNativeRoutingR92||(typeof require==='function'?require('./native-routing-r92'):null);
const CP=root.WIUNativePolylineR98||(typeof require==='function'?require('./native-polyline-r98'):null);
const JP=root.WIUSharedJumpPlanR104||(typeof require==='function'?require('./shared-jump-plan-r104'):null);
const Live=root.WIUVisioLiveGeometryR105||(typeof require==='function'?require('./visio-live-geometry-r105'):null);
const unit=66;
const q=s=>'"'+String(s??'').replace(/"/g,'""').replace(/[\r\n]/g,' ')+'"';
const f=x=>Number(Number(x).toFixed(6));
const rgb=c=>{const h=(/^#[0-9a-f]{6}$/i.test(c||'')?c:'#39465b').slice(1);return 'RGB('+[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)).join(',')+')';};
function exportVbs(scene,{metadata='',name='wrapper-r109-pad-glued',limit=Infinity}={}){
 const plan=R.build(scene,{limit}),chains=CP.chains(plan),jumps=JP.project(scene,chains,{partial:Number.isFinite(limit)});
 // Preview export is allowed with explicit diagnostics; never label it as verified.
 const safetyIssues=plan.issues.filter(i=>['block-clearance','no-safe-route','wire-spacing'].includes(i.type));
 const B=scene.bounds,X=x=>f((x-B.x)/unit),Y=y=>f((B.y+B.height-y)/unit),v=[],pos=new Map(),owners=new Map(),nodeId=new Map(),overlays=[];
 const add=(...lines)=>v.push(...lines),cell=(key,val)=>add('shp.CellsU('+q(key)+').FormulaU = '+q(val));
 const portRoles=new Set(['directional-port','port-name','top-port-name','port-comment','open','unconfigured']);
 const ports=new Map(),portIndex=new Map();
 for(let i=0;i<scene.items.length;i++){
  const item=scene.items[i];if(!item.key||!scene.points[item.key]||!portRoles.has(item.role))continue;
  if(!ports.has(item.key))ports.set(item.key,{key:item.key,point:scene.points[item.key],indices:[],glyph:null,ordinal:ports.size});
  const record=ports.get(item.key);record.indices.push(i);if(item.role==='directional-port')record.glyph=i;portIndex.set(i,record);
 }
 for(const record of ports.values()){
  if(record.glyph==null)throw Error('Pad glyph missing: '+record.key);
  record.name='WIU_PORT_'+record.ordinal;record.pad='WIU_PAD_'+record.ordinal;record.cp='WIU_CP_PAD_'+record.ordinal;
 }
 const topLevel=new Set(),motionSamples=new Map();let geometryVertices=0;
 add(metadata,"' WrapItfUp r109 native 1D polyline export — Windows Visio remains unverified", "' Each WIU_CHAIN is ONE 1D connector; intermediate corners are Geometry1 rows.",
  "' Route guide points are 2D Visio shapes and remain movable; do not group routed connectors.",
  "' WIU_SHARED_JUMP_PLAN: "+jumps.mapped.length+" physical jumps embedded in 1D Geometry; no Visio auto-jump dependency.",
  'Option Explicit', 
  'Dim app, doc, page, fso, tracePath, outPath, shp, owner, sel, grp, chars, netLayer, phase, failNo, failDesc, ts, cpRow, localX, localY, geomRow, firstGeomRow, edgeCount, glueCount, anchorCount, terminalCount, shapeAuditCount, auditFailures, auditChecks',
  'On Error Resume Next',
  'Set fso = CreateObject("Scripting.FileSystemObject")',
  'tracePath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'-report.txt')+')',
  'outPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), '+q(name+'.vsdx')+')',
  'Set ts = fso.CreateTextFile(tracePath, True, True)',
  'ts.WriteLine "WrapItfUp r109 · native Visio 1D routes / z-order / layout integrity"',
  'ts.WriteLine "This records VBS execution, not verified circuit functionality."',
  'ts.WriteLine '+q(`Expected: ${chains.length} 1D chain shapes, ${plan.stats.uniqueStraightSegments} logical atomic strokes, ${plan.stats.visualBranches} branches`) ,
  'ts.Close',
  (safetyIssues.length ? "' NON-BLOCKING VISUAL WARNINGS: "+safetyIssues.length+". See the generated report; the drawing is not Visio-certified." : "' No route warning"),
  'phase = "Start Visio"',
  'Set app = CreateObject("Visio.Application")','CheckError phase',
  'app.Visible = True','Set doc = app.Documents.Add("")','CheckError "Create document"',
  'Set page = doc.Pages.Item(1)','CheckError "Get page"',
  'page.PageSheet.CellsU("PageWidth").FormulaU = '+q(f(B.width/unit)+' in'),
  'page.PageSheet.CellsU("PageHeight").FormulaU = '+q(B.height/unit+' in'),
  'page.PageSheet.CellsU("RouteStyle").FormulaU = "1"',
  'page.PageSheet.CellsU("LineJumpCode").FormulaU = "0"',
  'page.PageSheet.CellsU("LineJumpStyle").FormulaU = "1"',
  'page.PageSheet.CellsU("LineJumpFactorX").FormulaU = "0.28"',
  'page.PageSheet.CellsU("LineJumpFactorY").FormulaU = "0.28"',
  'CheckError "Configure page"',
  "' Keep the exact website's manually editable routes; Visio must not silently auto-reroute or eat corners during GlueTo / SaveAs.",
  'page.LayoutRoutePassive = True',
  'CheckError "Disable Visio automatic rerouting"',
  'app.ScreenUpdating = False',
  'CheckError "Disable screen updating"',
  'edgeCount=0','glueCount=0','anchorCount=0','terminalCount=0','auditFailures=0','auditChecks=0');
 if(safetyIssues.length)add('Mark '+q('WARNING: '+JSON.stringify(safetyIssues.slice(0,20))));
 // Index static objects exactly as the original scene does. Never pretend
 // the native jump-curve paths and original net labels are topology shapes.
 for(let i=0;i<scene.items.length;i++){
  const s=scene.items[i];
  if(['connection','wire-junction','routing-diagnostic'].includes(s.role))continue;
  const pr=portIndex.get(i),n=pr?.glyph===i?pr.pad:'WIU_'+i;pos.set(i,n);topLevel.add(n);
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
   cell('LineColor',rgb(s.color));cell('LineWeight',f((s.weight||1)*72/unit)+' pt');cell('LinePattern',s.dash?'2':'1');cell('FillPattern','0');cell('Geometry1.NoFill','TRUE');
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
  add('shp.NameU = '+q(n),'shapeStore.Add '+q(n)+', shp','CheckError phase');
  if(pr)continue; // pad, label, comments are grouped first, then placed inside the Module group.
  if(s.ownerInstance){const a=owners.get(s.ownerInstance)||[];a.push(n);owners.set(s.ownerInstance,a);}
  else if(['net-label-background','net-label','net-label-legend','wire-legend-title','top-port-name','port-comment','directional-port','group-name','group-header','annotation','top-name','top-parameter'].includes(s.role))overlays.push({name:n,role:s.role});
  if(i===scene.items.findIndex(x=>x.role==='top-boundary'))add("' WIU_TOP_BOUNDARY: connection points added below, before connectors");
 }
 add('Mark "Static shapes completed"');
 // A real inward connection point belongs to EACH visible pad, including NC
 // and currently unconnected pads. It is not placed on the Top border/Module.
 for(const record of ports.values()){
  const item=scene.items[record.glyph],xs=item.points.map(p=>p[0]),ys=item.points.map(p=>p[1]),p=record.point;
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),fx=(p.x-x0)/(x1-x0),fy=(y1-p.y)/(y1-y0);
  if(fx < -1e-6||fx>1+1e-6||fy<0||fy>1)throw Error('Connection point outside pad outline: '+record.key);
  add("' WIU_PAD_INFO "+JSON.stringify({key:record.key,pad:record.pad,group:record.name,owner:p.instance||null,cp:record.cp,members:record.indices.map(i=>pos.get(i)),x:p.x,y:p.y}),
   'phase = '+q('Create pad connection point '+record.key),
   'Set owner = shapeStore.Item('+q(record.pad)+')',
   'CheckError phase & " / get pad shape"',
   'If owner.SectionExists(7,0) = 0 Then owner.AddSection 7',
   'CheckError phase & " / ensure Connection Points section"',
   // Microsoft VisRowTags: AddNamedRow requires visTagCnnctNamed (185).
   // The anonymous guide rows below are correctly created with visTagCnnctPt (153).
   'cpRow = owner.AddNamedRow(7, "Wire", 185)',
   'CheckError phase & " / AddNamedRow(Wire, 185)"',
   'If owner.RowType(7,cpRow) <> 185 Then Err.Raise 519, "WrapItfUp", "Unexpected Wire row type"',
   'CheckError phase & " / verify named Wire row"',
   'owner.CellsSRC(7,cpRow,0).FormulaU = '+q('Width*'+f(fx)),
   'CheckError phase & " / set Wire.X"',
   'owner.CellsSRC(7,cpRow,1).FormulaU = '+q('Height*'+f(fy)),
   'CheckError phase & " / set Wire.Y"',
   'owner.CellsSRC(7,cpRow,2).FormulaU = '+q(p.side==='left'?'-1':'1'),
   'CheckError phase & " / set Wire.DirX"',
   'owner.CellsSRC(7,cpRow,3).FormulaU = "0"',
   'CheckError phase & " / set Wire.DirY"',
   'owner.CellsSRC(7,cpRow,4).FormulaU = "0"',
   'CheckError phase & " / set Wire.Type"',
   'terminalCount = terminalCount + 1',
   'Call RememberPoint('+q(record.cp)+', '+q(record.pad)+', cpRow)',
   'CheckError phase & " / remember Wire row"',
   'phase = '+q('Group pad and label '+record.key),
   'Set sel = app.ActiveWindow.Selection','sel.DeselectAll');
  for(const i of record.indices){add('sel.Select shapeStore.Item('+q(pos.get(i))+'), 2');topLevel.delete(pos.get(i));}
  add('Set grp = sel.Group','CheckError phase','grp.NameU = '+q(record.name),
   'grp.CellsU("SelectMode").FormulaU = "1"',
   'grp.CellsU("FillPattern").FormulaU = "0"',
   'shapeStore.Add '+q(record.name)+', grp','CheckError phase');
  topLevel.add(record.name);
  if(p.instance){const names=owners.get(p.instance)||[];names.push(record.name);owners.set(p.instance,names);}
  else overlays.push({name:record.name,role:'port-assembly'});
 }
 add('Mark "Pad connection points and port groups completed"');
 // Nested hierarchy: Module {block, headers, PORT {pad, signal label, comment}}.
 const ownerShapes=new Map();let groupIndex=0;
 for(const [id,names] of owners){const groupName='WIU_MODULE_'+groupIndex++;
  add('phase = '+q('Group module '+id),'Set sel = app.ActiveWindow.Selection','sel.DeselectAll');
  for(const n of names){add('sel.Select shapeStore.Item('+q(n)+'), 2');topLevel.delete(n);}
  add('Set grp = sel.Group','CheckError phase','grp.NameU = '+q(groupName),
   'grp.CellsU("SelectMode").FormulaU = "1"',
   'grp.CellsU("FillPattern").FormulaU = "0"',
   'shapeStore.Add '+q(groupName)+', grp','CheckError phase');
  ownerShapes.set(id,groupName);topLevel.add(groupName);
 }
 add('Mark "Module groups completed"');
 // Keep live Shape references across grouping: page.Shapes cannot look up a
 // nested pad by its top-level name after Module/Port grouping.
 const terminalCP=new Map();
 for(const node of plan.nodes)if(node.terminal){
  const port=ports.get(node.terminal);if(!port)throw Error('Native terminal has no pad: '+node.terminal);
  if(Math.hypot(port.point.x-node.x,port.point.y-node.y)>.01)throw Error('Native terminal/pad position mismatch: '+node.terminal);
  terminalCP.set(node.id,port.cp);
 }
 const topIndex=scene.items.findIndex(x=>x.role==='top-boundary');
 if(topIndex<0)throw Error('Top border missing');
 add('Mark "All port connection points mapped to pad shapes"');
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
 const chainGuideEnds=new Set(chains.flatMap(c=>[c.begin.id,c.end.id]));
 for(const node of plan.nodes){if(node.terminal||(node.degree===2&&!chainGuideEnds.has(node.id)))continue;const visible=node.degree>=3,diam=visible?6.5:1.6;
  const id='WIU_GUIDE_'+guide++;nodeId.set(node.id,id);
  add('phase = '+q('Create '+(visible?'junction':'bend')+' guide '+guide+' '+node.net),
      `Set shp = page.DrawOval(${X(node.x-diam/2)}, ${Y(node.y+diam/2)}, ${X(node.x+diam/2)}, ${Y(node.y-diam/2)})`,
      'CheckError phase','shp.NameU = '+q(id),'shapeStore.Add '+q(id)+', shp');
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
 let idx=0;
 const netColor=new Map(plan.routes.map(r=>[r.net,r.color||'#64758b']));
 const netWidth=new Map(scene.items.filter(i=>i.role==='connection').map(i=>[i.net,i.weight]));
 const longest=new Map();
 for(const chain of chains){const len=chain.points.slice(1).reduce((n,p,i)=>n+(Math.abs(p.y-chain.points[i].y)<.001?Math.abs(p.x-chain.points[i].x):0),0);
  if(!longest.has(chain.net)||longest.get(chain.net).len<len)longest.set(chain.net,{chain,len});}
 for(const chain of chains){
  const a=chain.begin,b=chain.end,ra=refNode(a),rb=refNode(b);
  if(!ra||!rb)throw Error('Unmapped native 1D endpoint: '+chain.net);
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,tag='WIU_CHAIN_'+idx;
  add('phase = '+q('Create 1D polyline '+idx+' '+chain.net),
      'Set shp = page.Drop(app.ConnectorToolDataObject, '+X(mx)+', '+Y(my)+')',
      'CheckError phase', 'shp.NameU = '+q(tag),'shapeStore.Add '+q(tag)+', shp',
      'shp.CellsU("BeginX").FormulaU = '+q(X(a.x)+' in'),
      'shp.CellsU("BeginY").FormulaU = '+q(Y(a.y)+' in'),
      'shp.CellsU("EndX").FormulaU = '+q(X(b.x)+' in'),
      'shp.CellsU("EndY").FormulaU = '+q(Y(b.y)+' in'),
      'shp.CellsU("LineColor").FormulaU = '+q(rgb(scene.style?.monochrome?'#333333':netColor.get(chain.net))),
      'shp.CellsU("LineWeight").FormulaU = '+q(f((netWidth.get(chain.net)??1.3)*72/unit)+' pt'),
      'shp.CellsU("BeginArrow").FormulaU = "0"',
      'shp.CellsU("EndArrow").FormulaU = "0"',
      'shp.CellsU("FillPattern").FormulaU = "0"',
      'shp.CellsU("ShdwPattern").FormulaU = "0"',
      'shp.CellsU("ConFixedCode").FormulaU = "2"',
      'shp.CellsU("ConLineJumpCode").FormulaU = "1"',
      'CheckError phase',
      'Set netLayer = page.Layers.ItemU('+q('WIU_NET_'+chain.net)+')',
      'netLayer.Add shp, 1', 'CheckError phase',
      'Call GluePoint('+q(tag)+', "BeginX", '+q(ra)+', '+q(a.terminal||chain.net)+')',
      'Call GluePoint('+q(tag)+', "EndX", '+q(rb)+', '+q(b.terminal||chain.net)+')',
      // VBScript has no typed SAFEARRAY(Double) required by Page.DrawPolyline;
      // use verified ShapeSheet row constants 138=MoveTo and 139=LineTo.
      'phase = '+q('Write multi-corner Geometry1 '+idx),
      'If shp.SectionExists(10,0) <> 0 Then shp.DeleteSection 10',
      'CheckError phase',
      'shp.AddSection 10','CheckError phase','shp.AddRow 10, 0, 137','CheckError phase',
      'shp.CellsU("Geometry1.NoFill").FormulaU = "TRUE"',
      'shp.CellsU("Geometry1.NoLine").FormulaU = "FALSE"',
      'CheckError phase');
  // The visible geometry, not just BeginX/EndX, must respond to glue.
  // Expressions are editable ShapeSheet formulas; no GUIDs, timers or macros.
  const live=Live.model(chain.points,jumps.rendered[idx]),drawn=live.vertices;
  add("' WIU_LIVE_CHAIN "+JSON.stringify({name:tag,net:chain.net,begin:ra,end:rb,vertices:drawn.length,straightSplit:live.straightSplit}),
   'If shp.SectionExists(242,0) = 0 Then shp.AddSection 242');
  for(const [suffix,value] of [['BX',X(a.x)],['BY',Y(a.y)],['EX',X(b.x)],['EY',Y(b.y)]]){
   add('shp.AddNamedRow 242, '+q('WIU_'+suffix+'0')+', 0');cell('User.WIU_'+suffix+'0',value+' in');
   add('shp.AddNamedRow 242, '+q('WIU_d'+suffix)+', 0');cell('User.WIU_d'+suffix,(suffix[0]==='B'?'Begin':'End')+suffix[1]+'-User.WIU_'+suffix+'0');
  }
  for(let n=0;n<drawn.length;n++){
    const p=drawn[n],form=Live.formulas(p,X,Y);add('geomRow=shp.AddRow(10,-2,'+(n===0?138:139)+')',
      ...(n===0?['firstGeomRow=geomRow']:[]),
      'shp.CellsSRC(10,geomRow,0).FormulaU = '+q(form.x),
      'shp.CellsSRC(10,geomRow,1).FormulaU = '+q(form.y),
      'CheckError phase');
  }
  geometryVertices+=drawn.length;
  add('Call RememberWire('+q(tag)+','+q(ra)+','+q(rb)+',firstGeomRow,geomRow)');
  for(const n of [a,b])if(n.terminal){const p=ports.get(n.terminal),category=p.point.instance?'nested-pad':'top-pad';
   if(!motionSamples.has(category))motionSamples.set(category,{shape:p.name,wire:tag});
   if(p.point.instance&&!motionSamples.has('module'))motionSamples.set('module',{shape:ownerShapes.get(p.point.instance),wire:tag});
  }
  const label=longest.get(chain.net);
  if(scene.style?.showWireNames&&label?.chain===chain&&label.len>Math.max(115,chain.net.length*7.5)){
    add('shp.Text = '+q(chain.net),
      'shp.CellsU("Char.Font").FormulaU = '+q('FONT("Calibri")'),
      'shp.CellsU("Char.Size").FormulaU = "9 pt"',
      'CheckError phase');
  }
  add('If shp.RowCount(10) < '+(drawn.length+1)+' Then Err.Raise 516, "WrapItfUp", "Incomplete connector geometry: '+tag+'"',
      'CheckError '+q('Validate polyline vertices '+tag),
      'If shp.Connects.Count < 2 Then Err.Raise 517, "WrapItfUp", "Missing GlueTo connection: '+tag+'"',
      'CheckError '+q('Validate connector glue '+tag),
      'edgeCount = edgeCount + 1');idx++;
  if(idx%25===0)add('Mark '+q('Native 1D polylines '+idx+'/'+chains.length));
 }
 // Restore the intended visual stack after all live connectors and guides are created.
 // Merely placing shapes on Layers does NOT set their z-order. In particular,
 // module port glyphs and net-label white masks must stay above connectors.
 // Keep the giant white Top boundary BEHIND the connectors, never at the front.
 add('phase = "Restore Top boundary Z-order"',
     'page.Shapes.ItemU('+q(pos.get(topIndex))+').SendToBack',
     'CheckError phase');
 for(const name of ownerShapes.values())add('phase = '+q('Bring module ahead of wires '+name),'page.Shapes.ItemU('+q(name)+').BringToFront','CheckError phase');
 for(const node of plan.nodes){if(node.degree>=3&&!node.terminal&&nodeId.has(node.id)){
   const name=nodeId.get(node.id);
   add('phase = '+q('Bring junction dot ahead of wires '+name),'page.Shapes.ItemU('+q(name)+').BringToFront','CheckError phase');
 }}
 // White label masks, labels, Top port symbols and annotations are above lines.
 for(const overlay of overlays){
  add('phase = '+q('Bring overlay '+overlay.role+' '+overlay.name),
      'page.Shapes.ItemU('+q(overlay.name)+').BringToFront',
      'CheckError phase');
 }
 const expectedTopShapes=topLevel.size+guide+chains.length;
 add('phase = "Check Visio page inventory"',
     'shapeAuditCount = page.Shapes.Count',
     'Mark "Inventory: expected top-level shapes '+expectedTopShapes+', actual=" & CStr(shapeAuditCount)',
     'If shapeAuditCount <> '+expectedTopShapes+' Then Err.Raise 518, "WrapItfUp", "Incomplete drawing: expected '+expectedTopShapes+' Visio shapes, got " & CStr(shapeAuditCount)',
     'CheckError phase');
 // Runtime self-checks run in the user's actual Visio, with temporary moves
 // restored before display/save. They log warnings rather than block export.
 add('phase = "Audit all connector fill, glue targets and visible endpoints"','Call AuditAllWires("initial")');
 for(const [category,sample] of motionSamples)add('Call ProbeMove('+q(category)+','+q(sample.shape)+','+q(sample.wire)+')');
 add('Call AuditAllWires("restored")','Mark "R107 SELF-CHECK checks=" & auditChecks & " failures=" & auditFailures');
 add('Mark "All routed connectors glued"',
  'phase = "Validate endpoint count"',
  'If edgeCount <> '+chains.length+' Or glueCount <> '+(chains.length*2)+' Then Err.Raise 513, "WrapItfUp", "Missing 1D chain or endpoint"',
  'CheckError phase',
  'app.ScreenUpdating = True',
  'CheckError "Enable screen updating"',
  'If fso.FileExists(outPath) Then',
  ' If MsgBox("Replace existing Visio file?" & vbCrLf & outPath, vbYesNo + vbQuestion, "WrapItfUp") <> vbYes Then WScript.Quit 0',
  'End If','phase = "Save drawing"','doc.SaveAs outPath','CheckError phase',
  'app.ActiveWindow.ViewFit = 1',
  'Mark "Saved successfully; inspect Visio visually"',
  'MsgBox '+q('WrapItfUp drawing generated. Pad groups: '+ports.size+', 1D connectors: '+chains.length+'.')+' & vbCrLf & "Runtime self-check warnings: " & auditFailures & vbCrLf & "Log: " & tracePath, vbInformation, "WrapItfUp r109"',
  'Sub RememberPoint(tag, ownerName, rowIndex)',
  ' Dim entry',
  ' If pointStore Is Nothing Then Set pointStore = CreateObject("Scripting.Dictionary")',
  ' pointStore.Add tag, Array(ownerName, rowIndex)',
  'End Sub',
  'Sub GluePoint(edgeShapeName, endCell, tag, terminalKey)',
  // Error handling is procedure-local in VBScript. Check a failed GlueTo here
  // before execution can return to the caller and lose its terminal context.
  ' On Error Resume Next',
  ' Dim arr, pinOwner, wire, pinCell, afterCount',
  ' phase = "Glue " & edgeShapeName & " " & endCell & " " & tag & " " & terminalKey',
  ' If Not pointStore.Exists(tag) Then Err.Raise 514, "WrapItfUp", "Unknown connection point " & tag',
  ' CheckError phase',
  ' arr = pointStore.Item(tag)',
  ' Set pinOwner = shapeStore.Item(CStr(arr(0)))',
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
  "Sub RememberWire(tag, beginTag, endTag, firstRow, lastRow)",
  " wireStore.Add tag, Array(beginTag, endTag, firstRow, lastRow)",
  "End Sub",
  "Function EndpointError(wire, endCell, pointTag, rowIndex)",
  " On Error Resume Next",
  " Dim cpData, pad, cpX, cpY, px, py, gx, gy, lx, ly, ex, ey, link, matched, detail",
  " detail = \"\" : matched = False",
  " cpData = pointStore.Item(pointTag)",
  " Set pad = shapeStore.Item(CStr(cpData(0)))",
  " cpX = pad.CellsSRC(7, CLng(cpData(1)), 0).ResultIU",
  " cpY = pad.CellsSRC(7, CLng(cpData(1)), 1).ResultIU",
  " pad.XYToPage CDbl(cpX), CDbl(cpY), px, py",
  " ex = wire.CellsU(endCell).ResultIU",
  " ey = wire.CellsU(Replace(endCell,\"X\",\"Y\")).ResultIU",
  " lx = wire.CellsSRC(10, CLng(rowIndex), 0).ResultIU",
  " ly = wire.CellsSRC(10, CLng(rowIndex), 1).ResultIU",
  " wire.XYToPage CDbl(lx), CDbl(ly), gx, gy",
  " If Err.Number <> 0 Then",
  "  EndpointError = \"API error \" & CStr(Err.Number) & \": \" & Err.Description",
  "  Err.Clear",
  "  Exit Function",
  " End If",
  " If Abs(ex-px)+Abs(ey-py)>0.00002 Then detail = detail & \" endpoint != pad CP;\"",
  " If Abs(gx-px)+Abs(gy-py)>0.00002 Then detail = detail & \" visible path != pad CP;\"",
  " For Each link In wire.Connects",
  "  If link.FromCell.NameU = endCell Then",
  "   If link.ToSheet.ID = pad.ID Then",
  "    If link.ToCell.NameU = pad.CellsSRC(7, CLng(cpData(1)), 0).NameU Then matched = True",
  "   End If",
  "  End If",
  " Next",
  " If Not matched Then detail = detail & \" missing actual pad GlueTo record;\"",
  " If Err.Number <> 0 Then detail = detail & \" Connects API error \" & Err.Description",
  " Err.Clear",
  " EndpointError = detail",
  "End Function",
  "Sub AuditWire(tag, stage)",
  " On Error Resume Next",
  " Dim wire, data, issueA, issueB, fillIssue",
  " Set wire = shapeStore.Item(tag)",
  " data = wireStore.Item(tag)",
  " fillIssue = \"\"",
  " If wire.OneD = 0 Then fillIssue = fillIssue & \"not 1D;\"",
  " If wire.CellsU(\"FillPattern\").ResultIU <> 0 Then fillIssue = fillIssue & \"FillPattern not 0;\"",
  " If wire.CellsU(\"Geometry1.NoFill\").ResultIU = 0 Then fillIssue = fillIssue & \"Geometry allows fill;\"",
  " If Err.Number <> 0 Then fillIssue = fillIssue & \" API error \" & Err.Description",
  " Err.Clear",
  " issueA = EndpointError(wire, \"BeginX\", CStr(data(0)), CLng(data(2)))",
  " issueB = EndpointError(wire, \"EndX\", CStr(data(1)), CLng(data(3)))",
  " auditChecks = auditChecks + 1",
  " If Len(fillIssue & issueA & issueB) > 0 Then",
  "  auditFailures = auditFailures + 1",
  "  Mark \"SELF-CHECK WARNING \" & stage & \" \" & tag & \" \" & fillIssue & \" Begin:\" & issueA & \" End:\" & issueB",
  " End If",
  " Err.Clear",
  "End Sub",
  "Sub AuditAllWires(stage)",
  " Dim tag",
  " For Each tag In wireStore.Keys",
  "  Call AuditWire(CStr(tag), stage)",
  " Next",
  "End Sub",
  "Sub ProbeMove(label, targetName, wireName)",
  " On Error Resume Next",
  " Dim target, wire, originalX, originalY, x, y, bx, by, ex, ey, movement, startFailures, detail",
  " Set target = shapeStore.Item(targetName)",
  " Set wire = shapeStore.Item(wireName)",
  " originalX = target.CellsU(\"PinX\").FormulaU",
  " originalY = target.CellsU(\"PinY\").FormulaU",
  " x = target.CellsU(\"PinX\").ResultIU",
  " y = target.CellsU(\"PinY\").ResultIU",
  " bx = wire.CellsU(\"BeginX\").ResultIU : by = wire.CellsU(\"BeginY\").ResultIU",
  " ex = wire.CellsU(\"EndX\").ResultIU : ey = wire.CellsU(\"EndY\").ResultIU",
  " If Err.Number <> 0 Then",
  "  auditFailures = auditFailures + 1",
  "  Mark \"SELF-CHECK WARNING \" & label & \" unable to prepare movement probe: \" & Err.Description",
  "  Err.Clear",
  "  Exit Sub",
  " End If",
  " startFailures = auditFailures",
  " target.CellsU(\"PinX\").FormulaU = Replace(CStr(x+0.12), \",\", \".\") & \" in\"",
  " target.CellsU(\"PinY\").FormulaU = Replace(CStr(y+0.07), \",\", \".\") & \" in\"",
  " detail = \"\"",
  " If Err.Number <> 0 Then detail = Err.Description",
  " Err.Clear",
  " Call AuditWire(wireName, \"moved \" & label)",
  " movement = Abs(wire.CellsU(\"BeginX\").ResultIU-bx)+Abs(wire.CellsU(\"BeginY\").ResultIU-by)+Abs(wire.CellsU(\"EndX\").ResultIU-ex)+Abs(wire.CellsU(\"EndY\").ResultIU-ey)",
  " If movement<0.00002 Then detail = detail & \" glued endpoints did not follow;\"",
  " If Err.Number <> 0 Then detail = detail & Err.Description",
  " Err.Clear",
  " ' Restore BOTH formulas, even if moving/auditing failed. Never save the test offset.",
  " target.CellsU(\"PinX\").FormulaU = originalX",
  " target.CellsU(\"PinY\").FormulaU = originalY",
  " If Err.Number <> 0 Then detail = detail & \" RESTORE FAILED: \" & Err.Description",
  " Err.Clear",
  " Call AuditWire(wireName, \"restored \" & label)",
  " If Len(detail)>0 Then",
  "  auditFailures = auditFailures + 1",
  "  Mark \"SELF-CHECK WARNING \" & label & \" \" & detail",
  " End If",
  " If auditFailures=startFailures Then Mark \"SELF-CHECK PASS move+restore \" & label & \" \" & targetName",
  " Err.Clear",
  "End Sub",
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
  '  MsgBox "Visio drawing INCOMPLETE - do not use this partial page: " & stepName & vbCrLf & "Error " & failNo & ": " & failDesc & vbCrLf & "See " & tracePath, vbCritical, "WrapItfUp r109"',
  '  WScript.Quit 1',
  ' End If',
  'End Sub');
 // Required by Option Explicit; declare as script-level dictionary.
 v.splice(v.findIndex(x=>x.startsWith('Dim app, doc'))+1,0,'Dim pointStore, shapeStore, wireStore','Set pointStore = CreateObject("Scripting.Dictionary")','Set shapeStore = CreateObject("Scripting.Dictionary")','Set wireStore = CreateObject("Scripting.Dictionary")');
 return {vbs:v.join('\r\n'),plan,stats:{pads:ports.size,portGroups:ports.size,moduleGroups:ownerShapes.size,chains:chains.length,glues:chains.length*2,geometryVertices,topLevelShapes:expectedTopShapes,motionProbeCategories:[...motionSamples.keys()]}};
}
const api={exportVbs};root.WIUNativeVisioPolylineR98=api;if(typeof module==='object')module.exports=api;
})(globalThis);
