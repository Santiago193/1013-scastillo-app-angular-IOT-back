const mongoose = require("mongoose");

const DatoSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true }
  },
  { timestamps: true }
);

DatoSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Dato", DatoSchema);
