var tmi = require('tmi.js');
const config = require("./config.json");
var channelname = config.twitchChannel;
var options = {
    options: {
        debug: true
    },
    connection: {
        "cluster": "aws",
        "reconnect": true
    },
    identity: {
        username: config.botName,
        password: config.twitchOAuth
    },
    channels: [channelname]
}

var client = tmi.client(options);
client.connect();
client.on("connected", function (address, port) {
    console.log("connected: " + address + ":" + port);
    client.action(channelname, "Bot is live");

})

client.on("chat", function (channel, user, message, self) {
    var words = message.split(" ");
    var lowercaseContent = message.toLowerCase();
    var command = words[0];
    var response = "";
    if (command === '!times') { //!times 8:30 PM
        var now = new Date();
        var timeIn = words[1].split(":");
        for (var i = 0; i < timeIn.length; i++) {
            timeIn[i] = parseInt(timeIn[i])
        }
        if (words[2]) {
            if (words[2].toLowerCase() === "pm") timeIn[0] += 12;
        }
        var date = new Date(now.getFullYear(), now.getMonth(), now.getDay(), timeIn[0], timeIn[1], 0, 0)
        getTimes(date);
    } else if (command === '!time') { //!time
        var now = new Date();
        getTimes(now);

    }
});

function getTimes(standardTime) {
    standardTime.setHours(standardTime.getHours() - config.timezone)

    var times = config.times;
    var clocks = config.clocks;

    for (var i = 0; i < times.length; i++) {
        if (times[i].hour > 24) times[i].hour -= 24;
        if (times[i].hour < 0) times[i].hour += 24;
        if (times[i].minutes < 10) times[i].minutes = "0" + times[i].minutes;
        if (times[i].hour >= 12) {
            times[i].hour -= 12;
            times[1].AM = "PM"
        };
        times[i].emoji = clocks[times[i].hour]
    }
    response = times[0].emoji + "GMT:" + times[0].hour + ":" + times[0].minutes + times[0].AM + " " +
        times[1].emoji + "CET:" + times[1].hour + ":" + times[1].minutes + times[1].AM + " " +
        times[2].emoji + "PST:" + times[2].hour + ":" + times[2].minutes + times[2].AM + " " +
        times[3].emoji + "MST:" + times[3].hour + ":" + times[3].minutes + times[3].AM + " " +
        times[4].emoji + "CST:" + times[4].hour + ":" + times[4].minutes + times[4].AM + " " +
        times[5].emoji + "AEDST:" + times[5].hour + ":" + times[5].minutes + times[5].AM + " " +
        times[6].emoji + "AEST:" + times[6].hour + ":" + times[6].minutes + times[6].AM
    client.action(channelname, response);
}
