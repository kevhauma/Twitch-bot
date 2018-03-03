var tmi = require('tmi.js');
var channelname = "MrJunior717"
var options = {
    options: {
        debug: true
    },
    connection: {
        "cluster": "aws",
        "reconnect": true
    },
    identity:{
        username: "MrJunior717",
        password: "oauth:qs91mr5vgw575jdublezjpt05ngv0v" //link provided
    },
    channels:[channelname]

    
    
}

var client = tmi.client(options);
client.connect();

client.on("connected",function(address,port){
    console.log("connected: " + address + ":" + port);
    client.action(channelname,"I am Live");
    
})

client.on("chat", function(channel, user, message,self){
        var words = message.split(" "); 
        var command = words[0];
        var response ="";
        if (command === '!spook'){
            if (words.length < 3 && words.length > 1){
                if (Math.random() > 0.5) response = user.username + " has spooked " + words[1]
                if (Math.random() <= 0.5) response = user.username + " has failed to spook " + words[1]
            }
            client.action(channelname, response);
        }
        

        
})