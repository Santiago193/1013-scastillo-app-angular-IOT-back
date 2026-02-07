const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const EmergencyContact = require("../models/EmergencyContact");

const router = express.Router();

// REGISTER (admin o sistema)
router.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  if (!role || !["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "role debe ser user o admin" });
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(400).json({ error: "Email ya existe" });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hash,
    role
  });

  // 🔥 CREAR CONTACTOS DE EMERGENCIA POR DEFECTO
  await EmergencyContact.insertMany([
    {
      userId: user._id,
      nombre: "Contacto principal",
      telefonoEmergencia: "0000000000",
      telegramChatId: "PENDING"
    },
    {
      userId: user._id,
      nombre: "Contacto secundario",
      telefonoEmergencia: "0000000000",
      telegramChatId: "PENDING"
    }
  ]);

  res.json({ message: "Usuario creado", role });
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.sendStatus(401);

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.sendStatus(401);

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token });
});

module.exports = router;
