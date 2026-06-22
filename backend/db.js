import pg from 'pg'
const {Pool} = pg

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost', 
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'vennvault',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
})

 /* HELPER FUNCTIONS */

 async function query(sql, params = []){
    const result = await pool.query(sql, params)
    return result.rows
 }

 async function queryOne(sql, params = []){
    const rows = await query(sql, params)
    return rows[0] || null
 }

  /* USER FUNCTIONS */

  export async function findUserByEmail(email){
    return queryOne('SELECT * FROM users WHERE email = $1', [email])
  }

  export async function findUserByAccNumber(accountNumber){
    return queryOne('SELECT * FROM users WHERE account_number = $1', [`VV-${accountNumber}`])
  }

  export async function createUser(userObject){
    return queryOne('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *', [userObject.name, userObject.email, userObject.passwordHash])
  }

  export async function seedAdmin(adminObject){
    return queryOne('INSERT INTO users (name, email, password_hash, account_type) VALUES ($1, $2, $3, $4) RETURNING *', [adminObject.name, adminObject.email, adminObject.passwordHash, adminObject.role])
  }