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
