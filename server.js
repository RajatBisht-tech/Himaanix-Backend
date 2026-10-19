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

    const shutdown = (signal) => {
      console.log(`${signal} received. Closing server...`);

      server.close(() => {
        console.log("Server closed successfully.");
        process.exit(0);
      });

      // Avoid hanging indefinitely during shutdown.
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();