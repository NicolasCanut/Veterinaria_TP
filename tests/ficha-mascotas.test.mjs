import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
import {guardarEntidad,bajaEntidad} from '../lib/entidades.mjs';
test('Pet profile returns registered data independently of consultation filters, including inactive and new pets',async()=>{
 const db=database();await inicializar(db);
 try{
 const q={mascota:'1',ficha:'1',mes:'2026-07',buscar:'no existe'};
 let panel=await getPanel(db,new URLSearchParams(q));const pet=panel.metadata.paciente;
 assert.equal(pet.id,1);assert.equal(pet.nombre,'Luna');assert.equal(pet.dueno_id,1);assert.ok(pet.telefono);assert.equal(panel.consultas.length,0);
 assert.equal(pet.consultas_total,db.conn.prepare('SELECT COUNT(*) total FROM consultas WHERE mascota_id=1').get().total);
 bajaEntidad(db,{tipo:'mascotas',id:1,modo:'conservar'});panel=await getPanel(db,new URLSearchParams(q));assert.equal(panel.metadata.paciente.activo,0);assert.equal(panel.metadata.paciente.consultas_total,pet.consultas_total);
 const added=guardarEntidad(db,{tipo:'mascotas',nombre:'Sin consultas',especie:'Gato',dueno_id:1});panel=await getPanel(db,new URLSearchParams({ficha:String(added.id),mascota:String(added.id)}));assert.equal(panel.metadata.paciente.consultas_total,0);assert.equal(panel.kpi.total,0);
 for(const ficha of ['0','-1','1 OR 1=1','999999','9007199254740993'])await assert.rejects(getPanel(db,new URLSearchParams({ficha})),/inválida/);
 await assert.rejects(getPanel(db,new URLSearchParams({ficha:'1',mascota:'2'})),/inválida/);
 }finally{db.conn.close();}
});
test('Pet names open profile across lists, detail and management; profile navigates history, detail and back to origin',async()=>{
 const db=database();await inicializar(db);let html='',click,exported,lastUrl;
 try{
 const app={set innerHTML(v){html=v},addEventListener(name,fn){if(name==='click')click=fn}};
 const c=vm.createContext({Intl,Date,URLSearchParams,Blob,location:{search:''},history:{pushState(a,b,url){lastUrl=url}},document:{getElementById:()=>app,createElement:()=>({click(){}})},URL:{createObjectURL(b){exported=b;return 'blob:test'},revokeObjectURL(){}}});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');vm.runInContext(source.slice(0,source.indexOf("root.addEventListener('change'"))+source.slice(source.indexOf('const nombresGestion='),source.indexOf('function filaMascota('))+source.slice(source.indexOf('function rutaNavegacion(')),c);
 vm.runInContext("cargar=async()=>{};usuario={nombre:'Docente'};nav={...inicial,vista:'mascotas',mes:'2026-07',estado:'atendida',buscar:'Luna'}",c);
 async function render(){const nav=vm.runInContext('({...nav})',c);c.payload=await getPanel(db,new URLSearchParams(nav));vm.runInContext('datos=payload;renderizar()',c);return nav;}
 const action=async(action,id,vet)=>click({target:{closest:()=>({disabled:false,dataset:{action,id,vet}})}});
 await render();assert.match(html,/data-action="ficha" data-id="1" aria-label="Ver ficha de Luna"/);
 const origin=vm.runInContext('JSON.stringify(nav)',c);await action('ficha','1');await render();assert.match(html,/Datos de la mascota/);assert.match(html,/Estado del dueño/);assert.match(html,/ficha-consultas/);assert.match(html,/Volver a la pantalla anterior/);
 c.location.search=lastUrl;assert.equal(vm.runInContext('leerURL().ficha',c),'1');
 vm.runInContext('exportar()',c);assert.match(await exported.text(),/consultas_total/);
 await action('ficha-consultas');await render();assert.match(html,/<thead><tr><th>Tipo<\/th>/);assert.doesNotMatch(html,/<th>Mascota y dueño/);assert.match(html,/Volver a la ficha/);
 await action('consulta',String(c.payload.consultas[0].id),'1');await render();assert.match(html,/3 · CONSULTA/);assert.match(html,/data-action="ficha" data-id="1"/);
 await action('volver-mascota');await render();assert.equal(vm.runInContext('nav.historial',c),'1');await action('ficha-resumen');await render();assert.match(html,/Datos de la mascota/);
 await action('volver-origen');await render();assert.equal(vm.runInContext('JSON.stringify(nav)',c),origin);
 // Names in each consultation listing and a specific consultation open the same profile.
 for(const state of ["vista:'general'","vista:'consultas'","vista:'duenos',dueno:'1'","tipo:'Vacunación'","veterinario:'1'","vista:'general',veterinario:'1',consulta:'1'"]){
  vm.runInContext(`nav={...inicial,${state},mes:'2026-07',estado:'atendida'}`,c);await render();assert.match(html,/data-action="ficha" data-id="1"/);
  const previous=vm.runInContext('JSON.stringify(nav)',c);await action('ficha','1');await render();await action('volver-origen');await render();assert.equal(vm.runInContext('JSON.stringify(nav)',c),previous);
 }
 c.registry={mascotas:[{id:1,nombre:'Luna',especie:'Perro',dueno:'Ana',activo:1,dueno_activo:1,consultas:5}]};vm.runInContext("nav={...inicial,vista:'gestion'};gestion=registry;gestionTipo='mascotas'",c);await render();assert.match(html,/data-action="ficha" data-id="1"/);
 await action('ficha','1');await render();await action('vista',undefined);assert.equal(vm.runInContext('nav.ficha',c),'');
 }finally{db.conn.close();}
});
