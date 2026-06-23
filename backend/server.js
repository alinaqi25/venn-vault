// SERVER.JS CODE

import http, { request } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import * as db from "./db.js";
import crypto from "crypto";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:8080";
const JWT_SECRET_KEY = process.env.JWT_SECRET;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8080;
const JWT_SECRET = process.env.JWT_SECRET;

// ft - admin secret key here

async function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body recieved"));
      }
    });
  });
}

function sendResponse(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN, // ft
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  const url = request.url;
  const method = request.method;
  console.log(`${method} request made on the URL: ${url}\n`);

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return response.end();
  }

  if (method === "GET" && !url.startsWith("/api/")) {
    const safePath = url == "/" ? "/index.html" : url;
    const filePath = path.join(__dirname, "..", safePath);
    const ext = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
    };

    try {
      const content = fs.readFileSync(filePath);
      response.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "text/plain",
      });
      response.end(content);
      return;
    } catch {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }
  }

  if (url === "/api/auth/register" && method === "POST"){
    try {
      const body = await parseRequestBody(request);
      const { name, email, password } = body;

      if (!name || !email || !password) {
        return sendResponse(response, 400, {
          error: "Missing required fields",
        });
      }

      const userExists = await db.findUserByEmail(email);
      if (userExists) {
        return sendResponse(response, 409, {
          error: "Email already registered",
        });
      }

      // const hashedPassword = await bcrypt.hash(password, 10);
      // const newUser = await db.createUser({
      //   name,
      //   email,
      //   passwordHash: hashedPassword,
      // });

      // await db.createWallet({
      //   userId: newUser.id,
      //   balance: 0,
      //   currency: "PKR",
      // });
      // const token = jwt.sign(
      //   { accountNumber: newUser.account_number },
      //   JWT_SECRET_KEY,
      //   {
      //     expiresIn: "10m",
      //   },
      // );

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 1. Create the user
      await db.createUser({
        name,
        email,
        passwordHash: hashedPassword,
      });

      // 2. Fetch the newly created user record to guarantee we have the assigned account_number and ID
      const createdUser = await db.findUserByEmail(email);

      // 3. Create the wallet using the fetched ID
      await db.createWallet({
        userId: createdUser.id,
        balance: 0,
        currency: "PKR",
      });
      
      // 4. Sign the token using the definitively retrieved account number
      const token = jwt.sign(
        { accountNumber: createdUser.account_number },
        JWT_SECRET_KEY,
        {
          expiresIn: "10m",
        },
      );

      const cookieConfig = `token=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`;

      return sendResponse(
        response,
        201,
        {
          success: true,
          message: "User registered and logged in successfully!",
        },
        { "Set-Cookie": cookieConfig },
      );
    } catch (error) {
      console.log(error);
      return sendResponse(response, 500, { error: "Internal Server Error" });
    }
  }

  if (url === "/api/auth/login" && method === "POST") {
    try {
      const { accountNumber, password } = await parseRequestBody(request);
      if (!accountNumber || !password) {
        return sendResponse(response, 400, {
          error: "Missing account number or password",
        });
      }
      const user = await db.findUserByAccNumber(accountNumber);
      if (!user) {
        return sendResponse(response, 404, { error: "User does not exist." });
      }

      if (user.is_deleted) {
        return sendResponse(response, 403, { error: "This account has been deleted." });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return sendResponse(response, 401, { error: "Incorrect password" });
      }

      const token = jwt.sign({ accountNumber }, JWT_SECRET_KEY, {
        expiresIn: "10m",
      });
      const cookieConfig = `token=${token}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`; // have to add a secure flag if/after plublishing it in a secure https site domain! also change sameSit from Lax to Strict
      return sendResponse(
        response,
        200,
        { success: true, message: "Login successful!" },
        { "Set-Cookie": cookieConfig },
      );
    } catch (error) {
      return sendResponse(response, 500, { error: "Internal Server Error" });
    }
  }

  if (url === "/api/auth/profile" && method === "GET") {
    try {
      const cookieHeader = request.headers.cookie || "";

      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return sendResponse(response, 401, {
          error: "Not authenticated. No token found.",
        });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET_KEY);
      } catch (err) {
        return sendResponse(response, 401, {
          error: "Session expired or invalid token.",
        });
      }

      let user = await db.findUserByAccNumber(decoded.accountNumber);
      if (!user) {
        return sendResponse(response, 404, { error: "User not found." });
      }

      if (user.is_deleted) {
        return sendResponse(response, 403, { error: "This account has been deleted." });
      }

      const wallet = await db.findWalletByUserId(user.id);
      return sendResponse(response, 200, {
        success: true,
        user: {
          id: user.id,
          accountNumber: user.account_number,
          name: user.name,
          email: user.email,
          role: user.account_type,
          dateCreated: user.create_time,
        },
        wallet: wallet
          ? {
              id: wallet.id,
              userId: user.id,
              balance: wallet.balance,
              currency: wallet.currency,
            }
          : null,
      });
    } catch (error) {
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

  // --- WALLET DEPOSIT ROUTE ---
  if(url === "/api/wallet/deposit" && method === "POST") {
    try {
      const cookieHeader = request.headers.cookie || "";
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return sendResponse(response, 401, { error: "Not authenticated." });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET_KEY);
      } catch (err) {
        return sendResponse(response, 401, {
          error: "Session expired or invalid token.",
        });
      }

      const user = await db.findUserByAccNumber(decoded.accountNumber);
      if (!user) {
        return sendResponse(response, 404, { error: "User not found." });
      }

      if (user.is_deleted) {
        return sendResponse(response, 403, { error: "This account has been deleted." });
      }

      if (await db.isUserFrozen(user.id)) {
        return sendResponse(response, 403, {
          error: "Your account has been frozen. Please contact support.",
        });
      }

      const { amount } = await parseRequestBody(request);
      if (!amount || amount <= 0) {
        return sendResponse(response, 400, {
          error: "Invalid deposit amount.",
        });
      }

      const wallet = await db.findWalletByUserId(user.id);
      if (!wallet) {
        return sendResponse(response, 404, { error: "Wallet not found." });
      }

      await db.updateWalletBalance(
        wallet.id,
        parseFloat(wallet.balance) + parseFloat(amount),
      );

      await db.recordTransaction({
        senderWalletId: null,
        receiverWalletId: wallet.id,
        amount: amount,
        type: "DEPOSIT",
      });

      return sendResponse(response, 200, {
        success: true,
        message: "Deposit processed successfully.",
        newBalance: parseFloat(wallet.balance) + parseFloat(amount),
      });
    } catch (error) {
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

  // --- WALLET WITHDRAW ROUTE ---
  if (url === "/api/wallet/withdraw" && method === "POST") {
    try {
      const cookieHeader = request.headers.cookie || "";
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return sendResponse(response, 401, { error: "Not authenticated." });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET_KEY);
      } catch (err) {
        return sendResponse(response, 401, {
          error: "Session expired or invalid token.",
        });
      }

      const user = await db.findUserByAccNumber(decoded.accountNumber);
      if (!user) {
        return sendResponse(response, 404, { error: "User not found." });
      }

      if (user.is_deleted) {
        return sendResponse(response, 403, { error: "This account has been deleted." });
      }

      if (await db.isUserFrozen(user.id)) {
        return sendResponse(response, 403, {
          error: "Your account has been frozen. Please contact support.",
        });
      }

      const { amount } = await parseRequestBody(request);
      if (!amount || amount <= 0) {
        return sendResponse(response, 400, {
          error: "Invalid withdrawal amount.",
        });
      }

      const wallet = await db.findWalletByUserId(user.id);
      if (!wallet) {
        return sendResponse(response, 404, { error: "Wallet not found." });
      }

      if (parseFloat(wallet.balance) < parseFloat(amount)) {
        return sendResponse(response, 400, { error: "Insufficient funds." });
      }
      await db.updateWalletBalance(
        wallet.id,
        parseFloat(wallet.balance) - parseFloat(amount),
      );

      await db.recordTransaction({
        senderWalletId: wallet.id,
        receiverWalletId: null,
        amount: amount,
        type: "WITHDRAW",
      });

      return sendResponse(response, 200, {
        success: true,
        message: "Withdrawal processed successfully.",
        newBalance: parseFloat(wallet.balance) - parseFloat(amount),
      });
    } catch (error) {
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

  // --- WALLET TRANSFER ROUTE ---
  if(url === "/api/wallet/transfer" && method === "POST") {
    try {
      const cookieHeader = request.headers.cookie || "";
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return sendResponse(response, 401, { error: "Not authenticated." });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET_KEY);
      } catch (err) {
        return sendResponse(response, 401, {
          error: "Session expired or invalid token.",
        });
      }

      const sender = await db.findUserByAccNumber(decoded.accountNumber);
      if (!sender) {
        return sendResponse(response, 404, { error: "User not found." });
      }

      if (sender.is_deleted) {
        return sendResponse(response, 403, { error: "This account has been deleted." });
      }

      if (await db.isUserFrozen(sender.id)) {
        return sendResponse(response, 403, {
          error: "Your account has been frozen. Please contact support.",
        });
      }

      const { amount, recipient } = await parseRequestBody(request);

      if (!amount || amount <= 0) {
        return sendResponse(response, 400, {
          error: "Invalid transfer amount.",
        });
      }
      if (!recipient) {
        return sendResponse(response, 400, {
          error: "Recipient identifier missing.",
        });
      }

      const senderWallet = await db.findWalletByUserId(sender.id);
      let recipientWalletId = null;

      const recipientUser = await db.findUserByEmail(recipient);
      if (recipientUser) {
        if (recipientUser.is_deleted) {
          return sendResponse(response, 400, { error: "Recipient account is no longer active." });
        }
        if (recipientUser.id === sender.id)
          return sendResponse(response, 400, {
            error: "Cannot transfer to yourself.",
          });
        const rWallet = await db.findWalletByUserId(recipientUser.id);
        if (rWallet) recipientWalletId = rWallet.id;
      } else {
        const rWallet = await db.findWalletById(recipient);
        if (rWallet) recipientWalletId = rWallet.id;
      }

      if (!recipientWalletId) {
        return sendResponse(response, 404, {
          error: "Recipient not found. Please check the email or Wallet ID.",
        });
      }

      try {
        await db.executeTransfer(senderWallet.id, recipientWalletId, amount);
      } catch (err) {
        return sendResponse(response, 400, { error: err.message });
      }

      const updatedSenderWallet = await db.findWalletByUserId(sender.id);

      return sendResponse(response, 200, {
        success: true,
        message: "Transfer processed successfully.",
        newBalance: updatedSenderWallet.balance,
      });
    } catch (error) {
      console.error("Transfer Error:", error);
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

  // --- TRANSACTION HISTORY ROUTE ---
 if (url === "/api/wallet/transactions" && method === "GET") {
    try {
      const cookieHeader = request.headers.cookie || "";
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return sendResponse(response, 401, { error: "Not authenticated." });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET_KEY);
      } catch (err) {
        return sendResponse(response, 401, {
          error: "Session expired or invalid token.",
        });
      }

      const user = await db.findUserByAccNumber(decoded.accountNumber);
      if (!user) {
        return sendResponse(response, 404, { error: "User not found." });
      }

      const history = await db.getUserTransactions(user.id);

      return sendResponse(response, 200, {
        success: true,
        transactions: history,
      });
    } catch (error) {
      console.error("Transaction Fetch Error:", error);
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

 if (url === "/api/admin/login" && method === "POST") {
    try {
      const { password } = await parseRequestBody(request);
      if (!password) {
        return sendResponse(response, 400, { error: "Password required." });
      }

      const adminUser = await db.findUserByEmail("admin@vennvault.internal");
      if (!adminUser) {
        return sendResponse(response, 500, { error: "Admin not configured." });
      }
      const isMatch = await bcrypt.compare(password, adminUser.password_hash);
      if (!isMatch) {
        return sendResponse(response, 401, {
          error: "Incorrect admin password.",
        });
      }

      const token = jwt.sign(
        { accountNumber: adminUser.account_number, role: "admin" },
        JWT_SECRET_KEY,
        { expiresIn: "30m" },
      );
      const cookieConfig = `adminToken=${token}; HttpOnly; SameSite=Lax; Max-Age=1800; Path=/`;
      return sendResponse(
        response,
        200,
        { success: true, message: "Admin login successful." },
        { "Set-Cookie": cookieConfig },
      );
    } catch (err) {
      return sendResponse(response, 500, { error: "Internal server error" });
    }
  }

  // ─── ADMIN AUTH HELPER (inline, used by admin routes below) ──
  function verifyAdminToken(request) {
    const cookieHeader = request.headers.cookie || "";
    const match = cookieHeader.match(/adminToken=([^;]+)/);
    if (!match) return null;
    try {
      const decoded = jwt.verify(match[1], JWT_SECRET_KEY);
      if (decoded.role !== "admin") return null;
      return decoded;
    } catch {
      return null;
    }
  }

  if (url === "/api/admin/users" && method === "GET") {
    const admin = verifyAdminToken(request);
    if (!admin) return sendResponse(response, 401, { error: "Unauthorized." });

    const users = await db.getAllUsers();
    const filteredUsers = users.filter((u) => u.accountType !== "admin");

    const usersWithBalance = await Promise.all(
      filteredUsers.map(async (u) => {
        const wallet = await db.findWalletByUserId(u.id);
        return {
          ...u,
          balance: wallet ? wallet.balance : 0,
          currency: wallet ? wallet.currency : "PKR",
        };
      }),
    );
    return sendResponse(response, 200, {
      success: true,
      users: usersWithBalance,
    });
  }

  if (
    url.startsWith("/api/admin/users/") &&
    url.endsWith("/transactions") &&
    method === "GET"
  ) {
    const admin = verifyAdminToken(request);
    if (!admin) return sendResponse(response, 401, { error: "Unauthorized." });

    const userId = url.split("/")[4];
    const transactions = await db.getUserTransactions(userId);
    return sendResponse(response, 200, { success: true, transactions });
  }

  if (
    url.startsWith("/api/admin/users/") &&
    url.endsWith("/delete") &&
    method === "POST"
  ) {
    const admin = verifyAdminToken(request);
    if (!admin) return sendResponse(response, 401, { error: "Unauthorized." });

    const userId = url.split("/")[4];
    const deleted = await db.deleteUser(userId);
    if (!deleted)
      return sendResponse(response, 404, { error: "User not found." });
    return sendResponse(response, 200, {
      success: true,
      message: "User deleted.",
    });
  }

  if (
    url.startsWith("/api/admin/users/") &&
    url.endsWith("/freeze") &&
    method === "POST"
  ) {
    const admin = verifyAdminToken(request);
    if (!admin) return sendResponse(response, 401, { error: "Unauthorized." });

    const userId = url.split("/")[4];
    const { frozen } = await parseRequestBody(request);
    const result = await db.setUserFrozen(userId, !!frozen);
    if (!result)
      return sendResponse(response, 404, { error: "User not found." });
    return sendResponse(response, 200, {
      success: true,
      message: frozen ? "User frozen." : "User unfrozen.",
    });
  }

  return sendResponse(response, 404, { error: "Route not found" });
});

// STARTING THE SERVER

server.listen(PORT, () => {
  console.log(`Listening at ${PORT}...`);
});
