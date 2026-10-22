import {DatabaseSync} from 'node:sqlite';
export function database(path=':memory:'){
 const conn=new DatabaseSync(path);conn.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 return{conn,prepare(sql){let args=[];const stmt=conn.prepare(sql);return{bind(...v){args=v;return this},async first(){return stmt.get(...args)||null},async all(){return{results:stmt.all(...args)}},async run(){return stmt.run(...args)}}},async batch(statements){conn.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());conn.exec('COMMIT');return results}catch(e){conn.exec('ROLLBACK');throw e}}};
}
