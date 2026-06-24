# Venn-Vault

A full-stack online banking application built entirely with vanilla Node.js — no Express, no framework. Every HTTP concern: routing, body parsing, header management, static file serving, and cookie handling is implemented from scratch using Node's native `http` and `fs` modules.

The project is intentionally built this way. The goal was to understand what frameworks do by doing it without them.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (native `http` module) |
| Database | PostgreSQL (via `pg` pool) |
| Auth | JSON Web Tokens (`jsonwebtoken`) |
| Password Security | `bcrypt` |
| Environment | `dotenv` |
| Frontend | Vanilla HTML, CSS, JavaScript |

---

## Project Structure

```
venn-vault/
├── backend/
│   ├── server.js          # HTTP server, router, all API route handlers
│   ├── db.js              # All database query functions (pg pool)
│   ├── schema.sql         # PostgreSQL table definitions and indexes
│   ├── seedAdmin.js       # Admin account seeder (idempotent)
│   └── setup.js           # Remote schema runner (Railway / DATABASE_URL)
├── frontend/
│   ├── login.js           # Login form handler
│   ├── register.js        # Registration form handler
│   ├── dashboard.js       # Dashboard: panels, transactions, balance
│   └── admin.js           # Admin panel: user table, freeze/delete, history
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── admin.html
├── features.html
├── docs.html
├── style.css
└── .env
```

---

## Architecture

### HTTP Server & Router

`server.js` creates a single Node `http` server. Every incoming request is handled inside one `async` callback. Routing is done by matching `request.url` and `request.method` directly — no router library, no middleware stack.

```
GET  /                    → serves index.html
GET  /dashboard           → serves dashboard.html
GET  /frontend/dashboard.js  → serves JS file
POST /api/auth/register   → registration handler
POST /api/auth/login      → login handler
GET  /api/auth/profile    → profile + wallet fetch
POST /api/wallet/deposit  → deposit handler
POST /api/wallet/withdraw → withdrawal handler
POST /api/wallet/transfer → transfer handler
GET  /api/wallet/transactions → transaction history
POST /api/admin/login     → admin authentication
GET  /api/admin/users     → all users + balances
GET  /api/admin/users/:id/transactions → user history
POST /api/admin/users/:id/freeze  → freeze / unfreeze
POST /api/admin/users/:id/delete  → soft delete
```

Static file serving is handled in the same server callback. Any `GET` request that doesn't start with `/api/` resolves to a file on disk. Extensionless paths like `/dashboard` automatically resolve to `/dashboard.html`. MIME types for `.html`, `.js`, `.css`, `.png`, and `.jpg` are mapped manually.

### Body Parsing

Request bodies are read using Node's raw stream API — `request.on('data')` and `request.on('end')` — and parsed with `JSON.parse`. No `body-parser`, no `express.json()`.

### Authentication

Sessions are stateless. After a successful login or registration, the server signs a JWT containing the user's `accountNumber` and sets it as an `HttpOnly`, `SameSite=Lax` cookie with a 10-minute expiry (`Max-Age=600`). Protected routes extract this cookie manually from the `Cookie` header using a regex match, verify it with `jwt.verify`, and resolve the user from the database.

Admin sessions use a separate cookie (`adminToken`) with a 30-minute expiry. Admin routes check for this cookie and additionally verify that the decoded token carries `role: "admin"` before proceeding.

### Database Layer

All database interaction is in `db.js`, which exports named async functions. These wrap a `pg.Pool` with two internal helpers: `query` (returns all rows) and `queryOne` (returns first row or null). No ORM.

Fund transfers use a dedicated `executeTransfer` function that acquires a client from the pool, runs `BEGIN`, locks both wallet rows with `SELECT ... FOR UPDATE`, validates the sender balance, applies both `UPDATE` statements, inserts the transaction record, and `COMMIT`s — or `ROLLBACK`s on any error. This ensures transfers are atomic.

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key |
| `account_seq_id` | `SERIAL UNIQUE` | Auto-incrementing sequence |
| `account_number` | `VARCHAR(30)` | Generated: `'VV-' \|\| (1075102638 + account_seq_id)` |
| `name` | `VARCHAR(100)` | |
| `email` | `VARCHAR(255) UNIQUE` | |
| `password_hash` | `VARCHAR(255)` | bcrypt hash |
| `account_type` | `VARCHAR(10)` | `'user'` or `'admin'` |
| `is_frozen` | `BOOLEAN` | Default `FALSE` |
| `create_time` | `TIMESTAMPTZ` | Default `NOW()` |
| `is_deleted` | `BOOLEAN` | Soft delete — preserves transaction history |

### `wallets`
| Column | Type | Notes |
|---|---|---|
| `id` | `BIGINT` | Identity, starts at `749201836` |
| `user_id` | `BIGINT` | FK → `users(id)` |
| `balance` | `NUMERIC(15,2)` | Constrained `>= 0.00` |
| `currency` | `VARCHAR(10)` | Default `'PKR'` |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key |
| `sender_wallet_id` | `BIGINT` | Nullable (null for deposits) |
| `receiver_wallet_id` | `BIGINT` | Nullable (null for withdrawals) |
| `amount` | `NUMERIC(15,2)` | Constrained `> 0` |
| `transaction_type` | `VARCHAR(10)` | `'DEPOSIT'`, `'WITHDRAW'`, or `'TRANSFER'` |
| `create_time` | `TIMESTAMPTZ` | Default `NOW()` |

Indexes exist on `users.email` and `wallets.user_id`.

---

## Security

- **Passwords** are hashed with `bcrypt` at a cost factor of 10 before being stored. Plaintext is never persisted and never logged.
- **JWTs** are signed with a secret from `process.env.JWT_SECRET` and set as `HttpOnly` cookies, making them inaccessible to client-side JavaScript.
- **Frozen accounts** are blocked at the API level on deposit, withdrawal, and transfer routes — not just in the UI.
- **Soft deletes** mark accounts as `is_deleted = TRUE` rather than removing rows, so transaction history referencing deleted users is preserved.
- **Transfer atomicity** is enforced with a PostgreSQL transaction and row-level locks (`FOR UPDATE`), preventing race conditions on concurrent balance updates.
- **Admin and user sessions are separated** — a user `token` cookie cannot authenticate admin routes, and an `adminToken` cookie cannot authenticate user routes.

---

## Setup

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL database (local or hosted)

### Installation

```bash
git clone https://github.com/alinaqi25/venn-vault.git
cd venn-vault
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vennvault
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_jwt_key
ADMIN_PASSWORD=your_admin_password
ALLOWED_ORIGIN=http://localhost:8080
```

For Railway or other hosted Postgres, use `DATABASE_URL` instead.

### Database Setup

**Option A — Local Postgres:**

Connect to your database and run `backend/schema.sql` manually, or pipe it in:

```bash
psql -U your_user -d vennvault -f backend/schema.sql
```

**Option B — Remote (Railway / hosted):**

```bash
node backend/setup.js
```

This reads `backend/schema.sql` and executes it against `DATABASE_URL`.

### Seed Admin Account

```bash
node backend/seedAdmin.js
```

This creates the admin user with the email `admin@vennvault.internal` and the password from `process.env.ADMIN_PASSWORD`. The script is idempotent — running it again when the admin already exists does nothing.

### Start the Server

```bash
node backend/server.js
```

The server starts on port `8080`. Open `http://localhost:8080` in your browser.

---

## API Reference

All API endpoints return JSON. Protected routes require a valid `token` cookie (set on login/registration).

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ name, email, password }` | Register a new user, create wallet, set auth cookie |
| `POST` | `/api/auth/login` | `{ accountNumber, password }` | Authenticate and set auth cookie |
| `GET` | `/api/auth/profile` | — | Return current user + wallet (requires cookie) |

### Wallet

All wallet routes require a valid `token` cookie and will return `403` if the account is frozen.

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/wallet/deposit` | `{ amount }` | Add funds to wallet |
| `POST` | `/api/wallet/withdraw` | `{ amount }` | Deduct funds from wallet (balance floor: 0) |
| `POST` | `/api/wallet/transfer` | `{ amount, recipient }` | Transfer to another user by email or Wallet ID |
| `GET` | `/api/wallet/transactions` | — | Full transaction history for the authenticated user |

### Admin

All admin routes require a valid `adminToken` cookie (set on admin login).

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/admin/login` | `{ password }` | Authenticate as admin, set admin cookie |
| `GET` | `/api/admin/users` | — | All non-admin users with wallet balances |
| `GET` | `/api/admin/users/:id/transactions` | — | Transaction history for a specific user |
| `POST` | `/api/admin/users/:id/freeze` | `{ frozen: true/false }` | Freeze or unfreeze a user account |
| `POST` | `/api/admin/users/:id/delete` | — | Soft delete a user account |

---

## Frontend

The frontend is plain HTML, CSS, and JavaScript — no React, no bundler.

- **`login.js`** handles the login form, posts to `/api/auth/login`, and redirects to `/dashboard` on success.
- **`register.js`** handles registration, posts to `/api/auth/register`, and redirects to `/dashboard` on success.
- **`dashboard.js`** fetches the user profile on load, populates the balance card and account info, and manages slide-in panels for deposit, withdrawal, transfer, and transaction history. Balance is updated in-memory after every successful transaction without a full page reload.
- **`admin.js`** handles admin login, then dynamically builds the admin panel UI, loads all users into a table, and handles freeze/unfreeze/delete actions and per-user transaction modals inline.

The server itself serves all frontend files — there is no separate static file server or CDN involved.

---

## Why No Framework?

Most Node projects reach for Express immediately. This one doesn't. Writing the router, body parser, static file handler, cookie extractor, and response helper by hand is how you understand what those abstractions actually do. Every line in `server.js` has a reason, and nothing happens that isn't explicitly written.
