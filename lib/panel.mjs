// Cada indicador se obtiene con SELECT sobre las tablas, sin servicios externos.
export const semaforo = porcentaje => porcentaje === null ? 'neutral' : porcentaje >= 80 ? 'verde' : porcentaje >= 60 ? 'amarillo' : 'rojo';
export function rendimiento(fila) {
  const evaluables = fila.atendidas + fila.ausentes;
  const porcentaje = evaluables ? Math.round(fila.atendidas * 1000 / evaluables) / 10 : null;
  return {...fila, porcentaje, semaforo: semaforo(porcentaje)};
}
function filtros(params) {
  const condiciones = ['1=1'];
  const valores = [];
  const mes = params.get('mes');
  if (mes) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes)) throw Error('Período inválido.');
    condiciones.push('substr(c.fecha,1,7)=?'); valores.push(mes);
  }
  const vet = params.get('veterinario');
  if (vet) {
    if (!/^[1-9]\d*$/.test(vet)) throw Error('Veterinario inválido.');
    condiciones.push('c.veterinario_id=?'); valores.push(Number(vet));
  }
  const mascota=params.get('mascota');
  if(mascota){if(!/^[1-9]\d*$/.test(mascota)||!Number.isSafeInteger(Number(mascota)))throw Error('Mascota inválida.');condiciones.push('m.id=?');valores.push(Number(mascota));}
  const dueno=params.get('dueno');
  if(dueno){if(!/^[1-9]\d*$/.test(dueno)||!Number.isSafeInteger(Number(dueno)))throw Error('Dueño inválido.');condiciones.push('d.id=?');valores.push(Number(dueno));}
  const tipo=params.get('tipo');
  if(tipo){if(!['Control','Vacunación','Urgencia','Consulta general'].includes(tipo))throw Error('Tipo inválido.');condiciones.push('c.tipo=?');valores.push(tipo);}
  const estado = params.get('estado');
  if (estado) {
    if (!['atendida','ausente','programada','cancelada'].includes(estado)) throw Error('Estado inválido.');
    condiciones.push('c.estado=?'); valores.push(estado);
  }
  const buscar = params.get('buscar');
  if (buscar) {
    if (buscar.length > 100) throw Error('Búsqueda inválida.');
    condiciones.push("(m.nombre LIKE ? ESCAPE '\\' OR d.nombre LIKE ? ESCAPE '\\')");
    const patron = '%' + buscar.replace(/[\\%_]/g,'\\$&') + '%'; valores.push(patron,patron);
  }
  return {where:condiciones.join(' AND '), valores};
}
const relaciones = `FROM consultas c
  JOIN mascotas m ON m.id=c.mascota_id
  JOIN duenos d ON d.id=m.dueno_id
  JOIN veterinarios v ON v.id=c.veterinario_id`;
const medidas = `COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN c.estado='atendida' THEN 1 ELSE 0 END),0) AS atendidas,
  COALESCE(SUM(CASE WHEN c.estado='ausente' THEN 1 ELSE 0 END),0) AS ausentes,
  COALESCE(SUM(CASE WHEN c.estado='programada' THEN 1 ELSE 0 END),0) AS programadas,
  COALESCE(SUM(CASE WHEN c.estado='cancelada' THEN 1 ELSE 0 END),0) AS canceladas,
  COALESCE(SUM(CAST(ROUND(c.importe_pesos*100) AS INTEGER)),0)/100.0 AS cobrado`;
export async function getPanel(db, params) {
  const {where,valores} = filtros(params);
  if(params.get('veterinario')){const id=Number(params.get('veterinario'));if(!Number.isSafeInteger(id)||!await db.prepare('SELECT id FROM veterinarios WHERE id=?').bind(id).first())throw Error('Veterinario inválido.');}
  const propietario=params.get('dueno')?await db.prepare('SELECT id,nombre,telefono,activo FROM duenos WHERE id=?').bind(Number(params.get('dueno'))).first():null;
  if(params.get('dueno')&&!propietario)throw Error('Dueño inválido.');
  const ficha=params.get('ficha');
  if(ficha&&(!/^[1-9]\d*$/.test(ficha)||!Number.isSafeInteger(Number(ficha))))throw Error('Mascota inválida.');
  if(ficha&&params.get('mascota')&&ficha!==params.get('mascota'))throw Error('Mascota inválida.');
  const paciente=ficha||params.get('mascota')?await db.prepare('SELECT m.*,d.nombre dueno,d.telefono,d.activo dueno_activo,(SELECT COUNT(*) FROM consultas c WHERE c.mascota_id=m.id) consultas_total FROM mascotas m JOIN duenos d ON d.id=m.dueno_id WHERE m.id=?').bind(Number(ficha||params.get('mascota'))).first():null;
  if((ficha||params.get('mascota'))&&!paciente)throw Error('Mascota inválida.');
  const consultar = async sql => (await db.prepare(sql).bind(...valores).all()).results;
  const [resumen, veterinarios, consultas, mascotas, duenos, meses, tipos] = await Promise.all([
    consultar(`SELECT ${medidas}, COUNT(DISTINCT c.mascota_id) AS mascotas,
      COUNT(DISTINCT d.id) AS duenos ${relaciones} WHERE ${where}`),
    consultar(`SELECT v.id,v.nombre,v.matricula,${medidas} ${relaciones} WHERE ${where}
      GROUP BY v.id,v.nombre,v.matricula ORDER BY v.id`),
    consultar(`SELECT c.*,m.nombre AS mascota,m.especie,d.nombre AS dueno,d.telefono,
      v.nombre AS veterinario,v.matricula ${relaciones} WHERE ${where} ORDER BY c.fecha DESC,c.id`),
    consultar(`SELECT m.id,m.nombre,m.especie,d.nombre AS dueno,${medidas} ${relaciones}
      WHERE ${where} GROUP BY m.id,m.nombre,m.especie,d.nombre ORDER BY total DESC,m.nombre`),
    consultar(`SELECT d.id,d.nombre,d.telefono,COUNT(DISTINCT m.id) AS mascotas,${medidas} ${relaciones}
      WHERE ${where} GROUP BY d.id,d.nombre,d.telefono ORDER BY total DESC,d.nombre`),
    consultar(`SELECT substr(c.fecha,1,7) AS mes,${medidas} ${relaciones} WHERE ${where}
      GROUP BY substr(c.fecha,1,7) ORDER BY mes`),
    consultar(`SELECT c.tipo,COUNT(*) AS total ${relaciones} WHERE ${where} GROUP BY c.tipo ORDER BY total DESC,c.tipo`)
  ]);
  let detalle = null;
  if (params.get('consulta')) {
    const id = Number(params.get('consulta'));
    if (!Number.isSafeInteger(id) || id < 1) throw Error('Consulta inválida.');
    detalle = await db.prepare(`SELECT c.*,m.nombre AS mascota,m.especie,d.nombre AS dueno,d.telefono,
      v.nombre AS veterinario,v.matricula ${relaciones} WHERE ${where} AND c.id=?`)
      .bind(...valores,id).first();
  }
  const catalogo = (await db.prepare('SELECT id,nombre,activo FROM veterinarios ORDER BY id').all()).results;
  const periodos=(await db.prepare("SELECT DISTINCT substr(fecha,1,7) mes FROM consultas ORDER BY mes").all()).results.map(r=>r.mes);
  const pacientes=(await db.prepare('SELECT m.id,m.nombre,m.especie,m.activo,d.activo dueno_activo,d.nombre dueno FROM mascotas m JOIN duenos d ON d.id=m.dueno_id ORDER BY m.nombre,m.id').all()).results;
  const pesos=r=>r;
  const importe=r=>r;
  return {kpi:pesos(rendimiento(resumen[0])),veterinarios:veterinarios.map(r=>pesos(rendimiento(r))),consultas:consultas.map(importe),
    mascotas:mascotas.map(pesos),duenos:duenos.map(pesos),meses:meses.map(pesos),tipos,detalle:importe(detalle),metadata:{catalogo,pacientes,periodos,propietario,paciente,datos:'Datos de demostración',zona:'Argentina UTC−3'}};
}
