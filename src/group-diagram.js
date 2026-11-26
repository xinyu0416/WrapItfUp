/* A presentation view of electrically connected, named interface groups. */
(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const core = root.WIUCore || (typeof require === 'function' && require('./assembly-core'));
  const palette = ['#176d70', '#465d9c', '#9b5732', '#685193', '#3c7154', '#95546e'];
  const intersects = (a, b) => !a || !b || Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);

  function model(project, index) {
    const pairs = new Map();
    const groups = new Map();
    const nodes = new Map();
    const effective = core.projectView(project);
    const netByName = new Map(effective.nets.map(net => [net.name, net]));
    const parameters = Array.isArray(effective.parameters) ? effective.parameters
      : Object.entries(effective.parameters || {}).map(([name, value]) => ({name, value}));
    const context = core.resolveParameters({parameters}, {}).context;
    const endpoints = new Map();
    function directRefs(expr) {
      if (netByName.has(expr)) return [{name:expr, bits:null}];
      if (!expr) return [];
      try {
        const ast = core.parseExpression(core.expandDefines(expr, project));
        const wiring = n => ['ref','select','literal'].includes(n.kind)
          || (['concat','repeat'].includes(n.kind) && n.parts.every(wiring));
        if (!wiring(ast)) return [];
        return core.expressionInfo(ast, netByName, context).refs.map(r => ({name:r.name, bits:[r.low,r.high]}));
      } catch { return []; }
    }
    for (const e of index.ends) {
      if (!e.group || e.group === '—') continue;
      const owner = e.top ? ['top'] : ['instance', e.instance];
      const key = JSON.stringify([...owner, e.group]);
      if (!groups.has(key)) groups.set(key, {key, owner: JSON.stringify(owner), instance: e.instanceName, name: e.group});
      nodes.set(e.key, groups.get(key));
      for (const ref of directRefs(e.top ? e.net.name : e.expr)) {
        if (!endpoints.has(ref.name)) endpoints.set(ref.name, {drivers:[], loads:[]});
        const record = endpoints.get(ref.name);
        const endpoint = {key:e.key, role:e.role, bits:ref.bits};
        if (e.role !== 'sink') record.drivers.push(endpoint);
        if (e.role !== 'source') record.loads.push(endpoint);
      }
    }
    function connect(from, to, name, duplex) {
      const a = nodes.get(from.key), b = nodes.get(to.key);
      if (!a || !b || from.key === to.key || !intersects(from.bits, to.bits)) return;
      const key = JSON.stringify([a.key, b.key].sort());
      if (!pairs.has(key)) pairs.set(key, {a, b, forward:false, reverse:false, nets:new Set()});
      const edge = pairs.get(key);
      if (duplex || edge.a === a) edge.forward = true;
      if (duplex || (edge.b === a && edge.a !== a)) edge.reverse = true;
      edge.nets.add(name);
    }
    // Follow whole-net aliases of identical bit ranges only. Logic expressions
    // and slicing assigns have intermediate semantics and no direct group edge.
    const aliases = new Map(), ambiguous = new Set();
    for (const assign of effective.assigns) {
      const source = netByName.get(assign.expr.trim()), dest = netByName.get(assign.target.trim());
      if (!source || !dest || String(source.range||'').trim() !== String(dest.range||'').trim()) continue;
      if (aliases.has(dest.name)) ambiguous.add(dest.name);
      aliases.set(dest.name, source.name);
    }
    for (const net of effective.nets) {
      const sinks = endpoints.get(net.name)?.loads;
      if (!sinks?.length) continue;
      let source = net.name;
      const seen = new Set();
      while (!seen.has(source)) {
        seen.add(source);
        for (const driver of endpoints.get(source)?.drivers || []) {
          for (const sink of sinks) connect(driver, sink, net.name, driver.role === 'inout' && sink.role === 'inout');
        }
        if (!aliases.has(source) || ambiguous.has(source)) break;
        source = aliases.get(source);
      }
    }
    const edges = [...pairs.values()];
    const active = new Set(edges.flatMap(e => [e.a.key,e.b.key]));
    return {title:project.top, groups:[...groups.values()].filter(g=>active.has(g.key)), edges};
  }

  function makeBank(edges, side) {
    const owners = new Map(), anchors = new Map();
    for (const e of edges) {
      const g = e[side];
      if (!owners.has(g.owner)) owners.set(g.owner, {name:g.instance, groups:new Map()});
      const groups = owners.get(g.owner).groups;
      if (!groups.has(g.key)) groups.set(g.key, {name:g.name, edges:[]});
      groups.get(g.key).edges.push(e);
    }
    let y=84;
    for (const owner of owners.values()) {
      owner.y=y; y+=48;
      for (const g of owner.groups.values()) {
        const first=y;
        for (const e of g.edges) {anchors.set(e,y); y+=64;}
        g.y=(first+y-64)/2;
      }
      owner.height=y-owner.y-12; y+=16;
    }
    return {owners,anchors,bottom:y};
  }

  function draw(data, hidden = new Set()) {
    const edges=data.edges.filter(e=>!hidden.has(e.a.key)&&!hidden.has(e.b.key));
    if (!edges.length) return {svg:'',count:0};
    const left=makeBank(edges,'a'),right=makeBank(edges,'b');
    // Separate tracks on both axes. Straighten aligned pairs. On the right,
    // offset only anchors that would otherwise coincide with another wire.
    const occupied=new Map([...left.anchors].map(([edge,y])=>[y,edge]));
    const tracks=[], routes=edges.map(edge=>{
      const start=left.anchors.get(edge), slot=right.anchors.get(edge);
      const end=occupied.has(slot)&&occupied.get(slot)!==edge?slot+32:slot;
      right.anchors.set(edge,end);
      const low=Math.min(start,end),high=Math.max(start,end);
      let lane=0;
      if(start!==end){
        while(tracks[lane]?.some(r=>low<=r.high+12&&high>=r.low-12))lane++;
        (tracks[lane]??=[]).push({low,high});
      }
      return {edge,start,end,lane};
    });
    for (const owner of right.owners.values()) {
      for (const group of owner.groups.values()) {
        group.y = (right.anchors.get(group.edges[0]) + right.anchors.get(group.edges.at(-1))) / 2;
      }
    }
    const chars=s=>Array.from(s).reduce((n,c)=>n+(c.codePointAt(0)>255?1.8:1),0);
    const card=Math.max(190, ...edges.flatMap(e=>[e.a,e.b]).map(g=>Math.max(chars(g.instance),chars(g.name))*8.8+58));
    const margin=26, x1=margin+card, x2=x1+140+tracks.length*22, width=Math.max(x2+card+margin,chars(data.title)*15+2*margin), height=Math.max(left.bottom,right.bottom)+24;
    const rendered=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(data.title)} Group wiring" font-family="Arial, Microsoft JhengHei, Noto Sans CJK TC, sans-serif"><title>${escape(data.title)} · Group 接線圖</title><rect width="100%" height="100%" fill="white"/><text x="26" y="35" fill="#173142" font-size="22" font-weight="bold">${escape(data.title)}</text><text x="26" y="58" fill="#506670" font-size="13">Group 接線圖 · ${edges.length} 組連線 · × 數字為 net 數</text>`];
    for (const [bank,x] of [[left,margin],[right,x2]]) {
      for (const owner of bank.owners.values()) {
        rendered.push(`<rect x="${x}" y="${owner.y}" width="${card}" height="${owner.height}" rx="8" fill="#f6f9fa" stroke="#b9cbd0"/><text x="${x+16}" y="${owner.y+24}" font-size="15" font-weight="bold" fill="#173142">${escape(owner.name)}</text>`);
        let previousLast;
        for (const group of owner.groups.values()) {
          const first=bank.anchors.get(group.edges[0]);
          if (previousLast!==undefined) {
            const split=(previousLast+first)/2;
            rendered.push(`<path d="M${x+10} ${split}h${card-20}" stroke="#dce6e9" fill="none"/>`);
          }
          previousLast=bank.anchors.get(group.edges.at(-1));
          rendered.push(`<text x="${x+16}" y="${group.y+6}" font-size="14" fill="#36535d">${escape(group.name)}</text>`);
        }
      }
    }
    const colors=new Map();
    for(const {edge,start,end,lane} of routes){
      if(!colors.has(edge.a.key))colors.set(edge.a.key,palette[colors.size%palette.length]);
      const color=colors.get(edge.a.key),x=x1+52+lane*22;
      const path=start===end?`M${x1} ${start}H${x2}`:`M${x1} ${start}H${x}V${end}H${x2}`;
      const direction=edge.forward && edge.reverse ? ' ↔ ' : edge.forward ? ' → ' : ' ← ';
      rendered.push(`<g><title>${escape(edge.a.instance+' / '+edge.a.name)}${direction}${escape(edge.b.instance+' / '+edge.b.name)} · ${edge.nets.size} nets</title><path d="${path}" fill="none" stroke="white" stroke-width="6"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.3"/>`);
      if(edge.forward)rendered.push(`<path d="M${x2-9} ${end-5}l9 5 -9 5" fill="${color}"/>`);
      if(edge.reverse)rendered.push(`<path d="M${x1+9} ${start-5}l-9 5 9 5" fill="${color}"/>`);
      rendered.push(`<text x="${x1+10}" y="${start-6}" font-size="12" fill="${color}">×${edge.nets.size}</text></g>`);
    }
    return {svg:rendered.join('')+'</svg>',count:edges.length,width,height};
  }
  const api={model,draw};root.WIUGroupDiagram=api;
  if(typeof module==='object')module.exports=api;
})(globalThis);
