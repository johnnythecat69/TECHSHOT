import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const client = await build({
  entryPoints:['src/client.js'], bundle:true, format:'esm', minify:true,
  platform:'browser', target:'es2022', legalComments:'inline', write:false
});
const assets = {
  '/':await readFile('public/index.html','utf8'),
  '/game.css':await readFile('public/game.css','utf8'),
  '/game.js':client.outputFiles[0].text
};
await mkdir('dist/server',{recursive:true});
await build({
  entryPoints:['src/worker.js'], bundle:true, format:'esm', platform:'neutral', target:'es2022',
  outfile:'dist/server/index.js', plugins:[{name:'inline-client',setup(build) {
    build.onResolve({filter:/^built:assets$/}, ({path})=>({path,namespace:'site-assets'}));
    build.onLoad({filter:/.*/,namespace:'site-assets'},()=>({contents:JSON.stringify(assets),loader:'json'}));
  }}]
});
const manifest = await readFile('.openai/hosting.json','utf8').catch(error=>{
  if(error.code!=='ENOENT')throw error;
  return null;
});
if (manifest) {
  await mkdir('dist/.openai',{recursive:true});
  await writeFile('dist/.openai/hosting.json',manifest);
}
