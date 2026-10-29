import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as customer } from "./controller/customer";
import { router as order } from "./controller/order";
import { router as route } from "./controller/route";

export const app = express();
//มันคือ "กฎการอนุญาตให้หน้าบ้านเข้ามาคุยกับหลังบ้าน" นั่นเองครับ!
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
//น "รับเข้ามา แล้วแปลงให้อ่านออกด้วย"
app.use(express.text());
app.use(express.json());

app.use("/", index);
app.use("/customer", customer);
app.use("/order", order);
app.use("/route", route);

export default app;
//ถ้าอยากรู้ว่าหน้าบ้าน พิมพ์อะไรส่งมาในไส้ใน (Body) ก็แค่สั่ง req.body.ชื่อฟิลด์ เพื่อหยิบข้อมูลนั้นออกมาใช้งานต่อในโค้ดได้เลยครับ