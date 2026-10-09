import express from "express";
import { conn } from "../dbconnect"; 
import { Order } from "../model/order"; 

export const router = express.Router();

// 1. API ดึงข้อมูลออเดอร์ทั้งหมด (GET)
router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query("SELECT * FROM orders");
    let orders = rows as Order[];
    res.status(200).json(orders);
  } catch (error) {
    console.error("Database Error:", error); 
    if (error instanceof Error) {
        res.status(500).json({ error: error.message });
    } else {
        res.status(500).json({ error: "เกิดข้อผิดพลาดที่ไม่รู้จัก" });
    }
  }
});

// 2. API สร้างออเดอร์ใหม่ (POST)
router.post("/", async (req, res) => {
  try {
    let order: Order = req.body; 
    
    // ดักจับเงื่อนไขตามโจทย์: ลูกค้าสั่งได้ไม่เกิน 3 กล่อง
    if (order.quantity > 3) {
        return res.status(400).json({ error: "ลูกค้า 1 ราย สั่งได้ไม่เกิน 3 กล่องครับ" });
    }
    
    // status ค่าเริ่มต้นเป็น 'pending' อยู่แล้วตามโครงสร้างตาราง
    let sql = "INSERT INTO `orders`(`customer_id`, `quantity`) VALUES (?,?)";
      
    const [result] = await conn.query(sql, [
      order.customer_id,
      order.quantity
    ]);
    
    const insertResult = result as any;
    
    res.status(201).json({
      message: "สร้างออเดอร์เรียบร้อยแล้ว!",
      order_id: insertResult.insertId 
    });
  } catch (error) {
    console.error("Insert Error:", error);
    res.status(500).json({ error: "บันทึกข้อมูลออเดอร์ไม่สำเร็จ" });
  }
});

// 3. API แก้ไขออเดอร์ (PUT) - เผื่อลูกค้าขอเปลี่ยนจำนวนกล่อง
router.put("/:id", async (req, res) => {
  try {
    let id = req.params.id;
    let newOrderData: Partial<Order> = req.body;
    
    // เช็คว่าจำนวนกล่องที่แก้เกิน 3 ไหม
    if (newOrderData.quantity && newOrderData.quantity > 3) {
         return res.status(400).json({ error: "ลูกค้า 1 ราย สั่งได้ไม่เกิน 3 กล่องครับ" });
    }
    
    // ดึงข้อมูลเก่า
    const [rows] = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
    const result = rows as Order[];

    if (result.length === 0) {
      return res.status(404).json({ error: "ไม่พบออเดอร์นี้" });
    }

    // รวมข้อมูล
    let originalOrder = result[0];
    let updatedOrder = { ...originalOrder, ...newOrderData };

    // อัปเดตลงฐานข้อมูล
    let sql = "UPDATE `orders` SET `customer_id`=?, `quantity`=?, `status`=? WHERE `id`=?";
    const [updateRows] = await conn.query(sql, [
      updatedOrder.customer_id,
      updatedOrder.quantity,
      updatedOrder.status,
      id
    ]);
    
    res.status(200).json({ message: "อัปเดตออเดอร์สำเร็จ!" });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "อัปเดตข้อมูลออเดอร์ไม่สำเร็จ" });
  }
});

// 4. API ลบออเดอร์ (DELETE) - เผื่อลูกค้าแคนเซิล
router.delete("/:id", async (req, res) => {
  try {
    let id = req.params.id;
    const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [id]);
    const deleteResult = result as any;
    
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบออเดอร์นี้" });
    }
    
    res.status(200).json({ message: "ลบออเดอร์ออกจากระบบแล้ว" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "ลบข้อมูลออเดอร์ไม่สำเร็จ" });
  }
});