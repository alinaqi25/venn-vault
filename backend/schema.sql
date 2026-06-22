
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    account_seq_id SERIAL UNIQUE,
    account_number VARCHAR(30) GENERATED ALWAYS AS ('VV-' || (1075102638 + account_seq_id)::TEXT) STORED UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, 
    account_type VARCHAR(10) NOT NULL DEFAULT 'user',
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- SOFT DELETE TO PRESERVE TRANSACITON HISTROIES
    CONSTRAINT chk_account_type CHECK (account_type IN('user', 'admin'))
);

CREATE TABLE wallets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
    CONSTRAINT chk_balance CHECK (balance >=0.00)   
);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    sender_wallet_id BIGINT REFERENCES wallets(id) ON DELETE SET NULL,
    receiver_wallet_id BIGINT REFERENCES wallets(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL,
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_txn_type CHECK(transaction_type IN('WITHDRAW', 'DEPOSIT', 'TRANSFER'))
)

-- CREATE INDEXES HERE 

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);