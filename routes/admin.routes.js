const router = require("express").Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");

const User = require("../models/User");
const Alert = require("../models/Alert");
const Device = require("../models/Device");

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

module.exports = router;
