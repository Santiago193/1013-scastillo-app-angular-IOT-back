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
// ❌ eliminar contacto específico (mínimo debe quedar 1)
router.delete("/:id", auth, async (req, res) => {
  const userId = req.user.id;

  // contar contactos activos del usuario
  const totalContacts = await EmergencyContact.countDocuments({
    userId
  });

  if (totalContacts <= 1) {
    return res.status(400).json({
      error: "Debe existir al menos un contacto de emergencia"
    });
  }

  const deleted = await EmergencyContact.findOneAndDelete({
    _id: req.params.id,
    userId
  });

  if (!deleted) {
    return res.status(404).json({ error: "Contacto no encontrado" });
  }

  res.json({ message: "Contacto eliminado correctamente" });
});

module.exports = router;
