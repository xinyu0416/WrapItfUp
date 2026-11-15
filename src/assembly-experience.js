(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WIUExperience=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles={setup:'建立設計',modules:'放入模組',connections:'完成接線',lesson:'動手完成第一個 Top',check:'檢查設計',export:'取得成果',bundle:'RTL 與外部工具工作包',ports:'對外接腳',nets:'內部接線',assigns:'訊號運算',defines:'條件與位寬',advanced:'進階 org',help:'說明中心'};
  function stage(tab){return ({setup:0,modules:1,connections:2,graph:2,lesson:2,ports:2,nets:2,assigns:2,defines:2,advanced:2,check:3,export:4,bundle:4})[tab]??-1;}
  function heading(kicker,title,description,action=''){return '<div class="ux-page-heading"><div><h2 tabindex="-1">'+esc(title)+'<\/h2><p>'+esc(description)+'<\/p><\/div>'+action+'<\/div>';}
  const topics=[
    {title:'用畫布完成 Block、Top 與 Visio',desc:'名稱直接輸入、調整排列、點兩端接線，再看 Top 結構成圖。',tags:'畫布 縮放 拖曳 visio vbs GUI Top group port 快捷鍵',action:'canvas-guide',label:'查看畫布操作',level:'畫布操作'},
    {title:'完整範本：Top I/O 與接線',desc:'兩個一般示範模組已接好；同一份設計可修改、復原並產生 RTL／gen_top／Empty。',tags:'入門 教學 wire port 接線 gen_top empty',action:'demo',label:'開啟完整範本',level:'01 / 入門'},
    {title:'操作說明與支援範圍',desc:'查詢匯入、接線、位寬、保存、限制與驗證狀態。',tags:'README 支援 限制 保存 載入',action:'readme',label:'開啟 README',level:'操作參考'},
  ];
  function help(query=''){
    const q=query.trim().toLowerCase(),found=topics.filter(t=>(t.title+' '+t.desc+' '+t.tags).toLowerCase().includes(q));
    return heading('HELP & EXAMPLES','需要時，找到剛好的說明。','先從完整範本看懂接線，再依需要查閱操作與工具說明。')+'<label class="ux-help-search">搜尋主題<input id="ux-help-search" placeholder="例如：入門、8 通道、define、org…" value="'+esc(query)+'"><\/label><div class="ux-help-grid">'+found.map(t=>'<article class="ux-help-card"><span class="ux-kicker">'+t.level+'<\/span><h3>'+t.title+'<\/h3><p>'+t.desc+'<\/p><button data-action="'+t.action+'">'+t.label+' →<\/button><\/article>').join('')+'<\/div>'+(!found.length?'<p class="a-note">沒有符合的主題。<\/p>':'')+'<details class="a-reference-details"><summary>更多工程參考<\/summary><div class="a-actions"><\/div><\/details>';
  }
  function deliveryChoices(kind){return '<div class="ux-delivery-choice" aria-label="選擇產物"><button data-action="ux-delivery" data-kind="company" aria-pressed="'+(kind==='company')+'"><strong>工作包 工作檔案<\/strong><span>建議下載。FPGA／ASIC 雙分支 RTL、org 與執行腳本。<\/span><\/button><button data-action="ux-delivery" data-kind="rtl" aria-pressed="'+(kind==='rtl')+'"><strong>只取目前單一組態 Verilog<\/strong><span>僅下載目前編輯中的 Top；子模組需另外提供。<\/span><\/button><\/div>';}
  function home(p,options={}){
    const exists=options.hasWork||p.modules.length||p.instances.length||p.nets.length;
    return '<main class="ux-home fg-home"><div class="fg-home-content"><div class="fg-home-mark" aria-hidden="true">WIU / TOP ASSEMBLY<\/div><h1>從兩個模組，<br>走完 gen_top 流程。<\/h1><p>Top I/O 與兩個原始模組已完整接好。<br>從正常接線到 Empty 覆寫，最後帶走可執行的工具包。<\/p><div class="fg-home-primary"><button class="a-primary" data-action="'+(exists?'ux-resume':'learning-start')+'">'+(exists?'繼續 '+esc(p.top):'開啟完整範本')+' →<\/button><span>'+(exists?'保留目前的設定，接著做。':'原始兩模組 · 接線 / Empty / 執行交付')+'<\/span><\/div><div class="fg-home-secondary"><button data-action="ux-new">建立我的設計<\/button><button data-action="load">開啟已保存的專案<\/button>'+(exists?'<button data-action="learning-start">開啟完整範本<\/button>':'')+'<\/div><p class="fg-home-note">完整工具與手冊都在「說明」。離線使用，資料留在本機。<\/p><\/div><\/main>';
  }
  function navigation(p,tab){
    const current=tab==='ports'&&!p.instances.length?0:stage(tab);
    return '<nav class="fg-workflow-nav" aria-label="設計流程">'+[['setup','建立設計'],['modules','放入模組'],['connections','完成接線'],['check','檢查設計'],['bundle','取得成果']].map(([id,label],i)=>'<button data-tab="'+id+'"'+(current===i?' aria-current="step"':'')+'><span>'+(i+1)+'<\/span><strong>'+label+'<\/strong><\/button>').join('')+'<\/nav>';
  }
  function contextTabs(){return '';}
  const toolItems=[
    ['專案','建立新的 Top','從既有 RTL 或 Top 介面開始','ux-new','new 新建'],
    ['專案','開啟專案','恢復名稱、接線與導讀進度','load','json 載入 load'],
    ['專案','儲存專案','下載下次可以繼續編輯的 JSON','save','json 保存'],
    ['來源與模組','匯入 RTL','讀入 .v／.sv，更新或加入子模組','import-rtl','bottom up source'],
    ['來源與模組','定義暫代子模組','RTL 還沒完成，先列介面並放入 instances','flow-module-interface','top down stub placeholder'],
    ['來源與模組','增加多個相同模組','同一份 RTL，建立多個 instances','flow-instances','8 cemac core 重複 批次'],
    ['接線','接腳與連線','逐一設定接法；也可切到批次表格','tab:connections','pin 常數 constant 空接 open 浮接 切片'],
    ['接線','Top 對外接腳','新增或修改 input／output／inout','tab:ports','io port'],
    ['接線','內部接線','命名並宣告模組之間的 wire','tab:nets','net 線名 中間 wire'],
    ['接線','訊號運算','反相、拼接、切片與 assign','tab:assigns','reset 反向 expression'],
    ['接線','建議同名接線','先看建議與位寬，再選擇套用','suggest','auto connect 自動 同名'],
    ['條件與參數','Defines 條件與位寬','編輯巨集、include 與 ASIC／FPGA 組態','tab:defines','define macro ifdef asic fpga'],
    ['條件與參數','Top 參數','設定 parameter／localparam','flow-parameters','parameter localparam'],
    ['成果','檢查設計','定位未接、位寬、驅動等問題','tab:check','error warning 驗證'],
    ['成果','下載 Verilog','取得目前單一組態的 Top RTL','tab:export','download .v'],
    ['成果','RTL 與外部工具工作包','工作包 雙模式 RTL、org 與英文 README','tab:bundle','下載 zip output cfg gen_empty'],
    ['gen_top','匯入既有 org','帶入接線指令並核對子模組','import-org','load .org'],
    ['gen_top','進階 org 指令','保留原文與設定輸出格式','tab:advanced','format directive c_code'],
    ['介面圖','開啟介面圖','原有繪圖、分組、RTL 收合與 Visio 匯出','diagram-open','vbs svg 摺疊 折疊 rtl diagram'],
            ['說明','開啟完整範本','已接好 Top I/O、兩模組、Empty cfg 與公司腳本','demo','tutorial guide 教學'],
    ['說明','README 操作說明','查閱操作方式與支援範圍','readme','文件'],
  ];
  // The action ID and its label are shared by the canvas, delivery panel and search.
  // scope selects where an action runs; subject commands ask which object first.
  const commands={
    'graph-add':['＋ Instance','將模組放入 Top','副本 新增 加入 instance','graph'],
    'graph-start-at-pin':['從這個接腳接線','在 Top 點選想開始接線的 pad','接腳 pad 修改綁定 改接','pin'],
    'pin-connect':['設定接腳綁定','從選取的 instance 接腳設定用途','pin 設定 常數 空接 浮接 綁定','pin'],
    'graph-group-ports':['查看組內接腳','在圖面點選 Group 或從追蹤 Group 選組別','分組 註解 group 成員','group'],
    'graph-connect-mode':['接線模式','在 Top 選起點和終點','連接 pin pad 導線','graph'],
    'graph-table':['連線表','用表格檢查或批次設定接線','接線表 綁定 bindings 批次','graph'],
    'graph-crossing-review':['圖面檢查','定位跳線、線距、pad 與 Block 問題','幾何 跨線 弧橋 跳線 線距 間距 重疊 座標','graph'],
    'graph-repair-jumps':['局部修復跳線與線距','在圖面檢查中定位並修復','橋 接線衝突 排線 繞線','review'],
    'graph-optimize':['重新自動走線','重新計算並取代已儲存的手動轉折','重新最佳化走線 重排 重新排線 繞線','layout'],
    'graph-arrange':['整理 Block 與 Top ports','重新排列 Block 和 Top ports 的位置','整理排列 排版 模組佈局','layout'],
    'graph-wire-edit':['調整走線','拖曳或用方向鍵微調轉折點','手動 線段 走線 轉角 折點','graph'],
    'graph-groups':['群組與顏色','開啟群組配色與追蹤面板','Group 顏色 配色','graph'],
    'graph-monochrome':['黑白','切換彩色或黑白圖面','單色 顯示','graph'],
    'graph-labels':['線名','切換 net 名稱顯示','訊號名稱 隱藏 標示','graph'],
    'graph-route':['切換直角／曲線','切換圖面路線形狀','智慧直角 線型 曲線','graph'],
    'graph-fullscreen':['全螢幕','切換 Top 接線圖全螢幕','全屏 畫布','graph'],
    'graph-visio-routed':['下載 Visio .vbs','匯出 Top 原生可編輯接線圖','下載 VBS Visio 跳線 接點 原生','graph'],
    'instance-delete':['從 Top 移除此顆','選擇要移除的 instance 並核對受影響的綁定','刪除 移除 submodule block 清除 實例','instance'],
    'instance-edit':['Instance 參數','選擇一顆 instance 調整名稱或參數','命名 參數 覆寫 parameter','instance'],
    'module-delete':['從專案移除模組','選擇模組定義並核對使用情況','刪除 移除 子模組 設計圖 介面圖 sub-module RTL 來源','module'],
    'bundle-show-files':['查看／複製工作檔','開啟工作包的檔案清單與個別預覽','預覽 複製 完整內容 org cfg sha-256 SHA256 單獨下載','bundle']
  };
  function commandLabel(action){return commands[action][0];}
  function commandButton(action,{label,id,pressed,title,className,disabled}={}){
    return '<button type="button" data-action="'+esc(action)+'"'+(id==null?'':' data-id="'+esc(id)+'"')+
      (pressed==null?'':' aria-pressed="'+Boolean(pressed)+'"')+(title?' title="'+esc(title)+'"':'')+
      (className?' class="'+esc(className)+'"':'')+(disabled?' disabled':'')+'>'+esc(label??commandLabel(action))+'</button>';
  }
  function tools(){
    const extra=Object.entries(commands).map(([id,[label,desc,tags,scope]])=>[
      scope==='bundle'?'交付':scope==='module'?'模組定義':scope==='instance'?'Top Instance':'Top 接線圖',label,desc,id,tags,scope]);
    return '<p>搜尋要做的事，例如移除模組、線距、連線表或複製工作檔。</p><label>搜尋功能<input id="fg-tool-search" type="search" placeholder="搜尋功能或工程用語" autocomplete="off"></label><div class="fg-tool-list">'+
      toolItems.concat(extra).map(([group,title,desc,action,tags,scope])=>'<button class="fg-tool-row" '+
        (action.startsWith('tab:')?'data-tool-tab="'+esc(action.slice(4)):'data-tool-action="'+esc(action))+'"'+
        (scope?' data-tool-scope="'+scope+'"':'')+' data-tool-search="'+esc([group,title,desc,tags].join(' ').toLowerCase())+'"><span>'+esc(group)+'</span><strong>'+esc(title)+'</strong><small>'+esc(desc)+'</small><b aria-hidden="true">→</b></button>').join('')+
      '</div><p id="fg-tool-empty" hidden>沒有符合的功能。試試「接線」、「模組」或「下載」。</p>';
  }
  return {esc,titles,stage,home,navigation,contextTabs,heading,help,deliveryChoices,commandLabel,commandButton,tools};
});
