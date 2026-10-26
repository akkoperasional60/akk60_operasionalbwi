import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Hostinger MySQL Connection Configuration
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_NAME = process.env.DB_NAME || 'u194997008_akk_operasional';
const DB_USER = process.env.DB_USER || 'u194997008_akk_app';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

let pool: mysql.Pool | null = null;
let isPoolInitialized = false;

export function getDbPool(): mysql.Pool | null {
  if (pool) return pool;

  // Only attempt pool creation if password is supplied or explicitly forced
  if (!DB_PASSWORD && process.env.NODE_ENV !== 'production') {
    if (!isPoolInitialized) {
      console.warn('⚠️ [Hostinger MySQL] DB_PASSWORD is not set in environment variables. Operating in fallback mode.');
      isPoolInitialized = true;
    }
    return null;
  }

  try {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });

    if (!isPoolInitialized) {
      console.log(`✅ [Hostinger MySQL] Pool created for ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      isPoolInitialized = true;
    }
    return pool;
  } catch (err) {
    console.error('❌ [Hostinger MySQL] Failed to create MySQL pool:', err);
    return null;
  }
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const p = getDbPool();
  if (!p) return null;

  try {
    const [rows] = await p.execute(sql, params);
    return rows as T;
  } catch (err) {
    console.error('❌ [Hostinger MySQL] Query Error:', err, '\nSQL:', sql);
    return null;
  }
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  if (!DB_PASSWORD && process.env.NODE_ENV !== 'production') {
    return {
      success: false,
      message: 'DB_PASSWORD is missing in environment. Set DB_PASSWORD in Hostinger environment variables.'
    };
  }

  const p = getDbPool();
  if (!p) {
    return {
      success: false,
      message: 'Failed to initialize MySQL pool. Check DB_HOST, DB_USER, and DB_PASSWORD.'
    };
  }

  try {
    const connection = await p.getConnection();
    await connection.ping();
    connection.release();
    return {
      success: true,
      message: `Connected successfully to Hostinger MySQL (${DB_NAME}) at ${DB_HOST}:${DB_PORT}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `MySQL Connection failed: ${err?.message || err}`
    };
  }
}
