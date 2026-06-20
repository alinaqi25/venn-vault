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

function sendResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allowed-Origin": ALLOWED_ORIGIN, // ft
    "Access-Control-Allowed-Headers": "Content-Type",
    "Access-Control-Allowed-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allowed-Credentials": "true",
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
    const filePath = path.join(__dirname,'..',safePath)
    const ext = path.extname(filePath)
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
    }

    try {
        const content = fs.readFileSync(filePath)
        response.writeHead(200. {
            "Content-Type":mimeTypes[ext] || "text/plain",
        })
        response.end(content);
        return;
    }
    catch{
        response.writeHead(404)
        response.end("Not Found")
        return
    }
  }

  
});
