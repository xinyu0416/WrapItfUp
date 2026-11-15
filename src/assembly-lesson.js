(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIULesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function dependency(name, file) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') return require('./' + file);
    throw Error('練習需要先載入 ' + name + '。');
  }
  const learning = () => dependency('WIULearning', 'assembly-learning.js');
  const core = () => dependency('WIUCore', 'assembly-core.js');
  const actions = () => dependency('WIUActions', 'assembly-actions.js');
  const copy = {
    clock:{short:'時脈',title:'把同一個時脈接進兩個模組',intro:'先建立 Top 的 clk 輸入，再把它分別接到資料來源和接收端。這兩個接腳會共用同一條線。',effect:'Top 會增加 1 個輸入 clk，兩個子模組的 clk 都接到它。',button:'設定共同時脈',term:'Top input 是從設計外部進入的訊號。'},
    data:{short:'內部接線',title:'把資料來源接到接收端',intro:'來源模組的 data 輸出和接收模組的 data 輸入都是 8-bit。用一條有名字的內部線把兩端接起來。',effect:'建立 data_link[7:0]，連接兩個 data 接腳；不會增加 Top 對外接腳。',button:'建立這條資料線',term:'內部線（wire）只在這個 Top 裡傳遞訊號。'},
    enable:{short:'固定值',title:'讓資料來源保持啟用',intro:"enable 接到 1'b1，代表這個 1-bit 輸入固定為 1。原始範例會因此輸出 8'hA5。",effect:"learn_source.enable 會接到 1'b1；不需要為常數另外建立一條 wire。",button:'設定 enable 為 1',term:"1'b1 中，第一個 1 是位寬，b 表示二進位，最後的 1 是數值。"},
    done:{short:'對外輸出',title:'把結果帶到 Top 外面',intro:'接收模組的 done 表示輸入資料是否有任一個 bit 為 1。把它接到 Top output，外面才能看到這個結果。',effect:'Top 會增加 1 個輸出 done，來源是 learn_sink.done。',button:'建立 done 輸出',term:'Top output 是從內部模組送到設計外部的訊號。'},
    debug:{short:'刻意留空',title:'明確留下用不到的輸出',intro:'這次不使用來源模組的 debug 輸出。請明確設為留空，讓工具知道這是你的決定，而不是漏接。',effect:'輸出 RTL 會保留 .debug()；這個接腳不再算作尚未設定。',button:'將 debug 設為留空',term:'「尚未設定」還需要決定；「刻意留空」是已確認不用。'},
    ready:{short:'完成',title:'把你的第一個 Top 帶走',intro:'你已經走過外部輸入、內部接線、固定值、對外輸出與刻意留空。接下來檢查設計，再取得需要的檔案。',effect:'Verilog 與 gen_top org 都來自同一份接線設定。公司 gen_top 的執行結果仍需在公司環境確認。',button:'檢查並取得成果',term:'下載專案 JSON，之後就能從目前的接線繼續。'}
  };

  function currentTask(project, taskId) {
    const tasks = learning().tasks(project);
    return tasks.find(task => task.id === taskId) || tasks.slice(0,5).find(task => !task.done) || tasks[tasks.length - 1];
  }
  function endpoint(project, moduleName, portName) {
    const instances = arr(project.instances).filter(instance => instance.module === moduleName);
    const modules = arr(project.modules).filter(module => module.name === moduleName);
    if (instances.length !== 1 || modules.length !== 1 || arr(modules[0].ports).filter(port => port.name === portName).length !== 1) return null;
    const instance = instances[0], matches = arr(project.connections).filter(connection => connection.instance === instance.id && connection.port === portName);
    const row = actions().pinRows(project).find(row => row.instance === instance.id && row.port.name === portName);
    return {instance,port:portName,row,connection:matches.length === 1 && typeof matches[0].expr === 'string' ? matches[0] : null,ambiguous:matches.length > 1};
  }
  function expectedNetBinding(project, ep, name, direction, range) {
    if (!ep || !ep.connection) return false;
    const nets = arr(project.nets).filter(net => net.name === name);
    if (nets.length !== 1 || nets[0].direction !== direction) return false;
    try {
      const C = core(), parameters = Array.isArray(project.parameters) ? project.parameters : Object.entries(project.parameters || {}).map(([name,value])=>({name,value}));
      const resolved = C.resolveParameters({parameters},{});
      if (resolved.errors.length || C.parseRange(nets[0].range,resolved.context).width !== C.parseRange(range,{}).width) return false;
      const ast = C.parseExpression(ep.connection.expr);return ast.kind === 'ref' && ast.name === name;
    } catch (_) {return false;}
  }
  function status(ep) {
    if (!ep) return {kind:'pending',text:'找不到唯一的模組接腳'};
    if (ep.ambiguous) return {kind:'pending',text:'有重複設定，需要修正'};
    if (!ep.connection) return {kind:'pending',text:'尚未設定'};
    return ep.connection.expr.trim() ? {kind:'connected',text:ep.connection.expr} : {kind:'open',text:'刻意留空'};
  }

  function diagram(project, options) {
    project = project || {};options = options || {};
    const task = currentTask(project, options.taskId), tasks = learning().tasks(project), taskMap = new Map(tasks.map(t => [t.id,t]));
    const sourceClk = endpoint(project,'learn_source','clk'), sinkClk = endpoint(project,'learn_sink','clk');
    const sourceData = endpoint(project,'learn_source','data'), sinkData = endpoint(project,'learn_sink','data');
    const sinkDone = endpoint(project,'learn_sink','done');
    const srcClock = expectedNetBinding(project,sourceClk,'clk','input',''), dstClock = expectedNetBinding(project,sinkClk,'clk','input','');
    const srcData = expectedNetBinding(project,sourceData,'data_link','wire','[7:0]'), dstData = expectedNetBinding(project,sinkData,'data_link','wire','[7:0]');
    const done = expectedNetBinding(project,sinkDone,'done','output','');
    function path(id, part, d, connected) {
      return '<path class="ux-wire '+(connected?'is-connected':'is-pending')+(task.id === id?' is-focus':'')+'" data-lesson-wire="'+id+'-'+part+'" data-connected="'+String(!!connected)+'" d="'+d+'" fill="none" stroke="'+(connected?'#087f8c':'#a8b4c1')+'" stroke-width="'+(task.id===id?'4':'2.5')+'"'+(connected?'':' stroke-dasharray="6 6"')+'/>';
    }
    function pin(x,y,id,connected) {return '<circle class="ux-pin'+(task.id===id?' is-focus':'')+'" cx="'+x+'" cy="'+y+'" r="5" fill="'+(connected?'#087f8c':'#fff')+'" stroke="'+(task.id===id?'#087f8c':'#82919f')+'" stroke-width="2"/>';}
    const dataState = srcData && dstData ? '已連接 · 8-bit' : srcData || dstData ? '一端已接 · 另一端待接' : '待建立 · 8-bit';
    const clockState = srcClock && dstClock ? '兩端已接' : srcClock || dstClock ? '一端待接' : '待接';
    const enableDone = taskMap.get('enable').done, debugDone = taskMap.get('debug').done;
    return '<figure class="ux-lesson-map"><div class="ux-map-heading"><strong>你的接線，正在成形<\/strong><span>Top：<code>'+esc(project.top || 'learning_top')+'<\/code><\/span><\/div>'+
      '<svg class="ux-lesson-svg" viewBox="0 0 760 405" role="img" aria-label="兩個模組的教學接線圖。實線是目前已設定的教學路徑，虛線是待完成路徑。" xmlns="http://www.w3.org/2000/svg">'+
      '<rect class="ux-top-boundary" x="16" y="38" width="728" height="350" rx="18" fill="#f5f8fb" stroke="#dce5ed"/>'+
      '<text class="ux-map-caption" x="35" y="65" font-size="13" fill="#657789">TOP 的內部<\/text>'+
      '<rect class="ux-module" x="190" y="170" width="190" height="155" rx="12" fill="#fff" stroke="#b5c8d7"/>'+
      '<rect class="ux-module" x="490" y="170" width="180" height="155" rx="12" fill="#fff" stroke="#b5c8d7"/>'+
      '<text class="ux-module-title" x="285" y="145" text-anchor="middle" font-size="17" font-weight="700" fill="#193748">資料來源<\/text>'+
      '<text class="ux-module-title" x="580" y="145" text-anchor="middle" font-size="17" font-weight="700" fill="#193748">接收模組<\/text>'+
      '<text class="ux-module-name" x="285" y="197" text-anchor="middle" font-size="14" fill="#657789">learn_source<\/text>'+
      '<text class="ux-module-name" x="580" y="197" text-anchor="middle" font-size="14" fill="#657789">learn_sink<\/text>'+
      path('clock','entry','M 66 105 H 445',srcClock || dstClock)+
      path('clock','source','M 145 105 V 225 H 190',srcClock)+path('clock','sink','M 445 105 V 225 H 490',dstClock)+
      '<text x="66" y="89" font-size="15" fill="#193748">clk · 輸入<\/text><text x="270" y="89" font-size="13" fill="#657789">'+clockState+'<\/text>'+
      path('data','source','M 380 260 H 435',srcData)+path('data','sink','M 435 260 H 490',dstData)+
      '<text class="ux-map-net" x="435" y="239" text-anchor="middle" font-size="14" fill="#193748">data_link<\/text>'+
      '<text class="ux-map-status" x="285" y="350" text-anchor="middle" font-size="13" fill="#657789">'+dataState+'<\/text>'+
      path('enable','value','M 65 285 H 190',enableDone)+
      '<text x="65" y="267" font-size="15" fill="#193748">1&#39;b1<\/text><text x="65" y="308" font-size="12" fill="#657789">'+(enableDone?'已接固定值':'待設固定值')+'<\/text>'+
      path('done','output','M 670 285 H 716',done)+
      '<text x="690" y="263" text-anchor="middle" font-size="15" fill="#193748">done<\/text><text x="690" y="309" text-anchor="middle" font-size="12" fill="#657789">'+(done?'已引出':'待引出')+'<\/text>'+
      path('debug','open','M 380 300 H 413 V 365',debugDone)+
      '<circle cx="413" cy="365" r="5" fill="#f5f8fb" stroke="'+(debugDone?'#087f8c':'#a8b4c1')+'" stroke-width="2"/>'+
      '<text x="427" y="371" font-size="12" fill="#657789">'+(debugDone?'debug：刻意留空':'debug：尚未設定留空')+'<\/text>'+
      '<g class="ux-pin-names" font-size="14" fill="#193748"><text x="204" y="230">clk<\/text><text x="204" y="290">enable<\/text><text x="365" y="265" text-anchor="end">data<\/text><text x="365" y="305" text-anchor="end">debug<\/text><text x="504" y="230">clk<\/text><text x="504" y="265">data<\/text><text x="655" y="290" text-anchor="end">done<\/text><\/g>'+
      pin(190,225,'clock',srcClock)+pin(490,225,'clock',dstClock)+pin(380,260,'data',srcData)+pin(490,260,'data',dstData)+pin(190,285,'enable',enableDone)+pin(670,285,'done',done)+pin(380,300,'debug',debugDone)+
      '<\/svg><figcaption><span class="ux-map-key"><i class="ux-line-solid" aria-hidden="true"><\/i>實線：已接上的教學路徑<\/span><span class="ux-map-key"><i class="ux-line-dashed" aria-hidden="true"><\/i>虛線：預計路徑<\/span><\/figcaption><p class="ux-map-note">圖面呈現接線設定，並非模擬結果。若已改接其他訊號，請以下方目前設定為準。<\/p><\/figure>';
  }

  function render(project, options) {
    project = project || {};options = options || {};
    const tasks = learning().tasks(project), steps = tasks.slice(0,5), task = currentTask(project,options.taskId), text = copy[task.id];
    const complete = steps.filter(step => step.done).length, number = steps.findIndex(step => step.id === task.id)+1;
    const intro = task.kind === 'export' && complete < 5 ? '還有 '+(5-complete)+' 個接線任務未完成。可以返回上方步驟繼續設定，或先查看目前的設計檢查結果。' : text.intro;
    const endpoints = task.keys.map(key => {const row = actions().pinRows(project).find(row => row.key === key);return row ? endpoint(project,row.module,row.port.name) : null;});
    const missing = task.kind !== 'export' && !task.keys.length;
    const current = endpoints.map(ep => {const s = status(ep);return '<div class="ux-binding-row"><code>'+esc(ep ? ep.instance.name+'.'+ep.port : '接腳不存在')+'<\/code><span class="ux-binding-state is-'+s.kind+'">'+(s.kind==='connected'?'<span>已設定：<\/span><code>'+esc(s.text)+'<\/code>':esc(s.text))+'<\/span><\/div>';}).join('');
    return '<section class="ux-lesson" aria-label="第一個 Top 動手練習"><header class="ux-lesson-header"><div><span class="ux-eyebrow">動手練習 · 第一個 Top<\/span><h2>接起兩個模組，完成自己的 Top<\/h2><p>資料來源送出一個 8-bit 值，接收端將「資料是否非零」送到外部。五個小步驟，認識最常用的接線方式。<\/p><\/div><div class="ux-lesson-progress" aria-label="已完成 '+complete+' 個，共 5 個接線任務"><strong>'+complete+'<span> / 5<\/span><\/strong><span>接線任務完成<\/span><\/div><\/header>'+
      '<nav class="ux-lesson-steps" aria-label="練習步驟">'+steps.map((step,i)=>'<button data-action="ux-lesson-task" data-id="'+step.id+'" class="ux-lesson-step'+(step.id===task.id?' is-current':'')+(step.done?' is-done':'')+'"'+(step.id===task.id?' aria-current="step"':'')+'><span class="ux-step-number">'+(step.done?'✓':String(i+1).padStart(2,'0'))+'<\/span><span>'+copy[step.id].short+'<\/span><small>'+(step.done?'已完成':step.id===task.id?'目前步驟':'待完成')+'<\/small><\/button>').join('')+'<\/nav>'+
      '<div class="ux-lesson-layout"><div class="ux-lesson-copy"><div class="ux-task-brief"><span class="ux-eyebrow">'+(task.kind==='export'?'最後一步':'步驟 '+number+' / 5')+'<\/span><h3>'+text.title+'<\/h3><p>'+intro+'<\/p><div class="ux-task-effect"><strong>這一步會改變什麼？<\/strong><p>'+text.effect+'<\/p><\/div>'+
      (task.done && task.kind!=='export'?'<p class="ux-task-complete">✓ 這項接線已完成。你可以查看設定，或選擇其他步驟。<\/p>':'')+
      (missing?'<p class="ux-task-warning" role="status">這個練習需要資料來源與接收模組各一份。請先完成模組建立，或到自由編輯檢查重複的 instances。<\/p>':'')+
      (task.kind==='export' && !task.done?'<p class="ux-task-warning" role="status">目前設計仍有需要完成或檢查的項目。下一步會列出原因。<\/p>':'')+
      '<button class="a-primary ux-lesson-primary" data-action="learning-next" data-id="'+task.id+'">'+(missing?'檢查練習模組':task.done && task.kind!=='export'?'查看這項接線':text.button)+' <span aria-hidden="true">→<\/span><\/button><p class="ux-task-tip">'+text.term+'<\/p><\/div>'+
      '<div class="ux-lesson-secondary"><button data-action="ux-free-edit">切換自由編輯<\/button><button data-action="learning-stop">結束引導<\/button><\/div><\/div><div class="ux-lesson-visual">'+diagram(project,{taskId:task.id})+
      (current?'<section class="ux-current-bindings" aria-label="此步驟的實際接線"><h4>此步驟的目前設定<\/h4>'+current+'<\/section>':'')+
      '<\/div><\/div><details class="ux-lesson-explain"><summary>這兩個範例模組實際做什麼？<\/summary><div><p>原始 <code>learn_source<\/code>：<code>enable = 1<\/code> 時，<code>data = 8\'hA5<\/code>；否則是 <code>8\'h00<\/code>。<code>debug<\/code> 跟隨 <code>enable<\/code>。<\/p><p>原始 <code>learn_sink<\/code>：<code>done = |data<\/code>，資料任一 bit 為 1 時就輸出 1；這不是等待若干週期的握手協定。<\/p><p><code>clk<\/code> 僅用於練習共用輸入，這兩個組合邏輯範例沒有使用時脈。接線完成後，原始範例的資料為 A5、done 為 1；這是依 RTL 推導的行為，不是網站執行的模擬。<\/p><\/div><\/details><\/section>';
  }
  return {render,diagram,currentTask};
});
