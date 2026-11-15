(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WIUActions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const LIMIT = 10 * 1024 * 1024;
  const ARRAY_LIMIT = 100000;
  const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;
  const arr = value => Array.isArray(value) ? value : [];
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function clone(value) {
    const seen = new Set();
    let budget = LIMIT;
    function copy(item, depth) {
      if (depth > 80) throw Error('專案資料層數過深。');
      if (item === null || typeof item === 'boolean') return item;
      if (typeof item === 'number') {
        if (!Number.isFinite(item)) throw Error('專案包含無效數字。');
        return item;
      }
      if (typeof item === 'string') {
        budget -= item.length;
        if (budget < 0) throw Error('專案超過 10 MB 資料上限。');
        return item;
      }
      if (!item || typeof item !== 'object') throw Error('專案必須是 JSON 相容資料。');
      if (seen.has(item)) throw Error('專案包含循環參照。');
      seen.add(item);
      let out;
      if (Array.isArray(item)) {
        if (item.length > ARRAY_LIMIT) throw Error('專案項目數量過多。');
        budget -= item.length;
        if (budget < 0) throw Error('專案超過 10 MB 資料上限。');
        out = item.map(entry => copy(entry, depth + 1));
      } else {
        if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw Error('專案包含非 JSON 物件。');
        const keys = Object.keys(item);
        if (keys.length > ARRAY_LIMIT) throw Error('專案欄位數量過多。');
        out = {};
        for (const key of keys) {
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw Error('專案包含不安全的欄位名稱。');
          budget -= key.length + 1;
          if (budget < 0) throw Error('專案超過 10 MB 資料上限。');
          out[key] = copy(item[key], depth + 1);
        }
      }
      seen.delete(item);
      return out;
    }
    return copy(value, 0);
  }
  function listField(obj, key) {
    if (!own(obj, key) || obj[key] === null) obj[key] = [];
    if (!Array.isArray(obj[key])) throw Error(key + ' 必須是陣列。');
    return obj[key];
  }
  function stringField(obj, key, fallback) {
    if (!own(obj, key)) obj[key] = fallback === undefined ? '' : fallback;
    if (typeof obj[key] !== 'string') throw Error(key + ' 必須是文字。');
  }
  function objectRows(rows, label) {
    rows.forEach(row => { if (!record(row)) throw Error(label + ' 每個項目必須是物件。'); });
  }
  function uniqueIds(rows, prefix) {
    const used = new Set(rows.filter(row => own(row, 'id')).map(row => row.id));
    const checked = new Set(); let serial = 1;
    rows.forEach(row => {
      if (!own(row, 'id') || row.id === '') {
        while (used.has(prefix + serial)) serial++;
        row.id = prefix + serial++; used.add(row.id);
      }
      if (typeof row.id !== 'string' || !row.id.trim() || row.id.includes('::')) throw Error('項目 ID 必須是非空且不含 :: 的文字。');
      if (checked.has(row.id)) throw Error('項目 ID 重複：' + row.id);
      checked.add(row.id);
    });
  }
  function normalizeProject(value) {
    if (!record(value)) throw Error('請載入 WIU Top 組裝專案 JSON。');
    const p = clone(value);
    if (own(p, 'schema') && p.schema !== 1) throw Error('不支援此組裝專案版本。');
    p.schema = 1;
    stringField(p, 'top', 'wrapper_top');
    stringField(p, 'advanced'); stringField(p, 'prelude');
    const D=root.WIUDefines||(typeof require==='function'?require('./assembly-defines.js'):null);
    if(D)p.defineConfig=D.normalize(p.defineConfig);
    const B=root.WIUBundle||(typeof require==='function'?require('./assembly-bundle.js'):null);
    if(B&&p.bundleConfig)p.bundleConfig=B.normalize(p.bundleConfig);
    listField(p,'rtlSources');objectRows(p.rtlSources,'RTL sources');
    p.rtlSources.forEach(f=>{stringField(f,'name');stringField(f,'text');});
    ['modules', 'instances', 'nets', 'connections', 'assigns', 'formats'].forEach(key => listField(p, key));
    ['modules', 'instances', 'nets', 'connections', 'assigns'].forEach(key => objectRows(p[key], key));
    p.modules.forEach(mod => {
      stringField(mod, 'name'); stringField(mod, 'source');
      listField(mod, 'ports'); listField(mod, 'parameters'); listField(mod, 'issues');
      objectRows(mod.ports, 'ports'); objectRows(mod.parameters, 'parameters');
      mod.ports.forEach(port => {
        stringField(port, 'name'); stringField(port, 'direction'); stringField(port, 'range'); stringField(port, 'comment');
        if (!own(port, 'signed')) port.signed = false;
        if (typeof port.signed !== 'boolean') throw Error('port signed 必須是布林值。');
      });
      mod.parameters.forEach(param => {stringField(param, 'name'); stringField(param, 'value');});
    });
    p.instances.forEach(inst => {
      stringField(inst, 'name'); stringField(inst, 'module');
      if (!own(inst, 'parameters')) inst.parameters = {};
      if (!record(inst.parameters)) throw Error('instance parameters 必須是物件。');
      Object.keys(inst.parameters).forEach(name => stringField(inst.parameters, name));
    });
    p.nets.forEach(net => {
      stringField(net, 'name'); stringField(net, 'range'); stringField(net, 'direction', 'wire');
      stringField(net, 'comment'); stringField(net, 'group');
      if (!own(net, 'signed')) net.signed = false;
      if (typeof net.signed !== 'boolean') throw Error('net signed 必須是布林值。');
    });
    p.connections.forEach(conn => {
      stringField(conn, 'instance'); stringField(conn, 'port');
      if (!own(conn, 'expr')) throw Error('連線缺少 expr；空接請明確使用空字串。');
      stringField(conn, 'expr');
    });
    p.assigns.forEach(assign => {stringField(assign, 'target'); stringField(assign, 'expr');});
    p.formats.forEach(format => {if (typeof format !== 'string') throw Error('format 必須是文字。');});
    [['instances','i_'],['nets','n_'],['connections','c_'],['assigns','a_']].forEach(([field,prefix]) => uniqueIds(p[field], prefix));
    const endpoints = new Set();
    p.connections.forEach(c => {
      const key = c.instance + '::' + c.port;
      if (endpoints.has(key)) throw Error('同一 pin 有重複連線：' + key);
      endpoints.add(key);
    });
    if (own(p, 'parameters')) {
      if (Array.isArray(p.parameters)) {
        objectRows(p.parameters, 'top parameters');
        p.parameters.forEach(param => {stringField(param, 'name'); stringField(param, 'value');});
      } else if (record(p.parameters)) Object.keys(p.parameters).forEach(name => stringField(p.parameters, name));
      else throw Error('top parameters 必須是陣列或物件。');
    }
    return p;
  }
  // The lexer keeps literals, comments, strings, escaped identifiers and macros
  // opaque. Renaming clk never modifies clk_en, 8'hc1, or a comment mentioning clk.
  function visitIdentifiers(expression, visit) {
    const source = String(expression == null ? '' : expression);
    const token = /\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|\\\S+(?:\s|$)|`[A-Za-z_][A-Za-z0-9_$]*|(?:\d[\d_]*)?\s*'[sS]?[bBoOdDhH]\s*[0-9a-fA-FxXzZ?_]+|'[01xXzZ]|[A-Za-z_][A-Za-z0-9_$]*/g;
    return source.replace(token, (text, index) => {
      if (!IDENT.test(text)) return text;
      // Dotted references are unsupported by native generation and must not be
      // rewritten as if an instance/port name were a top-level net.
      const before = source.slice(0, index).match(/\S(?=\s*$)/);
      const after = source.slice(index + text.length).match(/^\s*(\S)/);
      if ((before && before[0] === '.') || (after && after[1] === '.')) return text;
      return visit(text);
    });
  }
  function identifierSet(expression) {
    const set = new Set();
    visitIdentifiers(expression, name => {set.add(name); return name;});
    return set;
  }
  function core() {
    if (root && root.WIUCore) return root.WIUCore;
    if (typeof require === 'function') {try {return require('./assembly-core.js');} catch (_) {}}
    return null;
  }
  function hasOpaqueReferences(project, api) {
    if (project.importLayoutUnsafe) return true;
    const unresolved = project.importUnresolved == null ? [] : (Array.isArray(project.importUnresolved) ? project.importUnresolved : [project.importUnresolved]);
    if (unresolved.some(item => !item || item.blocking !== false)) return true;
    const advanced = String(project.advanced || ''), prelude = String(project.prelude || '');
    if (!advanced.trim() && !prelude.trim()) return false;
    // Use the exporter classifier itself: ordinary/disabled comments are inert,
    // but an active "// realtek" directive (including c_code) is executable
    // gen_top input. A comments-only import should remain editable.
    if (api && typeof api.validate === 'function' && typeof api.newProject === 'function') {
      const probe = api.newProject(); probe.advanced = advanced; probe.prelude = prelude;
      return api.validate(probe, {target:'verilog'}).some(issue => ['RAW_SEMANTICS','RAW_COMMENT_SYNTAX','RAW_BOUNDARY'].includes(issue.code));
    }
    // Without the common classifier, fail closed rather than reinterpret company
    // syntax differently from validation/export.
    return true;
  }
  function renameNet(project, id, name, options={}) {
    const net = arr(project.nets).find(n => n.id === id);
    if (!net) throw Error('找不到要重新命名的 net。');
    if(arr(project.defineConfig&&project.defineConfig.rows).some(r=>r.enabled!==false&&identifierSet(r.value).has(net.name)))throw Error('這條線由 define 值引用；請先調整 Defines 中的對應值，再重新命名，避免隱藏的連線失效。');
    const api = core();
    if (typeof name !== 'string' || !IDENT.test(name) || (api && !api.validName(name))) throw Error('請使用有效的 Verilog net 名稱。');
    if (name === net.name) return project;
    if (arr(project.nets).some(n => n !== net && n.name.toLowerCase() === name.toLowerCase())) throw Error('Net 名稱重複或只有大小寫不同。');
    if (hasOpaqueReferences(project, api)) {
      throw Error('專案含有未解析的原始內容；請先處理進階內容，再重新命名 net，以免遺漏參照。');
    }
    const old = net.name;
    const replace = expr => visitIdentifiers(expr, ident => ident === old ? name : ident);
    const changes = arr(project.connections).map(c => [c, replace(c.expr)]);
    const assignments = arr(project.assigns).map(a => [a, replace(a.target), replace(a.expr)]);
    net.name = name;
    if(!options.automatic)net.nameBinding={mode:'custom',lastGenerated:name};
    changes.forEach(([c,expr]) => {c.expr = expr;});
    assignments.forEach(([a,target,expr]) => {a.target = target; a.expr = expr;});
    arr(project.bundleConfig&&project.bundleConfig.outputTies).forEach(tie=>{if(tie.port===old)tie.port=name;tie.expr=replace(tie.expr);});
    return project;
  }
  function pinRows(project) {
    const modules = new Map(arr(project.modules).map(m => [m.name,m]));
    const connections = new Map(arr(project.connections).map(c => [c.instance + '::' + c.port,c]));
    return arr(project.instances).flatMap(instance => {
      const mod = modules.get(instance.module);
      return arr(mod && mod.ports).map(port => {
        const key = instance.id + '::' + port.name, connection = connections.get(key);
        const expr = connection ? connection.expr : undefined;
        return {key,instance:instance.id,instanceId:instance.id,instanceName:instance.name,module:instance.module,port,connection:connection || null,expr,status:connection ? (String(expr).trim() ? 'connected' : 'open') : 'unbound'};
      });
    });
  }
  function connectSuggestions(project, selectedKeys) {
    const selected = selectedKeys == null ? null : new Set(selectedKeys);
    const nets = new Map(arr(project.nets).map(n => [n.name,n]));
    return pinRows(project).filter(row => row.status === 'unbound' && (!selected || selected.has(row.key)) && ['input','output','inout'].includes(row.port.direction) && nets.has(row.port.name))
      .map(row => ({instance:row.instance,port:row.port.name,expr:row.port.name}));
  }
  function applyConnections(project, changes) {
    if (!Array.isArray(changes)) throw Error('連線變更必須是陣列。');
    const endpoints = new Set(pinRows(project).map(row => row.key));
    changes.forEach(change => {
      if (!record(change) || typeof change.instance !== 'string' || typeof change.port !== 'string' || (change.expr !== null && typeof change.expr !== 'string')) throw Error('連線變更格式錯誤。');
      if (!endpoints.has(change.instance + '::' + change.port)) throw Error('找不到連線的 pin：' + change.instance + '.' + change.port);
    });
    const connections = arr(project.connections).slice();
    const used = new Set(connections.map(c => c.id)); let next = 1;
    changes.forEach(change => {
      const index = connections.findIndex(c => c.instance === change.instance && c.port === change.port);
      if (change.expr === null) {if (index >= 0) connections.splice(index, 1); return;}
      if (index >= 0) connections[index] = Object.assign({}, connections[index], {expr:change.expr});
      else {
        while (used.has('c_' + next)) next++;
        const id = 'c_' + next++; used.add(id);
        connections.push({id,instance:change.instance,port:change.port,expr:change.expr});
      }
    });
    project.connections = connections;
    return project;
  }
  function netUsage(project, netName) {
    const api=core();if(api&&api.projectView)project=api.projectView(project);
    const driverPins = [], sinkPins = [];
    pinRows(project).forEach(row => {
      if (row.status !== 'connected' || !identifierSet(row.expr).has(netName)) return;
      const ref = {kind:'pin',key:row.key,label:row.instanceName + '.' + row.port.name,instance:row.instance,port:row.port.name};
      if (row.port.direction === 'output' || row.port.direction === 'inout') driverPins.push(ref);
      if (row.port.direction === 'input' || row.port.direction === 'inout') sinkPins.push(ref);
    });
    arr(project.assigns).forEach((a,index) => {
      const ref = {kind:'assign',key:a.id || 'assign_' + index,label:'assign ' + a.target};
      if (identifierSet(a.target).has(netName)) driverPins.push(ref);
      if (identifierSet(a.expr).has(netName)) sinkPins.push(ref);
    });
    const net = arr(project.nets).find(n => n.name === netName);
    return {drivers:driverPins.length,sinks:sinkPins.length,driverPins,sinkPins,externalDriver:!!net && ['input','inout'].includes(net.direction),externalSink:!!net && ['output','inout'].includes(net.direction)};
  }
  function removeInstance(project, id) {
    const instance = arr(project.instances).find(item => item.id === id);
    if (!instance) throw Error('找不到要移除的 instance。');
    const api = core();
    const resolved = api && api.projectView ? api.projectView(project) : project;
    const candidates = new Set();
    for (const row of pinRows(resolved)) {
      if (row.instance !== id || !['output','inout'].includes(row.port.direction)) continue;
      for (const name of identifierSet(row.expr)) candidates.add(name);
    }
    const removed = {instance, connections:[], disconnected:[], assigns:[], nets:[]};
    removed.connections = arr(project.connections).filter(connection => connection.instance === id);
    project.instances = project.instances.filter(item => item.id !== id);
    project.connections = project.connections.filter(connection => connection.instance !== id);
    const opaque = hasOpaqueReferences(project, api);
    if (!opaque) {
      // A receiver still bound to a deleted sole driver looks connected to the
      // next wiring operation. Detach only nets whose remaining driver set is
      // empty. Shared drivers and Top input/inout sources retain their fanout.
      for (const name of candidates) {
        if (!project.nets.some(net => net.name === name)) continue;
        const usage = netUsage(project, name);
        if (usage.externalDriver || usage.drivers) continue;
        const sinks = new Set(usage.sinkPins.filter(pin => pin.kind === 'pin').map(pin => pin.key));
        project.connections = project.connections.filter(connection => {
          if (!sinks.has(connection.instance + '::' + connection.port)) return true;
          removed.disconnected.push(connection);
          return false;
        });
        // The graph creates these aliases when exposing an already-connected
        // output as a Top port. Follow only those aliases, preserving authored
        // assigns and the declarations of external ports.
        const aliases = project.assigns.filter(assign =>
          assign.id === 'graph_assign_' + assign.target && IDENT.test(assign.target) && assign.expr.trim() === name);
        for (const alias of aliases) {
          removed.assigns.push(alias);
          candidates.add(alias.target);
        }
        const aliasIds = new Set(aliases.map(alias => alias.id));
        project.assigns = project.assigns.filter(assign => !aliasIds.has(assign.id));
      }
    }
    const references = arr(project.defineConfig && project.defineConfig.rows).filter(row => row.enabled !== false).map(row => row.value)
      .concat(arr(project.bundleConfig && project.bundleConfig.outputTies).flatMap(tie => [tie.port,tie.expr]));
    project.nets = project.nets.filter(net => {
      if (net.direction !== 'wire' || net.nameBinding?.mode !== 'instance-port' || net.nameBinding.instanceId !== id) return true;
      const usage = netUsage(project, net.name);
      if (!opaque && !usage.drivers && !usage.sinks && !references.some(value => identifierSet(value).has(net.name))) {
        removed.nets.push(net);
        return false;
      }
      // A later instance may reuse this ID. A surviving shared/custom wire
      // must not inherit that new instance's generated-name ownership.
      net.nameBinding = {mode:'custom',lastGenerated:net.name};
      return true;
    });
    project.orgEdited = true;
    return removed;
  }
  return {clone,normalizeProject,renameNet,pinRows,connectSuggestions,applyConnections,netUsage,removeInstance};
});
