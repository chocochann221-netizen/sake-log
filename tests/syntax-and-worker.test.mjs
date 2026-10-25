import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
const root=new URL('../',import.meta.url);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.name==='.git'?[]:entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
test('all JavaScript, inline HTML scripts and Edge TypeScript parse',()=>{
  let scripts=0,htmlScripts=0,typescript=0;
  for(const file of walk(root.pathname)){
    if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);scripts++;}
    if(file.endsWith('.ts')){stripTypeScriptTypes(fs.readFileSync(file,'utf8'));typescript++;}
    if(file.endsWith('.html')){const html=fs.readFileSync(file,'utf8');for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|application\/ld\+json/.test(match[1])||!match[2].trim())continue;new vm.Script(match[2],{filename:file});htmlScripts++;}}
  }
  assert.ok(scripts>20&&htmlScripts>5&&typescript>=4);
  console.log(JSON.stringify({scripts,htmlScripts,typescript}));
});
test('local Worker serves application and enforces unauthenticated recognition boundary',async()=>{
  const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8788/';
  const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/和酒ログ/);
  const endpoint=new URL('/.netlify/functions/recognize-sake',base);
  assert.equal((await fetch(endpoint)).status,405);
  const denied=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'ログインが必要です'});
});
test('service worker never caches the active API paths',()=>{
  const listeners={};let intercepted=false;
  vm.runInNewContext(fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),{URL,self:{location:{origin:'https://local'},addEventListener:(key,fn)=>listeners[key]=fn}});
  for(const route of ['/.netlify/functions/recognize-sake','/.netlify/functions/sakenowa-master','/api/private'])listeners.fetch({request:{method:'GET',url:'https://local'+route},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false);
});
