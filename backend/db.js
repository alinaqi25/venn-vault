//DB.JS

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "vennvault",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
});

/* HELPER FUNCTIONS */

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/* USER FUNCTIONS */

export async function findUserByEmail(email) {
  return queryOne("SELECT * FROM users WHERE email = $1", [email]);
}

export async function findUserByAccNumber(accountNumber) {
  return queryOne("SELECT * FROM users WHERE account_number = $1", [
    `VV-${accountNumber}`,
  ]);
}

export async function createUser(userObject) {
  return queryOne(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
    [userObject.name, userObject.email, userObject.passwordHash],
  );
}

export async function seedAdmin(adminObject) {
  return queryOne(
    "INSERT INTO users (name, email, password_hash, account_type) VALUES ($1, $2, $3, 'admin') RETURNING *",
    [adminObject.name, adminObject.email, adminObject.passwordHash],
  );
}

export async function getAllUsers() {
  return query(`SELECT account_number AS "accountNumber", name, email, password_hash AS "passwordHash", account_type AS "accountType", is_frozen AS "isFrozen", create_time AS "creatTime", is_deleted AS "isDeleted", id 
    FROM users`);
}

export async function deleteUser(userId) {
  const rows = await query(`UPDATE users SET is_deleted = TRUE WHERE id = $1 RETURNING id`, [userId]);
  return rows.length > 0;
}

export async function updateWalletBalance(walletId, newBalance) {
  return queryOne(
    `UPDATE wallets SET balance = $1 WHERE id = $2 RETURNING *`,
    [newBalance, walletId]
  );
}

export async function setUserFrozen(userId, frozen) {
  const rows = await query(
    `UPDATE users SET is_frozen = $1 WHERE id = $2 RETURNING id`,
    [frozen, userId],
  );
  return rows.length > 0;
}

export async function isUserFrozen(userId) {
  const row = await queryOne(`SELECT is_frozen FROM users WHERE id = $1`, [
    userId,
  ]);
  return row ? row.is_frozen : false;
}

export async function createWallet(walletObject) {
  return queryOne(
    `INSERT INTO wallets (user_id, balance, currency)
    VALUES ($1, $2, $3) RETURNING *`,
    [walletObject.userId, walletObject.balance, walletObject.currency],
  );
}

export async function findWalletByUserId(userId) {
  return queryOne(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
}

export async function findWalletById(walletId) {
  return queryOne(`SELECT * FROM wallets WHERE id = $1`, [walletId]);
}

export async function recordTransaction(transaction) {
  await queryOne(
    `INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, transaction_type)
      VALUES ($1, $2, $3, $4)`,
    [
      transaction.senderWalletId,
      transaction.receiverWalletId,
      transaction.amount,
      transaction.type,
    ],
  );
}

export async function executeTransfer(
  senderWalletId,
  receiverWalletId,
  amount,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const senderWallet = await client.query(
      `
          SELECT * FROM wallets WHERE id = $1 FOR UPDATE
        `,
      [senderWalletId],
    );

    const receiverWallet = await client.query(
      `
          SELECT * FROM wallets WHERE id = $1 FOR UPDATE
          `,
      [receiverWalletId],
    );

    if (!senderWallet.rows[0] || !receiverWallet.rows[0]) {
      throw new Error("Wallet not found");
    }

    if (parseFloat(senderWallet.rows[0].balance) < parseFloat(amount)) {
      throw new Error("Insufficient Funds");
    }

    await client.query(
      `
          UPDATE wallets SET balance = balance - $1 WHERE id = $2
          `,
      [amount, senderWalletId],
    );

    await client.query(
      `
          UPDATE wallets SET balance = balance + $1 WHERE id = $2
          `,
      [amount, receiverWalletId],
    );

    const txn = await client.query(
      `
          INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, transaction_type)
          VALUES ($1, $2, $3, 'TRANSFER') RETURNING *
          `,
      [senderWalletId, receiverWalletId, amount],
    );

    await client.query("COMMIT");
    return txn.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserTransactions(userId) {
  return query(
    `
    SELECT
      t.id AS "transactionId",
      t.sender_wallet_id AS "senderWalletId",
      t.receiver_wallet_id AS "receiverWalletId",
      t.amount,
      t.transaction_type AS "transactionType",
      t.create_time AS "createTime",
      senderWallet.currency AS "senderCurrency",
      recvWallet.currency AS "recvCurrency",
      sender.account_number AS "senderAccNumber",
      sender.name AS "senderName",
      recv.account_number AS "recvAccNumber",
      recv.name AS "recvName"
      FROM transactions t
      LEFT JOIN wallets senderWallet
      ON t.sender_wallet_id = senderWallet.id
      LEFT JOIN wallets recvWallet
      ON t.receiver_wallet_id = recvWallet.id
      LEFT JOIN users sender
      ON senderWallet.user_id = sender.id
      LEFT JOIN users recv
      ON recvWallet.user_id = recv.id
      WHERE senderWallet.user_id = $1
         OR recvWallet.user_id = $1
      ORDER BY t.create_time DESC
      `,
    [userId],
  );
}
