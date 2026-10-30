// Cria (ou promove) um administrador.
// Uso: npm run create-admin -- email@empresa.pt 'Palavra-Passe-Forte' "Nome Apelido"
import { migrate, pool, query } from '../src/db.js';
import { hashPassword } from '../src/auth/tokens.js';
import { newId } from '../src/util.js';

const [email, password, ...nameParts] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Uso: npm run create-admin -- <email> <palavra-passe (mín. 8)> [nome]');
  process.exit(1);
}
const fullName = nameParts.join(' ') || null;

await migrate();
const hash = await hashPassword(password);
const { rows } = await query(
  `INSERT INTO users (id, email, password_hash, full_name, role, is_verified, data)
   VALUES ($1, lower($2), $3, $4, 'admin', true, $5)
   ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_verified = true,
     full_name = COALESCE(EXCLUDED.full_name, users.full_name), token_version = users.token_version + 1, updated_date = now()
   RETURNING id, email, role`,
  [newId(), email.trim(), hash, fullName, JSON.stringify(fullName ? { display_name: fullName } : {})],
);
console.log(`Administrador pronto: ${rows[0].email} (${rows[0].id})`);
await pool.end();
