const axios = require("axios");
const fs = require("fs");
const path = require("path");
const HttpsProxyAgent = require("https-proxy-agent");
const { ytsearch, ytmp3 } = require("ruhend-scraper");
const { Downloader } = require("abot-scraper");

const downloader = new Downloader();

// 🔁 Proxy list (from your data)
const proxies = [
  "http://27.71.142.16:16000",
  "http://186.179.169.22:3128",
  "http://72.10.160.91:18749",
  "http://27.79.136.134:16000",
  "http://18.203.249.67:10010",
  "http://43.217.134.23:3128",
  "http://57.129.81.201:8080"
];

function getRandomProxy() {
  const proxy = proxies[Math.floor(Math.random() * proxies.length)];
  return new HttpsProxyAgent(proxy);
}

module.exports.config = {
  name: "song",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "Mian Amir",
  description: "Download YouTube audio or video (with fallback proxy)",
  commandCategory: "media",
  usages: "[song name] [optional: video]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  if (!args[0]) {
    return api.sendMessage("❌ Please type a song name.\n\nExample: .song tum hi ho\nOr: .song tum hi ho video", event.threadID, event.messageID);
  }

  const isVideo = args[args.length - 1].toLowerCase() === "video";
  const query = isVideo ? args.slice(0, -1).join(" ") : args.join(" ");
  const waitMsg = await api.sendMessage(`🔍 Searching: ${query} (${isVideo ? "video" : "audio"})...`, event.threadID);

  try {
    const { video } = await ytsearch(query);
    if (!video || video.length === 0) {
      return api.sendMessage("❌ No result found.", event.threadID, event.messageID);
    }

    const selected = video[0];
    const safeTitle = selected.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const fileName = isVideo ? `${safeTitle}.mp4` : `${safeTitle}.mp3`;
    const filePath = path.join(__dirname, fileName);

    let downloadUrl = null;

    if (isVideo) {
      const res = await downloader.youtubeDownloader(selected.url);
      if (!res || res.status !== 200 || !res.result?.video) {
        return api.sendMessage("❌ Failed to fetch video URL.", event.threadID, event.messageID);
      }
      downloadUrl = res.result.video;
    } else {
      const { title, audio } = await ytmp3(selected.url);
      if (!audio || !audio.startsWith("http")) {
        return api.sendMessage("❌ Failed to fetch MP3 link.", event.threadID, event.messageID);
      }
      downloadUrl = audio;
    }

    const axiosOptions = {
      method: "GET",
      url: downloadUrl,
      responseType: "stream"
    };

    // ✅ Use proxy only when not running on Replit
    if (!process.env.REPL_ID) {
      axiosOptions.httpsAgent = getRandomProxy();
    }

    const response = await axios(axiosOptions);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", async () => {
      await api.sendMessage({
        body: `🎶 Title: ${selected.title}\n✅ Here's your ${isVideo ? "video" : "song"}:`,
        attachment: fs.createReadStream(filePath)
      }, event.threadID, () => {
        fs.unlinkSync(filePath);
        api.unsendMessage(waitMsg.messageID);
      }, event.messageID);
    });

    writer.on("error", (err) => {
      console.error("❌ File write error:", err);
      api.sendMessage("❌ Failed to save the file.", event.threadID, event.messageID);
    });

  } catch (err) {
    console.error("❌ Main error:", err.message);
    api.sendMessage("❌ Error occurred while processing your request.", event.threadID, event.messageID);
  }
};
