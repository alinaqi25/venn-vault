import "dotenv/config";
import bcrypt from "bcrypt";
import * as db from "./db.js";
import crypto from "crypto";

const hash = await bcrypt.hash("sUperSecureAdminPassword12334477443", 10);

const adminUser = await db.seedAdmin({
  name: "Admin",
  email: "admin@vennvault.internal",
  passwordHash: hash,
});

await db.createWallet({
  userId: adminUser.id,
  balance: 0,
  currency: "PKR",
});

console.log("Admin seeded.");
process.exit(0);
