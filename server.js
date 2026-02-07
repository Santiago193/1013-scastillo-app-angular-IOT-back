const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const deviceRoutes = require("./routes/device.routes");
const emergencyRoutes = require("./routes/emergency.routes");
const adminRoutes = require("./routes/admin.routes");

const { deviceOwnerMap, loadDevices } = require("./realtime/deviceMap");

const Alert = require("./models/Alert");
const EmergencyContact = require("./models/EmergencyContact");
const { sendTelegramMessage } = require("./utils/telegram");

const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());



require("./utils/telegram");

// 🔌 CONECTAR BD Y CARGAR DEVICES
connectDB().then(loadDevices);

// ─── HTTP ROUTES ───
app.use("/auth", authRoutes);
app.use("/devices", deviceRoutes);
app.use("/emergency", emergencyRoutes);
app.use("/admin", adminRoutes);

// ─── WEBSOCKET ───
io.on("connection", (socket) => {
  console.log("🟢 Socket conectado:", socket.id);

  // FRONTEND se autentica
  const token = socket.handshake.auth?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      socket.join(userId);
      console.log("👤 Usuario en room:", userId);
    } catch {
      console.log("❌ Token inválido");
      socket.disconnect();
      return;
    }
  }
  socket.on("request-emergency-contacts", async ({ deviceId }) => {
  const userId = deviceOwnerMap[deviceId];
  if (!userId) return;

  const contacts = await EmergencyContact.find({
    userId,
    activo: true
  });

  // SOLO lo que el ESP32 necesita
  socket.emit("emergency-contacts", {
    deviceId,
    phones: contacts.map(c => c.telefonoEmergencia)
  });
});


  // ESTADO GENERAL
  socket.on("device-data", (data) => {
    const userId = deviceOwnerMap[data.deviceId];
    if (!userId) return;
    io.to(userId).emit("device-update", data);
  });

  // GPS
  socket.on("gps-data", (data) => {
    const userId = deviceOwnerMap[data.deviceId];
    if (!userId) return;
    io.to(userId).emit("gps-update", data);
  });

  // ACELERÓMETRO
  socket.on("accelerometer-data", (data) => {
    const userId = deviceOwnerMap[data.deviceId];
    if (!userId) return;
    io.to(userId).emit("accelerometer-update", data);
  });

  // GIROSCOPIO
  socket.on("gyroscope-data", (data) => {
    const userId = deviceOwnerMap[data.deviceId];
    if (!userId) return;
    io.to(userId).emit("gyroscope-update", data);
  });

  // 🚨 ALERTAS
  socket.on("alert-data", async (data) => {
    try {
      const userId = deviceOwnerMap[data.deviceId];
      if (!userId) return;

      const alert = await Alert.create({
        userId,
        deviceId: data.deviceId,
        tipo: data.tipo,
        alerta: data.alerta,
        deltaAccel: data.deltaAccel,
        aceleracionTotal: data.aceleracionTotal,
        ubicacion: data.ubicacion,
        mensaje: data.mensaje,
        gps: data.gps,
        acelerometro: data.acelerometro,
        giroscopio: data.giroscopio
      });

      const contacts = await EmergencyContact.find({
        userId,
        activo: true,
        telegramChatId: { $ne: "PENDING" }
      });

      for (const contact of contacts) {
        await sendTelegramMessage(
          contact.telegramChatId,
`🚨 *ALERTA DEL DISPOSITIVO*
📟 ${data.deviceId}
📍 ${data.ubicacion}
🧠 ${data.mensaje}
⏰ ${new Date(alert.createdAt).toLocaleString()}`
        );
      }

      io.to(userId).emit("alert-update", {
        deviceId: alert.deviceId,
        tipo: alert.tipo,
        alerta: alert.alerta,
        deltaAccel: alert.deltaAccel,
        aceleracionTotal: alert.aceleracionTotal,
        ubicacion: alert.ubicacion,
        mensaje: alert.mensaje,
        createdAt: alert.createdAt
      });

    } catch (err) {
      console.error("❌ Error en alert-data:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Backend + WebSocket en http://localhost:" + PORT);
});

