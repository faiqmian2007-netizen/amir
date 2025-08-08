const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "pinterest",
  version: "2.0.1",
  hasPermission: 0,
  credits: "Faheem King",
  description: "Search aesthetic dpz",
  commandCategory: "image",
  usages: "pinterest [keyword]",
  cooldowns: 5,
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID } = event;
  const query = args.join(" ");

  if (!query)
    return api.sendMessage(
      "❌ Please enter a keyword to search.",
      threadID,
      messageID
    );

  const apiKey = "R9i00tjufUkiWvZ_wSytaTCBkBDCStGE3EdbnyaONFc";

  try {
    const res = await axios.get("https://api.unsplash.com/search/photos", {
      params: {
        query,
        per_page: 5,
        orientation: "portrait",
      },
      headers: {
        Authorization: `Client-ID ${apiKey}`,
      },
    });

    const results = res.data.results;
    if (!results.length)
      return api.sendMessage(
        "⚠️ No images found. Try another keyword.",
        threadID,
        messageID
      );

    // Download images temporarily
    const files = await Promise.all(
      results.map(async (img, i) => {
        const imgPath = path.join(__dirname, `unsplash_${i}.jpg`);
        const response = await axios.get(img.urls.regular, {
          responseType: "arraybuffer",
        });
        fs.writeFileSync(imgPath, response.data);
        return fs.createReadStream(imgPath);
      })
    );

    return api.sendMessage(
      {
        body: `📸 Results for: ${query}`,
        attachment: files,
      },
      threadID,
      async () => {
        // Delete files after sending
        for (let i = 0; i < 5; i++) {
          const filePath = path.join(__dirname, `unsplash_${i}.jpg`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      },
      messageID
    );
  } catch (err) {
    console.error("❌ Unsplash API Error:", err.message);
    return api.sendMessage(
      "⚠️ Failed to fetch images. Try again later.",
      threadID,
      messageID
    );
  }
};
