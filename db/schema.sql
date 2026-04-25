-- ============================================================
--  Barbearia Vale Ouro — Schema do Banco de Dados MySQL
--  Execute: mysql -u root -p < db/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS bvo_barbearia
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bvo_barbearia;

-- Tabela de usuários administradores
CREATE TABLE IF NOT EXISTS admin_users (
    id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)   NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de itens (cortes, serviços, produtos e promoções)
CREATE TABLE IF NOT EXISTS items (
    id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    category      ENUM('cortes','servicos','produtos','promocoes','profissionais') NOT NULL,
    subcategory   VARCHAR(100)  DEFAULT NULL,
    title         VARCHAR(100)  NOT NULL,
    description   VARCHAR(300)  NOT NULL,
    whatsapp_msg  VARCHAR(250)  DEFAULT NULL,
    image_path    VARCHAR(500)  DEFAULT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category    (category),
    INDEX idx_subcategory (subcategory)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Migrações — aplique se o banco já existia antes desta versão
--  (seguro reexecutar: ignora se coluna/enum já existir)
-- ============================================================

-- Adiciona subcategory à tabela items (caso não exista)
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100) DEFAULT NULL AFTER category;

-- Adiciona 'promocoes' e 'profissionais' ao ENUM de category e o índice de subcategory
--   MySQL não tem IF NOT EXISTS para MODIFY COLUMN; execute manualmente se já estiver atualizado.
ALTER TABLE items
    MODIFY COLUMN category ENUM('cortes','servicos','produtos','promocoes','profissionais') NOT NULL;

ALTER TABLE items
    ADD INDEX IF NOT EXISTS idx_subcategory (subcategory);

-- ============================================================
--  Campos extras para profissionais (barbeiros)
-- ============================================================

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS specialty VARCHAR(100) DEFAULT NULL AFTER description,
    ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 4.9 AFTER specialty,
    ADD COLUMN IF NOT EXISTS experience VARCHAR(20) DEFAULT '5+' AFTER rating,
    ADD COLUMN IF NOT EXISTS tags VARCHAR(200) DEFAULT NULL AFTER experience,
    ADD COLUMN IF NOT EXISTS instagram VARCHAR(100) DEFAULT NULL AFTER tags,
    ADD COLUMN IF NOT EXISTS is_featured TINYINT(1) DEFAULT 0 AFTER instagram;

-- ============================================================
--  Tabela de Destaques (destaques da barbearia)
-- ============================================================

CREATE TABLE IF NOT EXISTS highlights (
    id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    description   VARCHAR(300)  NOT NULL,
    badge         VARCHAR(50)  DEFAULT NULL,
    image_path    VARCHAR(500) NOT NULL,
    link          VARCHAR(500) DEFAULT NULL,
    is_active     TINYINT(1)   DEFAULT 1,
    display_order INT UNSIGNED DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insere destaques padrão se a tabela estiver vazia
INSERT INTO highlights (title, description, badge, image_path, link, display_order) VALUES
('Cortes Masculinos', 'Opções clássicas e modernas com acabamento técnico para diferentes estilos.', 'Cortes e Serviços', 'img/servicos/corte.jpeg', 'cortes.html', 1),
('Serviços Premium', 'Barba, sobrancelha e cuidados premium para completar seu visual.', 'Serviços Premium', 'img/servicos/barba.jpeg', 'servicos.html', 2),
('Produtos Profissionais', 'Shampoo, modeladores e itens de barba com orientação personalizada.', 'Linha de Produtos', 'img/produto/CONDICIONADOR.jpg', 'produtos.html', 3)
ON DUPLICATE KEY UPDATE title = VALUES(title);

