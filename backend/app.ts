import express from "express";
import cors from "cors"; // นำเข้า CORS
import { router as index } from "./controller/index";
import { router as customer } from "./controller/customer";
import { router as order } from "./controller/order";
import { router as route } from "./controller/route";

export const app = express();

// 1. เปิดประตู CORS อนุญาตทุกคน (*)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2. แปลงข้อมูล
app.use(express.text());
app.use(express.json());

// 3. จัดการเส้นทาง
app.use("/", index);
app.use("/customer", customer);
app.use("/order", order);
app.use("/route", route);