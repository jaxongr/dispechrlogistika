-- Logistics Dispatch Database Schema (SQLite)

-- Rollar jadvali
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    permissions TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Foydalanuvchilar jadvali (hodimlar va admin)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role_id INTEGER REFERENCES roles(id),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Telegram guruhlar jadvali
CREATE TABLE IF NOT EXISTS telegram_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER UNIQUE NOT NULL,
    group_name TEXT,
    group_username TEXT,
    is_active INTEGER DEFAULT 1,
    added_by INTEGER REFERENCES users(id),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME,
    total_messages INTEGER DEFAULT 0
);

-- E'lonlar (xabarlar) jadvali
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_message_id INTEGER,
    group_id INTEGER REFERENCES telegram_groups(id),
    sender_user_id INTEGER NOT NULL,
    sender_username TEXT,
    sender_full_name TEXT,
    message_text TEXT NOT NULL,
    message_date DATETIME NOT NULL,

    -- Filtrlash statuslari
    is_dispatcher INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 0,
    is_sent_to_channel INTEGER DEFAULT 0,

    -- E'lon ma'lumotlari
    route_from TEXT,
    route_to TEXT,
    cargo_type TEXT,
    weight TEXT,
    vehicle_type TEXT,
    contact_phone TEXT,
    price TEXT,

    -- Metadata
    raw_data TEXT,
    confidence_score REAL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
);

-- Bloklangan foydalanuvchilar (dispetcherlar)
CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    full_name TEXT,
    reason TEXT,
    blocked_by INTEGER REFERENCES users(id),
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Statistika
    blocked_message_count INTEGER DEFAULT 0,
    detection_patterns TEXT DEFAULT '[]'
);

-- Obunalar jadvali
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    username TEXT,
    full_name TEXT,

    -- Obuna turi
    subscription_type TEXT NOT NULL,

    -- Obuna holati
    is_active INTEGER DEFAULT 1,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,

    -- To'lov
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'UZS',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- To'lovlar jadvali
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER REFERENCES subscriptions(id),
    telegram_user_id INTEGER NOT NULL,

    -- To'lov ma'lumotlari
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'UZS',
    payment_method TEXT,

    -- Telegram payment metadata
    telegram_payment_charge_id TEXT,
    telegram_provider_payment_charge_id TEXT,

    -- Status
    status TEXT DEFAULT 'pending',

    payment_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Telegram session ma'lumotlari
CREATE TABLE IF NOT EXISTS telegram_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT UNIQUE NOT NULL,
    session_string TEXT,
    phone_number TEXT,
    is_active INTEGER DEFAULT 1,
    last_active DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kanal/guruh ma'lumotlari
CREATE TABLE IF NOT EXISTS target_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER UNIQUE NOT NULL,
    channel_username TEXT,
    channel_name TEXT,
    channel_type TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Statistika jadvali
CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL,

    -- Xabar statistikasi
    total_messages INTEGER DEFAULT 0,
    dispatcher_messages INTEGER DEFAULT 0,
    approved_messages INTEGER DEFAULT 0,
    sent_messages INTEGER DEFAULT 0,

    -- Foydalanuvchi statistikasi
    new_subscribers INTEGER DEFAULT 0,
    active_subscribers INTEGER DEFAULT 0,

    -- To'lov statistikasi
    total_payments REAL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(stat_date)
);

-- Indexlar
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(message_date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dispatcher ON messages(is_dispatcher);
CREATE INDEX IF NOT EXISTS idx_messages_approved ON messages(is_approved);
CREATE INDEX IF NOT EXISTS idx_blocked_users_telegram_id ON blocked_users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_telegram_id ON subscriptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active, end_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Boshlang'ich rollar
INSERT OR IGNORE INTO roles (id, name, permissions) VALUES
    (1, 'admin', '{"all": true}'),
    (2, 'moderator', '{"view_messages": true, "approve_messages": true, "block_users": true}'),
    (3, 'viewer', '{"view_messages": true}');

-- Test admin foydalanuvchi
-- Parol: admin123
-- Hash: $2a$10$rWvF5P5Y9vY5xY5xY5xY5euJKJ9r5J9r5J9r5J9r5J9r5J9r5J9r5
INSERT OR IGNORE INTO users (id, username, email, password_hash, full_name, role_id) VALUES
    (1, 'admin', 'admin@logistics.uz', '$2a$10$K8P7qVqC6zJ8P7qVqC6zJ.K8P7qVqC6zJ8P7qVqC6zJ8P7qVqC6zJO', 'Administrator', 1);
