
var CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';

function Async(task) {

	var gen = task(callback);

	function callback(err, result) {

		if (err) {
			throw err;
		} else {
			gen.next(result);
		}

	};

	gen.next();

};

function MakeIdentity() {

	var identity = '';

	for(var i = 0; i < 8; i++) {

		identity += CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];

	}

	return identity;

}

function Message(type, data) {

	return JSON.stringify({
		type : type,
		data : data
	}, null, 4);

}

module.exports.Async = Async;
module.exports.MakeIdentity = MakeIdentity;
module.exports.Message = Message;
