import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outDir=join(root,'dist');
if(dirname(outDir)!==root) throw new Error('Invalid output directory');
await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

await build({
  absWorkingDir:root,
  entryPoints:['backrooms3d.js'],
  outdir:outDir,
  entryNames:'backrooms3d.bundle',
  assetNames:'assets/[name]-[hash]',
  loader:{'.glb':'file','.ogg':'file','.mp3':'file','.wav':'file'},
  bundle:true,
  format:'iife',
  target:'es2018',
  minify:true,
});

await Promise.all(['favicon.png','apple-touch-icon.png'].map(name=>
  copyFile(join(root,name),join(outDir,name))
));
const siteToken=process.env.CLOUDFLARE_ANALYTICS_TOKEN?.trim();
if(siteToken && !/^[0-9a-f]{32}$/i.test(siteToken))
  throw new Error('CLOUDFLARE_ANALYTICS_TOKEN must be the 32-character site token');
const tracking=siteToken?
  `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${siteToken}"}'></script>`:'';
const html=await readFile(join(root,'index.html'),'utf8');
if(!html.includes('<!-- CLOUDFLARE_WEB_ANALYTICS -->')) throw new Error('Analytics insertion point is missing');
await writeFile(join(outDir,'index.html'),html.replace('<!-- CLOUDFLARE_WEB_ANALYTICS -->',tracking));
await Promise.all(['image','bgm'].map(name=>mkdir(join(outDir,name),{recursive:true})));
await Promise.all([
  copyFile(join(root,'image','naiwa.png'),join(outDir,'image','naiwa.png')),
  copyFile(join(root,'bgm','end.mp3'),join(outDir,'bgm','end.mp3')),
]);
