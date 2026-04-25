'use strict';

/**
 * db/seed.js — Cria o usuário administrador inicial
 * Execute: npm run seed
 *
 * As credenciais são lidas das variáveis de ambiente:
 *   ADMIN_USER  (padrão: admin)
 *   ADMIN_PASS  (padrão: ValeoUro@2026)
 */

const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function seed() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT, 10) || 3306,
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'bvo_barbearia',
        charset:  'utf8mb4'
    });

    try {
        const adminUser = process.env.ADMIN_USER || 'admin';
        const adminPass = process.env.ADMIN_PASS || 'ValeoUro@2026';

        const hash = await bcrypt.hash(adminPass, 12);

        await conn.execute(
            `INSERT INTO admin_users (username, password_hash)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
            [adminUser, hash]
        );

        console.log('✅ Usuário admin criado/atualizado: ' + adminUser);
        console.log('   Senha: ' + adminPass);
        console.log('⚠️  Altere a senha no .env após o primeiro acesso!');
    } finally {
        await conn.end();
    }
}

seed().catch(err => {
    console.error('❌ Erro no seed:', err.message);
    process.exit(1);
});
