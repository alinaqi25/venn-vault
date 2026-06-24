import fs from "fs";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSchema() {
  if(!process.env.DATABASE_URL){
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }
  try {
    console.log("Reading schema.sql...");
    const schema = fs.readFileSync("backend/schema.sql", "utf-8"); 

    console.log(`Sending schema to ${process.env.DATABASE_URL} Postgres...`);
    await pool.query(schema);

    console.log("Tables successfully created!");
  } catch (err) {
    console.error("Error creating tables:", err.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

runSchema();