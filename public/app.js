// Estado de navegación: los filtros viajan a SELECT mediante /api/panel.
const root = document.getElementById('app');
const inicial = {vista:'general',veterinario:'',dueno:'',mascota:'',tipo:'',consulta:'',ficha:'',historial:'',origen:'',mes:'',estado:'',buscar:''};
let gestion=null,gestionTipo='duenos';
let nav = leerURL(), usuario = null, datos = null, pendiente = false, error = '', controlador, buscador, focoBusqueda;
const escapeHTML = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h = escapeHTML;
const numero = valor => new Intl.NumberFormat('es-AR').format(valor || 0);
const dinero = pesos => '$'+new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(pesos);
const porcentaje = valor => valor === null ? 'Sin datos' : numero(valor) + '%';
const mesNombre = mes => new Date(mes+'-15T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'});
const fecha = valor => new Date(valor).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
const hora = valor => valor.slice(11,16);
const estadoNombre = {atendida:'Atendida',ausente:'Ausente',programada:'Programada',cancelada:'Cancelada'};
const vistas = [['general','Panorama','◫'],['consultas','Consultas','▦'],['mascotas','Mascotas','♧'],['duenos','Dueños','♙'],['veterinarios','Veterinarios','✚'],['gestion','Gestionar registros','⚙']];
const brand = () => '<div class="brand"><img src="/logo.svg" alt=""><span>Huellas<small>Panel veterinario</small></span></div>';
const semaforo = fila => `<span class="traffic ${h(fila.semaforo)}"><i></i>${porcentaje(fila.porcentaje)}</span>`;
const estado = valor => `<span class="status ${h(valor)}">${h(estadoNombre[valor])}</span>`;
const vacio = (texto='No hay resultados para estos filtros.') => `<div class="empty">${h(texto)}</div>`;
function leerURL() {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(Object.entries(inicial).map(([clave,valor]) => [clave,params.get(clave)||valor]));
}
function ir(cambios) {
  nav = {...nav,...cambios};
  const params = new URLSearchParams();
  for (const [clave,valor] of Object.entries(nav)) if (valor && valor !== 'general') params.set(clave,valor);
  history.pushState(null,'',params.size?'?'+params:'/');
  cargar();
}
async function peticion(query='',opciones={}) {
  const respuesta = await fetch('/api/panel?'+query,opciones);
  const json = await respuesta.json();
  if (!respuesta.ok) { if (respuesta.status===401) usuario=null; throw Error(json.error||'No se pudo completar la consulta.'); }
  return json;
}
async function cargar() {
  if (document.activeElement?.id==='buscar') focoBusqueda=document.activeElement.selectionStart;
  controlador?.abort(); controlador = new AbortController();
  const actual = controlador;
  pendiente = true; error = ''; datos = null; renderizar();
  try {
    const params = new URLSearchParams(nav);
    datos = await peticion(params.toString(),{signal:actual.signal});
    if(nav.vista==='gestion')gestion=await peticion('accion=gestion',{signal:actual.signal});
  } catch (e) { if (e.name==='AbortError') return; error=e.message; }
  if (actual.signal.aborted) return;
  pendiente=false; renderizar();
}
function login() {
  root.innerHTML = `<main class="login"><section class="login-story">${brand()}<div><span class="eyebrow">La actividad en perspectiva</span><h1>Cuidar empieza<br>por conocer.</h1><p>Una mirada clara sobre las consultas, las mascotas y las personas que las acompañan.</p><div class="paw-art"><img src="/logo.svg" alt=""><div class="mini-note"><strong>4</strong>entidades conectadas<br>por una base SQL.</div></div></div><p class="muted">Caso académico · Veterinaria Huellas</p></section><section class="login-form"><div class="login-inner"><div class="mobile-brand">${brand()}</div><span class="eyebrow">Acceso al tablero</span><h2>Bienvenido a Huellas.</h2><p class="muted">Ingresá para explorar la actividad de la veterinaria.</p><form id="login"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="username" placeholder="tu@correo.com" required><label for="password">Contraseña</label><div class="password"><input id="password" name="password" type="password" autocomplete="current-password" required><button type="button" data-action="password">Mostrar</button></div><p id="login-error" role="alert" class="error" hidden></p><button class="primary" type="submit">Entrar al panel →</button></form><div class="demo"><strong>Acceso de demostración</strong>docente@vet.local<br>Veterinaria2026!<button data-action="credenciales">Completar credenciales ↗</button></div><p class="muted" style="margin-top:22px;font-size:10px">Datos ficticios · Base de Datos Aplicada I / II</p></div></section></main>`;
}
const esFicha=()=>Boolean(nav.ficha&&!nav.historial&&!nav.consulta);
const enlaceMascota=(id,nombre)=>`<button class="text-link pet-link" data-action="ficha" data-id="${h(id)}" aria-label="Ver ficha de ${h(nombre)}">${h(nombre)}</button>`;
function fichaMascota(){
 const m=datos.metadata.paciente;if(!m)return vacio('La mascota no existe.');
 const filas=[['ID',m.id],['Nombre',m.nombre],['Especie',m.especie],['Estado',m.activo?'Activa':'De baja'],['Dueño',m.dueno],['Teléfono',m.telefono],['Estado del dueño',m.dueno_activo?'Activo':'De baja']];
 return `<section class="panel"><div class="panel-head"><div><h2>Datos de la mascota</h2><p>Información registrada del paciente y su dueño.</p></div></div><dl class="details">${filas.map(([t,v])=>`<div><dt>${h(t)}</dt><dd>${h(v)}</dd></div>`).join('')}</dl></section><section class="panel"><div class="panel-head"><div><h2>Consultas de esta mascota</h2><p>${m.consultas_total} consultas en todo su historial · ${datos.consultas.length} con los filtros actuales.</p></div><button class="text-link" data-action="ficha-consultas">Ver consultas de ${h(m.nombre)} →</button></div><p>Desde el historial podés abrir el detalle de cada consulta.</p></section>`;
}
function tablaConsultas() {
  if (!datos.consultas.length) return vacio();
  const porMascota=Boolean(nav.mascota),porTipo=Boolean(nav.tipo);
  return `<div class="scroll"><table><thead><tr>${porMascota?'<th>Tipo</th>':'<th>Mascota y dueño</th>'}<th>Fecha</th><th>Veterinario</th>${porMascota||porTipo?'':'<th>Tipo</th>'}<th>Estado</th><th>Cobrado</th><th>Detalle</th></tr></thead><tbody>${datos.consultas.map(c=>`<tr>${porMascota?`<td>${h(c.tipo)}</td>`:`<td><strong>${enlaceMascota(c.mascota_id,c.mascota)}</strong><small>${h(c.especie)} · ${h(c.dueno)}</small></td>`}<td>${fecha(c.fecha)}<small>${hora(c.fecha)} h</small></td><td>${h(c.veterinario)}</td>${porMascota||porTipo?'':`<td>${h(c.tipo)}</td>`}<td>${estado(c.estado)}</td><td>${dinero(c.importe_pesos)}</td><td><button class="text-link" data-action="consulta" data-id="${c.id}" data-vet="${c.veterinario_id}" aria-label="Ver consulta ${c.id}">Ver consulta</button></td></tr>`).join('')}</tbody></table></div>`;
}
function kpis() {
  const k=datos.kpi;
  return `<div class="kpis"><div class="kpi"><span>Consultas agendadas</span><strong>${numero(k.total)}</strong><p>${k.atendidas} atendidas · ${k.ausentes} ausentes<br>${k.programadas} pendientes · ${k.canceladas} canceladas</p></div><div class="kpi"><span>Mascotas en el período</span><strong>${numero(k.mascotas)}</strong><p>${k.duenos} dueños distintos</p></div><div class="kpi"><span>Porcentaje de turnos atendidos</span><strong>${porcentaje(k.porcentaje)}</strong><p>De ${k.atendidas+k.ausentes} turnos que debían haberse realizado, se atendieron ${k.atendidas}</p></div><div class="kpi"><span>Importe cobrado</span><strong class="kpi-money">${dinero(k.cobrado)}</strong><p>Suma de consultas atendidas</p></div></div>`;
}
function tarjetasVet() {
  return `<section><div class="section-title"><div><h2>La actividad de cada profesional</h2><p>Elegí un veterinario para ver sus consultas.</p></div><small>NIVEL 1 → NIVEL 2</small></div><div class="vet-grid">${datos.veterinarios.map(v=>`<button class="vet-card" data-action="veterinario" data-id="${v.id}"><div class="vet-top"><span class="avatar">${h(v.nombre.split(' ').map(n=>n[0]).join(''))}</span><span>↗</span></div><h3>${h(v.nombre)}</h3><p>Matrícula ${h(v.matricula)}</p><div class="vet-values"><strong>${v.total}</strong><span>consultas</span></div>${semaforo(v)}<p style="margin-top:12px">${v.atendidas} atendidas · ${v.ausentes} ausentes</p></button>`).join('')}</div>${datos.veterinarios.length?'':vacio()}</section>`;
}
function graficos() {
  const max=Math.max(1,...datos.meses.map(m=>m.total)),maxTipo=Math.max(1,...datos.tipos.map(t=>t.total));
  return `<div class="charts"><section class="panel"><div class="panel-head"><div><h2>Consultas a lo largo del tiempo</h2><p>Turnos registrados por mes, incluidos todos sus estados.</p></div></div><div class="chart-bars" role="img" aria-label="Consultas por mes">${datos.meses.map(m=>`<div class="bar-group"><strong>${m.total}</strong><div class="bar" style="height:${m.total/max*115}px"></div><span>${h(mesNombre(m.mes).split(' ')[0])}</span></div>`).join('')||vacio('Sin actividad en el período.')}</div></section><section class="panel"><div class="panel-head"><div><h2>Consultas por tipo</h2><p>Elegí un tipo para ver sus consultas.</p></div></div><div class="types">${datos.tipos.map(t=>`<button class="type-row type-drill" data-action="tipo" data-tipo="${h(t.tipo)}" aria-label="Ver ${t.total} consultas de tipo ${h(t.tipo)}"><span>${h(t.tipo)}</span><span class="track"><i style="width:${t.total/maxTipo*100}%"></i></span><strong>${t.total} ↗</strong></button>`).join('')||vacio()}</div></section></div>`;
}
function entidadTabla(tipo) {
  const esMascotas=tipo==='mascotas',lista=datos[tipo];
  const encabezado=esMascotas?['Mascota','Especie','Dueño','Consultas','Atendidas','Cobrado']:['Dueño','Teléfono','Mascotas','Consultas','Atendidas','Cobrado'];
  return `<section class="panel"><div class="panel-head"><div><h2>${esMascotas?'Pacientes de la veterinaria':'Personas que los acompañan'}</h2><p>${esMascotas?'Cada mascota se cuenta una vez; sus consultas se agrupan.':'Mascotas distintas y consultas correspondientes a cada dueño.'}</p></div><span class="count">${lista.length} ${tipo==='duenos'?'dueños':'mascotas'}</span></div>${lista.length?`<div class="scroll"><table><thead><tr>${encabezado.map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${lista.map(r=>`<tr><td><strong>${esMascotas?enlaceMascota(r.id,r.nombre):h(r.nombre)}</strong></td>${esMascotas?`<td>${h(r.especie)}</td><td>${h(r.dueno)}</td>`:`<td>${h(r.telefono)}</td><td>${r.mascotas}</td>`}<td>${`<button class="text-link" data-action="${esMascotas?'mascota':'dueno'}" data-id="${r.id}">${r.total} · Ver consultas</button>`}</td><td>${r.atendidas}</td><td>${dinero(r.cobrado)}</td></tr>`).join('')}</tbody></table></div>`:vacio()}</section>`;
}
function detalle() {
  const c=datos.detalle;
  if (!c) return vacio('La consulta no pertenece a los filtros actuales. Volvé al historial o limpiá los filtros.');
  const pares = filas => `<dl class="details">${filas.map(([t,v])=>`<div><dt>${h(t)}</dt><dd>${t==='Mascota'?enlaceMascota(c.mascota_id,v):h(v)}</dd></div>`).join('')}</dl>`;
  return `<section class="summary"><div><span class="eyebrow">Consulta ${c.id}</span><h2 style="margin-top:8px">${enlaceMascota(c.mascota_id,c.mascota)} · ${h(c.tipo)}</h2><p>${fecha(c.fecha)} · ${hora(c.fecha)} h · ${h(c.veterinario)}</p></div><div class="consulta-actions">${estado(c.estado)}<button class="outline" data-action="editar">Editar consulta</button><button class="outline danger" data-action="eliminar">Eliminar consulta</button></div></section><div class="detail-grid"><section class="panel"><div class="panel-head"><h2>La mascota y su dueño</h2></div>${pares([['Mascota',c.mascota],['Especie',c.especie],['Dueño',c.dueno],['Teléfono',c.telefono]])}</section><section class="panel"><div class="panel-head"><h2>Datos de la consulta</h2></div>${pares([['Profesional',c.veterinario],['Matrícula',c.matricula],['Motivo',c.motivo],['Importe cobrado',dinero(c.importe_pesos)]])}</section></div><section class="panel"><div class="panel-head"><h2>Cómo se relacionan estos datos</h2></div><p class="sql-note">El detalle reúne una fila de <strong>consultas</strong> con su <strong>mascota</strong>, el <strong>dueño</strong> de esa mascota y el <strong>veterinario</strong>. Las claves foráneas permiten unir las cuatro tablas con JOIN.</p></section>`;
}
function contenido() {
  if (pendiente) return '<div class="loading" role="status">Consultando la base SQL…</div>';
  if (error) return `<div class="error" role="alert">${h(error)} <button class="outline" data-action="reintentar">Reintentar</button></div>`;
  if (!datos) return '';
  if(esFicha())return fichaMascota();
  if(nav.vista==='gestion')return vistaGestion();
  if (nav.consulta) return detalle();
  let body=kpis();
  if(nav.tipo)body+=`<section class="summary"><div><span class="eyebrow">Consultas del tipo seleccionado</span><h2>${h(nav.tipo)}</h2><p>${datos.consultas.length} consultas con los filtros actuales. Usá Ver consulta para abrir una atención.</p></div></section>`;
  if(nav.mascota)body+=`<section class="summary"><div><span class="eyebrow">Historial de la mascota</span><h2>${enlaceMascota(nav.mascota,datos.metadata.paciente?.nombre||'Mascota')}</h2><p>${h(datos.metadata.paciente?.especie||'')} · Dueño: ${h(datos.metadata.paciente?.dueno||'')} · ${datos.consultas.length} consultas con los filtros actuales. Elegí una para ver su detalle.</p></div></section>`;
  if(nav.dueno)body+=`<section class="summary"><div><span class="eyebrow">Historial del dueño</span><h2>${h(datos.metadata.propietario?.nombre||'Dueño')}</h2><p>${h(datos.metadata.propietario?.telefono||'')} · ${datos.consultas.length} consultas con los filtros actuales. Elegí una para ver su detalle.</p></div></section>`;
  if (nav.veterinario) {
    const v=datos.veterinarios.find(v=>v.id===Number(nav.veterinario));
    body+=`<section class="summary"><div><h2>${h(datos.metadata.catalogo.find(v=>v.id===Number(nav.veterinario))?.nombre||'Veterinario')}</h2><p>${datos.consultas.length} consultas con los filtros actuales. Elegí una para abrir su detalle.</p></div>${v?semaforo(v):'<span class="traffic neutral">Sin datos</span>'}</section>`;
  }
  if (nav.vista==='general'&&!nav.veterinario&&!nav.tipo) body+=graficos()+tarjetasVet();
  if (nav.vista==='veterinarios'&&!nav.veterinario) body+=tarjetasVet();
  if (!nav.dueno&&!nav.mascota&&(nav.vista==='mascotas'||nav.vista==='duenos')) return body+entidadTabla(nav.vista);
  return body+`<section class="panel"><div class="panel-head"><div><h2>${nav.tipo?'Consultas de '+h(nav.tipo):nav.mascota?'Consultas de la mascota':nav.dueno?'Consultas del dueño':nav.veterinario?'Consultas del profesional':'Registro de consultas'}</h2><p>Usá Ver consulta para ver el detalle completo.</p></div><label class="search"><input id="buscar" aria-label="Buscar mascota o dueño" placeholder="Mascota o dueño…" value="${h(nav.buscar)}"></label></div>${tablaConsultas()}</section>`;
}
function renderizar() {
  if (!usuario) {login();return;}
  const foco=document.activeElement?.id,seleccion=document.activeElement?.selectionStart;
  const periodos=datos?.metadata.periodos||[];
  const vetNombre=datos?.metadata.catalogo.find(v=>v.id===Number(nav.veterinario))?.nombre;
  const duenoNombre=datos?.metadata.propietario?.nombre;
  const mascotaNombre=datos?.metadata.paciente?.nombre;
  const titulo=esFicha()?'Ficha de '+(mascotaNombre||'la mascota'):nav.consulta?'Detalle de la consulta':nav.tipo?'Consultas de '+nav.tipo:nav.mascota?mascotaNombre||'Historial de la mascota':nav.dueno?duenoNombre||'Historial del dueño':nav.veterinario?vetNombre||'Consultas del veterinario':vistas.find(v=>v[0]===nav.vista)?.[1]||'Panorama';
  root.innerHTML=`<div class="shell"><aside class="sidebar">${brand()}<span class="nav-title">EXPLORAR LA ACTIVIDAD</span><nav>${vistas.map(([id,nombre,icono])=>`<button data-action="vista" data-vista="${id}" class="${nav.vista===id?'active':''}"><span class="nav-icon">${icono}</span>${nombre}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="academic"><strong>Edición académica</strong><br>Datos de demostración · Base local<br>Cuatro entidades · Una base SQL</div><button class="profile" data-action="logout"><span class="avatar">D</span><span><strong>${h(usuario.nombre)}</strong><small>Cerrar sesión</small></span><span>↪</span></button></div></aside><div class="main"><header class="topbar"><div class="crumb">${rutaNavegacion(vetNombre,duenoNombre,mascotaNombre)}</div><span class="badge">DATOS DE EJEMPLO</span></header><main class="content"><div class="heading"><div><span class="eyebrow">${esFicha()?'FICHA DE LA MASCOTA':'NIVEL '+(nav.consulta?'3 · CONSULTA':nav.tipo?'2 · CONSULTAS POR TIPO':nav.mascota?'2 · HISTORIAL DE LA MASCOTA':nav.dueno?'2 · HISTORIAL DEL DUEÑO':nav.veterinario?'2 · VETERINARIO':nav.vista==='mascotas'?'1 · RESUMEN POR MASCOTA':nav.vista==='duenos'?'1 · RESUMEN POR DUEÑO':'1 · PANORAMA')}</span><h1>${nav.vista==='general'&&!nav.veterinario&&!nav.dueno&&!nav.mascota&&!nav.tipo?'Una mirada a la veterinaria.':nav.mascota&&!nav.consulta&&!esFicha()?enlaceMascota(nav.mascota,titulo):h(titulo)}</h1><p class="muted">${nav.consulta?'Las cuatro entidades, reunidas en un detalle.':'Consultas, pacientes y actividad para tomar decisiones.'}</p></div><div class="heading-actions"><button class="primary" data-action="nueva" ${!datos?'disabled':''}>+ Nueva consulta</button><button class="outline" data-action="exportar" ${!datos?'disabled':''}>↓ Exportar CSV</button></div></div><div class="filters" ${nav.vista==='gestion'?'hidden':''}><div class="controls"><label for="mes">Período</label><select id="mes"><option value="">${periodos.length?'Período completo · '+h(mesNombre(periodos[0]))+' — '+h(mesNombre(periodos.at(-1))):'Período completo'}</option>${periodos.map(m=>`<option value="${m}" ${nav.mes===m?'selected':''}>${h(mesNombre(m))}</option>`).join('')}</select><label for="estado">Estado</label><select id="estado"><option value="">Todos</option>${Object.entries(estadoNombre).map(([id,nombre])=>`<option value="${id}" ${nav.estado===id?'selected':''}>${nombre}</option>`).join('')}</select>${nav.mes||nav.estado||nav.buscar?'<button data-action="limpiar">Limpiar filtros</button>':''}</div><span class="cut">Período completo o mes seleccionado · Moneda: peso argentino</span></div>${esFicha()?'<button class="back" data-action="volver-origen">← Volver a la pantalla anterior</button>':nav.ficha&&!nav.consulta?'<button class="back" data-action="ficha-resumen">← Volver a la ficha de la mascota</button>':nav.tipo?`<button class="back" data-action="${nav.consulta?'volver-tipo':'panorama'}">← ${nav.consulta?'Volver a las consultas de '+h(nav.tipo):'Volver al panorama'}</button>`:nav.mascota?`<button class="back" data-action="${nav.consulta?'volver-mascota':'volver-mascotas'}">← ${nav.consulta?'Volver a las consultas de '+h(mascotaNombre||'esta mascota'):'Volver a Mascotas'}</button>`:nav.dueno?`<button class="back" data-action="${nav.consulta?'volver-dueno':'volver-duenos'}">← ${nav.consulta?'Volver a las consultas de '+h(duenoNombre||'este dueño'):'Volver a Dueños'}</button>`:nav.veterinario?`<button class="back" data-action="${nav.consulta?'volver-vet':'panorama'}">← ${nav.consulta?'Volver al veterinario':'Volver al panorama'}</button>`:''}<p class="notice" ${nav.estado?'':'hidden'}>El semáforo usa únicamente los registros que coinciden con los filtros. Filtrar por estado puede cambiar su interpretación.</p>${contenido()}<div class="legend" ${nav.vista==='gestion'?'hidden':''}><strong>Turnos atendidos</strong><span class="traffic verde"><i></i>Favorable ≥ 80%</span><span class="traffic amarillo"><i></i>Atención 60% a &lt; 80%</span><span class="traffic rojo"><i></i>Bajo &lt; 60%</span><span>Atendidas / (atendidas + ausentes) · Programadas y canceladas se excluyen</span></div><footer class="footer"><span>Veterinaria Huellas · Datos ficticios · SQL local</span><span>Base de Datos Aplicada I / II</span></footer></main></div></div>`;
  if (foco==='buscar'||(!pendiente&&focoBusqueda!==undefined)) {const input=document.getElementById('buscar');const posicion=focoBusqueda??seleccion;input?.focus();input?.setSelectionRange(posicion,posicion);if(!pendiente)focoBusqueda=undefined;}
}
function exportar() {
  if (!datos) return;
  let filas,claves;
  if(esFicha()){filas=[datos.metadata.paciente];claves=['id','nombre','especie','activo','dueno','telefono','dueno_activo','consultas_total'];}
  else if(nav.vista==='gestion'){filas=gestion?.[gestionTipo]||[];claves=gestionTipo==='duenos'?['id','nombre','telefono','activo','mascotas','consultas']:gestionTipo==='mascotas'?['id','nombre','especie','dueno','activo','dueno_activo','consultas']:['id','nombre','matricula','activo','consultas'];}
  else
  if (nav.consulta) {filas=datos.detalle?[datos.detalle]:[];claves=['id','mascota','especie','dueno','veterinario','fecha','tipo','estado','importe_pesos'];}
  else if (nav.vista==='mascotas'&&!nav.mascota) {filas=datos.mascotas;claves=['id','nombre','especie','dueno','total','atendidas','cobrado'];}
  else if (nav.vista==='duenos'&&!nav.dueno) {filas=datos.duenos;claves=['id','nombre','mascotas','total','atendidas','cobrado'];}
  else if (nav.vista==='veterinarios'&&!nav.veterinario) {filas=datos.veterinarios;claves=['id','nombre','total','atendidas','ausentes','porcentaje','cobrado'];}
  else {filas=datos.consultas;claves=['id','mascota','dueno','veterinario','fecha','tipo','estado','importe_pesos'];}
  const formatoMonto=v=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
  const seguro=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const csv='\uFEFF'+[claves.map(k=>k==='cobrado'?'importe_pesos':k).join(';'),...filas.map(f=>claves.map(k=>seguro(['importe_pesos','cobrado'].includes(k)?formatoMonto(f[k]):f[k])).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='huellas-'+(nav.consulta?'detalle':nav.vista)+'.csv';a.click();URL.revokeObjectURL(url);
}
root.addEventListener('click',async e=>{
  const boton=e.target.closest('button[data-action]');if (!boton||boton.disabled) return;
  const accion=boton.dataset.action;
  if(accion==='gestion-tab'){gestionTipo=boton.dataset.tipo;renderizar();return;}
  if(accion==='entidad-nueva'){abrirEntidad(boton.dataset.tipo,null,boton.dataset.dueno);return;}
  if(accion==='entidad-editar'){abrirEntidad(boton.dataset.tipo,Number(boton.dataset.id));return;}
  if(accion==='agregar-mascota'){document.getElementById('mascotas-nuevas').insertAdjacentHTML('beforeend',filaMascota());return;}
  if(accion==='quitar-mascota'){boton.closest('.mascota-nueva').remove();return;}
  if(accion==='entidad-baja'){await abrirBajaEntidad(boton.dataset.tipo,boton.dataset.id);return;}
  if(accion==='entidad-reactivar'){boton.disabled=true;try{await peticion('accion=reactivar-entidad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:boton.dataset.tipo,id:boton.dataset.id})});await cargar();}catch(e){error=e.message;renderizar();}return;}
  if(accion==='cerrar-entidad'){document.getElementById('entidad-dialog').close();return;}
  if (accion==='editar') {abrirAlta(datos.detalle);return;}
  if (accion==='eliminar') {abrirEliminar();return;}
  if (accion==='cerrar-eliminar') {document.getElementById('eliminar-dialog').close();return;}
  if (accion==='nueva') {abrirAlta();return;}
  if (accion==='cerrar-alta') {document.getElementById('alta-dialog').close();return;}
  if (accion==='password') {const p=document.getElementById('password');p.type=p.type==='password'?'text':'password';boton.textContent=p.type==='password'?'Mostrar':'Ocultar';return;}
  if (accion==='credenciales') {document.getElementById('email').value='docente@vet.local';document.getElementById('password').value='Veterinaria2026!';return;}
  if(accion==='ficha'){
    if(nav.ficha===boton.dataset.id)ir({consulta:'',historial:''});
    else ir({origen:JSON.stringify(nav),ficha:boton.dataset.id,mascota:boton.dataset.id,historial:'',consulta:'',tipo:'',dueno:'',veterinario:'',vista:'mascotas'});
    return;
  }
  if(accion==='ficha-consultas'){ir({historial:'1',consulta:''});return;}
  if(accion==='ficha-resumen'){ir({historial:'',consulta:''});return;}
  if(accion==='volver-origen'){
    let anterior;try{anterior=JSON.parse(nav.origen);}catch{}
    const restaurar={...inicial};if(anterior&&typeof anterior==='object')for(const key of Object.keys(inicial))if(typeof anterior[key]==='string'&&key!=='origen')restaurar[key]=anterior[key];
    ir(restaurar);return;
  }
  if(accion==='tipo')ir({ficha:'',historial:'',origen:'',tipo:boton.dataset.tipo,vista:'general',mascota:'',dueno:'',veterinario:'',consulta:''});
  if(accion==='volver-tipo')ir({vista:'general',consulta:'',mascota:'',dueno:'',veterinario:''});
  if(accion==='mascota')ir({ficha:'',historial:'',origen:'',tipo:'',vista:'mascotas',mascota:boton.dataset.id,dueno:'',veterinario:'',consulta:''});
  if(accion==='volver-mascota')ir({vista:'mascotas',consulta:'',dueno:'',veterinario:''});
  if(accion==='volver-mascotas')ir({ficha:'',historial:'',origen:'',vista:'mascotas',mascota:'',dueno:'',veterinario:'',consulta:''});
  if(accion==='dueno')ir({ficha:'',historial:'',origen:'',tipo:'',mascota:'',vista:'duenos',dueno:boton.dataset.id,veterinario:'',consulta:''});
  if(accion==='volver-dueno')ir({vista:'duenos',consulta:'',veterinario:''});
  if(accion==='volver-duenos')ir({ficha:'',historial:'',origen:'',vista:'duenos',dueno:'',veterinario:'',consulta:''});
  if (accion==='vista') ir({ficha:'',historial:'',origen:'',tipo:'',mascota:'',vista:boton.dataset.vista,dueno:'',veterinario:'',consulta:''});
  if (accion==='veterinario') ir({ficha:'',historial:'',origen:'',tipo:'',mascota:'',dueno:'',vista:'general',veterinario:boton.dataset.id,consulta:''});
  if (accion==='consulta') ir(nav.tipo?{vista:'general',consulta:boton.dataset.id,mascota:'',dueno:'',veterinario:''}:nav.mascota?{vista:'mascotas',consulta:boton.dataset.id,dueno:'',veterinario:''}:nav.dueno?{vista:'duenos',consulta:boton.dataset.id,veterinario:''}:{vista:'general',mascota:'',dueno:'',consulta:boton.dataset.id,veterinario:boton.dataset.vet});
  if (accion==='panorama') ir({ficha:'',historial:'',origen:'',tipo:'',mascota:'',dueno:'',vista:'general',veterinario:'',consulta:''});
  if (accion==='volver-vet') ir({vista:'general',consulta:''});
  if (accion==='limpiar') ir({mes:'',estado:'',buscar:'',consulta:''});
  if (accion==='reintentar') cargar();
  if (accion==='exportar') exportar();
  if (accion==='logout') {try {await peticion('accion=logout',{method:'POST'});usuario=null;datos=null;nav={...inicial};history.pushState(null,'','/');renderizar();}catch(e){error=e.message;renderizar();}}
});
root.addEventListener('change',e=>{if(e.target.name==='modo-baja'){const borrar=e.target.value==='eliminar';const seccion=document.getElementById('confirmar-historial');seccion.hidden=!borrar;const checkbox=seccion.querySelector('input');checkbox.required=borrar;checkbox.checked=false;document.getElementById('baja-submit').textContent=borrar?'Eliminar definitivamente':'Dar de baja y conservar historial';}if(e.target.id==='alta-estado'){const importe=document.getElementById('alta-importe');importe.disabled=e.target.value!=='atendida';if(importe.disabled)importe.value='0,00';}if (['mes','estado'].includes(e.target.id)) ir({[e.target.id]:e.target.value,consulta:''});});
root.addEventListener('input',e=>{if (e.target.id==='buscar') {const valor=e.target.value;clearTimeout(buscador);buscador=setTimeout(()=>ir({buscar:valor,consulta:''}),450);}});
root.addEventListener('submit',async e=>{
  if(e.target.id==='entidad-form'){e.preventDefault();await guardarRegistro(e.target);return;}
  if(e.target.id==='baja-entidad-form'){e.preventDefault();await confirmarBaja(e.target);return;}
  if(e.target.id==='eliminar-consulta'){e.preventDefault();await guardarEliminacion(e.target);return;}
  if(e.target.id==='alta-consulta'){e.preventDefault();await guardarAlta(e.target);return;}
  if (e.target.id!=='login') return;e.preventDefault();
  const formulario=e.target,boton=formulario.querySelector('[type=submit]'),mensaje=document.getElementById('login-error');
  boton.disabled=true;mensaje.hidden=true;
  try {const valores=Object.fromEntries(new FormData(formulario));const r=await peticion('accion=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(valores)});usuario=r.usuario;await cargar();}
  catch(e) {mensaje.textContent=e.message;mensaje.hidden=false;boton.disabled=false;}
});
window.addEventListener('popstate',()=>{nav=leerURL();if (usuario)cargar();});
(async()=>{try {usuario=(await peticion('accion=sesion')).usuario;if (usuario)await cargar();else login();}catch(e){login();const mensaje=document.getElementById('login-error');mensaje.textContent=e.message;mensaje.hidden=false;}})();

function abrirAlta(consulta=null){
  document.getElementById('alta-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='alta-dialog';
  const actual=new Date();actual.setMinutes(actual.getMinutes()-actual.getTimezoneOffset());
  dialog.innerHTML=`<form id="alta-consulta" data-id="${consulta?.id||''}"><div class="panel-head"><div><h2>${consulta?'Editar consulta':'Nueva consulta'}</h2><p>Se guarda en la base y actualiza los indicadores.</p></div><button type="button" data-action="cerrar-alta" aria-label="Cerrar">✕</button></div><div class="alta-fields"><label>Mascota<select name="mascota_id" required>${datos.metadata.pacientes.filter(m=>(m.activo&&m.dueno_activo)||m.id===consulta?.mascota_id).map(m=>`<option value="${m.id}" ${String(m.id)===nav.mascota?'selected':''}>${h(m.nombre)} · ${h(m.dueno)}</option>`).join('')}</select></label><label>Veterinario<select name="veterinario_id" required>${datos.metadata.catalogo.filter(v=>v.activo||v.id===consulta?.veterinario_id).map(v=>`<option value="${v.id}" ${String(v.id)===nav.veterinario?'selected':''}>${h(v.nombre)}</option>`).join('')}</select></label><label>Fecha y hora<input name="fecha" type="datetime-local" value="${actual.toISOString().slice(0,16)}" required></label><label>Tipo<select name="tipo">${['Control','Vacunación','Urgencia','Consulta general'].map(t=>`<option>${t}</option>`).join('')}</select></label><label>Estado<select name="estado" id="alta-estado">${Object.entries(estadoNombre).map(([id,n])=>`<option value="${id}" ${id==='programada'?'selected':''}>${id==='programada'?'Pendiente':n}</option>`).join('')}</select></label><label>Importe ($)<input name="importe_pesos" id="alta-importe" inputmode="decimal" value="0,00" placeholder="15.000,50" disabled></label><label class="full">Motivo<input name="motivo" maxlength="200" required placeholder="Motivo de la consulta"></label><p class="muted full">Sólo las consultas atendidas pueden registrar cobros. Los importes se ingresan en pesos.</p><p id="alta-error" class="error full" role="alert" hidden></p><button class="primary full" type="submit">Guardar consulta</button></div></form>`;
  if(consulta){
    const form=dialog.querySelector('form');
    for(const clave of ['mascota_id','veterinario_id','tipo','estado','motivo'])form.elements.namedItem(clave).value=consulta[clave];
    form.elements.namedItem('fecha').value=consulta.fecha.slice(0,16);
    const importe=form.elements.namedItem('importe_pesos');
    importe.value=new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(consulta.importe_pesos);
    importe.disabled=consulta.estado!=='atendida';
    form.querySelector('[type=submit]').textContent='Guardar cambios';
  }
  root.append(dialog);dialog.showModal();
}
async function guardarAlta(form){
  const boton=form.querySelector('[type=submit]'),mensaje=document.getElementById('alta-error');boton.disabled=true;mensaje.hidden=true;
  try{
    const body=Object.fromEntries(new FormData(form));body.importe_pesos=document.getElementById('alta-importe').value;
    if(form.dataset.id)body.id=Number(form.dataset.id);
    await peticion('accion='+(form.dataset.id?'modificar-consulta':'nueva-consulta'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    document.getElementById('alta-dialog').close();
    // Vuelve al panorama completo para que el alta nunca quede oculta por filtros previos.
    ir(nav.dueno||nav.mascota||nav.tipo?{consulta:'',veterinario:''}:{...inicial});
  }catch(e){mensaje.textContent=e.message;mensaje.hidden=false;boton.disabled=false;}
}

function abrirEliminar(){
  const c=datos?.detalle;if(!c)return;
  document.getElementById('eliminar-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='eliminar-dialog';
  dialog.innerHTML=`<form id="eliminar-consulta" data-id="${c.id}"><h2>¿Eliminar consulta ${c.id}?</h2><p>${h(c.mascota)} · ${fecha(c.fecha)} · ${hora(c.fecha)} h</p><p>Se borrará de la base y se recalcularán los totales y gráficos. Esta acción no se puede deshacer.</p><p id="eliminar-error" class="error" role="alert" hidden></p><div class="consulta-actions"><button type="button" class="outline" data-action="cerrar-eliminar">Cancelar</button><button class="primary danger" type="submit">Eliminar consulta</button></div></form>`;
  root.append(dialog);dialog.showModal();
}
async function guardarEliminacion(form){
  const boton=form.querySelector('[type=submit]'),mensaje=document.getElementById('eliminar-error');boton.disabled=true;mensaje.hidden=true;
  try{
    await peticion('accion=eliminar-consulta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(form.dataset.id)})});
    document.getElementById('eliminar-dialog').close();ir(nav.dueno||nav.mascota||nav.tipo?{consulta:'',veterinario:''}:{...inicial});
  }catch(e){mensaje.textContent=e.message;mensaje.hidden=false;boton.disabled=false;}
}

const nombresGestion={duenos:'Clientes',mascotas:'Mascotas',veterinarios:'Veterinarios'};
function vistaGestion(){
 if(!gestion)return vacio('Cargando registros…');
 const lista=gestion[gestionTipo];
 return `<section class="panel"><div class="panel-head"><div><h2>Gestionar clientes, mascotas y veterinarios</h2><p>Todos los registros, incluso los que todavía no tienen consultas. Los filtros del panorama no se aplican aquí.</p></div></div><div class="gestion-tabs">${Object.entries(nombresGestion).map(([tipo,n])=>`<button class="${tipo===gestionTipo?'primary':'outline'}" data-action="gestion-tab" data-tipo="${tipo}">${n}</button>`).join('')}<button class="outline" data-action="entidad-nueva" data-tipo="${gestionTipo}">+ ${gestionTipo==='duenos'?'Nuevo cliente':gestionTipo==='mascotas'?'Nueva mascota':'Nuevo veterinario'}</button></div>${lista.length?`<div class="scroll"><table><thead><tr><th>Nombre</th><th>${gestionTipo==='duenos'?'Teléfono':gestionTipo==='mascotas'?'Especie y cliente':'Matrícula'}</th><th>Estado</th><th>Historial</th><th>Acciones</th></tr></thead><tbody>${lista.map(r=>`<tr><td><strong>${gestionTipo==='mascotas'?enlaceMascota(r.id,r.nombre):h(r.nombre)}</strong><small>ID ${r.id}</small></td><td>${h(gestionTipo==='duenos'?r.telefono:gestionTipo==='mascotas'?r.especie+' · '+r.dueno:r.matricula)}</td><td>${r.activo?'<span class="status atendida">Activo</span>':'<span class="status cancelada">De baja</span>'}${gestionTipo==='mascotas'&&!r.dueno_activo?'<small>Cliente de baja</small>':''}</td><td>${r.consultas} consultas${gestionTipo==='duenos'?`<small>${r.mascotas} mascotas</small>`:''}</td><td><div class="registro-actions"><button class="text-link" data-action="entidad-editar" data-tipo="${gestionTipo}" data-id="${r.id}">Editar</button>${gestionTipo==='duenos'&&r.activo?`<button class="text-link" data-action="entidad-nueva" data-tipo="mascotas" data-dueno="${r.id}">+ Mascota</button>`:''}${!r.activo?`<button class="text-link" data-action="entidad-reactivar" data-tipo="${gestionTipo}" data-id="${r.id}">Reactivar</button>`:''}<button class="text-link danger" data-action="entidad-baja" data-tipo="${gestionTipo}" data-id="${r.id}">${r.activo?'Dar de baja':'Eliminar'}</button></div></td></tr>`).join('')}</tbody></table></div>`:vacio('Todavía no hay registros.')}</section>`;
}
function filaMascota(){return `<div class="mascota-nueva"><label>Nombre de mascota<input class="pet-nombre" maxlength="100" required></label><label>Especie<select class="pet-especie"><option>Perro</option><option>Gato</option></select></label><button type="button" class="outline" data-action="quitar-mascota" aria-label="Quitar mascota de este formulario">Quitar</button></div>`;}
function abrirEntidad(tipo,id=null,dueno=null){
 const registro=id?gestion[tipo].find(r=>r.id===id):null;
 document.getElementById('entidad-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='entidad-dialog';
 dialog.innerHTML=`<form id="entidad-form" data-tipo="${tipo}" data-id="${id||''}"><div class="panel-head"><h2>${id?'Editar':'Agregar'} ${tipo==='duenos'?'cliente':tipo==='mascotas'?'mascota':'veterinario'}</h2><button type="button" data-action="cerrar-entidad" aria-label="Cerrar">✕</button></div><div class="alta-fields"><label class="full">Nombre<input name="nombre" value="${h(registro?.nombre||'')}" maxlength="100" required></label>${tipo==='mascotas'?`<label>Especie<select name="especie">${['Perro','Gato'].map(e=>`<option ${registro?.especie===e?'selected':''}>${e}</option>`).join('')}</select></label><label>Cliente<select name="dueno_id" required>${gestion.duenos.filter(d=>d.activo||d.id===registro?.dueno_id).map(d=>`<option value="${d.id}" ${d.id===Number(dueno||registro?.dueno_id)?'selected':''}>${h(d.nombre)}${d.activo?'':' · de baja'}</option>`).join('')}</select></label>`:`<label class="full">${tipo==='duenos'?'Teléfono':'Matrícula'}<input name="${tipo==='duenos'?'telefono':'matricula'}" value="${h(registro?.[tipo==='duenos'?'telefono':'matricula']||'')}" maxlength="50" required></label>`}${tipo==='duenos'&&!id?'<div class="full"><h3>Mascotas del cliente</h3><p class="muted">Podés agregar una o varias ahora, o hacerlo después.</p><div id="mascotas-nuevas"></div><button type="button" class="outline" data-action="agregar-mascota">+ Agregar mascota</button></div>':''}<p class="error full" id="entidad-error" role="alert" hidden></p><button class="primary full" type="submit">Guardar ${id?'cambios':'registro'}</button></div></form>`;
 root.append(dialog);dialog.showModal();
}
async function guardarRegistro(form){
 const boton=form.querySelector('[type=submit]'),mensaje=document.getElementById('entidad-error');boton.disabled=true;mensaje.hidden=true;
 try{const body={...Object.fromEntries(new FormData(form)),tipo:form.dataset.tipo,id:form.dataset.id||undefined};
 if(body.tipo==='duenos'&&!body.id)body.mascotas=[...form.querySelectorAll('.mascota-nueva')].map(f=>({nombre:f.querySelector('.pet-nombre').value,especie:f.querySelector('.pet-especie').value}));
 await peticion('accion=guardar-entidad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});document.getElementById('entidad-dialog').close();await cargar();
 }catch(e){mensaje.textContent=e.message;mensaje.hidden=false;boton.disabled=false;}
}
async function abrirBajaEntidad(tipo,id){
 try{const impacto=await peticion('accion=impacto-entidad&tipo='+tipo+'&id='+id);
 document.getElementById('entidad-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='entidad-dialog';dialog.impacto=impacto;
 dialog.innerHTML=`<form id="baja-entidad-form"><h2>Baja de ${h(impacto.nombre)}</h2><p>Historial relacionado: <strong>${impacto.mascotas} mascotas · ${impacto.consultas} consultas · ${dinero(impacto.cobrado)} cobrados</strong>.</p><div class="baja-opciones"><label><input type="radio" name="modo-baja" value="conservar" checked> Dar de baja y conservar el historial</label><p class="muted">No podrá recibir consultas nuevas. Las consultas anteriores y los indicadores se mantienen. Podés reactivarlo después.${tipo==='duenos'?' Sus mascotas tampoco podrán recibir turnos mientras el cliente esté de baja.':''}</p><label><input type="radio" name="modo-baja" value="eliminar"> Eliminar definitivamente con su historial</label><div id="confirmar-historial" hidden><p class="error">Se eliminarán ${impacto.consultas} consultas${tipo==='duenos'?` y ${impacto.mascotas} mascotas`:''}. Los totales históricos bajarán en ${dinero(impacto.cobrado)}. ${tipo==='veterinarios'?'Las mascotas y los clientes se conservan, pero pierden esas consultas.':''} Esta acción no se puede deshacer.</p><label><input type="checkbox" name="confirmacion"> Entiendo y confirmo la eliminación del registro y su historial.</label></div></div><p class="error" id="entidad-error" role="alert" hidden></p><div class="consulta-actions"><button type="button" class="outline" data-action="cerrar-entidad">Cancelar</button><button type="submit" class="primary" id="baja-submit">Dar de baja y conservar historial</button></div></form>`;
 root.append(dialog);dialog.showModal();
 }catch(e){error=e.message;renderizar();}
}
async function confirmarBaja(form){
 const boton=form.querySelector('[type=submit]'),mensaje=document.getElementById('entidad-error');boton.disabled=true;mensaje.hidden=true;
 try{const impacto=document.getElementById('entidad-dialog').impacto,modo=form.elements.namedItem('modo-baja').value;
 const body={...impacto,modo,confirmacion:form.elements.namedItem('confirmacion').checked?'ELIMINAR':''};
 await peticion('accion=baja-entidad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});document.getElementById('entidad-dialog').close();await cargar();
 }catch(e){mensaje.textContent=e.message;mensaje.hidden=false;boton.disabled=false;}
}

function rutaNavegacion(vetNombre,duenoNombre,mascotaNombre){
 if(nav.ficha)return `<button data-action="volver-mascotas">Mascotas</button><span>›</span><button data-action="ficha-resumen">${h(mascotaNombre||'Ficha de la mascota')}</button>${nav.historial?'<span>›</span><button data-action="volver-mascota">Consultas</button>':''}${nav.consulta?`<span>›</span><span>Consulta ${h(nav.consulta)}</span>`:''}`;
 if(nav.tipo)return `<button data-action="panorama">Panorama</button><span>›</span><button data-action="volver-tipo">${h(nav.tipo)}</button>${nav.consulta?`<span>›</span><span>Consulta ${h(nav.consulta)}</span>`:''}`;
 if(nav.mascota)return `<button data-action="volver-mascotas">Mascotas</button><span>›</span>${enlaceMascota(nav.mascota,mascotaNombre||'Mascota')}${nav.consulta?`<span>›</span><span>Consulta ${h(nav.consulta)}</span>`:''}`;
 if(nav.dueno)return `<button data-action="volver-duenos">Dueños</button><span>›</span><button data-action="volver-dueno">${h(duenoNombre||'Historial del dueño')}</button>${nav.consulta?`<span>›</span><span>Consulta ${h(nav.consulta)}</span>`:''}`;
 return `<button data-action="panorama">Panorama</button>${nav.veterinario?`<span>›</span><button data-action="volver-vet">${h(vetNombre||'Veterinario')}</button>`:''}${nav.consulta?'<span>›</span><span>Consulta</span>':!nav.veterinario&&nav.vista!=='general'?`<span>›</span><span>${h(vistas.find(v=>v[0]===nav.vista)?.[1]||'Panorama')}</span>`:''}`;
}
