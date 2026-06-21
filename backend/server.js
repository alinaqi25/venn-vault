import http, { request } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
    "Access-Control-Allowed-Origin": ALLOWED_ORIGIN, // ft
    "Access-Control-Allowed-Headers": "Content-Type",
    "Access-Control-Allowed-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allowed-Credentials": "true",
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
    const safePath = url == "/" ? "/index" : url;
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

  
    if (url === "/auth/register" && method === "POST") {
      try {
        const body = await parseRequestBody(request);
        const { name, email, password } = body;
  
        if (!name || !email || !password) {
          return sendResponse(response, 400, {
            error: "Missing required fields",
          });
        }
  
        let userExists; // first it was const userExists = db.findUserByEmail(email)
        if (userExists) {
          return sendResponse(response, 409, {
            error: "Email already registered",
          });
        }
  
        const hashedPassword = await bcrypt.hash(password, 10);
        /* const newUser = {
         id: crypto.randomUUID(),
          accountNumber: db.generateNextAccountNumber(),
          name,
          email,
          password_hash: hashedPassword,
          role: "user",
          dateCreated: Date.now(),
        };
        db.createUser(newUser);
  
        db.createWallet({
          id: crypto.randomUUID(),
          user_id: newUser.id,
          balance: 0,
          currency: "PKR",
        });
   */
        const token = jwt.sign(
          { accountNumber: newUser.accountNumber },
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
      let user; // previously "const user = db.findUserByAccNumber(accountNumber) which returns a user object if exists"
      if (!user) {
        return sendResponse(response, 404, { error: "User does not exist." });
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

  

});
