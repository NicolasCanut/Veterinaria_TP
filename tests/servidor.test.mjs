import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('HTTP serves assets, authenticates, drills down and ends the session',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'vet-test-')),probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),VET_DB_PATH:join(temp,'test.sqlite')},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),10000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve()});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code))})});
 const base=`http://127.0.0.1:${port}`;assert.match(await(await fetch(base)).text(),/Huellas/);for(const file of ['logo.svg','styles.css','app.js'])assert.equal((await fetch(base+'/'+file)).status,200);assert.equal((await fetch(base+'/api/panel')).status,401);
 const login=await fetch(base+'/api/panel?accion=login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:'docente@vet.local',password:'Veterinaria2026!'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie};
 assert.equal((await(await fetch(base+'/api/panel',{headers})).json()).kpi.total,180);assert.equal((await(await fetch(base+'/api/panel?veterinario=1',{headers})).json()).kpi.total,45);assert.equal((await(await fetch(base+'/api/panel?veterinario=1&consulta=1',{headers})).json()).detalle.dueno,'Ana Torres');assert.equal((await fetch(base+'/api/panel?mes=2026-99',{headers})).status,400);assert.equal((await fetch(base+'/api/panel?accion=logout',{method:'POST',headers})).status,200);assert.equal((await fetch(base+'/api/panel',{headers})).status,401);
 }finally{const exit=new Promise(r=>child.once('exit',r));child.kill('SIGINT');await exit;rmSync(temp,{recursive:true,force:true})}
});
