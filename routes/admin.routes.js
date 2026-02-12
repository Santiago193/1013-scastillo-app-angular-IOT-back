const router = require("express").Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const ExcelJS = require("exceljs");

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const User = require("../models/User");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const EmergencyContact = require("../models/EmergencyContact");

// ✅ 1) Listar usuarios (para selector en dashboard)
router.get("/users", auth, adminOnly, async (req, res) => {
  const users = await User.find({}, { email: 1, role: 1, createdAt: 1 })
    .sort({ createdAt: -1 });

  res.json(users);
});

// ✅ 2) Alertas (con filtros: userId, deviceId, tipo, fecha)
router.get("/alerts", auth, adminOnly, async (req, res) => {
  const {
    userId,
    deviceId,
    tipo,
    from, // YYYY-MM-DD
    to,   // YYYY-MM-DD
    limit = 100,
    skip = 0
  } = req.query;

  const filter = {};
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
  if (deviceId) filter.deviceId = deviceId;
  if (tipo) filter.tipo = tipo;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from + "T00:00:00.000Z");
    if (to) filter.createdAt.$lte = new Date(to + "T23:59:59.999Z");
  }

  const alerts = await Alert.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 500))
    .skip(Number(skip))
    .lean();

  res.json(alerts);
});

// ✅ 3) Dispositivos (por usuario) para ver a quién pertenece cada ESP32
router.get("/devices", auth, adminOnly, async (req, res) => {
  const { userId } = req.query;

  const filter = {};
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);

  const devices = await Device.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  res.json(devices);
});

// ✅ 4) Resumen para dashboard (KPIs + top usuarios)
// - total alertas
// - alertas hoy
// - alertas últimos 7 días
// - top usuarios por alertas
router.get("/dashboard/summary", auth, adminOnly, async (req, res) => {
  const now = new Date();

  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);

  const start7 = new Date(now);
  start7.setUTCDate(start7.getUTCDate() - 7);
  start7.setUTCHours(0, 0, 0, 0);

  const [totalAlerts, todayAlerts, last7Alerts, topUsers] = await Promise.all([
    Alert.countDocuments({}),
    Alert.countDocuments({ createdAt: { $gte: startToday } }),
    Alert.countDocuments({ createdAt: { $gte: start7 } }),

    Alert.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: "$_id",
          count: 1,
          email: "$user.email",
          role: "$user.role"
        }
      }
    ])
  ]);

  res.json({
    totalAlerts,
    todayAlerts,
    last7Alerts,
    topUsers
  });
});

// ✅ 5) Serie por día (para gráfica)
// devuelve: [{ date: "2026-02-01", count: 5 }, ...]
router.get("/dashboard/alerts-per-day", auth, adminOnly, async (req, res) => {
  const { days = 14, userId } = req.query;

  const d = Number(days);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - d);
  start.setUTCHours(0, 0, 0, 0);

  const match = { createdAt: { $gte: start } };
  if (userId) match.userId = new mongoose.Types.ObjectId(userId);

  const series = await Alert.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: "$_id.y" },
            "-",
            {
              $cond: [
                { $lt: ["$_id.m", 10] },
                { $concat: ["0", { $toString: "$_id.m" }] },
                { $toString: "$_id.m" }
              ]
            },
            "-",
            {
              $cond: [
                { $lt: ["$_id.d", 10] },
                { $concat: ["0", { $toString: "$_id.d" }] },
                { $toString: "$_id.d" }
              ]
            }
          ]
        },
        count: 1
      }
    }
  ]);

  res.json(series);
});

// ✏️ actualizar usuario (admin)
router.put("/users/:id", auth, adminOnly, async (req, res) => {
  const { role, password } = req.body;

  const updateData = {};

  // actualizar rol si se envía
  if (role) {
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role inválido" });
    }
    updateData.role = role;
  }

  // actualizar contraseña si se envía
  if (password) {
    const bcrypt = require("bcrypt");
    updateData.password = await bcrypt.hash(password, 10);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  res.json({
    message: "Usuario actualizado",
    user
  });
});

// ❌ eliminar usuario completo (admin)
router.delete("/users/:id", auth, adminOnly, async (req, res) => {
  const userId = req.params.id;

  // evitar que admin se elimine a sí mismo
  if (req.user.id === userId) {
    return res.status(400).json({
      error: "No puedes eliminar tu propio usuario"
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  // eliminar todo lo relacionado
  await EmergencyContact.deleteMany({ userId });
  await Device.deleteMany({ userId });
  await Alert.deleteMany({ userId });

  await User.findByIdAndDelete(userId);

  res.json({ message: "Usuario eliminado correctamente" });
});
// ✏️ actualizar dispositivo (admin)
router.put("/devices/:id", auth, adminOnly, async (req, res) => {
  const { nombre, userId, deviceId } = req.body;

  const updateData = {};

  // actualizar nombre
  if (nombre) updateData.nombre = nombre;

  // actualizar dueño
  if (userId) {
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(400).json({ error: "Usuario no válido" });
    }
    updateData.userId = userId;
  }

  // actualizar deviceId
  if (deviceId) {
    const existing = await Device.findOne({ deviceId });
    if (existing && existing._id.toString() !== req.params.id) {
      return res.status(400).json({
        error: "Ese deviceId ya está registrado"
      });
    }
    updateData.deviceId = deviceId;
  }

  const device = await Device.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!device) {
    return res.status(404).json({ error: "Dispositivo no encontrado" });
  }

  res.json({
    message: "Dispositivo actualizado",
    device
  });
});

// ❌ eliminar dispositivo (admin)
router.delete("/devices/:id", auth, adminOnly, async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return res.status(404).json({ error: "Dispositivo no encontrado" });
  }

  // eliminar del mapa en memoria si existe
  try {
    const { deviceOwnerMap } = require("../realtime/deviceMap");
    delete deviceOwnerMap[device.deviceId];
  } catch (err) {
    // si no existe el mapa, no rompe nada
  }

  await Device.findByIdAndDelete(req.params.id);

  res.json({ message: "Dispositivo eliminado correctamente" });
});

// 👑 admin actualiza contraseña de cualquier usuario
router.put("/users/:id/password", auth, adminOnly, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      error: "Debe enviar una nueva contraseña"
    });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { password: hash },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      error: "Usuario no encontrado"
    });
  }

  res.json({
    message: "Contraseña actualizada por admin"
  });
});
//Exportar datos (admin)
router.post("/export", auth, adminOnly, async (req, res) => {
  const { collection, filters, fields } = req.body;

  let Model;

  switch (collection) {
    case "users":
      Model = require("../models/User");
      break;
    case "devices":
      Model = require("../models/Device");
      break;
    case "alerts":
      Model = require("../models/Alert");
      break;
    case "contacts":
      Model = require("../models/EmergencyContact");
      break;
    default:
      return res.status(400).json({ error: "Colección no válida" });
  }

  // 🔐 CAMPOS PERMITIDOS POR COLECCIÓN
  const allowedFields = {
    users: ["email", "role", "createdAt"],
    devices: ["deviceId", "nombre", "userId", "createdAt"],
    alerts: ["deviceId", "userId", "tipo", "mensaje", "createdAt"],
    contacts: ["nombre", "telefonoEmergencia", "telegramChatId", "activo", "createdAt"]
  };

  // validar campos
  const validFields = (fields || []).filter(f =>
    allowedFields[collection].includes(f)
  );

  if (validFields.length === 0) {
    return res.status(400).json({
      error: "No se seleccionaron campos válidos"
    });
  }

  // 🔎 construir filtros
  const query = {};

  if (filters?.userId) {
    query.userId = new mongoose.Types.ObjectId(filters.userId);
  }

  if (filters?.deviceId) {
    query.deviceId = filters.deviceId;
  }

  if (filters?.role && collection === "users") {
    query.role = filters.role;
  }

  if (filters?.from || filters?.to) {
    query.createdAt = {};
    if (filters.from)
      query.createdAt.$gte = new Date(filters.from);
    if (filters.to)
      query.createdAt.$lte = new Date(filters.to);
  }

  const data = await Model.find(query).lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(collection);

  worksheet.columns = validFields.map(field => ({
    header: field,
    key: field,
    width: 20
  }));

  data.forEach(item => {
    const row = {};
    validFields.forEach(field => {
      row[field] = item[field] ?? "";
    });
    worksheet.addRow(row);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${collection}.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});
module.exports = router;
