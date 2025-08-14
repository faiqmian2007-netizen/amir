const fs = require("fs");
const path = require("path");
const dataPath = path.join(__dirname, "antichangegroup.json");
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "{}");

module.exports.config = {
  name: "antichangegroup",
  version: "1.0.3",
  hasPermission: 1,
  credits: "Faheem King",
  description: "Protect group from changes like name, emoji, theme, etc.",
  commandCategory: "group",
  usages: [
    "antichangegroup setup",
    "antichangegroup <name|emoji|theme|nickname|photo|admin> on/off",
  ],
  cooldowns: 5,
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID } = event;

  try {
    const settings = JSON.parse(fs.readFileSync(dataPath));
    if (!settings[threadID]) settings[threadID] = { lock: {}, original: {} };
    const threadData = settings[threadID];

    if (!threadData.lock) threadData.lock = {};
    if (!threadData.original) threadData.original = {};

    const action = (args[0] || "").toLowerCase();
    const status = (args[1] || "").toLowerCase();
    const value = status === "on" ? true : status === "off" ? false : null;

    if (!event.isGroup)
      return api.sendMessage(
        "⚠️ This command only works in group chats.",
        threadID,
        messageID
      );

    if (action === "setup") {
      const info = await api.getThreadInfo(threadID);
      threadData.original = {
        name: info.threadName,
        emoji: info.emoji,
        theme: info.threadColor,
        nicknames: info.nicknames || {},
      };
      settings[threadID] = threadData;
      fs.writeFileSync(dataPath, JSON.stringify(settings, null, 2));
      return api.sendMessage(
        "✅ Group settings saved! Now use `antichangegroup name on` etc. to enable protection.",
        threadID,
        messageID
      );
    }

    const types = ["name", "emoji", "theme", "nickname", "photo", "admin"];
    if (!types.includes(action) || value === null) {
      return api.sendMessage(
        `❓ Usage:\n• antichangegroup setup\n• antichangegroup <${types.join(
          "|"
        )}> on/off`,
        threadID,
        messageID
      );
    }

    threadData.lock[action] = value;
    settings[threadID] = threadData;
    fs.writeFileSync(dataPath, JSON.stringify(settings, null, 2));
    return api.sendMessage(
      `${value ? "✅ Enabled" : "❌ Disabled"} protection for "${action}".`,
      threadID,
      messageID
    );
  } catch (err) {
    console.error("❌ Error in antichangegroup:", err);
    return api.sendMessage(
      "⚠️ Something went wrong. Check logs.",
      threadID,
      messageID
    );
  }
};

module.exports.handleEvent = async ({ api, event }) => {
  const fs = require("fs");
  const path = require("path");
  const dataPath = path.join(__dirname, "antichangegroup.json");

  if (!event.isGroup || !fs.existsSync(dataPath)) return;

  const { threadID, logMessageType, logMessageData } = event;
  const settings = JSON.parse(fs.readFileSync(dataPath));
  const threadData = settings[threadID];
  if (!threadData || !threadData.lock || !threadData.original) return;

  const { lock, original } = threadData;
  const info = await api.getThreadInfo(threadID);

  switch (logMessageType) {
    case "log:thread-name":
      if (lock.name && original.name && info.threadName !== original.name) {
        await api.setTitle(original.name, threadID);
        api.sendMessage("❌ Group name change is locked. Reverted!", threadID);
      }
      break;

    case "log:thread-emoji":
      if (lock.emoji && original.emoji && info.emoji !== original.emoji) {
        await api.changeThreadEmoji(original.emoji, threadID);
        api.sendMessage("❌ Group emoji change is locked. Reverted!", threadID);
      }
      break;

    case "log:thread-color":
      if (lock.theme && original.theme && info.threadColor !== original.theme) {
        await api.changeThreadColor(original.theme, threadID);
        api.sendMessage("❌ Group theme change is locked. Reverted!", threadID);
      }
      break;

    case "log:user-nickname":
      if (lock.nickname && original.nicknames) {
        const changedID = Object.keys(logMessageData.nickname || {})[0];
        const oldNick = original.nicknames[changedID];
        if (oldNick && info.nicknames?.[changedID] !== oldNick) {
          await api.changeNickname(oldNick, threadID, changedID);
          api.sendMessage("❌ Nickname change is locked. Reverted!", threadID);
        }
      }
      break;

    case "log:thread-icon":
      if (lock.photo) {
        api.sendMessage(
          "⚠️ Group photo changed — cannot auto-revert via bot.",
          threadID
        );
      }
      break;

    case "log:thread-admins":
      if (lock.admin) {
        api.sendMessage(
          "⚠️ Admin change detected — cannot revert automatically. Please review manually.",
          threadID
        );
      }
      break;
  }
};
