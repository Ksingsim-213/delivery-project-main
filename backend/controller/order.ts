import express from "express";
import { conn } from "../dbconnect"; 
import { Order } from "../model/order"; 

export const router = express.Router();

// 1. API ดึงข้อมูลออเดอร์ทั้งหมด พร้อมข้อมูลลูกค้า (GET /)
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT 
        orders.id AS order_id,
        orders.quantity,
        orders.status,
        customers.id AS customer_id,
        customers.name AS customer_name,
        customers.phone AS customer_phone,
        customers.lat,
        customers.lng
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
    `;
    const [rows] = await conn.query(sql);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Database Error:", error); 
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "เกิดข้อผิดพลาดที่ไม่รู้จัก" });
    }
  }
});

// 2. API แสดงรายการสั่งซื้อทั้งหมดในระยะที่กำหนด (GET /nearby)
// *** สำคัญ: ต้องวางไว้ก่อน /:id เสมอ ***
router.get("/nearby", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const distance = parseFloat((req.query.distance as string) || "2"); // 2 กม. ตามโจทย์

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "กรุณาระบุ lat และ lng ให้ถูกต้อง" });
    }

    const sql = `
      SELECT 
        orders.id AS order_id,
        orders.quantity,
        orders.status,
        customers.id AS customer_id,
        customers.name AS customer_name,
        customers.phone AS customer_phone,
        customers.lat,
        customers.lng,
        (6371 * acos(
          cos(radians(?)) * cos(radians(customers.lat)) * 
          cos(radians(customers.lng) - radians(?)) + 
          sin(radians(?)) * sin(radians(customers.lat))
        )) AS distance
      FROM orders
      JOIN customers ON orders.customer_id = customers.id
      HAVING distance <= ?
      ORDER BY distance ASC
    `;

    const [rows] = await conn.query(sql, [lat, lng, lat, distance]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Nearby Orders Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาออเดอร์ตามระยะทาง" });
  }
});

// 3. API สร้างออเดอร์ใหม่ (POST /) - รองรับทั้ง 1 รายการ และ หลายรายการ (Array)
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // กรณีส่งมาเป็น Array (หลายรายการ)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return res.status(400).json({ error: "กรุณาส่งข้อมูลออเดอร์อย่างน้อย 1 รายการ" });
      }

      // ตรวจสอบเงื่อนไขจำนวนกล่อง (ไม่เกิน 3 กล่องต่อออเดอร์)
      const isInvalidQuantity = data.some((item: Order) => item.quantity > 3);
      if (isInvalidQuantity) {
        return res.status(400).json({ error: "มีรายการที่สั่งซื้อเกิน 3 กล่อง (จำกัดไม่เกิน 3 กล่องต่อรายการ)" });
      }

      // สร้าง SQL Insert แบบหลายรายการ
      const placeholders = data.map(() => "(?, ?)").join(", ");
      const sql = `INSERT INTO \`orders\` (\`customer_id\`, \`quantity\`) VALUES ${placeholders}`;
      const values = data.flatMap((o: Order) => [o.customer_id, o.quantity]);

      const [result] = await conn.query(sql, values);
      const insertResult = result as any;

      return res.status(201).json({
        message: `เพิ่มรายการสั่งซื้อสำเร็จ ${insertResult.affectedRows} รายการ!`,
      });
    }

    // กรณีส่งมาเป็น Object (1 รายการ)
    let order: Order = data; 
    
    if (order.quantity > 3) {
      return res.status(400).json({ error: "ลูกค้า 1 ราย สั่งได้ไม่เกิน 3 กล่องครับ" });
    }
    
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

// 3.1 API จำลองข้อมูลออเดอร์ 20-30 รายการ โดยไม่ต้องแก้ schema (ใช้ข้อมูลลูกค้าที่มีอยู่)
router.post("/mock", async (req, res) => {
  try {
    const [customerRows] = await conn.query("SELECT id FROM customers ORDER BY id ASC");
    const customers = customerRows as { id: number }[];

    if (!customers || customers.length === 0) {
      return res.status(400).json({
        error: "ยังไม่มีข้อมูลลูกค้าในฐานข้อมูล ต้องสร้างลูกค้าให้เรียบร้อยก่อนจึงจะ mock ออเดอร์ได้",
      });
    }

    const mockOrders = Array.from({ length: 20 }, (_, index) => {
      const customer = customers[(index % customers.length)]!;
      return {
        customer_id: customer.id,
        quantity: (index % 3) + 1,
        status: ["pending", "processing", "done"][index % 3],
      };
    });

    const placeholders = mockOrders.map(() => "(?, ?, ?)").join(", ");
    const sql = `INSERT INTO \`orders\` (\`customer_id\`, \`quantity\`, \`status\`) VALUES ${placeholders}`;
    const values = mockOrders.flatMap((item) => [item.customer_id, item.quantity, item.status]);

    const [result] = await conn.query(sql, values);
    const insertResult = result as any;

    return res.status(201).json({
      message: `สร้างข้อมูลออเดอร์จำลองสำเร็จ ${insertResult.affectedRows} รายการ (ไม่มีการเปลี่ยน schema)`,
      total: insertResult.affectedRows,
    });
  } catch (error) {
    console.error("Mock Order Error:", error);
    res.status(500).json({ error: "สร้างข้อมูลออเดอร์จำลองไม่สำเร็จ" });
  }
});

// 4. API ล้าง (ลบทั้งหมด) รายการสั่งซื้อ (DELETE /clear-all)
// *** สำคัญ: ต้องวางไว้ก่อน DELETE /:id เสมอ เพื่อไม่ให้ถูกมองว่า 'clear-all' คือ :id ***
router.delete("/clear-all", async (req, res) => {
  try {
    // ลบข้อมูลทั้งหมด และรีเซ็ตตัวนับ Auto Increment
    await conn.query("DELETE FROM orders");
    await conn.query("ALTER TABLE orders AUTO_INCREMENT = 1");

    res.status(200).json({
      message: "ล้างรายการสั่งซื้อทั้งหมด และรีเซ็ต ID เริ่มต้นที่ 1 เรียบร้อยแล้ว!",
    });
  } catch (error) {
    console.error("Clear Orders Error:", error);
    res.status(500).json({ error: "ล้างรายการสั่งซื้อไม่สำเร็จ" });
  }
});

// 5. API แก้ไขออเดอร์ (PUT /:id) - แก้ไขจำนวนกล่อง
router.put("/:id", async (req, res) => {
  try {
    let id = req.params.id;
    let newOrderData: Partial<Order> = req.body;
    
    if (newOrderData.quantity && newOrderData.quantity > 3) {
      return res.status(400).json({ error: "ลูกค้า 1 ราย สั่งได้ไม่เกิน 3 กล่องครับ" });
    }
    
    const [rows] = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
    const result = rows as Order[];

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "ไม่พบออเดอร์นี้" });
    }

    // ใส่เครื่องหมาย ! เพื่อยืนยันกับ TypeScript ว่ามีข้อมูลแน่นอน
    let originalOrder = result[0]!;
    let updatedOrder = {
      customer_id: newOrderData.customer_id ?? originalOrder.customer_id,
      quantity: newOrderData.quantity ?? originalOrder.quantity,
      status: newOrderData.status ?? originalOrder.status
    };

    let sql = "UPDATE `orders` SET `customer_id`=?, `quantity`=?, `status`=? WHERE `id`=?";
    await conn.query(sql, [
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

// 6. API ลบออเดอร์แบบรายตัว (DELETE /:id)
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