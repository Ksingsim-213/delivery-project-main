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

