export function importeGuardado(valor) {
  const texto=String(valor??'0').trim();
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(texto))throw Error('Importe inválido. Usá pesos, por ejemplo 15.000,50.');
  const [entero,decimales='']=texto.replaceAll('.','').split(',');
  const importe=Number(entero)*100+Number(decimales.padEnd(2,'0'));
  if(!Number.isSafeInteger(importe)||importe>100000000000)throw Error('Importe inválido.');
  return importe;
}
async function validarConsulta(db,body,anterior=null) {
  const mascota=Number(body.mascota_id),veterinario=Number(body.veterinario_id);
  if(!Number.isSafeInteger(mascota)||mascota<1||!Number.isSafeInteger(veterinario)||veterinario<1)throw Error('Mascota o veterinario inválido.');
  let fecha=String(body.fecha||'');if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha))fecha+=':00';
  const parsed=Date.parse(fecha+'Z');
  if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(fecha)||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,19)!==fecha)throw Error('Fecha inválida.');
  const tipo=String(body.tipo||''),estado=String(body.estado||''),motivo=String(body.motivo||'').trim();
  if(!['Control','Vacunación','Urgencia','Consulta general'].includes(tipo)||!['atendida','ausente','programada','cancelada'].includes(estado))throw Error('Tipo o estado inválido.');
  if(['atendida','ausente'].includes(estado)&&Date.parse(fecha+'-03:00')>Date.now())throw Error('Estado inválido: un turno futuro debe quedar pendiente o cancelado.');
  if(!motivo||motivo.length>200)throw Error('Motivo inválido. Escribí entre 1 y 200 caracteres.');
  const importe=importeGuardado(body.importe_pesos);
  if(estado!=='atendida'&&importe!==0)throw Error('Importe inválido. Sólo un turno atendido puede registrar un cobro.');
  const m=await db.prepare('SELECT m.activo,d.activo dueno_activo FROM mascotas m JOIN duenos d ON d.id=m.dueno_id WHERE m.id=?').bind(mascota).first(),v=await db.prepare('SELECT activo FROM veterinarios WHERE id=?').bind(veterinario).first();
  if(!m||!v||((!m.activo||!m.dueno_activo)&&anterior?.mascota_id!==mascota)||(!v.activo&&anterior?.veterinario_id!==veterinario))throw Error('Mascota, cliente o veterinario inválido: está dado de baja.');
  return [mascota,veterinario,fecha,motivo,tipo,estado,importe/100];
}
export async function nuevaConsulta(db,body) {
  const valores=await validarConsulta(db,body);
  try {
    const r=await db.prepare('INSERT INTO consultas(mascota_id,veterinario_id,fecha,motivo,tipo,estado,importe_pesos) VALUES(?,?,?,?,?,?,?)').bind(...valores).run();
    return{id:Number(r.lastInsertRowid)};
  } catch(e) {if(e.message.includes('UNIQUE'))throw Error('Turno inválido: esa mascota o profesional ya tiene una consulta en ese horario.');throw e;}
}

function consultaId(valor) {
  const id=Number(valor);
  if(!Number.isSafeInteger(id)||id<1)throw Error('Consulta inválida.');
  return id;
}
export async function modificarConsulta(db,body) {
  const id=consultaId(body.id),anterior=await db.prepare('SELECT mascota_id,veterinario_id FROM consultas WHERE id=?').bind(id).first();
  if(!anterior)throw Error('Consulta inválida: ya no existe.');
  const valores=await validarConsulta(db,body,anterior);
  try {
    const r=await db.prepare('UPDATE consultas SET mascota_id=?,veterinario_id=?,fecha=?,motivo=?,tipo=?,estado=?,importe_pesos=? WHERE id=?').bind(...valores,id).run();
    if(!Number(r.changes))throw Error('Consulta inválida: ya no existe.');
    return {id};
  }catch(e){if(e.message.includes('UNIQUE'))throw Error('Turno inválido: esa mascota o profesional ya tiene una consulta en ese horario.');throw e;}
}
export async function eliminarConsulta(db,body) {
  const id=consultaId(body.id);
  const r=await db.prepare('DELETE FROM consultas WHERE id=?').bind(id).run();
  if(!Number(r.changes))throw Error('Consulta inválida: ya no existe.');
  return {id};
}
