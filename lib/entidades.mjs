const tablas={duenos:'duenos',mascotas:'mascotas',veterinarios:'veterinarios'};
const invalido=texto=>{throw Error(texto+' inválido.');};
const idValido=v=>{const id=Number(v);if(!Number.isSafeInteger(id)||id<1)invalido('Identificador');return id;};
const texto=(v,max,campo)=>{const s=String(v??'').trim();if(!s||s.length>max)invalido(campo);return s;};
const mascotaDatos=b=>[texto(b.nombre,100,'Nombre'),['Perro','Gato'].includes(b.especie)?b.especie:invalido('Especie')];
function atomico(db,fn){db.conn.exec('BEGIN IMMEDIATE');try{const r=fn();db.conn.exec('COMMIT');return r;}catch(e){db.conn.exec('ROLLBACK');if(e.message.includes('UNIQUE'))throw Error('Matrícula inválida: ya está registrada.');throw e;}}
export function registros(db){return {
 duenos:db.conn.prepare(`SELECT d.*,COUNT(DISTINCT m.id) mascotas,COUNT(c.id) consultas FROM duenos d LEFT JOIN mascotas m ON m.dueno_id=d.id LEFT JOIN consultas c ON c.mascota_id=m.id GROUP BY d.id ORDER BY d.nombre,d.id`).all(),
 mascotas:db.conn.prepare(`SELECT m.*,d.nombre dueno,d.activo dueno_activo,COUNT(c.id) consultas FROM mascotas m JOIN duenos d ON d.id=m.dueno_id LEFT JOIN consultas c ON c.mascota_id=m.id GROUP BY m.id ORDER BY m.nombre,m.id`).all(),
 veterinarios:db.conn.prepare(`SELECT v.*,COUNT(c.id) consultas FROM veterinarios v LEFT JOIN consultas c ON c.veterinario_id=v.id GROUP BY v.id ORDER BY v.nombre,v.id`).all()
};}
export function guardarEntidad(db,b){
 const tabla=tablas[b.tipo];if(!tabla)invalido('Tipo');const id=b.id?idValido(b.id):null;
 return atomico(db,()=>{
  if(id&&!db.conn.prepare(`SELECT id FROM ${tabla} WHERE id=?`).get(id))invalido('Registro');
  let vals;
  if(tabla==='duenos')vals=[texto(b.nombre,100,'Nombre'),texto(b.telefono,50,'Teléfono')];
  if(tabla==='veterinarios')vals=[texto(b.nombre,100,'Nombre'),texto(b.matricula,50,'Matrícula')];
  if(tabla==='mascotas'){
   const dueno=idValido(b.dueno_id),d=db.conn.prepare('SELECT activo FROM duenos WHERE id=?').get(dueno),prev=id?db.conn.prepare('SELECT dueno_id FROM mascotas WHERE id=?').get(id):null;
   if(!d||(!d.activo&&prev?.dueno_id!==dueno))invalido('Cliente activo');
   vals=[...mascotaDatos(b),dueno];
  }
  const columnas=tabla==='duenos'?['nombre','telefono']:tabla==='veterinarios'?['nombre','matricula']:['nombre','especie','dueno_id'];
  let resultado=id;
  if(id)db.conn.prepare(`UPDATE ${tabla} SET ${columnas.map(c=>c+'=?').join(',')} WHERE id=?`).run(...vals,id);
  else resultado=Number(db.conn.prepare(`INSERT INTO ${tabla}(${columnas.join(',')}) VALUES(${columnas.map(()=>'?').join(',')})`).run(...vals).lastInsertRowid);
  if(tabla==='duenos'&&!id){
   const mascotas=b.mascotas??[];if(!Array.isArray(mascotas)||mascotas.length>30)invalido('Lista de mascotas');
   for(const m of mascotas)db.conn.prepare('INSERT INTO mascotas(nombre,especie,dueno_id) VALUES(?,?,?)').run(...mascotaDatos(m),resultado);
  }
  return {id:resultado};
 });
}
export function impactoEntidad(db,tipo,valor){
 const tabla=tablas[tipo],id=idValido(valor);if(!tabla)invalido('Tipo');
 const fila=db.conn.prepare(`SELECT * FROM ${tabla} WHERE id=?`).get(id);if(!fila)invalido('Registro');
 const condicion=tabla==='duenos'?'mascota_id IN (SELECT id FROM mascotas WHERE dueno_id=?)':tabla==='mascotas'?'mascota_id=?':'veterinario_id=?';
 const consultas=db.conn.prepare(`SELECT COUNT(*) total,COALESCE(SUM(CAST(ROUND(importe_pesos*100) AS INTEGER)),0)/100.0 cobrado FROM consultas WHERE ${condicion}`).get(id);
 const mascotas=tabla==='duenos'?db.conn.prepare('SELECT COUNT(*) total FROM mascotas WHERE dueno_id=?').get(id).total:tabla==='mascotas'?1:0;
 return {tipo,id,nombre:fila.nombre,mascotas,consultas:consultas.total,cobrado:consultas.cobrado,activo:fila.activo};
}
export function bajaEntidad(db,b){return atomico(db,()=>{
 const impacto=impactoEntidad(db,b.tipo,b.id),tabla=tablas[b.tipo];
 if(b.modo==='conservar'){db.conn.prepare(`UPDATE ${tabla} SET activo=0 WHERE id=?`).run(impacto.id);return {ok:true,...impacto,activo:0};}
 if(b.modo!=='eliminar'||b.confirmacion!=='ELIMINAR')invalido('Confirmación de eliminación');
 if(Number(b.consultas)!==impacto.consultas||Number(b.mascotas)!==impacto.mascotas||Number(b.cobrado)!==impacto.cobrado)throw Error('Resumen inválido: cambió el historial. Volvé a abrir la confirmación.');
 if(tabla==='duenos'){
  db.conn.prepare('DELETE FROM consultas WHERE mascota_id IN (SELECT id FROM mascotas WHERE dueno_id=?)').run(impacto.id);
  db.conn.prepare('DELETE FROM mascotas WHERE dueno_id=?').run(impacto.id);
 }else db.conn.prepare(`DELETE FROM consultas WHERE ${tabla==='mascotas'?'mascota_id':'veterinario_id'}=?`).run(impacto.id);
 db.conn.prepare(`DELETE FROM ${tabla} WHERE id=?`).run(impacto.id);
 return {ok:true,...impacto,eliminado:true};
 });}
export function reactivarEntidad(db,b){const tabla=tablas[b.tipo];if(!tabla)invalido('Tipo');const id=idValido(b.id);if(!db.conn.prepare(`UPDATE ${tabla} SET activo=1 WHERE id=?`).run(id).changes)invalido('Registro');return {id};}
