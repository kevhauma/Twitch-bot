var tmi = require('tmi.js'); // main twitch package
const config = require("./config.json") // get config data
const axios = require('axios') //REST call package
var fileSystem = require("fs") //filesystem package
var JSONStream = require("JSONStream") //write large json arrays
var moment = require("moment") //easy time calculation package
var say = require("say") //text to speech package
var express = require("express") //web server package
var Cleverbot = require('cleverbot-node') // package for cleverbot
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
    channels: [config.channelname] //config.twitchChannel
} //options for twitch client
var membersFile = "/data/members.json" //file path to write
var dataFile = "/data/data.json"
//initialize web server
var app = express()
//get data loaded
var members = require("./data/members.json")
var data = require("./data/data.json")
commands = data[0]
quotes = data[2]
counters = data[1]
gifs = data[3]
var goodWords = config.goodWords
var badWords = config.badWords
var isAllowed
var lastMessage = {
    "message": "",
    color: "#000"
}
var bannerS = " "
var activeGif = "trans.png"
//initialize and setup API options and stuff
var client = tmi.client(options);
cleverbot = new Cleverbot;
cleverbot.configure({
    botapi: config.clevertoken
});
client.connect();
client.on("connected", function (address, port) {
    console.log("connected: " + address + ":" + port);
    givePoints();
})

var onlineMembers = new Array();

//set API endpoints
app.use(express.static('client'))

app.get('/api/message', function (req, res) {
    res.status(200).json(lastMessage);
});
app.get('/api/gif', function (req, res) {
    res.status(200).json(activeGif);
});
app.get('/api/banner', function (req, res) {
    res.status(200).json(bannerS);
});
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//everything happens on message
client.on("chat", function (channel, user, message, self) {
    lastMessage = {
        "message": message,
        color: user.color
    } //set message for webserver
    if (self) return

    addMessage(user.username, message) //adds to messageCount stat from user
    if (Math.random() > 0.95) changeWord(message) //change to change a word in a sentence
    commandsC(message, user) //check for commands
});
client.on("join", function (channel, user, message, self) {
    onlineMembers.push(user) //if member joins, add it to the array
    console.log(user + " has joined")

})
client.on("part", function (channel, user, message, self) {
    const index = onlineMembers.indexOf(user);
    if (index !== -1) {
        onlineMembers.splice(index, 1);
    }
    console.log(user + " has left")
})



function commandsC(message, user) { //TODO make this not shit
    if (!message.startsWith("!"))
        var lowercaseContent = message.toLowerCase()
    var words = message.split(" ")
    var command = words[0]
    var restofmessage = ""
    var response = ""
    isAllowed = true
    var commandF = findCommand(words[0])
    if (commandF) { //if command is one of the save commands
        client.say(config.twitchChannel, commandF.response)
        return
    }
    //store options (!command [options]) 
    for (var i = 1; i < words.length; i++) { // puts every word (other than the command) so it works with sentences instead of just one words
        restofmessage += words[i] + " ";
    }
    //look if command is a counter
    for (var i = 0; i < counters.length; i++) {
        if (command === "!" + counters[i].name) {
            counters[i].count++;
            if (counters[i].response) {
                var counterR = counters[i].response.split("#")
                response = counterR[0] + " " + counters[i].count
                if (counterR[1]) response += " " + counterR[1]
                client.say(config.twitchChannel, response)
                return
            } else {
                client.say(config.twitchChannel, counters[i].name + ':' + counters[i].count)
            }
        } else
        if (command === "!" + counters[i].name + "edit") {
            counters[i].response = restofmessage
        }
    }
    //if command is a gif-command
    for (var i = 0; i < gifs.length; i++) {
        if (command === gifs[i].name) {
            setGif(gifs[i].link, "activeGif")
        }

    }
    //50/50 hit miss game (started out as snowball)
    if (command === '!meatball') {
        var thrower = findMember(user.username)
        if (restofmessage) { //if there is something to throw at
            if (Math.random() > 0.5) {
                if (!thrower.games.hits) {
                    thrower.games.hits = 0
                    thrower.games.misses = 0
                }
                thrower.games.hits = thrower.games.hits + 1
                var hitrate = thrower.games.hits / (thrower.games.hits + thrower.games.misses) * 100
                response = user.username + " has hit " + restofmessage + " with a meatball PogChamp (" + hitrate + "% hitrate)"
                setGif(user.username + "has hit" + restofmessage, "banner")
            } else {
                if (!thrower.games.hits) {
                    thrower.games.hits = 0
                    thrower.games.misses = 0
                }
                thrower.games.misses = thrower.games.misses + 1;
                var hitrate = thrower.games.hits / (thrower.games.hits + thrower.games.misses) * 100
                response = user.username + " has missed " + restofmessage + " FeelsBadMan (" + hitrate + "% hitrate)"
                setGif(user.username + "has missed" + restofmessage, "banner")
            }
        } else response = "didn't find a target to throw at" //if there isn't something to throw at

    } else
    if (command === "!lurk") { //simple response command
        response = user.username + " is hiding in the bushes."
        setGif(response, "banner")
    } else
    if (command === "!ask") { //!ask anything and get response (by cleverbot or pre-save messages)
        var questionword = "";
        var isYesNo = true;
        var isOr = false;
        if (lowercaseContent.includes(" or ")) {
            isYesNo = false;
            isOr = true;
        }
        for (var i = 0; i < config.questionWords.length; i++) {
            if (lowercaseContent.includes(config.questionWords[i])) {
                isYesNo = false;
                questionword = config.questionWords[i];
            }
        }
        if (isYesNo) {
            var index = Math.floor(Math.random() * (config.eightballresponses.length - 1));
            response = config.eightballresponses[index]
        } else if (isOr) {
            var chance = Math.random();
            if (chance > 0.3) response = "hmmm... the first option looks fine.";
            else if (chance > 0.6) response = "Why not both?";
            else response = "hmmm... i'd go with the latter.";
        } else {
            response = getResponse(questionword);
        }
        if (!restofmessage.endsWith("?")) {
            cleverbot.write(restofmessage, function (responseCl) {
                say.speak(user.username + " says: " + restofmessage, '', 1.0, (err) => {
                    if (err) {
                        return console.error(err)
                    }
                    setTimeout(() => {
                        response = responseCl.output
                        say.speak(response);
                        setGif(response, "banner")
                        client.say(config.twitchChannel, response)
                    }, 200)
                })

            });
            return
        }

    } else
    if (command === '!ban') { //fake ban message
        if (restofmessage)
            response = restofmessage + " has been succesfully banned from this channel."
        setGif(user.username + " has banned " + restofmessage, "banner")
    } else
    if (command.startsWith('!command')) { //custom commands for viewers
        var nameC, responseC
        restofmessage = ""
        for (var i = 2; i < words.length; i++) { // puts every word (other than the command) so it works with sentences instead of just one words
            restofmessage += words[i] + " "
        }
        //if (!user.mod) return
        if (command === "!commandadd") {
            if (findCommand(words[1])) {
                client.say(config.channelname, "@" + user.username + " This command does already exist.")
                return
            }
            if (restofmessage)
                responseC = restofmessage
            else return
            if (words[1])
                nameC = words[1]
            else return
            console.log(nameC)
            commands.push({
                "name": nameC,
                "response": responseC,
                "owner": user.username
            })

            response = "@" + user.username + ", command '" + nameC + "' has been added succesfully."
        } else
        if (command === "!commandrem") {
            var commandF = findCommand(words[1])
            if (!commandF) {
                response = "@" + user.username + "This command does not exist."
            } else {
                if (commandF.owner !== user.username) response = "@" + user.username + ", this command is not yours."
                else {
                    const index = commands.indexOf(commandF);
                    if (index !== -1) {
                        commands.splice(index, 1);
                    }
                    response = "@" + user.username + ", command '" + commandF.name + "' has been removed succesfully."
                }
            }
        } else
        if (command === "!commandedit") {
            var commandF = findCommand(words[1])
            if (!commandF) {
                response = "@" + user.username + "This command does not exist."
            } else {
                if (commandF.owner !== user.username) response = "@" + user.username + ", this command is not yours."
                else {
                    if (restofmessage) {
                        commandF.response = restofmessage
                        response = "@" + user.username + ", command '" + commandF.name + "' has been edited succesfully."
                    }
                }
            }
        } else
        if (command === "!commandsum") {
            response = "custom commands: "
            for (var i = 0; i < commands.length; i++)
                response += commands[i].name + ', '
        } else
            response = "!commandadd <!command> <response>, !commandedit <!command> <response>, !commandrem <!command> & !commandsum are available"
    }
    if (command === '!gamble') { //gamble part
        var gambleAmount
        var asker = findMember(user.username, true)
        if (!words[1]) {
            client.say(config.twitchChannel, "@" + user.username + ", you can't gamble 0 " + config.currency)
            return
        }
        if (!isNaN(words[1])) {
            gambleAmount = parseInt(words[1])
            asker = changeCurrency(asker, "sub", gambleAmount)
        } else
        if (words[1] === "all") {
            gambleAmount = asker.currency.points
            asker = changeCurrency(asker, "sub", gambleAmount)
        } else
            return
        if (!isAllowed) {
            client.say(config.twitchChannel, "@" + user.username + " not enough " + config.currency + ". you only have " + asker.currency.points + " " + config.currency + " FeelsBadMan")
            return
        }
        console.log("chance: " + asker.currency.gamechance)
        var winrate
        if (Math.random() * 100 > asker.currency.gamechance) {
            asker = changeCurrency(asker, "add", gambleAmount * 2)
            asker.currency.gamechance = 55
            asker.games.gamblewins = asker.games.gamblewins + 1
            winrate = Math.floor(asker.games.gamblewins / ((asker.games.gamblewins + asker.games.gamblelosses)) * 100)
            response = "@" + user.username + " you have won " + gambleAmount + " " + config.currency + "(" + winrate + "% winrate), you now have " + asker.currency.points + " " + config.currency
            setGif(user.username + " has won " + gambleAmount, "banner")
        } else {
            asker.currency.gamechance -= 5
            asker.games.gamblelosses = asker.games.gamblelosses + 1
            winrate = Math.floor(asker.games.gamblewins / ((asker.games.gamblewins + asker.games.gamblelosses)) * 100)
            response = "@" + user.username + " you have lost " + gambleAmount + " " + config.currency + "(" + winrate + "% winrate), you now have " + asker.currency.points + " " + config.currency
            setGif(user.username + " has lost " + gambleAmount, "banner")
        }
    }
    if (command === "!" + config.currency) { //currency check (mods can (not yet) check other's currency)
        var asker = findMember(user.username, true)
        if (words[1]) {
            name = words[1].replace("@", "")
            temp = findMember(name.toLowerCase(), false)
            if (temp) asker = temp
            else return
        }
        response = "@" + asker.name + " has " + asker.currency.points + " " + config.currency + " [" + asker.currency.place + "/" + members.length + "]."
        setGif(user.username + " has " + asker.currency.points + " " + config.currency, "banner")
    } else
    if (command === "!stats") { //get your own stats
        var asker = findMember(user.username, true)
        if (words[1]) {
            name = words[1].replace("@", "")
            temp = findMember(name.toLowerCase(), false)
            if (temp) asker = temp
            else return
        }
        var time = asker.stats.minutesInChat
        var hours = Math.floor(time / 60)
        var minutes = time - hours * 60
        response = "@" + asker.name + " has spent " + hours + "h" + minutes + "m in chat. He might have said " + asker.stats.messagecount + " stuff."
    } else
    if (command.startsWith("!counter")) { //counter commands (to add counters)
        if ('!counteradd') {
            if (!words[1]) return
            counters.push({
                "name": words[1],
                "count": 0
            })
            response = "added counter: " + words[1]
        } else {
            response = "current counters: "
            for (var i = 0; i < counters.length; i++) {
                response += "!" + counters[i].name + " (" + counters[i] + ") - "
            }
        }
    } else
    if (command.startsWith("!quote")) { //quotes and stuff
        if (command === "!quoteadd") {
            restofmessage = ""
            for (var i = 2; i < words.length; i++) {
                restofmessage += words[i] + " "
            }
            if (!words[1]) return
            if (!restofmessage) return
            quotes.push({
                "quote": restofmessage,
                "author": words[1],
                "date": moment().format('ll')
            })
            response = "added a quote from " + words[1]
        } else {
            var quote = quotes[Math.floor(Math.random() * quotes.length)]
            response = '" ' + quote.quote + '" - ' + quote.author + " (" + quote.date + ")"
        }
    } else
    if (command === "!steal") { //user can steal someone's points (only if the other user is online)
        var thief = findMember(user.username, true)
        var victim
        if (words[1]) {
            name = words[1].replace("@", "")
            temp = findMember(name.toLowerCase(), false)
            if (temp) victim = temp
        }
        if (!victim) {
            client.say(config.twitchChannel, "@" + user.username + ", please make sure to steal from a real viewer!")
            return
        }
        if (!onlineMembers.includes(victim.name)) {
            client.say(config.twitchChannel, "@" + user.username + ", don't steal from someone who's not here! DansGame")
            return
        }
        r = Math.floor(Math.random() * 9 + 1)
        if (Math.random() * 100 > 50) { //success
            thief = changeCurrency(thief, "add", r)
            victim = changeCurrency(victim, "sub", r)
            response = "@" + thief.name + " has succesfully stolen " + r + " " + config.currency + " from " + victim.name + ". PogChamp"
            setGif(thief.name + " has stolen from " + victim.name, "banner")
        } else { //fail
            thief = changeCurrency(thief, "sub", r)
            victim = changeCurrency(victim, "add", r)
            response = "@" + thief.name + " has failed to steal from " + victim.name + " and lost " + r + " " + config.currency + " themself. LUL"
            setGif(thief.name + " has failed their theft", "banner")
        }
    } else
    if (command === "!tts") { //text to speech if user has more than 1500 points
        var cost = 1500
        var speaker = findMember(user.username, true)
        if (speaker.currency.points < cost) {
            client.say(config.twitchChannel, "@" + user.username + " you need " + cost + " " + config.currency + " to use this command.")
            return
        }
        if (restofmessage.length > 150) {
            client.say(config.twitchChannel, "@" + user.username + " your message is too long to be spoken, try again. FeelsBadMan")
            return
        }
        var filtered = ""
        for (var i = 1; i < words.length; i++) {
            if (badWords.includes(words[i])) filtered += goodWords[Math.floor(Math.random() * goodWords.length)] + " "
            else filtered += words[i] + " "
        }
        say.speak(user.username + "says: " + filtered)
    } else
    if (command === "!time") { //current time
        var now = new Date()
        var standardTime = now
        var targetTime = {
            "hour": now.getHours(),
            "minutes": now.getMinutes(),
            "AM": "AM",
            "emoji": "⏰"
        }
        console.log(targetTime.hour)
        if (targetTime.hour > 24) targetTime.hour -= 24
        console.log(targetTime.hour)
        if (targetTime.hour < 0) targetTime.hour += 24
        console.log(targetTime.hour)
        if (targetTime.minutes < 10) targetTime.minutes = "0" + targetTime.minutes
        if (targetTime.hour >= 12) {
            targetTime.hour -= 12
            targetTime.AM = "PM"
        }
        targetTime.emoji = config.clocks[targetTime.hour]

        response = "My time: " + targetTime.emoji + " " + targetTime.hour + ":" + targetTime.minutes + targetTime.AM + " " + targetTime.emoji
        setGif("time: " + targetTime.emoji + " " + targetTime.hour + ":" + targetTime.minutes + targetTime.AM + " " + targetTime.emoji, "banner")

    } else
    if (command === "!first") { //get user's first message
        asker = findMember(user.username, true)
        if (words[1]) {
            name = words[1].replace("@", "")
            temp = findMember(name.toLowerCase(), false)
            if (temp) asker = temp
        }
        if (!asker.stalk) {
            client.say(config.twitchChannel, "@" + user.username + " " + asker.name + " hasn't spoken in here yet")
            return
        }
        var firstMessagetime = asker.stalk.firstseen.split("T")
        var firstMessageDate = firstMessagetime[0].split("-")
        var firstMessageTimeAndZone = firstMessagetime[1].split("+")
        var firstMessageTime = firstMessageTimeAndZone[0].split(':')
        var whenTime = moment(firstMessageDate[0] + firstMessageDate[1] + firstMessageDate[2] + firstMessageTime[0] + firstMessageTime[1] + firstMessageTime[2], "YYYYMMDDhhmmss").fromNow()
        response = '" ' + asker.stalk.firstmessage + ' "  by @' + asker.name + '(' + whenTime + ')'
    } else
    if (command === "!stalk") { //gets user last message
        if (!words[1]) {
            client.say(config.twitchChannel, "@" + user.username + " who do you even want to stalk? :thinking:")
            return
        }

        name = words[1].replace("@", "")
        asker = findMember(name.toLowerCase(), false)
        if (!asker) return
        if (asker.name === user.username) {
            client.say(config.twitchChannel, "@" + user.username + " don't stalk yourself FailFish")
            return
        }
        if (!asker.stalk) {
            client.say(config.twitchChannel, "@" + user.username + " " + asker.name + " hasn't spoken in here yet")
            return
        }

        var lastMessagetime = asker.stalk.lastseen.split("T")
        var lastMessageDate = lastMessagetime[0].split("-")
        var lastMessageTimeAndZone = lastMessagetime[1].split("+")
        var lastMessageTime = lastMessageTimeAndZone[0].split(':')
        var whenTime = moment(lastMessageDate[0] + lastMessageDate[1] + lastMessageDate[2] + lastMessageTime[0] + lastMessageTime[1] + lastMessageTime[2], "YYYYMMDDhhmmss").fromNow()
        response = 'last message by @' + asker.name + ' " ' + asker.stalk.lastmessage + ' " ' + '(' + whenTime + ')'
    } else
    if (command === "!give") { //give points to other users
        var giver = findMember(user.username, true)
        var receiver
        if (words[1]) {
            name = words[1].replace("@", "")
            temp = findMember(name.toLowerCase(), false)
            if (temp) receiver = temp
            else return
        }
        if (!isNaN(words[2])) {
            if (!user.mod && user.username.toLowerCase() !== config.twitchChannel)
                giver = changeCurrency(giver, "sub", words[2])
            if (!isAllowed) {
                client.say(config.twitchChannel, "@" + user.username + " not enough " + config.currency + ". you only have " + asker.currency.points + " " + config.currency + " FeelsBadMan")
                return
            }
            receiver = changeCurrency(receiver, "add", words[2])
            response = "@" + receiver.name + ", you have received " + words[2] + " " + config.currency + " from @" + giver.name
            setGif(user.username + " gave " + words[2] + " to " + receiver.name, "banner")
        }
    } else
    if (command === "!slots") { //slots game
        var gambler = findMember(user.username)
        var Aemotes = config.slotEmotes
        var slots = new Array()
        if (!isNaN(words[1])) {
            gambleAmount = parseInt(words[1])
            gambler = changeCurrency(gambler, "sub", gambleAmount)
        } else
        if (words[1] === "all") {
            gambleAmount = gambler.currency.points
            gambler = changeCurrency(gambler, "sub", gambleAmount)
        } else
            return
        if (!isAllowed) {
            client.say(config.twitchChannel, "@" + user.username + " not enough " + config.currency + ". you only have " + gambler.currency.points + " " + config.currency + " FeelsBadMan")
            return
        }
        for (var i = 0; i < 3; i++) {
            slots[i] = Aemotes[Math.floor(Math.random() * Aemotes.length)]
            response += slots[i]
            if (i < 2) response += " - "
        }
        var score = 1
        if (slots[0] === slots[1] && slots[1] === slots[2])
            score = 3
        else if (slots[0] === slots[1])
            score = 2
        else if (slots[0] === slots[2])
            score = 2
        else if (slots[1] === slots[2])
            score = 2
        switch (score) {
            case 1:
                response += " Better luck next time "
                multiplier = 0
                setGif(user.username + " should try one more time", "banner")
                break
            case 2:
                response += " Close one!"
                multiplier = 5
                setGif(user.username + " almost got the jackpot", "banner")
                break
            case 3:
                response += " JACKPOT"
                multiplier = 20
                asker.games.slotJackpots = asker.games.slotJackpots + 1
                setGif(user.username + " HAS HIT THE JACKPOT", "banner")
                break
        }

        gambler = changeCurrency(gambler, "add", gambleAmount * multiplier)
        var gain = gambleAmount * multiplier - gambleAmount
        var state = "won"
        if (gain < 0) {
            state = "lost"
            gain = gambleAmount
        }
        response += " you have " + state + " " + gain + " " + config.currency
    }

    if (response)
        client.say(config.twitchChannel, response)
    if (command === "!save" && user.username === "mrjunior717") {
        writeArrays()
    }
}

function getResponse(questionWord) { //for !ask command
    var returnValue;
    switch (questionWord) {
        case "when":
            returnValue = config.questionWordsResponses.when[Math.floor(Math.random() * (config.questionWordsResponses.when.length - 1))]
            break;
        case "what":
            returnValue = config.questionWordsResponses.what[Math.floor(Math.random() * (config.questionWordsResponses.what.length - 1))]
            break;
        case "how":
            returnValue = config.questionWordsResponses.how[Math.floor(Math.random() * (config.questionWordsResponses.how.length - 1))]
            break;
        case "who":
            returnValue = config.questionWordsResponses.who[Math.floor(Math.random() * (config.questionWordsResponses.who.length - 1))]
            break;
        case "where":
            returnValue = config.questionWordsResponses.where[Math.floor(Math.random() * (config.questionWordsResponses.where.length - 1))]
            break;
        case "why":
            returnValue = config.questionWordsResponses.why[Math.floor(Math.random() * (config.questionWordsResponses.why.length - 1))]
            break;
    }
    return returnValue;
}

function addMessage(user, message) { //adds message to used (and some other data too)
    var asker = findMember(user, true)
    if (!asker.stalk) asker.stalk = {}
    if (!asker.stalk.firstmessage) asker.stalk.firstmessage = message
    if (!asker.stalk.firstseen) asker.stalk.firstseen = moment().format();
    asker.stalk.lastmessage = message
    asker.stalk.lastseen = moment().format();
    asker.stats.messagecount += 1
}

function findCommand(command) { //find command from saved commands
    for (var i = 0; i < commands.length; i++) {
        if (commands[i].name === command) return commands[i]
    }
    return null
}

function sort(type) { //sort functions for big array
    if (type === "points") {
        members = members.sort(compareF)
        for (var i = 0; i < members.length; i++)
            members[i].currency.place = i + 1
    }
    if (type === "time")
        members = members.sort(compareT)

    function compareF(a, b) {
        if (a.currency.points < b.currency.points)
            return 1
        if (a.currency.points > b.currency.points)
            return -1
        return 0
    }

    function compareT(a, b) {
        if (a.stats.minutesInChat < b.stats.minutesInChat)
            return 1
        if (a.stats.minutesInChat > b.stats.minutesInChat)
            return -1
        return 0
    }
}

function givePoints() { //loops every 10minutes, adds minutes to stat and gives points
    setTimeout(function () {
        console.log("live")
        for (var i = 0; i < onlineMembers.length; i++) {
            var user = findMember(onlineMembers[i], true)
            user = changeCurrency(user, 'add', 10)
            user.stats.minutesInChat = user.stats.minutesInChat + 10
        }
        writeArrays();
        client.say(config.twitchChannel, "test me! try to use !first, !stalk, !meatball, !" + config.currency + ", !gamble, !lurk, !ask, !ban, !counter, !steal, !stats, !tts, !quote and !command")

        givePoints()

    }, 1000 * 60 * 10)
}

function changeCurrency(memberC, AddOrSub, amount) { //try to add/subtract points from member
    amount = Math.abs(amount)
    if (AddOrSub === "add") {
        memberC.currency.points += amount
        if (memberC.currency.points > memberC.stats.maxpoints)
            memberC.stats.maxpoints = memberC.currency.points
    } else
    if (AddOrSub === "sub") {
        if ((memberC.currency.points - amount) >= 0)
            memberC.currency.points -= amount
        else isAllowed = false
    }
    return memberC
}

function findMember(Fuser, newU) { //find member based on name
    for (var i = 0; i < members.length; i++) {
        if (members[i].name === Fuser)
            return members[i]
    }
    if (newU) {
        var Nuser = addMember(Fuser)
        return Nuser
    } else return null
}

function addMember(name) { //add member to the big list
    var Nmember = {
        "name": name,
        "games": {
            "gamblewins": 0,
            "gamblelosses": 0,
            "hits": 0,
            "misses": 0
        },
        "stats": {
            "messagecount": 0,
            "maxpoints": 100,
            "minutesInChat": 0
        },
        "currency": {
            "points": 100,
            "place": members.length,
            "gamechance": 50
        }
    }
    members.push(Nmember)
    console.log("added " + Nmember.name)
    return Nmember
}


function changeWord(message) {
    var words = message.split(" ")
    var r = Math.floor(Math.random() * words.length)
    console.log(r)
    var out = ""
    for (var i = 0; i < words.length; i++) {
        if (i == r) out += "quack "
        else out += words[i] + " "
    }
    console.log("changing word: " + out)
    client.say(config.twitchChannel, out)
}

function setGif(link, variable) { //set gif for webserver
    switch (variable) {
        case "banner":
            bannerS = link
            setTimeout(() => {
                bannerS = " "
            }, 6000)
            break
        case "activeGif":
            activeGif = link
            setTimeout(() => {
                activeGif = "trans.png"
            }, 10000)
            break
    }
}


function write(file, array) {
    sort("points")
    try {
        var transformStream = JSONStream.stringify()
        var outputStream = fileSystem.createWriteStream(__dirname + file)
        transformStream.pipe(outputStream)
        array.forEach(transformStream.write)
        transformStream.end()
        outputStream.on(
            "finish",
            function handleFinish() {
                //finish
            }
        )
        outputStream.on(
            "finish",
            function handleFinish() {
                var transformStream = JSONStream.parse("*")
                var inputStream = fileSystem.createReadStream(__dirname + file)
                inputStream
                    .pipe(transformStream)
                    .on(
                        "data",
                        function handleRecord(data) {
                            //writing
                        }
                    )
                    .on(
                        "end",
                        function handleEnd() {
                            console.log("JSONStream parsing complete!")
                        }
                    )
            }
        )
    } catch (err) {
        console.log(err)
    }
}

function writeArrays() {
    write(membersFile, members)
    setTimeout(function () {
        write(dataFile, data)

    }, 5000)
}

app.listen(3000);
