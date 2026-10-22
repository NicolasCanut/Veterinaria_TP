import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {handlePanel} from '../lib/auth.mjs';
import {getPanel} from '../lib/panel.mjs';
test('Authenticated ABM persists changes and recalculates monthly, category, veterinarian, attendance and money totals',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'vet-abm-')),path=join(dir,'vet.sqlite');let db=database(path);
 try{
  await inicializar(db);
  let cookie;
  const post=(action,body,session=cookie,origin='http://vet.test')=>handlePanel(new Request('http://vet.test/api/panel?accion='+action,{method:'POST',headers:{...(session?{cookie:session}:{}),origin},body:JSON.stringify(body)}),db);
  const login=await post('login',{email:'docente@vet.local',password:'Veterinaria2026!'});cookie=login.headers.get('set-cookie').split(';')[0];
  const before=await getPanel(db,new URLSearchParams());
  const body={mascota_id:1,veterinario_id:1,fecha:'2026-07-01T01:11',motivo:'Demo ABM',tipo:'Consulta general',estado:'atendida',importe_pesos:'15.000,50'};
  const create=await post('nueva-consulta',body);assert.equal(create.status,201);const {id}=await create.json();
  assert.equal((await post('modificar-consulta',{...body,id},null)).status,401);
  assert.equal((await post('eliminar-consulta',{id},null)).status,401);
  assert.equal((await post('eliminar-consulta',{id},cookie,'http://otro.test')).status,403);
  const changed={...body,id,veterinario_id:2,mascota_id:2,fecha:'2026-08-01T01:11',tipo:'Control',motivo:'Motivo corregido',importe_pesos:'23.456,78'};
  assert.equal((await post('modificar-consulta',changed)).status,200);
  db.conn.close();db=database(path);
  let p=await getPanel(db,new URLSearchParams({consulta:String(id)}));assert.equal(p.kpi.total,before.kpi.total+1);assert.equal(p.kpi.cobrado,before.kpi.cobrado+23456.78);assert.equal(p.detalle.veterinario_id,2);assert.equal(p.detalle.mascota_id,2);assert.equal(p.detalle.motivo,'Motivo corregido');
  for(const mes of ['2026-07','2026-08']){
   const original=before.meses.find(m=>m.mes===mes),updated=await getPanel(db,new URLSearchParams({mes}));assert.equal(updated.kpi.total,original.total+(mes==='2026-08'?1:0));
  }
  assert.equal(p.tipos.find(t=>t.tipo==='Control').total,before.tipos.find(t=>t.tipo==='Control').total+1);
  assert.equal(p.tipos.find(t=>t.tipo==='Consulta general').total,before.tipos.find(t=>t.tipo==='Consulta general').total);
  assert.equal(p.veterinarios.find(v=>v.id===2).total,before.veterinarios.find(v=>v.id===2).total+1);
  for(const invalid of [{mascota_id:999},{importe_pesos:'-1'},{fecha:'2026-02-30T09:00'},{estado:'ausente'},{motivo:''},{fecha:'2099-01-01T09:00'}])assert.equal((await post('modificar-consulta',{...changed,...invalid})).status,400);
  const existing=before.consultas[0];assert.equal((await post('modificar-consulta',{...changed,mascota_id:existing.mascota_id,veterinario_id:existing.veterinario_id,fecha:existing.fecha})).status,400);
  assert.equal((await getPanel(db,new URLSearchParams({consulta:String(id)}))).detalle.importe_pesos,23456.78);
  assert.equal((await post('modificar-consulta',{...changed,estado:'ausente',importe_pesos:'0,00'})).status,200);
  p=await getPanel(db,new URLSearchParams());assert.equal(p.kpi.atendidas,before.kpi.atendidas);assert.equal(p.kpi.ausentes,before.kpi.ausentes+1);assert.equal(p.kpi.cobrado,before.kpi.cobrado);
  assert.equal((await post('eliminar-consulta',{id})).status,200);
  db.conn.close();db=database(path);
  p=await getPanel(db,new URLSearchParams({consulta:String(id)}));assert.deepEqual(p.kpi,before.kpi);assert.deepEqual(p.tipos,before.tipos);assert.deepEqual(p.meses,before.meses);assert.equal(p.detalle,null);
  assert.equal((await post('eliminar-consulta',{id})).status,400);assert.equal((await post('modificar-consulta',{...changed,id})).status,400);
  assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM mascotas').get().n,48);assert.equal(db.conn.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.conn.close();rmSync(dir,{recursive:true,force:true});}
});
