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
    "INSERT INTO users (name, email, password_hash, account_type) VALUES ($1, $2, $3, $4) RETURNING *",
    [
      adminObject.name,
      adminObject.email,
      adminObject.passwordHash,
      adminObject.role,
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

export async function getUserTransactions(userId, walletId) {
  return query(
    `
    SELECT
      t.id AS transactionId,
      t.sender_wallet_id,
      t.receiver_wallet_id,
      t.amount,
      t.transaction_type,
      t.create_time,
      senderWallet.currency AS senderCurrency,
      recvWallet.currency AS recvCurrency,
      sender.account_number AS senderAccNumber,
      sender.name AS senderName,
      recv.account_number AS recvAccNumber,
      recv.name AS recvName
      FROM transactions t
      LEFT JOIN wallets senderWallet
      ON t.sender_wallet_id = senderWallet.id
      LEFT JOIN wallets recvWallet
      ON t.receiver_wallet_id = recvWallet.id
      LEFT JOIN users sender
      ON senderWallet.user_id = sender.id
      LEFT JOIN users recv
      ON recvWallet.user_id = recv.id
        WHERE (t.sender_wallet_id = $2 AND senderWallet.user_id = $1)
              OR (t.receiver_wallet_id = $2 AND recvWallet.user_id = $1)
      ORDER BY t.create_time DESC
      `,
    [userId, walletId],
  );
}
