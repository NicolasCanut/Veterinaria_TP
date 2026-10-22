import {readFileSync} from 'node:fs';
import {hashPassword} from './auth.mjs';
export async function inicializar(db) {
  if (!db.conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='consultas'").get()) {
    db.conn.exec(readFileSync(new URL('../sql/01_esquema.sql',import.meta.url),'utf8'));
    db.conn.exec(readFileSync(new URL('../sql/02_datos_ejemplo.sql',import.meta.url),'utf8'));
  }
  if (db.conn.prepare('PRAGMA table_info(consultas)').all().some(c=>c.name==='importe_centavos')) {
    // Copia consistente de la base existente antes de convertir los importes.
    const path=db.conn.prepare('PRAGMA database_list').all().find(d=>d.name==='main')?.file;
    if(path)db.conn.prepare('VACUUM INTO ?').run(path+'.antes-pesos-'+Date.now()+'.bak');
    const esquema=readFileSync(new URL('../sql/01_esquema.sql',import.meta.url),'utf8');
    const tabla=esquema.slice(esquema.indexOf('CREATE TABLE consultas ('),esquema.indexOf('CREATE INDEX consultas_fecha')).replace('CREATE TABLE consultas (','CREATE TABLE consultas_pesos (');
    db.conn.exec('BEGIN IMMEDIATE');
    try {
      db.conn.exec(tabla);
      db.conn.exec(`INSERT INTO consultas_pesos SELECT id,mascota_id,veterinario_id,fecha,motivo,tipo,estado,importe_centavos/100.0 FROM consultas`);
      db.conn.exec('DROP TABLE consultas; ALTER TABLE consultas_pesos RENAME TO consultas;');
      db.conn.exec(`CREATE INDEX consultas_fecha ON consultas(fecha);
        CREATE INDEX consultas_veterinario_fecha ON consultas(veterinario_id,fecha);
        CREATE INDEX consultas_mascota ON consultas(mascota_id);`);
      db.conn.exec('COMMIT');
    }catch(e){db.conn.exec('ROLLBACK');throw e;}
  }
  const pendientes=['duenos','mascotas','veterinarios'].filter(t=>!db.conn.prepare('PRAGMA table_info('+t+')').all().some(c=>c.name==='activo'));
  if(pendientes.length){
    const path=db.conn.prepare('PRAGMA database_list').all().find(d=>d.name==='main')?.file;
    if(path)db.conn.prepare('VACUUM INTO ?').run(path+'.antes-abm-'+Date.now()+'.bak');
    db.conn.exec('BEGIN IMMEDIATE');
    try{for(const t of pendientes)db.conn.exec('ALTER TABLE '+t+' ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))');db.conn.exec('COMMIT');}catch(e){db.conn.exec('ROLLBACK');throw e;}
  }
  if (!db.conn.prepare('SELECT id FROM usuarios WHERE id=1').get()) {
    const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    const hash = await hashPassword('Veterinaria2026!',salt);
    db.conn.prepare('INSERT INTO usuarios VALUES(?,?,?,?,?,1)').run(1,'docente@vet.local','Docente',hash,salt);
  }
}
