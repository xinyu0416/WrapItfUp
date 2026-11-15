(function(root){
'use strict';
root.WIUWorkflowPanel=function(h){
  const F=root.WIUFlow,B=root.WIUBundle,K=root.WIUCompany,C=root.WIUCore,A=root.WIUActions,D=root.WIUDefines,P=root.WIUParser,esc=h.esc;
  const $=s=>h.dialog.querySelector(s),$$=s=>[...h.dialog.querySelectorAll(s)];
  const errors=xs=>(xs||[]).map(x=>'<div class="a-note a-warn">'+esc(x.message||x.reason||x)+'<\/div>').join('');
  const get=()=>h.getProject();
  // The clipboard bytes always originate from the original file text, never
  // from the dialog DOM. <textarea> is for human inspection/manual fallback only.
  let previewSource=null,previewHash=null,deliveryPurpose='rtl',previewFiles=[],previewApply=null;
  function shellQuote(value){return "'"+String(value).replaceAll("'","'\"'\"'")+"'";}
  function displayPreviewStatus(message,failed=false){const el=$('#r85-preview-status');if(el){el.textContent=message;el.classList.toggle('r85-invalid-status',failed);}}
  async function showFilePreview(f,collection=null,apply=null){
    previewFiles=collection||[f];previewApply=apply;
    if(!f)throw Error('找不到檔案預覽；請重新開啟工作包。');
    previewSource={path:f.path,text:String(f.text??''),description:f.description||''};
    const source=previewSource,bytes=new TextEncoder().encode(source.text);
    const verify='wc -c -- '+shellQuote(source.path)+' && sha256sum -- '+shellQuote(source.path);
    const index=previewFiles.indexOf(f),navigation='<aside class="r119-preview-files"><input id="r119-file-search" placeholder="搜尋檔名…" aria-label="搜尋預覽檔案">'+previewFiles.map((x,i)=>'<button data-action="r119-file-select" data-id="'+i+'" data-r119-file-name="'+esc(x.path.toLowerCase())+'" aria-current="'+(i===index)+'">'+esc(x.path)+'</button>').join('')+'</aside>';
    h.openDialog(source.path,'<div class="r119-preview-layout">'+navigation+'<section class="r119-preview-main"><p>'+esc(source.description)+'</p><div class="r85-file-metadata"><b>UTF-8 大小</b><code>'+bytes.length+' bytes</code><b>SHA-256</b><code id="r85-preview-sha">計算中…</code></div><div class="a-actions"><button class="a-primary" data-action="r85-file-copy">複製完整內容</button><button data-action="r119-file-download">下載此檔案</button><button data-action="r119-file-prev" '+(index<=0?'disabled':'')+'>上一檔</button><button data-action="r119-file-next" '+(index>=previewFiles.length-1?'disabled':'')+'>下一檔</button></div><p id="r85-preview-status" role="status">檔案本體保留原始換行；複製後會顯示檔名、大小與 SHA-256。</p><textarea class="r85-file-preview" id="r85-file-preview" readonly spellcheck="false" aria-label="'+esc(source.path)+' 檔案本體">'+esc(source.text)+'</textarea><details class="r119-help"><summary>Linux 接收後校驗</summary><button data-action="r85-file-verify-copy">複製 Linux 校驗指令</button><pre class="a-code">'+esc(verify)+'</pre><p>接收端的 wc -c 與 sha256sum 都相符才表示傳輸完整。</p></details></section></div>',apply?'套用設定':undefined,apply);
    $('#r119-file-search').oninput=e=>{for(const b of $$('[data-r119-file-name]'))b.hidden=!b.dataset.r119FileName.includes(e.target.value.toLowerCase());};

    previewHash=root.WIUTransfer.sha(bytes).catch(e=>'無法計算：'+e.message);
    const hash=await previewHash;
    if(previewSource===source){const el=$('#r85-preview-sha');if(el)el.textContent=hash;}
  }
  async function copyPreviewFile(){
    if(!previewSource)return;const file=previewSource,bytes=new TextEncoder().encode(file.text);
    const hash=previewHash,metadata=digest=>'檔案 '+file.path+' · '+bytes.length+' bytes · SHA-256 '+digest;
    try{
      if(!navigator.clipboard?.writeText)throw Error('目前瀏覽器無法使用寫入剪貼簿 API');
      await navigator.clipboard.writeText(file.text);
      let verified='瀏覽器已回報寫入成功；未讀回系統剪貼簿';
      try{if(navigator.clipboard.readText){const actual=await navigator.clipboard.readText();verified=actual===file.text?'已讀回剪貼簿並逐字比對相符':'剪貼簿讀回內容不同，請勿傳送';if(actual!==file.text)throw Error(verified);}}catch(e){if(/讀回內容不同/.test(e.message))throw e;verified+='（讀取權限未授權）';}
      const digest=await hash;if(previewSource===file)displayPreviewStatus('瀏覽器複製：成功。'+verified+'。'+metadata(digest)+'。傳輸至 Linux 仍待校驗。');
    }catch(e){const digest=await hash;if(previewSource!==file)return;displayPreviewStatus('瀏覽器複製：失敗（'+e.message+'）。'+metadata(digest)+'。已保留檔案本體供手動選取 Ctrl+C；不要將此操作視為傳送完成。',true);const el=$('#r85-file-preview');el?.focus();el?.select();}
  }
  async function copyPreviewVerify(){
    if(!previewSource)return;
    const verify='wc -c -- '+shellQuote(previewSource.path)+' && sha256sum -- '+shellQuote(previewSource.path);
    try{await navigator.clipboard.writeText(verify);displayPreviewStatus('Linux 校驗指令已複製；在 Linux 執行後，把輸出和檔案大小／SHA-256 逐項核對。');}
    catch(e){displayPreviewStatus('無法複製校驗指令：'+e.message,true);}
  }
  function applyPlan(title,plan,next='connections'){
    const before=JSON.stringify(get());
    const changes=plan.changes||[];
    h.openDialog(title,'<p>先核對變更，再一次套用；既有資料可用復原回到上一步。<\/p><div class="a-change-list">'+changes.map(x=>'<div>'+esc(typeof x==='string'?x:x.message||x.description||[x.module,x.port,x.name,x.before!=null?'：'+x.before:'',x.after!=null?' → '+x.after:''].filter(Boolean).join(' '))+'<\/div>').join('')+'<\/div>'+errors(plan.issues), '套用變更',()=>{
      if(before!==JSON.stringify(get()))throw Error('專案已變更，請重新預覽。');
      if((plan.issues||[]).some(i=>i.severity==='error'))throw Error('請先修正上方介面設定錯誤。');
      h.commit(()=>h.setProject(plan.project,next),'已套用，可按復原回到前一步。');h.dialog.close();
    });
  }
  function start(){return '<div class="ux-setup-heading"><h2>你想從哪裡開始？<\/h2><p class="a-lead">選擇你手上已有的資料，接著一步一步完成 Top。<\/p><\/div><div class="ux-start-options" role="group" aria-label="選擇設計起點"><button class="ux-start-option" data-action="import-rtl"><strong>我已有子模組 RTL <span aria-hidden="true">→<\/span><\/strong><span>匯入 .v／.sv，確認要放入的模組與份數。<\/span><small>由內往外組裝 · Bottom-up<\/small><\/button><button class="ux-start-option" data-action="flow-top-interface"><strong>我先定義 Top 介面 <span aria-hidden="true">→<\/span><\/strong><span>列出對外接腳，再加入暫代模組規劃接線。<\/span><small>由外往內規劃 · Top-down<\/small><\/button><\/div>';}
  function guide(){return document.getElementById('a-workflow-guide')?.innerHTML||'<p>接線在連線表；組態在 Defines；暫代輸出在 Empty／工具包。最後下載 ZIP，依 README 執行。<\/p>';}
  function banner(){const p=get();if(!['eight-lane-v1','eight-lane-v2'].includes(p.flow?.tutorial))return '';const steps=F.tutorialTasks(p),next=steps.find(x=>!x.done),done=steps.filter(x=>x.done).length;return '<section class="ux-advanced-guide" aria-label="8 通道練習的目前步驟"><p class="a-hint">8 通道練習 · '+done+' / '+steps.length+' 步已完成<\/p><h3>'+esc(next?.title||'範例接線已完成')+'<\/h3><p>'+esc(next?.why||'到公司工具包核對暫代 Top 輸出，然後下載完整檔案。')+'<\/p>'+(next?'<button class="a-primary" data-action="flow-tutorial-step" data-id="'+esc(next.id)+'">'+(next.id==='package'?'核對公司工具包':'核對並完成這一步 →')+'<\/button>':'<button class="a-primary" data-action="bundle-open">核對公司工具包<\/button>')+'<details class="a-reference-details"><summary>查看全部步驟與練習說明<\/summary><p>'+(p.flow.mode==='top-down'?'從 Top 介面開始':'從子模組 RTL 開始')+' · 每條通道把 req 經過兩個示範模組送到 ack；這是接線練習。<\/p><ol>'+steps.map(s=>'<li>'+esc((s.done?'已完成 · ':'')+s.title)+'<\/li>').join('')+'<\/ol><button data-action="flow-tutorial-stop">退出練習，返回我的專案<\/button><\/details><\/section>';}
  function example(){h.startPractice(root.WIUFocusGuide.createTemplate(),'graph');h.dialog.close();}
  function topInterface(){h.openDialog('先建立 Top 介面','<p>每行 <code>方向 名稱 範圍<\/code>，例如 <code>input req [63:0]<\/code>；也能貼上 module 的完整介面。只增加／核對宣告，既有接線保留。<\/p><label>Top 名稱<input id="f-top-name" value="'+esc(get().top)+'" spellcheck="false"><\/label><label>介面清單<textarea id="f-interface" spellcheck="false" placeholder="input clk_a&#10;input rst_n_a&#10;input req [63:0]&#10;output ack [63:0]"><\/textarea><\/label>','預覽介面',()=>{const p=A.clone(get());p.top=$('#f-top-name').value.trim();p.entryRoute='top-down';if(!C.validName(p.top))throw Error('Top 名稱不是有效識別字。');applyPlan('核對 Top 介面',F.addTopInterface(p,$('#f-interface').value),'ports');});}
  function moduleInterface(){h.openDialog('先定義子模組介面','<p>RTL 還沒完成也能先接線。這裡生成標記清楚的暫代 RTL，輸出不預設接零；介面骨架尚未實作功能。<\/p><div class="a-grid2"><label>Module 名稱<input id="f-module-name" placeholder="例如 cemac_core"><\/label><label>建立幾個 instances<input id="f-module-count" type="number" min="1" max="64" value="1"><\/label><\/div><label>介面清單<textarea id="f-module-ports" spellcheck="false" placeholder="input clk&#10;input req [7:0]&#10;output ack [7:0]"><\/textarea><\/label>','預覽暫代模組',()=>{const p=A.clone(get()),name=$('#f-module-name').value.trim(),n=Number($('#f-module-count').value);if(p.modules.some(m=>m.name===name))throw Error('同名 module 已存在。請用匯入 RTL 更新介面。');if(!Number.isInteger(n)||n<1||n>64)throw Error('Instance 數量請填 1～64。');const result=F.makePlaceholder(name,$('#f-module-ports').value,{config:p.defineConfig});if(result.issues?.some(x=>x.severity==='error'))throw Error(result.issues.map(x=>x.message).join('\n'));p.modules.push(result.module);p.rtlSources.push({name:result.filename,text:result.source});for(let i=0;i<n;i++)p.instances.push({id:'f_'+name+'_'+i,name:name+'_inst'+(n===1?'':'_'+i),module:name,parameters:{}});applyPlan('核對暫代介面',{project:p,changes:[name+'：'+result.module.ports.length+' ports，建立 '+n+' instances。'],issues:result.issues},'modules');});}
  function auto(){const plan=F.previewAutoConnect(get());h.openDialog('預覽同名接線與新宣告','<p>只提出尚未設定的接腳；同名不代表電路用途相同。共用 clock/reset 也請先確認時脈域。<\/p>'+(plan.groups.length?'<div class="a-tablebox"><table class="a-table"><thead><tr><th>套用<\/th><th>訊號<\/th><th>宣告／接線<\/th><th>原因<\/th><\/tr><\/thead><tbody>'+plan.groups.map(g=>'<tr><td><input type="checkbox" data-flow-group="'+esc(g.id)+'" checked aria-label="選擇 '+esc(g.name)+'"><\/td><td>'+esc(g.name)+'<\/td><td>'+esc(g.net?g.net.direction+' '+(g.net.range||'1 bit'):'沿用既有宣告')+' · '+g.bindings.length+' pins<\/td><td>'+esc(g.reason)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>':'<p>目前沒有可安全提出的同名接線。可以在連線表選取 pins，建立命名線或分配切片。<\/p>')+(plan.skipped.length?'<h3>留給你決定<\/h3>'+plan.skipped.map(g=>'<div class="a-note a-warn"><b>'+esc(g.name)+'<\/b>：'+esc(g.reason)+'<details><summary>接腳位置<\/summary>'+g.endpoints.map(esc).join('<br>')+'<\/details><\/div>').join(''):'')+errors(plan.issues),'套用選取項目',()=>{const ids=$$('[data-flow-group]').filter(x=>x.checked).map(x=>x.dataset.flowGroup);if(!ids.length)throw Error('請先選擇一組接線。');const r=F.applyAutoConnect(get(),ids);if(r.issues.some(i=>i.severity==='error'))throw Error(r.issues.map(i=>i.message).join('\n'));h.commit(()=>h.setProject(r.project,'connections'));h.dialog.close();});}
  function quickInstance(moduleName){
    root.WIUBridge?.finish();
    const plan=F.planInstances(get(),moduleName,{count:1});
    if(plan.issues.length)throw Error(plan.issues.map(x=>x.message).join('；'));
    const inst=plan.added[0];
    h.commit(()=>h.setProject(plan.project,'graph'),'已放入 '+inst.name+'；Ctrl+Z 復原。',{scope:'top',label:'新增 instance '+inst.name});
    h.dialog.close();h.locateInstance?.(inst.id);
  }
  function instances(moduleName){
    const p=get();if(!p.modules.length)throw Error('先匯入 RTL 或定義子模組介面。');
    const chosen=p.modules.find(m=>m.name===moduleName)||p.modules[0];
    h.openDialog('批次放入 instances','<p>只新增 instances，既有名稱、參數、接線與圖面位置不變。遇到已使用的名稱會跳過該編號。</p><label>Module<select id="f-repeat-module">'+p.modules.map(m=>'<option value="'+esc(m.name)+'" '+(m.name===chosen.name?'selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select></label><div class="a-grid2"><label>新增幾顆<input id="f-repeat-count" type="number" min="1" max="64" value="1"></label><label>起始編號<input id="f-repeat-start" type="number" min="0" value="0"></label></div><label>名稱前綴<input id="f-repeat-base" value="'+esc(chosen.name+'_inst_')+'" spellcheck="false"></label><p class="a-hint">例如 etn_p 搭配編號會產生 etn_p0、etn_p1。統一既有 gen_top 名稱需另外執行「核對 gen_top 名稱」。</p>','預覽新增名稱',()=>{
      const before=JSON.stringify(get()),plan=F.planInstances(get(),$('#f-repeat-module').value,{count:Number($('#f-repeat-count').value),base:$('#f-repeat-base').value,start:Number($('#f-repeat-start').value),numbered:true});
      if(plan.issues.length)throw Error(plan.issues.map(x=>x.message).join('；'));
      const mod=plan.project.modules.find(m=>m.name===plan.added[0].module),params=(mod.parameters||[]).filter(p=>!p.local);
      h.openDialog('放入 '+plan.added.length+' 顆 instances','<p>保留 '+get().instances.length+' 顆既有 instances。以下可逐顆覆寫參數；空白沿用模組預設。</p><div class="a-tablebox"><table class="a-table"><thead><tr><th>新 instance</th>'+params.map(p=>'<th>'+esc(p.name)+'<small>預設 '+esc(p.value)+'</small></th>').join('')+'</tr></thead><tbody>'+plan.added.map(i=>'<tr><td><code>'+esc(i.name)+'</code></td>'+params.map(p=>'<td><input data-r119-inst="'+esc(i.id)+'" data-r119-param="'+esc(p.name)+'" aria-label="'+esc(i.name+'.'+p.name)+'" placeholder="模組預設"></td>').join('')+'</tr>').join('')+'</tbody></table></div><div id="r119-repeat-impact" role="status"></div>','放入 Top',()=>{
        if(JSON.stringify(get())!==before)throw Error('專案已變更，請重新預覽。');const next=root.WIUWorkflowR119.namedParameters(plan.project,plan.added,collect());
        h.commit(()=>h.setProject(next,'graph'),'已放入 '+plan.added.length+' 顆；可一次復原。',{scope:'top',label:'新增 '+plan.added.length+' 顆 instances'});
        h.dialog.close();h.locateInstance?.(plan.added[0].id);
      });
      function collect(){const values={};for(const el of $$('[data-r119-inst]')){values[el.dataset.r119Inst]||={};values[el.dataset.r119Inst][el.dataset.r119Param]=el.value;}return values;}
      function preview(){try{const next=root.WIUWorkflowR119.namedParameters(plan.project,plan.added,collect());const map=root.WIUImportReview.pinMap(next);$('#r119-repeat-impact').textContent=plan.added.map(i=>i.name+'：'+[...map.values()].filter(p=>p.instance===i.id).map(p=>p.port+' '+(p.error?'未解析':p.width+'b')).join(', ')).join('；');$('[data-dialog="apply"]').disabled=false;}catch(e){$('#r119-repeat-impact').textContent=e.message;$('[data-dialog="apply"]').disabled=true;}}
      $$('[data-r119-inst]').forEach(el=>el.addEventListener('input',preview));preview();

    });
    $('#f-repeat-module').addEventListener('change',e=>{$('#f-repeat-base').value=e.target.value+'_inst_';});
  }
  function parameters(){const p=get(),params=Array.isArray(p.parameters)?p.parameters:Object.entries(p.parameters||{}).map(([name,value])=>({name,value:String(value)}));h.openDialog('Top 參數','<p class="a-note a-warn">Top parameter 可保留於網站 RTL，但公司 gen_top 重產尚未驗證，工作包會阻擋匯出。公司流程請使用子模組參數與 instance 覆寫。<\/p><p>每行 <code>名稱 = 值<\/code>，例如 <code>DATA_W = 64<\/code>。內部常數可寫 <code>localparam NAME = 值<\/code>。給單個 instance 的覆寫值，請到「放入模組」展開「已放入 Top」，在對應 instance 的「設定」填入。<\/p><textarea id="f-parameters" spellcheck="false">'+esc(params.map(x=>(x.local?'localparam ':'')+x.name+' = '+x.value).join('\n'))+'<\/textarea>','預覽參數',()=>{const rows=$('#f-parameters').value.split(/\n/).filter(x=>x.trim()).map(x=>{const m=/^\s*(?:(localparam|parameter)\s+)?([A-Za-z_][\w$]*)\s*=\s*(.+?)\s*$/.exec(x);if(!m)throw Error('每行需為 名稱 = 值。');const old=params.find(p=>p.name===m[2]);return {...(old||{}),name:m[2],value:m[3],local:m[1]==='localparam'};});if(new Set(rows.map(x=>x.name)).size!==rows.length)throw Error('參數名稱重複。');const p=A.clone(get());p.parameters=rows;const ctx=C.resolveParameters({parameters:C.projectView(p).parameters},{});if(ctx.errors.length)throw Error(ctx.errors.map(x=>x.message||x).join('\n'));applyPlan('核對 Top 參數',{project:p,changes:rows.map(x=>x.name+' = '+x.value),issues:[]},'ports');});}
  function standard(){const p=A.clone(get()),plan=C.standardNamesPlan(p);const changes=plan.changes||plan.mappings||[];for(const x of changes){const i=p.instances.find(i=>i.id===(x.id||x.instance));if(i){i.name=x.after||x.to||x.name;delete i.nameBinding;}}applyPlan('核對 gen_top 標準 instance 名稱',{project:plan.project||p,changes:changes.map(x=>(x.before||x.from)+' → '+(x.after||x.to||x.name)),issues:(plan.conflicts||[]).map(x=>({...x,severity:'error'}))});}
  function bundleIssues(){try{return B.validate(get());}catch(e){return {errors:[{message:e.message}],warnings:[],outputs:[]};}}
  function deliveryOverview(p,cfg,outs){
    const values=outs.slice(0,3).map(o=>'<code>'+esc(o.port+' = '+o.expr)+'<\/code>（'+(o.defaulted?'預設':'自訂')+'）').join('、')+(outs.length>3?'，其餘 '+(outs.length-3)+' 個請看核對表':'');
    return '<section class="ux-file-purpose" aria-label="正常設計與可選 Empty 的差別"><h3>一般使用，從正常 Top 開始<\/h3><dl><div><dt>正常設計<\/dt><dd><code>'+esc(p.top)+'.v<\/code> ＋子模組，保留你設定的接線。使用 ASIC define；FPGA 模擬再加入 FPGA define。<\/dd><\/div><div><dt>可選 Empty<\/dt><dd><code>'+esc(p.top)+'.empty.v<\/code> 保留同名模組的介面，替換其內部實作；原本的子模組與接線不保留。<code>.output.cfg<\/code> 只設定這份暫代電路'+(values?'；目前為 '+values:'')+'。<\/dd><\/div><\/dl><p class="a-hint">若 '+esc(p.top)+' 被 chip_top 引用，它就是 chip_top 的子模組；Empty 可作為該子模組的暫代版本。正常與 Empty 擇一編譯。單一輸出留空 <code>.pin()<\/code> 是另一件事，仍保留正常模組功能。<\/p><button data-action="bundle-review">核對實際接線、留空與 Empty 值<\/button><\/section>';
  }
  function scriptPreview(p,apply){return showFiles(root.WIUWorkflowR119.executionFiles(p),0,apply);}
  function showFiles(list,index=0,apply=null){if(!list.length)throw Error('目前沒有可預覽檔案。');return showFilePreview(list[Math.max(0,Math.min(index,list.length-1))],list,apply);}
  function scriptSettings(draft){
    const before=JSON.stringify(get()),p=A.clone(draft||get()),c=K.scriptConfig(p),used=p.modules.filter(m=>p.instances.some(i=>i.module===m.name));
    const val=key=>esc(c[key]);
    const argFields='<label>gen_top 參數（每行一個參數，不加 shell 引號）<textarea id="f-script-gen-args">'+esc(c.genTopArgs.join('\n'))+'<\/textarea><\/label><label>Python 參數（例如 -u，每行一個）<textarea id="f-script-python-args">'+esc(c.pythonArgs.join('\n'))+'<\/textarea><\/label><details><summary>Grid 與共用環境（選用）<\/summary><p>本機執行可留白。Grid 請填會等待工作完成的 launcher；只提交不代表成功。Bash 環境檔會在 worker 載入，產生、編譯與模擬共用此設定。<\/p><label>Launcher 執行檔及參數（每行一個）<textarea id="f-script-launcher">'+esc(c.launcher.join('\n'))+'<\/textarea><\/label><label>Bash 環境設定檔路徑<input id="f-script-env" value="'+esc(c.environmentScript)+'"><\/label><\/details>';
    h.openDialog('公司執行設定','<p>設定會隨專案保存，也會同步到下載的 .sh 與 README。相對路徑以解壓後、與 .sh 同層的資料夾為基準；直接填 Linux 實際路徑。<\/p><div class="ux-script-fields"><label>Top module 名稱<input id="f-script-top" value="'+esc(p.top)+'" spellcheck="false"><\/label><p class="a-hint">這是專案本身的 Top 名稱，會一起更新 RTL、org、cfg 與腳本檔名。<\/p><h3>1. Define 檔案<\/h3><p>留白使用網站下載的檔案；填入路徑則改用公司的 define。外部檔案需與網站 Defines 設定一致。<\/p><label>ASIC／共用 define 路徑<input id="f-script-asic" value="'+val('asicDefine')+'" placeholder="留白：./&lt;top&gt;_asic_define.v" spellcheck="false"><\/label><label>FPGA define 路徑<input id="f-script-fpga" value="'+val('fpgaDefine')+'" placeholder="留白：./&lt;top&gt;_fpga_define.v" spellcheck="false"><\/label><h3>2. 子模組 RTL 來源／link<\/h3><p>一種 module 設定一次，多個 instances 共用。留白使用下載檔；填入完整檔案路徑，腳本會建立 <code>&lt;module&gt;.v<\/code> link。<\/p><div class="a-tablebox"><table class="a-table ux-script-sources"><thead><tr><th>Module／下載來源<\/th><th>公司 RTL 檔案路徑（可留白）<\/th><\/tr><\/thead><tbody>'+used.map((m,i)=>{const row=c.sources.find(r=>r.moduleId?r.moduleId===m.id:r.module===m.name);return '<tr><td><b>'+esc(m.name)+'<\/b><small>'+esc(m.sourceFilename||m.filename||m.name+'.v')+'<\/small><\/td><td><input data-script-source="'+i+'" value="'+esc(row?.path||'')+'" placeholder="例如 ../../blocks/'+esc(m.name)+'/src_rtl/'+esc(m.name)+'.v" spellcheck="false"><\/td><\/tr>';}).join('')+'<\/tbody><\/table><\/div><h3>3. 公司工具位置<\/h3><label>gen_empty.py 路徑<input id="f-script-empty" value="'+val('genEmpty')+'" spellcheck="false"><\/label><p class="a-hint">預設 ./gen_empty.py 表示你會把公司版本放在解壓後、與 .sh 同層的資料夾；ZIP 不附這支 Python。<\/p><div class="ux-script-tool-grid"><label>gen_top 執行檔名稱／路徑（不含參數）<input id="f-script-gen-top" value="'+val('genTop')+'" spellcheck="false"><\/label><label>Python 執行檔名稱／路徑（不含參數）<input id="f-script-python" value="'+val('python')+'" spellcheck="false"><\/label><\/div>'+argFields+'<p class="a-hint">例如 python -u：執行檔填 python，參數填 -u。合法路徑可含空白，不要加外層引號；不展開 shell 變數。<\/p><p class="a-hint">公司路徑只會寫入腳本，網站無法讀取或驗證其中的 RTL／define。請使用與此專案匯入來源相同的版本。<\/p><\/div>','預覽設定',()=>{
      p.top=$('#f-script-top').value.trim();
      p.companyConfig={...c,genTopArgs:$('#f-script-gen-args').value.split('\n').filter(x=>x!==''),pythonArgs:$('#f-script-python-args').value.split('\n').filter(x=>x!==''),launcher:$('#f-script-launcher').value.split('\n').filter(x=>x!==''),environmentScript:$('#f-script-env').value.trim(),genTop:$('#f-script-gen-top').value.trim(),genEmpty:$('#f-script-empty').value.trim(),python:$('#f-script-python').value.trim(),asicDefine:$('#f-script-asic').value.trim(),fpgaDefine:$('#f-script-fpga').value.trim(),sources:used.map((m,i)=>({moduleId:m.id||'',module:m.name,path:$('[data-script-source="'+i+'"]').value.trim()})).filter(r=>r.path)};
      if(p.modules.some(m=>m.name===p.top))throw Error('Top 名稱不能與子模組名稱相同。');
      K.scriptPlan(p);
      scriptPreview(p,()=>{if(before!==JSON.stringify(get()))throw Error('專案已變更，請重新設定。');h.commit(()=>h.setProject(p,'bundle'),'公司執行設定已保存。');h.dialog.close();});
    });
  }

  // r94: one primary copy action per step. Copying is NOT remote receipt.
  let transfer=null,transferIndex=0,transferPhase=0,transferSignature='',transferBatchSize=5,transferStatus='',transferLastStart=0;
  function transferStart(fresh=false){
    if(!fresh&&transfer&&transferSignature===JSON.stringify(files())){transferView();return;}
    h.openDialog('傳送工作包到 Linux','<p>沒有辦法直接傳 ZIP 時，使用文字傳送。<\/p><label>Linux 接收資料夾<input id="f-linux-target" value="'+esc(transfer?.target||'/tmp')+'" spellcheck="false" placeholder="/tmp"><\/label>','開始傳送',async()=>{
      const input=files();transfer=await root.WIUTransfer.prepare(input,$('#f-linux-target').value.trim());
      transferSignature=JSON.stringify(input);transferIndex=0;transferLastStart=0;transferPhase=0;transferStatus='';transferView();
    });
  }
  function transferView(){
    if(!transfer)return;
    let body='';
    if(transferPhase===0){
      body='<h3>1. 在 Linux 啟動接收<\/h3><p>複製命令並在 Linux 終端貼上、按 Enter。<\/p><div class="r94-transfer-details"><code>'+esc(transfer.target)+'<\/code> · '+transfer.files.length+' 份檔案 · '+transfer.chunks.length+' 小段（已自動壓縮）<\/div><textarea readonly id="r68-receiver" rows="3">'+esc(transfer.command)+'<\/textarea><button class="a-primary" data-action="linux-transfer-copy" data-kind="command">複製接收命令<\/button>';
    } else if(transferPhase===1){
      const last=Math.min(transfer.chunks.length,transferIndex+transferBatchSize);
      body='<h3>2. 複製並貼到 Linux<\/h3><p>網站會自動選下一批；不用再按「下一批」。<\/p><progress max="'+transfer.chunks.length+'" value="'+transferIndex+'"><\/progress><p role="status" id="r85-transfer-copy-status">本機已複製 '+transferIndex+'/'+transfer.chunks.length+' 段。<b>Linux 是否收到，請以終端 RECEIVED 為準。<\/b><\/p>'+
      '<textarea id="r68-segment" readonly rows="5" aria-label="下一批傳送內容">'+esc(transfer.chunks.slice(transferIndex,last).join('\n'))+'<\/textarea><button class="a-primary" data-action="linux-transfer-copy" data-kind="segment">複製下一批（'+(Math.floor(transferIndex/transferBatchSize)+1)+'／'+Math.ceil(transfer.chunks.length/transferBatchSize)+'）<\/button>'+
      '<details><summary>重新貼上／恢復<\/summary><button data-action="linux-transfer-retry">重新複製上一批<\/button><button data-action="linux-transfer-command">取得接收命令<\/button><button data-action="linux-transfer-restart">重新開始<\/button><p>重新貼相同內容不會覆寫已收到的段落。<\/p><\/details>';
    } else {
      body='<h3>3. 在 Linux 確認接收<\/h3><p>全部資料已複製到本機剪貼簿，但<strong>尚未證明 Linux 已接收<\/strong>。請將 CHECK 貼到接收器，確認出現 COMPLETE。<\/p><button class="a-primary" data-action="linux-transfer-copy" data-kind="check">複製 CHECK<\/button>'+
      '<p class="r94-transfer-details">預期接收資料夾：<code>'+esc(transfer.directory)+'<\/code><\/p><label>可選：貼上終端的 COMPLETE 那一行<input id="r94-linux-receipt" placeholder="COMPLETE: '+esc(transfer.directory)+'" spellcheck="false"><\/label><button data-action="linux-transfer-verify">核對 Linux 回報<\/button><p id="r94-linux-receipt-state" role="status">Linux 待確認<\/p><details><summary>缺段或要重傳<\/summary><button data-action="linux-transfer-retry">返回上一批<\/button><button data-action="linux-transfer-command">取得接收命令<\/button><button data-action="linux-transfer-restart">重新開始<\/button><p>接收器會列出缺少的段號；重新貼上相同內容安全。<\/p><\/details>';
    }
    h.openDialog('傳送到 Linux',body);
  }
  async function transferCopy(kind){
    if(!transfer)return;
    const start=transferIndex,last=Math.min(transfer.chunks.length,start+transferBatchSize);
    const content=kind==='command'?transfer.command:kind==='check'?'CHECK':transfer.chunks.slice(start,last).join('\n');
    const field=$(kind==='command'?'#r68-receiver':kind==='segment'?'#r68-segment':null);
    try{
      if(!navigator.clipboard?.writeText)throw Error('瀏覽器未授權寫入剪貼簿');
      await navigator.clipboard.writeText(content);
      if(kind==='command')transferPhase=1;
      if(kind==='segment'){
        transferLastStart=start;transferIndex=last;
        if(transferIndex===transfer.chunks.length)transferPhase=2;
      }
      transferStatus='已複製到本機剪貼簿，仍須貼到 Linux。';
      if(kind==='check'){h.toast('已複製 CHECK；請確認 Linux 顯示 COMPLETE，網站目前無法直接讀取遠端結果。');}
      else transferView();
    }catch(e){
      transferStatus='本機複製失敗：'+e.message+'。請手動選取內容再複製。';
      if(field){field.focus();field.select();}
      const status=$('#r85-transfer-copy-status');if(status)status.textContent=transferStatus;
      else h.toast(transferStatus);
    }
  }
  function transferVerify(){
    const line=$('#r94-linux-receipt')?.value.trim()||'',status=$('#r94-linux-receipt-state');
    if(!status)return;
    if(line==='COMPLETE: '+transfer.directory){status.textContent='已核對貼回的 Linux COMPLETE 回報；網站沒有直接連接 Linux。編譯與模擬仍待驗證。';}
    else status.textContent='尚未取得符合此次資料夾的 COMPLETE；請核對 Linux 終端後重試。';
  }

  function groupedFiles(entries){
    const groups=[['先讀使用說明',f=>f.path==='README.md'],['正常 RTL 與子模組',f=>/\.(?:v|sv)$/.test(f.path)&&!/(?:\.empty|_define)\.v$/.test(f.path)],['公司生成輸入、Defines 與腳本',f=>/\.v\.org$|\.vh$|_define\.v$|\.sh$/.test(f.path)],['可選 Empty · 目前模組的替代實作',f=>/\.empty\.v$|\.output\.cfg$/.test(f.path)],['其他來源',()=>true]],remaining=entries.map((f,i)=>({f,i}));
    return groups.map(([label,match])=>{const items=remaining.filter(x=>!x.used&&match(x.f));items.forEach(x=>x.used=true);return items.length?'<h4>'+label+'<\/h4><div class="a-file-list">'+items.map(({f,i})=>'<div><code>'+esc(f.path)+'<\/code><span>'+esc(f.description||f.kind)+'<\/span><button data-action="bundle-file-preview" data-id="'+i+'">預覽<\/button><button data-action="bundle-file-download" data-id="'+i+'">單獨下載<\/button><\/div>').join('')+'<\/div>':'';}).join('');
  }
  // Shared gen_empty parser limitations reported in company workflow tests.
  // Advisory only: the website must never silently modify .org or shared tools.
  function compatibilityNotices(p){
    const rows=[];
    const clockAssigns=(p.assigns||[]).filter(a=>/clk|clock|rst|reset/i.test(a.target||'')||/clk|clock/i.test(a.expr||''));
    for(const a of clockAssigns)rows.push({kind:'shared-tool',ref:'assign '+(a.target||'<未命名>'),message:'共享 gen_empty 對一般 clock assign 的解析可能失敗。可在專案 .org 使用經公司實測確認的等價寫法；不改共享 gen_empty，不修改已生成 RTL。'});
    for(const n of (p.nets||[]).filter(x=>x.direction==='input'&&/[()]/.test(x.range||'')))rows.push({kind:'shared-tool',ref:'input '+n.name+' '+n.range,message:'共享 gen_empty 的輸入位寬解析可能不接受括號算式。先核對有效位寬，再使用公司實測等價 .org 表達式；不代表解析器已修正。'});
    if(!rows.length)rows.push({kind:'unknown',ref:'公司解析器',message:'本設計沒有命中已知的兩種語法特徵，但網站無法證明公司 gen_empty 能解析全部 .org；仍須在 Linux 實際生成及驗證。'});
    return rows;
  }
  function linuxBundle(){
    const p=get(),v=bundleIssues(),cfg={...B.normalize(p.bundleConfig),dualMode:true,includeReferences:false};let entries=[];
    if(!v.errors.length)try{entries=K.files(p,cfg);}catch(e){v.errors.push(...(e.issues?.length?e.issues:[{message:e.message}]));}
    const c=K.scriptConfig(p),outputPorts=(p.nets||[]).filter(n=>n.direction==='output'),custom=outputPorts.filter(o=>cfg.outputTies.some(t=>t.port===o.name)).length;
    const visibleErrors=v.errors.filter((issue,index,all)=>all.findIndex(other=>(other.message||other.reason||String(other))===(issue.message||issue.reason||String(issue)))===index);
    const fixes=visibleErrors.map(issue=>{const code=issue.code||'',missingSource=/(?:缺少.+RTL\s*原始碼|Missing.+RTL)/i.test(issue.message||issue.reason||''),action=/^COMPANY_SCRIPT_/.test(code)?'bundle-script-settings':/^COMPANY_/.test(code)?'readme':missingSource?'import-rtl':code==='BUNDLE_INSTANCE_NAME'?'flow-standard-names':['BUNDLE_TOP_PARAMETER','ORG_TOP_PARAMETERS'].includes(code)?'flow-parameters':/^STUB_/.test(code)?'bundle-stub-edit':/^PROFILE_/.test(code)?'bundle-profile-options':'review';return '<div class="a-note a-warn ux-bundle-issue"><span>'+esc(issue.message||issue.reason||issue)+'<\/span><button data-action="'+action+'">'+(action==='bundle-script-settings'?'修改執行設定':action==='review'?'定位接線問題':'前往修正')+'<\/button><\/div>';}).join('');
    return '<div class="r69-package-head"><div><h2>交付目前設計<\/h2><p>選擇搬到 Linux 的方式；設定與材料都會一起帶走。<\/p><\/div><span class="r69-package-count">'+(visibleErrors.length?visibleErrors.length+' 項待修正':entries.length+' 份工作檔案')+'<\/span><\/div>'+
      (v.errors.length?'<section class="ux-bundle-blockers" aria-label="下載前必須修正">'+fixes+'<\/section>':'<p class="r94-status">✓ 設計檢查完成 · Linux 產生／編譯／模擬待驗證<\/p>')+
      '<div class="r69-delivery-methods"><button class="a-primary a-bundle-cta" data-action="bundle-download" '+(v.errors.length?'disabled':'')+'>下載 Linux 工作包<\/button><button data-action="linux-transfer" '+(v.errors.length?'disabled':'')+'>無法傳 ZIP？用文字傳送<\/button>'+root.WIUExperience.commandButton('bundle-show-files',{disabled:!entries.length})+'</div>'+
      (v.errors.length?'<p class="r68-disabled-note">先處理上方錯誤後再下載。<\/p>':'')+
      '<details class="a-reference-details"><summary>進階設定 · Linux 工具與來源<\/summary><div class="r69-config-summary"><div><strong>Linux 工具與來源<\/strong><code>'+esc(c.genTop)+'<\/code> · <code>'+esc(c.python)+'<\/code><br><span>'+c.sources.filter(x=>x.path).length+' 個外部來源 link · '+(c.launcher.length?'使用執行 wrapper':'直接執行')+'<\/span><\/div><button data-action="bundle-script-settings">修改工具路徑<\/button><\/div><\/details>'+
      '<div class="r69-config-summary"><div><strong>Empty 輸出<\/strong><span>'+custom+' 個自訂 · '+(outputPorts.length-custom)+' 個預設接 0<\/span><\/div><button data-action="bundle-stub-edit" '+(!outputPorts.length?'disabled':'')+'>設定暫代輸出<\/button><\/div>'+
      '<div class="r69-after-transfer"><button data-action="linux-guide">Linux 執行指令<\/button><\/div>'+
      (v.warnings?.length?'<details class="a-reference-details"><summary>'+v.warnings.length+' 項警告 · 可繼續交付<\/summary>'+errors(v.warnings)+'<\/details>':'')+
      '<details class="a-reference-details"><summary>正常 / Empty 用法與接線核對<\/summary>'+deliveryOverview(p,cfg,v.outputs||[])+'<p class="a-hint">正常與 .empty.v 為同名模組，必須擇一編譯。缺少 .output.cfg 時，公司工具會將 Empty 所有輸出接零；交付助手會先阻擋。刻意全部接零仍需保留空 cfg。<\/p><button data-action="bundle-cfg-import" '+(!outputPorts.length?'disabled':'')+'>貼上既有 cfg<\/button><\/details>'+
      '<details class="a-reference-details ux-bundle-options" id="ux-bundle-profile-options"><summary>Defines 與 instance 名稱<\/summary><div class="a-actions"><button data-action="defines-open">編輯 Defines<\/button><button data-action="flow-standard-names">核對 gen_top 名稱<\/button><\/div>'+profilesHtml(cfg)+'<\/details>'+
      (entries.length?'<details id="r107-bundle-files" class="a-reference-details ux-bundle-files"><summary>檔案清單與個別預覽 · '+entries.length+' 份<\/summary><div class="a-actions"><button data-action="bundle-readme">README · 檔案說明<\/button><button data-action="bundle-script-preview">預覽 .sh<\/button><button data-action="delivery-purpose" data-id="rtl">只取目前單一組態 Top<\/button><\/div>'+groupedFiles(entries)+'<\/details>':'')+
      '';
  }
  function normalTopFile(){
    const p=get();return {path:p.top+'.v',text:C.exportVerilog(p),description:'目前 Defines 單一組態的正常 Top。保留目前接線；編譯需另提供子模組 RTL 與相同 Defines。'};
  }
  function normalDelivery(){
    const p=get(),found=C.validate(p,{target:'verilog'}).filter(i=>i.severity==='error');let file=null;
    if(!found.length)try{file=normalTopFile();}catch(e){found.push({message:e.message});}
    return '<section class="r118-delivery-panel"><h2>正常 Top RTL</h2><p>下載目前單一組態的 <code>'+esc(p.top)+'.v</code>，保留目前所有接線。子模組 RTL 與 Defines 由編譯環境提供。</p>'+
      (found.length?'<div class="a-note a-warn">'+found.length+' 項 Top 結構問題需要修正。<button data-tab="check">前往檢查</button></div>'+errors(found):'<p class="r94-status">Top 結構檢查通過 · 尚未編譯／模擬</p>')+
      '<div class="a-actions"><button class="a-primary" data-action="delivery-normal-download" '+(!file?'disabled':'')+'>下載 '+esc(p.top)+'.v</button><button data-action="delivery-normal-preview" '+(!file?'disabled':'')+'>預覽／複製完整 RTL</button><button data-action="save">儲存可續編專案</button></div>'+
      '<p class="a-hint">需要子模組來源、org、ASIC／FPGA、執行腳本時，切換到「Linux 工作包」。Empty 的設定不會阻擋正常 Top RTL。</p></section>';
  }
  function emptyFiles(){
    const p=get(),result=K.stub(p);return [
      {path:p.top+'.empty.v',text:result.verilog,description:'網站生成的目前組態 Empty RTL；與正常 Top 同名，編譯時擇一。'},
      {path:p.top+'.output.cfg',text:result.configText,description:'供公司 gen_empty 使用的輸出覆寫；未列出的輸出預設接 0。'},
      {path:'README.md',text:'# '+p.top+' Empty\n\n此包由 WrapItfUp 網站生成，尚未執行公司 gen_empty、編譯或模擬。\n\n- '+p.top+'.empty.v：目前單一組態的暫代 Top，保留對外介面，內部不包含原始 instances 與接線。\n- '+p.top+'.output.cfg：公司 gen_empty 輸出覆寫；沒有列出的 output 預設接 0。\n- 正常 Top 與 Empty 為同名模組，請擇一編譯。\n- 需要 ASIC／FPGA 分支與公司工具鏈執行腳本，請下載 Linux 工作包。\n',description:'Empty 使用方式'}
    ];
  }
  function emptyDelivery(){
    const p=get(),v=B.validate(p),custom=v.outputs.filter(x=>!x.defaulted).length;
    return '<section class="r118-delivery-panel"><h2>Empty 暫代電路</h2><p>保留 Top 對外介面，輸出依 cfg 設定。這份暫代 RTL 不保留正常 Top 的子模組與接線；正常與 Empty 擇一編譯。</p>'+
      '<div class="a-actions"><button data-action="bundle-stub-edit" '+(!v.outputs.length?'disabled':'')+'>設定 Empty 輸出</button><button data-action="bundle-cfg-import" '+(!v.outputs.length?'disabled':'')+'>匯入 output.cfg</button></div>'+
      '<p>'+v.outputs.length+' 個 outputs · '+custom+' 個自訂 · '+(v.outputs.length-custom)+' 個預設全 0</p>'+
      (v.errors.length?errors(v.errors):'<p class="r94-status">Empty 表達式檢查通過 · 網站生成，尚未在公司工具執行</p>')+
      '<div class="a-actions"><button class="a-primary" data-action="delivery-empty-download" '+(v.errors.length?'disabled':'')+'>下載 Empty RTL＋cfg</button><button data-action="delivery-empty-preview" '+(v.errors.length?'disabled':'')+'>預覽／複製 Empty RTL</button><button data-action="delivery-empty-cfg-preview" '+(v.errors.length?'disabled':'')+'>預覽／複製 cfg</button></div>'+
      (v.warnings.length?'<details><summary>'+v.warnings.length+' 項提醒</summary>'+errors(v.warnings)+'</details>':'')+
      '<p class="a-hint">要在公司 gen_empty 重新產生，切換至「Linux 工作包」，此處的 cfg 設定會一起帶入。</p></section>';
  }
  function bundle(){
    const items=[['rtl','Top RTL','目前單一組態'],['linux','Linux 工作包','來源、org、腳本'],['empty','Empty 暫代','輸出 cfg 與暫代 RTL']];
    return '<nav class="r118-delivery-purpose a-toolbar" aria-label="選擇交付成果">'+items.map(([id,name,note])=>'<button data-action="delivery-purpose" data-id="'+id+'" aria-pressed="'+(deliveryPurpose===id)+'"><strong>'+name+'</strong><small>'+note+'</small></button>').join('')+'</nav>'+
      (deliveryPurpose==='linux'?linuxBundle():deliveryPurpose==='empty'?emptyDelivery():normalDelivery());
  }
  function verificationSetup(){
    const existing=get().quickVerification||{};
    const options=(all,current)=>all.map(([id,label])=>'<option value="'+id+'" '+(current===id?'selected':'')+'>'+label+'<\/option>').join('');
    h.openDialog('編譯／模擬設定','<p>公司產生 RTL 成功後，填入 Testbench 並取得 Linux 命令。<\/p><div class="a-grid2"><label>版本<select id="r95-kind">'+options([['normal','正常'],['empty','Empty']],existing.kind||'normal')+'<\/select><\/label><label>模式<select id="r95-mode">'+options([['asic','ASIC'],['fpga','FPGA']],existing.mode||'asic')+'<\/select><\/label><\/div><label>Testbench 路徑<input id="r95-tb" value="'+esc(existing.tb||'')+'" placeholder="tb/example_tb.sv"><\/label><label>Testbench module（不確定可留白）<input id="r95-top" value="'+esc(existing.top||'')+'"><\/label><details><summary>進階設定<\/summary><label>模擬器<select id="r95-simulator">'+options([['vcs','VCS'],['iverilog','Icarus']],existing.simulator||'vcs')+'<\/select><\/label><label>PASS 標記<input id="r95-marker" value="'+esc(existing.marker||'TB_RESULT PASS')+'"><\/label><\/details>','產生指令',()=>{
      const c={kind:$('#r95-kind').value,mode:$('#r95-mode').value,tb:$('#r95-tb').value.trim(),top:$('#r95-top').value.trim(),simulator:$('#r95-simulator').value,marker:$('#r95-marker').value.trim()};
      if(!c.tb||!c.marker||/[\r\n]/.test(c.tb+c.top+c.marker))throw Error('請填有效的 Testbench 路徑與 PASS 標記。');
      const p=A.clone(get());p.quickVerification=c;h.commit(()=>h.setProject(p,'bundle'));
      const cmd='python3 run_wiu.py verify --run latest --implementation '+c.kind+' --device '+c.mode+' --testbench '+shellQuote(c.tb)+(c.top?' --tb-top '+shellQuote(c.top):'')+' --simulator '+c.simulator+' --pass-marker '+shellQuote(c.marker);
      h.openDialog('Linux 驗證命令','<p>請在工作包資料夾執行：<\/p><pre class="a-code" id="r95-verify-command">'+esc(cmd)+'<\/pre><p>未執行：只有新編譯產物、無錯誤 log、testbench PASS 同時成立才算通過。<\/p>','複製命令',async()=>{try{await navigator.clipboard.writeText(cmd);h.toast('已複製；請在 Linux 執行並核對結果。');}catch(e){h.toast('無法複製：'+e.message);}});
    });
  }
  function linuxSteps(){
    const p=get(),plan=K.scriptPlan(p);
    const cmd='python3 run_wiu.py diagnose && python3 run_wiu.py generate';
    h.openDialog('在 Linux 產生 RTL','<p>解壓工作包，進入其中的資料夾後，複製並執行：<\/p><pre class="a-code" id="r94-linux-command">'+esc(cmd)+'<\/pre><button class="a-primary" data-action="linux-guide-copy">複製執行指令<\/button><p class="r94-status">網站設計檢查完成 → Linux 產生待驗證 → 編譯／模擬待驗證<\/p><p>成功後按下方按鈕取得編譯／模擬指令；請使用當次 runs/&lt;run&gt;/output 內的 filelist。正常與 Empty 請分別使用 <code>normal-asic.f / normal-fpga.f<\/code>、<code>empty-asic.f / empty-fpga.f<\/code>，兩者不可一起編譯。<\/p><button data-action="linux-verify-setup">編譯／模擬命令<\/button><details><summary>進階設定與驗證<\/summary><p>gen_top：<code>'+esc(plan.config.genTop)+'<\/code> · gen_empty：<code>'+esc(plan.config.genEmpty)+'<\/code> · Python：<code>'+esc(plan.config.python)+'<\/code><\/p><button data-action="bundle-script-settings">修改工具路徑<\/button><p>公司工具不隨包附上。VCS 編譯要同時檢查 log 與新產物，模擬要有測試 PASS。詳細記錄保存於工作包產生的 runs 目錄。<\/p><\/details>');
  }
  function profilesHtml(config){return (config.profiles||[]).map((x,i)=>'<div class="a-card"><b>'+esc(x.name)+'<\/b> · '+x.defineConfig.rows.filter(r=>r.enabled).length+' 個啟用 define <button data-action="bundle-profile-load" data-id="'+i+'">預覽並切換<\/button><button data-action="bundle-profile-remove" data-id="'+i+'">移除快照…<\/button><\/div>').join('');}
  function saveProfile(){h.openDialog('保存目前 Define 組態','<p>保存目前所有 Defines 和 include 引用檔。連線由同一專案重新檢查，不會保存另一份不同步的接線。使用 <code>asic<\/code>、<code>fpga<\/code> 名稱下載時會產生合併的 ASIC／FPGA 分支；合併前會驗證 FPGA 旗標。<\/p><label>組態名稱<input id="f-profile-name" value="asic" spellcheck="false"><\/label>','保存快照',()=>{const p=A.clone(get()),c=B.normalize(p.bundleConfig),name=$('#f-profile-name').value.trim();if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)||name==='current')throw Error('請使用英文字母開頭的名稱；current 保留給目前組態。');const profile={name,defineConfig:D.normalize(p.defineConfig)},i=c.profiles.findIndex(x=>x.name===name);if(i>=0)throw Error('此快照名稱已存在。請先移除舊快照，或使用不同名稱。');c.profiles.push(profile);p.bundleConfig=c;h.commit(()=>h.setProject(p,'bundle'));h.dialog.close();});}
  // r85 Empty editor: the whole 56-output matrix remains in one dialog.
  let stubEditing=null,stubFilter='all';
  function stubModel(){
    const ui=stubEditing;if(!ui)return null;
    const ties=$$('[data-stub-port]').filter(x=>x.value.trim()).map(x=>({port:x.dataset.stubPort,expr:x.value.trim()}));
    const config={...ui.config,outputTies:ties},validation=B.validate(ui.project,config),issues=[...validation.errors];
    // Friendly Verilog literal guidance is a UX check. Do not silently alter RTL.
    for(const tie of ties){
      if(/^[\u2019']\s*[01]$/.test(tie.expr)){
        const width=stubWidth(tie.port,validation),bit=tie.expr.slice(-1);
        issues.push({port:tie.port,severity:'error',code:'R85_UNBASED',message:tie.port+'：無位寬的 '+tie.expr+' 在目前 parser 不支援。'+(width?'改用 '+width+"'d"+bit+'；全 1 請按「全位元 1」。':'請按該列「全位元 0／1」建立有位寬的常數。')});
      }
    }
    return {config,validation,issues};
  }
  function stubWidth(name,result){
    const row=stubEditing?.ports.find(n=>n.name===name);if(!row)return null;
    try{return C.parseRange(row.range,result?.context||{}).width;}catch{return null;}
  }
  function stubLiteral(width,kind){
    if(!Number.isInteger(width)||width<1)throw Error('無法解析本輸出位寬；請先核對 Top parameter 和範圍。');
    if(kind==='zero')return width+"'d0";
    if(kind==='one')return width+"'h"+'f'.repeat(Math.ceil(width/4));
    return '';
  }
  function stubActual(expr,width){
    if(!expr)return '0（預設，整個 output）';
    const m=/^(\d+)'([bdho])([0-9a-fA-F_]+)$/i.exec(expr);
    if(!m)return '運算式（需模擬決定）';
    try{const radix={b:2,o:8,d:10,h:16}[m[2].toLowerCase()],digits=m[3].replaceAll('_',''),number=radix===16?'0x'+digits:radix===8?'0o'+digits:radix===2?'0b'+digits:digits;
      const val=BigInt(number)&((1n<<BigInt(width))-1n),hex=val.toString(16).toUpperCase();return '0x'+hex+(width<=16?' · '+val.toString(2).padStart(width,'0'):'');
    }catch{return '運算式（需模擬決定）';}
  }
  function stubRefresh(focusFirst=false){
    if(!stubEditing||!$('#r85-stub-search'))return [];
    const model=stubModel(),issues=model.issues,filterQuery=$('#r85-stub-search').value.trim().toLowerCase(),selected=$$('[data-stub-select]').filter(x=>x.checked);
    const errorsBy=new Map();for(const issue of issues){if(!issue.port)continue;if(!errorsBy.has(issue.port))errorsBy.set(issue.port,[]);errorsBy.get(issue.port).push(issue.message);}
    let visible=0;
    for(const row of $$('[data-stub-row]')){
      const name=row.dataset.stubRow,input=row.querySelector('[data-stub-port]'),value=input.value.trim(),warn=errorsBy.get(name)||[];
      const matches=!filterQuery||name.toLowerCase().includes(filterQuery)||value.toLowerCase().includes(filterQuery),show=matches&&(stubFilter==='all'||(stubFilter==='custom'&&!!value)||(stubFilter==='errors'&&!!warn.length));
      row.hidden=!show;if(show)visible++;
      const warning=row.querySelector('[data-stub-error]'),width=stubWidth(name,model.validation),hint=row.querySelector('[data-stub-example]');
      input.setAttribute('aria-invalid',warn.length?'true':'false');if(!warn.length)input.classList.remove('r85-stub-focus');
      warning.textContent=warn.join(' / ');warning.hidden=!warn.length;
      if(hint)hint.textContent=width?('範例：'+stubLiteral(width,'zero')+'／'+stubLiteral(width,'one')+'；'+width+"'d1 只讓最低位為 1"):'範圍尚無法求值，請核對參數';
      const actual=row.querySelector('[data-stub-actual]');if(actual)actual.textContent=width?stubActual(value,width):'位寬待確認';
    }
    for(const el of $$('[data-stub-filter]'))el.setAttribute('aria-pressed',el.dataset.stubFilter===stubFilter?'true':'false');
    const errSummary=$('#r85-stub-errors'),errorPorts=[...new Set(issues.filter(i=>i.port).map(i=>i.port))];
    const unidentified=issues.filter(i=>!i.port);
    errSummary.innerHTML=issues.length?'<strong>'+issues.length+' 個檢查錯誤（'+errorPorts.length+' 個欄位）<\/strong><p>點選問題名稱可跳到該輸入框，不會把錯誤藏到表格底部。<\/p>'+errorPorts.map(name=>'<button class="r85-stub-error-link" data-action="r85-stub-locate" data-id="'+esc(name)+'">'+esc(name)+'：'+esc((errorsBy.get(name)||[])[0])+'<\/button>').join('')+unidentified.map(i=>'<p>'+esc(i.message)+'<\/p>').join(''):'<span>✓ Empty 表達式檢查通過；但尚未在 Linux 生成或模擬。<\/span>';
    errSummary.classList.toggle('r85-invalid-status',!!issues.length);
    const count=$('#r85-stub-count');if(count)count.textContent='顯示 '+visible+' / '+stubEditing.ports.length+' 個 output · '+model.config.outputTies.length+' 個明確覆寫 · '+(stubEditing.ports.length-model.config.outputTies.length)+' 個預設 · '+selected.length+' 個勾選';
    if(focusFirst&&issues.length){
      const item=issues.find(i=>i.port),input=item&&$$('[data-stub-port]').find(x=>x.dataset.stubPort===item.port);
      if(input){stubFilter='all';$('#r85-stub-search').value='';for(const row of $$('[data-stub-row]'))row.hidden=false;const row=input.closest('[data-stub-row]'),table=$('.r85-stub-table');if(table&&row){table.scrollTop+=row.getBoundingClientRect().top-table.getBoundingClientRect().top-Math.floor(table.clientHeight/3);table.scrollLeft=0;}input.focus({preventScroll:true});input.classList.add('r85-stub-focus');}
      else errSummary.scrollIntoView({block:'center'});
    }
    return issues;
  }
  function stubSet(port,kind){
    const model=stubModel(),width=stubWidth(port,model.validation),el=$$('[data-stub-port]').find(x=>x.dataset.stubPort===port);
    if(!el)return;
    el.value=kind==='default'?'':stubLiteral(width,kind);stubRefresh();
  }
  function stubEdit(){
    const p=A.clone(get()),config=B.normalize(p.bundleConfig),ports=C.projectView(p).nets.filter(x=>x.direction==='output');
    if(!ports.length)throw Error('先建立 Top output，才能設定 Empty 輸出。');
    stubEditing={project:p,config,ports,snapshot:JSON.stringify(get())};stubFilter='all';
    const result=B.validate(p,config),width=n=>stubWidth(n.name,result);
    h.openDialog('Empty 輸出設定 · '+ports.length+' outputs','<p>留白＝預設全 0；需要全 1 請按「全位元 1」。只會將明確設定的輸出寫到 cfg。<\/p><div class="r85-stub-toolbar"><input id="r85-stub-search" placeholder="搜尋 output 名稱／設定式" aria-label="搜尋 Empty 輸出"><div class="r85-stub-filters" role="group" aria-label="Empty 篩選"><button data-action="r85-stub-filter" data-stub-filter="all" aria-pressed="true">全部<\/button><button data-action="r85-stub-filter" data-stub-filter="custom">只看自訂<\/button><button data-action="r85-stub-filter" data-stub-filter="errors">只看錯誤<\/button><\/div><\/div><div class="r85-stub-batch"><button data-action="r85-stub-select-visible">勾選目前顯示<\/button><button data-action="r85-stub-batch" data-id="zero">選取的全位元 0<\/button><button data-action="r85-stub-batch" data-id="one">選取的全位元 1<\/button><button data-action="r85-stub-batch" data-id="default">選取的恢復預設<\/button><button data-action="r85-stub-unselect">取消勾選<\/button><\/div><p id="r85-stub-count" role="status"><\/p><div id="r85-stub-errors" role="alert" class="r85-stub-errors"><\/div><div class="r85-stub-table"><table class="a-table"><thead><tr><th>選取<\/th><th>Output／位寬<\/th><th>設定式與錯誤位置<\/th><th>快捷操作<\/th><th>預估結果<\/th><\/tr><\/thead><tbody>'+ports.map(n=>'<tr data-stub-row="'+esc(n.name)+'"><td><input type="checkbox" data-stub-select="'+esc(n.name)+'" aria-label="勾選 '+esc(n.name)+'"><\/td><td><b>'+esc(n.name)+'<\/b><small>'+esc(n.range||'1 bit')+' · '+esc(width(n)||'?')+' bit<\/small><\/td><td><input data-stub-port="'+esc(n.name)+'" value="'+esc(config.outputTies.find(x=>x.port===n.name)?.expr||'')+'" aria-label="'+esc(n.name)+' Empty 運算式" placeholder="留白＝預設全 0" spellcheck="false"><small data-stub-example><\/small><small class="r85-field-error" data-stub-error hidden><\/small><\/td><td><div class="r85-stub-quick"><button data-action="r85-stub-quick" data-id="'+esc(n.name)+'" data-kind="zero">全位元 0<\/button><button data-action="r85-stub-quick" data-id="'+esc(n.name)+'" data-kind="one">全位元 1<\/button><button data-action="r85-stub-quick" data-id="'+esc(n.name)+'" data-kind="default">預設<\/button><\/div><\/td><td><small data-stub-actual><\/small><\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>','預覽 Empty／差異',()=>{
      if(stubRefresh(true).length)return;
      const model=stubModel(),config=model.config,result=K.stub(p,config),original=new Map(stubEditing.config.outputTies.map(x=>[x.port,x.expr])),next=new Map(config.outputTies.map(x=>[x.port,x.expr]));
      const changes=ports.map(port=>{const w=stubWidth(port.name,model.validation)||1,before=original.get(port.name)||'',after=next.get(port.name)||'';return {name:port.name,width:w,before,after,actual:stubActual(after,w),changed:before!==after};});
      h.openDialog('Empty 差異核對 · '+config.outputTies.length+' 個覆寫','<p>套用前核對 '+changes.length+' 個 output：'+changes.filter(x=>x.changed).length+' 個和目前儲存值不同；'+config.outputTies.length+' 個在 cfg 明確覆寫；其餘仍保持預設全 0。<\/p><div class="r85-stub-table"><table class="a-table"><thead><tr><th>Output<\/th><th>位寬<\/th><th>儲存值<\/th><th>將套用的設定式<\/th><th>實際值／靜態判讀<\/th><\/tr><\/thead><tbody>'+changes.map(x=>'<tr class="'+(x.changed?'r85-diff-changed':'')+'"><td><b>'+esc(x.name)+'<\/b><\/td><td>'+x.width+' bit<\/td><td><code>'+esc(x.before||'預設接 0')+'<\/code><\/td><td><code>'+esc(x.after||'預設接 0')+'<\/code><\/td><td>'+esc(x.actual)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div><h3>下載時的 '+esc(p.top)+'.output.cfg（只含明確覆寫）<\/h3><pre class="a-code">'+esc(result.configText||'（空白：全部預設接零）')+'<\/pre><details><summary>查看網站生成的完整 Empty RTL（不是公司執行結果）<\/summary><pre class="a-code">'+esc(result.verilog)+'<\/pre><\/details><p class="a-hint">尚未執行公司 gen_empty、VCS 或自訂值模擬；請在目標環境另外驗收目前設計。<\/p>','確認並套用 Empty',()=>{
        if(JSON.stringify(get())!==stubEditing.snapshot)throw Error('專案已在另一個畫面變更；請重新編輯。');
        h.commit(()=>{const next=A.clone(get());next.bundleConfig=config;h.setProject(next,'bundle');});stubEditing=null;h.dialog.close();
      });
    });
    stubRefresh();
  }
  h.dialog.addEventListener('input',e=>{if(e.target.id==='r85-stub-search'||e.target.dataset.stubPort)stubRefresh();});
  function cfgImport(){
    const p=A.clone(get()),snapshot=JSON.stringify(get());
    h.openDialog('貼上 Empty output.cfg','<p>每行一個完整 <code>assign output = expression;<\/code>。這份 cfg 將取代目前的 Empty 覆寫；未列出的輸出恢復預設 0，正常接線不變。<\/p><label>cfg 內容<textarea id="f-cfg-text" rows="8" spellcheck="false" placeholder="assign ack = 1\'b1;"><\/textarea><\/label><p class="a-hint">支援空白與 // 註解。保留原式，不自動改成其他常數或切片；位寬不同會提示核對補位／截斷。<\/p>','解析並預覽',()=>{
      const text=$('#f-cfg-text').value,config=B.normalize(p.bundleConfig),seen=new Set(),changes=[];
      config.outputTies=[];
      const nets=C.projectView(p).nets;
      const width=n=>{try{return C.parseRange(n.range,{}).width;}catch(_){return null;}};
      text.split(/\r?\n/).forEach((line,i)=>{
        const code=line.replace(/\/\/.*$/,'').trim();if(!code)return;
        const m=/^assign\s+([A-Za-z_][\w$]*)\s*=\s*(.+);\s*$/.exec(code);
        if(!m)throw Error('第 '+(i+1)+' 行需為完整的整個 output assign；不支援條件指令或部分 bit 覆寫。');
        const port=m[1],old=m[2].trim(),net=nets.find(n=>n.name===port&&n.direction==='output');
        if(!net)throw Error('第 '+(i+1)+' 行的 '+port+' 不是 Top output。');
        if(seen.has(port))throw Error(port+' 重複設定；請只保留你要使用的一行。');seen.add(port);
        const expr=old,reason='保留原始 Verilog 指派；不同位寬依指派規則補位或截斷。';
        config.outputTies.push({port,expr});changes.push({port,old,expr,reason});
      });
      const result=K.stub(p,config);
      h.openDialog('核對 cfg 與位寬','<p>將套用 '+changes.length+' 個覆寫。未列出的 output 由 gen_empty 預設接 0。<\/p>'+(changes.length?'<div class="a-tablebox"><table class="a-table"><thead><tr><th>Output<\/th><th>原設定<\/th><th>將使用<\/th><th>說明<\/th><\/tr><\/thead><tbody>'+changes.map(x=>'<tr><td>'+esc(x.port)+'<\/td><td><code>'+esc(x.old)+'<\/code><\/td><td><code>'+esc(x.expr)+'<\/code><\/td><td>'+esc(x.reason||'保留原設定')+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>':'<p>這會清除現有覆寫，恢復所有 output 預設為 0。<\/p>')+'<details><summary>查看將下載的 cfg<\/summary><pre class="a-code">'+esc(result.configText)+'<\/pre><\/details>','確認並套用 cfg',()=>{
        if(JSON.stringify(get())!==snapshot)throw Error('專案已變更，請重新貼上 cfg 並核對。');
        h.commit(()=>{const next=A.clone(get());next.bundleConfig=config;next.originalOutputCfg=text;h.setProject(next,'bundle');});h.dialog.close();
      });
    });
  }
  function files(){return K.files(get(),{...B.normalize(get().bundleConfig),includeReferences:false});}
  function referenceFiles(){return B.referenceFiles(get());}
  function references(){const list=referenceFiles();h.openDialog('gen_top 教學原始程式與完整文件','<p>這裡可隨時查閱或下載，不需要先完成接線。原始程式保留不變，操作說明為英文。公司 binary 與尚未提供的 ASIC define 原檔不在其中。<\/p><div class="a-file-list">'+list.map((f,i)=>'<div><code>'+esc(f.path)+'<\/code><span>'+esc(f.description)+'<\/span><\/div>').join('')+'<\/div>');}
  const actions={
    'flow-open':()=>h.show('start'),'flow-example-bottom':()=>example('bottom-up'),'flow-example-top':()=>example('top-down'),
    'quick-instance':b=>quickInstance(b?.dataset.id),'flow-instances':b=>instances(b?.dataset.id),'flow-top-interface':topInterface,'flow-module-interface':moduleInterface,'flow-auto':auto,'flow-parameters':parameters,'flow-standard-names':standard,
    'flow-tutorial-stop':()=>h.commit(()=>{const p=A.clone(get());delete p.flow;h.setProject(p,'connections');}),
    'flow-tutorial-step':b=>{if(b.dataset.id==='package'||b.dataset.id==='export'){h.show('bundle');return;}applyPlan('核對範例：'+(F.tutorialTasks(get()).find(x=>x.id===b.dataset.id)?.title||b.dataset.id),F.previewTutorialStep(get(),b.dataset.id));},
    'linux-transfer':()=>transferStart(),'linux-transfer-command':()=>{if(transfer){transferPhase=0;transferView();}},'linux-transfer-restart':()=>{if(transfer){transferIndex=0;transferLastStart=0;transferPhase=0;transferView();}}, 'linux-transfer-verify':transferVerify, 'linux-transfer-retry':()=>{if(transfer){transferIndex=transferLastStart;transferPhase=1;transferView();}}, 'linux-guide-copy':async()=>{try{await navigator.clipboard.writeText('python3 run_wiu.py diagnose && python3 run_wiu.py generate');h.toast('已複製 Linux 指令；需在 Linux 實際執行。');}catch(e){h.toast('複製失敗：'+e.message);}},'linux-transfer-new':()=>transferStart(true),'linux-transfer-phase':b=>{transferPhase=Number(b.dataset.id);transferView();},'linux-transfer-jump':()=>{const n=Number($('#r69-segment-number').value);if(!Number.isInteger(n)||n<1||n>transfer.chunks.length)throw Error('請輸入 1～'+transfer.chunks.length+' 的段號。');transferIndex=n-1;transferView();},'linux-guide':()=>linuxSteps(0),'linux-verify-setup':verificationSetup,'linux-guide-step':b=>linuxSteps(Number(b.dataset.id)),'linux-transfer-copy':b=>transferCopy(b.dataset.kind),'linux-transfer-next':()=>{transferIndex=Math.min(transfer.chunks.length-1,transferIndex+transferBatchSize);transferView();},'linux-transfer-prev':()=>{transferIndex=Math.max(0,transferIndex-transferBatchSize);transferView();},'linux-transfer-batch-size':b=>{transferBatchSize=Number(b.dataset.id);transferView();},
    'r119-file-select':b=>showFiles(previewFiles,Number(b.dataset.id),previewApply),'r119-file-prev':()=>showFiles(previewFiles,previewFiles.findIndex(f=>f.path===previewSource.path)-1,previewApply),'r119-file-next':()=>showFiles(previewFiles,previewFiles.findIndex(f=>f.path===previewSource.path)+1,previewApply),'r119-file-download':()=>{h.download(previewSource.path.split('/').pop(),previewSource.text);displayPreviewStatus('已送出下載：'+previewSource.path+'；請在瀏覽器下載列表確認。');},
    'r85-file-copy':copyPreviewFile,'r85-file-verify-copy':copyPreviewVerify,
    'r85-stub-filter':b=>{stubFilter=b.dataset.stubFilter;stubRefresh();},
    'r85-stub-locate':b=>{stubFilter='all';$('#r85-stub-search').value='';stubRefresh();const input=$$('[data-stub-port]').find(x=>x.dataset.stubPort===b.dataset.id);input?.scrollIntoView({block:'center'});input?.focus({preventScroll:true});},
    'r85-stub-quick':b=>stubSet(b.dataset.id,b.dataset.kind),
    'r85-stub-batch':b=>{const chosen=$$('[data-stub-select]').filter(x=>x.checked);if(!chosen.length)throw Error('先勾選要批次設定的 output。');for(const x of chosen)stubSet(x.dataset.stubSelect,b.dataset.id);stubRefresh();},
    'r85-stub-select-visible':()=>{$$('[data-stub-row]').filter(x=>!x.hidden).forEach(x=>x.querySelector('[data-stub-select]').checked=true);stubRefresh();},
    'r85-stub-unselect':()=>{$$('[data-stub-select]').forEach(x=>x.checked=false);stubRefresh();},
    'delivery-purpose':b=>{deliveryPurpose=['rtl','linux','empty'].includes(b.dataset.id)?b.dataset.id:'rtl';h.show('bundle');},
    'delivery-normal-download':()=>{const f=normalTopFile();h.download(f.path,f.text);h.toast('已送出 '+f.path+' 下載；請確認瀏覽器已保存。');},
    'delivery-normal-preview':()=>showFilePreview(normalTopFile()),
    'delivery-empty-download':()=>{const list=emptyFiles();h.download(get().top+'-empty.zip',B.zip(list),'application/zip');h.toast('已送出 Empty RTL＋cfg 下載；尚未編譯／模擬。');},
    'delivery-empty-preview':()=>showFilePreview(emptyFiles()[0]),
    'delivery-empty-cfg-preview':()=>showFilePreview(emptyFiles()[1]),
    'bundle-open':()=>{deliveryPurpose='linux';h.show('bundle');},'bundle-script-settings':()=>scriptSettings(),'bundle-script-preview':()=>scriptPreview(get()),'bundle-stub-edit':stubEdit,'bundle-cfg-import':cfgImport,
    'bundle-review':()=>{const file={text:K.review(get())};h.openDialog('核對這次下載的接線與 Empty 值','<p>以下直接核對目前專案；工作包不另加報告。每種模式分開列出正常接線、刻意留空、輸入常數與 Empty 預設／自訂值；不代表已執行模擬。<\/p><pre class="a-code">'+esc(file.text)+'<\/pre>');},
    'bundle-show-files':()=>showFiles(files()),
    'bundle-profile-options':()=>{const details=document.getElementById('ux-bundle-profile-options');if(details){details.open=true;details.querySelector('summary')?.focus();details.scrollIntoView({block:'nearest'});}},
    'bundle-profile-save':saveProfile,
    'bundle-profile-load':b=>{const current=get(),c=B.normalize(current.bundleConfig),profile=c.profiles[Number(b.dataset.id)],r=D.plan(current,profile.defineConfig,P),oldErrors=C.validate(current).filter(x=>x.severity==='error').length,newErrors=C.validate(r.project).filter(x=>x.severity==='error').length;r.changes=[...(r.defineChanges||[]).map(x=>x.name+'：'+x.before+' → '+x.after),...(r.changes||[]),'接線需修正項目：'+oldErrors+' → '+newErrors+'。既有接線保留，套用後可繼續修正。'];applyPlan('核對組態切換：'+profile.name,r,'bundle');},
    'bundle-profile-remove':b=>{const p=A.clone(get()),c=B.normalize(p.bundleConfig),i=Number(b.dataset.id);h.openDialog('移除組態快照 '+c.profiles[i].name,'<p>只移除此保存的快照，目前 Defines 設定不變。<\/p>','移除快照',()=>{c.profiles.splice(i,1);p.bundleConfig=c;h.commit(()=>h.setProject(p,'bundle'));h.dialog.close();});},
    'bundle-download':()=>{const list=files();h.download(get().top+'-design.zip',B.zip(list),'application/zip');h.toast('已送出 ZIP 下載；請確認瀏覽器已保存。Linux 產生／編譯／模擬仍待驗證。');},
    'bundle-readme':()=>showFilePreview(files().find(f=>f.path==='README.md')),
    'bundle-mode-toggle':()=>h.commit(()=>{const p=A.clone(get()),c=B.normalize(p.bundleConfig);c.dualMode=!c.dualMode;p.bundleConfig=c;h.setProject(p,'bundle');}),
    'bundle-file-preview':b=>showFiles(files(),Number(b.dataset.id)),
    'bundle-file-download':b=>{const f=files()[Number(b.dataset.id)];h.download(f.path.split('/').pop(),f.text);h.toast('已送出下載；完整相對路徑為 '+f.path);},
    'bundle-reference':references,
    'bundle-reference-download':()=>{h.download('gen-top-reference.zip',B.zip(referenceFiles()),'application/zip');h.toast('已送出參考資料 ZIP 下載；請確認瀏覽器已保存。');},
    'bundle-reference-preview':b=>showFilePreview(referenceFiles()[Number(b.dataset.id)]),
    'bundle-reference-file':b=>{const f=referenceFiles()[Number(b.dataset.id)];h.download(f.path.split('/').pop(),f.text);}
  };
  return {start,banner,bundle,actions,applyPlan,normalTopFile,emptyFiles,showFiles,purposeLabel:()=>({rtl:'Top RTL',linux:'Linux 工作包',empty:'Empty 暫代'})[deliveryPurpose]};
};
})(typeof globalThis!=='undefined'?globalThis:this);
