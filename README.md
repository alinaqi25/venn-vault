# Venn-Vault: A Zero-Framework, Highly Secure Vanilla Node.js Banking API

Venn-Vault is a full-stack online banking application with a heavy emphasis on core backend mechanics. Deliberately built without Express.js, this project was designed from the ground up to deeply explore routing, server architecture, and security layers using pure, vanilla Node.js rather than relying on framework magic.

While the frontend provides a clean, user-friendly interface, the real focus is under the hood. Venn-Vault features a custom-built security model utilizing bcrypt for password hash generation, native Node crypto for UUIDs, and JWTs for robust session management.

---

## Features

* **Zero-Framework Architecture:** Custom routing, request parsing, and response handling written entirely with Node's native `http` module.
* **Airtight Security:** * Passwords hashed using `bcrypt`.
  * Stateless authentication via JSON Web Tokens (JWT).  
  * Secure HTTP-only cookies and proper session management.  
  * Additional cryptographic operations handled by Node's native `crypto` module.
* **Relational Database:** Persistent data storage, user tracking, and ledger management handled via PostgreSQL.
* **Core Banking Operations:** Full login, registration, and account dashboard rendering.
* **Clean Frontend:** A lightweight, user-friendly UI to interact with the API seamlessly.
* **"Sandbox" Economy:** Currently features an infinite-money sandbox. Deposits and withdrawals successfully hit the routing and database layers, but allow for dummy inputs to test the transaction flow. Basically, you can print money out of thin air for testing purposes.

---

## Tech Stack

* **Backend:** Vanilla Node.js (Native `http` module)
* **Database:** PostgreSQL
* **Security:** `bcrypt`, `jsonwebtoken`
* **Frontend:** HTML, CSS, Vanilla JavaScript

---

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
* Node.js (preferrably latest version)
* PostgreSQL

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/venn-vault.git](https://github.com/yourusername/venn-vault.git)
   cd venn-vault
   ```

2. **Install dependencies:**
   *(Note: While the app is vanilla Node, it uses a few essential packages for database connections and cryptography).*
   ```bash
   npm install
   ```

3. **Set up PostgreSQL Database:**
   Create a new database in Postgres and run your SQL scripts to set up the users and transactions tables.

4. **Environment Variables:**
   Create a `.env` file in the root directory and add your configuration details:
   ```env
   PORT=3000
   DB_USER=your_postgres_user
   DB_PASSWORD=your_postgres_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=venn_vault_db
   JWT_SECRET=your_super_secret_jwt_key
   ```

5. **Start the server:**
   ```bash
   npm start
   ```
   *The server will spin up on `http://localhost:3000` (or whatever port you defined).*

---

## Why Vanilla Node?

Most modern Node apps rely heavily on Express.js to handle the heavy lifting. This project was built to strip away the abstractions. By handling raw streams, setting up custom parsers, and writing a router from scratch, Venn-Vault serves as a deep dive into the inner workings of the HTTP protocol and web server mechanics.
