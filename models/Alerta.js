const mongoose = require("mongoose");

const AlertaSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true }
  },
  { timestamps: true }
);

AlertaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Alerta", AlertaSchema);
