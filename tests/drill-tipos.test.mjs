import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
test('Type filters reconcile summaries, validate detail membership and study SQL',async()=>{
 const db=database();await inicializar(db);
 try{
 for(const mes of ['','2026-07','2026-10'])for(const estado of ['','atendida','ausente']){
  const filtros={mes,estado},overview=await getPanel(db,new URLSearchParams(filtros));
  for(const group of overview.tipos){
   const scope={...filtros,tipo:group.tipo},history=await getPanel(db,new URLSearchParams(scope));
   assert.equal(history.kpi.total,group.total);
   for(const row of history.consultas){assert.equal(row.tipo,group.tipo);assert.equal((await getPanel(db,new URLSearchParams({...scope,consulta:String(row.id)}))).detalle.id,row.id);}
   const other=overview.consultas.find(row=>row.tipo!==group.tipo);if(other)assert.equal((await getPanel(db,new URLSearchParams({...scope,consulta:String(other.id)}))).detalle,null);
  }
 }
 await assert.rejects(getPanel(db,new URLSearchParams({tipo:'invalid OR 1=1'})),/inválido/);
 assert.equal((await getPanel(db,new URLSearchParams({tipo:'Vacunación',buscar:'no existe'}))).kpi.total,0);
 const sql=readFileSync(new URL('../sql/03_consultas.sql',import.meta.url),'utf8').split('-- 10.')[1].split('\n').filter((line,i)=>i>0&&!line.trim().startsWith('--')).join('\n');
 const results=sql.split(';').filter(s=>s.trim()).map(s=>db.conn.prepare(s).all());assert.equal(results.length,5);
 const all=await getPanel(db,new URLSearchParams());assert.equal(results[0].reduce((n,r)=>n+r.consultas,0),all.kpi.total);
 for(const [index,filter]of [[1,{tipo:'Vacunación'}],[2,{dueno:'1'}],[3,{mascota:'1'}]])assert.deepEqual(results[index].map(r=>r.id).sort((a,b)=>a-b),(await getPanel(db,new URLSearchParams(filter))).consultas.map(r=>r.id).sort((a,b)=>a-b));
 assert.equal(results[4][0].id,1);assert.equal(results[4][0].tipo,'Vacunación');
 }finally{db.conn.close();}
});
test('Type drill down and up preserve filters and export the selected consultations',async()=>{
 const db=database();await inicializar(db);let html='',click,exported;
 try{
 const app={set innerHTML(v){html=v},addEventListener(name,fn){if(name==='click')click=fn}};
 const c=vm.createContext({Intl,Date,URLSearchParams,Blob,location:{search:''},history:{pushState(){}},document:{getElementById:()=>app,createElement:()=>({click(){}})},URL:{createObjectURL(b){exported=b;return 'blob:test'},revokeObjectURL(){}}});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');vm.runInContext(source.slice(0,source.indexOf("root.addEventListener('change'"))+source.slice(source.indexOf('function rutaNavegacion(')),c);
 vm.runInContext("cargar=async()=>{};usuario={nombre:'Docente'};nav={...inicial,vista:'general',mes:'2026-07',estado:'atendida',buscar:'Luna'}",c);
 async function render(){const nav=vm.runInContext('({...nav})',c);c.payload=await getPanel(db,new URLSearchParams(nav));vm.runInContext('datos=payload;renderizar()',c);return nav;}
 const action=async(action,id,vet)=>click({target:{closest:()=>({disabled:false,dataset:{action,id,vet,tipo:id}})}});
 await render();assert.match(html,/Consultas por tipo/);assert.match(html,/data-action="tipo"/);
 await action('tipo','Vacunación');await render();assert.match(html,/2 · CONSULTAS POR TIPO/);assert.match(html,/Consultas de Vacunación/);assert.doesNotMatch(html,/<th>Tipo<\/th>/);assert.match(html,/>Ver consulta<\/button>/);
 vm.runInContext('exportar()',c);const csv=await exported.text();assert.match(csv,/Vacunación/);assert.doesNotMatch(csv,/Consulta general/);
 const id=String(c.payload.consultas[0].id);await action('consulta',id,'1');let nav=await render();assert.equal(nav.tipo,'Vacunación');assert.equal(nav.veterinario,'');assert.match(html,/3 · CONSULTA/);assert.match(html,/Volver a las consultas de Vacunación/);
 await action('volver-tipo');nav=await render();assert.equal(nav.consulta,'');assert.equal(nav.tipo,'Vacunación');
 await action('panorama');nav=await render();assert.equal(nav.tipo,'');assert.equal(nav.vista,'general');for(const [key,value]of Object.entries({mes:'2026-07',estado:'atendida',buscar:'Luna'}))assert.equal(nav[key],value);
 await action('tipo','Vacunación');await action('mascota','1');assert.equal(vm.runInContext('nav.tipo',c),'');
 }finally{db.conn.close();}
});
