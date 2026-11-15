(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIUFocusGuide = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const sequence = ['intro','clock','data','enable','done','debug','ready'];
  const arr = value => Array.isArray(value) ? value : [];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function dependency(name, file) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') return require('./' + file);
    throw Error('分步引導需要先載入 ' + name + '。');
  }
  const C = () => dependency('WIUCore','assembly-core.js');
  const A = () => dependency('WIUActions','assembly-actions.js');
  const L = () => dependency('WIULearning','assembly-learning.js');
  const lesson = () => dependency('WIULesson','assembly-lesson.js');
  const copy = {
    intro:{short:'認識範例',title:'接起兩個模組，做出第一個 Top',purpose:'兩個模組已經放好了，還沒有接線。接下來每次只做一件事：讓資料來源送出一個 8-bit 值，再把接收端的結果帶到外面。',effect:'五次接線後，你會拿到 Top 與兩個子模組的 Verilog。',code:'learn_source.v\nlearn_sink.v',button:'開始接線 →',why:'learn_source 在 enable = 1 時輸出 A5，learn_sink 的 done 表示資料是否非零。這是組合邏輯練習，不是等待若干週期的握手協定；clk 用來練習共用輸入，模組內部沒有使用它。'},
    clock:{short:'共同時脈',title:'把時脈接到兩個模組',purpose:'時脈從 Top 外部進來。這一步建立一個 clk 輸入，讓兩個模組共用它。',effect:'新增 Top 輸入 clk，接上兩個 clk 接腳。',code:'input clk;\n// 兩個 instance 都接上：\n.clk(clk)',button:'接上時脈，下一步 →',why:'同一條 Top input 可以連到多個輸入接腳。這兩個教學模組的 clk 是介面練習，內部邏輯沒有使用時脈。'},
    data:{short:'內部資料線',title:'讓資料流到接收端',purpose:'來源的 data 是輸出，接收端的 data 是輸入，兩邊都是 8-bit。建立一條內部線，把它們接起來。',effect:'新增 data_link[7:0]，連接兩個 data 接腳。',code:'wire [7:0] data_link;\n// 兩個 instance 都接上：\n.data(data_link)',button:'接上資料線，下一步 →',why:'wire 是 Top 裡面的接線。它只負責把兩個接腳接起來，不會增加 Top 的對外輸入或輸出。'},
    enable:{short:'固定值',title:'讓資料來源保持啟用',purpose:"enable 是 1-bit 輸入。把它固定接到 1，來源模組就會送出 8'hA5。",effect:"enable 接到 1'b1，不需新增 wire。",code:".enable(1'b1)",button:'設為固定 1，下一步 →',why:"1'b1 的第一個 1 是位寬，b 代表二進位，最後的 1 是數值。這裡由原始 RTL 推導出資料會是 A5；網站沒有在這一步執行模擬。"},
    done:{short:'對外輸出',title:'把結果帶到 Top 外面',purpose:'接收端的 done 表示資料是否非零。建立同名的 Top 輸出，讓外部電路讀到這個結果。',effect:'新增 Top 輸出 done，接上接收模組的 done。',code:'output done;\n// learn_sink_inst：\n.done(done)',button:'引出 done，下一步 →',why:'Top output 是把內部訊號送到外部的接腳。這裡 done = |data，是組合邏輯的非零判斷，不代表某個多週期運算已經結束。'},
    debug:{short:'刻意留空',title:'把不用的輸出明確留空',purpose:'這個練習不需要讀取 debug。在 Top 的 instance 上將它留空，不增加對外接腳。',effect:'Top 保留 .debug()；learn_source.v 內的 assign debug = enable 仍保留。',code:'// learn_source_inst：\n.debug()',button:'將 debug 留空，完成接線 →',why:'留空表示父層沒有接這個輸出，不是把子模組內的訊號清除或接成 0。子模組內 debug 仍等於 enable；正常 Top 的 org 會寫 conn "" learn_source.debug。這裡留空的是輸出，一般輸入不能隨意浮接。'},
    ready:{short:'下載成果',title:'第一個 Top，完成了',purpose:'接線完成了。先用正常 Top 跑這個例子；檔案直接放在 ZIP 根目錄，公開版不附內部參考資料。',effect:'正常與 Empty 都有 FPGA／ASIC 雙分支。兩者用途不同，請依下方說明選用。',code:'learning_top.v\nlearn_source.v\nlearn_sink.v\nlearning_top.wiu.json',button:'下載工作包 →',why:'網站檢查了接線與輸出格式。公司 gen_top 仍需在公司環境執行；這裡沒有執行公司工具，也沒有執行 RTL 模擬。'}
  };
  const expectedPins = {
    clock:[['learn_source','clk','input',1],['learn_sink','clk','input',1]],
    data:[['learn_source','data','output',8],['learn_sink','data','input',8]],
    enable:[['learn_source','enable','input',1]],
    done:[['learn_sink','done','output',1]],
    debug:[['learn_source','debug','output',1]]
  };
  function failure(message) { return Error(message + ' 請切換「自由編輯」檢查；引導不會覆寫你的設定。'); }
  function fixtureIssue(project) {
    const config=project && project.defineConfig;
    if(arr(config && config.rows).length || arr(config && config.includes).length) return '這份設計已加入 Defines 或引用檔。請在自由編輯的「交付」下載完整工具包，帶齊目前的組態與來源。';
    if (!project || project.learning !== 'first-top-v1') return '目前專案不是這個入門練習。';
    const modules=arr(project.modules),instances=arr(project.instances),files=arr(project.rtlSources);
    if(modules.length!==2 || instances.length!==2) return '這個導讀需要原本兩個模組各一份，目前模組或 instance 數量已改變。';
    const references=L().makeProject().modules;
    for(const fixture of L().fixtures()) {
      const sourceFiles=files.filter(file=>file.name===fixture.filename);
      // A parsed module.source is not the complete source file. Never infer a
      // missing original from that partial representation or silently restore it.
      if(sourceFiles.length!==1) return '找不到唯一的原始 '+fixture.filename+'；請在自由編輯匯入原始教學 RTL。';
      if(sourceFiles[0].text!==fixture.source) return fixture.filename+' 已與原始教學內容不同，導讀無法保證範例行為。';
      const definitions=modules.filter(mod=>mod.name===fixture.name),placed=instances.filter(instance=>instance.module===fixture.name);
      if(definitions.length!==1 || placed.length!==1) return '原本的 '+fixture.name+' 模組或 instance 已被替換。';
      if(placed[0].name!==fixture.name+'_inst' || Object.keys(placed[0].parameters || {}).length) return fixture.name+' 的 instance 名稱或參數已與教學不同。';
      const reference=references.find(mod=>mod.name===fixture.name),ports=arr(definitions[0].ports);
      if(arr(definitions[0].parameters).length || ports.length!==reference.ports.length || reference.ports.some(expected=>{
        const candidates=ports.filter(port=>port.name===expected.name),actual=candidates[0];
        return candidates.length!==1 || actual.direction!==expected.direction || String(actual.range || '').replace(/\s/g,'')!==expected.range || !!actual.signed!==!!expected.signed;
      })) return fixture.name+' 的接腳或參數已與原始教學介面不同。';
    }
    return '';
  }
  function create() {
    const project = L().makeProject();
    project.rtlSources = L().fixtures().map(file => ({name:file.filename,text:file.source}));
    project.instances = project.modules.map((mod,index) => ({id:'guide_instance_' + (index+1),name:mod.name+'_inst',module:mod.name,parameters:{}}));
    project.learningGuide = {version:59,step:'intro'};
    return project;
  }
  function validation(project) {
    const seen = new Set(), errors = [];
    for (const target of ['verilog','org']) {
      for (const issue of C().validate(project,{target})) {
        if (issue.severity !== 'error') continue;
        const key = issue.code + '\n' + issue.message;
        if (!seen.has(key)) { seen.add(key);errors.push(issue); }
      }
    }
    return errors;
  }
  function current(project) {
    const blockedReason=fixtureIssue(project);
    const tasks = L().tasks(project), first = tasks.slice(0,5).find(task => !task.done);
    const metadata = project && project.learningGuide;
    let id = metadata && metadata.version === 59 && sequence.includes(metadata.step) ? metadata.step : first ? first.id : 'ready';
    // Back lets the learner revisit completed explanations. A stale forward
    // cursor cannot bypass a connection removed in free editing or after load.
    if (first && sequence.indexOf(id) > sequence.indexOf(first.id)) id = first.id;
    const task = tasks.find(task => task.id === id) || null;
    const errors = id === 'ready' && !blockedReason ? validation(project) : [];
    const ready = !blockedReason && id === 'ready' && !!task && task.done && errors.length === 0;
    const result = Object.assign({},copy[id],{id,index:sequence.indexOf(id),total:sequence.length,task,done:!blockedReason && !!task && task.done,ready,errors,blocked:!!blockedReason,blockedReason});
    if (id === 'intro' && arr(project.connections).length) {
      result.purpose = '這個 Top 用兩個模組練習五種接線：來源送出 8-bit 資料，接收端把結果帶到外部。你已做的接線會保留，可以按下一步回看各步驟。';
      result.effect = '回看說明會保留目前接線；需要撤銷修改時，請使用復原。';
      result.button = '回看接線步驟 →';
    }
    if (id === 'ready') {
      result.code = ''+(project.top || 'learning_top')+'.v  (FPGA / ASIC)\nREADME.md\n<top>.v.org / <top>.output.cfg';
      if (!ready) {
        result.title = '接線已完成，還有設定需要檢查';
        result.purpose = '目前的五項教學接線都有設定，但設計檢查發現問題。先到自由編輯修正，再回來下載。';
        result.effect = errors.length + ' 項錯誤需要處理；目前不提供完成下載。';
        result.button = '到自由編輯修正 →';
      }
    }
    if (blockedReason) {
      result.title='你的設計已與教學範例不同';
      result.purpose=blockedReason;
      result.effect='目前專案與接線都已保留。請到自由編輯繼續，或重新開始原始範例。';
      result.code='';
      result.button='到自由編輯檢查 →';
      result.why='導讀的行為說明是依照原始兩個教學模組撰寫的。來源或介面改變後，需要先檢查實際內容；工具不會自動覆寫你的檔案、補回來源或重做接線。';
    }
    return result;
  }
  function expectedRows(project, step) {
    const rows = A().pinRows(project), Capi = C();
    return expectedPins[step.id].map(([moduleName,portName,direction,width]) => {
      const instances = arr(project.instances).filter(instance => instance.module === moduleName);
      const modules = arr(project.modules).filter(mod => mod.name === moduleName);
      if (instances.length !== 1 || modules.length !== 1) throw failure('找不到唯一的 '+moduleName+' 模組與 instance。');
      const ports = arr(modules[0].ports).filter(port => port.name === portName);
      if (ports.length !== 1) throw failure(moduleName+'.'+portName+' 接腳不存在或重複。');
      const resolved = Capi.resolveParameters(modules[0],instances[0].parameters || {});
      let actualWidth = null;
      try { actualWidth = Capi.parseRange(ports[0].range,resolved.context).width; } catch (_) {}
      if (resolved.errors.length || ports[0].direction !== direction || actualWidth !== width || ports[0].signed) throw failure(moduleName+'.'+portName+' 的方向或位寬已與教學不同。');
      return rows.find(row => row.instance === instances[0].id && row.port.name === portName);
    });
  }
  function matchesExpression(expr, task) {
    try {
      if (task.kind === 'open') return expr.trim() === '';
      if (task.kind === 'constant') {
        const info = C().expressionInfo(expr,[],{});
        return info.ast.kind === 'literal' && info.width === 1 && info.value === 1n && !info.unsized;
      }
      const parsed = C().parseExpression(expr);
      return parsed.kind === 'ref' && parsed.name === task.name;
    } catch (_) { return false; }
  }
  function compatibleNet(project, task) {
    const matches = arr(project.nets).filter(net => net.name.toLowerCase() === task.name.toLowerCase());
    if (!matches.length) return null;
    const net = matches[0];
    if (matches.length !== 1 || net.name !== task.name || net.direction !== task.direction || String(net.range || '').replace(/\s/g,'') !== task.range || net.signed) {
      throw failure('已有不同的 '+task.name+' 宣告，無法直接套用這一步。');
    }
    return net;
  }
  function nextNetId(project, stepId) {
    const used = new Set(arr(project.nets).map(net => net.id));
    const base = 'guide_net_'+stepId;
    let value = base, serial = 2;
    while (used.has(value)) value = base+'_'+serial++;
    return value;
  }
  function advance(project, stepId) {
    if (!project || project.learning !== 'first-top-v1') throw failure('目前專案不是這個入門練習。');
    const step = current(project);
    if (step.blocked) throw failure(step.blockedReason);
    if (step.id !== stepId) throw Error('目前是「'+step.short+'」步驟；請使用目前畫面的下一步按鈕。');
    if (step.id === 'ready') throw Error('接線引導已到最後一步，請使用下載或自由編輯。');
    const next = A().clone(project);
    if (step.id !== 'intro') {
      const beforeErrors = new Set(validation(project).map(issue => issue.code+'\n'+issue.message));
      const rows = expectedRows(next,step), task = step.task;
      if (task.keys.length !== rows.length) throw failure('這一步的接腳與教學不一致。');
      const changes = [];
      // Check the entire operation before adding any declaration or binding.
      for (const row of rows) {
        const bindings = arr(next.connections).filter(conn => conn.instance === row.instance && conn.port === row.port.name);
        if (bindings.length > 1) throw failure(row.instanceName+'.'+row.port.name+' 有重複接線。');
        if (bindings.length && !matchesExpression(bindings[0].expr,task)) throw failure(row.instanceName+'.'+row.port.name+' 已有其他接法。');
        if (!bindings.length) changes.push({instance:row.instance,port:row.port.name,expr:task.expr});
      }
      const net = task.kind === 'net' ? compatibleNet(next,task) : null;
      if (task.kind === 'net' && !net) next.nets.push({id:nextNetId(next,step.id),name:task.name,direction:task.direction,range:task.range,signed:false,comment:'',group:''});
      A().applyConnections(next,changes);
      if (!L().tasks(next).find(task => task.id === step.id).done) throw failure('這一步套用後仍未符合教學接線。');
      const newError = validation(next).find(issue => !beforeErrors.has(issue.code+'\n'+issue.message));
      if (newError) throw failure('這一步會造成設計錯誤：'+newError.message);
    }
    next.learningGuide = {version:59,step:sequence[step.index+1]};
    return next;
  }
  function back(project) {
    const step = current(project), next = A().clone(project);
    next.learningGuide = {version:59,step:sequence[Math.max(0,step.index-1)]};
    return next;
  }
  function render(project) {
    const step = current(project);
    const action = step.blocked ? 'ux-free-edit' : step.id === 'ready' ? step.ready ? 'guide-download' : 'ux-free-edit' : 'guide-next';
    const pending = A().pinRows(project).filter(row => row.status === 'unbound').length;
    const status = step.blocked ? '' : step.id === 'intro' ? '兩個模組已放入 · '+(pending ? pending+' 個接腳尚未設定' : '所有接腳已設定，接線保留') : step.id === 'ready' ? step.ready ? '✓ 接線與輸出格式檢查通過' : '需要修正設計設定' : step.done ? '✓ 這一步已完成，再按下一步不會重複接線' : '';
    // Keep the existing, tested live connection drawing; no endpoint table or
    // extra task navigation is added to the focused lesson screen.
    const diagram = step.blocked ? '' : lesson().diagram(project,{taskId:step.id}).replace(/<p class="ux-map-note">[\s\S]*?<\/p>/,'');
    const errors = step.errors.length ? '<p class="fg-error" role="status">'+esc(step.errors[0].message)+(step.errors.length>1?'（另有 '+(step.errors.length-1)+' 項）':'')+'<\/p>' : '';
    let delivery='';
    if(step.ready){const output=dependency('WIUBundle','assembly-bundle.js').validate(project).outputs.find(o=>o.port==='done');delivery='<div class="fg-delivery-check" aria-label="下載前核對正常與 Empty"><p><strong>正常 Top<\/strong>：<code>enable = 1<\/code> → <code>data = A5<\/code> → <code>done = 1<\/code>；不用的輸出保留 <code>.debug()<\/code>。這是依範例 RTL 推導的結果。<\/p><p><strong>可選 Empty<\/strong>：<code>output.cfg<\/code> 的 <code>done = '+esc(output?.expr||'未通過檢查')+'<\/code> 是'+(output?.defaulted?'未另行設定時的預設暫代值':'你自訂的暫代值')+'，只用於 <code>.empty.v<\/code>。Empty 沒有子模組，也沒有 debug 接腳。<\/p><p>解壓後先讀 README.md；也可在「交付」核對接線。重新生成使用公司既有工具。<\/p><\/div>';}
    return '<section class="fg-screen'+(step.blocked?' is-blocked':'')+'" aria-label="第一個 Top 分步引導"><div class="fg-progress" aria-label="目前第 '+(step.index+1)+' 步，共 7 步"><span class="fg-step-label">第一個 Top · '+(step.index+1)+' / 7<\/span><ol>'+sequence.map((id,index)=>'<li class="'+(id===step.id?'is-current':index<step.index?'is-past':'is-upcoming')+'"'+(id===step.id?' aria-current="step"':'')+'><span aria-hidden="true">'+(index<step.index?'✓':index+1)+'<\/span><span class="fg-step-name">'+copy[id].short+'<\/span><\/li>').join('')+'<\/ol><\/div>'+
      '<div class="fg-grid"><div class="fg-copy"><h2 tabindex="-1">'+esc(step.title)+'<\/h2><p class="fg-purpose">'+esc(step.purpose)+'<\/p><div class="fg-preview"><strong>'+(step.blocked?'保留你的工作':step.id==='ready'?'你會帶走':step.done?'這一步的結果':'這一步會做到')+'<\/strong><p>'+esc(step.effect)+'<\/p>'+(delivery||(step.code?'<pre><code>'+esc(step.code)+'<\/code><\/pre>':''))+'<\/div>'+(status?'<p class="fg-status" role="status">'+status+'<\/p>':'')+errors+
      '<div class="fg-actionbar"><button class="a-primary fg-next" data-action="'+action+'" data-id="'+step.id+'">'+esc(step.button)+'<\/button>'+
      (step.index>0?'<button class="fg-back" data-action="guide-back" title="只回看說明，保留目前所有接線">← 上一步說明（保留接線）<\/button>':'')+'<\/div>'+
      '<details class="fg-explain"><summary>為什麼這樣接？<\/summary><p>'+esc(step.why)+'<\/p><\/details>'+
      '<div class="fg-secondary">'+(action!=='ux-free-edit'?'<button data-action="ux-free-edit">自己操作這一步<\/button>':'')+(step.id==='ready'?'<button data-action="save">帶走可繼續編輯的專案<\/button><button data-action="ux-delivery" data-kind="company">查看檔案與組態<\/button>':'')+'<\/div>'+
      (step.id==='ready'&&!step.blocked?'<p class="fg-verification">網站檢查已完成；此處未執行 RTL 模擬或公司 gen_top。<\/p>':'')+'<\/div>'+(diagram?'<div class="fg-diagram">'+diagram+'<\/div>':'')+'<\/div><\/section>';
  }
  function createTemplate(){
    let p=create();
    for(let i=0;i<7 && current(p).id!=='ready';i++)p=advance(p,current(p).id);
    if(!current(p).ready)throw Error('示範接線檢查失敗。');
    p=dependency('WIUWorkbook','workbook.js').asUser(p);
    p.top='example_top';p.workbook.example='public-example';
    p.workbook.graphPositions=Object.fromEntries(p.instances.map((inst,i)=>[inst.id,{x:360,y:140+i*240}]));
    return p;
  }
  return {createTemplate,create,createLegacy:create,current,advance,back,render};
});
