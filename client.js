var socket = io.connect("http://tamas:8080");


//var socket = io.connect("http://ec2-54-229-63-210.eu-west-1.compute.amazonaws.com:8080");
socket.on("logging", function(data) {
  $("#updates").append("<li>"+ data.message + "</li>");
  var log = document.getElementById('footer');
  log.scrollTop = log.scrollHeight;
});

socket.on("timer", function (data) {
  $('#counter').html(data.countdown);
  if (data.countdown === 0) {
    socket.emit("readyToPlay", {tableID: 1});
    $("#counter").hide();
  }
});

socket.on("playOption", function(data){
  $("#playOption").html(data.message);
  if (data.value) {
    $("#penalising").show();
  } else {
    $("#penalising").hide();
    $("#playOption").hide();
  }
});

socket.on("showRequestCardDialog", function(data) {
  if (data.option == "suite") {
    $("#suiteRequest").show();
  }
});



function playCard(key, value) {
  index = key;
  playedCard = value;
  /*if (parseInt(value) === 1) {
    console.log("request card");
    $("#suiteRequest").show();
    $("#suiteRequestBtn").click(function() {
      var request = $("#suiteRequestTxt").val();
      socket.emit("suiteRequest", {tableID: 1, request: request});
      socket.emit("playCard", {tableID:1, playedCard: playedCard, index: index});
      console.log("called with request ==> " + request);
    });
  } else {*/
    socket.emit("playCard", {tableID:1, playedCard: playedCard, index: index});
  //}
}

socket.on("play", function(data) {
  $("#hand").text("");
  $('#cards').find('option').remove().end();
  pixel = 0;
  $.each(data.hand, function(k, v) {
    index = k + 1;
    $("#hand").append("<div style='margin-top:2px; margin-left:" + pixel + "px; float: left; z-index:" + index + "''><img class='card"+k+"' width=100 src=resources/"+v+".png /></div>");
    $(".card"+k).click(function() { playCard(k, v); return false; });
    if (pixel >= 0) {
      pixel = (pixel + 40) * -1;
    } else {
      if (pixel <= -40)
        pixel = pixel -1;
      }
  });
});

socket.on("updatePackCount", function(data) {
  $("#pack").text("");
  $("#pack").html("Size of pack is: <span class='label label-info'>" + data.packCount + "</span>");
});

socket.on("updateCardsOnTable", function(data){
  $("#table").text("");
  if (data.lastCardOnTable == "") {
    $("#table").text("");
  } else {
    $("#table").append("<img width=100 src=resources/" + data.lastCardOnTable + ".png>");
  }
});

socket.on("turn", function(data) {
  if(data.won) {
    $("#playArea").hide();
    if (data.won == "yes") {
      $("#progressUpdate").html("<span class='label label-success'>You won - well done! Game over.</span>");
    } else {
      $("#progressUpdate").html("<span class='label label-info'>You lost - better luck next time. Game over.</span>");
    }
  } else {
    if(data.myturn) {
      $("#progressUpdate").html("<span class='label label-important'>It's your turn.</span>");
      socket.emit("preliminaryRoundCheck", {tableID: 1}); //When a player has a turn, we need to control a few items, this is what enables us to make it happen.
    } else {
      $("#progressUpdate").html("<span class='label label-info'>It's your opponent's turn.</span>");
    }
  }
});

socket.on("cardInHandCount", function(data) {
  var spanClass="badge-success";
  var plural = "s";
  if (data.cardsInHand <= 2) {
    spanClass = "badge-important";
  }
  if (data.cardsInHand <= 1) {
    plural = "";
  }
  $("#opponentCardCount").html("Your opponent has <span class='badge " + spanClass + "''>"+ data.cardsInHand + "</span> card"+plural+" in hand.");
});

socket.on("tableFull", function(){
  $("#tableFull").fadeIn("slow");
});

$(document).ready(function() {
  $("#tableFull").hide();
  $("#playArea").hide();
  $("#waiting").hide();
  $("#error").hide();
  $("#name").focus();
  $("#progressUpdate").hide();
  $("#penalising").hide();
  $("#numberRequest").hide();
  $("#suiteRequest").hide();
  $("form").submit(function(event){
    event.preventDefault();
  });

  $("#suiteRequestBtn").click(function() {
  var request = $("#suiteRequestTxt").val();
  socket.emit("suiteRequest", {tableID: 1, request: request});
  console.log("called with request ==> " + request);
  //socket.emit("suiteRequest", {request: request, tableID: 1});
  //socket.emit("playCard", {tableID:1, playedCard: playedCard, index: index});
});

  $("#join").click(function() {
    var name = $("#name").val();
    if (name.length>0) {
      socket.emit("connectToServer", {name: name});
      socket.emit('connectToTable', {tableID: 1});
      $("#loginForm").hide();
      $("#tableFull").hide();
      $("#waiting").show();
      socket.on("ready", function(data){
        $("#waiting").hide();
        $("#playArea").show();
        $("#progressUpdate").show();
      });
    } else {
      $("#error").show();
      $("#error").append('<p class="text-error">Please enter a name.</p>');
    }
  });

  $("#drawCard").click(function() {
    socket.emit("drawCard", {tableID: 1});
  });
  /*penalising card taken button*/ 
  $("#penalising").click(function() {
    socket.emit("penalisingTaken", {tableID: 1});
    $("#penalising").hide();
  });

});