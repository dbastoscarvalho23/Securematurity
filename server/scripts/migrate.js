// Aplica as migrações da base de dados e termina.
import { migrate, pool } from '../src/db.js';

await migrate();
await pool.end();
console.log('Base de dados atualizada.');
