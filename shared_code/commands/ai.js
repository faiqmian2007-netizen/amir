const axios = require("axios");
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai",
  version: "3.5.0",
  hasPermssion: 0,
  credits: "Mian Amir",
  description: "AI text reply converted to voice using ElevenLabs",
  commandCategory: "chatbots",
  usages: "ai [message]",
  cooldowns: 3
};

// Local JSON data file to store user chat history
const DATA_FILE = path.join(__dirname, "ai_data.json");
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function getUserName(api, senderID) {
  try {
    const info = await api.getUserInfo(senderID);
    return info[senderID]?.name || "User";
  } catch {
    return "User";
  }
}

// ElevenLabs voice generator
async function generateVoiceFromText(text, api, threadID, messageID) {
  const apiKey = "sk_acee6b1482841911e64f146538080e88dfd4e87bfaed666b"; // ✅ Your ElevenLabs Key
  const voiceId = "ulZgFXalzbrnPUGQGs0S"; // ✅ Hindi/Punjabi friendly voice
  const modelId = "eleven_multilingual_v2"; // ✅ Supports Hindi + Punjabi

  const outputPath = path.join(__dirname, "aivoice.mp3");

  try {
    const res = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.9,
          style: 0.3
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
      { body: "", attachment: fs.createReadStream(outputPath) },
      threadID,
      () => fs.unlinkSync(outputPath),
      messageID
    );
  } catch (err) {
    console.error("❌ Voice Generation Error:", err.message);
    return api.sendMessage("⚠️ Voice banany wali api exper ho gai.", threadID, messageID);
  }
}

module.exports.run = async function ({ api, event, args }) {
  const senderID = event.senderID;
  const threadID = event.threadID;
  const messageID = event.messageID;

  const userInput = args.join(" ");
  if (!userInput) {
    return api.sendMessage("💬 .ai [message] likho, AI voice reply karegi.", threadID, messageID);
  }

  const userName = await getUserName(api, senderID);
  const currentTime = moment().toISOString();
  const allData = loadData();
  const history = allData[senderID] || [];

  // Save user input
  history.push({ role: "user", content: userInput, time: currentTime });

  const messages = [
    {
      role: "system",
      content: `तुम एक असली और दोस्ताना महिला एआई हो। ${userName} तुमसे बात कर रहा है। कृपया हमेशा हिंदी या पंजाबी में ही प्राकृतिक और मानवीय जवाब दो, चाहे यूज़र अंग्रेज़ी में ही क्यों न पूछे।`
    },
    ...history
  ];

  const a4fApiKey = "ddc-a4f-f47f274913914b179813352c6eb99dcc"; // GPT API key
  const url = "https://api.a4f.co/v1/chat/completions";

  try {
    api.sendTypingIndicator(threadID, true);

    const res = await axios.post(
      url,
      {
        model: "provider-3/grok-4-0709",
        messages,
        temperature: 0.7
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${a4fApiKey}`
        }
      }
    );

    const aiReply = res.data.choices[0].message.content;

    // Save AI reply in history
    history.push({ role: "assistant", content: aiReply, time: currentTime });
    allData[senderID] = history;
    saveData(allData);

    return generateVoiceFromText(aiReply, api, threadID, messageID);
  } catch (err) {
    console.error("❌ AI Response Error:", err.message);
    return api.sendMessage("⚠️ AI se reply nahi aaya, baad mein koshish karo.", threadID, messageID);
  }
};
