import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const secrets=['SUPABASE_SECRET_KEY','SUPABASE_ACCESS_TOKEN'].map(k=>process.env[k]).filter(Boolean);
if(!secrets.length)throw new Error('No local server secret available for this check.');
const root=path.resolve('.next/static');
if(!fs.existsSync(root))throw new Error('Run npm run build first.');
let count=0;const matches=[];
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())scan(file);
  else{count++;const bytes=fs.readFileSync(file);if(secrets.some(secret=>bytes.includes(Buffer.from(secret))))matches.push(path.relative(root,file));}
}}
scan(root);
console.log(JSON.stringify({clientFilesChecked:count,secretMatches:matches.length},null,2));
if(matches.length)process.exitCode=1;
