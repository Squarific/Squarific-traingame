var SQUARIFIC = SQUARIFIC || {};
SQUARIFIC.framework = {};

if (!Function.prototype.bind) {
	Function.prototype.bind = function (oThis) {
		var aArgs = Array.prototype.slice.call(arguments, 1),
			fToBind = this,
			fNOP = function () {},
			fBound = function () {
				return fToBind.apply(this instanceof fNOP && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
			};
		fNOP.prototype = this.prototype;
		fBound.prototype = new fNOP();
		return fBound;
	};
}

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

SQUARIFIC.framework.Chunks = function (settings, getXYcolor) {
	settings = settings || {};
	settings.chunkSize = settings.chunkSize || 400;
	settings.maxDrawLines = settings.maxDrawLines || 2;
	var callBacks = {};
	this.chunks = {};
	this.chunkSize = settings.chunkSize;
	this.createCtx = function () {
		var	canvas = document.createElement("canvas"),
			ctx = canvas.getContext("2d");
		canvas.width = settings.chunkSize;
		canvas.height = settings.chunkSize;
		return ctx;
	};
	this.createChunk = function (cx, cy) {
		var ctx = this.createCtx();
		this.busy = true;
		setTimeout(this.fillCanvas.bind(this, ctx, cx, cy), 0);
		ctx.lastLine = 0;
		return ctx.canvas;
	};
	this.fillCanvas = function (ctx, cx, cy) {
		var runTime = Date.now();
		var x = ctx.lastLine,
			maxX = x + settings.maxDrawLines;
		if (maxX >= settings.chunkSize - 1) {
			maxX = settings.chunkSize - 1;
			var ready = true;
		}
		for (; x <= maxX; x++) {
			for (var y = 0; y < settings.chunkSize; y++) {
				ctx.drawImage(getXYcolor((cx * settings.chunkSize) + x, (cy * settings.chunkSize) + y), x, y);
			}
		}
		if (!ready) {
			ctx.lastLine = x;
			setTimeout(this.fillCanvas.bind(this, ctx, cx, cy), 0);
		} else {
			ctx.canvas.ready = true;
			this.busy = false;
			this.callBack("chunkready", [cx, cy]);
		}
		runTime = Date.now() - runTime;
		if (runTime > 180 || runTime < 20) {
			settings.maxDrawLines = Math.floor(100 / runTime * settings.maxDrawLines);
		}
		if (settings.maxDrawLines < 2) {
			settings.maxDrawLines = 2;
		}
	};
	this.getChunkCanvas = function getChunkCanvas (x, y) {
		this.chunks[x] = this.chunks[x] || {};
		if (!this.chunks[x][y] || !this.chunks[x][y].ready) {
			if (!this.busy) {
				this.chunks[x][y] = this.createChunk(x, y);
			}
			return this.emptyChunk;
		}
		return this.chunks[x][y];
	};
	this.callBack = function callBack (event,arg) {
		callBacks[event] = callBacks[event] || [];
		for (var key = 0; key < callBacks[event].length; key++) {
			callBacks[event][key](arg);
		}
	};
	this.addEventListener = function addEventListener (event, cb) {
		if (typeof cb === "function") {
			callBacks[event] = callBacks[event] || [];
			callBacks[event].push(cb);
		}
	};
	this.emptyChunk = this.createCtx();
	this.emptyChunk.beginPath();
	this.emptyChunk.rect(0, 0, settings.chunkSize, settings.chunkSize);
	this.emptyChunk.fillStyle = "gray";
	this.emptyChunk.fill();
	this.emptyChunk = this.emptyChunk.canvas;
};

SQUARIFIC.framework.Captions = function Captions (captions) {
	this.cssRgbFromNumber = function cssRgbFromNumber (number) {
		var r = 0, g = 0, b = 0;
		for (var key = 0; key < captions.length; key++) {
			if (number >= captions[key].min && number <= captions[key].max) {
				if (typeof captions[key].rMin === "number" && typeof captions[key].rMax === "number") {
					r = captions[key].rMin + (number - captions[key].min) / (captions[key].max - captions[key].min) * (captions[key].rMax - captions[key].rMin);
				}
				if (typeof captions[key].gMin === "number" && typeof captions[key].gMax === "number") {
					g = captions[key].gMin + (number - captions[key].min) / (captions[key].max - captions[key].min) * (captions[key].gMax - captions[key].gMin);
				}
				if (typeof captions[key].bMin === "number" && typeof captions[key].bMax === "number") {
					b = captions[key].bMin + (number - captions[key].min) / (captions[key].max - captions[key].min) * (captions[key].bMax - captions[key].bMin);
				}
				return "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
			}
		}
	};
};

SQUARIFIC.framework.Painter = function Painter () {
	var colorCtxs = {};
	this.createCtx = function (settings) {
		var	canvas = document.createElement("canvas"),
			ctx = canvas.getContext("2d");
		canvas.width = settings.width || 1;
		canvas.height = settings.height || 1;
		return ctx;
	};
	this.getColor = function (color) {
		if (!colorCtxs[color]) {
			colorCtxs[color] = this.createCtx({
				width: 1,
				height: 1
			});
			colorCtxs[color].beginPath();
			colorCtxs[color].rect(0, 0, 1, 1);
			colorCtxs[color].fillStyle = color;
			colorCtxs[color].fill();
		}
		return colorCtxs[color].canvas;
	};
};

//http://asserttrue.blogspot.be/2011/12/perlin-noise-in-javascript_31.html
SQUARIFIC.framework.perlinNoise = new function() {

this.noise = function(x, y, z) {

   var p = new Array(512);
   var permutation = [ 151,160,137,91,90,15,
   131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
   190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
   88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
   77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
   102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
   135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
   5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
   223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
   129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
   251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
   49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
   138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
   ];
   for (var i=0; i < 256 ; i++) 
 p[256+i] = p[i] = permutation[i]; 

      var X = Math.floor(x) & 255,                  // FIND UNIT CUBE THAT
          Y = Math.floor(y) & 255,                  // CONTAINS POINT.
          Z = Math.floor(z) & 255;
      x -= Math.floor(x);                                // FIND RELATIVE X,Y,Z
      y -= Math.floor(y);                                // OF POINT IN CUBE.
      z -= Math.floor(z);
      var    u = fade(x),                                // COMPUTE FADE CURVES
             v = fade(y),                                // FOR EACH OF X,Y,Z.
             w = fade(z);
      var A = p[X  ]+Y, AA = p[A]+Z, AB = p[A+1]+Z,      // HASH COORDINATES OF
          B = p[X+1]+Y, BA = p[B]+Z, BB = p[B+1]+Z;      // THE 8 CUBE CORNERS,

      return scale(lerp(w, lerp(v, lerp(u, grad(p[AA  ], x  , y  , z   ),  // AND ADD
                                     grad(p[BA  ], x-1, y  , z   )), // BLENDED
                             lerp(u, grad(p[AB  ], x  , y-1, z   ),  // RESULTS
                                     grad(p[BB  ], x-1, y-1, z   ))),// FROM  8
                     lerp(v, lerp(u, grad(p[AA+1], x  , y  , z-1 ),  // CORNERS
                                     grad(p[BA+1], x-1, y  , z-1 )), // OF CUBE
                             lerp(u, grad(p[AB+1], x  , y-1, z-1 ),
                                     grad(p[BB+1], x-1, y-1, z-1 )))));
   }
   function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
   function lerp( t, a, b) { return a + t * (b - a); }
   function grad(hash, x, y, z) {
      var h = hash & 15;                      // CONVERT LO 4 BITS OF HASH CODE
      var u = h<8 ? x : y,                 // INTO 12 GRADIENT DIRECTIONS.
             v = h<4 ? y : h==12||h==14 ? x : z;
      return ((h&1) == 0 ? u : -u) + ((h&2) == 0 ? v : -v);
   } 
   function scale(n) { return (1 + n)/2; }
}

SQUARIFIC.framework.SimplexBlockMap = function SimplexBlockMap (seed, zoom) {
	this.getBlockData = function getBlockData (x, y) {
		return SQUARIFIC.framework.perlinNoise.noise(x / zoom, y / zoom, seed);
	};
};

SQUARIFIC.framework.Renderer = function Renderer (container, layers) {
	this.ctxs = [];
	this.divs = [];
	this.resize = function resize (event) {
		for (var k = 0; k < this.ctxs.length; k++) {
			this.ctxs[k].canvas.width = window.innerWidth;
			this.ctxs[k].canvas.height = window.innerHeight;
		}
	};
	this.newCtx = function (level) {
		var c = document.createElement("canvas");
		c.style.zIndex = level;
		c.width = window.innerWidth;
		c.height = window.innerHeight;
		container.appendChild(c);
		c = c.getContext("2d");
		return c;
	};
	this.ctx = function (key) {
		if (!this.ctxs[key]) {
			this.ctxs[key] = this.newCtx(key);
		}
		return this.ctxs[key];
	};
	this.newDiv = function (level) {
		var d = document.createElement("div");
		d.className = "fullscreen";
		d.style.zIndex = level;
		container.appendChild(d);
		return d;
	};
	this.div = function (key) {
		if (!this.divs[key]) {
			this.divs[key] = this.newDiv(key);
		}
		return this.divs[key];
	};
	this.render = function () {
		for (var key = 0; key < layers.length; key++) {
			for (var a = 0; a < layers[key].length; a++) {
				layers[key][a].paint(this.ctx(key), this.div(key), layers.x, layers.y);
			}
		}
		requestAnimationFrame(this.render.bind(this));
	};
	requestAnimationFrame(this.render.bind(this));
	window.addEventListener("resize", this.resize.bind(this));
};

SQUARIFIC.framework.Gui = function Gui (container) {
	var dragging = {}, messages = [];
	this.addWindow = function addWindow (title, options) {
		var window = document.getElementById(title + "-window");
		if (window) {
			return;
		}
		options = options || {};
		options.closeButton = options.closeButton || this.closeWindow.bind(this, title);
		var window = document.createElement("div"),
			topBar = document.createElement("div"),
			titlediv = document.createElement("div"),
			content = document.createElement("div"),
			close = document.createElement("div"),
			clear = document.createElement("div");
		clear.className = "clear";
		window.id = title + "-window";
		window.className = "window";
		content.id = title + "-window-content";
		topBar.className = "window-topBar";
		titlediv.className = "window-title";
		titlediv.innerText = title;
		topBar.addEventListener("mousedown", this.mousedown.bind(this, title));
		document.addEventListener("mouseup", this.mouseup.bind(this, title));
		document.addEventListener("mousemove", this.mousemove);
		topBar.addEventListener("touchstart", function (title, event) {
			var el = event.target, x = y = 0;
			while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
				x += el.offsetLeft - el.scrollLeft;
				y += el.offsetTop - el.scrollTop;
				el = el.offsetParent;
			}
			x = event.touches[0].clientX - x;
			y = event.touches[0].clientY - y;
			this.mousedown(title, {
				layerX: x,
				layerY: y
			});
		}.bind(this, title));
		document.addEventListener("touchmove", function (event) {
			this.mousemove({
				clientX: event.touches[0].clientX,
				clientY: event.touches[0].clientY
			});
			return false;
		}.bind(this));
		document.addEventListener("touchend", this.mouseup.bind(this, title));
		topBar.appendChild(titlediv);
		close.innerText = "X";
		close.className = "window-close";
		close.addEventListener("click", options.closeButton);
		content.className = "window-content";
		topBar.appendChild(close);
		topBar.appendChild(clear);
		window.appendChild(topBar);
		window.appendChild(content);
		container.appendChild(window);
		return window;
	};
	this.mousedown = function mousedown (title, event) {
		dragging[title] = {x: event.layerX, y: event.layerY};
	};
	this.mouseup = function mouseup (title) {
		delete dragging[title];
	};
	this.mousemove = function mousemove (event) {
		var div;
		for (var title in dragging) {
			div = document.getElementById(title + "-window");
			if (div) {
				div.style.left = event.clientX - dragging[title].x + "px";
				div.style.top = event.clientY - dragging[title].y + "px";
			}
		}
	};
	this.closeWindow = function closeWindow (title) {
		var div = document.getElementById(title + "-window");
		if (div) {
			div.parentNode.removeChild(div);
		}
		return true;
	};
	this.changeContent = function changeContent (title, append, options) {
		var div = document.getElementById(title + "-window-content");
		if (!div) {
			this.addWindow(title, options);
			div = document.getElementById(title + "-window-content");
		}
		while (div.firstChild) {
			div.removeChild(div.firstChild);
		}
		div.appendChild(append);
	};
	this.appendContent = function appendContent (title, append, options) {
		var div = document.getElementById(title + "-window-content");
		if (!div) {
			this.addWindow(title, options);
			div = document.getElementById(title + "-window-content");
		}
		div.appendChild(append);
	};
	this.messages = {};
	this.messages.add = function (m, t) {
		for (var k = 0; k < messages.length; k++) {
			if (messages[k] === m) {
				return;
			}
		}
		messages.push(m);
		document.getElementById("topbar_action").innerText = m;
		if (typeof t === "number") {
			setTimeout(this.remove.bind(this, m), t);
		}
	};
	this.messages.remove = function (m) {
		for (var k = 0; k < messages.length; k++) {
			if (messages[k] === m) {
				messages.splice(k, 1);
			}
		}
		if (messages.length > 0) {
			document.getElementById("topbar_action").innerText = messages[messages.length - 1];
		} else {
			document.getElementById("topbar_action").innerText = "Welcome";
		}
	};
};
