const discord = require('discord.js');
const client = new discord.Client();
const config = require("./config.json");
var output = require("./members.json");

var fileSystem = require("fs");
var JSONStream = require("JSONStream");

var file = "/members.json"



client.on('ready', () => {
    console.log('I am ready!');

    for (var i = 0; i < output.length; i++) {
        output[i].currency = {
            "points": 100,
            "place": i + 1,
            "gamechance": 50
        }
        output[i].stats = {
            "messagecount": 0,
            "gamblewins": 0,
            "gamblelosses": 0,
            "slotJackpots": 0,
            "maxpoints": output[i].currency.points,
        }
        output[i].seasonal = {
            "points": 0,
            "place": i + 1
        }
    }
    var transformStream = JSONStream.stringify();
    var outputStream = fileSystem.createWriteStream(__dirname + file);
    transformStream.pipe(outputStream);
    output.forEach(transformStream.write);
    transformStream.end();
    outputStream.on(
        "finish",
        function handleFinish() {
            console.log("JSONStream serialization complete!");
        }
    );
    outputStream.on(
        "finish",
        function handleFinish() {
            var transformStream = JSONStream.parse("*");
            var inputStream = fileSystem.createReadStream(__dirname + file);
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
                        console.log("JSONStream parsing complete!");
                    }
                );

        }
    );
})


client.login(config.token);
