
'use strict';

var MWS = require('ws');

var Util = require('./util');

var Status = require('./status');

var Slaves = {};

Slaves.ToJSON = function() {

	var slaves = {};
	for(var it in Slaves) {
		slaves[it] = Slaves[it].slave;
	}

	return slaves;
		
};

var Users = {};

Users.ToJSON = function() {

	var users = {};
	for(var it in Users) {
		users[it] = Users[it].user;
	}

	return users;
		
};

var Messages = [];

var Forwards = [];

var SlaveServer = new MWS.Server({
	port: 23333
});

SlaveServer.on('connection', function(ws) {
	
	console.log('new slave connected.');

	var s = ws.slave = {};

	ws.on('message', function(message) {

		try {

			var json = JSON.parse(message);
			console.log(json.type);
			ws.emit(json.type, json.data);

		} catch (err) {
			console.error(err);
			console.error(message);
		}

	});

	ws.on('close', function() {

		console.log('slave, close.');

		// TODO: 移除废弃的Slave。
		for(var it in Slaves) {
			
			if(s.address == it) {
				delete Slaves[s.address];
			}
			
		}

	});
	
	ws.on('register', function(data) {
		
		s.address = ws._socket.remoteAddress + ':' + ws._socket.remotePort;
		
		s.name = data.name;
		
		Slaves[s.address] = ws;
		
	});
	
	ws.on('forward', function(data) {
		
		Users[data.address].send(Util.Message('forward', {
			status : data.status,
			heartbeatHost : data.heartbeatHost,
			heartbeatPort : data.heartbeatPort,
			listenHost : data.listenHost,
			listenPort : data.listenPort
		}));
		
	});

	ws.on('punch', function(data) {
		
		Users[data.address].send(Util.Message('punch', {
			status : data.status,
			punchHost : data.punchHost,
			punchPort : data.punchPort
		}));
		
	});

});

var UserServer = new MWS.Server({
	port : 18888
});

UserServer.Broadcast = function(not, message) {

	for ( var i in UserServer.clients) {

		var client = UserServer.clients[i];

		if(client != not) {
			client.send(message);
		}

	}

};

UserServer.BroadcastMessage = function(not, message, isToBeArchived) {

	UserServer.Broadcast(not, Util.Message('newMessage', {
		status : Status.SUCCESS,
		time : message.time,
		nickname : message.nickname,
		identity : message.identity,
		message : message.message
	}));

	if(isToBeArchived) {
		Messages.push(message);
	}

};

UserServer.on('connection', function(ws) {

	var u = ws.user = {};

	ws.on('message', function(message) {

		try {

			var json = JSON.parse(message);
			console.log(json.type);
			ws.emit(json.type, json.data);

		} catch (err) {
			console.error(err);
			console.error(message);
		}

	});

	ws.on('close', function() {

		console.log('client, close, nickname = ' + u.nickname + ', identity = ' + u.identity + '.');

		for (var it in Users) {

			if (u.address == it) {

				delete Users[it];

			}

		}

		UserServer.BroadcastMessage(ws, {
			status : Status.SUCCESS,
			time : Date.now(),
			nickname : 'Server',
			identity : '',
			message : u.nickname + '[' + u.identity + '] leaves.'
		});

		// TODO: 直接强制同步，不然还要leaveUser事件，还有userID字段，比较麻烦。

		UserServer.Broadcast(ws, Util.Message('users', {
			status : Status.SUCCESS,
			users : Users.ToJSON()
		}));

	});

	ws.on('register', function(data) {

		u.address = ws._socket.remoteAddress + ':' + ws._socket.remotePort;
		
		u.nickname = data.nickname;
		u.identity = Util.MakeIdentity();

		Users[u.address] = ws;

		ws.send(Util.Message('users', {
			status : Status.SUCCESS,
			users : Users.ToJSON()
		}));

		ws.send(Util.Message('messages', {
			status : Status.SUCCESS,
			messages : Messages
		}));

		UserServer.Broadcast(ws, Util.Message('newUser', {
			status : Status.SUCCESS,
			nickname : u.nickname,
			identity : u.identity
		}));

		UserServer.BroadcastMessage(null, {
			status : Status.SUCCESS,
			time : Date.now(),
			nickname : 'Server',
			identity : '',
			message : u.nickname + '[' + u.identity + '] joins in.'
		});

	});
	
	ws.on('changeNickname', function(data) {
		
		u.nickname = data.nickname;
		
		// 强制同步。
		UserServer.Broadcast(null, Util.Message('users', {
			status : Status.SUCCESS,
			users : Users.ToJSON()
		}));

	});

	ws.on('sendMessage', function(data) {

		UserServer.BroadcastMessage(null, {
			time: Date.now(),
			nickname: u.nickname,
			identity: u.identity,
			message: data.message
		}, true);

	});
	
	ws.on('getSlaves', function(data) {
		
		ws.send(Util.Message('slaves', {
			status: Status.SUCCESS,
			slaves: Slaves.ToJSON()
		}));
		
	});
	
	ws.on('mount', function(data) {
		
		Slaves[data.address].send(Util.Message('mount', {
			'type': data.type,
			'slaveHost': data.address.split(':')[0],
			'address': u.address
		}));
		
	});

	ws.on('getHost', function(data) {
		
		ws.send(Util.Message('host', {
			status: Status.SUCCESS,
			host: ws._socket.address().address
		}));
		
	});

});
