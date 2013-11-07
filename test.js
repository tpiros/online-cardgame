var Utils = require("./utils.js");
var utils = new Utils();

function isActionCard(card, penalising) {
  penalising = (typeof penalising === "undefined") ? false : penalising;
  if (card && !penalising) {
    var cardNumber = parseInt(card);
    if (cardNumber in utils.has(["1", "2", "13"])) {
      return true;
    } else {
      return false;
    }
  }
  if (card && penalising) {
    console.log("should never see this");
    var cardNumber = parseInt(card);
    if (cardNumber === 2) {
      return true;
    } else {
      return false;
    }
  }
}

function removeDuplicates(arr) {
  arr.sort();
  var i = arr.length - 1;
  while (i > 0) {
    if (arr[i] === arr[i - 1]) {
      arr.splice(i, 1); 
    } 
    i--;
  }
}

function isSuiteInHand(suite, hand){
  if (suite) {
    var suitesInHand = [];
    for (var i = 0; i < hand.length; i++) {
      console.log(hand[i]);
      suitesInHand.push(hand[i][hand[i].length-1]);
    }
    if (utils.indexOf(suitesInHand, suite) > -1) {
      return true;
    } else {
      return false;
    }
  }
}

var s = "H";
var h = ["2D","1S","1D","2C"];


console.log(isSuiteInHand(s, h));