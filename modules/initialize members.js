var jsonfile = require('jsonfile')
const config = require("./config.json");
var fileSystem = require("fs");
var JSONStream = require("JSONStream");

var file = "/members.json"

var output = new Array();

output[0] = {
    "name": "mrjunior717",
    "id": "58355428",
    "games": {
        "gamblewins": 0,
        "gamblelosses": 0
    },
    "stats": {
        "messagecount": 0,
        "maxpoints": 100,
        "minutesInChat": 0
    },
    "currency": {
        "points": 100,
        "place": 1,
        "gamechance": 50
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

    })
