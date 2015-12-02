/**
 * Springy v2.7.1
 *
 * Copyright (c) 2010-2013 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
 (function (root, factory) {
 	if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(function () {
    	return (root.returnExportsGlobal = factory());
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals
    root.Springy = factory();
  }
}(this, function() {
	"use strict";

	var Springy = {};

	var Graph = Springy.Graph = function() {
		this.nodeSet = {};
		this.nodes = [];
		this.edges = [];
		this.adjacency = {};

		this.nextNodeId = 0;
		this.nextEdgeId = 0;
		this.eventListeners = [];
	};

	var Node = Springy.Node = function(id, data) {
		this.id = id;
		this.data = (data !== undefined) ? data : {};

		// Data fields used by layout algorithm in this file:
		// this.data.mass
		// Data used by default renderer in springyui.js
		// this.data.label
	};

	var Edge = Springy.Edge = function(id, source, target, data) {
		this.id = id;
		this.source = source;
		this.target = target;
		this.data = (data !== undefined) ? data : {};

		var nodes = [this.source.id, this.target.id];
		nodes.sort();
		this.nodes = nodes.join('_');

		// Edge data field used by layout alorithm
		// this.data.length
		// this.data.type
	};

	Graph.prototype.addNode = function(node) {
		if (!(node.id in this.nodeSet)){
			this.nodes.push(node);
		}

		this.nodeSet[node.id] = node;

		this.notify();
		return node;
	};

	Graph.prototype.addNodes = function() {
		// accepts variable number of arguments, where each argument
		// is a string that becomes both node identifier and label
		for (var i = 0; i < arguments.length; i++) {
			var name = arguments[i];
			var node = new Node(name, {label:name});
			this.addNode(node);
		}
	};

	Graph.prototype.addEdge = function(edge) {
		var exists = false;
		this.edges.forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.edges.push(edge);
		}

		if (!(edge.source.id in this.adjacency)) {
			this.adjacency[edge.source.id] = {};
		}
		if (!(edge.target.id in this.adjacency[edge.source.id])) {
			this.adjacency[edge.source.id][edge.target.id] = [];
		}

		exists = false;
		this.adjacency[edge.source.id][edge.target.id].forEach(function(e) {
			if (edge.id === e.id) { exists = true; }
		});

		if (!exists) {
			this.adjacency[edge.source.id][edge.target.id].push(edge);
		}

		this.notify();
		return edge;
	};

	Graph.prototype.addEdges = function() {
		// accepts variable number of arguments, where each argument
		// is a triple [nodeid1, nodeid2, attributes]
		for (var i = 0; i < arguments.length; i++) {
			var e = arguments[i];
			var node1 = this.nodeSet[e[0]];
			if (node1 === undefined) {
				throw new TypeError("invalid node name: " + e[0]);
			}
			var node2 = this.nodeSet[e[1]];
			if (node2 === undefined) {
				throw new TypeError("invalid node name: " + e[1]);
			}
			var attr = e[2];

			this.newEdge(node1, node2, attr);
		}
	};

	Graph.prototype.newNode = function(data) {
		var node = new Node(this.nextNodeId++, data);
		this.addNode(node);
		return node;
	};

	Graph.prototype.newEdge = function(source, target, data) {
		var edge = new Edge(this.nextEdgeId++, source, target, data);
		this.addEdge(edge);
		return edge;
	};


	// add nodes and edges from JSON object
	Graph.prototype.loadJSON = function(json) {
	/**
	Springy's simple JSON format for graphs.

	historically, Springy uses separate lists
	of nodes and edges:

		{
			"nodes": [
				"center",
				"left",
				"right",
				"up",
				"satellite"
			],
			"edges": [
				["center", "left"],
				["center", "right"],
				["center", "up"]
			]
		}

		**/
		// parse if a string is passed (EC5+ browsers)
		if (typeof json == 'string' || json instanceof String) {
			json = JSON.parse( json );
		}

		if ('nodes' in json || 'edges' in json) {
			this.addNodes.apply(this, json['nodes']);
			this.addEdges.apply(this, json['edges']);
		}
	};


	// find the edges from node1 to node2
	Graph.prototype.getEdges = function(node1, node2) {
		if (node1.id in this.adjacency && node2.id in this.adjacency[node1.id]) {
			return this.adjacency[node1.id][node2.id];
		}
		return [];
	};

	// remove a node and it's associated edges from the graph
	Graph.prototype.removeNode = function(node) {
		if (node.id in this.nodeSet) {
			delete this.nodeSet[node.id];
		}

		for (var i = this.nodes.length - 1; i >= 0; i--) {
			if (this.nodes[i].id === node.id) {
				this.nodes.splice(i, 1);
			}
		}

		this.detachNode(node);
	};

	// removes edges associated with a given node
	Graph.prototype.detachNode = function(node) {
		var tmpEdges = this.edges.slice();
		tmpEdges.forEach(function(e) {
			if (e.source.id === node.id || e.target.id === node.id) {
				this.removeEdge(e);
			}
		}, this);

		this.notify();
	};

	// remove a node and it's associated edges from the graph
	Graph.prototype.removeEdge = function(edge) {
		for (var i = this.edges.length - 1; i >= 0; i--) {
			if (this.edges[i].id === edge.id) {
				this.edges.splice(i, 1);
			}
		}

		for (var x in this.adjacency) {
			for (var y in this.adjacency[x]) {
				var edges = this.adjacency[x][y];

				for (var j=edges.length - 1; j>=0; j--) {
					if (this.adjacency[x][y][j].id === edge.id) {
						this.adjacency[x][y].splice(j, 1);
					}
				}

				// Clean up empty edge arrays
				if (this.adjacency[x][y].length === 0) {
					delete this.adjacency[x][y];
				}
			}

			// Clean up empty objects
			if (isEmpty(this.adjacency[x])) {
				delete this.adjacency[x];
			}
		}

		this.notify();
	};

	/* Merge a list of nodes and edges into the current graph. eg.
	var o = {
		nodes: [
			{id: 123, data: {type: 'user', userid: 123, displayname: 'aaa'}},
			{id: 234, data: {type: 'user', userid: 234, displayname: 'bbb'}}
		],
		edges: [
			{from: 0, to: 1, type: 'submitted_design', directed: true, data: {weight: }}
		]
	}
	*/
	Graph.prototype.merge = function(data) {
		var nodes = [];
		data.nodes.forEach(function(n) {
			nodes.push(this.addNode(new Node(n.id, n.data)));
		}, this);

		data.edges.forEach(function(e) {
			var from = nodes[e.from];
			var to = nodes[e.to];

			var id = (e.directed)
			? (id = e.type + "-" + from.id + "-" + to.id)
				: (from.id < to.id) // normalise id for non-directed edges
				? e.type + "-" + from.id + "-" + to.id
				: e.type + "-" + to.id + "-" + from.id;

				var edge = this.addEdge(new Edge(id, from, to, e.data));
				edge.data.type = e.type;
			}, this);
	};

	Graph.prototype.filterNodes = function(fn) {
		var tmpNodes = this.nodes.slice();
		tmpNodes.forEach(function(n) {
			if (!fn(n)) {
				this.removeNode(n);
			}
		}, this);
	};

	Graph.prototype.filterEdges = function(fn) {
		var tmpEdges = this.edges.slice();
		tmpEdges.forEach(function(e) {
			if (!fn(e)) {
				this.removeEdge(e);
			}
		}, this);
	};


	Graph.prototype.addGraphListener = function(obj) {
		this.eventListeners.push(obj);
	};

	Graph.prototype.notify = function() {
		this.eventListeners.forEach(function(obj){
			obj.graphChanged();
		});
	};

	// -----------
	var Layout = Springy.Layout = {};
	Layout.ForceDirected = function(graph, stiffness, repulsion, damping, minEnergyThreshold) {
		this.graph = graph;
		this.stiffness = stiffness; // spring stiffness constant
		this.repulsion = repulsion; // repulsion constant
		this.damping = damping; // velocity damping factor
		this.minEnergyThreshold = minEnergyThreshold || 0.01; //threshold used to determine render stop

		this.nodePoints = {}; // keep track of points associated with nodes
		this.edgeSprings = {}; // keep track of springs associated with edges
	};

	Layout.ForceDirected.prototype.point = function(node) {
		if (!(node.id in this.nodePoints)) {
			var mass = (node.data.mass !== undefined) ? node.data.mass : 1.0;
			this.nodePoints[node.id] = new Layout.ForceDirected.Point(Vector.random(), mass);
		}

		return this.nodePoints[node.id];
	};

	Layout.ForceDirected.prototype.spring = function(edge) {
		if (!(edge.id in this.edgeSprings)) {
			var length = (edge.data.length !== undefined) ? edge.data.length : 1.0;

			var existingSpring = false;

			var from = this.graph.getEdges(edge.source, edge.target);
			from.forEach(function(e) {
				if (existingSpring === false && e.id in this.edgeSprings) {
					existingSpring = this.edgeSprings[e.id];
				}
			}, this);

			if (existingSpring !== false) {
				return new Layout.ForceDirected.Spring(existingSpring.point1, existingSpring.point2, 0.0, 0.0);
			}

			var to = this.graph.getEdges(edge.target, edge.source);
			from.forEach(function(e){
				if (existingSpring === false && e.id in this.edgeSprings) {
					existingSpring = this.edgeSprings[e.id];
				}
			}, this);

			if (existingSpring !== false) {
				return new Layout.ForceDirected.Spring(existingSpring.point2, existingSpring.point1, 0.0, 0.0);
			}

			this.edgeSprings[edge.id] = new Layout.ForceDirected.Spring(
				this.point(edge.source), this.point(edge.target), length, this.stiffness
				);
		}

		return this.edgeSprings[edge.id];
	};

	// callback should accept two arguments: Node, Point
	Layout.ForceDirected.prototype.eachNode = function(callback) {
		var t = this;
		this.graph.nodes.forEach(function(n){
			callback.call(t, n, t.point(n));
		});
	};

	// callback should accept two arguments: Edge, Spring
	Layout.ForceDirected.prototype.eachEdge = function(callback) {
		var t = this;
		this.graph.edges.forEach(function(e){
			callback.call(t, e, t.spring(e));
		});
	};

	// callback should accept one argument: Spring
	Layout.ForceDirected.prototype.eachSpring = function(callback) {
		var t = this;
		this.graph.edges.forEach(function(e){
			callback.call(t, t.spring(e));
		});
	};

	// callback should accept one argument: Spring
	Layout.ForceDirected.prototype.eachUniqueSpring = function(callback) {
		var t = this;

		var ids = {};
		this.graph.edges.forEach(function(e){
			if(ids[e.nodes])
				return;
			ids[e.nodes] = true;

			callback.call(t, t.spring(e));
		});
	};

	// Physics stuff
	Layout.ForceDirected.prototype.decayMasses = function() {
		this.eachNode(function(node, point) {
			if(point.active || node.selected)
				return;
			if(point.m !== point.mass){
				var difference = Math.abs(point.mass - point.m);
				if(difference < 1){
					point.m = point.mass;
					point.delta = undefined;
				}
				else{
					if(point.delta === undefined){
						point.delta = Math.max(1, difference / 100);
						if(point.m < point.mass)
							point.delta = -point.delta;
					}
					point.m -= point.delta;
				}
			}
		});
	};

	// Physics stuff
	Layout.ForceDirected.prototype.applyCoulombsLaw = function() {
		var between = {}, id;

		this.eachNode(function(n1, point1){
			this.eachNode(function(n2, point2){
				if (n1.id === n2.id)
					return;

				var d = point1.p.clone().subtract(point2.p),
					distanceSquared = Math.max(0.1, d.lengthSquared()), // avoid massive forces at small distances (and divide by zero)
					direction = d.normalise(),
					repulsion = this.repulsion,
					strong1 = n1.selected || point1.active,
					strong2 = n2.selected || point2.active;

				if(strong1 || strong2)
						repulsion *= Math.max(1, Math.min(Math.max(point1.m, point2.m) / 10, (strong1 && strong2)? 10: 5));

				// apply force to each end point
				point1.applyForce(direction.multiply(repulsion).divide(0.5 * distanceSquared));
				point2.applyForce(direction.multiply(-1));
			});
		});
	};

	Layout.ForceDirected.prototype.applyHookesLaw = function() {
		this.eachUniqueSpring(function(spring){
			var d = spring.point2.p.clone().subtract(spring.point1.p); // the direction of the spring
			var displacement = spring.length - d.length();
			var direction = d.normalise();
			var k = spring.k;

			// apply force to each end point
			spring.point1.applyForce(direction.multiply(-0.5 * k * displacement));
			spring.point2.applyForce(direction.multiply(-1));
		});
	};

	Layout.ForceDirected.prototype.attractToCentre = function() {
		this.eachNode(function(node, point) {
			var direction = point.p.clone().multiply(-1.0),
			repulsion = this.repulsion;
			point.applyForce(direction.multiply(repulsion / 50.0));
		});
	};


	Layout.ForceDirected.prototype.updateVelocity = function(timestep) {
		this.eachNode(function(node, point) {
			point.v.add(point.a.multiply(timestep)).multiply(this.damping);
			point.a = new Vector(0,0);
		});
	};

	Layout.ForceDirected.prototype.updatePosition = function(timestep) {
		this.eachNode(function(node, point) {
			point.p.add(point.v.clone().multiply(timestep));
		});
	};

	// Calculate the total kinetic energy of the system
	Layout.ForceDirected.prototype.totalEnergy = function(timestep) {
		var energy = 0.0;
		this.eachNode(function(node, point) {
			var speedSquared = point.v.lengthSquared();
			energy += 0.5 * point.m * speedSquared;
		});

		return energy;
	};

	//requestAnimFrame function from Paul Irish
	var requestNextFrame = (function(){
	  	return window.requestAnimationFrame || 
		  	window.webkitRequestAnimationFrame || 
		  	window.mozRequestAnimationFrame || 
		  	window.oRequestAnimationFrame || 
		  	window.msRequestAnimationFrame;
	})();
	var cancelNextFrame = (function(){
		return window.cancelAnimationFrame || 
			window.webkitCancelAnimationFrame || 
			window.mozCancelAnimationFrame || 
			window.oCancelAnimationFrame || 
			window.msCancelAnimationFrame;
	})();
	function requestRender(callback){
		if(requestNextFrame === undefined || cancelNextFrame === undefined)
			setTimeout(callback, 16);
		else{
			var start = new Date().getTime();
			var requestId, timeoutId;
			if(document.hasFocus()){
				requestId = requestNextFrame(function(){
					clearTimeout(timeoutId);
					callback.call(null);
				});
			}
			timeoutId = setTimeout(function(){
				cancelNextFrame(requestId);
				callback.call(null);
			}, 16);
		}
	}


	/**
	 * Start simulation if it's not running already.
	 * In case it's running then the call is ignored, and none of the callbacks passed is ever executed.
	 */
	Layout.ForceDirected.prototype.start = function(render, onRenderStop, onRenderStart) {
	 	var t = this;

	 	if (this._started) return;
	 	this._started = true;
	 	this._stop = false;

	 	if (onRenderStart !== undefined) {
	 		onRenderStart(); 
	 	}

	 	var rendering = true, tickDelta = 0.01, milliseconds = 25, totalEnergy = 500;

		//force initial render in case we start out of focus
		setTimeout(function(){
			t.tick(tickDelta);
			if (render !== undefined) {
				render();
			}
		}, 0);

		//do physics ticks on a timer
		setTimeout(function tickLoop(){
			t.tick(tickDelta);
			totalEnergy = t.totalEnergy();
			if (t._stop)
				rendering = false;
			if(rendering)
				setTimeout(tickLoop, milliseconds);
		}, milliseconds);

    //do renders every animation frame
    requestRender(function animationLoop() {
    	if(rendering){
    		requestRender(animationLoop);
    		if (render !== undefined && totalEnergy > t.minEnergyThreshold) {
    			render();
    		}
    	}
    	else if (onRenderStop !== undefined){ 
    		onRenderStop(); 
    	}
    });
  };

  Layout.ForceDirected.prototype.stop = function() {
  	this._stop = true;
  };

  Layout.ForceDirected.prototype.tick = function(timestep) {
  	this.decayMasses();
  	this.applyCoulombsLaw();
  	this.applyHookesLaw();
  	this.attractToCentre();
  	this.updateVelocity(timestep);
  	this.updatePosition(timestep);
  };

	// Find the nearest point to a particular position
	Layout.ForceDirected.prototype.nearest = function(pos) {
		var min = {node: null, point: null, distance: null};
		var t = this;
		this.graph.nodes.forEach(function(n){
			var point = t.point(n);
			var distance = point.p.clone().subtract(pos).length();
			if (min.distance === null || distance < min.distance) {
				min = {node: n, point: point, distance: distance};
			}
		});

		return min;
	};


	// returns [bottomleft, topright]
	Layout.ForceDirected.prototype.getBoundingBox = function() {
		var bottomleft = new Vector(-2,-2);
		var topright = new Vector(2,2);
		var minimum = -50;
		var maximum = 50;

		this.eachNode(function(n, point) {
			// Bound the node
			point.p.bound(minimum, maximum);
			// Resize the BBox if needed
			bottomleft.set(Math.min(bottomleft.x, point.p.x), Math.min(bottomleft.y, point.p.y));
			topright.set(Math.max(topright.x, point.p.x), Math.max(topright.y, point.p.y));
		});
		var padding = topright.clone().subtract(bottomleft).multiply(0.07); // ~5% padding
		return {bottomleft: bottomleft.subtract(padding), topright: topright.add(padding)};
	};

	var mathSqrt = Math.sqrt, 
	mathAbs = Math.abs;

	// Vector
	var Vector = Springy.Vector = function(x, y) {
		this.x = x;
		this.y = y;
	};

	Vector.random = function() {
		return new Vector(5.0 * (Math.random() - 0.5), 5.0 * (Math.random() - 0.5));
	};

	Vector.prototype.clone = function(){
		return new Vector(this.x, this.y);
	};

	Vector.prototype.bound = function(minimum, maximum){
		this.x = Math.max(minimum, Math.min(maximum, this.x));
		this.y = Math.max(minimum, Math.min(maximum, this.y));
		return this;
	};

	Vector.prototype.set = function(x, y){
		this.x = x;
		this.y = y;
		return this;
	};

	Vector.prototype.copy = function(v2){
		this.x = v2.x;
		this.y = v2.y;
		return this;
	};

	Vector.prototype.add = function(v2) {
		this.x += v2.x;
		this.y += v2.y;
		return this;
	};

	Vector.prototype.subtract = function(v2) {
		this.x -= v2.x;
		this.y -= v2.y;
		return this;
	};

	Vector.prototype.multiply = function(n) {
		this.x *= n;
		this.y *= n;
		return this;
	};

	Vector.prototype.divide = function(n) {
		this.x = (this.x / n) || 0;
		this.y = (this.y / n) || 0;
		return this;
	};

	Vector.prototype.dot = function(v2) {
		return this.x * v2.x + this.y * v2.y;
	};

	Vector.prototype.lengthSquared = function() {
		return this.x*this.x + this.y*this.y;
	};

	Vector.prototype.length = function() {
		return mathSqrt(this.x*this.x + this.y*this.y);
	};

	Vector.prototype.normal = function() {
		var tmp = this.x;
		this.x = -this.y;
		this.y = tmp;
		return this;
	};

	Vector.prototype.normalise = function() {
		this.divide(this.length());
		return this;
	};

	var omega = 0.0000001;
	Vector.prototype.equals = function(v2) {
		return mathAbs(this.x - v2.x) < omega && mathAbs(this.y - v2.y) < omega;
	};

	// Point
	Layout.ForceDirected.Point = function(position, mass) {
		this.p = position; // position
		this.mass = this.m = mass; // mass
		this.v = new Vector(0, 0); // velocity
		this.a = new Vector(0, 0); // acceleration
	};

	Layout.ForceDirected.Point.prototype.applyForce = function(force) {
		this.a.x += force.x / this.m;
		this.a.y += force.y / this.m;
	};

	// Spring
	Layout.ForceDirected.Spring = function(point1, point2, length, k) {
		this.point1 = point1;
		this.point2 = point2;
		this.length = length; // spring length at rest
		this.k = k; // spring constant (See Hooke's law) .. how stiff the spring is
	};

	// Layout.ForceDirected.Spring.prototype.distanceToPoint = function(point)
	// {
	// 	// hardcore vector arithmetic.. ohh yeah!
	// 	// .. see http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/865080#865080
	// 	var n = this.point2.p.subtract(this.point1.p).normalise().normal();
	// 	var ac = point.p.subtract(this.point1.p);
	// 	return Math.abs(ac.x * n.x + ac.y * n.y);
	// };

	/**
	 * Renderer handles the layout rendering loop
	 * @param onRenderStop optional callback function that gets executed whenever rendering stops.
	 * @param onRenderStart optional callback function that gets executed whenever rendering starts.
	 */
	var Renderer = Springy.Renderer = function(layout, clear, processNode, drawEdge, drawNode, drawNodeOverlay, drawOverlay, onRenderStop, onRenderStart) {
	 	this.layout = layout;
	 	this.clear = clear;
	 	this.processNode = processNode;
	 	this.drawEdge = drawEdge;
	 	this.drawNode = drawNode;
	 	this.drawNodeOverlay = drawNodeOverlay;
	 	this.drawOverlay = drawOverlay;
	 	this.onRenderStop = onRenderStop;
	 	this.onRenderStart = onRenderStart;
	 	this.layout.graph.addGraphListener(this);
	};

	Renderer.prototype.graphChanged = function(e) {
		this.start();
	};

	/**
	 * Starts the simulation of the layout in use.
	 *
	 * Note that in case the algorithm is still or already running then the layout that's in use
	 * might silently ignore the call, and your optional <code>done</code> callback is never executed.
	 * At least the built-in ForceDirected layout behaves in this way.
	 *
	 * @param done An optional callback function that gets executed when the springy algorithm stops,
	 * either because it ended or because stop() was called.
	 */
	Renderer.prototype.start = function(done) {
	 	var t = this;
	 	this.layout.start(function render() {
	 		var i;

	 		t.clear();
			//build arrays of functions to process
			var opsBefore = [], opsAfter = [];
			t.layout.eachNode(function(node, point) {
				t.processNode(node, point.p);
				opsBefore.push({ 
					args:[node, point.p], 
					func:t.drawNode, 
					zindex:point.p.y
				});
				opsAfter.push({ 
					args:[node, point.p], 
					func:t.drawNodeOverlay, 
					zindex:point.p.y
				});
			});
			t.layout.eachEdge(function(edge, spring) {
				opsBefore.push({ 
					args:[edge, spring.point1.p, spring.point2.p], 
					func:t.drawEdge, 
					zindex:(spring.point1.p.y + spring.point2.p.y + Math.max(spring.point1.p.y, spring.point2.p.y)) / 3
				});
			});
			//sort by z-index
			opsBefore.sort(function(a, b){
				return a.zindex - b.zindex;
			});
			opsAfter.sort(function(a, b){
				return a.zindex - b.zindex;
			});
			//process the rendering functions
			for(i=0; i<opsBefore.length; i++)
				opsBefore[i].func.apply(t, opsBefore[i].args);
			for(i=0; i<opsAfter.length; i++)
				opsAfter[i].func.apply(t, opsAfter[i].args);
			t.drawOverlay();
		}, this.onRenderStop, this.onRenderStart);
};

Renderer.prototype.stop = function() {
	this.layout.stop();
};

	// Array.forEach implementation for IE support..
	//https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach
	if ( !Array.prototype.forEach ) {
		Array.prototype.forEach = function( callback, thisArg ) {
			var T, k;
			if ( this === null ) {
				throw new TypeError( " this is null or not defined" );
			}
			var O = Object(this);
			var len = O.length >>> 0; // Hack to convert O.length to a UInt32
			if ( {}.toString.call(callback) != "[object Function]" ) {
				throw new TypeError( callback + " is not a function" );
			}
			if ( thisArg ) {
				T = thisArg;
			}
			k = 0;
			while( k < len ) {
				var kValue;
				if ( k in O ) {
					kValue = O[ k ];
					callback.call( T, kValue, k, O );
				}
				k++;
			}
		};
	}

	var isEmpty = function(obj) {
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) {
				return false;
			}
		}
		return true;
	};

	return Springy;
}));
