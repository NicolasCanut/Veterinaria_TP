import {createServer} from 'node:http';
import {readFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve,extname,sep} from 'node:path';
import {database} from './lib/sqlite.mjs';
import {handlePanel} from './lib/auth.mjs';
import {inicializar} from './lib/inicializar.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));mkdirSync(join(root,'data'),{recursive:true});
const db=database(process.env.VET_DB_PATH||join(root,'data/veterinaria.sqlite'));
await inicializar(db);
const staticRoot=join(root,'public'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const port=Number(process.env.PORT||3000);
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,`http://${req.headers.host}`);
 if(url.pathname==='/api/panel'){
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return}chunks.push(chunk)}
 const body=Buffer.concat(chunks),request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});
 const reply=await handlePanel(request,db);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
 const candidate=resolve(staticRoot,'.'+decodeURIComponent(url.pathname));
 if(candidate!==staticRoot&&!candidate.startsWith(staticRoot+sep)){res.writeHead(403);res.end();return}
 let path=candidate;if(!existsSync(path)||!statSync(path).isFile()){if(extname(url.pathname)){res.writeHead(404);res.end();return}path=join(staticRoot,'index.html')}
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(path));
 }catch(error){console.error(error.message);res.writeHead(500);res.end('No se pudo completar la petición.')}
});
server.listen(port,'127.0.0.1',()=>console.log(`Veterinaria Huellas — http://localhost:${port}\nPanel de actividad y atención`));
process.on('SIGINT',()=>server.close(()=>{db.conn.close();process.exit(0)}));
