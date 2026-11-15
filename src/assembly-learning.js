(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIULearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const arr = value => Array.isArray(value) ? value : [];
  function dependency(name, file) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') return require('./' + file);
    throw Error('教學需要先載入 ' + name + '。');
  }
  const core = () => dependency('WIUCore', 'assembly-core.js');
  const parser = () => dependency('WIUParser', 'assembly-parser.js');

  function fixtures() {
    return [
      {
        name:'learn_source', filename:'learn_source.v',
        source:[
          '// WIU learning fixture: fixed sample data, enabled by a one-bit input.',
          '// clk is an interface example; this combinational fixture does not use it.',
          'module learn_source (',
          '  input clk,',
          '  input enable,',
          '  output [7:0] data,',
          '  output debug',
          ');',
          "  assign data = enable ? 8'hA5 : 8'h00;",
          '  assign debug = enable;',
          'endmodule', ''
        ].join('\n')
      },
      {
        name:'learn_sink', filename:'learn_sink.v',
        source:[
          '// WIU learning fixture: report whether any input data bit is high.',
          '// clk is an interface example; this combinational fixture does not use it.',
          'module learn_sink (',
          '  input clk,',
          '  input [7:0] data,',
          '  output done',
          ');',
          '  assign done = |data;',
          'endmodule', ''
        ].join('\n')
      }
    ];
  }
  function makeProject() {
    const C = core(), P = parser(), project = C.newProject();
    project.top = 'learning_top';
    project.learning = 'first-top-v1';
    for (const file of fixtures()) {
      const parsed = P.parseRtl(file.source);
      if (parsed.issues.some(issue => issue.severity === 'error') || parsed.modules.length !== 1 || parsed.modules[0].name !== file.name) {
        throw Error('教學 RTL 解析失敗：' + file.filename);
      }
      project.modules.push(Object.assign({}, parsed.modules[0], {filename:file.filename}));
    }
    // Import confirmation in the ordinary UI creates the instances. The tutorial
    // must not silently assemble a finished design on the learner's behalf.
    return project;
  }
  function legacyTasks(value) {
    const project = value || {}, C = core();
    const modules = arr(project.modules), instances = arr(project.instances);
    function endpoint(moduleName, portName) {
      const matches = instances.filter(instance => instance.module === moduleName);
      const definitions = modules.filter(module => module.name === moduleName);
      if (matches.length !== 1 || definitions.length !== 1) return null;
      const ports = arr(definitions[0].ports).filter(port => port.name === portName);
      if (ports.length !== 1) return null;
      return {instance:matches[0],module:definitions[0],port:ports[0],key:matches[0].id + '::' + portName};
    }
    function width(range, context) {
      try {return C.parseRange(range, context || {}).width;} catch (_) {return null;}
    }
    function endpointMatches(ep, direction, expectedWidth) {
      if (!ep || ep.port.direction !== direction) return false;
      const resolved = C.resolveParameters(ep.module, ep.instance.parameters || {});
      return !resolved.errors.length && width(ep.port.range, resolved.context) === expectedWidth;
    }
    function binding(ep) {
      if (!ep) return null;
      const matches = arr(project.connections).filter(c => c.instance === ep.instance.id && c.port === ep.port.name);
      return matches.length === 1 && typeof matches[0].expr === 'string' ? matches[0] : null;
    }
    function topContext() {
      const parameters = Array.isArray(project.parameters) ? project.parameters : Object.entries(project.parameters || {}).map(([name,value]) => ({name,value}));
      const resolved = C.resolveParameters({parameters}, {});
      return resolved.errors.length ? null : resolved.context;
    }
    const context = topContext();
    function matchesNet(name, direction, expectedWidth, eps) {
      const nets = arr(project.nets).filter(net => net.name === name);
      if (nets.length !== 1 || nets[0].direction !== direction || context === null || width(nets[0].range, context) !== expectedWidth) return false;
      return eps.every(ep => {
        const connection = binding(ep);
        if (!connection || !connection.expr.trim()) return false;
        try {
          const ast = C.parseExpression(connection.expr);
          // A whole-net reference is the operation being taught. Parentheses are
          // accepted by the parser, but arithmetic or unrelated filled fields
          // must not make the lesson look complete.
          return ast.kind === 'ref' && ast.name === name;
        } catch (_) {return false;}
      });
    }
    const sourceClk = endpoint('learn_source','clk'), sinkClk = endpoint('learn_sink','clk');
    const sourceData = endpoint('learn_source','data'), sinkData = endpoint('learn_sink','data');
    const enable = endpoint('learn_source','enable'), done = endpoint('learn_sink','done'), debug = endpoint('learn_source','debug');
    const keys = eps => eps.every(Boolean) ? eps.map(ep => ep.key) : [];
    const list = [
      {
        id:'clock',title:'兩個 clk 共用一個 Top input',
        why:'時脈從最外層進入，接到兩個子模組；Top input 是這條 net 的外部來源。',
        kind:'net',keys:keys([sourceClk,sinkClk]),name:'clk',range:'',direction:'input',expr:'clk',
        done:endpointMatches(sourceClk,'input',1) && endpointMatches(sinkClk,'input',1) && matchesNet('clk','input',1,[sourceClk,sinkClk])
      },
      {
        id:'data',title:'宣告 data_link[7:0]，接起資料來源與接收端',
        why:'兩個子模組之間的線需要有名字與位寬。內部 wire 不會出現在 Top ports。',
        kind:'net',keys:keys([sourceData,sinkData]),name:'data_link',range:'[7:0]',direction:'wire',expr:'data_link',
        done:endpointMatches(sourceData,'output',8) && endpointMatches(sinkData,'input',8) && matchesNet('data_link','wire',8,[sourceData,sinkData])
      },
      {
        id:'enable',title:"把 enable 接到 1'b1",
        why:'常數也需要明確位寬；這裡接高電位，讓範例資料來源啟用。',
        kind:'constant',keys:keys([enable]),expr:"1'b1",done:false
      },
      {
        id:'done',title:'把 done 引出為 Top output',
        why:'接收端產生的完成訊號要提供給外部使用，所以要宣告並連到 Top output。',
        kind:'net',keys:keys([done]),name:'done',range:'',direction:'output',expr:'done',
        done:endpointMatches(done,'output',1) && matchesNet('done','output',1,[done])
      },
      {
        id:'debug',title:'明確將 debug 留空',
        why:'沒有使用的輸出可以明確留空；尚未設定連線與確認不接，是不同的狀態。',
        kind:'open',keys:keys([debug]),expr:'',
        done:endpointMatches(debug,'output',1) && !!binding(debug) && binding(debug).expr.trim() === ''
      }
    ];
    if (endpointMatches(enable,'input',1) && binding(enable)) {
      try {
        const info = C.expressionInfo(binding(enable).expr, [], {});
        list[2].done = info.ast.kind === 'literal' && info.width === 1 && info.value === 1n && !info.unsized;
      } catch (_) {}
    }
    let valid = false;
    if (list.every(task => task.done)) {
      try {
        // "all" gives the combined overview. Target-specific checks additionally
        // prevent declaring success where only one of the two exports is valid.
        valid = ['all','verilog','org'].every(target => !C.validate(project,{target}).some(issue => issue.severity === 'error'));
      } catch (_) {valid = false;}
    }
    list.push({
      id:'ready',title:'檢查後匯出 Verilog 與 gen_top org',
      why:'前面五項都完成且兩種輸出通過 WIU 檢查後，就能比較同一份連線資料的兩種輸出；公司 gen_top 仍需另行執行確認。',
      kind:'export',keys:[],done:list.every(task => task.done) && valid
    });
    return list;
  }
  function tasks(project){return legacyTasks(project);}
  function isLearning(project){return !!project&&project.learning==='first-top-v1';}
  return {fixtures,makeProject,tasks,isLearning};
});
