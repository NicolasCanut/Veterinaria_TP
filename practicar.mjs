// Ejecutar: node practicar.mjs "SELECT nombre FROM mascotas LIMIT 5"
// Esta herramienta abre la base en modo de sólo lectura y permite SELECT.
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
const sql=process.argv[2];
if (!sql || !/^\s*SELECT\b/i.test(sql)) {
  console.error('Usá: node practicar.mjs "SELECT nombre FROM mascotas LIMIT 5"');
  process.exit(1);
}
try {
  const db=new DatabaseSync(fileURLToPath(new URL('./data/veterinaria.sqlite',import.meta.url)),{readOnly:true});
  console.table(db.prepare(sql).all());db.close();
} catch (error) {
  console.error('No se pudo ejecutar la consulta:',error.message);
  console.error('Primero iniciá el sistema con npm start para crear la base.');process.exit(1);
}
