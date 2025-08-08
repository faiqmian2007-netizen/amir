module.exports.config = {
	name: "grouplockname",
	version: "1.0.2",
	hasPermssion: 2,
	credits: "Amir",
	description: "Lock the group name to prevent changes",
	commandCategory: "Box",
	usages: "grouplockname [on/off] [group name]",
	cooldowns: 5
};

const fs = require("fs");
const lockedGroups = JSON.parse(fs.readFileSync("lockedGroups.json", "utf8") || "{}");

module.exports.run = async function({ api, event, args }) {
	const threadID = event.threadID;
	const command = args[0]?.toLowerCase();
	const groupName = args.slice(1).join(" ");

	console.log(`Command received: ${args.join(" ")} in thread: ${threadID}`);
	console.log("Current Locked Groups:", lockedGroups);

	if (command === "on") {
		if (!groupName) {
			return api.sendMessage("❌ Please provide a group name to lock.", threadID, event.messageID);
		}

		lockedGroups[threadID] = groupName;
		fs.writeFileSync("lockedGroups.json", JSON.stringify(lockedGroups, null, 2), (err) => {
			if (err) {
				return console.log("Error saving locked groups:", err.message);
			}
			console.log("Locked groups updated successfully.");
		});

		api.setTitle(groupName, threadID, (err) => {
			if (err) {
				console.log("Error setting group name:", err.message);
				return api.sendMessage("❌ Failed to set group name. Check permissions.", threadID, event.messageID);
			}
			console.log(`Group name locked as: "${groupName}"`);
			api.sendMessage(`✅ Group name locked as: "${groupName}"`, threadID, event.messageID);
		});
	} else if (command === "off") {
		if (!lockedGroups[threadID]) {
			return api.sendMessage("❌ No group name is locked for this group.", threadID, event.messageID);
		}
		delete lockedGroups[threadID];
		fs.writeFileSync("lockedGroups.json", JSON.stringify(lockedGroups, null, 2), (err) => {
			if (err) {
				return console.log("Error saving locked groups:", err.message);
			}
			console.log("Locked groups updated successfully.");
		});
		api.sendMessage("✅ Group name lock has been disabled.", threadID, event.messageID);
	} else {
		api.sendMessage("❌ Invalid command. Use 'on' to lock and 'off' to unlock.", threadID, event.messageID);
	}
};

module.exports.handleEvent = async function({ api, event }) {
	console.log(event); // Debugging all events

	if (event.logMessageType === "log:thread-name") {
		const threadID = event.threadID;
		const newName = event.logMessageData.name;
		const lockedName = lockedGroups[threadID];

		console.log(`Detected name change in group ${threadID}: ${newName}`);
		if (lockedName && newName !== lockedName) {
			console.log(`Locked name: ${lockedName}, Detected name: ${newName}`);
			api.setTitle(lockedName, threadID, (err) => {
				if (err) {
					console.log(`Error reverting group name: ${err.message}`);
				} else {
					console.log(`Reverted group name to: ${lockedName}`);
					api.sendMessage(`❌ Group name change detected! Reverting to locked name: "${lockedName}"`, threadID);
				}
			});
		}
	}
};
