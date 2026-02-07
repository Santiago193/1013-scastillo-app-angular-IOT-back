const mongoose = require("mongoose");

const EmergencyContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  nombre: {
    type: String,
    default: "Contacto de emergencia"
  },

  telefonoEmergencia: {
    type: String,
    default: "0000000000"
  },

  telegramChatId: {
    type: String,
    default: "PENDING"
  },

  activo: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model(
  "EmergencyContact",
  EmergencyContactSchema
);
