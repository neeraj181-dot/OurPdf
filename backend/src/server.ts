import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { aiRouter } from "./routes/ai.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health Check & Metrics
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Easy PDF Node.js API", timestamp: new Date().toISOString() });
});

app.all(["/api/metrics", "/api/metrics/"], (req, res) => {
  res.json({ status: "ok" });
});


// AI Routes
app.use("/api/ai", aiRouter);

app.listen(PORT, () => {
  console.log(`🚀 Easy PDF Backend Server running on http://localhost:${PORT}`);
});
