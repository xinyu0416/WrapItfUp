import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function bundle() {
  let html = await readFile(path.join(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<script([^>]*?) src="\.\/(src\/[^"<>]+\.js)"><\/script>|<link rel="stylesheet"([^>]*?) href="\.\/(src\/[^"<>]+\.css)">/g)];
  if (!refs.length) throw Error('No source references found');
  for (const match of refs) {
    const source = match[2] || match[4];
    if (source.includes('..')) throw Error('Source path must remain inside src/');
    const text = await readFile(path.join(root, source), 'utf8');
    const tag = match[2] ? 'script' : 'style';
    if (new RegExp('</'+tag, 'i').test(text)) throw Error('Unsafe closing tag in '+source);
    html = html.replace(match[0], () => `<${tag}${match[1] || match[3] || ''}>${text}</${tag}>`);
  }
  if (/<(?:script|link)\b[^>]*(?:src|href)="\.\/src\//.test(html)) throw Error('Unbundled source reference');
  return html;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const offline = process.argv.includes('--offline');
  const dir = offline ? 'preview' : 'dist';
  const name = offline ? 'WrapItfUp-r125-offline.html' : 'index.html';
  const html = await bundle();
  await mkdir(path.join(root, dir), {recursive:true});
  await writeFile(path.join(root, dir, name), html);
  if (!offline) await writeFile(path.join(root, dir, '.nojekyll'), '');
  console.log(`${dir}/${name}: ${Buffer.byteLength(html)} bytes; all scripts and styles embedded`);
}
