var express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	sockets = {},
	clientes = {};
var Static = require('node-static');
	
var url = 'http://localhost/OvniBus.WcfService/Service1.svc',
	headers = {'Content-Type': 'application/json'};
	
var ClientRest = require('node-rest-client').Client;

client = new ClientRest();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3001;  
var router = express.Router();  

router.route('/users').post(function(req, res) {
	try {
		agregarUser(req.body.nick_name, req.body.email, req.body.password, req.body.tipo_dispositivo, req.body.telefono, req.body.push_id,  function(err,user){
			if(err){
				res.send(err);
			}else{
				res.json({ respuesta : 0, message: 'Usuario creado exitosamente!' , output: [user]});		
			}
		})
	}
	catch(err) {
		res.send(err);
	}
}).get(function(req, res) {
		User.findAll({}).complete(function(err,results) {
			if(err){
				res.send(err);
			}else{
				res.json({ respuesta : 0, message: 'Usuario creado exitosamente!' , output: results});		
			}
		});	
	});
	
app.use('/api', router);
	
server.listen(port);
console.log('Magic happens on port ' + port);

var files = new Static.Server('./public');

function handler (request, response) {
	request.on('end', function() {
		files.serve(request, response);
	}).resume();
}


app.get('/mapa', function(req, res){
	res.sendfile(__dirname + '/public/index.html');
});

io.sockets.on('connection',function(socket){
	console.log('Nueva conexion');	
	socket.on('hola', function(data){
		console.log(data);	
		for (cli in sockets) {
			sockets[cli].emit('hola1', data);
		}
	});
	
	socket.on('hola2', function(data){		
		console.log(data+'app2');	
		socket.nickname = data+'app2';		
		sockets[socket.nickname] = socket; 
	});
	
	socket.on('cliente', function(data){	
		if(data.imei in sockets){
			//console.log('Actualizacion de cliente con imei ' + data.imei);
		}else {
			socket.nickname = data.imei;		
			sockets[socket.nickname] = socket; 
			//console.log('Nuevo cliente con imei ' + data.imei);
		}	
		console.log('Lineas = ' + data.lineas);		
		clientes[socket.nickname] = {imei:data.imei, lat:data.latitud, lng: data.longitud, lineas: data.lineas, lstDate: new Date(), minMin:data.minMin, minKm: data.minKm}; 	
	});
	
	socket.on('marcar', function(data){	
		if(data.imei in sockets && data.imei in clientes){
			var mensaje = 'Error de registro' + data.imei + 'esta registrado como cliente';
			socket.emit('error', mensaje);
			console.log(mensaje);
		}else{
			if(data.imei in sockets){
				//console.log('Actualizacion de bus con imei ' + data.imei);
			}else {
				//console.log('Nuevo bus con imei ' + data.imei);
			}
			socket.emit('successNuevoCliente','Registro correctamente!!!');
			
			socket.nickname = data.imei;		
			sockets[socket.nickname] = socket; 
			//console.log('Actualizacion de bus con imei ' + data.imei);
			for (cli in clientes) {
				var c = clientes[cli];
				console.log('Hay cliente ' + c.imei + ' con lineas '+ c.lineas);	
				for (i in c.lineas){
				//for (i = 0; i < c.lineas.length; i++) { 
					var linea =  c.lineas[i];					
					console.log( linea +' == ' + data.idLinea);	
					if(linea == data.idLinea){
						console.log('Hay linea ' + linea);
						var distance = getDistanceFromLatLonInKm(c.lat, c.lng, data.latitud, data.longitud);
						var now = new Date;
						var diffMs = (c.lstDate - now);
						var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); 
						console.log('dif min ' + diffMins);
						if(diffMins <= c.minMin){
							console.log('distance ' + distance);
							if(distance <= c.minKm){								
								sockets[c.imei].emit('newPosition',{latitud:data.latitud, longitud:data.longitud, velocidad:data.velocidad, fechaHora: js_yyyy_mm_dd_hh_mm_ss(), idLinea : data.idLinea, idBus : data.idBus});
							}
						}
					}
				}
			}
			var dateF = js_yyyy_mm_dd_hh_mm_ss();
			//var dateF = GetFormated(new Date);
			var args = {	
				data	:	{idBus: data.idBus, latitud : data.latitud, longitud : data.longitud, fecha:dateF}, 
				headers	:	headers
			}
			console.log('call service');			
			client.post(url+'/RegistrarRecorrido', args, function(dataOMR, response) {
				//console.log(dataOMR);
			});			
		}
	});
	
	function js_yyyy_mm_dd_hh_mm_ss () {
	  now = new Date();
	  year = "" + now.getFullYear();
	  month = "" + (now.getMonth() + 1); if (month.length == 1) { month = "0" + month; }
	  day = "" + now.getDate(); if (day.length == 1) { day = "0" + day; }
	  hour = "" + now.getHours(); if (hour.length == 1) { hour = "0" + hour; }
	  minute = "" + now.getMinutes(); if (minute.length == 1) { minute = "0" + minute; }
	  second = "" + now.getSeconds(); if (second.length == 1) { second = "0" + second; }
	  return year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":" + second;
	}
	
	function GetFormated(d){
		dformat = [(d.getMonth()+1).padLeft(),
				d.getDate().padLeft(),
				d.getFullYear()].join('/') +' ' +
				[d.getHours().padLeft(),
				d.getMinutes().padLeft(),
				d.getSeconds().padLeft()].join(':');
		return dformat;
	}
	
	function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
	  var R = 6371; // Radius of the earth in km
	  var dLat = deg2rad(lat2-lat1);  // deg2rad below
	  var dLon = deg2rad(lon2-lon1); 
	  var a = 
		Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
		Math.sin(dLon/2) * Math.sin(dLon/2)
		; 
	  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	  var d = R * c; // Distance in km
	  return d;
	}

	function deg2rad(deg) {
	  return deg * (Math.PI/180)
	}
	
	socket.on('disconnect', function(){
		if(!socket.nickname)return;
		delete clientes[socket.nickname];
		delete sockets[socket.nickname];
	});
});