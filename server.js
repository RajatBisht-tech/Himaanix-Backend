import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/database.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`Himaanix API running on port ${PORT}`);
    });

    const shutdown = () => server.close(() => process.exit(0));
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
