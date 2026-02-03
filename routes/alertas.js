const express = require("express");
const router = express.Router();
const Alerta = require("../models/Alerta");
const axios = require("axios");


const TELEGRAM_TOKEN = "8284182479:AAHynecDTw1Mpr4sDwcVYvg_ZQbMkA0xQAc";
const CHAT_ID = "1313182620";

async function enviarTelegram(data) {
  try {
    const mensaje = `
🚨 *ALERTA DE CHOQUE*
📦 Datos recibidos:
\`\`\`
${JSON.stringify(data, null, 2)}
\`\`\`
🕒 ${new Date().toLocaleString()}
`;

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: mensaje,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    console.error("❌ Error enviando a Telegram:", error.message);
  }
}

router.post("/", async (req, res) => {
  try {
    const nuevo = new Alerta({
      data: req.body
    });

    await nuevo.save();
       enviarTelegram(req.body);
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
