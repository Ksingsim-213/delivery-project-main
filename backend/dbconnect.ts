import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv'; // ดึงเครื่องมืออ่านไฟล์ .env เข้ามา

dotenv.config(); // สั่งให้อ่านไฟล์ .env ทันที

export const conn = createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST!, // ดึงค่าจาก .env มาใช้
    port: Number(process.env.DB_PORT), // ดึงค่าแล้วแปลงเป็นตัวเลข
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    database: process.env.DB_NAME!,
    ssl: { 
        rejectUnauthorized: false // สำคัญมากสำหรับ Aiven.io
    }
});