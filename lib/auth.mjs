import {registros,guardarEntidad,impactoEntidad,bajaEntidad,reactivarEntidad} from './entidades.mjs';
import {nuevaConsulta,modificarConsulta,eliminarConsulta} from './altas.mjs';
import {getPanel} from './panel.mjs';
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export async function hashPassword(password,salt){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
const digest=async v=>hex(await crypto.subtle.digest('SHA-256',enc.encode(v))),randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const sessionCookie=req=>/(?:^|;\s*)vet_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1]||null;
export async function handlePanel(req,db){
 if(!db)return json({error:'La base SQL no está disponible.'},503);
 try{const url=new URL(req.url),action=url.searchParams.get('accion')||'datos';
 if(req.method==='POST'){const origin=req.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origen no permitido.'},403)}
 if(action==='login'&&req.method==='POST'){
 const body=await req.json(),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');if(email.length>200||password.length>200)return json({error:'Credenciales inválidas.'},400);
 const user=await db.prepare('SELECT * FROM usuarios WHERE email=? AND activo=1').bind(email).first(),computed=await hashPassword(password,user?.salt||'usuario-no-encontrado');let equal=false;
 if(user){let delta=0;for(let i=0;i<computed.length;i++)delta|=computed.charCodeAt(i)^user.password_hash.charCodeAt(i);equal=delta===0&&computed.length===user.password_hash.length}
 if(!equal)return json({error:'El usuario o la contraseña no son correctos.'},401);
 const token=randomToken(),old=sessionCookie(req),statements=[db.prepare('DELETE FROM sesiones WHERE vence < ?').bind(Date.now())];if(old)statements.push(db.prepare('DELETE FROM sesiones WHERE token_hash=?').bind(await digest(old)));
 statements.push(db.prepare('INSERT INTO sesiones(token_hash,usuario_id,vence) VALUES(?,?,?)').bind(await digest(token),user.id,Date.now()+28800000));await db.batch(statements);
 return json({usuario:{nombre:user.nombre,email:user.email}},200,{'Set-Cookie':`vet_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${url.protocol==='https:'?'; Secure':''}`})}
 const token=sessionCookie(req),user=token?await db.prepare('SELECT u.nombre,u.email FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.vence>? AND u.activo=1').bind(await digest(token),Date.now()).first():null;
 if(action==='sesion'&&req.method==='GET')return json({usuario:user});if(!user)return json({error:'Iniciá sesión para acceder al tablero.'},401);
 if(action==='logout'&&req.method==='POST'){await db.prepare('DELETE FROM sesiones WHERE token_hash=?').bind(await digest(token)).run();return json({ok:true},200,{'Set-Cookie':`vet_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol==='https:'?'; Secure':''}`})}
 if(action==='gestion'&&req.method==='GET')return json(registros(db));
 if(action==='impacto-entidad'&&req.method==='GET')return json(impactoEntidad(db,url.searchParams.get('tipo'),url.searchParams.get('id')));
 if(action==='guardar-entidad'&&req.method==='POST')return json(guardarEntidad(db,await req.json()));
 if(action==='baja-entidad'&&req.method==='POST')return json(bajaEntidad(db,await req.json()));
 if(action==='reactivar-entidad'&&req.method==='POST')return json(reactivarEntidad(db,await req.json()));
 if(action==='nueva-consulta'&&req.method==='POST')return json(await nuevaConsulta(db,await req.json()),201);
 if(action==='modificar-consulta'&&req.method==='POST')return json(await modificarConsulta(db,await req.json()));
 if(action==='eliminar-consulta'&&req.method==='POST')return json(await eliminarConsulta(db,await req.json()));
 if(req.method!=='GET')return json({error:'Método no permitido.'},405);return json(await getPanel(db,url.searchParams));
 }catch(error){const validation=/inválid/.test(error.message);if(!validation)console.error('Panel request failed',error.message);return json({error:validation?error.message:'No se pudo obtener la información. Intentá nuevamente.'},validation?400:500)}
}
