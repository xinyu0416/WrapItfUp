(function(root, factory) {
  const api = factory();
  root.WIUOrgLayout = api;
  if (typeof module === 'object') module.exports = api;
})(globalThis, function() {
  'use strict';
  const titles = {
    format: 'gen_top constraint',
    inst: 'Module instantiate',
    io: 'Input/output/inout',
    wire: 'Wire & signal connection',
    special: 'Special case'
  };
  const rule = '// ' + '='.repeat(68);
  const clean = value => String(value ?? '').replace(/[\x00-\x1f\u2028\u2029]/g, ' ').trim();
  const sectionTitle = line => {
    const text = line.trim().replace(/^\/\/\s*/, '').replace(/\s*\/\/\s*$/, '').trim();
    return Object.keys(titles).find(key => titles[key] === text);
  };
  function heading(key, layout) {
    const notes = Array.isArray(layout?.notes?.[key]) ? layout.notes[key] : [];
    return [rule, '// ' + titles[key], rule, ...notes.map(note => '// | ' + clean(note))];
  }
  function splitGroup(group) {
    return clean(group).split(' / ').filter(Boolean);
  }
  function groupLines(previous, next) {
    const a = splitGroup(previous), b = splitGroup(next);
    if (!b.length) return previous ? ['//==== (ungrouped) ====//'] : [];
    let common = 0;
    while (common < a.length && common < b.length && a[common] === b[common]) common++;
    // Restate the parent when leaving a child, so the next member reads correctly.
    if (common === b.length && common < a.length) common--;
    return b.slice(common).map((name, i) => '  '.repeat(common + i) + '//==== ' + name + ' ====//');
  }
  // Called only on passive lines outside generated, preprocessor and C regions.
  function reader() {
    const layout = {notes:{}, before:{}, tail:{}};
    let section = '', path = [], pending = [];
    function finish() {
      if (pending.length) layout.tail[section] = pending;
      pending = []; path = [];
    }
    function consume(line) {
      if (!/^\s*\/\//.test(line)) return false;
      const key = sectionTitle(line);
      if (key) {finish(); section = key; return true;}
      if (/^\s*\/\/\s*={5,}\s*(?:\/\/)?\s*$/.test(line)) return true;
      if (!section) return false;
      const group = /^(\s*)\/\/={3,}\s*(.*?)\s*={3,}\/\/\s*$/.exec(line);
      if (group && (section === 'io' || section === 'wire')) {
        const depth = Math.min(path.length, Math.floor(group[1].replace(/\t/g, '  ').length / 2));
        path = group[2] === '(ungrouped)' ? [] : path.slice(0, depth).concat(group[2]);
        pending.push(path.join(' / '));return true;
      }
      const text = line.trim().slice(2).replace(/\s*\/\/\s*$/, '').trim().replace(/^\|\s?/, '');
      if (text) (layout.notes[section] ||= []).push(text);
      return true;
    }
    function member() {
      const prior = pending.slice(0, -1);
      pending = [];
      return {group:path.join(' / '),prior};
    }
    return {layout, consume, member, finish};
  }
  return {clean, heading, groupLines, reader, titles};
});
