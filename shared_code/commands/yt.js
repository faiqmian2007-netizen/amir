const { ytmp3, ytmp4 } = require("ruhend-scraper");
const ytSearch = require("yt-search");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "yt",
    version: "3.0.1",
    hasPermssion: 0,
    credits: "Mian Amir",
    description: "Download YouTube audio or video by search keyword",
    commandCategory: "Media",
    usages: ".yt [song name] or .yt video [song name]",
    cooldowns: 5
  },

  run: async function ({ api, event, args }) {
    let keyword, isVideo;

    if (args.length > 1 && args[0].toLowerCase() === "video") {
      isVideo = true;
      keyword = args.slice(1).join(" ");
    } else {
      isVideo = false;
      keyword = args.join(" ");
    }

    if (!keyword) {
      return api.sendMessage(
        "❗ Use: .yt [song name] or .yt video [song name]",
        event.threadID,
        event.messageID
      );
    }

    const waitMsg = await api.sendMessage("🔍 Searching YouTube...", event.threadID, null, event.messageID);

    try {
      const searchResults = await ytSearch(keyword);
      if (!searchResults.videos.length) throw new Error("❌ No results found.");

      const topResult = searchResults.videos[0];
      const videoUrl = `https://www.youtube.com/watch?v=${topResult.videoId}`;
      const titleSafe = topResult.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
      const ext = isVideo ? "mp4" : "mp3";
      const filename = `${titleSafe}.${ext}`;
      const filePath = path.join(__dirname, filename);

      let downloadUrl, mediaData;

      if (isVideo) {
        mediaData = await ytmp4(videoUrl);
        downloadUrl = mediaData.video;
      } else {
        mediaData = await ytmp3(videoUrl);
        downloadUrl = mediaData.audio;
      }

      if (!downloadUrl) throw new Error("❌ Unable to fetch media link.");

      // ✅ Use axios for downloading both audio and video
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.youtube.com'
        }
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage(
          {
            body: `🎶 Title: ${topResult.title}\n🟢 Here is your ${isVideo ? "video 🎥" : "audio 🎧"}`,
            attachment: fs.createReadStream(filePath)
          },
          event.threadID,
          () => fs.unlinkSync(filePath),
          event.messageID
        );
      });

      writer.on("error", (err) => {
        fs.unlink(filePath, () => {});
        api.sendMessage(`❌ Error writing file: ${err.message}`, event.threadID, event.messageID);
      });

    } catch (err) {
      console.error(err.message);
      api.sendMessage(`❌ Error: ${err.message}`, event.threadID, event.messageID);
    } finally {
      api.unsendMessage(waitMsg.messageID);
    }
  }
};
