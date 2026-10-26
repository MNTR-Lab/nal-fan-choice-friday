import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
let handler;
const polls=[{id:1,title:'Old poll',status:'active',created_at:'2026-10-19'}];
const options=[{id:31,poll_id:1,matchup:'Colorado vs Pueblo',display_order:0},{id:32,poll_id:1,matchup:'Kansas vs Amarillo',display_order:1}];
const votes=[{id:1,poll_id:1,option_id:31}];
const tables={fcf_polls:polls,fcf_options:options,fcf_votes:votes};
let writes=[];
const db={auth:{getUser:async jwt=>({data:{user:jwt==='admin'?{id:1}:null}})},from(table){
 let action='select',payload,filters=[],count=false,one=false,range=null;
 const q={select(_s,o){count=!!o?.count;return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},range(a,b){range=[a,b];return q},single(){one=true;return q},maybeSingle(){one=true;return q},update(p){action='update';payload=p;return q},insert(p){action='insert';payload=p;return q},delete(){action='delete';return q},then(resolve,reject){try{
 if(table==='profiles')return Promise.resolve({data:{role:'admin',account_status:'active'}}).then(resolve,reject);
 let rows=tables[table].filter(r=>filters.every(f=>f(r)));
 if(action==='update'){writes.push(table);rows.forEach(r=>Object.assign(r,payload));}
 if(action==='insert'){writes.push(table);rows=(Array.isArray(payload)?payload:[payload]).map(p=>({...p,id:Math.max(0,...tables[table].map(r=>r.id))+1}));tables[table].push(...rows);}
 if(action==='delete'){writes.push(table);tables[table]=tables[table].filter(r=>!rows.includes(r));rows=[];}
 if(range) rows=rows.slice(range[0],range[1]+1);
 return Promise.resolve({data:one?rows[0]||null:rows,count:count?rows.length:null,error:null}).then(resolve,reject);
 }catch(e){return Promise.reject(e).then(resolve,reject)}}};return q;
}};
const source=readFileSync(new URL('./edge-function.ts',import.meta.url),'utf8').replace(/import \{ createClient \}[^\n]+/,'');
vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{env:{get:()=>''},serve:f=>handler=f},createClient:()=>db,Response,URL,console,crypto,TextEncoder,fetch});
async function call(path,body,auth='admin'){const req=new Request('https://example.com/functions/v1/fcf-api'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const r=await handler(req);return {status:r.status,body:await r.json()};}
assert.equal((await call('/admin/polls',null,'bad')).status,403);
assert.equal((await call('/admin/polls')).body.polls.length,1);
assert.equal((await call('/admin/poll?id=1')).body.results[0].votes,1);
const changed={id:1,title:'Old poll',question:'Choose',status:'active',games:[{matchup:'Changed'},{matchup:'Other'}]};
writes=[];assert.equal((await call('/admin/poll',changed)).status,409);assert.deepEqual(writes,[]);
assert.equal((await call('/admin/archive',{id:1})).status,200);assert.equal(polls[0].status,'closed');assert.equal(votes.length,1);assert.equal(options.length,2);
assert.equal((await call('/admin/poll',{...changed,id:undefined,status:'draft'})).status,200);assert.equal(polls.length,2);assert.equal(polls[0].status,'closed');assert.equal(votes.length,1);assert.equal((await call('/admin/poll?id=2')).body.results.reduce((n,r)=>n+r.votes,0),0);
console.log('PASS: admin authorization, saved history, vote totals, rejected edits cause no writes, archive preserves votes/options, fresh poll starts with zero votes.');
