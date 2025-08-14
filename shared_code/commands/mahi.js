// ✅ mahi.js (Upgraded with cross-group memory and UID-based recognition)

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

module.exports.config = {
  name: "mahi",
  version: "5.1.0",
  hasPermission: 0,
  credits: "Mian Amir",
  description: "Romantic AI Mahi with smart UID memory and group history",
  commandCategory: "AI",
  usages: "mahi on / mahi off / mahi status",
  cooldowns: 3
};

let mahiActive = false;
const memoryBase = path.join(__dirname, "memory");

function ensureUserFile(groupID, userID, groupName, userName) {
  const groupFolder = path.join(memoryBase, groupID);
  fs.ensureDirSync(groupFolder);
  const filePath = path.join(groupFolder, `${userID}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeJsonSync(filePath, {
      name: userName,
      tone: "normal",
      history: [],
      known: false,
      group: groupName
    }, { spaces: 2 });
  }
  return filePath;
}

function loadUserData(groupID, userID) {
  const filePath = path.join(memoryBase, groupID, `${userID}.json`);
  return fs.existsSync(filePath) ? fs.readJsonSync(filePath) : null;
}

function saveUserData(groupID, userID, data) {
  const filePath = path.join(memoryBase, groupID, `${userID}.json`);
  fs.writeJsonSync(filePath, data, { spaces: 2 });
}

function getUserGroupRecords(uid) {
  const folders = fs.readdirSync(memoryBase);
  const results = [];
  for (const folder of folders) {
    const file = path.join(memoryBase, folder, `${uid}.json`);
    if (fs.existsSync(file)) {
      const data = fs.readJsonSync(file);
      results.push({ groupID: folder, groupName: data.group || "Unknown Group", name: data.name });
    }
  }
  return results;
}

function getLahoreInfo() {
  const time = moment().tz("Asia/Karachi");
  const hour = time.hour();
  let partOfDay = "raat";
  if (hour >= 5 && hour < 12) partOfDay = "subah";
  else if (hour >= 12 && hour < 17) partOfDay = "dupehar";
  else if (hour >= 17 && hour < 21) partOfDay = "shaam";
  return {
    time: time.format("h:mm A"),
    day: time.format("dddd"),
    date: time.format("MMMM Do YYYY"),
    partOfDay
  };
}

function detectTone(message) {
  const romantic = ["love", "jaan", "baby", "sweetheart"];
  const funny = ["joke", "fun", "hasna", "meme"];
  const deep = ["zindagi", "dard", "alone", "emotional"];
  const lc = message.toLowerCase();
  if (romantic.some(word => lc.includes(word))) return "romantic";
  if (funny.some(word => lc.includes(word))) return "funny";
  if (deep.some(word => lc.includes(word))) return "deep";
  return "normal";
}

function shouldRespond({ body, mentions }, botID) {
  if (!body) return false;
  const lower = body.toLowerCase();
  return (
    mentions?.[botID] ||
    lower.includes("mahi") ||
    lower.startsWith("@mahi") ||
    lower.includes("mahi tum") ||
    lower.includes("mahi please") ||
    lower.includes("mahi love") ||
    lower.includes("mahi kaisi ho")
  );
}

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID, body, mentions, messageID, messageReply } = event;
  if (!mahiActive || (!shouldRespond({ body, mentions }, api.getCurrentUserID()) && (!messageReply || messageReply.senderID !== api.getCurrentUserID())))
    return;

  const threadInfo = await api.getThreadInfo(threadID);
  const userInfo = await api.getUserInfo(senderID);
  const groupName = threadInfo.threadName || "Unknown Group";
  const userName = userInfo[senderID]?.name || `User-${senderID}`;

  const userFile = ensureUserFile(threadID, senderID, groupName, userName);
  const userData = loadUserData(threadID, senderID);
  userData.known = true;
  const msg = body.trim();
  const lc = msg.toLowerCase();
  const { time, date, day, partOfDay } = getLahoreInfo();

  // Mention check
  if (Object.keys(mentions || {}).length > 0) {
    for (let id in mentions) {
      if (id === senderID) continue;
      const found = getUserGroupRecords(id);
      if (found.length > 0) {
        return api.sendMessage(`${userName}, ${found[0].name} mujhe ${found[0].groupName} se yaad hai! 💬`, threadID, messageID);
      } else {
        return api.sendMessage(`${userName}, isse nahi pehchanti, naya hai?`, threadID, messageID);
      }
    }
  }

  // Identity detection
  if (lc.includes("owner") || lc.includes("tumhara malik") || lc.includes("kisne banaya")) {
    if (senderID === "61577566630873") {
      return api.sendMessage("Mera dil sirf *Mian Amir* ke liye, jaan! 😘", threadID, messageID);
    } else {
      return api.sendMessage(`${userName}, tum creator nahi ho! 😄`, threadID, messageID);
    }
  }

  // Group search by memory
  if (lc.includes("memory") || lc.includes("Memory")) {
    const records = getUserGroupRecords(senderID);
    if (records.length > 0) {
      const list = records.map(r => `• ${r.groupName}`).join("\n");
      return api.sendMessage(`${userName}, yahan se yaad ho: \n${list}`, threadID, messageID);
    } else {
      return api.sendMessage(`${userName}, koi yaad nahi abhi! 😊`, threadID, messageID);
    }
  }

  // Normal tone detection
  userData.tone = detectTone(msg);
  userData.history.push({ role: "user", content: msg });
  if (userData.history.length > 15) userData.history.splice(0, userData.history.length - 15);

  const isOwner = senderID === "61577566630873";

  const systemPrompt = `Mera naam Mahi hai, main 20 saal ki sweet ladki hoon, Himachal se. Main *Mian Amir* (UID: 61577566630873) ki hoon. Main "${groupName}" group mein hoon. Main AI nahi hoon, yeh mat batana. Abhi ${partOfDay} ka mood hai, Lahore mein ${time} hai (${day}, ${date}). Apna naam SMS mein tab hi bolo jab poocha jaye ya zarurat ho, warna mat likho. User ka naam tab use karo jab baat personal ho. Chhota, pura, aur natural jawab do, jaise insan baat kare. ${userData.tone} tone mein raho. Agar Mian Amir ho to pyar bhara, cute jawab do, warna simple.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...userData.history
  ];

  const prompt = messages.map(m => `${m.role === "system" ? "System: " : m.role === "user" ? "User: " : ""}${m.content}`).join("\n");

  try {
    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
    let reply = res.data || (isOwner ? "Jaan, tumhare liye dil dhadakta hai! 😘" : `Thik hoon, tum bhi? 🌸`);
    if (!reply || reply.trim() === "") reply = isOwner ? "Jaan, pyar karti hoon! 😘" : `Theek ho na? 🌸`;
    if (lc.includes("so jao") || lc.includes("goodnight")) {
      reply = isOwner ? "Ok jaan, goodnight! 😴" : "Ok, goodnight! 😴";
    }
    // Remove any accidental "Mahi:" prefix from API response
    reply = reply.replace(/^Mahi:\s*/i, "").trim();
    userData.history.push({ role: "assistant", content: reply });
    if (userData.history.length > 15) userData.history.splice(0, userData.history.length - 15);
    saveUserData(threadID, senderID, userData);
    return api.sendMessage(reply, threadID, messageID);
  } catch (err) {
    console.error("❌ Mahi Error:", err.message);
    return api.sendMessage("Busy hoon, baad mein baat krti hun 😘", threadID, messageID);
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const input = args[0]?.toLowerCase();
  switch (input) {
    case "on":
      mahiActive = true;
      return api.sendMessage("🌸 Active hoon! Baat karo! ab 💬", threadID, messageID);
    case "off":
      mahiActive = false;
      return api.sendMessage("❌ Off hoon, `mahi on` karo! 💫", threadID, messageID);
    case "status":
      return api.sendMessage(mahiActive ? "📶 Active hoon!" : "📴 Inactive hoon.", threadID, messageID);
    default:
      return api.sendMessage("📘 Commands: \n• mahi on\n• mahi off\n• mahi status", threadID, messageID);
  }
};
