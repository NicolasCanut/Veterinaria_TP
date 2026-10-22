import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
import {handlePanel} from '../lib/auth.mjs';
import {guardarEntidad,registros,impactoEntidad,bajaEntidad,reactivarEntidad} from '../lib/entidades.mjs';
import {nuevaConsulta,modificarConsulta} from '../lib/altas.mjs';
const setup=async()=>{const db=database();await inicializar(db);return db;};
const turno=(m,v)=>({mascota_id:m,veterinario_id:v,fecha:'2026-07-21T06:39',motivo:'Control',tipo:'Control',estado:'atendida',importe_pesos:'1.234,56'});
test('New client and multiple pets save atomically, appear without consultations, and new veterinarians are filterable',async()=>{
 const db=await setup();try{
 const count=db.conn.prepare('SELECT COUNT(*) n FROM duenos').get().n;
 assert.throws(()=>guardarEntidad(db,{tipo:'duenos',nombre:'Inválido',telefono:'123',mascotas:[{nombre:'Bien',especie:'Perro'},{nombre:'Mal',especie:'Pez'}]}),/inválido/);
 assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM duenos').get().n,count);
 const {id}=guardarEntidad(db,{tipo:'duenos',nombre:'Cliente nuevo',telefono:'3415550000',mascotas:[{nombre:'Pampa',especie:'Perro'},{nombre:'Michi',especie:'Gato'}]});
 const data=registros(db),d=data.duenos.find(d=>d.id===id);assert.equal(d.mascotas,2);assert.equal(d.consultas,0);
 const {id:vet}=guardarEntidad(db,{tipo:'veterinarios',nombre:'Veterinario nuevo',matricula:'ROS-900'});
 guardarEntidad(db,{tipo:'duenos',id,nombre:'Cliente editado',telefono:'3415551111'});
 const mascota=data.mascotas.find(m=>m.dueno_id===id);await nuevaConsulta(db,turno(mascota.id,vet));
 const panel=await getPanel(db,new URLSearchParams({veterinario:String(vet)}));assert.equal(panel.kpi.total,1);assert.equal(panel.kpi.cobrado,1234.56);assert.equal(panel.consultas[0].dueno,'Cliente editado');
 assert.throws(()=>guardarEntidad(db,{tipo:'veterinarios',nombre:'Repetido',matricula:'ROS-900'}),/inválida/);
 }finally{db.conn.close();}
});
test('Soft deactivation retains totals and history, blocks new appointments and permits historical edits and reactivation',async()=>{
 const db=await setup();try{
 const before=await getPanel(db,new URLSearchParams());bajaEntidad(db,{tipo:'duenos',id:1,modo:'conservar'});
 assert.deepEqual((await getPanel(db,new URLSearchParams())).kpi,before.kpi);
 await assert.rejects(nuevaConsulta(db,turno(1,1)),/baja/);
 const c=db.conn.prepare('SELECT * FROM consultas WHERE id=1').get();await modificarConsulta(db,{...c,fecha:c.fecha.slice(0,16),motivo:'Historial conservado',importe_pesos:'22.000,00'});
 reactivarEntidad(db,{tipo:'duenos',id:1});await nuevaConsulta(db,turno(1,1));
 bajaEntidad(db,{tipo:'veterinarios',id:2,modo:'conservar'});await assert.rejects(nuevaConsulta(db,turno(2,2)),/baja/);
 bajaEntidad(db,{tipo:'mascotas',id:2,modo:'conservar'});await assert.rejects(nuevaConsulta(db,turno(2,1)),/baja/);
 }finally{db.conn.close();}
});
test('Permanent client removal requires explicit confirmation and current impact; deletes only its pets and consultations',async()=>{
 const db=await setup();try{
 const before=await getPanel(db,new URLSearchParams()),impact=impactoEntidad(db,'duenos',1);
 assert.throws(()=>bajaEntidad(db,{...impact,modo:'eliminar'}),/Confirmación/);
 assert.throws(()=>bajaEntidad(db,{...impact,modo:'eliminar',consultas:999,confirmacion:'ELIMINAR'}),/cambió/);
 assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM consultas').get().n,180);
 bajaEntidad(db,{...impact,modo:'eliminar',confirmacion:'ELIMINAR'});
 const after=await getPanel(db,new URLSearchParams());assert.equal(after.kpi.total,before.kpi.total-impact.consultas);assert.equal(Math.round(after.kpi.cobrado*100),Math.round((before.kpi.cobrado-impact.cobrado)*100));
 assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM mascotas WHERE dueno_id=1').get().n,0);assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM veterinarios').get().n,4);assert.equal(db.conn.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.conn.close();}
});
test('Removing veterinarian or pet updates totals without deleting unrelated clients or animals; API protects all mutations',async()=>{
 const db=await setup();try{
 const req=(accion,body,cookie)=>new Request('http://localhost/api/panel?accion='+accion,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 for(const accion of ['guardar-entidad','baja-entidad','reactivar-entidad'])assert.equal((await handlePanel(req(accion,{}),db)).status,401);
 const login=await handlePanel(req('login',{email:'docente@vet.local',password:'Veterinaria2026!'}),db),cookie=login.headers.get('set-cookie').split(';')[0];
 const created=await handlePanel(req('guardar-entidad',{tipo:'veterinarios',nombre:'Prueba API',matricula:'API-123'},cookie),db);assert.equal(created.status,200);
 const {id}=await created.json();assert.equal((await handlePanel(req('reactivar-entidad',{tipo:'veterinarios',id},cookie),db)).status,200);
 const v=impactoEntidad(db,'veterinarios',1);bajaEntidad(db,{...v,modo:'eliminar',confirmacion:'ELIMINAR'});
 assert.equal(registros(db).mascotas.length,48);assert.equal(registros(db).duenos.length,32);assert.equal((await getPanel(db,new URLSearchParams())).kpi.total,180-v.consultas);
 const m=impactoEntidad(db,'mascotas',1);bajaEntidad(db,{...m,modo:'eliminar',confirmacion:'ELIMINAR'});assert.equal(registros(db).duenos.length,32);assert.equal(registros(db).mascotas.length,47);assert.equal(db.conn.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.conn.close();}
});
test('Existing pesos databases migrate with backup once, preserving IDs and money after reopening',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'vet-entity-'));const path=join(dir,'vet.sqlite');let db=database(path);
 try{await inicializar(db);for(const t of ['duenos','mascotas','veterinarios'])db.conn.exec('ALTER TABLE '+t+' DROP COLUMN activo');
 await inicializar(db);assert.equal(readdirSync(dir).filter(n=>n.includes('antes-abm')).length,1);
 const d=registros(db);assert.equal(d.duenos.length,32);assert.ok(d.mascotas.every(m=>m.activo===1));assert.equal((await getPanel(db,new URLSearchParams())).kpi.cobrado,2430000);
 bajaEntidad(db,{tipo:'duenos',id:1,modo:'conservar'});db.conn.close();db=database(path);await inicializar(db);assert.equal(registros(db).duenos.find(d=>d.id===1).activo,0);assert.equal(readdirSync(dir).filter(n=>n.includes('antes-abm')).length,1);
 }finally{db.conn.close();rmSync(dir,{recursive:true});}
});
