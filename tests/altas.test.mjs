import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
import {handlePanel} from '../lib/auth.mjs';
import {nuevaConsulta,importeGuardado} from '../lib/altas.mjs';
const db=database();await inicializar(db);
test('Monthly totals equal the full period for every type and identical veterinarian/state/search filters',async()=>{
 for(const veterinario of ['', '1','2','3','4'])for(const estado of ['', 'atendida','ausente','programada','cancelada'])for(const buscar of ['', 'Luna']){
  const params={veterinario,estado,buscar},all=await getPanel(db,new URLSearchParams(params)),totals=new Map();let count=0,cobrado=0;
  for(const mes of all.metadata.periodos){const m=await getPanel(db,new URLSearchParams({...params,mes}));count+=m.kpi.total;cobrado+=m.kpi.cobrado;for(const t of m.tipos)totals.set(t.tipo,(totals.get(t.tipo)||0)+t.total);}
  assert.equal(count,all.kpi.total);assert.equal(Math.round(cobrado*100),Math.round(all.kpi.cobrado*100));for(const t of all.tipos)assert.equal(totals.get(t.tipo),t.total);
 }
 const byMonth=[];for(const mes of ['2026-07','2026-08','2026-09','2026-10'])byMonth.push((await getPanel(db,new URLSearchParams({mes}))).tipos.find(t=>t.tipo==='Consulta general').total);
 assert.deepEqual(byMonth,[11,10,12,12]);
});
test('Authenticated INSERT updates counts, categories, attendance, pesos and an added month; persisted SQLite is authoritative',async()=>{
 const request=(action,body,cookie)=>new Request('http://vet.test/api/panel?accion='+action,{method:'POST',headers:cookie?{cookie}:{},body:JSON.stringify(body)});
 const body={mascota_id:'1',veterinario_id:'1',fecha:'2026-10-08T15:18',motivo:'Demostración',tipo:'Consulta general',estado:'atendida',importe_pesos:'15.000,50'};
 assert.equal((await handlePanel(request('nueva-consulta',body),db)).status,401);
 const login=await handlePanel(request('login',{email:'docente@vet.local',password:'Veterinaria2026!'}),db),cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await handlePanel(request('nueva-consulta',body,cookie),db);assert.equal(response.status,201);const{id}=await response.json();
 const p=await getPanel(db,new URLSearchParams({consulta:String(id)}));assert.equal(p.kpi.total,181);assert.equal(p.kpi.atendidas,119);assert.equal(p.kpi.ausentes,39);assert.equal(p.kpi.cobrado,2445000.5);assert.equal(p.tipos.find(t=>t.tipo==='Consulta general').total,46);assert.equal(p.detalle.importe_pesos,15000.5);assert.ok(!('importe_centavos'in p.detalle));
 assert.equal((await handlePanel(request('nueva-consulta',body,cookie),db)).status,400);
 await nuevaConsulta(db,{...body,fecha:'2027-01-01T09:00',estado:'programada',importe_pesos:'0,00'});const updated=await getPanel(db,new URLSearchParams({mes:'2027-01'}));assert.equal(updated.kpi.total,1);assert.equal(updated.kpi.cobrado,0);assert.equal(updated.kpi.porcentaje,null);assert.ok(updated.metadata.periodos.includes('2027-01'));
 assert.equal(db.conn.prepare('SELECT COUNT(*) n FROM consultas').get().n,182);
});
test('Locale pesos parser and business validation reject invalid amounts, dates and missing references',async()=>{
 assert.equal(importeGuardado('15.000,50'),1500050);assert.equal(importeGuardado('15000,5'),1500050);assert.equal(importeGuardado('0,00'),0);for(const amount of ['-1','1,234','1.2','nan','1e2'])assert.throws(()=>importeGuardado(amount));
 const body={mascota_id:1,veterinario_id:1,fecha:'2026-10-09T09:00',motivo:'Control',tipo:'Control',estado:'programada',importe_pesos:'0'};
 for(const change of [{mascota_id:999},{veterinario_id:99},{fecha:'2026-02-30T09:00'},{estado:'inventado'},{importe_pesos:'100'},{motivo:''}])await assert.rejects(()=>nuevaConsulta(db,{...body,...change}),/inválid/);
});
