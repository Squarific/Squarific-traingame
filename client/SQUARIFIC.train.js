if (typeof SQUARIFIC === "undefined" || !SQUARIFIC.framework) {
	throw "SQUARIFIC framework required.";
}

if (!SQUARIFIC.train) {
	throw "SQUARIFIC.train was not succesfully loaded";
}

if (typeof io === "undefined") {
	console.log("Io library not correctly loaded");
	var io = {};
	io.connect = function () {
		return {emit:function(){}, on: function(){}};
	};
}

SQUARIFIC.trainInstance = {};

SQUARIFIC.menu = {
	toggle: function (target) {
		var menu = document.getElementById("menu");
		if (menu.style.display === "none") {
			menu.style.display = "block";
			target.innerHTML = "&#9650;";
		} else {
			menu.style.display = "none";
			target.innerHTML = "&#9660;";
		}
	}
};

SQUARIFIC.network = {};
SQUARIFIC.network.socket = io.connect("http://localhost:8080");

SQUARIFIC.network.socket.on("logreg-error", function (error) {
	var el = document.getElementById("logreg-message");
	el.innerHTML = error;
	el.classList.add("error");
	delete localStorage.username;
	delete localStorage.password;
});

SQUARIFIC.network.socket.on("worldList", function (data) {
	var world, worldList = document.createElement("div");
	var logreg = document.getElementById("logreg-container");
	logreg.style.display = "none";
	var message = document.getElementById("logreg-message");
	message.classList.remove("error");
	message.innerHTML = "Successfully logged in as " + data.username;
	logreg = document.getElementById("logreg-container-container");
	worldList.id = "logreg-worldList";
	world = document.createElement("div");
	world.appendChild(document.createTextNode("Logout"));
	world.className = "divButton error rederror";
	world.addEventListener("click", function (event) {
		SQUARIFIC.network.socket.emit("logout");
		document.getElementById("logreg-container").style.display = "";
		var div = document.getElementById("logreg-worldList");
		div.parentNode.removeChild(div);
	});
	worldList.appendChild(world);
	world = document.createElement("div");
	world.appendChild(document.createTextNode("Start a singleplayer game"));
	world.className = "divButton";
	world.addEventListener("click", function (event) {
		
	});
	worldList.appendChild(world);
	for (var key = 0; key < data.worldList.length; key++) {
		world = document.createElement("div");
		world.appendChild(document.createTextNode("Enter multiplayer world: " + data.worldList[key].name + ". Active companys: " + data.worldList[key].companys));
		world.worldId = data.worldList[key].id;
		world.className = "divButton";
		world.addEventListener("click", function (event) {
			SQUARIFIC.network.socket.emit("addWorld", event.target.worldId);
		});
		worldList.appendChild(world);
	}
	logreg.appendChild(worldList);
});

SQUARIFIC.network.socket.on("worldData", function (wd) {
	SQUARIFIC.trainInstance = new SQUARIFIC.train.TrainInstance(wd.settings, wd.trains, wd.tracks, wd.company, SQUARIFIC.network.socket);
	document.getElementById("overlay").style.display = "none";
});

function onload () {
	if (typeof localStorage.username === "string") {
		var message = document.getElementById("logreg-message");
		SQUARIFIC.network.socket.emit("login", {
			username: localStorage.username,
			password: localStorage.password
		});
		message.style.display = "block";
		message.classList.remove("error");
		message.innerHTML = "Contacting the server...";
	};
}

SQUARIFIC.logreg = function (form) {
	if (form && typeof form.getAttribute === "function") {
		var message = document.getElementById("logreg-message");
		var type = form.getAttribute("type");
		var fields = {};
		for (var key = 0; key < form.children.length; key++) {
			if (typeof form.children[key].value === "string") {
				fields[form.children[key].name] = form.children[key].value;
			}
		}
		if (type === "login") {
			localStorage.username = fields["username"];
			localStorage.password = fields["password"];
			SQUARIFIC.network.socket.emit("login", fields);
			message.style.display = "block";
			message.classList.remove("error");
			message.innerHTML = "Contacting the server...";
		} else {
			if (fields["password"] === fields["password2"]) {
				delete fields["password2"];
				localStorage.username = fields["username"];
				localStorage.password = fields["password"];
				SQUARIFIC.network.socket.emit("register", fields);
				message.style.display = "block";
				message.classList.remove("error");
				message.innerHTML = "Contacting the server...";
			} else {
				message.style.display = "block";
				message.classList.add("error");
				message.innerHTML = "Your passwords don't match.";
			}
		}
	}
};

SQUARIFIC.train.TrainInstance = function (settings, trains, tracks, company, socket, singleplayer) {
	var container = document.getElementById("trainContainer");
	this.layers = [];
	this.layers.x = 0;
	this.layers.y = 0;
	this.captions = new SQUARIFIC.framework.Captions([
		{min: 0, max: 0.5, bMin: 75, bMax: 255},
		{min: 0.5, max: 0.502, bMin: 255, rMin:0, gMin:0, rMax: 255, gMax:255, bMax: 0},
		{min: 0.502, max: 0.52, rMin: 255, gMin: 255, rMax: 200, gMax: 200},
		{min: 0.52, max: 0.522, rMin: 200, gMin:200, rMax: 0, gMax: 170},
		{min: 0.522, max: 0.75, gMin: 170, gMax: 100},
		{min: 0.75, max: 1, gMin: 100, gMax: 20}
	]);
	if (singleplayer) {
		this.localServer = new SQUARIFIC.train.LocalServer(this, {});
	}
	this.world = new SQUARIFIC.train.World(this.localServer, settings, trains, tracks, !singleplayer);
	
	this.map = new SQUARIFIC.framework.SimplexBlockMap(0.2615, 800);
	this.chunks = new SQUARIFIC.framework.Chunks({chunkSize: settings.map.chunkSize || 100}, function getXYcolor (x, y) {
		return this.captions.rgbFromNumber(this.map.getBlockData(x, y));
	}.bind(this));
	
	this.inputHandler = new SQUARIFIC.train.InputHandler(this.world, container, this, this.layers);
	
	//Painters
	this.renderer = new SQUARIFIC.framework.Renderer(container, this.layers);
	this.tracksPaint = new SQUARIFIC.train.TracksPaint(this.world.tracks.tracks);
	this.trainsPaint = new SQUARIFIC.train.TrainsPaint(this.world, this.inputHandler);
	this.citysPaint = new SQUARIFIC.train.CitysPaint(this.world.citys, this.inputHandler);
	this.industrysPaint = new SQUARIFIC.train.IndustrysPaint(this.world.industrys, this.inputHandler);
	this.mapRenderer = new SQUARIFIC.train.mapRenderer(this.chunks, this.layers);
	this.layers[0] = [this.mapRenderer, this.citysPaint, this.tracksPaint, this.trainsPaint, this.industrysPaint];
	
	//Chunks events
	this.chunks.addEventListener("chunkready", function () {
		this.mapRenderer.resized = true;
		this.tracksPaint.resized = true;
	}.bind(this));
	this.chunks.addEventListener("chunkready", function (coords) {
		this.network.getChunkData(coords);
	}.bind(this));
	
	window.addEventListener("resize", function () {
		this.mapRenderer.resized = true;
		this.tracksPaint.resized = true;
	}.bind(this), false);
	
	this.gui = new SQUARIFIC.framework.Gui(document.getElementById("guiContainer"));
	this.network = new SQUARIFIC.train.Network(this.world, this, {}, socket);
};

SQUARIFIC.train.mapRenderer = function mapRenderer (chunks, layers) {
	this.paint = function mapRendererPaint (ctx) {
		if (this.lastX === layers.x && this.lastY === layers.y && !this.resized) {
			return;
		}
		var cx = Math.floor(layers.x / chunks.chunkSize),
			cy = Math.floor(layers.y / chunks.chunkSize),
			cyo = cy,
			cxMax = Math.floor((layers.x + ctx.canvas.width) / chunks.chunkSize),
			cyMax = Math.floor((layers.y + ctx.canvas.height) / chunks.chunkSize);
		for (; cx <= cxMax; cx++) {
			for (cy = cyo; cy <= cyMax; cy++) {
				ctx.drawImage(chunks.getChunkCanvas(cx, cy), (cx * chunks.chunkSize) - layers.x, (cy * chunks.chunkSize) - layers.y);
			}
		}
		this.lastX = layers.x;
		this.lastY = layers.y;
		this.resized = false;
	};
};

SQUARIFIC.train.Company = function (settings) {
	settings = settings || {};
	this.name = settings.name || "Unnamed";
	document.getElementById("company_name").innerText = this.name;
	this.money = settings.money || 0;
	var money = document.getElementById("company_money_value");
	money.innerText = parseInt(this.money) + "k";
	if (this.money < 0) {
		money.classList.add("negative");
	} else {
		money.classList.remove("negative");
	}
	this.transactions = settings.transactions || [];
	this.transaction = function (reason, amount, type) {
		type = type || "Other";
		amount = Math.round(amount * 100) / 100;
		this.money += amount;
		this.transactions.push({
			reason: reason,
			amount: amount,
			type: type,
			date: new Date()
		});
		var money = document.getElementById("company_money_value");
		money.innerText = parseInt(this.money) + "k";
		if (this.money < 0) {
			money.classList.add("negative");
		} else {
			money.classList.remove("negative");
		}
	}
};

SQUARIFIC.train.IndustrysPaint = function (industrys, handler) {
	this.industryTypes = industrys.industryTypes;
	industrys = industrys.industrys;
	this.onscreen = function onScreen (sx, sy, width, height, tx, ty, tWidth, tHeight) {
		if (sx - tWidth < tx &&
			sy - tHeight < ty &&
			sx + width + tWidth > tx &&
			sy + height + tHeight > ty) {
			return true;
		}
		return false;
	};
	this.paint = function industryPaint (ctx, container, x, y) {
		for (var key = 0; key < industrys.length; key++) {
			var div = document.getElementById("game_industry_" + key);
			var onscreen = this.onscreen(x, y, container.offsetWidth, container.offsetHeight, industrys[key].x, industrys[key].y, 100, 100);
			if (onscreen) {
				if (!div) {
					div = document.createElement("div");
					var name = document.createElement("div");
					var img = document.createElement("img");
					div.industry = industrys[key];
					name.industry = industrys[key];
					img.industry = industrys[key];
					div.className = "game_map_dot clickable";
					name.className = "game_map_name clickable"
					img.className = "game_map_image clickable";
					name.appendChild(document.createTextNode(industrys[key].type));
					img.src = this.industryTypes[industrys[key].type].imageUrl;
					img.alt = industrys[key].type;
					div.appendChild(img);
					div.appendChild(name);
					div.id = "game_industry_" + key;
					div.style.width = "10px";
					div.style.height = "10px";
					div.addEventListener("click", handler.onclick.bind(handler), false);
					div.addEventListener("mouseover", handler.onmouseover.bind(handler), false);
					container.appendChild(div);
				}
				div.style.left = Math.round(industrys[key].x - 5 - x);
				div.style.top = Math.round(industrys[key].y - 5 - y);
			} else {
				if (div) {
					div.parentNode.removeChild(div);
				}
			}
		}
	};
};

SQUARIFIC.train.TrainsPaint = function (world, handler) {
	var trainWidth = 40,
		trainHeight = 20;
	var trains = world.trains.trains;
	this.update = function (time) {
		var longRoute, runTime;
		for (var k = 0; k < trains.length; k++) {
			if (typeof trains[k].loadTime !== "number") {
				trains[k].loadTime = 30000;
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
				longRoute = tracks.routeBetween(trains[k].to, trains[k].route[trains[k].lastTo]);
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
	};
	this.onScreen = function onScreen (sx, sy, width, height, tx, ty, tWidth, tHeight) {
		if (sx - tWidth < tx &&
			sy - tHeight < ty &&
			sx + width + tWidth > tx &&
			sy + height + tHeight > ty) {
			return true;
		}
		return false;
	};
	this.paint = function trainPaint (ctx, div, x, y) {
		var tx, ty, trainDistance, distance, unit, onscreen, img, length, cargoDistance, mirrored, xdis, ydis, wx, wy;
		for (var k = 0; k < trains.length; k++) {
			mirrored = false;
			trainDistance = world.trains.locomotives[trains[k].type].speed(Math.ceil(trains[k].cargos.length / 8)) * (Date.now() - trains[k].runTimeStart);
			length = Math.sqrt((trains[k].from.x - trains[k].to.x) * (trains[k].from.x - trains[k].to.x) + (trains[k].from.y - trains[k].to.y) * (trains[k].from.y - trains[k].to.y));
			unit = trainDistance / length;
			if (trains[k].gray) {
				xdis = trains[k].from.x - trains[k].lastFrom.x;
				ydis = trains[k].from.y - trains[k].lastFrom.y;
				length = Math.sqrt(xdis * xdis + ydis * ydis);
			} else {
				xdis = trains[k].to.x - trains[k].from.x;
				ydis = trains[k].to.y - trains[k].from.y;
				length = Math.sqrt(xdis * xdis + ydis * ydis);
			}
			if (xdis < 0) {
				mirrored = true;
			}
			if (trains[k].gray) {
				tx = trains[k].from.x;
				ty = trains[k].from.y;
			} else if (unit > 1) {
				tx = trains[k].to.x;
				ty = trains[k].to.y;
			} else {
				tx = trains[k].from.x + unit * (trains[k].to.x - trains[k].from.x);
				if (!this.cargoHidden) {
					for (var i = 1; i <= Math.ceil(trains[k].cargos.length / 8); i++) {
						distance = i * cargoDistance;
						if (distance > trainDistance && !trains[k].gray) {
							distance = trainDistance;
						} else if (distance > length) {
							unit = 1;
						} else {
							unit = distance / length;
						}
						wx = tx - unit * xdis;
						wy = ty - unit * ydis;
						onscreen = this.onScreen(x, y, div.offsetWidth, div.offsetHeight, wx, wy, trainWidth, trainHeight);
						img = document.getElementById(trains[k].name + "-cargo-" + i);
						if (!onscreen) {
							if (img) {
								img.parentNode.removeChild(img);
							}
						} else {
							if (!img) {
								img = new Image();
								img.id = trains[k].name + "-cargo-" + i;
								img.style.position = "absolute";
								img.className = "clickable trainCargo";
								img.alt = "Train";
								img.title = "Train";
								img.train = trains[k];
								img.addEventListener("click", handler.trainClick.bind(handler), false);
								div.appendChild(img);
							}
							img.style.left = wx - x - 20 + "px";
							img.style.top = wy - y - 16 + "px";
							if (!trains[k].gray && !trains[k].noRoute) {
								img.src = "images/cargo-passengers.png";
							} else {
								img.src = "images/cargo-passengers-gray.png";
							}
							if (mirrored) {
								img.classList.add("mirror");
							} else {
								img.classList.remove("mirror");
							}
						}
					}
					for (; i <= 8; i++) {
						img = document.getElementById(trains[k].name + "-cargo-" + i);
						if (img) {
							img.parentNode.removeChild(img);
						}
					}
				}
			}
		}
		if (this.cargoHidden) {
			var imgs = document.getElementsByClassName("trainCargo");
			for (var key = 0; key < imgs.length; key++) {
				imgs[key].parentNode.removeChild(imgs[key]);
			}
		}
	};
};

SQUARIFIC.train.TracksPaint = function (tracks) {
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
};

SQUARIFIC.train.CitysPaint = function (citys, handler) {
	this.types = citys.types;
	citys = citys.citys;
	this.paint = function cityPaint (ctx, container, x, y) {
		var div, onscreen, name, img;
		for (var k = 0; k < citys.length; k++) {
			div = document.getElementById("city_" + k);
			onscreen = this.onScreen(citys[k].x, citys[k].y, x - 50, y - 50, container.offsetWidth + 100, container.offsetHeight + 100);
			if (this.types[this.types[citys[k].type].next] && this.types[this.types[citys[k].type].next].population < citys[k].population) {
				citys[k].type = this.types[citys[k].type].next;
			}
			if (onscreen) {
				if (!div) {
					div = document.createElement("div");
					var name = document.createElement("div");
					var img = document.createElement("img");
					name.appendChild(document.createTextNode(citys[k].name + " (" + citys[k].population + ")"));
					name.className = "game_map_name clickable"
					name.city = citys[k];
					img.city = citys[k];
					img.className = "game_map_image clickable";
					div.appendChild(img);
					div.appendChild(name);
					div.className = "game_map_dot clickable";
					div.id = "city_" + k;
					div.style.width = "10px";
					div.style.height = "10px";
					div.city = citys[k];
					if (handler) {
						div.addEventListener("click", handler.onclick.bind(handler), false);
						div.addEventListener("mouseover", handler.onmouseover.bind(handler), false);
					}
					container.appendChild(div);
				}
				div.children[0].src = "images/city-" + citys[k].type + ".png";
				div.children[1].removeChild(div.children[1].firstChild);
				div.children[1].appendChild(document.createTextNode(citys[k].name + " (" + citys[k].population + ")"));
				div.style.left = Math.round(citys[k].x - 5 - x) + "px";
				div.style.top = Math.round(citys[k].y - 5 - y) + "px";
			} else {
				if (div) {
					div.parentNode.removeChild(div);
				}
			}
		}
		this.lastX = x;
		this.lastY = y;
	};
	this.onScreen = function (x, y, sx, sy, width, height) {
		if (x > sx && x < sx + width &&
			y > sy && y < sy + height) {
			return true;
		}
		return false;
	};
};

SQUARIFIC.train.InputHandler = function InputHandler (world, container, out, layers) {
	this.state = {};
	this.keydown = function keydown (event) {
		if (typeof event.target.value !== "undefined") {
			return;
		}
		switch (event.keyCode) {
			case 37: //Left
				layers.x -= 10;
			break;
			case 38: //Up
				layers.y -= 10;
			break;
			case 39: //Right
				layers.x += 10;
			break;
			case 40: //Down
				layers.y += 10;
			break;
		}
	};
	this.mousedown = function mousedown (event) {
		this.state.mousedown = true;
		this.state.lastX = event.clientX;
		this.state.lastY = event.clientY;
		this.state.moved = false;
	};
	this.mousemove = function mousemove (event) {
		if (this.state.mousedown) {
			document.body.style.cursor = "move";
			layers.x += this.state.lastX - event.clientX;
			layers.y += this.state.lastY - event.clientY;
			this.state.lastX = event.clientX;
			this.state.lastY = event.clientY;
			this.state.moved = true;
		}
	};
	this.mouseup = function mouseup (event) {
		document.body.style.cursor = "default";
		this.state.mousedown = false;
	};
	this.onmouseover = function mouseover (event) {
		if (this.track) {
			var target = event.target.city || event.target.industry;
			out.gui.messages.add("Cost: " + Math.round(world.tracks.costPerPixel * Math.sqrt((this.track.x - target.x) * (this.track.x - target.x) + (this.track.y - target.y) * (this.track.y - target.y)) * 100) / 100, 2000);
		}
	};
	this.toggleTracking = function () {
		if (!this.startNewCompanyWindow()) {
			if (this.tracking) {
				delete this.tracking;
				delete this.track;
				document.getElementById("tracking_button").classList.remove("active");
				if (this.trackTarget) {
					this.trackTarget.style.background = "";
				}
				out.gui.messages.remove("Laying track");
			} else {
				this.tracking = true;
				document.getElementById("tracking_button").classList.add("active");
				out.gui.messages.add("Laying track");
			}
		}
	};
	this.toggleTrainMaking = function () {
		if (!this.startNewCompanyWindow()) {
			if (this.trainMaking) {
				delete this.trainMaking;
				document.getElementById("add_train_button").classList.remove("active");
				out.gui.closeWindow("Add a train.");
				out.gui.messages.remove("Adding a new train.");
			} else {
				this.trainMaking = true;
				document.getElementById("add_train_button").classList.add("active");
				out.gui.messages.add("Adding a new train.");
				var text = document.createElement("div"),
					content = document.createElement("div"),
					stopList = document.createElement("div"),
					trainList = document.createElement("div"),
					button = document.createElement("div"),
					error = document.createElement("div");
				button.id = "trainAdd_button";
				button.className = "button";
				button.appendChild(document.createTextNode("Next"));
				button.addEventListener("click", this.nextTrainStep, false);
				error.id = "trainAdd_error";
				stopList.id = "trainAdd_stopList";
				trainList.id = "trainAdd_trainList";
				trainList.className = "trainAdd_trainList";
				for (key in world.trains.locomotives) {
					var div = document.createElement("div"),
						image = new Image();
					image.src = world.trains.locomotives[key].imageUrl + ".png";
					image.alt = image.title = key;
					image.style.float = "right";
					div.id = "locomotive-" + key;
					div.className = "trainAdd_list_item";
					div.addEventListener("click", function (k, event) {
						if (world.company.money < world.trains.locomotives[k].cost) {
							document.getElementById("trainAdd_error").innerText = "You cannot afford this locomotive";
							return;
						}
						var	stops = document.getElementById("trainAdd_stopList");
						var route = [];
						for (var key = 0; key < stops.children.length; key++) {
							route.push(stops.children[key].target);
						}
						var train = world.trains.addTrain(k, route);
						world.company.transaction("Bought train: " + train, -world.trains.locomotives[k].cost, "Buying trains");
						this.toggleTrainMaking();
					}.bind(this, key), false);
					var t = document.createElement("div");
					t.innerText = key;
					t.style.display = "inline";
					div.appendChild(t);
					div.appendChild(image);
					var t = document.createElement("div");
					t.style.marginTop = "2px";
					t.innerText = "Speeds (km/h) with: 1 cargo: " + Math.round(world.trains.locomotives[key].speed(1) * 10000) + ", 2: " + Math.round(world.trains.locomotives[key].speed(2) * 10000) + ", 3: " + Math.round(world.trains.locomotives[key].speed(3) * 10000) + ", 4: " + Math.round(world.trains.locomotives[key].speed(4) * 10000) + ", 5: " + Math.round(world.trains.locomotives[key].speed(5) * 10000) + ", 6: " + Math.round(world.trains.locomotives[key].speed(6) * 10000) + ", 7: " + Math.round(world.trains.locomotives[key].speed(7) * 10000) + ", 8: " + Math.round(world.trains.locomotives[key].speed(8) * 10000);
					div.appendChild(t);
					var t = document.createElement("div");
					t.style.marginTop = "2px";
					t.innerText = "Cost: " + world.trains.locomotives[key].cost + "k";
					div.appendChild(t);
					var t = document.createElement("div");
					t.style.marginTop = "2px";
					t.innerText = "Running cost*: " + world.trains.locomotives[key].runningCost + "k";
					div.appendChild(t);
					trainList.appendChild(div);
				}
				text.innerText = "To add a stop for this train, click on the city. If you want to remove one, simply click on it in this list. When you're done, click Next to choose a locomotive.";
				text.id = "trainAdd_text";
				content.appendChild(text);
				content.appendChild(error);
				content.appendChild(stopList);
				content.appendChild(button);
				content.appendChild(trainList);
				var t = document.createElement("div");
				t.id = "trainAdd_five";
				t.style.marginTop = "2px";
				t.style.display = "none";
				t.innerText = "*Every five minutes";
				content.appendChild(t);
				out.gui.changeContent("Add a train.", content, {
					closeButton: this.toggleTrainMaking.bind(this)
				});
			}
		}
	};
	this.nextTrainStep = function nextTrainStep () {
		var list = document.getElementById("trainAdd_stopList"),
			key;
		if (list) {
			if (list.children.length < 2) {
				document.getElementById("trainAdd_error").innerHTML = '<div class="trainAdd_error">You need to add at least two stops.</div>';
				return;
			}
			for (key = 1; key < list.children.length; key++) {
				if (!world.tracks.routeBetween(list.children[key - 1].target, list.children[key].target)) {
					document.getElementById("trainAdd_error").innerHTML = '<div class="trainAdd_error">There is no route between ' + list.children[key - 1].innerText + " and " + list.children[key].innerText + '.</div>';
					return;
				}
			}
			list.style.display = "none";
			document.getElementById("trainAdd_trainList").style.display = "block";
			document.getElementById("trainAdd_five").style.display = "block";
			document.getElementById("trainAdd_error").innerHTML = "";
			document.getElementById("trainAdd_button").style.display = "none";
			document.getElementById("trainAdd_text").style.display = "none";
		}
	};
	this.toggleCompanyWindow = function () {
		if (!this.startNewCompanyWindow()) {
			if (!out.gui.closeWindow("Company overview")) {
				this.companyWindowCompacted = false;
				out.gui.changeContent("Company overview", this.returnCompanyWindowContent());
			}
		}
	};
	this.toggleCompactCompanyWindow = function () {
		if (this.companyWindowCompacted) {
			out.gui.changeContent("Company overview", this.returnCompanyWindowContent());
			this.companyWindowCompacted = false;
		} else {
			out.gui.changeContent("Company overview", this.returnCompanyWindowContent(true));
			this.companyWindowCompacted = true;
		}
	};
	this.returnCompanyWindowContent = function (compact) {
		var cont = document.createElement("div");
		var list = {};
		cont.innerHTML = "All transactions of your company: <br/><br/>";
		cont.style.maxHeight = "350px";
		cont.style.overflow = "auto";
		cont.style.margin = "10px";
		var button = document.createElement("div");
		button.innerText = "Toggle Compact List";
		button.addEventListener("click", this.toggleCompactCompanyWindow.bind(this), false);
		button.className = "button";
		cont.appendChild(button);
		var button = document.createElement("div");
		button.innerText = "Refresh";
		button.addEventListener("click", function (compact) {
			out.gui.changeContent("Company overview", this.returnCompanyWindowContent(compact));
		}.bind(this, compact), false);
		button.className = "button";
		cont.appendChild(button);
		if (world.company.transactions.length === 0) {
			cont.innerHTML += "None.";
		} else {
			var table = document.createElement("table");
			var thead = document.createElement("thead");
			var tr = document.createElement("tr");
			if (!compact) {
				var th = document.createElement("th");
				th.innerText = "Time";
				tr.appendChild(th);
			}
			var th = document.createElement("th");
			th.innerText = "Reason";
			tr.appendChild(th);
			var th = document.createElement("th");
			th.innerText = "Amount";
			tr.appendChild(th);
			thead.appendChild(tr);
			table.appendChild(thead);
			var tbody = document.createElement("tbody");
			for (var key = 0; key < world.company.transactions.length; key++) {
				if (compact) {
					if (!list[world.company.transactions[key].type]) {
						list[world.company.transactions[key].type] = 0;
					}
					list[world.company.transactions[key].type] += world.company.transactions[key].amount;
				} else {
					var tr = document.createElement("tr");
					var td = document.createElement("td");
					td.innerText = moment(world.company.transactions[key].date).format("H:mm:ss");
					tr.appendChild(td);
					var td = document.createElement("td");
					td.innerText = world.company.transactions[key].reason;
					tr.appendChild(td);
					var td = document.createElement("td");
					td.innerText = world.company.transactions[key].amount;
					tr.appendChild(td);
					tbody.appendChild(tr);
				}
			}
			for (var key in list) {
				var tr = document.createElement("tr");
				var td = document.createElement("td");
				td.innerText = key;
				tr.appendChild(td);
				var td = document.createElement("td");
				td.innerText = Math.round(list[key] * 100) / 100;
				tr.appendChild(td);
				tbody.appendChild(tr);
			}
			table.appendChild(tbody);
			cont.appendChild(table);
		}
		return cont;
	};
	this.startNewCompanyWindow = function () {
		if (!world.company) {
			var cont = document.createElement("div");
			cont.innerHTML = "You don't have a company yet so you'll have to create one first. <br/>You found investors that combined will be funding your company with an initial amount of 500k. <br/>Please provide a name for your company and we will take care of the rest.<br/><br/>";
			var label = document.createElement("span");
			label.innerText = "Name:";
			label.style.display = "inline-block";
			label.style.marginRight = "20px";
			var input = document.createElement("input");
			input.id = "new_company_name";
			input.placeholder = "Unnamed";
			input.type = "text";
			input.className = "input_label";
			var button = document.createElement("div");
			button.className = "button";
			button.id = "newCompany_confirm_button";
			button.style.display = "block";
			button.style.marginTop = "15px";
			button.style.textAlign = "center";
			button.innerText = "Start new company";
			button.addEventListener("click", function (event) {
				if (!event.target.waitingForResponse) {
					out.network.newCompany(document.getElementById("new_company_name").value);
					event.target.classList.add("disabled");
					event.target.waitingForResponse = true;
				}
			}, false);
			cont.appendChild(label);
			cont.appendChild(input);
			cont.appendChild(button);
			out.gui.changeContent("New company", cont);
			return true;
		}
		return false;
	};
	this.toggleMapWindow = function () {
		if (!out.gui.closeWindow("Map options")) {
			var cont = document.createElement("div");
			var button = document.createElement("div");
			button.id = "mapWindow-cargo-button";
			button.className = "button";
			var buttonImg = new Image();
			if (world.trains.cargoHidden) {
				url = "images/cargo-passengers-gray.png";
				alt = "Cargo on";
				button.className += " red";
			} else {
				url = "images/cargo-passengers.png";
				alt = "Cargo off";
				button.className += " green";
			}
			buttonImg.id = "mapWindow-cargo-button-image";
			buttonImg.src = url;
			buttonImg.alt = alt;
			buttonImg.title = alt;
			button.appendChild(buttonImg);
			button.addEventListener("click", this.toggleCargoVisibility.bind(this), false);
			cont.appendChild(button);
			out.gui.changeContent("Map options", cont);
		}
	};
	this.toggleCargoVisibility = function (event) {
		var img = document.getElementById("mapWindow-cargo-button-image");
		var button = document.getElementById("mapWindow-cargo-button");
		if (world.trains.cargoHidden) {
			button.classList.remove("red");
			button.classList.add("green");
			world.trains.cargoHidden = false;
			img.src = "images/cargo-passengers.png";
			img.alt = "Cargo off";
			img.title = "Cargo off";
		} else {
			button.classList.remove("green");
			button.classList.add("red");
			world.trains.cargoHidden = true;
			img.src = "images/cargo-passengers-gray.png";
			img.alt = "Cargo off";
			img.title = "Cargo off";
		}
	};
	this.trainClick = function trainClick (event) {
		out.gui.changeContent("Train " + event.target.train.name, this.returnTrainWindowContent(event.target.train), {
			closeButton: this.closeTrainWindow.bind(this, event.target.train)
		});
		setTimeout(this.updateCargoList.bind(this, event.target.train), 1000);
	};
	this.closeTrainWindow = function (train) {
		out.gui.messages.remove("Adding destination to " + train.name);
		out.gui.closeWindow("Train " + train.name);
	};
	this.returnTrainWindowContent = function (train) {
		var cont = document.createElement("div"), route;
		cont.style.maxHeight = "350px";
		cont.style.overflowY = "auto";
		cont.style.overflowX = "hidden";
		cont.style.margin = "5px";
		cont.style.paddingRight = "35px";
		cont.appendChild(this.span("Name: ", "bold"));
		cont.appendChild(this.span(train.name));
		cont.appendChild(document.createElement("br"));
		cont.appendChild(this.span("Route: ", "bold"));
		var list = document.createElement("div");
		list.className = "trainWindow_route_list";
		list.id = train.id + "_trainWindow_route_list";
		route = document.createElement("div");
		route.id = train.id + "_trainWindow_route_error";
		if (train.noRoute) {
			route.appendChild(this.span("This train does not have a valid route.", "trainAdd_error"));
		}
		cont.appendChild(route);
		for (var k = 0; k < train.route.length; k++) {
			route = document.createElement("div");
			route.appendChild(document.createTextNode(this.stationName(train.route[k])));
			route.className = "trainAdd_list_item";
			route.station = train.route[k];
			route.addEventListener("click", function (event) {
				event.target.parentNode.removeChild(event.target);
			});
			list.appendChild(route);
		}
		cont.appendChild(list);
		route = document.createElement("div");
		route.className = "add_new_route_button";
		route.appendChild(document.createTextNode("Add new destination"));
		route.addEventListener("click", function (train) {
			this.rerouting = train.id;
			out.gui.messages.add("Adding destination to " + train.name);
		}.bind(this, train));
		cont.appendChild(route);
		route = document.createElement("div");
		route.className = "add_new_route_button";
		route.appendChild(document.createTextNode("Save route"));
		route.addEventListener("click", function (train, event) {
			var list = document.getElementById(train.id + "_trainWindow_route_list");
			var error = document.getElementById(train.id + "_trainWindow_route_error");
			var route = [];
			var noroute;
			while (error.firstChild) {
				error.removeChild(error.firstChild);
			}
			if (list.children.length < 2) {
				error.appendChild(this.span("Add at least 2 stations.", "trainAdd_error"));
				noroute = true;
			}
			for (var key = 0; key < list.children.length; key++) {
				route.push(list.children[key].station);
				if (key === 0) {
					continue;
				}
				if (!world.tracks.routeBetween(list.children[key - 1].station, list.children[key].station)) {
					error.appendChild(this.span("No route between " + this.stationName(list.children[key - 1].station) + " and " + this.stationName(list.children[key].station), "trainAdd_error"));
					noroute = true;
				}
			}
			if (!noroute) {
				train.route = route;
				delete this.rerouting;
				out.gui.messages.remove("Adding destination to " + train.name);
			}
		}.bind(this, train));
		cont.appendChild(route);
		var span = this.span("Cargos (" + train.cargos.length + "): ", "bold");
		span.id = train.id + "_window_cargo_list_span";
		cont.appendChild(span);
		list = document.createElement("div");
		list.id = train.id + "_window_cargo_list";
		list.appendChild(this.cargoList(train.cargos));
		cont.appendChild(list);
		return cont;
	};
	this.onclick = function onclick (event) {
		if (this.rerouting) {
			var list = document.getElementById(this.rerouting + "_trainWindow_route_list");
			if (!list) {
				delete this.rerouting;
			}
		}
		if (this.tracking) {
			if (this.track) {
				var target = event.target.city || event.target.industry;
				var cost = Math.round(world.tracks.costPerPixel * Math.sqrt((this.track.x - target.x) * (this.track.x - target.x) + (this.track.y - target.y) * (this.track.y - target.y)) * 100) / 100;
				if (world.company.money < cost) {
					out.gui.messages.add("Your company doesn't have " + cost + "k to buy this track.", 3000);
					return;
				}
				if ((this.track.x !== target.x || this.track.y !== target.y) && tracks.newTrack(this.track, target)) {
					var first = this.track.name || this.track.type + " at (" + this.track.x + ", " + this.track.y + ")",
						second = target.name || target.type + " at (" + target.x + ", " + target.y + ")";
					world.company.transaction("Buying track between " + first + " and " + second, -cost, "Buying track");
				}
				this.trackTarget.style.background = "";
				delete this.track;
			} else {
				this.track = event.target.city || event.target.industry;
				if (event.target.classList.contains("game_map_dot")) {
					event.target.style.background = "rgb(94, 38, 38)";
					this.trackTarget = event.target;
				}
				if (event.target.parentNode.classList.contains("game_map_dot")) {
					event.target.parentNode.style.background = "rgb(94, 38, 38)";
					this.trackTarget = event.target.parentNode;
				}
			}
		} else if (list) {
			var route = document.createElement("div");
			route.station = event.target.city || event.target.industry;
			route.className = "trainAdd_list_item";
			route.addEventListener("click", function (event) {
				event.target.parentNode.removeChild(event.target);
			});
			route.appendChild(document.createTextNode(this.stationName(route.station)));
			list.appendChild(route);
		} else if (this.trainMaking) {
			var div = document.createElement("div");
			div.className = "trainAdd_list_item";
			if (event.target.city) {
				div.innerText = event.target.city.name + " (" + event.target.city.population + ")" + " at (" + event.target.city.x + ", " + event.target.city.y + ")";
			} else {
				div.innerText = event.target.industry.type + " at (" + event.target.industry.x + ", " + event.target.industry.y + ")";
			}
			div.addEventListener("click", function (event) {
				event.target.parentNode.removeChild(event.target);
			}, false);
			div.target = event.target.city || event.target.industry;
			document.getElementById("trainAdd_stopList").appendChild(div);
		} else {
			if (event.target.city) {
				out.gui.changeContent("City " + event.target.city.name + " at (" + event.target.city.x + "," + event.target.city.y + ")", this.returnCityWindowContent(event.target.city));
				setTimeout(this.updateCargoList.bind(this, event.target.city), 1000);
			} else {
				out.gui.changeContent(event.target.industry.type + " at (" + event.target.industry.x + ", " + event.target.industry.y + ")", this.returnIndustryWindowContent(event.target.industry));
				setTimeout(this.updateCargoList.bind(this, event.target.industry), 1000);
			}
		}
	};
	this.updateCargoList = function (target) {
		var list = document.getElementById(target.id + "_window_cargo_list");
		if (list) {
			var span = document.getElementById(target.id + "_window_cargo_list_span");
			while (span.firstChild) {
				span.removeChild(span.firstChild);
			}
			while (list.firstChild) {
				list.removeChild(list.firstChild);
			}
			span.appendChild(document.createTextNode("Cargos (" + target.cargos.length + "):"));
			list.appendChild(this.cargoList(target.cargos));
			setTimeout(this.updateCargoList.bind(this, target), 1000);
		}
	};
	this.returnIndustryWindowContent = function (industry) {
		var cont = document.createElement("div");
		cont.style.maxHeight = "350px";
		cont.style.overflowY = "auto";
		cont.style.overflowX = "hidden";
		cont.style.margin = "5px";
		cont.style.paddingRight = "35px";
		cont.appendChild(this.span("Type: ", "bold"));
		cont.appendChild(this.span(industry.type));
		cont.appendChild(document.createElement("br"));
		cont.appendChild(this.span("Generates: ", "bold"));
		cont.appendChild(document.createElement("br"));
		for (var key in world.industrys.industryTypes[industry.type].generation) {
			cont.appendChild(this.span(Math.round(world.industrys.genFactor * world.industrys.industryTypes[industry.type].genFactor * world.industrys.industryTypes[industry.type].generation[key] * 100) / 100 + " " + key));
			cont.appendChild(document.createElement("br"));
		}
		cont.appendChild(this.span("Accepts: ", "bold"));
		cont.appendChild(document.createElement("br"));
		for (var key in world.industrys.industryTypes[industry.type].accept) {
			cont.appendChild(this.span(world.industrys.industryTypes[industry.type].accept[key] + " " + key));
			cont.appendChild(document.createElement("br"));
		}
		cont.appendChild(this.span("Position: ", "bold"));
		cont.appendChild(this.span("(" + industry.x + ", " + industry.y + ")"));
		cont.appendChild(document.createElement("br"));
		var span = this.span("Cargos (" + industry.cargos.length + "): ", "bold");
		span.id = industry.id + "_window_cargo_list_span";
		cont.appendChild(span);
		var list = document.createElement("div");
		list.id = industry.id + "_window_cargo_list";
		list.appendChild(this.cargoList(industry.cargos));
		cont.appendChild(list);
		return cont;
	};
	this.returnCityWindowContent = function (city) {
		var cont = document.createElement("div");
		cont.style.maxHeight = "350px";
		cont.style.overflowY = "auto";
		cont.style.overflowX = "hidden";
		cont.style.margin = "5px";
		cont.style.paddingRight = "35px";
		cont.appendChild(this.span("Name: ", "bold"));
		cont.appendChild(this.span(city.name));
		cont.appendChild(document.createElement("br"));
		cont.appendChild(this.span("Population: ", "bold"));
		cont.appendChild(this.span(city.population));
		cont.appendChild(document.createElement("br"));
		cont.appendChild(this.span("Position: ", "bold"));
		cont.appendChild(this.span("(" + city.x + ", " + city.y + ")"));
		cont.appendChild(document.createElement("br"));
		cont.appendChild(this.span("Accepts: ", "bold"));
		cont.appendChild(document.createElement("br"));
		for (var key in world.citys.types[city.type].accept) {
			cont.appendChild(this.span(world.citys.types[city.type].accept[key] + " " + key));
			cont.appendChild(document.createElement("br"));
		}
		cont.appendChild(this.span("Passengers"));
		cont.appendChild(document.createElement("br"));
		var span = this.span("Cargos (" + city.cargos.length + "): ", "bold");
		span.id = city.id + "_window_cargo_list_span";
		cont.appendChild(span);
		var list = document.createElement("div");
		list.id = city.id + "_window_cargo_list";
		list.appendChild(this.cargoList(city.cargos));
		cont.appendChild(list);
		return cont;
	};
	this.span = function (text, className) {
		var span = document.createElement("span");
		span.className = className || "";
		span.appendChild(document.createTextNode(text));
		return span;
	};
	this.cargoList = function (cargoList) {
		var list = document.createElement("div");
		if (cargoList.length > 0) {
			for (var key = 0; key < cargoList.length; key++) {
				var cargo = document.createElement("div");
				cargo.style.width = "120%";
				cargo.appendChild(document.createTextNode(cargoList[key].type + " from " + this.stationName(cargoList[key].from) + " to " + this.stationName(cargoList[key].to)));
				list.appendChild(cargo);
			}
		} else {
			list.appendChild(document.createTextNode("There is no cargo."));
		}
		return list;
	};
	this.stationName = function (station) {
		if (station.population) {
			return station.name + " (" + station.population + ") at (" + station.x + ", " + station.y + ")";
		} else {
			return station.type + " at (" + station.x + ", " + station.y + ")";
		}
	};
	document.addEventListener("keydown", this.keydown.bind(this), false);
	container.addEventListener("mousedown", this.mousedown.bind(this), false);
	document.addEventListener("mousemove", this.mousemove.bind(this), false);
	document.addEventListener("mouseup", this.mouseup.bind(this), false);
	container.addEventListener("touchstart", function (event) {
		this.mousedown({
			clientX: event.touches[0].clientX,
			clientY: event.touches[0].clientY
		});
	}.bind(this), false);
	document.addEventListener("touchmove", function (event) {
		this.mousemove({
			clientX: event.touches[0].clientX,
			clientY: event.touches[0].clientY
		});
		event.preventDefault();
	}.bind(this), false);
	document.addEventListener("touchend", this.mouseup.bind(this), false);
};

SQUARIFIC.train.LocalServer = function LocalServer (trainInstance, settings) {
	var callbacks = {};
	var serverCallbacks = {};
	settings = settings || {};
	settings.seed = settings.seed || 0.2615;
	settings.chunkSize = settings.chunkSize || 100;
	// Event Registers
	this.on = function on (type, cb) {
		callbacks[type] = callbacks[type] || [];
		if (typeof cb === "function") {
			callbacks[type].push(cb);
		} else {
			throw "Callback has to be of type 'function'";
		}
	};
	this.cb = function cb (type, data) {
		callbacks[type] = callbacks[type] || [];
		for (var key = 0; key < callbacks[type].length; key++) {
			callbacks[type][key](data);
		}
	};
	this.serverOn = function serverOn (type, cb) {
		serverCallbacks[type] = serverCallbacks[type] || [];
		if (typeof cb === "function") {
			serverCallbacks[type].push(cb);
		} else {
			throw "Callback has to be of type 'function'";
		}
	};
	this.emit = function (type, data) {
		serverCallbacks[type] = serverCallbacks[type] || [];
		for (var key = 0; key < serverCallbacks[type].length; key++) {
			serverCallbacks[type][key](data);
		}
	};
	// Communication
	this.connect = function () {
		this.cb("connected", {
			seed: settings.seed,
			tracks: [],
			trains: [],
			company: {},
			now: Date.now(),
			chunkSize: settings.chunkSize
		});
	};
	this.getChunkData = function (chunk) {
		var chunkData = {
			citys: [],
			industrys: [],
		};
		for (var x = 0; x < settings.chunkSize; x++) {
			for (var y = 0; y < settings.chunkSize; y++) {
				if (Math.random() < 0.0002 && trainInstance.map.getBlockData(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y) > 0.53 && !trainInstance.citys.getCityNear(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y, 150) && !trainInstance.industrys.getIndustryNear(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y, 90)) {
					trainInstance.citys.newCity(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y);
				}
				if (Math.random() < 0.0001 && trainInstance.map.getBlockData(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y) > 0.53 && !trainInstance.citys.getCityNear(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y, 90) && !trainInstance.industrys.getIndustryNear(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y, 130)) {
					trainInstance.industrys.newIndustry(chunk[0] * settings.chunkSize + x, chunk[1] * settings.chunkSize + y);
				}
			}
		}
		this.cb("getChunkData", chunkData);
	};
	this.ping = function ping () {
		this.cb("pong", Date.now());
	};
	// Generation and controllers
	this.generation = SQUARIFIC.train.Generation(trainInstance);
	this.trainController = new SQUARIFIC.train.TrainController(trainInstance, this);
	//Register all events
	this.serverOn("ping", this.ping.bind(this));
	this.serverOn("getChunkData", this.getChunkData.bind(this));
	this.serverOn("newTrain", this.trainController.addTrain);
};

SQUARIFIC.train.Network = function Network (world, trainInstance, settings, socket) {
	this.serverTimeDifference = 0;
	settings = settings || {};
	settings.server = settings.server || settings.url || settings.connection || location.host;
	this.newTrain = function (train) {
		train.loadTime = 0;
		socket.emit("newTrain", train);
	};
	this.getChunkData = function (chunk) {
		socket.emit("getChunkData", chunk);
	};
	this.onGetChunkData = function (chunkData) {
		var key;
		for (key = 0; key < chunkData.citys.length; key++) {
			world.citys.citys.push(chunkData.citys[key]);
		}
		for (key = 0; key < chunkData.industrys.length; key++) {
			world.industrys.industrys.push(chunkData.industrys[key]);
		}
	};
	this.onTrainUpdate = function (train) {
		world.trains.updateTrain(train);
	};
	this.onNewCompany = function (data) {
		if (!data.failed) {
			trainInstance.company = new SQUARIFIC.train.Company(data);
			trainInstance.gui.closeWindow("New company");
		} else {
			var button = document.getElementById("newCompany_confirm_button");
			button.waitingForResponse = false;
			button.classList.remove("disabled");
			var error = document.createElement("div");
			error.className = "trainAdd_error";
			error.innerHTML = data.failed;
			var errorContainer = document.getElementById("newCompany_error_container");
			while (errorCotnainer.firstChild) {
				errorContainer.removeChild(errorContainer.firstChild);
			}
			errorContainer.appendChild(error);
		}
	};
	this.newCompany = function (data) {
		socket.emit("newCompany", data);
	};
	this.pong = function (serverNow) {
		var now = Date.now();
		this.serverTimeDifference += (now - this.lastPing) / 2;
		this.serverTimeDifference = (this.serverTimeDifference + serverNow - now + (now - this.lastPing) / 2) / 2;
	};
	socket.on("pong", this.pong.bind(this));
	socket.on("trainUpdate", this.onTrainUpdate.bind(this));
	socket.on("getChunkData", this.onGetChunkData.bind(this));
	socket.on("newCompany", this.onNewCompany.bind(this));
	setTimeout(function () { socket.emit("ping"); this.lastPing = Date.now();}.bind(this), 0);
};