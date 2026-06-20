import http, { request } from 'http'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = 8080
const JWT_SECRET = process.env.JWT_SECRET

// ft - admin secret key here

async function parseRequestBody(request){
    return new Promise((resolve, reject)=>{
        let body = ""
        request.on('data', (chunk)=>{
            body+=chunk.toString()
        })
        request.on('end', ()=>{
            try{
                resolve(body ? JSON.parse(body):{})
            }
            catch(error){
                reject(new Error("Invalid JSON body recieved"))
            }
        })
    })
}

function sendResponse(response, statusCode, payload){
    response.writeHead(statusCode, {
        "Content-Type":'application/json',
        "Access-Control-Allowed-Origin": ALLOWED_ORIGIN, // ft
        "Access-Control-Allowed-Headers":'Content-Type',
        "Access-Control-Allowed-Methods":'GET, POST, OPTIONS',
        "Access-Control-Allowed-Credentials":'true'
    })
    response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request,response)=>{
    response.setHeader('Content-Type', 'application/json')
    const url = request.url
    const method = request.method
    
})