import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel,semaforo} from '../lib/panel.mjs';
import {handlePanel} from '../lib/auth.mjs';
const db=database();await inicializar(db);
const request=(query='',options={})=>new Request('https://vet.test/api/panel?'+query,options);
let cookie;
test('Login against SQL protects data; passwords and session tokens are hashed',async()=>{
 assert.equal((await handlePanel(request(),db)).status,401);
 assert.equal((await handlePanel(request('accion=login',{method:'POST',body:JSON.stringify({email:'docente@vet.local',password:'mal'})}),db)).status,401);
 const r=await handlePanel(request('accion=login',{method:'POST',body:JSON.stringify({email:'docente@vet.local',password:'Veterinaria2026!'})}),db);assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);assert.match(r.headers.get('set-cookie'),/Secure/);assert.notEqual(db.conn.prepare('SELECT password_hash FROM usuarios').get().password_hash,'Veterinaria2026!');assert.notEqual(db.conn.prepare('SELECT token_hash FROM sesiones').get().token_hash,cookie.split('=')[1]);
});
test('Aggregate totals match independent enumeration and exclude scheduled and cancelled attendance',async()=>{
 const raw=db.conn.prepare('SELECT * FROM consultas').all(),sum=await getPanel(db,new URLSearchParams());
 const attended=raw.filter(c=>c.estado==='atendida'),absent=raw.filter(c=>c.estado==='ausente');
 assert.equal(sum.kpi.total,180);assert.equal(sum.kpi.atendidas,attended.length);assert.equal(sum.kpi.ausentes,absent.length);assert.equal(sum.kpi.cobrado,raw.reduce((t,c)=>t+c.importe_pesos,0));assert.equal(sum.kpi.porcentaje,Math.round(1000*attended.length/(attended.length+absent.length))/10);assert.equal(sum.kpi.mascotas,new Set(raw.map(c=>c.mascota_id)).size);assert.equal(sum.kpi.duenos,32);assert.equal(sum.kpi.programadas,16);assert.equal(sum.kpi.canceladas,7);assert.equal(sum.kpi.cobrado,2430000);assert.equal(sum.veterinarios.reduce((t,v)=>t+v.total,0),sum.kpi.total);assert.equal(sum.mascotas.reduce((t,m)=>t+m.total,0),sum.kpi.total);assert.equal(sum.duenos.reduce((t,d)=>t+d.cobrado,0),sum.kpi.cobrado);
});
test('Three levels and JOIN detail preserve filters and exclude unrelated detail',async()=>{
 const vet=await getPanel(db,new URLSearchParams({veterinario:'1',mes:'2026-07'}));assert.ok(vet.consultas.length);assert.ok(vet.consultas.every(c=>c.veterinario_id===1&&c.fecha.startsWith('2026-07')));
 const detail=await getPanel(db,new URLSearchParams({veterinario:'1',consulta:'1',mes:'2026-07'}));assert.equal(detail.detalle.mascota,'Luna');assert.equal(detail.detalle.dueno,'Ana Torres');assert.equal(detail.detalle.veterinario,'Laura Méndez');assert.equal(detail.detalle.tipo,'Vacunación');assert.equal(detail.detalle.importe_pesos,22000);
 assert.equal((await getPanel(db,new URLSearchParams({veterinario:'2',consulta:'1'}))).detalle,null);assert.equal((await getPanel(db,new URLSearchParams({mes:'2026-10',consulta:'1'}))).detalle,null);
});
test('Bound filters, literal search and empty results are safe',async()=>{
 const d=await getPanel(db,new URLSearchParams({estado:'ausente'}));assert.equal(d.kpi.porcentaje,0);assert.ok(d.consultas.every(c=>c.estado==='ausente'));
 const planned=await getPanel(db,new URLSearchParams({estado:'programada'}));assert.equal(planned.kpi.porcentaje,null);assert.equal(planned.kpi.cobrado,0);
 for(const buscar of ["' OR 1=1 --",'%','_','no-existe']) {const d=await getPanel(db,new URLSearchParams({buscar}));assert.equal(d.kpi.total,0);assert.equal(d.kpi.porcentaje,null);}
 for(const p of [{mes:'2026-99'},{veterinario:'5'},{estado:'otro'},{consulta:'-1'}])await assert.rejects(()=>getPanel(db,new URLSearchParams(p)),/inválid/);
});
test('Traffic thresholds and schema constraints enforce consistent business data',async()=>{
 assert.equal(semaforo(80),'verde');assert.equal(semaforo(60),'amarillo');assert.equal(semaforo(59.9),'rojo');assert.equal(semaforo(null),'neutral');
 const d=await getPanel(db,new URLSearchParams());assert.deepEqual(new Set(d.veterinarios.map(v=>v.semaforo)),new Set(['verde','amarillo','rojo']));
 assert.throws(()=>db.conn.prepare('UPDATE consultas SET mascota_id=999 WHERE id=1').run());assert.throws(()=>db.conn.prepare("UPDATE consultas SET estado='otro' WHERE id=1").run());assert.throws(()=>db.conn.prepare('UPDATE consultas SET importe_pesos=-1 WHERE id=1').run());assert.throws(()=>db.conn.prepare("UPDATE consultas SET estado='ausente' WHERE id=1").run());
 const c=db.conn.prepare('SELECT * FROM consultas WHERE id=1').get();assert.throws(()=>db.conn.prepare('INSERT INTO consultas VALUES(?,?,?,?,?,?,?,?)').run(999,2,c.veterinario_id,c.fecha,'Control','Control','programada',0));
});
test('Repeatable initialization, origin protection and logout',async()=>{
 await inicializar(db);assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM consultas').get().n,180);
 assert.equal((await handlePanel(request('accion=login',{method:'POST',headers:{origin:'https://otro.test'},body:'{}'}),db)).status,403);
 assert.equal((await handlePanel(request('accion=logout',{method:'POST',headers:{cookie}}),db)).status,200);assert.equal((await handlePanel(request('',{headers:{cookie}}),db)).status,401);
});
test('Schema and INSERT files initialize an empty SQL database',()=>{
 const empty=database();empty.conn.exec(readFileSync(new URL('../sql/01_esquema.sql',import.meta.url),'utf8'));empty.conn.exec(readFileSync(new URL('../sql/02_datos_ejemplo.sql',import.meta.url),'utf8'));assert.equal(empty.conn.prepare('SELECT COUNT(*) n FROM consultas').get().n,180);assert.equal(empty.conn.prepare('PRAGMA foreign_key_check').all().length,0);empty.conn.close();
});
