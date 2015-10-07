var socket = require('socket.io');
var Game = require('./game.js');
var Player = require("./player.js");
var Messaging = require('./messaging.js');
var Table = require('./table.js');
var Room = require('./room.js');
var Utils = require('./utils.js');
utils = new Utils();
var firstRound = 1;

//setup an Express server to serve the content
var http = require("http");
var express = require("express");
var app = express();

app.use("/", express.static(__dirname + "/"));
app.use("/resources", express.static(__dirname + "/resources"));
var server = http.createServer(app);
server.listen(8080);
var io = socket.listen(server);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
io.set("log level", 1);

//creating the messaging object & testroom with sample table
var messaging = new Messaging();
var room = new Room("Test Room");
room.tables = messaging.createSampleTables(1);

//starting the socket and awaiting connections
io.sockets.on('connection', function (socket) {

  /*
  When a player connects to the server,  we immediately create the player object.
    - the Player's name comes from frontend.
    - the player ID is the socket.ID
    - every player by default will be added to a room ("lounge")
  Message is shown in the logging board
  */
  socket.on('connectToServer',function(data) {
    var player = new Player(socket.id);
    var name = data.name; //get the player's name
    player.setName(name);
    room.addPlayer(player); //add to room -- all players go to a room first
    io.sockets.emit("logging", {message: name + " has connected."});
  });

  /* 
  When someone connects to a table we need to do a few things:
  These include:
    - check if there's space at the table where they want to connect
    - assign the player to a table (if available)
    - change the player's status from 'available' to 'in table'
    - save the player's name, and ID (socket client ID) in the appropriate arrays at the table.

  If a table has 2 players, we need to do more:
    - set the table's status from 'available' to 'unavailable'
    - create a pack (instantiate the game object)
    - send a time counter of 3 seconds to both connected clients
    - after the 3 second delay, emit a 'PLAY' message
  */

  socket.on('connectToTable',function(data) {
    var player = room.getPlayer(socket.id);
    var table = room.getTable(data.tableID);
    if (table.addPlayer(player) && table.isTableAvailable()) {
      player.tableID = table.id;
      player.status = "intable";
      table.playersID.push(socket.id); //probably not needed
      io.sockets.emit("logging", {message: player.name + " has connected to table: " + table.name + "."});
      if (table.players.length < 2) {
        io.sockets.emit("logging", {message: "There is " + table.players.length + " player at this table. The table requires " + table.playerLimit + " players to join." });
        io.sockets.emit("waiting", {message: "Waiting for other player to join."});
      } else {
        io.sockets.emit("logging", {message: "There are " + table.players.length + " players at this table. Play will commence shortly." });
        //emit counter
        var countdown = 1; //3 seconds in reality...
        setInterval(function() {
          countdown--;
          io.sockets.emit('timer', { countdown: countdown });
        }, 1000);
      }
    } else {
      console.log("for whatever reason player can't be added to table."); //needs looking at
    }
  });
  
  /*
  Once the counter has finished both clients will emit a "readyToPlay" message
  Upon the receival of this message, we check against a local variable (never trust data from the client) and
  we setup the play environment:
    - change the table's state to "unavailable"
    - change the player's status to "playing"
    - assign 5 cards to each player
    - flip the first card
      - we are going to check if this card is an action card
      - if it is, we will call the appropriate action
    - otherwise we are going to assign the start priviledge to a random player at the table
  */

  socket.on("readyToPlay", function(data) {
    console.log("Ready to play called");
    var player = room.getPlayer(socket.id);
    var table = room.getTable(data.tableID);
    player.status = "playing";
    table.readyToPlayCounter++;
    var randomNumber = Math.floor(Math.random() * table.playerLimit);
    if (table.readyToPlayCounter === table.playerLimit) {
      var firstCardOnTable = table.cardsOnTable = table.gameObj.playFirstCardToTable(table.pack); //assign first card on table
      table.status = "unavailable"; //set the table status to unavailable
      for (var i = 0; i < table.players.length; i++) { //go through the players array (contains all players sitting at a table)
        table.players[i].hand = table.gameObj.drawCard(table.pack, 5, "", 1); //assign initial 5 cards to players
        var startingPlayerID = table.playersID[randomNumber]; //get the ID of the randomly selected player who will start
        if (table.players[i].id === startingPlayerID) { //this player will start the turn
          table.players[i].turnFinished = false;
          console.log(table.players[i].name + " starts the game.");
          io.sockets.connected[table.players[i].id].emit("play", { hand: table.players[i].hand }); //send the cards in hands to player
          io.sockets.connected[table.players[i].id].emit("turn", { myturn: true }); //send the turn-signal to player
          io.sockets.connected[table.players[i].id].emit("ready", { ready: true }); //send the 'ready' signal
          if (table.gameObj.isActionCard(firstCardOnTable)) { //Is the first card on the table an action card?
            table.actionCard = true; //we are setting the action card flag to true -- this is required as the preliminary check is going to use this
          }
          io.sockets.connected[table.players[i].id].emit("cardInHandCount", {cardsInHand: table.players[i].hand.length});
        } else {
          table.players[i].turnFinished = true;
          console.log(table.players[i].name + " will not start the game.");
          io.sockets.connected[table.players[i].id].emit("play", { hand: table.players[i].hand }); //send the card in hands to player
          io.sockets.connected[table.players[i].id].emit("turn", { myturn: false }); //send the turn-signal to player
          io.sockets.connected[table.players[i].id].emit("ready", { ready: true }); //send the 'ready' signal
          io.sockets.connected[table.players[i].id].emit("cardInHandCount", {cardsInHand: table.players[i].hand.length});
        }
      }
      //sends the cards to the table.
      messaging.sendEventToAllPlayers('updateCardsOnTable', {cardsOnTable: table.cardsOnTable, lastCardOnTable: table.cardsOnTable}, io, table.players);
      io.sockets.emit('updatePackCount', {packCount: table.pack.length});
    }
  });

/*
Before the players have a chance to play in their respective turns
i.e. draw or play a card, we are going to do preliminary checks
These checks will determine whether there are (active) requests  or
(active) penalising cards on the table
*/

socket.on("preliminaryRoundCheck", function(data) {
  console.log("preliminary round check called.");
  var player = room.getPlayer(socket.id);
  var table = room.getTable(data.tableID);
  var last = table.gameObj.lastCardOnTable(table.cardsOnTable); //last card on Table
  console.log('Last card on table ==>' + last);

    if (table.gameObj.isActionCard(last) && table.actionCard) { //Is the card on the table an action card?
      if (table.gameObj.isActionCard(last, true)) { //Is the first card on the table a penalising card? (2*) (checked by the true flag)
        table.forcedDraw += 2; //add 2 cards to the forcedDraw function
        table.penalisingActionCard = true;
        console.log("FORCED DRAW ==>" + table.forcedDraw);
        console.log("it's a penalising card");
        if (table.gameObj.isInHand(last, player.hand)) { //Does the starting player have a response in hand?
          console.log("I have a 2, optionally i can play it"); //GIVE OPTIONS
          socket.emit("playOption", { message: "You have a 2 card in your hand, you can either play it or take " + table.forcedDraw + " cards.", value: true}); //OPTION - TRUE
        } else {
          console.log("no 2 in hand, force me to draw"); //No penalising action card in hand, force draw
          console.log("HAND ==> " + player.hand);
          socket.emit("playOption", { value: false }); //OPTION - TRUE
          table.gameObj.drawCard(table.pack, table.forcedDraw, player.hand, 0);
          socket.emit("play", { hand: player.hand }); //send the card in hands to player
          io.sockets.emit('updatePackCount', {packCount: table.pack.length});
          table.forcedDraw = 0; //reset forced Draw variable
          table.actionCard = false; //set the action card to false
          table.penalisingActionCard = false; //reset the penalising action card variable
          /*PROGRESS ROUND*/
          table.progressRound(player); //end of turn
          socket.emit("turn", {myturn: false}); //????
          messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
          messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
        }
      } else { //Is the first card on the table a request card (1*, 13*)
        console.log("it is a request card, player to make a request"); //SHOW REQUEST WINDOW
        var option = "number";
        if(parseInt(last) === 1) {
          option = "suite";
        }
        if (firstRound === 1) {
          socket.emit("showRequestCardDialog", { option: option });
        }
        //table.requestActionCard = true; //set the flag at the table
        if (table.request && table.requestActionCard) {//request has already been made
          console.log("asked for a suite ==> " + table.suiteRequest);
          messaging.sendEventToAllPlayersButPlayer("logging", {message: "Your opponent has asked for a suite ==>" + table.suiteRequest}, io, table.players, player);
          if (table.gameObj.isSuiteInHand(table.suiteRequest, player.hand)) {
            io.sockets.emit("logging", {message: "Your opponent has asked for a suite ==>" + table.suiteRequest});
            console.log("The requested suite is in your hand ==> " + table.suiteRequest);
          } else { //the suite is not in the hand
            if (table.gameObj.isInHand(last, player.hand)) { //give option for the player to play the same type of a request card
              socket.emit("playOption", { message: "You have a request action card in your hand you can optionally play it.", value: true}); //OPTION - TRUE
              console.log("You have an answer in your hand");
            } else { //no requested suite nor contra-action card in hand, force draw
              console.log("Forced draw");
              socket.emit("playOption", { value: false }); //OPTION - TRUE
              table.gameObj.drawCard(table.pack, 1, player.hand, 0);
              socket.emit("play", { hand: player.hand }); //send the card in hands to player
              io.sockets.emit('updatePackCount', {packCount: table.pack.length});
              table.requestActionCard = null; //reset request
              table.actionCard = false; //set the action card to false
              /*PROGRESS ROUND*/
              table.progressRound(player); //end of turn
              socket.emit("turn", {myturn: false}); //????
              messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
              messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
            }
          }
        }
      }
    } else { //The first card on the table is not an action card at all
      console.log(last + " is not an action card or we don't care about it anymore");
    }
  console.log("Table ==> " + JSON.stringify(table));
  firstRound--;
});

  /* 
  A player can decide to the penalty as a result of a penalising card (2*), if he does
  then we need to reset the right variables and also end this player's turn.
  */

  socket.on("penalisingTaken", function(data) {
    var player = room.getPlayer(socket.id);
    var table = room.getTable(data.tableID);
    if (table.actionCard) {
      table.gameObj.drawCard(table.pack, table.forcedDraw, player.hand, 0);
      socket.emit("play", { hand: player.hand }); //send the card in hands to player
      io.sockets.emit('updatePackCount', {packCount: table.pack.length});
      table.forcedDraw = 0; //reset forced Draw variable
      table.actionCard = false; //set the action card to false
      table.penalisingActionCard = false; //set the penalising action card to false;
      /*PROGRESS ROUND*/
      table.progressRound(player); //end of turn
      socket.emit("turn", {myturn: false}); //????
      messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
      messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
    }
  });

  socket.on("suiteRequest", function(data) {
    var player = room.getPlayer(socket.id);
    var table = room.getTable(data.tableID);
    table.suiteRequest = data.request;
    console.log("request: " + data.request);
  });

  socket.on("disconnect", function() {
    var player = room.getPlayer(socket.id);
    if (player && player.status === "intable") { //make sure that player either exists or if player was in table (we don't want to remove players)
      //Remove from table
      var table = room.getTable(player.tableID);
      table.removePlayer(player);
      table.status = "available";
      player.status = "available";
      io.sockets.emit("logging", {message: player.name + " has left the table."});
    } 
  });

  socket.on("drawCard", function(data) {
      var player = room.getPlayer(socket.id);
      var table = room.getTable(data.tableID);
      if (!table.actionCard) { //action card start (listener), if there's an action card, we disable drawing
        if (!player.turnFinished) {
          var card = table.gameObj.drawCard(table.pack, 1, player.hand, 0);
          if (table.pack.length < 1) { //when we drew the last card
            var newPack = table.cardsOnTable; //remember the last card
            if (table.pack.length != 1) {
              newPack.pop(); //create new pack
            }
            var last = table.gameObj.lastCardOnTable(newPack); //last card on Table
            table.pack = table.gameObj._shufflePack(table.cardsOnTable); //shuffle the new pack
            table.cardsOnTable = last; //add the last card back on the table
          }
          socket.emit("play", {hand: player.hand});
          messaging.sendEventToAPlayer("logging", {message: "You took " + card + " from the pack."}, io, table.players, player);
          io.sockets.emit('updatePackCount', { packCount: table.pack.length });
          table.progressRound(player); //end of turn
          messaging.sendEventToAPlayer("turn", {myturn: false}, io, table.players, player);
          messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
          messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
        } else {
          messaging.sendEventToAPlayer("logging", {message: "It's your opponent's turn."}, io, table.players, player);
        }
      }//end of actioncard
  });

  socket.on("playCard", function(data) {
      /*
      server needs to check:
      - if it's the player's turn
      - if the played card is in the owner's hand
      - if the played card's index, matches the server side index value
      - if the played card is valid to play
      */
      var errorFlag = false;
      var player = room.getPlayer(socket.id);
      var table = room.getTable(data.tableID);
      var last = table.gameObj.lastCardOnTable(table.cardsOnTable); //last card on Table

      if (!player.turnFinished) {
        var playedCard = data.playedCard;
        var index = data.index; //from client
        var serverIndex = utils.indexOf(player.hand, data.playedCard);

        console.log("index => " + index + " | serverindex ==> " + serverIndex);

        if (index == serverIndex) {
          errorFlag = false;
        } else {
          errorFlag = true;
          playedCard = null;
          messaging.sendEventToAPlayer("logging", {message: "Index mismatch - you have altered with the code."}, io, table.players, player);
          socket.emit("play", {hand: player.hand});
        }

        if (utils.indexOf(player.hand, data.playedCard) > -1) {
          errorFlag = false;
          playedCard = data.playedCard; //overwrite playedCard
        } else {
          errorFlag = true;
          playedCard = null;
          messaging.sendEventToAPlayer("logging", {message: "The card is not in your hand."}, io, table.players, player);
          socket.emit("play", {hand: player.hand});
        }
        if (!errorFlag) {
          if (table.actionCard) { //if the action card varialbe is already set ...
            if (table.penalisingActionCard) {
              if (!table.gameObj.isPenalisingActionCardPlayable(playedCard, last)) {
                messaging.sendEventToAPlayer("logging", {message: "The selected card cannot be played - please read the rules."}, io, table.players, player); 
              } else {
                  console.log("Penalising action card is playable");
                  if (parseInt(playedCard) === 2) { //if there's a penalising action card, the player can only play another penalising action card.
                    console.log("if player plays a 2 we append the forced card limit");
                    //we are going to hide the option
                    socket.emit("playOption", { value: false }); //OPTION - FALSE
                    table.actionCard = true;
                    table.penalisingActionCard = true;
                  }
                table.gameObj.playCard(index, player.hand, table.cardsOnTable);
                messaging.sendEventToAllPlayers('updateCardsOnTable', {cardsOnTable: table.cardsOnTable, lastCardOnTable: playedCard}, io, table.players);
                io.sockets.emit("logging", {message: player.name + " plays a card: " + playedCard});
                table.progressRound(player); //end of turn
                //notify frontend
                messaging.sendEventToAPlayer("turn", {myturn: false}, io, table.players, player);
                messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
                messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
                var winner = table.gameObj.isWinning(player.hand);
                if (!winner) {
                  socket.emit("play", {hand: player.hand});
                } else {
                //game is finished
                socket.emit("play", {hand: player.hand});
                messaging.sendEventToAPlayer("turn", {won: "yes"}, io, table.players, player);
                messaging.sendEventToAllPlayersButPlayer("turn", {won: "no"}, io, table.players, player);
                socket.emit("gameover", {gameover: true});
                io.sockets.emit("logging", {message: player.name + " is the WINNER!"});
                }
              }
            } //end of penalising action card
            if (table.gameObj.isActionCard(playedCard)) {
                    socket.emit("playOption", { value: false }); //OPTION - FALSE
                    table.actionCard = true;
                    table.penalisingActionCard = true;
          }

          }
          else { //no action card variable is set at the moment
            var requestMade = false;
            if (!table.gameObj.isCardPlayable(playedCard, last)) {
              messaging.sendEventToAPlayer("logging", {message: "The selected card cannot be played - please read the rules."}, io, table.players, player); 
            } else {
              if (parseInt(playedCard) === 2) { //if player plays a 2 we add the right flags
                console.log("if player plays a 2 we append the forced card limit");
                table.actionCard = true;
                table.penalisingActionCard = true;
              }
              if (parseInt(playedCard) === 1) {
                var option = "suite"
                table.actionCard = true;
                table.requestActionCard = true;
                console.log("in here");
                messaging.sendEventToAPlayer("logging", {message: "YESSSSSSS"}, io, table.players, player);
                messaging.sendEventToAPlayer("showRequestCardDialog", {option: option}, io, table.players, player);

              }

              /*if (parseInt(playedCard) === 13) {
                table.actionCard = true;
                table.requestActionCard = true;
              } */
              table.gameObj.playCard(index, player.hand, table.cardsOnTable);
              messaging.sendEventToAllPlayers('updateCardsOnTable', {cardsOnTable: table.cardsOnTable, lastCardOnTable: playedCard}, io, table.players);
              io.sockets.emit("logging", {message: player.name + " plays a card: " + playedCard});
              table.progressRound(player); //end of turn
              //notify frontend
              messaging.sendEventToAPlayer("turn", {myturn: false}, io, table.players, player);
              messaging.sendEventToAllPlayersButPlayer("turn", {myturn: true}, io, table.players, player);
              messaging.sendEventToAllPlayersButPlayer("cardInHandCount", {cardsInHand: player.hand.length}, io, table.players, player);
              var winner = table.gameObj.isWinning(player.hand);
              if (!winner) {
                socket.emit("play", {hand: player.hand});
              } else {
              //game is finished
              socket.emit("play", {hand: player.hand});
              messaging.sendEventToAPlayer("turn", {won: "yes"}, io, table.players, player);
              messaging.sendEventToAllPlayersButPlayer("turn", {won: "no"}, io, table.players, player);
              socket.emit("gameover", {gameover: true});
              io.sockets.emit("logging", {message: player.name + " is the WINNER!"});
              }
            }
          } 
        } else {
            io.sockets.emit("logging", {message: "Error flag is TRUE, something went wrong"});
        }
      } else { //end of turn
        messaging.sendEventToAPlayer("logging", {message: "It's your opponent's turn."}, io, table.players, player);
    }
  });

  socket.on("suiteRequest", function(data) {
    if (data) {
      var table = room.getTable(data.tableID);
      messaging.sendEventToAllPlayersButPlayer("logging", {message: "Request for Suite: " + data.suite}, io, table.players, player);
      table.actionCard = true;
      table.requestActionCard = true;
      console.log(table);
    }
  });
});//end of socket.on