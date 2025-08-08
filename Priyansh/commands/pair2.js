module.exports.config = {
  name: "pair2",
  version: "1.0.1",
  hasPermssion: 0,
  credits: "Mian Amir",
  description: "Pair with people of the opposite gender in the group",
  commandCategory: "For users",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "jimp": ""
  }
};

async function makeImage({ one, two }) {
  const fs = global.nodemodule["fs-extra"];
  const path = global.nodemodule["path"];
  const axios = global.nodemodule["axios"];
  const jimp = global.nodemodule["jimp"];
  const __root = path.resolve(__dirname, "cache", "canvas");

  if (!fs.existsSync(__root)) fs.mkdirSync(__root, { recursive: true });

  const pairingImgUrl = "https://i.ibb.co/fdSwfhnb/20250720-031355.jpg";
  const baseImagePath = path.join(__root, "pairing_temp.png");
  try {
    const baseImageBuffer = (await axios.get(pairingImgUrl, { responseType: 'arraybuffer' })).data;
    fs.writeFileSync(baseImagePath, Buffer.from(baseImageBuffer, 'binary'));
  } catch (error) {
    console.error("Error downloading base image:", error.message);
    throw new Error("Failed to download base image.");
  }

  let pairing_img = await jimp.read(baseImagePath);
  let pathImg = path.join(__root, `pairing_${one}_${two}.png`);
  let avatarOne = path.join(__root, `avt_${one}.png`);
  let avatarTwo = path.join(__root, `avt_${two}.png`);

  try {
    let getAvatarOne = (await axios.get(
      `https://graph.facebook.com/${one}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: 'arraybuffer' }
    )).data;
    fs.writeFileSync(avatarOne, Buffer.from(getAvatarOne, 'binary'));
  } catch (error) {
    console.error(`Error downloading avatar for user ${one}:`, error.message);
    throw new Error(`Failed to download avatar for user ${one}.`);
  }

  try {
    let getAvatarTwo = (await axios.get(
      `https://graph.facebook.com/${two}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: 'arraybuffer' }
    )).data;
    fs.writeFileSync(avatarTwo, Buffer.from(getAvatarTwo, 'binary'));
  } catch (error) {
    console.error(`Error downloading avatar for user ${two}:`, error.message);
    throw new Error(`Failed to download avatar for user ${two}.`);
  }

  let circleOne = await jimp.read(await circle(avatarOne));
  let circleTwo = await jimp.read(await circle(avatarTwo));

  pairing_img
    .composite(circleOne.resize(410, 410), 785, 184)
    .composite(circleTwo.resize(410, 410), 94, 181);

  let raw = await pairing_img.getBufferAsync("image/png");
  fs.writeFileSync(pathImg, raw);

  fs.unlinkSync(avatarOne);
  fs.unlinkSync(avatarTwo);
  fs.unlinkSync(baseImagePath);

  return pathImg;
}

async function circle(image) {
  const jimp = require("jimp");
  image = await jimp.read(image);
  image.circle();
  return await image.getBufferAsync("image/png");
}

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID } = event;
  const fs = require("fs-extra");
  const tl = ['21%', '11%', '55%', '89%', '22%', '45%', '1%', '4%', '78%', '15%', '91%', '77%', '41%', '32%', '67%', '19%', '37%', '17%', '96%', '52%', '62%', '76%', '83%', '100%', '99%', "0%", "48%"];
  const tle = tl[Math.floor(Math.random() * tl.length)];

  try {
    const userInfo = await api.getUserInfo(senderID);
    const namee = userInfo[senderID].name;
    const senderGender = userInfo[senderID].gender;

    const threadInfo = await api.getThreadInfo(threadID);
    let participantIDs = threadInfo.participantIDs.filter(id => id !== senderID);

    if (participantIDs.length === 0) {
      return api.sendMessage(
        "No other participants found in the group to pair with.",
        threadID,
        messageID
      );
    }

    const participantsInfo = await api.getUserInfo(participantIDs);

    let oppositeGenderIDs = [];

    if (senderGender === 2) {
      oppositeGenderIDs = participantIDs.filter(id => participantsInfo[id]?.gender === 1);
    } else if (senderGender === 1) {
      oppositeGenderIDs = participantIDs.filter(id => participantsInfo[id]?.gender === 2);
    } else {
      oppositeGenderIDs = participantIDs;
    }

    let randomID;
    if (oppositeGenderIDs.length > 0) {
      randomID = oppositeGenderIDs[Math.floor(Math.random() * oppositeGenderIDs.length)];
    } else {
      randomID = participantIDs[Math.floor(Math.random() * participantIDs.length)];
    }

    const partnerInfo = await api.getUserInfo(randomID);
    const name = partnerInfo[randomID].name;

    const arraytag = [
      { id: senderID, tag: namee },
      { id: randomID, tag: name }
    ];

    const one = senderID, two = randomID;

    return makeImage({ one, two }).then(path =>
      api.sendMessage({
        body: `🅢𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋 🅟𝐀𝐈𝐑𝐈𝐍𝐆
𝐇𝐎𝐏𝐄 𝐘𝐎𝐔 𝐁𝐎𝐓𝐇 𝐖𝐈𝐋𝐋 𝐒𝐓𝐎𝐏 𝐅𝐋𝐈𝐑𝐓𝐈𝐍𝐆 ⊂◉‿◉\n━━━━━━━━━━━━━━━━━━ ${namee} 💓 ${name}\n━━━━━━━━━━━━━━━━━━\n➥ 𝐃𝐎𝐔𝐁𝐋𝐄 𝐑𝐀𝐓𝐈𝐎: ${tle}%\n━━━━━━━━━━━━━━━━━━\n𝙊𝙬𝙣𝙚𝙧 𝙈𝙞𝙖𝙣 𝘼𝙢𝙞𝙧`,
        mentions: arraytag,
        attachment: fs.createReadStream(path)
      }, threadID, () => fs.unlinkSync(path), messageID));
  } catch (error) {
    console.error("Error in pair4 command:", error.message);
    return api.sendMessage(
      "An error occurred while pairing. Please try again later or contact the bot admin.",
      threadID,
      messageID
    );
  }
};
