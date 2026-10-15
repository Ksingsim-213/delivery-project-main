import express from "express";
import { conn } from "../dbconnect"; 
import { Customer } from "../model/customer"; 
import {
  isLatitude,
  isLongitude,
  isNonEmptyString,
  isRecord,
  parseFiniteQueryNumber,
} from "./validation";

export const router = express.Router();

type CustomerInput = Pick<Customer, "name" | "phone" | "lat" | "lng">;
type CustomerUpdate = Partial<CustomerInput>;

const isCustomerInput = (value: unknown): value is CustomerInput =>
  isRecord(value) &&
  isNonEmptyString(value.name) &&
  isNonEmptyString(value.phone) &&
  isLatitude(value.lat) &&
  isLongitude(value.lng);

const isCustomerUpdate = (value: unknown): value is CustomerUpdate => {
  const allowedFields = ["name", "phone", "lat", "lng"];
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((field) => allowedFields.includes(field)) &&
    (!("name" in value) || isNonEmptyString(value.name)) &&
    (!("phone" in value) || isNonEmptyString(value.phone)) &&
    (!("lat" in value) || isLatitude(value.lat)) &&
    (!("lng" in value) || isLongitude(value.lng))
  );
};

// 1. API ดึงรายชื่อลูกค้าทั้งหมด (GET)
router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM customers");
    let customers = rows as Customer[];
    res.status(200).json(customers);
  } catch (error) {
    console.error("Database Error:", error); 
    if (error instanceof Error) {
        res.status(500).json({ error: error.message });
    } else {
        res.status(500).json({ error: "เกิดข้อผิดพลาดที่ไม่รู้จัก" });
    }
  }
});

// 2. API เพิ่มข้อมูลลูกค้าใหม่ (POST รองรับทั้ง object เดียว และ array)
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // กรณีส่งมาเป็น Array หลายคนพร้อมกัน
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return res.status(400).json({ error: "กรุณาส่งข้อมูลลูกค้าอย่างน้อย 1 รายการ" });
      }

      const customers = data.filter(isCustomerInput);
      if (customers.length !== data.length) {
        return res.status(400).json({
          error: "ข้อมูลลูกค้าแต่ละรายการต้องมี name, phone, lat และ lng ที่ถูกต้อง",
        });
      }

      // สร้าง Query SQL แบบไดนามิก (?,?,?,?), (?,?,?,?)...
      const placeholders = data.map(() => "(?, ?, ?, ?)").join(", ");
      const sql = `INSERT INTO \`customers\` (\`name\`, \`phone\`, \`lat\`, \`lng\`) VALUES ${placeholders}`;
      
      // ดึงค่าของทุกคนมารวมเป็น Array 1 มิติ
      const values = customers.flatMap((c) => [c.name, c.phone, c.lat, c.lng]);

      const [result] = await conn.query(sql, values);
      const insertResult = result as any;

      return res.status(201).json({
        message: `เพิ่มลูกค้าใหม่สำเร็จ ${insertResult.affectedRows} คน!`,
      });
    }

    // กรณีส่งมาเป็น Object คนเดียว
    if (!isCustomerInput(data)) {
      return res.status(400).json({
        error: "ต้องระบุ name, phone, lat และ lng ให้ถูกต้อง",
      });
    }

    const customer = data;
    let sql = "INSERT INTO `customers` (`name`, `phone`, `lat`, `lng`) VALUES (?,?,?,?)";
    const [result] = await conn.query(sql, [
      customer.name,
      customer.phone,
      customer.lat,
      customer.lng
    ]);

    const insertResult = result as any;
    res.status(201).json({
      message: "เพิ่มลูกค้าใหม่เรียบร้อยแล้ว!",
      customer_id: insertResult.insertId
    });
  } catch (error) {
    console.error("Insert Error:", error);
    res.status(500).json({ error: "บันทึกข้อมูลลูกค้าไม่สำเร็จ" });
  }
});

// 3. API อัปเดตข้อมูลลูกค้า (PUT)
router.put("/:id", async (req, res) => {
  try {
    let id = req.params.id; // รับ ID
    const customerId = Number(id);
    const newCustomerData: unknown = req.body;

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: "รหัสลูกค้าต้องเป็นจำนวนเต็มบวก" });
    }

    if (!isCustomerUpdate(newCustomerData)) {
      return res.status(400).json({ error: "ข้อมูลลูกค้าที่ส่งมาไม่ถูกต้อง" });
    }
    
    // 1. ไปดึงข้อมูลลูกค้า "คนเดิม" มาจากฐานข้อมูลก่อน
    const [rows] = await conn.query("SELECT * FROM customers WHERE id = ?", [id]);
    const result = rows as Customer[];

    // ถ้าไม่เจอลูกค้าคนนี้ ให้ตอบกลับ 404
    if (result.length === 0) {
      return res.status(404).json({ error: "ไม่พบลูกค้ารายนี้" });
    }

    // 2. นำข้อมูล "เก่า" มาเป็นฐาน แล้วเอาข้อมูล "ใหม่" มาเขียนทับ (Merge)
    let originalCustomer = result[0];
    let updatedCustomer = { ...originalCustomer, ...newCustomerData };

    // 3. เอาข้อมูลที่รวมร่างกันเสร็จแล้ว ไปเขียนทับลงฐานข้อมูล
    let sql = "UPDATE `customers` SET `name`=?, `phone`=?, `lat`=?, `lng`=? WHERE `id`=?";
    const [updateRows] = await conn.query(sql, [
      updatedCustomer.name,
      updatedCustomer.phone,
      updatedCustomer.lat,
      updatedCustomer.lng,
      id
    ]);
    
    res.status(200).json({ message: "อัปเดตข้อมูลสำเร็จ!" });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "อัปเดตข้อมูลไม่สำเร็จ" });
  }
});

// 4. API ลบลูกค้า (DELETE) - อ้างอิง 09-Delete.md
router.delete("/:id", async (req, res) => {
  try {
    let id = req.params.id;
    const [result] = await conn.query("DELETE FROM customers WHERE id = ?", [id]);
    const deleteResult = result as any;
    
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบลูกค้ารายนี้" });
    }
    
    res.status(200).json({ message: "ลบลูกค้าออกจากระบบแล้ว" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "ลบข้อมูลไม่สำเร็จ" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const keyword = req.query.q as string;
    if (!keyword) {
      return res.status(400).json({ error: "กรุณาระบุคำค้นหา (q)" });
    }

    // ปรับให้ใช้งานกับ schema ปัจจุบันที่มีแค่ field name เป็นชื่อเต็ม
    const sql = "SELECT * FROM customers WHERE name LIKE ? OR name LIKE ?";
    const searchValue = `%${keyword}%`;
    const [rows] = await conn.query(sql, [searchValue, searchValue]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
  }
});

// 2.3 ค้นหาลูกค้าทั้งหมดในระยะที่กำหนด ( default 1 กม.) จากพิกัด lat, lng (GET /nearby?lat=...&lng=...&distance=1)
router.get("/nearby", async (req, res) => {
  try {
    const lat = parseFiniteQueryNumber(req.query.lat);
    const lng = parseFiniteQueryNumber(req.query.lng);
    const distance =
      req.query.distance === undefined
        ? 1
        : parseFiniteQueryNumber(req.query.distance);

    if (
      lat === undefined ||
      lng === undefined ||
      !isLatitude(lat) ||
      !isLongitude(lng) ||
      distance === undefined ||
      distance < 0
    ) {
      return res.status(400).json({
        error: "กรุณาระบุ lat/lng ในช่วงที่ถูกต้อง และ distance เป็นจำนวนไม่ติดลบ",
      });
    }

    // สูตร Haversine สำหรับคำนวณระยะทางบนพื้นผิวโลก (กิโลเมตร)
    const sql = `
      SELECT *, 
        (6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(?)) * cos(radians(lat)) *
            cos(radians(lng) - radians(?)) +
            sin(radians(?)) * sin(radians(lat))
          ))
        )) AS distance
      FROM customers
      HAVING distance <= ?
      ORDER BY distance ASC
    `;

    const [rows] = await conn.query(sql, [lat, lng, lat, distance]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Nearby Search Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาตามพิกัด" });
  }
});