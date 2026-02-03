const mongoose = require("mongoose");

const DispositivoSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dispositivo", DispositivoSchema);
