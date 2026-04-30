CREATE DATABASE IF NOT EXISTS bvo_barbearia
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE bvo_barbearia;

-- =========================
-- ADMINISTRADORES
-- =========================
CREATE TABLE admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- BARBEIROS
-- =========================
CREATE TABLE barbers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100),
    description TEXT,
    rating DECIMAL(2,1) DEFAULT 4.9,
    experience VARCHAR(20) DEFAULT '5+',
    instagram VARCHAR(100),
    tags VARCHAR(200),
    image_path VARCHAR(500),
    is_featured BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- SERVIÇOS / CORTES
-- =========================
CREATE TABLE services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category ENUM(
        'corte',
        'barba',
        'sobrancelha',
        'combo',
        'tratamento'
    ) NOT NULL,

    title VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    price DECIMAL(10,2),
    whatsapp_msg VARCHAR(250),
    image_path VARCHAR(500),
    active BOOLEAN DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- PRODUTOS
-- =========================
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    price DECIMAL(10,2),
    stock INT DEFAULT 0,
    image_path VARCHAR(500),
    featured BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- PROMOÇÕES
-- =========================
CREATE TABLE promotions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    description VARCHAR(300),
    discount_percent INT,
    start_date DATE,
    end_date DATE,
    image_path VARCHAR(500),
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- DESTAQUES HOME
-- =========================
CREATE TABLE highlights (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    badge VARCHAR(50),
    image_path VARCHAR(500),
    link VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
)ENGINE=InnoDB;


-- =========================
-- AGENDAMENTOS
-- (excelente para expansão futura)
-- =========================
CREATE TABLE appointments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(100),
    phone VARCHAR(20),

    barber_id INT UNSIGNED,
    service_id INT UNSIGNED,

    appointment_datetime DATETIME,
    status ENUM(
      'pendente',
      'confirmado',
      'concluido',
      'cancelado'
    ) DEFAULT 'pendente',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (barber_id)
        REFERENCES barbers(id),

    FOREIGN KEY (service_id)
        REFERENCES services(id)
)ENGINE=InnoDB;


-- =========================
-- NEWSLETTER LEADS
-- =========================
CREATE TABLE newsletter_leads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    perfil_completo BOOLEAN DEFAULT 0,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo'
)ENGINE=InnoDB;


-- =========================
-- PERFIL CLIENTE
-- =========================
CREATE TABLE perfil_cliente (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lead_id INT UNSIGNED NOT NULL,
    nome VARCHAR(100),
    frequencia_corte ENUM('primeira_vez', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'ocasional'),
    faixa_etaria ENUM('18-24', '25-34', '35-44', '45-54', '55+'),
    interesses_servicos SET('corte', 'barba', 'ambos'),
    interesse_promocoes BOOLEAN DEFAULT 0,
    canal_contato ENUM('whatsapp', 'email', 'sms', 'instagram'),
    preferencias_habitos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (lead_id)
        REFERENCES newsletter_leads(id)
        ON DELETE CASCADE
)ENGINE=InnoDB;