const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  deviceId: {
    type: String,
    required: true
  },

  tipo: String, // alerta, alerta_cancelada
  alerta: Boolean,

  deltaAccel: Number,
  aceleracionTotal: Number,

  ubicacion: String,
  mensaje: String,

  // snapshot sensores
  gps: {
    fix: Boolean,
    lat: Number,
    lng: Number
  },

  acelerometro: {
    x: Number,
    y: Number,
    z: Number
  },

  giroscopio: {
    pitch: Number,
    roll: Number
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Alert", AlertSchema);
