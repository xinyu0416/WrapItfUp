/* Define editor and review flow. Receives the existing assembly controller hooks. */
(function(root){
  'use strict';
  root.WIUDefinePanel=function(h){
    const D=root.WIUDefines,C=root.WIUCore,P=root.WIUParser,esc=h.esc;
    let editor=null;
    const $=s=>h.dialog.querySelector(s),$$=s=>[...h.dialog.querySelectorAll(s)];
    const config=()=>D.normalize(h.getProject().defineConfig);
    const errorsHtml=list=>list.length?'<div class="a-note a-warn" role="alert">'+list.map(i=>esc(i.message)).join('<br>')+'<\/div>':'';
    function render(){
      const p=h.getProject(),c=config(),errors=D.validate(c),active=c.rows.filter(r=>r.enabled).length;
      let code='';try{code=root.WIUCompany.header(c);}catch{code='請先修正 define 設定。';}
      return '<div class="a-define-heading"><div><div class="a-eyebrow">BUILD CONFIGURATION · '+esc(D.marker(c))+'<\/div><h2>Defines · 決定這次要生成的組態<\/h2><p class="a-lead">先設定條件，再匯入子模組。修改時會重新讀取原始 RTL，並預覽 port、位寬與接線的影響。<\/p><\/div><span class="a-badge">'+active+' 啟用 / '+c.rows.length+' 定義<\/span><\/div>'+
        '<div class="a-toolbar"><button class="a-primary" data-action="defines-edit">編輯 Defines<\/button><button data-action="defines-import">貼上／匯入 define<\/button><button data-action="defines-example">加入 FPGA／ASIC 範例<\/button><button data-action="defines-download" '+(errors.length?'disabled':'')+'>下載 '+esc(D.fileName(p))+'<\/button><\/div>'+errorsHtml(errors)+
        '<div class="a-tablebox"><table class="a-table a-define-table"><thead><tr><th>狀態<\/th><th>名稱<\/th><th>值<\/th><th>互斥組<\/th><th>備註<\/th><\/tr><\/thead><tbody>'+c.rows.map(r=>'<tr><td>'+esc(r.enabled?'已啟用':'未定義')+'<\/td><td><code>'+esc(r.name)+'<\/code><\/td><td><code>'+esc(r.value||'（無值旗標）')+'<\/code><\/td><td>'+esc(r.group||'—')+'<\/td><td>'+esc(r.comment)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>'+(!c.rows.length?'<div class="a-note">尚未設定 define。按「編輯 Defines」新增名稱與值；例如 <code>DATA_W = 128<\/code> 或無值的 <code>fpga_mode<\/code>。<\/div>':'')+
        '<div class="a-note"><b>0 仍然是「已定義」。<\/b> <code>`define fpga_mode 0<\/code> 仍會進入 <code>`ifdef fpga_mode<\/code>。要走未定義分支，請取消啟用。此設定作用於整個組態；每顆 instance 的差異請用 parameter。<\/div>'+
        '<details class="a-reference-details"><summary>已保存 '+D.sourcesFor(p).length+' 份原始 RTL · 供組態切換重新解析<\/summary>'+D.sourcesFor(p).map((f,i)=>'<div class="a-card a-include-row"><div><b>'+esc(f.name)+'<\/b><\/div><button data-action="defines-source-view" data-id="'+i+'">查看原文<\/button><button data-action="defines-source-download" data-id="'+i+'">下載原文<\/button><\/div>').join('')+'<p class="a-hint">包含未啟用的原始分支。更新內容請重新匯入同名 RTL；JSON 會保存這些來源。<\/p><\/details>'+
        '<h3>RTL 引用的檔案<\/h3><p class="a-hint">遇到 <code>`include "common.vh"<\/code>，請加入同名原始檔。只讀取你提供的內容；相對路徑可在預覽時設定。引用檔只有被 include 才生效；Top 欄位使用的 macro 請放在 Defines 清單。匯出的 define 檔也可被同名 include 引用。<\/p><button data-action="defines-include">＋ 加入引用檔 .vh／.svh<\/button>'+c.includes.map((f,i)=>'<div class="a-card a-include-row"><div><b>'+esc(f.name)+'<\/b><small>'+f.text.length+' 字元 · 保存完整原文<\/small><\/div><button data-action="defines-include-view" data-id="'+i+'">查看／編輯<\/button><button data-action="defines-include-download" data-id="'+i+'">下載<\/button><button data-action="defines-include-remove" data-id="'+i+'">移除…<\/button><\/div>').join('')+
        '<details class="a-reference-details"><summary>下載格式與公司 gen_top 用法<\/summary><p><code>'+esc(D.fileName(p))+'<\/code> 使用 UTF-8（無 BOM）、LF 換行，<b>最後固定多留一個空白行<\/b>，也就是檔尾兩個 <code>0A<\/code> 位元組。<\/p><p>公司生成流程以 <code>-I '+esc(D.fileName(p))+'<\/code> 帶入。模擬／合成的所有子模組也要使用同一份設定；不同編譯單元不會因 Top include 就自動取得 macro。引用檔請按畫面路徑一併放回專案。<\/p><\/details>'+
        '<details class="a-reference-details"><summary>查看 define 檔預覽（檔尾空白行已自動補上）<\/summary><pre class="a-code">'+esc(code)+'<\/pre><\/details>'+
        '<details class="a-reference-details"><summary>支援範圍與公司命名規範<\/summary><p>支援單行 object macro、遞迴引用、巢狀 ifdef／ifndef／elsif／else／endif、undef，以及已提供的 include／include guard。條件只看「是否定義」。<\/p><p>函式巨集、多行 macro、token paste、macro quoting、遺失／循環 include 等不會猜測，會標示原因並阻止正式匯出。既有 org 的手寫條件與 c_code 仍保留原文，沒有在瀏覽器執行。<\/p><p>尚未證實公司只允許 fpga_mode／asic_mode 或 chip_top 例外，因此不硬鎖名稱。你可以自行設互斥組；範例中的名稱請依部門正式規範修改。大小寫不同視為不同 macro。<\/p><\/details>';
    }
    function collect(){
      if(!editor)return config();
      editor.fileName=$('#a-define-filename').value.trim();
      editor.rows=$$('[data-define-row]').map(row=>({enabled:row.querySelector('[data-dfield="enabled"]').checked,...Object.fromEntries(['name','value','group','comment'].map(k=>[k,row.querySelector('[data-dfield="'+k+'"]').value.trim()]))}));
      return D.normalize(editor);
    }
    function edit(c){
      editor=D.normalize(c||config());
      const body='<p>每行一個 define。無值是旗標；取消啟用代表不定義。值可使用 <code>128<\/code>、<code>8\'h00<\/code> 或 <code>(`BASE_W * 2)<\/code>。<\/p><label>下載檔名<input id="a-define-filename" value="'+esc(editor.fileName||D.fileName(h.getProject()))+'" spellcheck="false"><\/label><div class="a-tablebox"><table class="a-table a-define-editor"><thead><tr><th>啟用<\/th><th>名稱<\/th><th>值<\/th><th>互斥組（選用）<\/th><th>備註<\/th><th><\/th><\/tr><\/thead><tbody>'+editor.rows.map((r,i)=>'<tr data-define-row="'+i+'"><td><input type="checkbox" data-dfield="enabled" '+(r.enabled?'checked':'')+' aria-label="啟用 define '+(i+1)+'"><\/td>'+['name','value','group','comment'].map(k=>'<td><input data-dfield="'+k+'" value="'+esc(r[k])+'" aria-label="Define '+(i+1)+' '+k+'" spellcheck="false" placeholder="'+({name:'DATA_W',value:'128 或留空',group:'例如 target',comment:'用途說明'}[k])+'"><\/td>').join('')+'<td><button data-action="defines-row-remove" data-id="'+i+'">移除<\/button><\/td><\/tr>').join('')+'<\/tbody><\/table><\/div><button data-action="defines-row-add">＋ 新增一行<\/button><p class="a-hint">同一互斥組最多只能啟用一個。先預覽差異才套用；取消不會改動目前專案。<\/p>';
      h.openDialog('編輯 Defines',body,'預覽影響',()=>preview(collect()));
    }
    function preview(c){
      const result=D.plan(h.getProject(),c,P),errs=C.validate(result.project).filter(x=>x.severity==='error'),oldErrs=C.validate(h.getProject()).filter(x=>x.severity==='error');
      const changed=result.changes;
      h.openDialog('確認 Define 組態變更','<p>Define：'+result.defineChanges.length+' 項變更。'+(result.defineChanges.length?'<br>'+result.defineChanges.map(x=>'<code>'+esc(x.name)+'<\/code>：'+esc(x.before)+' → <b>'+esc(x.after)+'<\/b>').join('<br>'):'')+'<\/p><p>'+changed.length+' 項介面／參數差異。套用後將重新檢查既有接線；<b>原有 nets 和 bindings 會保留<\/b>，消失的 port 不會被默默刪除。<\/p>'+
        (changed.length?'<div class="a-tablebox"><table class="a-table"><thead><tr><th>Module / pin<\/th><th>目前<\/th><th>變更後<\/th><\/tr><\/thead><tbody>'+changed.map(x=>'<tr><td>'+esc(x.module+'.'+x.port)+'<\/td><td>'+esc(x.before)+'<\/td><td>'+esc(x.after)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>':'<div class="a-note">沒有 port 清單／宣告差異。下面仍會檢查參數運算、Top 位寬與接線。<\/div>')+
        '<p>需修正項目：'+oldErrs.length+' → <b>'+errs.length+'<\/b>。'+(errs.length?'可套用後處理，但正式 RTL／org 下載會受檢查限制。':'本地結構檢查沒有新增錯誤。')+'<\/p>'+errorsHtml(errs.slice(0,20))+(errs.length>20?'<p>其餘項目請於「檢查與匯出」查看。<\/p>':'')+
        '<p class="a-hint">這是介面與結構檢查。即使 ports 不變，define 仍可能改變子模組內部功能；公司 gen_top、RTL compiler 與功能驗證仍需另行執行。<\/p>','套用組態',()=>{h.commit(()=>h.setProject(result.project),'Define 組態已套用，所有接線已重新檢查。');editor=null;h.dialog.close();});
    }
    function imported(text,name){
      const c=config(),rows=D.importHeader(text);c.rows.push(...rows);
      if(name&&/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.(vh|v|svh)$/i.test(name))c.fileName=name;
      edit(c);
    }
    function importDialog(){h.openDialog('匯入 define 清單','<p>接受每行 <code>`define NAME value<\/code>。若檔案有 include guard／条件，請使用「加入引用檔」保存完整原文。<\/p><button data-action="defines-pick">選擇 define 檔<\/button><textarea id="a-define-import" spellcheck="false" placeholder="`define fpga_mode&#10;`define DATA_W 128"><\/textarea>','讀取清單',()=>imported($('#a-define-import').value));}
    function includeEdit(index,text,name){
      const c=config(),existing=index==null?null:c.includes[index];
      h.openDialog(existing?'編輯引用檔':'加入引用檔','<p>名稱需符合 RTL 的 include 相對路徑，例如 <code>inc/common.vh<\/code>。<\/p><label>相對路徑<input id="a-include-name" value="'+esc(name||existing?.name||'common.vh')+'"><\/label><textarea id="a-include-text" spellcheck="false">'+esc(text??existing?.text??'')+'<\/textarea>','預覽影響',()=>{const f={name:D.pathName($('#a-include-name').value.trim()),text:$('#a-include-text').value};if(index==null)c.includes.push(f);else c.includes[index]=f;preview(c);});
    }
    const actions={
      'defines-edit':()=>edit(),
      'defines-open':()=>h.show(),
      'defines-row-add':()=>{const c=collect();c.rows.push({name:'',value:'',group:'',comment:'',enabled:true});edit(c);},
      'defines-row-remove':b=>{const c=collect();c.rows.splice(Number(b.dataset.id),1);edit(c);},
      'defines-import':importDialog,
      'defines-pick':()=>h.pick('defines'),
      'defines-download':()=>{h.download(D.fileName(h.getProject()),root.WIUCompany.header(config()));h.toast('已下載 define；UTF-8 無 BOM，檔尾固定兩個 LF。');},
      'defines-example':()=>{const c=config();for(const name of ['fpga_mode','asic_mode'])if(!c.rows.some(r=>r.name===name))c.rows.push({name,value:'',enabled:false,group:'target',comment:'範例名稱，請依公司規範確認'});edit(c);},
      'defines-include':()=>h.pick('define-include'),
      'defines-include-view':b=>includeEdit(Number(b.dataset.id)),
      'defines-include-download':b=>{const f=config().includes[Number(b.dataset.id)];h.download(f.name.split('/').pop(),f.text);h.toast('引用檔已下載；請放回 '+f.name+'。');},
      'defines-source-view':b=>{const f=D.sourcesFor(h.getProject())[Number(b.dataset.id)];h.showFiles([{path:f.name,text:f.text,description:'完整來源 RTL'}]);},
      'defines-source-download':b=>{const f=D.sourcesFor(h.getProject())[Number(b.dataset.id)];h.download(f.name.split('/').pop(),f.text);},
      'defines-include-remove':b=>{const c=config();c.includes.splice(Number(b.dataset.id),1);preview(c);}
    };
    return {render,actions,imported,includeEdit,edit,preview};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
