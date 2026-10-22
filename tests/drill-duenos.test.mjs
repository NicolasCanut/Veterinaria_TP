import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
test('Owner summary drills to matching consultations and detail, preserves filters and rejects unrelated detail',async()=>{
 const db=database();await inicializar(db);
 try{
 for(const mes of ['','2026-07','2026-10'])for(const estado of ['','atendida','ausente']){
  const filtros={mes,estado,buscar:''};const overview=await getPanel(db,new URLSearchParams(filtros));
  for(const owner of overview.duenos){
   const scope={...filtros,dueno:String(owner.id)},history=await getPanel(db,new URLSearchParams(scope));
   assert.equal(history.kpi.total,owner.total);assert.equal(history.kpi.cobrado,owner.cobrado);assert.equal(history.metadata.propietario.id,owner.id);
   for(const c of history.consultas){assert.equal(db.conn.prepare('SELECT dueno_id FROM mascotas WHERE id=?').get(c.mascota_id).dueno_id,owner.id);const detail=await getPanel(db,new URLSearchParams({...scope,consulta:String(c.id)}));assert.equal(detail.detalle.id,c.id);assert.deepEqual(detail.kpi,history.kpi);}
   const unrelated=overview.consultas.find(c=>!history.consultas.some(x=>x.id===c.id));if(unrelated)assert.equal((await getPanel(db,new URLSearchParams({...scope,consulta:String(unrelated.id)}))).detalle,null);
  }
 }
 const empty=await getPanel(db,new URLSearchParams({dueno:'1',buscar:'no existe mascota',mes:'2026-07'}));assert.equal(empty.kpi.total,0);assert.equal(empty.metadata.propietario.id,1);
 for(const dueno of ['0','-1','1 OR 1=1','999999','9007199254740993'])await assert.rejects(getPanel(db,new URLSearchParams({dueno})),/inválido/);
 }finally{db.conn.close();}
});
test('Owner drill down and up retain filters and origin, render three levels and export historical rows',async()=>{
 const db=database();await inicializar(db);let html='',click,exported;
 try{
 const app={set innerHTML(v){html=v},addEventListener(name,fn){if(name==='click')click=fn}};
 const c=vm.createContext({Intl,Date,URLSearchParams,Blob,location:{search:''},history:{pushState(){}},document:{getElementById:()=>app,createElement:()=>({click(){}})},URL:{createObjectURL(b){exported=b;return 'blob:test'},revokeObjectURL(){}}});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');vm.runInContext(source.slice(0,source.indexOf("root.addEventListener('change'"))+source.slice(source.indexOf('function rutaNavegacion(')),c);
 vm.runInContext("cargar=async()=>{};usuario={nombre:'Docente'};nav={...inicial,vista:'duenos',mes:'2026-07',estado:'atendida',buscar:'Ana'}",c);
 async function render(){const nav=vm.runInContext('({...nav})',c);c.payload=await getPanel(db,new URLSearchParams(nav));vm.runInContext('datos=payload;renderizar()',c);return nav;}
 const action=async(action,id,vet)=>click({target:{closest:()=>({disabled:false,dataset:{action,id,vet}})}});
 await render();assert.match(html,/1 · RESUMEN POR DUEÑO/);assert.match(html,/Ver consultas/);
 await action('dueno','1');await render();assert.match(html,/2 · HISTORIAL DEL DUEÑO/);assert.match(html,/Volver a Dueños/);
 vm.runInContext('exportar()',c);const csv=await exported.text();assert.match(csv,/importe_pesos/);assert.match(csv,/Ana Torres/);
 const id=String(c.payload.consultas[0].id);await action('consulta',id,'1');let nav=await render();assert.equal(nav.dueno,'1');assert.equal(nav.veterinario,'');assert.match(html,/3 · CONSULTA/);assert.match(html,/Volver a las consultas de Ana Torres/);
 await action('volver-dueno');nav=await render();assert.equal(nav.consulta,'');assert.equal(nav.dueno,'1');
 await action('volver-duenos');nav=await render();assert.equal(nav.dueno,'');assert.equal(nav.vista,'duenos');for(const [key,value]of Object.entries({mes:'2026-07',estado:'atendida',buscar:'Ana'}))assert.equal(nav[key],value);
 await action('dueno','1');await action('veterinario','2');assert.equal(vm.runInContext('nav.dueno',c),'');
 }finally{db.conn.close();}
});
