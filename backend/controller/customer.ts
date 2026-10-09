import express from "express";
import { conn } from "../dbconnect"; 
import { Customer } from "../model/customer"; 

export const router = express.Router();

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

      // สร้าง Query SQL แบบไดนามิก (?,?,?,?), (?,?,?,?)...
      const placeholders = data.map(() => "(?, ?, ?, ?)").join(", ");
      const sql = `INSERT INTO \`customers\` (\`name\`, \`phone\`, \`lat\`, \`lng\`) VALUES ${placeholders}`;
      
      // ดึงค่าของทุกคนมารวมเป็น Array 1 มิติ
      const values = data.flatMap((c: Customer) => [c.name, c.phone, c.lat, c.lng]);

      const [result] = await conn.query(sql, values);
      const insertResult = result as any;

      return res.status(201).json({
        message: `เพิ่มลูกค้าใหม่สำเร็จ ${insertResult.affectedRows} คน!`,
      });
    }

    // กรณีส่งมาเป็น Object คนเดียว
    let customer: Customer = data;
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
    let newCustomerData: Partial<Customer> = req.body; // Partial หมายถึง "รับมาแค่บางส่วนก็ได้"
    
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

    const sql = "SELECT * FROM customers WHERE name LIKE ?";
    const [rows] = await conn.query(sql, [`%${keyword}%`]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
  }
});

// 2.3 ค้นหาลูกค้าทั้งหมดในระยะที่กำหนด ( default 1 กม.) จากพิกัด lat, lng (GET /nearby?lat=...&lng=...&distance=1)
router.get("/nearby", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const distance = parseFloat((req.query.distance as string) || "1"); // ถ้าไม่ระบุ จะใช้ 1 km ตามโจทย์

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "กรุณาระบุ lat และ lng ให้ถูกต้อง" });
    }

    // สูตร Haversine สำหรับคำนวณระยะทางบนพื้นผิวโลก (กิโลเมตร)
    const sql = `
      SELECT *, 
        (6371 * acos(
          cos(radians(?)) * cos(radians(lat)) * 
          cos(radians(lng) - radians(?)) + 
          sin(radians(?)) * sin(radians(lat))
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