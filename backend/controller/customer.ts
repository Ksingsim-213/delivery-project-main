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

// 2. API เพิ่มข้อมูลลูกค้าใหม่ (POST)
router.post("/", async (req, res) => {
  try {
    // รับข้อมูลจากที่ Angular (หรือ Bruno) ส่งมา
    let customer: Customer = req.body; 
    
    let sql = "INSERT INTO `customers`(`name`, `phone`, `lat`, `lng`) VALUES (?,?,?,?)";
      
    const [result] = await conn.query(sql, [
      customer.name,
      customer.phone,
      customer.lat,
      customer.lng
    ]);
    
    const insertResult = result as any;
    
    // ตอบกลับไปว่าสร้างสำเร็จ (201 Created) พร้อมส่ง ID ใหม่กลับไป
    res.status(201).json({
      message: "เพิ่มลูกค้าใหม่เรียบร้อยแล้ว!",
      customer_id: insertResult.insertId 
    });
  } catch (error) {
    console.error("Insert Error:", error);
    res.status(500).json({ error: "บันทึกข้อมูลลูกค้าไม่สำเร็จ" });
  }
});

// ลบ router.put อันเก่าออก แล้วเอาอันนี้ไปวางแทนนะครับ
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