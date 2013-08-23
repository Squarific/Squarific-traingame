var SQUARIFIC = {};
SQUARIFIC.framework = require("./SQUARIFIC.framework.js");
SQUARIFIC.train = {};
var CryptoJS = require("./crypto.js");

SQUARIFIC.train.Server = function Server () {
	var users = {};
	
	this.worlds = [new SQUARIFIC.train.World(this, {})];
	this.worldList = [];
	for (var k = 0; k < this.worlds.length; k++) {
		this.worldList.push({
			id: this.worlds[k].data.id,
			name: this.worlds[k].data.name,
			companys: this.worlds[k].data.companys
		});
	}
	
	this.io = require('socket.io').listen(8080);
	this.io.set('log level', 1);
	this.io.on("connection", function (socket) {
		socket.on("login", function (data) {
			if (typeof socket.userData !== "undefined" && typeof socket.userData.name !== "undefined") {
				socket.emit("logreg-error", "It seems like you are already logged in, try refreshing the page.");
			} else if (users[data.username] === CryptoJS.SHA3(data.password).toString(CryptoJS.enc.Hex)) {
				socket.userData = {username: data.username};
				this.sendWorldList(socket);
			} else {
				socket.emit("logreg-error", "The username or password were wrong.");
				console.log("Someone tried logging in: ", data);
			}
		}.bind(this));
		socket.on("register", function (data) {
			if (typeof socket.userData !== "undefined" && typeof socket.userData.name !== "undefined") {
				socket.emit("logreg-error", "It seems like you are already logged in, try refreshing the page.");
			} else if (!users[data.username]) {
				users[data.username] = CryptoJS.SHA3(data.password).toString(CryptoJS.enc.Hex);
				console.log(data.username + " registered with encrypted password: " + users[data.username]);
				socket.userData = {username: data.username};
				this.sendWorldList(socket);
			} else {
				if (users[data.username] === CryptoJS.SHA3(data.password).toString(CryptoJS.enc.Hex)) {
					socket.userData = {username: data.username};
					this.sendWorldList(socket);
				} else {
					socket.emit("logreg-error", "This username is already in use.");
				}
			}
		}.bind(this));
		socket.on("ping", function () {
			socket.emit("pong", Date.now());
		});
		socket.on("logout", function () {
			socket.userData = {};
		});
	}.bind(this));
	
	this.sendWorldList = function (socket) {
		socket.emit("worldList", {username: socket.userData.username, worldList: this.worldList});
		socket.on("addWorld", function (data) {
			for (var key = 0; key < this.worlds.length; key++) {
				if (this.worlds[key].data.id === data) {
					this.worlds[key].addSocket(socket);
					return;
				}
			}
		}.bind(this));
	};
};

SQUARIFIC.train.World = function World (server, settings, trains, tracks, client) {
	this.database = {
		companys: []
	};

	this.data = {};
	this.data.id = "World-" + Date.now();
	this.data.name = "TrainGameWorld";
	this.data.companys = 0;

	this.sockets = [];

	settings = settings || {};
	settings.map = settings.map || {};
	settings.tracks = settings.tracks || {};
	settings.cargos = settings.cargos || {};
	settings.industrys = settings.industrys || {};
	settings.trainController = settings.trainController || {};

	settings.map.seed = settings.map.seed || 0.2615;
	settings.map.zoom = settings.map.zoom || 800;
	settings.map.chunkSize = settings.map.chunkSize || 100;
	
	settings.trainController.timePerUpdate = settings.trainController.timePerUpdate || 750;
	settings.trainController.runningCostTime = settings.trainController.runningCostTime || 300000;
	
	settings.tracks.costPerPixel = settings.tracks.costPerPixel || 0.5;
	
	settings.industrys.genFactor = settings.industrys.genFactor || 0.1;
	
	settings.cargos.generation = settings.cargos.generation || 0.003;
	settings.cargos.generationChance = settings.cargos.generationChance || 0.1;
	settings.cargos.stabilizePopulationAt = settings.cargos.stabilizePopulationAt || 3500;
	settings.cargos.msPerGeneration = settings.cargos.msPerGeneration || 1000;
	settings.cargos.maxCargoPerStation = settings.cargos.maxCargoPerStation || 400;
	settings.cargos.unloadTime = settings.cargos.unloadTime || 50;
	settings.cargos.loadTime = settings.cargos.loadTime || 50;
	settings.cargos.stayChance = settings.cargos.stayChance || 0.1;
	settings.cargos.payPerCargo = settings.cargos.payPerCargo || 0.001;
	
	this.trains = new SQUARIFIC.train.TrainController(this, server, settings, trains, client);
	this.map = new SQUARIFIC.framework.SimplexBlockMap(settings.map.seed, settings.map.zoom);
	this.tracks = new SQUARIFIC.train.Tracks(this, settings, tracks);
	this.cargos = new SQUARIFIC.train.Cargos(this, settings);
	this.citys = new SQUARIFIC.train.Citys(this, settings);
	this.industrys = new SQUARIFIC.train.Industrys(this, settings);
	if (!client) {
		this.generation = SQUARIFIC.train.Generation(this);
	}
	
	this.addSocket = function (socket) {
		var company;
		if (socket.userData.world) {
			return;
		}
		socket.userData.world = this.data.id;
		this.sockets.push(socket);
		socket.on("disconnected", function () {
			var key = this.sockets.indexOf(socket);
			while(typeof key === "number" && key !== -1) {
				this.sockets.splice(key, 1);
				key = this.sockets.indexOf(socket);
			}
		});
		socket.on("getChunkData", this.getChunkData.bind(this, socket));
		socket.on("newCompany", this.newCompany.bind(this, socket));
		for (var key = 0; key < this.database.companys.length; key++) {
			if (this.database.companys[key].owner === socket.userData.username) {
				company = this.database.companys[key];
				break;
			}
		}
		socket.emit("worldData", {settings: settings, trains: this.trains.trains, tracks: this.tracks.tracks, company: company});
	};	
	
	this.messages = new function (that) {
		this.sendAll = function (type, data) {
			for (var key = 0; key < this.sockets.length; key++) {
				this.sockets[key].emit(type, data);
			}
		}.bind(that);
	}(this);
	
	this.chunkData = {};
	this.getChunkData = function (socket, chunk) {
		var chunkData;
		if (this.chunkData[chunk[0]] && this.chunkData[chunk[0]][chunk[1]]) {
			socket.emit("getChunkData", this.chunkData[chunk[0]][chunk[1]]);
		} else {
			chunkData = {
				citys: [],
				industrys: [],
			};
			for (var x = 0; x < settings.map.chunkSize; x++) {
				for (var y = 0; y < settings.map.chunkSize; y++) {					
					if (Math.random() < 0.0002 && this.map.getBlockData(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y) > 0.53 && !this.citys.getCityNear(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y, 150) && !this.industrys.getIndustryNear(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y, 90)) {
						chunkData.citys.push(this.citys.newCity(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y));
					}
					if (Math.random() < 0.0001 && this.map.getBlockData(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y) > 0.53 && !this.citys.getCityNear(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y, 90) && !this.industrys.getIndustryNear(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y, 130)) {
						chunkData.industrys.push(this.industrys.newIndustry(chunk[0] * settings.map.chunkSize + x, chunk[1] * settings.map.chunkSize + y));
					}
				}
			}
			this.chunkData[chunk[0]] = this.chunkData[chunk[0]] || {};
			this.chunkData[chunk[0]][chunk[1]] = chunkData;
			socket.emit("getChunkData", chunkData);
		}
	};
	this.newCompany = function (socket, data) {
		for (var key = 0; key < this.database.companys.length; key++) {
			if (this.database.companys[key].owner === socket.userData.username) {
				socket.emit("newCompany", {
					failed: "You already have a company."
				});
				return;
			}
		}
		this.database.companys.push({
			owner: socket.userData.username,
			name: data,
			money: 500,
			transactions: [{
				reason: "Money of the initial investors.",
				amount: 500,
				type: "Start money",
				date: Date.now()
			}]
		});
		this.data.companys = this.database.companys.length;
		socket.emit("newCompany", this.database.companys[this.database.companys.length - 1]);
	};
};

SQUARIFIC.train.TrainController = function TrainController (worldInstance, serverInstance, settings, trains, client) {
	var trains = trains || [];
	this.addTrain = function (train) {
		trains.push(train);
	};
	this.updateTrain = function (train) {
		for (var key = 0; key < trains.length; key++) {
			if (trains[key].id === train.id) {
				for (var k in train) {
					trains[key][k] = train[k];
				}
			}
		}
	};
	this.locomotvies = {
		
	};
	this.trains = trains;
	var lastPay = Date.now();
	this.update = function (time) {
		var longRoute, runTime;
		for (var k = 0; k < trains.length; k++) {
			if (typeof trains[k].loadTime !== "number") {
				trains[k].loadTime = serverInstance.cargos.boardTrain();
				worldInstance.messages.sendAll("trainUpdate", {
					id: trains[k].id,
					cargos: trains[k].cargos,
					lastFrom: trains[k].lastFrom,
					from: trains[k].from,
					to: trains[k].to,
					lastTo: trains[k].lastTo,
					runTimeStart: Date.now(),
					loadTime: trains[k].loadTime
				});
				trains[k].gray = true;
			}
			if (typeof trains[k].toTime !== "number") {
				trains[k].toTime = Math.sqrt((trains[k].to.x - trains[k].from.x) * (trains[k].to.x - trains[k].from.x) + (trains[k].to.y - trains[k].from.y) * (trains[k].to.y - trains[k].from.y)) / this.locomotives[trains[k].type].speed(Math.ceil(trains[k].cargos.length / 8));
			}
			runTime = Date.now() - trains[k].runTimeStart;
			if (trains[k].gray) {
				if (runTime > trains[k].loadTime) {
					trains[k].gray = false;
					trains[k].runTimeStart += trains[k].loadTime;
				}
			} else if (runTime >= trains[k].toTime) {
				trains[k].runTimeStart += trains[k].toTime;
				trains[k].toTime = false;
				if (trains[k].to.x === trains[k].route[trains[k].lastTo].x && trains[k].to.y === trains[k].route[trains[k].lastTo].y) {
					trains[k].lastTo++;
					if (trains[k].route.length <= trains[k].lastTo) {
						trains[k].lastTo = 0;
					}
					trains[k].loadTime = false;
					trains[k].gray = true;
				}
				longRoute = worldInstance.tracks.routeBetween(trains[k].to, trains[k].route[trains[k].lastTo]);
				if (longRoute) {
					trains[k].lastFrom = trains[k].from;
					trains[k].from = longRoute[0];
					trains[k].to = longRoute[1];
					trains[k].noRoute = false;
				} else {
					trains[k].noRoute = true;
				}
			}
		}
		if (Date.now() - lastPay > settings.trainController.runningCostTime) {
			var totalCost = 0;
			for (var k = 0; k < trains.length; k++) {
				totalCost += this.locomotives[trains[k].type].runningCost;
			}
			if (totalCost > 0) {
				companys.getCompany(trains[k].companyId).transaction("Running cost of " + trains.length + " trains.", -totalCost, "Train running cost");
			}
			lastPay += settings.trainController.runningCostTime;
		}
	};
	if (!client) {
		setInterval(this.update.bind(this), settings.trainController.timePerUpdate);
	}
};

SQUARIFIC.train.Industrys = function (world, settings) {
	var industrys = [];
	this.industrys = industrys;
	this.genFactor = settings.industrys.genFactor || 0.1;
	this.industryTypes = {
		Farm: {
			imageUrl: "images/industry-farm.png",
			generation: {
				"Milk": 2,
				"Grain": 1
			},
			production: {},
			accept: {
				"Wood": 1
			},
			genFactor: 1
		},
		Woodmill: {
			imageUrl: "images/industry-woodmill.png",
			generation: {
				"Wood": 1
			},
			production: {},
			accept: {},
			genFactor: 1
		}
	};
	var types = [];
	for (var key in this.industryTypes) {
		if (this.industryTypes.hasOwnProperty(key)) {
			types.push(key);
		}
	}
	this.newIndustry = function (x, y) {
		var k = industrys.push({
			type: types[Math.floor(Math.random() * types.length)],
			x: x,
			y: y,
			leftToAccept: {},
			passengers: [],
			cargos: []
		});
		industrys[k - 1].id = "industry_" + (k - 1);
		return industrys[k - 1];
	};
	this.getIndustryNear = function (x, y, range) {
		var shortest = false;
		var shortestDistance = false;
		for (var key = 0; key < industrys.length; key++) {
			var distance = Math.sqrt((x - industrys[key].x) * (x - industrys[key].x) + (y - industrys[key].y) * (y - industrys[key].y));
			if (distance <= range && (!shortestDistance || shortestDistance > distance)) {
				shortestDistance = distance;
				shortest = industrys[key];
			}
		}
		return shortest;
	};
	this.getIndustry = function (x, y) {
		for (var key = 0; key < industrys.length; key++) {
			if (industrys[key].x === x && industrys[key].y === y) {
				return industrys[key];
			}
		}
		return false;
	};
};

SQUARIFIC.train.Citys = function () {
	var citys = [];
	this.citys = citys;
	var cityNames = ["SaltLake", "The big lemon", "Baston", "La ville masou", "Bronsten", "Rumst", "Andorrena", "Morverano", "Colzito", "Zakketia", "Rodo", "Port Milleio", "Fort Cavetto", "Junction spring", 	"Masterio", "Wolkoville", "Perdonon", "Miljow", "Ivadro", "Embazetto", "Hacker City", "Polder", "The big Polder", "Formizoe", "Cadella", "Kripullzao","Uoaeeai","Dieooe","Ijgoeiu","Rckaf","Udqki","Ypeauae","Dupe","Kguou","Ezfd","Ankvhj","Aooeae","Becui","Aoaio","Ctluona","Mpcmao","Cadbg","Machacn","Ewodai","Eiiyuu","Iheu","Xfpuaa","Houboj","Iiyrlw","Qbcngco","Iaia","Grjae","Qrsoia","Oiwab","Ukiee","Ejzu","Plkip","Amha","Wqueiu","Zeao","Dizbb","Ldpk","Rlgtvok","Vmsat","Piuvw","Aerl","Caeiioo","Gehav","Qxno","Aiay","Wcdnen","Yijieo","Zdcoiou","Umnm","Yopauue","Uautuii","Azipkx","Eioiau","Kfnh","Ahoaeee","Fzifwk","Viohnb","Qrvg","Uarea","Bejjcpe","Bbow","Asvmi","Heoeoo","Getiu","Riaeooi","Vkhf","Oxbget","Dwai","Muei","Fcopv","Inxwt","Pwqca","Yonfi","Aijla","Iiqqsf","Oxelo","Iofuo","Awaa","Ytuio","Bupvby","Wclfuuo","Ipkis","Ubdsmi","Euoeaio","Oeoeii","Qeaq","Bftf","Atdu","Gfxpe","Aiee","Ieuaiie","Otoiq","Uoei","Uimeom","Abnu","Euooeoo","Iblkurf","Iiiui","Sepi","Cdiieai","Rbyvb","Xdawe","Gxuhi","Ilbinv","Kxzgxen","Ooaooou","Hiwqqao","Ouchi","Aiuia","Sosce","Iyktoo","Oufqobh","Vmjo","Ihwa","Krctds","Hxiioa","Axiuo","Yiho","Pzeau","Nnouia","Igyi","Jdfwe","Delmzsa","Saoe","Acjeiei","Gtheeea","Pvlilu","Yknwmee","Arow","Paioaai","Eaueeio","Cyec","Inwzo","Eooaai","Itihmp","Iief","Epii","Igvk","Diuzeys","Ogdz","Euia","Eqbdmi","Icjtg","Pmwzmo","Okqegn","Adua","Xeio","Gaea","Jlus","Ivfiee","Crleeia","Xsbgi","Opbodze","Uqoo","Dqkg","Ijva","Qfau","Otliie","Gfzbepi","Irjioe","Sdkk","Hykt","Ocvxdz","Cvyud","Olsxhxq","Mzvdn","Cqyto","Dsvoaa","Erpevj","Eoqwno","Oepwlui","Ijomuu","Jvxuo","Ovtuui","Euamh","Uothadu","Eueoeae","Fioeai","Tqhorw","Uevca","Efiaa","Eigsa","Iieiio","Eaagwnc","Eaiuaea","Vngcqjk","Utwoeo","Lggll","Ujnqi","Ceoa","Ldouo","Jjoiuau","Syuukaa","Ioxkdab","Bxauaii","Iiuouau","Aftuauh","Unye","Oquu","Opgoui","Vdmgis","Ivtdy","Gdko","Otwx","Hiaii","Oqfon","Lamo","Yxewnu","Qzgjc","Uaxouio","Tkdcia","Nuytq","Fquo","Ailyuiu","Ewwk","Apoo","Xfherwg","Dfjzw","Oiaao","Fihuoc","Oiiu","Mhviooa","Gaeu","Oiuouaa","Izyhaao","Urtnt","Jjouei","Umhs","Ehosl","Zuofo","Cduii","Ueui","Uszuaae","Zzouu","Eceuhc","Afhiae","Ioiru","Droivxe","Bwjaeg","Oieeu","Dliioae","Ggcmin","Udaac","Pzii","Ahzbt","Yiuouu","Dsueaie","Broou","Gbuwau","Rgawbh","Geui","Ekubi","Yrno","Okwim","Yhff","Donci","Lumhue","Bsiy","Miwoeu","Eaja","Uieaiio","Pyjei","Ohaoe","Dffoi","Enoaa","Eorw","Ukui","Seisthp","Elonoih","Ujuau","Zsgjni","Bzeuoi","Rzlea","Abbguq","Eiuuiao","Laoaiai","Najgie","Axijaii","Ijre","Emxmo","Ddufih","Utwzaoi","Gooeia","Urigwkd","Ycijt","Kequauo","Euioaa","Hiiuei","Xgjc","Rifieeu","Iddeag","Qnae","Ahgl","Uura","Rgqjqo","Yqks","Ionol","Eupaa","Wtjdle","Suai","Taaei","Igeioua","Llpcuio","Ohieiei","Fbekoau","Yguee","Yeio","Gjceiwy","Euno","Uoaoa","Hfjgqem","Nowoycf","Kxujyd","Opueaa","Htfe","Uuco","Nyyspxv","Uaca","Auio","Evuea","Exfixcb","Zotxao","Efqcux","Iqlgcr","Zphd","Hhxckk","Dyurm","Kldiui","Aube","Upcaaeo","Xuhu","Faaoiie","Pacui","Vwyq","Vwuxz","Fzyua","Uebo","Iauz","Eseou","Dxyceau","Mrmhaa","Ihihai","Ktei","Nkppe","Erztr","Oeaeu","Imbeo","Oalhvmt","Jggd","Ieoouiu","Gimeja","Uskh","Iajsd","Oibewa","Ikxqz","Aiui","Sttu","Ahxb","Ohuioa","Epieu","Gfaszi","Zgtet","Ftoiie","Aozsp","Agaga","Uavgx","Fsiuoo","Augclxj","Adoe","Ezeaio","Utiiaua","Qoiue","Ahcod","Bdegv","Nguect","Mwzxdua","Oievxm","Itnpds","Fhcqevr","Oava","Agsiii","Haoaoi","Zcvcrw","Klkoigf","Ruiqzo","Synkxi","Uczueua","Mibaznt","Nqqcnqj","Ehmrzxe","Gueaii","Enuj","Mojn","Ouaaeue","Ihxau","Oegauz","Ibnp","Neuu","Murcix","Amyaioi","Yeaiio","Hewdzs","Lypg","Vgei","Ultgmw","Isbooei","Fouiau","Fdclr","Ikfrns","Oiddinu","Wzrbue","Szkic","Iaii","Ihza","Mcueeie","Oowoee","Upve","Oaeouoa","Ofia","Avodl","Hidvkoe","Manlbjr","Dsio","Gtlm","Vtudowa","Xtaouo","Dnum","Opxn","Dutsi","Liaou","Omue","Pbnvae","Uxauo","Ouoiiae","Ojiizi","Ubmpjwi","Uaaiaa","Ymepib","Bunlyt","Nffleka","Skeg","Qeaaa","Yamcqiy","Iiei","Iuui","Olbfg","Omeo","Ajloo","Ayvzuao","Yuoiue","Eoffiou","Icvoo","Opdy","Aikiyut","Uyeseg","Qhdema","Aoau","Ecannue","Salusq","Eupsgbu","Igqa","Hyqouo","Ucfqxwv","Jvieuuu","Hurb","Aaee","Ieuiuia","Oegjq","Oaaeoi","Esiue","Ebfsxyo","Pboe","Xweqnbw","Miuooo","Vuaueei","Ayar","Aucsvbw","Ioekvt","Avonjio","Ebdoea","Ouopeo","Oxgu","Mmuembp","Uahe","Pcgvtnu","Eudd","Ocsrehx","Wjaf","Iaauoa","Uljkqg","Pswdrk","Jgcv","Aktwrou","Orbz","Raai","Aimieui","Uuaioo","Uwuui","Udyaxio","Kfmeaj","Aiuooe"];
	var start = Date.now();
	this.types = {
		"small": {
			population: 0,
			next: "medium",
			accept: {
				"Grain": 1
			}
		},
		"medium": {
			population: 950,
			next: "large",
			accept: {
				"Grain": 1,
				"Milk": 1
			}
		},
		"large": {
			population: 1800,
			accept: {
				"Grain": 1,
				"Milk": 2
			}
		}
	};
	this.newCity = function (x, y) {
		var id = citys.push({
			x: x,
			y: y,
			population: Math.round(Math.random() * 100) + 50,
			passengers: [],
			cargos: [],
			type: "small",
			leftToAccept: {},
			name: cityNames[Math.floor(Math.random() * cityNames.length)]
		});
		citys[id - 1].id = "city_" + (id - 1);
		return citys[id - 1];
	};
	this.getCity = function (x, y) {
		for (var key = 0; key < citys.length; key++) {
			if (citys[key].x === x && citys[key].y === y) {
				return citys[key];
			}
		}
		return false;
	};
	this.getCityNear = function (x, y, range) {
		var shortest = false;
		var shortestDistance = false;
		for (var key = 0; key < citys.length; key++) {
			var distance = Math.sqrt((x - citys[key].x) * (x - citys[key].x) + (y - citys[key].y) * (y - citys[key].y));
			if (distance <= range && (!shortestDistance || shortestDistance > distance)) {
				shortestDistance = distance;
				shortest = citys[key];
			}
		}
		return shortest;
	};
};

SQUARIFIC.train.Tracks = function (worldInstance, settings) {
	var tracks = [];
	this.tracks = tracks;
	this.costPerPixel = settings.tracks.costPerPixel;
	this.connectedPoints = [];
	this.connectedCitys = 0;
	this.newTrack = function newTrack (p1, p2) {
		for (var k = 0; k < tracks.length; k++) {
			if ((tracks[k][0] === p1.x || tracks[k][2] === p1.x) &&
				(tracks[k][1] === p1.y || tracks[k][3] === p1.y) &&
				(tracks[k][0] === p2.x || tracks[k][2] === p2.x) &&
				(tracks[k][1] === p2.y || tracks[k][3] === p2.y)) {
				return false;
			}
		}
		this.addConnectedPoint(worldInstance.citys.getCity(p1.x, p1.y) || worldInstance.industrys.getIndustry(p1.x, p1.y));
		this.addConnectedPoint(worldInstance.citys.getCity(p2.x, p2.y) || worldInstance.industrys.getIndustry(p2.x, p2.y));
		tracks.push([p1.x, p1.y, p2.x, p2.y]);
		this.newTracked = true;
		return true;
	};
	this.addConnectedPoint = function (c) {
		for (var key = 0; key < this.connectedPoints.length; key++) {
			if (this.connectedPoints[key].x === c.x && this.connectedPoints[key].y === c.y) {
				return;
			}
		}
		this.connectedPoints.push(c);
		if (c.population) {
			this.connectedCitys++;
		}
	};
	this.paint = function trackPaint (ctx, container, x, y) {
		if (x !== this.lastX || y !== this.lastY || this.resized || this.newTracked) {
			for (var k = 0; k < tracks.length; k++) {
				ctx.beginPath();
				ctx.moveTo(tracks[k][0] - x, tracks[k][1] - y);
				ctx.lineTo(tracks[k][2] - x, tracks[k][3] - y);
				ctx.strokeStyle = "black";
				ctx.stroke();
			}
			this.lastX = x;
			this.lastY = y;
			this.resized = false;
			this.newTracked = false;
		}
	};
	this.getOtherPoints = function (p) {
		var points = [];
		for (var key = 0; key < tracks.length; key++) {
			if (tracks[key][0] === p.x && tracks[key][1] === p.y) {
				points.push({x: tracks[key][2], y: tracks[key][3]});
			} else if (tracks[key][2] === p.x && tracks[key][3] === p.y) {
				points.push({x: tracks[key][0], y: tracks[key][1]});
			}
		}
		return points;
	};
	this.currentDistanceToPoint = function (p, points) {
		for (var key = 0; key < points.length; key++) {
			if (p.x === points[key].x && p.y === points[key].y) {
				return points[key].distance;
			}
		}
		return false;
	};
	this.addPoint = function (p, points) {
		for (var key = 0; key < points.length; key++) {
			if (p.x === points[key].x && p.y === points[key].y) {
				points[key].distance = p.distance;
				return;
			}
		}
		points.push(p);
	};
	this.routeBetween = function (p1, p2) {
		var routes = [];
		var points = [];
		var currentShortestDistance;
		var tpoints = this.getOtherPoints(p1);
		if (tpoints.length > 0) {
			for (var key = 0; key < tpoints.length; key++) {
				if (p2.x === tpoints[key].x && p2.y === tpoints[key].y) {
					return [p1, p2];
				}
				var route = [p1, tpoints[key]];
				route.distance = Math.sqrt((p1.x - tpoints[key].x) * (p1.x - tpoints[key].x) + (p1.y - tpoints[key].y) * (p1.y - tpoints[key].y));
				routes.push(route);
				tpoints[key].distance = route.distance;
				points.push(tpoints[key]);
			}
			while (true) {
				var pointDistance, currentDistance;
				var newRoutes = [];
				for (var key = 0; key < routes.length; key++) {
					if (routes[key][routes[key].length - 1].x === p2.x && routes[key][routes[key].length - 1].y === p2.y) {
						newRoutes.push(routes[key]);
						continue;
					}
					tpoints = this.getOtherPoints(routes[key][routes[key].length - 1]);
					for (var k = 0; k < tpoints.length; k++) {
						var route = [];
						pointDistance = routes[key].distance + Math.sqrt((routes[key][routes[key].length - 1].x - tpoints[k].x) * (routes[key][routes[key].length - 1].x - tpoints[k].x) + (routes[key][routes[key].length - 1].y - tpoints[k].y) * (routes[key][routes[key].length - 1].y - tpoints[k].y));
						currentDistance = this.currentDistanceToPoint(tpoints[k], points);
						if (typeof currentDistance === "number") {
							if (pointDistance > currentDistance) {
								tpoints.splice(k, 1);
								k--;
								continue;
							} else {
								for (var i = key + 1; i < routes.length; i++) {
									for (var a = 0; a < routes[i].length; a++) {
										if (routes[i][a].x === tpoints[k].x && routes[i][a].y === tpoints[k].y) {
											routes.splice(i, 1);
											i--;
											break;
										}
									}
								}
								for (var i = 0; i < newRoutes.length; i++) {
									for (var a = 0; a < newRoutes[i].length; a++) {
										if (newRoutes[i][a].x === tpoints[k].x && newRoutes[i][a].y === tpoints[k].y) {
											newRoutes.splice(i, 1);
											i--;
											break;
										}
									}
								}
							}
						}
						route.distance = pointDistance;
						if (tpoints[k].x === p2.x && tpoints[k].y === p2.y && (!currentShortestDistance || route.distance < currentShortestDistance)) {
							currentShortestDistance = route.distance;
						}
						for (var i = 0; i < routes[key].length; i++) {
							route.push(routes[key][i]);
						}
						route.push(tpoints[k]);
						newRoutes.push(route);
						tpoints[k].distance = pointDistance;
						this.addPoint(tpoints[k], points);
					}
				}
				if (currentShortestDistance) {
					for (var k = 0; k < newRoutes.length; k++) {
						if (newRoutes[k].distance > currentShortestDistance) {
							newRoutes.splice(k, 1);
							k--;
						}
					}
				}
				if (newRoutes.length === 0) {
					return false;
				} else if (newRoutes.length === 1 && currentShortestDistance) {
					return newRoutes[0];
				}
				routes = newRoutes;
			}
		}
		return false;
	};
	this.closestStationAccepts = function (cargo, from) {
		var closest = false, closestDist, dist;
		for (var key = 0; key < this.connectedPoints.length; key++) {
			if (this.connectedPoints[key].leftToAccept[cargo] > 0 && this.routeBetween(from, this.connectedPoints[key])) {
				dist = Math.sqrt((this.connectedPoints[key].x - from.x) * (this.connectedPoints[key].x - from.x) + (this.connectedPoints[key].y - from.y) * (this.connectedPoints[key].y - from.y));
				if (typeof closestDist !== "number" || closestDist > dist) {
					closestDist = dist;
					closest = this.connectedPoints[key];
				}
			}
		}
		return closest;
	};
};

SQUARIFIC.train.Cargos = function (world, settings) {
	var cargos = {};
	var deadChance = settings.cargos.stabilizePopulationAt / settings.cargos.generationChance;
	this.generate = function () {
		var timeBetween = Date.now() - this.lastGen,
			to;
		while (timeBetween - settings.cargos.msPerGeneration >= 0) {
			for (var a = 0; a < world.tracks.connectedPoints.length; a++) {
				if (typeof world.tracks.connectedPoints[a].population === "number" ) {
					if (world.tracks.connectedCitys < 2) {
						continue;
					}
					if (Math.random() <= settings.cargos.generationChance) {
						world.tracks.connectedPoints[a].population += Math.ceil(Math.log(world.tracks.connectedPoints[a].population / 5) / 2);
					}
					if (Math.random() <= world.tracks.connectedPoints[a].population / deadChance) {
						world.tracks.connectedPoints[a].population -= Math.ceil(Math.log(world.tracks.connectedPoints[a].population / 5) / 2);
					}
					var toGenerate = settings.cargos.generation * world.tracks.connectedPoints[a].population;
					if (toGenerate + world.tracks.connectedPoints[a].cargos.length > settings.cargos.maxCargoPerStation) {
						toGenerate = settings.cargos.maxCargoPerStation - world.tracks.connectedPoints[a].cargos.length;
					}
					toGenerate = Math.ceil(toGenerate);
					while (toGenerate > 0) {
						if (Math.random() > settings.cargos.generationChance * 4) {
							toGenerate--;
							continue;
						}
						var i = 0;
						while (!to || to === world.tracks.connectedPoints[a] || !to.population) {
							to = world.tracks.connectedPoints[Math.floor(Math.random() * world.tracks.connectedPoints.length)];
							i++
						}
						world.tracks.connectedPoints[a].cargos.push({
							from: world.tracks.connectedPoints[a],
							to: to,
							type: "Passenger"
						});
						to = false;
						toGenerate--;
					}
					if (world.tracks.connectedPoints[a].population < 5) {
						world.tracks.connectedPoints[a].population = 5;
					}
				}
			}
			timeBetween -= settings.cargos.msPerGeneration;
			this.lastGen += settings.cargos.msPerGeneration;
		}
	};
	this.boardTrain = function (train) {
		var boardTime = 0, route, station = world.citys.getCity(train.from.x, train.from.y) || world.industrys.getIndustry(train.from.x, train.from.y), income = 0;
		for (var a = 0; a < train.cargos.length; a++) {
			if (train.cargos[a].to.x === train.from.x && train.cargos[a].to.y === train.from.y) {
				if (train.cargos[a].type === "Passenger" && typeof station.population === "number" && Math.random() <= settings.cargos.stayChance) {
					station.population++;
				}
				income += settings.cargos.payPerCargo * Math.sqrt((train.cargos[a].from.x - train.cargos[a].to.x) * (train.cargos[a].from.x - train.cargos[a].to.x) + (train.cargos[a].from.y - train.cargos[a].to.y) * (train.cargos[a].from.y - train.cargos[a].to.y));
				train.cargos.splice(a, 1);
				a -= 1;
				boardTime += settings.cargos.unloadTime;
			} else if (route = world.trains.routeBetween(train.from, train.cargos[a].to)) {
				var deboard = true;
				for (var k = 0; k < route.length; k++) {
					if (route[k][0].name === train.name && route[k][0].lastTo === train.lastTo) {
						deboard = false;
					}
				}
				if (deboard) {
					if (train.cargos[a].type === "Passenger") {
						station.cargos.push(train.cargos[a]);
					} else {
						station.cargos.push(train.cargos[a]);
					}
					train.cargos.splice(a, 1);
					a -= 1;
					boardTime += settings.cargos.unloadTime;
				}
			}
		}
		for (var a = 0; a < station.cargos.length; a++) {
			if (train.cargos.length >= train.maxLoad) {
				break;
			}
			route = world.trains.routeBetween(train.from, station.cargos[a].to);
			for (var k = 0; k < route.length; k++) {
				if (route[k][0].name === train.name && route[k][0].lastTo === train.lastTo) {
					train.cargos.push(station.cargos[a]);
					station.cargos.splice(a, 1);
					a -= 1;
					boardTime += settings.cargos.loadTime;
					break;
				}
			}
		}
		if (income > 0) {
			world.company.transaction("Cargo Delivery", income, "Cargo Delivery");
		}
		return boardTime;
	};
	this.lastGen = Date.now();
	setInterval(this.generate.bind(this), 100);
};

SQUARIFIC.train.Generation = function Generation (worldInstance) {
	this.industry = new SQUARIFIC.train.IndustryGeneration(worldInstance);
};

SQUARIFIC.train.IndustryGeneration = function IndustryGeneration (worldInstance, settings) {
	this.lastGenerate = Date.now();
	settings = settings || {};
	settings.msPerGeneration = settings.msPerGeneration || 2000;
	settings.maxPerStation = settings.maxPerStation || 200;
	settings.msPerAcceptReset = settings.msPerAcceptReset || 20000;
	this.genFactor = settings.genFactor || 0.1;
	this.industryTypes = {
		Farm: {
			imageUrl: "images/industry-farm.png",
			generation: {
				"Milk": 2,
				"Grain": 1
			},
			production: {},
			accept: {
				"Wood": 1
			},
			genFactor: 1
		},
		Woodmill: {
			imageUrl: "images/industry-woodmill.png",
			generation: {
				"Wood": 1
			},
			production: {},
			accept: {},
			genFactor: 1
		}
	};
	this.generate = function () {
		var timeBetween = Date.now() - this.lastGen,
			to;
		while (timeBetween - settings.msPerGeneration >= 0) {
			for (var a = 0; a < worldInstance.tracks.connectedPoints.length; a++) {
				if (typeof worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type] !== "undefined") {
					for (var key in worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type].generation) {
						worldInstance.tracks.connectedPoints[a].generate = worldInstance.tracks.connectedPoints[a].generate || {};
						worldInstance.tracks.connectedPoints[a].generate[key] = worldInstance.tracks.connectedPoints[a].generate[key] || 0;
						worldInstance.tracks.connectedPoints[a].generate[key] += worldInstance.industrys.genFactor * worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type].genFactor * worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type].generation[key]
						for (; Math.floor(worldInstance.tracks.connectedPoints[a].generate[key]) > 0; worldInstance.tracks.connectedPoints[a].generate[key]--) {
							var to = worldInstance.tracks.closestStationAccepts(key, worldInstance.tracks.connectedPoints[a]);
							if (to) {
								worldInstance.tracks.connectedPoints[a].cargos.push({
									from: worldInstance.tracks.connectedPoints[a],
									to: to,
									type: key
								});
								to.leftToAccept[key]--;
							}
						}
					}
				}
			}
			timeBetween -= settings.msPerGeneration;
			this.lastGen += settings.msPerGeneration;
		}
	};
	this.acceptReset = function acceptReset () {
		var timeBetween = Date.now() - this.lastAccept;
		while (timeBetween - settings.msPerAcceptReset >= 0) {
			for (var a = 0; a < worldInstance.tracks.connectedPoints.length; a++) {
				if (typeof worldInstance.citys.types[worldInstance.tracks.connectedPoints[a].type] !== "undefined") {
					for (var key in worldInstance.citys.types[worldInstance.tracks.connectedPoints[a].type].accept) {
						worldInstance.tracks.connectedPoints[a].leftToAccept[key] = worldInstance.citys.types[worldInstance.tracks.connectedPoints[a].type].accept[key];
					}
				} else if (typeof worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type] !== "undefined") {
					for (var key in worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type].accept) {
						worldInstance.tracks.connectedPoints[a].leftToAccept[key] = worldInstance.industrys.industryTypes[worldInstance.tracks.connectedPoints[a].type].accept[key];
					}
				}
			}
			timeBetween -= settings.msPerAcceptReset;
			this.lastAccept += settings.msPerAcceptReset;
		}
	};
	this.lastGen = Date.now();
	this.lastAccept = Date.now();
	setInterval(this.generate.bind(this), 100);
	setInterval(this.acceptReset.bind(this), 100);
};

SQUARIFIC.server = new SQUARIFIC.train.Server();