'use strict';

const express   = require('express');
const mysql     = require('mysql2/promise');
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path      = require('path');
const fs        = require('fs');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Sanidade: JWT_SECRET obrigatório ─────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('ERRO: JWT_SECRET não definido ou muito curto (mín. 32 chars). Configure o arquivo .env');
    process.exit(1);
}

// ── Pool MySQL ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT, 10) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'bvo_barbearia',
    waitForConnections: true,
    connectionLimit:    10,
    charset:            'utf8mb4'
});

// ── Bloquear acesso HTTP a arquivos do servidor ───────────────────────────────
app.use(function (req, res, next) {
    const p = req.path.toLowerCase();
    const BLOCKED = [
        '/server.js', '/.env', '/.env.example',
        '/package.json', '/package-lock.json', '/.gitignore'
    ];
    if (BLOCKED.includes(p) || p.startsWith('/db/') || p.startsWith('/node_modules/')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// ── CORS + body parsers ───────────────────────────────────────────────────────
app.use(cors({
    origin:  process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json({ limit: '26mb' }));
app.use(express.urlencoded({ extended: false, limit: '26mb' }));

// Serve os arquivos estáticos do site (HTML, CSS, JS, imagens)
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', apiLimiter);

// ── Multer (memória — evita problema de ordem dos campos multipart) ────────────
const UPLOAD_BASE   = path.join(__dirname, 'img', 'admin-uploads');
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (ALLOWED_MIMES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'));
        }
    }
});

/**
 * Salva o buffer no disco na pasta correta e retorna o path relativo.
 */
function saveUploadedFile(buffer, originalname, category) {
    const VALID = ['cortes', 'servicos', 'produtos'];
    const cat   = VALID.includes(category) ? category : 'servicos';
    const dir   = path.join(UPLOAD_BASE, cat);
    fs.mkdirSync(dir, { recursive: true });

    const rawExt  = path.extname(originalname).toLowerCase();
    const ext     = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(rawExt) ? rawExt : '.jpg';
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, buffer);
    return 'img/admin-uploads/' + cat + '/' + filename;
}

/**
 * Remove um arquivo do disco pelo path relativo (ignora erro se não existir).
 */
function deleteFile(relPath) {
    if (!relPath) return;
    try { fs.unlinkSync(path.join(__dirname, relPath)); } catch (_) {}
}

// ── JWT helpers ───────────────────────────────────────────────────────────────
function signToken(userId, username) {
    return jwt.sign(
        { sub: userId, user: username },
        process.env.JWT_SECRET,
        { expiresIn: '8h', algorithm: 'HS256' }
    );
}

function verifyToken(req, res, next) {
    const auth  = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });
    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
}

const VALID_CATS = ['cortes', 'servicos', 'produtos', 'promocoes', 'profissionais'];

// ═════════════════════════════════════════════════════════════════════════════
//  ROTAS DA API
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /api/auth/login ─────────────────────────────────────────────────────
app.post(
    '/api/auth/login',
    loginLimiter,
    body('username').trim().isLength({ min: 1, max: 50 }).escape(),
    body('password').isLength({ min: 1, max: 128 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Dados inválidos.' });
        }

        const { username, password } = req.body;
        try {
            const [rows] = await pool.execute(
                'SELECT id, username, password_hash FROM admin_users WHERE username = ? LIMIT 1',
                [username]
            );

            if (rows.length === 0) {
                return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
            }

            const user  = rows[0];
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) {
                return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
            }

            const token = signToken(user.id, user.username);
            res.json({ token, username: user.username });
        } catch (err) {
            console.error('[login]', err.message);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
);

// ── GET /api/items?category=cortes ───────────────────────────────────────────
app.get('/api/items', async (req, res) => {
    const { category } = req.query;
    if (category && !VALID_CATS.includes(category)) {
        return res.status(400).json({ error: 'Categoria inválida.' });
    }

    try {
        // Inclui campos extras para profissionais
        let sql = 'SELECT id, category, subcategory, title, description, whatsapp_msg, image_path, created_at, updated_at';
        if (category === 'profissionais') {
            sql += ', specialty, rating, experience, tags, instagram, is_featured';
        }
        sql += ' FROM items';
        const params = [];
        if (category) { sql += ' WHERE category = ?'; params.push(category); }
        sql += ' ORDER BY subcategory ASC, created_at DESC';

        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET /api/items]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// ── GET /api/items/:id ───────────────────────────────────────────────────────
app.get('/api/items/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT id, category, subcategory, title, description, whatsapp_msg, image_path, created_at, updated_at FROM items WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Item não encontrado.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET /api/items/:id]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// ── POST /api/items  (protegido) ─────────────────────────────────────────────
app.post(
    '/api/items',
    verifyToken,
    upload.single('image'),
    body('category').isIn(VALID_CATS),
    body('subcategory').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).escape(),
    body('title').trim().isLength({ min: 1, max: 100 }).escape(),
    body('description').trim().isLength({ min: 1, max: 300 }).escape(),
    body('whatsapp_msg').optional({ checkFalsy: true }).trim().isLength({ max: 250 }).escape(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Dados inválidos.', details: errors.array() });
        }

        const { category, subcategory, title, description, whatsapp_msg } = req.body;
        let image_path = null;

        // Validação extra: garantir que category é válido
        if (!category || !VALID_CATS.includes(category)) {
            return res.status(400).json({ error: 'Categoria inválida.', details: [{ msg: 'category deve ser um dos: ' + VALID_CATS.join(', ') }] });
        }

        console.log('[POST /api/items] Recebido:', { category, subcategory, title, description: description?.substring(0, 50) });

        try {
            if (req.file) {
                image_path = saveUploadedFile(req.file.buffer, req.file.originalname, category);
            }

            const [result] = await pool.execute(
                'INSERT INTO items (category, subcategory, title, description, whatsapp_msg, image_path) VALUES (?, ?, ?, ?, ?, ?)',
                [category, subcategory || null, title, description, whatsapp_msg || null, image_path]
            );

            const [rows] = await pool.execute(
                'SELECT id, category, subcategory, title, description, whatsapp_msg, image_path, created_at, updated_at FROM items WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json(rows[0]);
        } catch (err) {
            if (image_path) deleteFile(image_path);
            console.error('[POST /api/items]', err.message);
            res.status(500).json({ error: 'Erro ao salvar item.' });
        }
    }
);

// ── PUT /api/items/:id  (protegido) ──────────────────────────────────────────
app.put(
    '/api/items/:id',
    verifyToken,
    upload.single('image'),
    body('subcategory').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).escape(),
    body('title').trim().isLength({ min: 1, max: 100 }).escape(),
    body('description').trim().isLength({ min: 1, max: 300 }).escape(),
    body('whatsapp_msg').optional({ checkFalsy: true }).trim().isLength({ max: 250 }).escape(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Dados inválidos.' });
        }

        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id) || id < 1) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const { subcategory, title, description, whatsapp_msg, remove_image } = req.body;

        try {
            const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [id]);
            if (rows.length === 0) return res.status(404).json({ error: 'Item não encontrado.' });

            const existing = rows[0];
            let image_path = existing.image_path;

            // Remover imagem se solicitado
            if (remove_image === '1') {
                deleteFile(existing.image_path);
                image_path = null;
            }

            // Substituir por nova imagem
            if (req.file) {
                deleteFile(existing.image_path);
                image_path = saveUploadedFile(req.file.buffer, req.file.originalname, existing.category);
            }

            await pool.execute(
                'UPDATE items SET subcategory=?, title=?, description=?, whatsapp_msg=?, image_path=?, updated_at=NOW() WHERE id=?',
                [subcategory || null, title, description, whatsapp_msg || null, image_path, id]
            );

            const [updated] = await pool.execute(
                'SELECT id, category, subcategory, title, description, whatsapp_msg, image_path, created_at, updated_at FROM items WHERE id = ?',
                [id]
            );

            res.json(updated[0]);
        } catch (err) {
            console.error('[PUT /api/items/:id]', err.message);
            res.status(500).json({ error: 'Erro ao atualizar item.' });
        }
    }
);

// ── DELETE /api/items/:id  (protegido) ───────────────────────────────────────
app.delete('/api/items/:id', verifyToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM items WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Item não encontrado.' });

        const item = rows[0];
        await pool.execute('DELETE FROM items WHERE id = ?', [id]);
        deleteFile(item.image_path);

        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/items/:id]', err.message);
        res.status(500).json({ error: 'Erro ao excluir item.' });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
//  HIGHLIGHTS API — Destaques da Barbearia
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/highlights — Lista todos os destaques ativos
app.get('/api/highlights', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, title, description, badge, image_path, link, is_active, display_order FROM highlights WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error('[GET /api/highlights]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// POST /api/highlights (protegido) — Criar novo destaque
app.post('/api/highlights', verifyToken, async (req, res) => {
    const { title, description, badge, image_path, link, is_active, display_order } = req.body;
    
    if (!title || !description || !image_path) {
        return res.status(400).json({ error: 'Título, descrição e imagem são obrigatórios.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO highlights (title, description, badge, image_path, link, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description, badge || null, image_path, link || null, is_active ?? 1, display_order || 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[POST /api/highlights]', err.message);
        res.status(500).json({ error: 'Erro ao criar destaque.' });
    }
});

// PUT /api/highlights/:id (protegido) — Atualizar destaque
app.put('/api/highlights/:id', verifyToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    const { title, description, badge, image_path, link, is_active, display_order } = req.body;

    try {
        const [rows] = await pool.execute('SELECT * FROM highlights WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });

        await pool.execute(
            'UPDATE highlights SET title = ?, description = ?, badge = ?, image_path = ?, link = ?, is_active = ?, display_order = ? WHERE id = ?',
            [title, description, badge, image_path, link, is_active, display_order, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/highlights/:id]', err.message);
        res.status(500).json({ error: 'Erro ao atualizar destaque.' });
    }
});

// DELETE /api/highlights/:id (protegido) — Excluir destaque
app.delete('/api/highlights/:id', verifyToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido.' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM highlights WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Destaque não encontrado.' });

        const item = rows[0];
        await pool.execute('DELETE FROM highlights WHERE id = ?', [id]);
        if (item.image_path) deleteFile(item.image_path);

        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/highlights/:id]', err.message);
        res.status(500).json({ error: 'Erro ao excluir destaque.' });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
//  ANALYTICS — TRACKING (público, rate-limited)
// ═════════════════════════════════════════════════════════════════════════════

const trackLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
});

// Extrai a origem do tráfego a partir dos UTM params ou referrer
function parseTrafficSource(utmSource, utmMedium, utmCampaign, referrer) {
    if (utmSource) {
        return {
            source:   utmSource.slice(0, 100),
            medium:   (utmMedium   || '').slice(0, 100) || 'cpc',
            campaign: (utmCampaign || '').slice(0, 200) || null
        };
    }
    if (!referrer) return { source: 'direto', medium: 'none', campaign: null };

    const ref = referrer.toLowerCase();
    if (ref.includes('google'))             return { source: 'google',    medium: 'organic',  campaign: null };
    if (ref.includes('bing') ||
        ref.includes('yahoo'))              return { source: 'bing',      medium: 'organic',  campaign: null };
    if (ref.includes('instagram'))          return { source: 'instagram', medium: 'social',   campaign: null };
    if (ref.includes('facebook') ||
        ref.includes('fb.com'))             return { source: 'facebook',  medium: 'social',   campaign: null };
    if (ref.includes('tiktok'))             return { source: 'tiktok',    medium: 'social',   campaign: null };
    if (ref.includes('youtube'))            return { source: 'youtube',   medium: 'social',   campaign: null };
    if (ref.includes('whatsapp'))           return { source: 'whatsapp',  medium: 'social',   campaign: null };
    if (ref.includes('t.co') ||
        ref.includes('twitter'))            return { source: 'twitter',   medium: 'social',   campaign: null };

    // Mesmo domínio = navegação interna (ignorar)
    return { source: 'referral', medium: 'referral', campaign: null };
}

// POST /api/track/pageview
app.post('/api/track/pageview', trackLimiter,
    body('page').trim().isLength({ min: 1, max: 200 }),
    body('session_id').trim().isLength({ min: 8, max: 64 }).matches(/^[a-z0-9_-]+$/i),
    body('referrer').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('utm_source').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('utm_medium').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('utm_campaign').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: 'Dados inválidos.' });

        const { page, session_id, referrer, utm_source, utm_medium, utm_campaign } = req.body;
        const { source, medium, campaign } = parseTrafficSource(utm_source, utm_medium, utm_campaign, referrer);

        try {
            await pool.execute(
                'INSERT INTO analytics_pageviews (page, referrer, source, medium, campaign, session_id) VALUES (?,?,?,?,?,?)',
                [page, referrer || null, source, medium, campaign, session_id]
            );
            res.json({ ok: true });
        } catch (err) {
            console.error('[track/pageview]', err.message);
            res.status(500).json({ error: 'Erro interno.' });
        }
    }
);

// POST /api/track/event
app.post('/api/track/event', trackLimiter,
    body('event_type').trim().isLength({ min: 1, max: 50 }).matches(/^[a-z0-9_]+$/i),
    body('event_label').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body('page').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body('session_id').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: 'Dados inválidos.' });

        const { event_type, event_label, page, session_id } = req.body;
        try {
            await pool.execute(
                'INSERT INTO analytics_events (event_type, event_label, page, session_id) VALUES (?,?,?,?)',
                [event_type, event_label || null, page || null, session_id || null]
            );
            res.json({ ok: true });
        } catch (err) {
            console.error('[track/event]', err.message);
            res.status(500).json({ error: 'Erro interno.' });
        }
    }
);

// POST /api/track/duration — atualiza duração e bounce quando o usuário sai
app.post('/api/track/duration', trackLimiter,
    body('session_id').trim().isLength({ min: 8, max: 64 }).matches(/^[a-z0-9_-]+$/i),
    body('page').trim().isLength({ min: 1, max: 200 }),
    body('duration_s').isInt({ min: 0, max: 86400 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: 'Dados inválidos.' });

        const { session_id, page, duration_s } = req.body;
        const bounced = parseInt(duration_s, 10) < 45 ? 1 : 0;
        try {
            await pool.execute(
                `UPDATE analytics_pageviews
                 SET duration_s = ?, bounced = ?
                 WHERE session_id = ? AND page = ?
                 ORDER BY created_at DESC LIMIT 1`,
                [parseInt(duration_s, 10), bounced, session_id, page]
            );
            res.json({ ok: true });
        } catch (err) {
            console.error('[track/duration]', err.message);
            res.status(500).json({ error: 'Erro interno.' });
        }
    }
);

// ═════════════════════════════════════════════════════════════════════════════
//  ANALYTICS — DASHBOARD (protegido)
// ═════════════════════════════════════════════════════════════════════════════

function periodWhere(period) {
    switch (period) {
        case 'today':  return "DATE(created_at) = CURDATE()";
        case 'week':   return "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        case 'month':  return "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        case '3months':return "created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
        default:       return "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    }
}

// GET /api/analytics/summary?period=month
app.get('/api/analytics/summary', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);

    try {
        const [[pvRow]]   = await pool.execute(`SELECT COUNT(*) AS total_views, COUNT(DISTINCT session_id) AS unique_sessions FROM analytics_pageviews WHERE ${pw}`);
        const [[durRow]]  = await pool.execute(`SELECT AVG(duration_s) AS avg_duration FROM analytics_pageviews WHERE ${pw} AND duration_s IS NOT NULL`);
        const [[bounce]]  = await pool.execute(`SELECT COUNT(*) AS cnt FROM analytics_pageviews WHERE ${pw} AND bounced = 1 AND duration_s IS NOT NULL`);
        const [[nonBounce]]= await pool.execute(`SELECT COUNT(*) AS cnt FROM analytics_pageviews WHERE ${pw} AND duration_s IS NOT NULL`);
        const [[waRow]]   = await pool.execute(`SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_type='whatsapp_click' AND ${pw}`);

        const bounceRate = nonBounce.cnt > 0 ? Math.round((bounce.cnt / nonBounce.cnt) * 100) : null;

        res.json({
            period,
            total_views:      pvRow.total_views,
            unique_sessions:  pvRow.unique_sessions,
            avg_duration_s:   durRow.avg_duration ? Math.round(durRow.avg_duration) : null,
            bounce_rate:      bounceRate,
            whatsapp_clicks:  waRow.cnt
        });
    } catch (err) {
        console.error('[analytics/summary]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// GET /api/analytics/pageviews?period=month — visitas por dia
app.get('/api/analytics/pageviews', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);
    const groupBy = (period === 'today') ? 'HOUR(created_at)' : 'DATE(created_at)';
    const label   = (period === 'today') ? 'hora' : 'data';

    try {
        const [rows] = await pool.execute(
            `SELECT ${groupBy} AS ${label}, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
             FROM analytics_pageviews WHERE ${pw} GROUP BY 1 ORDER BY 1`
        );
        res.json(rows);
    } catch (err) {
        console.error('[analytics/pageviews]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// GET /api/analytics/top-pages?period=month
app.get('/api/analytics/top-pages', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);
    try {
        const [rows] = await pool.execute(
            `SELECT page, COUNT(*) AS views FROM analytics_pageviews WHERE ${pw}
             GROUP BY page ORDER BY views DESC LIMIT 10`
        );
        res.json(rows);
    } catch (err) {
        console.error('[analytics/top-pages]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// GET /api/analytics/traffic?period=month
app.get('/api/analytics/traffic', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);
    try {
        const [rows] = await pool.execute(
            `SELECT source, COUNT(*) AS visits FROM analytics_pageviews WHERE ${pw}
             GROUP BY source ORDER BY visits DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('[analytics/traffic]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// GET /api/analytics/events?period=month&type=service_click
app.get('/api/analytics/events', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);
    const VALID_TYPES = ['service_click','cut_click','product_click','whatsapp_click','coupon_use','all'];
    const type = VALID_TYPES.includes(req.query.type) ? req.query.type : 'all';

    try {
        let sql = `SELECT event_type, event_label, COUNT(*) AS total
                   FROM analytics_events WHERE ${pw}`;
        if (type !== 'all') sql += ` AND event_type = ${pool.escape(type)}`;
        sql += ' GROUP BY event_type, event_label ORDER BY total DESC LIMIT 50';

        const [rows] = await pool.execute(sql);
        res.json(rows);
    } catch (err) {
        console.error('[analytics/events]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// GET /api/analytics/bounce?period=month
app.get('/api/analytics/bounce', verifyToken, async (req, res) => {
    const period = ['today','week','month','3months'].includes(req.query.period)
        ? req.query.period : 'month';
    const pw = periodWhere(period);
    try {
        const [rows] = await pool.execute(
            `SELECT page,
                    COUNT(*) AS total_sessions,
                    SUM(bounced) AS bounces,
                    ROUND(AVG(duration_s)) AS avg_duration_s
             FROM analytics_pageviews
             WHERE ${pw} AND duration_s IS NOT NULL
             GROUP BY page ORDER BY bounces DESC LIMIT 10`
        );
        res.json(rows);
    } catch (err) {
        console.error('[analytics/bounce]', err.message);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// ── 404 da API ────────────────────────────────────────────────────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
});

// ── Inicializar servidor ──────────────────────────────────────────────────────
pool.getConnection()
    .then(conn => {
        conn.release();
        console.log('✅ MySQL conectado com sucesso.');
        app.listen(PORT, () => {
            console.log('🚀 Servidor rodando em http://localhost:' + PORT);
        });
    })
    .catch(err => {
        console.error('❌ Falha ao conectar ao MySQL:', err.message);
        console.error('   Verifique as credenciais no arquivo .env');
        process.exit(1);
    });
