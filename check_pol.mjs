import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, 'apps/backend/.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([^=]+)\s*=\s*(.*)\s*$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const sql = postgres(process.env.DATABASE_URL);
try {
  const rows = await sql`
    SELECT name_en, name_es, capital_en, capital_es, alpha3 
    FROM countries 
    WHERE alpha3 IN ('POL', 'VEN', 'ALB')
  `;
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end();
}
