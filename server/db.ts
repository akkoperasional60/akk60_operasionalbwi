import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Load .env.example as fallback when variables are not set in process.env / .env
const envExamplePath = path.resolve(process.cwd(), '.env.example');
if (fs.existsSync(envExamplePath)) {
  try {
    const isCloudRunPreview = Boolean(process.env.K_SERVICE);
    const parsed = dotenv.parse(fs.readFileSync(envExamplePath, 'utf-8'));
    const hostVal = String(parsed.DB_HOST || 'localhost').trim().toLowerCase();
    const isLocalDbHost = hostVal === 'localhost' || hostVal === '127.0.0.1';
    for (const [key, val] of Object.entries(parsed)) {
      const cleanVal = String(val || '').trim();
      if (!cleanVal) continue;
      // In AI Studio Cloud Run preview, localhost:3306 MySQL does not exist, so skip DB_* pointing to localhost
      if (isCloudRunPreview && isLocalDbHost && key.startsWith('DB_')) {
        continue;
      }
      if (!process.env[key]) {
        process.env[key] = cleanVal;
      }
    }
  } catch {
    // Ignore .env.example parse errors
  }
}

let pool: mysql.Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(
    String(process.env.DB_NAME || '').trim() &&
    String(process.env.DB_USER || '').trim() &&
    String(process.env.DB_PASSWORD || '').trim()
  );
}

function assertDatabaseConfig(): void {
  const missing: string[] = [];
  if (!String(process.env.DB_NAME || '').trim()) missing.push('DB_NAME');
  if (!String(process.env.DB_USER || '').trim()) missing.push('DB_USER');
  if (!String(process.env.DB_PASSWORD || '').trim()) missing.push('DB_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Hostinger MySQL belum dikonfigurasi: ${missing.join(', ')}`);
  }
}

export function getDbPool(): mysql.Pool {
  if (pool) return pool;
  assertDatabaseConfig();

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const database = String(process.env.DB_NAME || '').trim();
  const user = String(process.env.DB_USER || '').trim();
  const password = String(process.env.DB_PASSWORD || '').trim();

  pool = mysql.createPool({
    host,
    port,
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4'
  });

  console.log(`✅ [Hostinger MySQL] Pool aktif di ${host}:${port}/${database}`);
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T> {
  const p = getDbPool();
  const [rows] = await p.execute(sql, params);
  return rows as T;
}

export async function testConnection(): Promise<{ success: boolean; configured: boolean; message: string }> {
  if (!isDatabaseConfigured()) {
    return {
      success: false,
      configured: false,
      message: 'Hostinger MySQL belum dikonfigurasi: DB_NAME, DB_USER, DB_PASSWORD belum diatur di environment variables.'
    };
  }
  try {
    const p = getDbPool();
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    return {
      success: true,
      configured: true,
      message: `Connected successfully to Hostinger MySQL at ${host}:${port}`
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      message: `MySQL Connection failed: ${err?.message || err}`
    };
  }
}
