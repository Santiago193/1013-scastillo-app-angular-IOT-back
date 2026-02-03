const express = require("express");
const router = express.Router();
const Alerta = require("../models/Alerta");

// POST → guardar alerta
router.post("/", async (req, res) => {
  try {
    const nuevo = new Alerta({
      data: req.body
    });

    await nuevo.save();

    res.json({
      mensaje: "Alerta guardada",
      registro: nuevo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET → historial o última alerta
router.get("/", async (req, res) => {
  try {
    const { ultimo } = req.query;

    // 👉 Solo última alerta
    if (ultimo) {
      const alerta = await Alerta
        .findOne()
        .sort({ createdAt: -1 });

      if (!alerta) {
        return res.status(404).json({ mensaje: "No hay alertas" });
      }

      return res.json(alerta);
    }

    // 👉 Historial completo
    const registros = await Alerta
      .find()
      .sort({ createdAt: -1 });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
