import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await build({entryPoints:['src/main.js'],bundle:true,minify:true,sourcemap:false,format:'esm',target:['es2022'],outfile:'dist/game.js'});
console.log('Built Echo Chamber 3D.');
