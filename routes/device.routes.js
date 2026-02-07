const router = require("express").Router();
const Device = require("../models/Device");
const auth = require("../middleware/auth");

// SOLO ADMIN
router.post("/register", auth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.sendStatus(403);
  }

const { deviceOwnerMap } = require("../realtime/deviceMap");

const device = await Device.create({
  deviceId,
  nombre,
  userId
});

// 🔥 ACTUALIZAR MAPA EN MEMORIA (SIN REINICIAR)
deviceOwnerMap[deviceId] = userId.toString();

res.json({
  message: "Dispositivo registrado por admin",
  device
});

  
});
// ver MIS dispositivos
router.get("/me", auth, async (req, res) => {
  const devices = await Device.find({ userId: req.user.id });
  res.json(devices);
});


module.exports = router;
