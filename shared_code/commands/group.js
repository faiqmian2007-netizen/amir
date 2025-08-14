module.exports.config = {
  name: "group",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Koja Babu",
  description: "",
  commandCategory: "",
  usages: "",
  cooldowns: 10,
  dependencies: {
    canvas: "",
    axios: "",
    "fs-extra": "",
  },
};

module.exports.handleReply = async function({ api, event, prefix, admin args, Threads, handleReply }) {
  const lockedGroups = {};
  const bots = {};

  // Save the bot instance
  bots[event.senderID] = api;

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);


    if (event.type === 'message' && event.body.startsWith(prefix)) {
      const senderID = event.senderID;
      const args = event.body.slice(prefix.length).trim().split(' ');
      const command = args[0].toLowerCase();
      const lockValue = args.slice(2).join(' ');

      if (senderID !== admin) {
        return api.sendMessage('❌ You are not authorized to use this command.', event.threadID);
      }

      if (command === 'grouplockname' && args[1] === 'on') {
        lockedGroups[event.threadID] = lockValue;
        api.setTitle(lockValue, event.threadID, (err) => {
          if (err) {
            return api.sendMessage('❌ Failed to lock group name.', event.threadID);
          }
          api.sendMessage(`✅ Group name locked as: ${lockValue}`, event.threadID);
        });
      } else if (command === 'lockstatus') {
        const lockStatus = `🔒 Lock Status:\nGroup Name: ${lockedGroups[event.threadID] || 'Not locked'}`;
        api.sendMessage(lockStatus, event.threadID);
      }
    }

    if (event.logMessageType === 'log:thread-name') {
      const lockedName = lockedGroups[event.threadID];
      if (lockedName) {
        api.setTitle(lockedName, event.threadID, (err) => {
          if (!err) {
            api.sendMessage('❌ Group name change reverted.', event.threadID);
          }
        });
      }
    }
  });
};
