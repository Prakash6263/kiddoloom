import express from 'express';
import "dotenv/config.js"
import { connectDB } from './config/db.js';
import rootRouter from './routes/root.routes.js';
import morgan from 'morgan';
import cors from 'cors';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from "path";
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import initChat from './sockets/chat.js';

connectDB();

//
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const port = process.env.PORT || 5001;
const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors());
app.use(express.static(path.join(__dirname, "view")));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));

app.use("/api/v1", express.static("public"))

app.use("/api/v1", rootRouter);
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Health check endpoint — used by Render to detect server crashes and auto-restart
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get("/api/v1/about", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "about.html"));
});
app.get("/api/v1/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "terms.html"));
});
app.get("/api/v1/privacyPolicy", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "privacyPolicy.html"));
});
app.get("/api/v1/faq", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "faq.html"));
});
app.get("/api/v1/help&support", (req, res) => {
  res.sendFile(path.join(__dirname, "view", "help&support.html"));
});

// Catch-all 404 — always return JSON so mobile app never gets HTML
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler — return JSON instead of HTML error pages
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

// Initialize chat socket handlers
initChat(io);

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Auto-restart: log unhandled errors instead of silently dying
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception — server will restart:', err);
  process.exit(1); // Render detects exit and auto-restarts the service
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Render detects exit and auto-restarts the service
});