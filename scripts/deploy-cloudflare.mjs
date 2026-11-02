import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.name='muthi-preview';
config.main=resolve('dist/server/index.js');
config.assets={directory:resolve('dist/client')};
config.account_id='084057023053f1d2723e614fdf90162a';
config.workers_dev=true;
config.preview_urls=true;
config.vars={...config.vars,DIRECT_PREVIEW:'true'};
config.d1_databases=[{binding:'DB',database_name:'muthi-store',database_id:'c1c7ef30-c1e4-4fc6-8f03-650aed01092d',migrations_dir:resolve('drizzle')}];
mkdirSync('.sites-runtime',{recursive:true});
const output=resolve('.sites-runtime/cloudflare-preview.json');
writeFileSync(output,JSON.stringify(config,null,2));
console.log('Prepared standalone Workers preview configuration.');
if(!process.argv.includes('--prepare-only')){
 const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','deploy','--config',output],{stdio:'inherit'});
 process.exitCode=result.status??1;
}
