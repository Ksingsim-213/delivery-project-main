import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as customer } from "./controller/customer";
import { router as order } from "./controller/order";
import { router as route } from "./controller/route";

export const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.text());
app.use(express.json());

app.use("/", index);
app.use("/customer", customer);
app.use("/order", order);
app.use("/route", route);

export default app;