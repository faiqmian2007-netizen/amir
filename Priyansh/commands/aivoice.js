const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "aivoice",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Mian Amir",
  description: "Generate AI voice using ElevenLabs and send as audio file",
  commandCategory: "AI",
  usages: "aivoice [text]",
  cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
  const threadID = event.threadID;
  const messageID = event.messageID;

  const text = args.join(" ");
  if (!text) {
    return api.sendMessage("📢 Please provide text to convert to voice.\nExample: .aivoice Numan tum so jao", threadID, messageID);
  }

  // ElevenLabs config
  const apiKey = "sk_71b2a8b07bcf9d22961e2b136d72b113b733dd0a3b67ff14"; // Your key
  const voiceId = "rCmVtv8cYU60uhlsOo1M"; // Female voice
  const modelId = "eleven_multilingual_v2"; // Supports Hindi

  const outputPath = path.join(__dirname, "aivoice.mp3");
  api.sendMessage("🔄 Generating voice, please wait...", threadID, messageID);

  try {
    const res = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: modelId,
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.9,
          style: 0.25
        }
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }
    );

    fs.writeFileSync(outputPath, res.data);
    return api.sendMessage(
      { body: "✅ Here is your AI voice:", attachment: fs.createReadStream(outputPath) },
      threadID,
      () => fs.unlinkSync(outputPath), // clean up after sending
      messageID
    );
  } catch (err) {
    console.error("❌ Voice generation failed:", err.message);
    return api.sendMessage("⚠️ Voice generation failed. Try again later.", threadID, messageID);
  }
};