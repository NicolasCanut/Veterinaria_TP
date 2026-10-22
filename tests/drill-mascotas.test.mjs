import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
test('Pet summary drills to matching consultations and detail, preserves filters and rejects unrelated detail',async()=>{
 const db=database();await inicializar(db);
 try{
 for(const mes of ['','2026-07','2026-10'])for(const estado of ['','atendida','ausente']){
  const filtros={mes,estado,buscar:''};const overview=await getPanel(db,new URLSearchParams(filtros));
  for(const owner of overview.mascotas){
   const scope={...filtros,mascota:String(owner.id)},history=await getPanel(db,new URLSearchParams(scope));
   assert.equal(history.kpi.total,owner.total);assert.equal(history.kpi.cobrado,owner.cobrado);assert.equal(history.metadata.paciente.id,owner.id);
   for(const c of history.consultas){assert.equal(c.mascota_id,owner.id);const detail=await getPanel(db,new URLSearchParams({...scope,consulta:String(c.id)}));assert.equal(detail.detalle.id,c.id);assert.deepEqual(detail.kpi,history.kpi);}
   const unrelated=overview.consultas.find(c=>!history.consultas.some(x=>x.id===c.id));if(unrelated)assert.equal((await getPanel(db,new URLSearchParams({...scope,consulta:String(unrelated.id)}))).detalle,null);
  }
 }
 const empty=await getPanel(db,new URLSearchParams({mascota:'1',buscar:'no existe mascota',mes:'2026-07'}));assert.equal(empty.kpi.total,0);assert.equal(empty.metadata.paciente.id,1);
 for(const mascota of ['0','-1','1 OR 1=1','999999','9007199254740993'])await assert.rejects(getPanel(db,new URLSearchParams({mascota})),/inválida/);
 }finally{db.conn.close();}
});
test('Pet drill down and up retain filters and origin, render three levels and export historical rows',async()=>{
 const db=database();await inicializar(db);let html='',click,exported;
 try{
 const app={set innerHTML(v){html=v},addEventListener(name,fn){if(name==='click')click=fn}};
 const c=vm.createContext({Intl,Date,URLSearchParams,Blob,location:{search:''},history:{pushState(){}},document:{getElementById:()=>app,createElement:()=>({click(){}})},URL:{createObjectURL(b){exported=b;return 'blob:test'},revokeObjectURL(){}}});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');vm.runInContext(source.slice(0,source.indexOf("root.addEventListener('change'"))+source.slice(source.indexOf('function rutaNavegacion(')),c);
 vm.runInContext("cargar=async()=>{};usuario={nombre:'Docente'};nav={...inicial,vista:'mascotas',mes:'2026-07',estado:'atendida',buscar:'Luna'}",c);
 async function render(){const nav=vm.runInContext('({...nav})',c);c.payload=await getPanel(db,new URLSearchParams(nav));vm.runInContext('datos=payload;renderizar()',c);return nav;}
 const action=async(action,id,vet)=>click({target:{closest:()=>({disabled:false,dataset:{action,id,vet}})}});
 await render();assert.match(html,/1 · RESUMEN POR MASCOTA/);assert.match(html,/Ver consultas/);
 await action('mascota','1');await render();assert.match(html,/2 · HISTORIAL DE LA MASCOTA/);assert.match(html,/Volver a Mascotas/);assert.match(html,/<thead><tr><th>Tipo<\/th>/);assert.doesNotMatch(html,/<th>Mascota y dueño<\/th>/);assert.match(html,/>Ver consulta<\/button>/);
 vm.runInContext('exportar()',c);const csv=await exported.text();assert.match(csv,/importe_pesos/);assert.match(csv,/Luna/);
 const id=String(c.payload.consultas[0].id);await action('consulta',id,'1');let nav=await render();assert.equal(nav.mascota,'1');assert.equal(nav.veterinario,'');assert.match(html,/3 · CONSULTA/);assert.match(html,/Volver a las consultas de Luna/);
 await action('volver-mascota');nav=await render();assert.equal(nav.consulta,'');assert.equal(nav.mascota,'1');
 await action('volver-mascotas');nav=await render();assert.equal(nav.mascota,'');assert.equal(nav.vista,'mascotas');for(const [key,value]of Object.entries({mes:'2026-07',estado:'atendida',buscar:'Luna'}))assert.equal(nav[key],value);
 await action('mascota','1');await action('veterinario','2');assert.equal(vm.runInContext('nav.mascota',c),'');
 }finally{db.conn.close();}
});
