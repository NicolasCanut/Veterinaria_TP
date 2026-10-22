import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../lib/sqlite.mjs';
import {inicializar} from '../lib/inicializar.mjs';
import {getPanel} from '../lib/panel.mjs';
import {nuevaConsulta} from '../lib/altas.mjs';
test('Migration converts existing amounts once, preserves IDs and constraints, and backs up original bytes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'vet-pesos-')),path=join(dir,'vet.sqlite');const db=database(path);
 try{
  let schema=readFileSync(new URL('../sql/01_esquema.sql',import.meta.url),'utf8');schema=schema.replace(/importe_pesos NUMERIC NOT NULL CHECK\([^\n]+\),/, 'importe_centavos INTEGER NOT NULL CHECK(importe_centavos >= 0),').replaceAll('importe_pesos','importe_centavos');db.conn.exec(schema);
  let seed=readFileSync(new URL('../sql/02_datos_ejemplo.sql',import.meta.url),'utf8');let [a,b]=seed.split('INSERT INTO consultas VALUES');b=b.replace(/, (\d+)(\)[,;])/g,(_,v,end)=>', '+Number(v)*100+end);db.conn.exec(a+'INSERT INTO consultas VALUES'+b);
  db.conn.prepare('UPDATE consultas SET importe_centavos=1500050 WHERE id=1').run();
  const original=db.conn.prepare('SELECT * FROM consultas ORDER BY id').all();
  await inicializar(db);assert.ok(!db.conn.prepare('PRAGMA table_info(consultas)').all().some(c=>c.name==='importe_centavos'));
  const updated=db.conn.prepare('SELECT * FROM consultas ORDER BY id').all();assert.equal(updated.length,original.length);
  for(let i=0;i<updated.length;i++){const {importe_centavos,...before}=original[i],{importe_pesos,...after}=updated[i];assert.deepEqual(after,before);assert.equal(Math.round(importe_pesos*100),importe_centavos);}
  const backups=readdirSync(dir).filter(n=>n.endsWith('.bak'));assert.equal(backups.length,1);const backup=database(join(dir,backups[0]));assert.equal(backup.conn.prepare('SELECT importe_centavos FROM consultas WHERE id=1').get().importe_centavos,1500050);backup.conn.close();
  const total=await getPanel(db,new URLSearchParams());assert.equal(total.kpi.cobrado,original.reduce((s,c)=>s+c.importe_centavos,0)/100);
  await inicializar(db);assert.equal(readdirSync(dir).filter(n=>n.endsWith('.bak')).length,1);assert.deepEqual(db.conn.prepare('SELECT * FROM consultas ORDER BY id').all(),updated);
  const amounts=['0,10','0,20','0,30'];for(let i=0;i<amounts.length;i++)await nuevaConsulta(db,{mascota_id:1,veterinario_id:1,fecha:`2026-07-01T01:0${i}`,tipo:'Control',estado:'atendida',motivo:'Decimal',importe_pesos:amounts[i]});
  assert.equal((await getPanel(db,new URLSearchParams())).kpi.cobrado,total.kpi.cobrado+0.6);
  for(const val of [-1,0.001,'abc'])assert.throws(()=>db.conn.prepare('UPDATE consultas SET importe_pesos=? WHERE id=1').run(val));
  assert.equal(db.conn.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.conn.close();rmSync(dir,{recursive:true,force:true})}
});
