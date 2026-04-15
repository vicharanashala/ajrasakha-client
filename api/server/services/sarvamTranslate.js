const axios = require("axios");

const API_KEY = process.env.SARVAM_API_KEY;

async function translateText(text, targetLang) {
  try {
    const response = await axios.post(
      "https://api.sarvam.ai/translate",
      {
        text: text,
        target_language: targetLang
      },
      {
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.translated_text;

  } catch (error) {
    console.error("Sarvam Error:", error.message);
    return text; // fallback
  }
}

module.exports = { translateText };