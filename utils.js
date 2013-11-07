function Utils() {}
//not used anywhere
Utils.prototype.compressArray = function (original) {
	var compressed = [];
	// make a copy of the input array
	var copy = original.slice(0);
	// first loop goes over every element
	for (var i = 0; i < original.length; i++) {
		var myCount = 0;	
		// loop over every element in the copy and see if it's the same
		for (var w = 0; w < copy.length; w++) {
			if (original[i] == copy[w]) {
				// increase amount of times duplicate is found
				myCount++;
				// sets item to undefined
				delete copy[w];
			}
		}
		if (myCount > 0) {
			var a = new Object();
			a.value = original[i];
			a.count = myCount;
			compressed.push(a);
		}
	}
	return compressed;
};

Utils.prototype.last = function(array) {
	return array[array.length - 1];
}

Utils.prototype.indexOf = function(array, needle) {
    for(var i = 0; i < array.length; i++) {
        if(array[i] === needle) {
            return i;
        }
    }
    return -1;
}

Utils.prototype.has = function(array) {
  var r = {};
  for(var i=0;i<array.length;i++)
  {
    r[array[i]] = '';
  }
  return r;
}

module.exports = Utils;