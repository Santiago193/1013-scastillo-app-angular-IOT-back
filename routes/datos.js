const express = require("express");
const router = express.Router();
const Dato = require("../models/Dato");

router.post("/", async (req, res) => {
  try {
    const nuevo = new Dato({
      data: req.body
    });

    await nuevo.save();

    res.json({
      mensaje: "Datos guardados",
      registro: nuevo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { ultimo } = req.query;

    // 👉 Solo último dato
    if (ultimo) {
      const registro = await Dato
        .findOne()
        .sort({ createdAt: -1 });

      if (!registro) {
        return res.status(404).json({ mensaje: "No hay datos" });
      }

      return res.json(registro);
    }

    // 👉 Histórico completo
    const registros = await Dato
      .find()
      .sort({ createdAt: -1 });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
