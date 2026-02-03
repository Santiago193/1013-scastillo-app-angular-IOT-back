const express = require("express");
const router = express.Router();
const Dispositivo = require("../models/Dispositivo");

// POST dinámico
router.post("/", async (req, res) => {
  try {
    const nuevo = new Dispositivo({
      data: req.body
    });

    await nuevo.save();

    res.json({
      mensaje: "Dispositivo guardado correctamente",
      registro: nuevo
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET → solo último estado del dispositivo
router.get("/", async (req, res) => {
  try {
    const ultimo = await Dispositivo
      .findOne()
      .sort({ createdAt: -1 });

    if (!ultimo) {
      return res.status(404).json({ mensaje: "No hay registros" });
    }

    res.json(ultimo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
