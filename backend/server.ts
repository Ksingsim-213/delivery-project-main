//หน้าที่ของมันคือเปิดประตูคอยรับข้อมูลจากผู้ใช้ผ่าน URL (หรือ API) เพื่อให้ระบบหลังบ้าน (Backend) ตื่นขึ้นมาทำงานและตอบกลับไปได้
import http from "http";
import app from "./app";

const port = process.env.PORT || 5000;
const server = http.createServer(app);

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Server is started on port ${port}`);
  });
}

export default app;

