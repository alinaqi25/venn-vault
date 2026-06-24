import "dotenv/config";
import bcrypt from "bcrypt";
import * as db from "./db.js";
import crypto from "crypto";

if (!process.env.ADMIN_PASSWORD) {
  console.error("CRITICAL ERROR: ADMIN_PASSWORD environment variable is missing.");
  process.exit(1); 
}

const adminEmail = "admin@vennvault.internal";

try {
  const existingAdmin = await db.findUserByEmail(adminEmail);

  if (existingAdmin) {
    console.log("Admin already seeded. Skipping...");
    process.exit(0);
  }

  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

  const adminUser = await db.seedAdmin({
    name: "Admin",
    email: adminEmail,
    passwordHash: hash,
  });

  await db.createWallet({
    userId: adminUser.id,
    balance: 0,
    currency: "PKR",
  });

  console.log("Admin seeded successfully.");
  process.exit(0);

} catch (error) {
  console.error("Error seeding admin:", error);
  process.exit(1);
}