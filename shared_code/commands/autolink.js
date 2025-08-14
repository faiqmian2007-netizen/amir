const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { ttdl } = require("ruhend-scraper");

module.exports.config = {
  name: "autolink",
  version: "1.0.0",
  hasPermission: 0,
  credits: "Mian Amir",
  description: "Auto TikTok downloader (no command needed)",
  commandCategory: "Auto",
  usages: "",
  cooldowns: 5
};

module.exports.run = async () => {};

// Auto detect link in messages
module.exports.handleEvent = async function ({ api, event }) {
  const text = event.body;
  const tiktokRegex = /(https?:\/\/)?(www\.)?(vm|vt|tiktok)\.tiktok\.com\/[^\s]+|https?:\/\/www\.tiktok\.com\/@[^\/]+\/video\/\d+/gi;

  const links = text?.match(tiktokRegex);
  if (!links || links.length === 0) return;

  for (const shortUrl of links) {
    try {
      const fullUrl = await resolveTikTokUrl(shortUrl);

      if (!fullUrl) {
        return api.sendMessage("❌ Link redirect fail hua ya invalid hai.", event.threadID, event.messageID);
      }

      const data = await ttdl(fullUrl);

      if (!data || !data.video) {
        return api.sendMessage("❌ Video laany mein error aayi. Try again.", event.threadID, event.messageID);
      }

      const fileName = `tiktok_${Date.now()}.mp4`;
      const filePath = path.join(__dirname, "cache", fileName);
      const videoStream = await axios.get(data.video, { responseType: "arraybuffer" });

      fs.writeFileSync(filePath, Buffer.from(videoStream.data, "binary"));

      if (fs.statSync(filePath).size / 1024 / 1024 > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage("⚠️ Video size 25MB se zyada hai. Can't send.", event.threadID, event.messageID);
      }

      api.sendMessage({
        body: `🎬 ${data.title || "TikTok Video"}\n👤 ${data.username}`,
        attachment: fs.createReadStream(filePath)
      }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);

    } catch (err) {
      console.error("❌ Error:", err.message || err);
      api.sendMessage("❌ Video fetch nahi ho saka. Try again later.", event.threadID, event.messageID);
    }
  }
};

// Short link redirect handler
async function resolveTikTokUrl(url) {
  try {
    if (!url.includes("vt.tiktok.com") && !url.includes("vm.tiktok.com")) return url;

    const res = await axios({
      method: "GET",
      url,
      maxRedirects: 0,
      validateStatus: status => status === 301 || status === 302
    });

    return res.headers.location || null;
  } catch (err) {
    return null;
  }
}
