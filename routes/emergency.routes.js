const router = require("express").Router();
const EmergencyContact = require("../models/EmergencyContact");
const { sendTelegramMessage } = require("../utils/telegram");
const auth = require("../middleware/auth");

// 📋 listar MIS contactos
router.get("/me", auth, async (req, res) => {
  const contacts = await EmergencyContact.find({
    userId: req.user.id
  });
  res.json(contacts);
});

// ✏️ editar contacto específico
router.put("/:id", auth, async (req, res) => {
  const { nombre, telefonoEmergencia, telegramChatId, activo } = req.body;

  const contact = await EmergencyContact.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { nombre, telefonoEmergencia, telegramChatId, activo },
    { new: true }
  );

  res.json(contact);
});

module.exports = router;
