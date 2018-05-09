/**
 * Authored by George Fuller 	- 	george@pikcells.com
 * Owned by PIKCELLS LTD		- 	http://www.pikcells.com/
 *
 * Documentation				-	n/a
 * Notes						-	This is the merged version of 1.0.0p and 1.0.0 branches of the engine
 *								-   for organisation purposes a new repository was set up for this.
 *
 * Based on Three.js			- 	http://threejs.org/
 */

// Dependencies :
// pikThree.js



var PIKENG =  function ( parameters ){

	parameters = parameters || {};
	if (parameters.listen !== false)
		parameters.listen = true;

	this.VERSION = 2.2;

	var _engine                        = this;
	_Canvas                            = null;
	_AspectRatio                       = null;
	_CameraLocation                    = null;
	_needsFrameRender                  = 0;
	_ListenForTap                      = false;
	_Input1Down                        = false;
	_Input2Down                        = false;
	_InputPosition                     = new THREE.Vector2(0,0);
	_VROn                              = false;
	_moving                            = false;
	_zooming                           = false;
	_debug                             = false;
	_TouchRadius                       = null;
	_TouchScale                        = null;
	_stopContinuousRendering           = false;

	var _InputTime                     = 0;

	// Motions Controls for camera
	this.RadialCam                     = new PIKENG.RadialCamera();
	this.ZoomEnabled                   = true;
	this.PanEnabled                    = true;
	this.PivotEnabled                  = true;
	this.PivotSpeed                    = 20;
	this.PanSpeed                      = 5;
	this.PivotVelocity                 = { dx:0, dy:0 };
	this.PanVelocity                   = { dx:0, dy:0 };
	this.PivotDeceleration             = 5;
	this.PanDeceleration               = 10;
	this.DeviceOrientationEnabled      = false;
	this.DeviceMotionEnabled           = false;
	this.CameraNormalised              = null;

	// Feature tests
	this.DeviceHasGyros                = false;

	// Radial location variables for orbital camera
	this.RadiusMax                     = 10000;
	this.RadiusMin                     = 0.2;
	this.rotLimits                     = { xMax:null, xMin:null, yMax:null, yMin:null, zMax:null, zMin:null };
	this.FovMax                        = 60;
	this.FovMin                        = 20;

	// Display variables
	this.Scene                         = new THREE.Scene();
	this.Renderer                      = null;

	this.Raycaster                     = null;
	this.Composer                      = null;

	// Animation vars
	this.Animations                    = [];
	this.CameraAnimation               = null;
	this.FrameTime                     = 0;

	// Loading vars
	this.CtmLoader                     = null;
	this.PopsLoader                    = null;
	this.TextureLoader                 = new THREE.TextureLoader( );
	this.GeometryCallback              = null;

	// Assistents
	this.LogVerbosity                  = 0;
	this.WebGLCapable                  = false;
	this.totalVerts                    = 0;

	// Lighting
	this.AmbientLight                  = new THREE.AmbientLight( 0x666666 );
	this.Lights                        = new THREE.Group();

	// Callbacks
	this.RenderCallback                = null;
	this.NoWebGlCallback               = null;
	this.Input1DownCallBack            = null;
	this.InputUpCallBack               = null;
	this.ClickCallback                 = null;
	this.DeviceMotionCallback          = null;

	this.CaptureCanvas                 = false;

	this.RenderWhen                    = function () { return false; };
	this.DontRenderWhen                = function () { return false; };
	this.ShouldRender	                 = function () {

		if ( this.RenderWhen() )
			return true;

		if ( this.DontRenderWhen() )
			return false;

		if (
		this.PanVelocity.dy != 0 ||
		this.PanVelocity.dx != 0 ||
		this.PivotVelocity.dx != 0 ||
		this.PivotVelocity.dy != 0 ||
		PIKENG.frameQueue > 0 ||
		this.CameraAnimation ||
		this.Animations.length > 0 ||
		this.VROn ||
		this.DeviceMotionEnabled ){

			if (PIKENG.frameQueue > 0)
				PIKENG.frameQueue--;
			return true;

		}else{

			return false;

		}

  };


	// VR variables
	this.Effect = null;
	this.Controls = null;
	this.IsFullScreen = false;
	this.Target = false;

	// Properties
	// Getters and setters are done here.

	Object.defineProperty( this, 'VROn', {

		get: function(){

			return _VROn;

		},
		set: function(val){

			_VROn = val;
			this.dispatchEvent( { type: 'vrModeChange', data: val, message:'Toggling VR Mode.' } );

			if ( val === true ){

				// Turn VR Mode on.
				var fullScreenAvailable = false;
				var element = _Canvas;

				// Let the engine know it should render for VR, create the stereo effect
				this.Effect = new THREE.StereoEffect( this.Renderer );
				this.Effect.setSize( _Canvas.innerWidth, _Canvas.innerHeight );
				this.Controls = new THREE.DeviceOrientationControls( this.RadialCam.camera );

				this.RadialCam.camera.aspect = window.innerWidth / window.innerHeight;
				this.RadialCam.camera.updateProjectionMatrix();

				if (element.webkitRequestFullScreen){

					element.webkitRequestFullScreen(); //Chrome
					fullScreenAvailable = true;

				}else if (element.mozRequestFullScreen){

					element.mozRequestFullScreen(); // Firefox
					fullScreenAvailable = true;

				}else if (element.requestFullscreen){

					element.requestFullscreen();
					fullScreenAvailable = true;

				}

				return fullScreenAvailable;


			}else {

				// Turn VR Off.
				this.Effect = null;
				this.Controls = null;
				this.CanvasResized();

			}

		}

	});

	Object.defineProperty( this, 'Canvas', {

		get : function(){

			return _Canvas;

		},
		set : function(val){

			_Canvas = val;

			// Check for browser webGL support
			try {

			  var canvas = document.createElement('canvas');
			  var ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			  var exts = ctx.getSupportedExtensions();

			} catch (e) {

			  	console.log("WebGL not supported or is diabled.");
				_WebGLCapable = false;
				// Deprecating this callback
				DisplayWebGlError(this.NoWebGlCallback);
				this.dispatchEvent( { type: 'NoWebGL', message: 'WebGL not supported or is disabled.', data: null } );
				return;

			}


			if (_Canvas){

				ctx = _Canvas.getContext('webgl', {preserveDrawingBuffer: true} ) || _Canvas.getContext('experimental-webgl', {preserveDrawingBuffer: true});
				exts = ctx.getSupportedExtensions();

			}else
				console.info("Canvas object can't be null");

			// Try to catch an error creating the webgl context that occurs occasionally.
			try {

				this.Renderer = new THREE.WebGLRenderer({ antialias: true, canvas: _Canvas, alpha:true, preserveDrawingBuffer: true  });

			}catch (e){

				console.log(e);
				window.alert("There was an error generating webgl context, you might need to restart your browser or computer");
				return;

			}

			this.SetDefaults();

			if (parameters.listen)

				this.AddInputListeners();

				// Change camera aspect ratio when ever the view is changed. Unless a custom aspect ratio is defined.
				if (!_AspectRatio) {

					this.RadialCam.camera.aspect = _Canvas.width / _Canvas.height;
					this.RadialCam.camera.updateProjectionMatrix();

				};

				// Default Lighting
				this.Renderer.toneMapping = 3;
				this.Renderer.toneMappingExposure = 1.5;
				this.Renderer.toneMappingWhitePoint = 2.5;

				var directionalLight, directionalLight2;

				directionalLight = new THREE.DirectionalLight( 0xffffff );
				directionalLight.position.set( -10, -25, 200 );
				directionalLight.intensity = 0.3;

				this.Lights.add(directionalLight);
				this.Scene.add(this.AmbientLight);
				this.Scene.add(this.Lights);
				this.CanvasResized();

			}
	});

	Object.defineProperty(this, 'AspectRatio', {
		get :  function() {

			return _AspectRatio;

		},
		set :  function(val) {

			_AspectRatio = val;
			// Update cameras apect ratio
			_AspectRatio = this.Camera.aspect = val;

		}
	});

	Object.defineProperty(this, 'Listening', {
		get :  function() {

			return _Listening;

		},
		set :  function(val) {

			_Listening = val;

			if ( _Listening != val ){

				if (val)
			 		this.AddInputListeners();
		  		else
					this.RemoveInputListeners();

			}

	 	}
  	});

	/*
	Create an animaton object. The animation is seperate the what is to be aniamted on at this point.
	parameter, the value of an object to animate, e.g. position.x
	startVal, the value of the parameter to start the aniamton on.
	endVal, the value of the parameter to end the animation on.
	duration, how long the animation should take in seconds.
	type, the type of Animation, the default and only one supported at the moment is sinusoidal.

	startTime, endTime, used for calcualting the animation frame, will be cumputed on execution or can be set manually.
	target, the object the animation is targeting.
	*/

	this.CanvasResized = function ( width, height ){

		this.Renderer.setPixelRatio(1);
		var canvasWidth;
		var canvasHeight;

		if (width)
			canvasWidth = width;
		else
			canvasWidth = parseInt(window.getComputedStyle(this.Canvas, null).getPropertyValue("width"), 10);

		if( height)
			canvasHeight = height;
		else
			canvasHeight = parseInt(window.getComputedStyle(this.Canvas, null).getPropertyValue("height"), 10);

		this.RadialCam.camera.aspect = canvasWidth / canvasHeight;
		this.Renderer.setSize( canvasWidth, canvasHeight, false );
		this.RadialCam.camera.updateProjectionMatrix();
		PIKENG.frameQueue = 1;

	}

	DisplayWebGlError = function( callback ){

		if (callback){

			callback();

		}else{

			window.alert("Sorry it appears that your browser isn't capable of running WebGL (check your browser settings to see if it's enabled).<br> You will need to download a different browser or update your current one.");

	 }

	}

	this.GetLightMap = function ( filePath, onLoad, onProgress, onError ){

		if (filePath == null) {

			console.log("Cannot load null file path.")
			return;

		}

    PIKENG.LoadingManager.load();
		this.TextureLoader.load(filePath,
		function(texture){

			texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
      PIKENG.LoadingManager.succeeded();
			if( onLoad )
				onLoad(texture);

		},
		function( xhr ){

      if(onProgress)
        onProgress();

		},
		function( xhr ){

      PIKENG.LoadingManager.failed();
      if(onError)
        onError();

		});
	}

	this.LoadTexture = function ( filePath, onLoad, onProgress, onError ){

		if (filePath == null) {

			console.log("Cannot load null file path.")
			return;

		}

		PIKENG.LoadingManager.load();
		this.TextureLoader.load(filePath,
		function(texture){

			texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
			PIKENG.LoadingManager.succeeded();

			if( onLoad )
				onLoad( texture );

		},
		function( xhr ){

			if( onProgress )
				onProgress( xhr );

		},
		function( xhr ){

			PIKENG.LoadingManager.failed();
			if( onError )
				onError( xhr );

		});
	}

	this.CreatePhongMaterial = function ( diffuse, normal, aoMap, bumpMap ) {

		var mat = new THREE.MeshPhongMaterial( { color: 0xffffff, shininess: 20 } );
		if (diffuse != null){

			PIKENG.LoadingManager.load();
			this.TextureLoader.load(diffuse,
			function(texture){

				texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
				mat.map = texture;
				mat.needsUpdate = true;
				texture.dispose();
				PIKENG.LoadingManager.succeeded();

			},
			null,
			function( xhr ){

				PIKENG.LoadingManager.failed();

			});

		}
		if (normal != null){

			PIKENG.LoadingManager.load();
			this.TextureLoader.load(normal, function(texture){

				texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
				mat.normalMap = texture;
				mat.normalScale = new THREE.Vector2( 1, 1 );
				mat.needsUpdate = true;
				texture.dispose();

			});
		}
		if (aoMap != null){

			PIKENG.LoadingManager.load();
			this.TextureLoader.load(aoMap, function(texture){

				texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
				mat.aoMap = texture;
				mat.needsUpdate = true;
				texture.dispose();
				PIKENG.LoadingManager.succeeded();

			},
			null,
			function( xhr ){

				PIKENG.LoadingManager.failed();

			});

		}
		if (bumpMap != null){

			PIKENG.LoadingManager.load();
			this.TextureLoader.load(bumpMap,
			function(texture){

				texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
				mat.bumpMap = texture;
				mat.needsUpdate = true;
				texture.dispose();
				PIKENG.LoadingManager.succeeded();

			},
			null,
			function( xhr ){

				PIKENG.LoadingManager.failed();

			});
		}
		return mat;
	}

	this.HFOV = function ( ) {

		return this.RadialCam.camera.fov*this.RadialCam.camera.aspect;

	}

	this.LoadMaterialFromJSON = function ( json, onLoad, onProgress, onError ) {

		PIKENG.getJSON(json, function(err, data) {

			var material;

			if (err !== null){

				if (onError)
					onError(err);
				else
					console.log(err);

				return;

			}

			if (data.type == 'physical'){

				material = new THREE.MeshPhysicalMaterial();

			}else if ( data.type == 'phong' ){

				material = new THREE.MeshPhongMaterial();

			}else if ( data.type == 'toon' ){

				material = new THREE.MeshToonMaterial();

			}

			material.side = data.side;
			material.lightMapOverrideIntensity = material.lightMapIntensity = data.lightMapOverrideIntensity;

			folders = json.split("/");
			folders.pop(); // Remove the json file name leaving jsut the parent directory.
			parentPath = new String();

			for (i=0; i<folders.length; i++){

				parentPath = parentPath + folders[i] + "/"; // Recostruct the path

			}

			var mapLoadingManager = new PIKENG.loadingManager( this.pikeng );

			if (data.alphaMap != false ){
				mapLoadingManager.load();
				material.setAlphaMap(parentPath + data.alphaMap, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed);
			}

			if (data.normalMap != false ){
				mapLoadingManager.load();
				material.setNormalMap(parentPath + data.normalMap, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed.bind(mapLoadingManager));
			}

			if (data.metalnessMap != false ){
				mapLoadingManager.load();
				material.setMetalnessMap(parentPath + data.metalnessMap, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed.bind(mapLoadingManager));
			}

			if (data.roughnessMap != false ){
				mapLoadingManager.load();
				material.setRoughnessMap(parentPath + data.roughnessMap, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed.bind(mapLoadingManager));
			}

			if (data.lightMapOverride != false ){
				mapLoadingManager.load();
				material.setLightMap(parentPath + data.lightMapOverride, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed.bind(mapLoadingManager));
			}

			if (data.diffuse != false ){
				mapLoadingManager.load();
				material.setDiffuse(parentPath + data.diffuse, mapLoadingManager.succeeded.bind(mapLoadingManager), null, mapLoadingManager.failed.bind(mapLoadingManager));
			}

			if (data.metalness != null && data.metalness != undefined)
				material.metalness = data.metalness;

			if (data.roughness != null && data.roughness != undefined)
				material.roughness = data.roughness;

			if (data.reflectivity != null && data.reflectivity != undefined)
				material.reflectivity = data.reflectivity;

			if (data.shininess  != null && data.shininess != undefined)
				material.shininess = data.shininess;

			if (mapLoadingManager.loading > 0){

				mapLoadingManager.callback = function(){
					if(onLoad)
						onLoad(material);
				}

			}else if(onLoad)
				onLoad(material);


		});

	}

	this.LoadModelsFromJSON = function ( json, name, group, onLoad, onProgress, onError ) {

		PIKENG.getJSON(json, function(err, data) {

			var i=0, parentPath, folders, modelPath, loadManager, geometry, object, mesh, parent;
			if (err !== null){

				if (onError)
					onError(err);
				else
					console.log(err);

				return;

			}

			object = new THREE.Object3D();
			object.name = name;
			parent = this.GetObjectNamed(group);
			if ( parent === undefined ){

				parent = new THREE.Object3D();
				parent.name = group;
				this.Scene.add(parent);

			}
			parent.add(object);

			loadManager = new PIKENG.loadingManager();
			loadManager.loadingCompleted = onLoad;
			loadManager.data = object;

			/*
				Check that the json is valid.
			*/

			if(data.geometries === undefined)
				console.warn("Json doesn't contain any geometries.");

			/*
				Get the json files parent direcrory path
			*/

			folders = json.split("/");
			folders.pop(); // Remove the json file name leaving jsut the parent directory.
			parentPath = new String();

			for (i=0; i<folders.length; i++){

				parentPath = parentPath + folders[i] + "/"; // Recostruct the path

			}

			/*
				Use the json folders parent directory as the root directory for all the
				File paths contained in the json.
			*/
			// console.log(data);
			// console.log(parentPath);

			for(i=0; i<data.geometries.length; i++){

				geometry = data.geometries[i]
				modelPath = parentPath + geometry.path;
				loadManager.load();
				mesh = this.LoadGeometry(
					modelPath,
					geometry.path,
					object,
					function(e){
						// Should do progress before firing success
						if(onProgress){

							e.progress = 100 * (loadManager.successes + loadManager.fails + 1) /
								(loadManager.successes + loadManager.fails + loadManager.loading);
							onProgress(e);

						}
						loadManager.succeeded();

					},
					null,
					function(e){
						// Should do progress before firing failed
						if(onProgress){

							e.progress = 100 * (loadManager.successes + loadManager.fails + 1) /
								(loadManager.successes + loadManager.fails + loadManager.loading);
							onProgress(e);

						}
						loadManager.failed();
					});

				mesh.materialId = geometry.id;

				if (geometry.lightmap && geometry.lightmap.path){

					loadManager.load();
					this.LoadTexture( parentPath + geometry.lightmap.path, function(texture){

						if (this.material)
							this.material.lightMap = texture;
						this.lightMap = texture;
						loadManager.succeeded();

					}.bind(mesh),
					null,
					loadManager.failed);
					mesh.lightMapIntensity = parseFloat(geometry.lightmap.intensity);
				}

			}

		}.bind(this));

	}


	/*

	*/
	this.LoadLightingFromJson = function ( json, onLoad, onProgress, onError, duration ) {

		PIKENG.getJSON(json, function(err, lighting) {

			var i, len;

			this.Renderer.toneMapping = lighting.toneMapping;

			if (duration){

				var rgb = lighting.ambientLight.color.match(/[A-Za-z0-9]{2}/g).map(function(v) { return (parseInt(v, 16)/255); });
				var intensityAnim = this.makeAnimation('intensity', this.AmbientLight.intensity, parseFloat(lighting.ambientLight.intensity), duration);
				var redAnim = this.makeAnimation('r', this.AmbientLight.color.r, rgb[0], duration);
				var greenAnim = this.makeAnimation('g', this.AmbientLight.color.g, rgb[1], duration);
				var blueAnim = this.makeAnimation('b', this.AmbientLight.color.b, rgb[2], duration);
				var exposureAnim = this.makeAnimation('toneMappingExposure', this.Renderer.toneMappingExposure, parseFloat(lighting.toneMappingExposure), duration);
				var whitePointAnim = this.makeAnimation('toneMappingWhitePoint', this.Renderer.toneMappingWhitePoint, parseFloat(lighting.toneMappingWhitePoint), duration);
				intensityAnim.Execute(this.AmbientLight);
				redAnim.Execute(this.AmbientLight.color);
				greenAnim.Execute(this.AmbientLight.color);
				blueAnim.Execute(this.AmbientLight.color);
				exposureAnim.Execute(this.Renderer);
				whitePointAnim.Execute(this.Renderer);

			}else{

				this.AmbientLight.intensity =  parseFloat(lighting.ambientLight.intensity);
				this.AmbientLight.color.setHex("0x" + lighting.ambientLight.color);
				this.Renderer.toneMappingExposure = parseFloat(lighting.toneMappingExposure);
				this.Renderer.toneMappingWhitePoint = parseFloat(lighting.toneMappingWhitePoint);

			}

			// Remove all lights from the scene.

			for (i=0, len=this.Lights.children.length; i<len; i++ ){

				var light = this.Lights.children[i];

				if (duration){

					var fadeAnim = this.makeAnimation('intensity', parseFloat(light.intensity), 0, duration);
					fadeAnim.light = light; // Store in the animation object for the callback
					fadeAnim.Execute(light, function(){

						this.light.parent.remove(light);

					});

				}else{

					light.parent.remove(light);

				}

			}

			// Add lights from lighting file

			for (i=0, len=lighting.lights.length; i<len; i++){

				if (lighting.lights[0].type=="DirectionalLight")
					var lightNew = new THREE.DirectionalLight();
				else
					throw ("Only supporting directional lights at the moment, need to write the rest!");

				lightNew.color.setHex("0x" + lighting.lights[i].color);
				lightNew.position.set(lighting.lights[i].position.x,lighting.lights[i].position.y, lighting.lights[i].position.z);
				this.Lights.add(lightNew);

				if (duration){

					lightNew.intensity = 0;
					var fadeAnim = this.makeAnimation('intensity', 0,  parseFloat(lighting.lights[i].intensity), duration);
					fadeAnim.Execute(lightNew);

				}else{

					lightNew.intensity = parseFloat(lighting.lights[i].intensity);

				}

			}

			PIKENG.frameQueue ++;

		}.bind(this));

	}

	this.Animation = function( parameter, startVal, endVal, duration, type ) {

		console.warn('Deprecated, use ENGINE.makeAniamtion instead of new ENGINE.Animation .');
		return new PIKENG.Animation( _engine, parameter, startVal, endVal, duration, type );

	}

	this.makeAnimation = function ( parameter, startVal, endVal, duration, type ) {

		return new PIKENG.Animation( this, parameter, startVal, endVal, duration, type );

	}

	this.LoadGeometry = function ( file, name, group, onLoad, onProgress, onError ) {

		// if (this.GetObjectNamed(name)){
		// 	throw "Naming error, object names in this.Scene must be unique: \"" + name + "\" is already taken";
		// };
		var mesh = new THREE.Mesh();
		mesh.material = new THREE.MeshBasicMaterial( { color: 0x333333, wireframe: true } ) ;
		mesh.name = name;
		var groupObject;

		if (typeof(group) === "string")
			groupObject = this.GetObjectNamed(group);
		else if (group)
			groupObject = group;

		if (!groupObject && group) {

			groupObject = new THREE.Group();
			groupObject.name = group;
			this.Scene.add(groupObject);

	 	};

		var extention = file.split('.').pop();
		if ( extention == "PIKCTM" )
			this._loadPIKCTM(file, mesh, groupObject, onLoad, onProgress, onError);
		else if( extention == "bin" )
			this._loadBin(file, mesh, groupObject, onLoad, onProgress, onError);
		else if ( extention == "pops" )
			this._loadPops(file, mesh, groupObject, onLoad, onProgress, onError);

		return mesh;

	}

	this._loadPIKCTM = function ( file, mesh, groupObject, onLoad, onProgress, onError ){

		// Should use alternative loader? Alt loading will assume that the file is a bin file with the corresponding encoding as the loader.
		// There's not much error checking for alt so if it's not the correct bin file there's going to be obscure errors.
		var alt = false;

		parameters = { "useWorker" : false, "splitByMatId": false, "alt":alt };

		if (!this.CtmLoader)
			this.CtmLoader = new THREE.CTMLoader();
		this.CtmLoader.load(file, function ( geometry, vertCount ){

			// temp solution for multi geometry.
			// this should loop through eventually.
			mesh.geometry = geometry[0];
			PIKENG.LoadingManager.load();
			this._AddModel( mesh, groupObject );

			if (_debug)
			  this._logVerts(vertCount, mesh);
			if ( onLoad )
			  onLoad([mesh]);

			// Render a frame.
			if (PIKENG.frameQueue <= 0)
				PIKENG.frameQueue = 1;


		}.bind(this),
		parameters,
		function( xhr, url ){
			if(onProgress)
				onProgress(xhr);
		},
		function( xhr, url ){
			if(onError)
				onError(xhr);
		});

	}

	this._loadBin = function ( file, mesh, groupObject, onLoad ){

		// Should use alternative loader? Alt loading will assume that the file is a bin file with the corresponding encoding as the loader.
		// There's not much error checking for alt so if it's not the correct bin file there's going to be obscure errors.
		var alt = true;

		parameters = { "useWorker" : false, "splitByMatId": false, "alt":alt };

		if (!this.CtmLoader)
			this.CtmLoader = new THREE.CTMLoader();
		this.CtmLoader.load(file,
			function ( geometry, vertCount ){

			// temp solution for multi geometry.
			// this should loop through eventually.
			mesh.geometry = geometry[0];
			this._AddModel( mesh, groupObject );

			if (_debug)
				this._logVerts(vertCount, mesh);

			if ( onLoad )
				onLoad([mesh]);

			// Render a frame.
			if (PIKENG.frameQueue <= 0)
				PIKENG.frameQueue = 1;

		}.bind(this),
		parameters);

	}

	this._loadPops = function ( file, mesh, groupObject, onLoad ) {

		if (!this.PopsLoader)
			this.PopsLoader = new THREE.POPSLoader();
		this.PopsLoader.load(file, function ( meshes ){

			// temp solution for multi geometry.
			// _engine should loop through eventually.
			var len = meshes.length;
			for ( var i=0; i<len; i++ ){
				this._AddModel( meshes[i], groupObject );
			}

			if (_debug){
				console.warn("this needs implementing");
				//var vertCount = _engine.TraverseObjectForVerts()
				//_engine._logVerts(vertCount, mesh);
			}

			if ( onLoad )
				onLoad(meshes);

			// Render a frame.
			if (PIKENG.frameQueue <= 0)
				PIKENG.frameQueue = 1;
		}.bind(_engine),
		parameters);

	}

	this._logVerts = function (vertCount, mesh){

		// var color;

		if ( vertCount > 30000 )
			color = "background:red";
		else if ( vertCount > 20000 )
			color = "background:orange";
		else if ( vertCount > 8000 )
			color = "background:yellow";
		else
			color = "background:green";

		var type = "";

		if (name === "model0.bin")
			type = "Main";
		else if ( name === "model1.bin" )
			type = "Contrast 1";
		else if ( name === "model2.bin" )
			type = "Main Stitching";
		else if ( name === "model3.bin" )
			type = "Button Holes";
		else if ( name === "model4.bin" )
			type = "Buttons";
		else if ( name === "model5.bin" )
			type = "Button Stitching";
		else if ( name === "model6.bin" )
			type = "Contrast 2";
		else if ( name === "model10.bin" )
			type = "Shadow";

		if (_debug)
			console.log("%c Geometry ", color, mesh + '(' + type + ')' + " has " + vertCount + " vertices");
		if (_debug)
			console.log('Total Vertice Count : ' + this.totalVerts);

	}

	this._AddModel = function ( object, group ) {

		if (group) {
			group.add(object);
		}else{
			this.Scene.add(object);
		};

		// Add a frame to the que so the user can see the addition of a model.
		if (PIKENG.frameQueue <= 0)
				PIKENG.frameQueue = 1;

	}

	this.RemoveModelNamed = function ( modelName ){

		var object = this.Scene.getObjectByName( modelName );
		if (object) {

			this.Scene.remove(object);
			//object.geometry.dispose();
			object = undefined;

		}

	}

	this.GetObjectNamed = function ( name, parent ){

		if (parent)
			return parent.getObjectByName( name );
		return this.Scene.getObjectByName( name );

	}

	this.TravsereSceneForObjectsNamed = function ( name ){
		var objects = [];
		this.Scene.traverse (function (object){
			if ( object.name == name )
			 objects.push(object)
		});
		return objects;
	}

	this.GetAllObjectsScene  = function (){
		var objects = [];
		this.Scene.traverse (function (object){
			 objects.push(object)
		});
		return objects;
	}

	// Render

	this.Render = function ( once ) {

		if (once !== true)
			requestAnimationFrame( this.Render.bind(this) );

		// Do we want to cancel the continuous render?
		if (_stopContinuousRendering){

			_stopContinuousRendering = false;
			return;

		}

		// callback defined in the initialiser of the engine.
		if ( this.ShouldRender() == false )
			return;

		// Update Animation Frames.
		for (var i=0; i<this.Animations.length; i++){

			var time = Date.now();
			var anim = this.Animations[i];
			anim.setFrame( time );

		}

		if (this.CameraAnimation) {

			if ( this.CameraAnimation.endTime < Date.now() ){

				if (this.CameraAnimation.callback){

					var callback = this.CameraAnimation.callback;
					this.CameraAnimation = null;
					callback();

				}else
				 	this.CameraAnimation = null;

			}

		};

		var currentFrameTime = Date.now() / 1000;
		if (this.FrameTime != 0) {

			var frameDelta = currentFrameTime - this.FrameTime;
			this._ApplyVelocities ( frameDelta );
			this._ApplyDecelerations( frameDelta );

		};
		this.FrameTime = currentFrameTime;

		// render the frame
		if ( this.VROn ){

			this.Controls.update();
			this.Effect.render( this.Scene, this.RadialCam.camera );

		}else if ( this.Composer ) {

			this.Composer.render();

		}else {

			this.Renderer.render( this.Scene, this.RadialCam.camera );

		}

		if ( this.RenderCallback ){

			this.RenderCallback();

		}

		if (this.CaptureCanvas){
			var base64 = _Canvas.toDataURL();
			this.dispatchEvent( { type: 'CapturedCanvas', message: 'Canvas Captured.', data: base64 } );
			this.CaptureCanvas = false;
		}

	}

	this._ApplyVelocities = function (){

		if( this.PivotVelocity.dx != 0 || this.PivotVelocity.dy != 0 || this.PanVelocity.dx != 0 || this.PanVelocity.dy != 0 ){

			var xrot = 2*(this.RadialCam.camera.fov/60)*this.PivotVelocity.dx*this.PivotSpeed;
			var yrot = 2*(this.RadialCam.camera.fov/60)*this.PivotVelocity.dy*this.PivotSpeed;

			// Apply x rot
			var vector = new THREE.Vector3(this.RadialCam.pivotObject.position.x, this.RadialCam.pivotObject.position.y, this.RadialCam.pivotObject.position.z +1);
			this.RadialCam.pivotObject.worldToLocal(vector);

			if (this.RadialCam.radius > 0) // Orbital rotation
				this.RadialCam.pivotObject.rotation.y -= xrot;
			else // Central rotation, should be oposite to orbital to be intuative.
				this.RadialCam.pivotObject.rotation.y += xrot/2;

			// Apply y rot
			var zrot = this.RadialCam.pivotObject.rotation.z;
			var sign = 1; // -Pi/2 -> Pi/2
			if (this.RadialCam.radius <= 0) // Central rotation, should be oposite to orbital to be intuative.
				yrot = -yrot/2;
			if (this.RadialCam.pivotObject.rotation.x < 0)
					sign = -1; // Pi -> Pi/2 or -Pi -> -Pi/2
			if ( sign == 1 && zrot - yrot > Math.PI/2 )
				this.RadialCam.pivotObject.rotation.z = Math.PI/2;
			else if ( sign == 1 && zrot - yrot < -Math.PI/2 )
				this.RadialCam.pivotObject.rotation.z = -Math.PI/2;
			else if(sign == -1 && zrot - yrot < Math.PI/2 && zrot - yrot > 0 )
				this.RadialCam.pivotObject.rotation.z = Math.PI/2;
			else if(sign == -1 && zrot - yrot > -Math.PI/2 && zrot - yrot < 0 )
				this.RadialCam.pivotObject.rotation.z = -Math.PI/2;
			else
				this.RadialCam.pivotObject.rotation.z -= yrot;

			// Check for rotation limitations.

			if ( this.rotLimits.zMax !== null && this.RadialCam.pivotObject.rotation.z > this.rotLimits.zMax )
				this.RadialCam.pivotObject.rotation.z = this.rotLimits.zMax;
			else if ( this.rotLimits.zMin !== null && this.RadialCam.pivotObject.rotation.z < this.rotLimits.zMin )
				this.RadialCam.pivotObject.rotation.z = this.rotLimits.zMin;
			if ( this.rotLimits.yMax !== null && this.RadialCam.pivotObject.rotation.y > this.rotLimits.yMax )
				this.RadialCam.pivotObject.rotation.y = this.rotLimits.yMax;
			else if ( this.rotLimits.yMin !== null && this.RadialCam.pivotObject.rotation.y < this.rotLimits.yMin )
				this.RadialCam.pivotObject.rotation.y = this.rotLimits.yMin;
			if ( this.rotLimits.xMax !== null && this.RadialCam.pivotObject.rotation.x > this.rotLimits.xMax )
				this.RadialCam.pivotObject.rotation.x = this.rotLimits.xMax;
			else if ( this.rotLimits.xMin !== null && this.RadialCam.pivotObject.rotation.x < this.rotLimits.xMin )
				this.RadialCam.pivotObject.rotation.x = this.rotLimits.xMin;

			this.RadialCam.updateTarget();

			// Apply pan velocities
			var radius = this.RadialCam.radius
			var up = new THREE.Vector3(
				this.RadialCam.pivotObject.up.x,
				this.RadialCam.pivotObject.up.y,
				this.RadialCam.pivotObject.up.z);
			var pos = this.RadialCam.pivotObject.getWorldPosition();
			var vector = new THREE.Vector3(
				up.x*this.PanVelocity.dx*radius*this.PanSpeed,
				up.y*this.PanVelocity.dx*radius*this.PanSpeed,
				-up.z*this.PanVelocity.dx*radius*this.PanSpeed
				);
			this.RadialCam.pivotObject.localToWorld(vector);
			this.RadialCam.pivotObject.position.set(vector.x, vector.y, vector.z);

			var radius = this.RadialCam.radius
			var axis = new THREE.Vector3(1,0,0);
			var angle = -Math.PI/2;
			up.applyAxisAngle(axis,angle);
			var pos = this.RadialCam.pivotObject.getWorldPosition();
			var vector = new THREE.Vector3(
				up.x*this.PanVelocity.dy*radius*this.PanSpeed,
				up.y*this.PanVelocity.dy*radius*this.PanSpeed,
				up.z*this.PanVelocity.dy*radius*this.PanSpeed
				);
			this.RadialCam.pivotObject.localToWorld(vector);
			this.RadialCam.origin = vector;

			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

			if ( xrot || yrot )
				this.dispatchEvent( { type: 'CameraPivoted', message: 'Camera Pivoted.', data: null } );

			this.dispatchEvent( { type: 'CameraMoved', message: 'Camera Moved.', data: null } );

		}

	}

	this._ApplyDecelerations = function( frameDelta ){

		/*
			Slow the camera velocity down. This grants the feeling on momentum.
			Without the deccelerations the camera will keep moving forever.
		*/

		var pivotDeceleration = this.PivotDeceleration;
		var panDeceleration = this.PanDeceleration;

		/*
			If the user is holding the input down then increase decceleration, this tracks the users cursor or finger more accuratly.
		*/

		if ( _Input1Down )
			pivotDeceleration = pivotDeceleration*4;
		if ( _Input2Down )
			panDeceleration = panDeceleration*4;

		/*
			If the velocity is below a certain threshold then just set it to zero.
		*/
		if ( (this.PivotVelocity.dx < 0.0001  && this.PivotVelocity.dx > -0.0001) || this.PivotSpeed == 0 )
			this.PivotVelocity.dx = 0;

		/*
			Finally apply a general decceleration.
		*/
		else if ( this.PivotVelocity.dx != 0 )
			this.PivotVelocity.dx = this.PivotVelocity.dx / ((pivotDeceleration)*frameDelta+1);

		if ( this.PivotVelocity.dy < 0.0001  && this.PivotVelocity.dy > -0.0001 || this.PivotSpeed == 0 )
			this.PivotVelocity.dy = 0;
		else if (this.PivotVelocity.dy != 0 )
			this.PivotVelocity.dy = this.PivotVelocity.dy / ((pivotDeceleration)*frameDelta+1);

		if ( (this.PanVelocity.dx < 0.0001  && this.PanVelocity.dx > -0.0001) || this.PanSpeed == 0 )
			this.PanVelocity.dx = 0;
		else if ( this.PanVelocity.dx != 0 )
			this.PanVelocity.dx = this.PanVelocity.dx / ((panDeceleration)*frameDelta+1);

		if ( this.PanVelocity.dy < 0.0001  && this.PanVelocity.dy > -0.0001 || this.PanSpeed == 0 )
			this.PanVelocity.dy = 0;
		else if (this.PanVelocity.dy != 0 )
			this.PanVelocity.dy = this.PanVelocity.dy / ((panDeceleration)*frameDelta+1);


	}

	this.CaptureImage = function ( location, callback, animated, duration ){

		var startPos = this.GetCameraViewData();
		animated = animated === undefined ? true : animated;

		if ( !animated )
			duration = 0;
		else
			duration = duration || 1;

		this.addEventListener( 'CapturedCanvas', function ( event ) {

			callback( event.data );
			this.removeEventListener('CapturedCanvas');

		});

		this.AnimateCamera( startPos, location, duration, function ( ){

			// Capture the image.
			this.CaptureCanvas = true;

	 	}.bind(this));

	}

	// Animation functions

	this.CancelAnimationsForObjectNamed = function( name ){

		var length = this.Animations.length;
		if (length == 0) return;
		 for ( var i=length-1; i>=0; i--){
			var animation = this.Animations[i];
			if ( animation.object.name == name ){
				this.Animations.splice( i, 1 );
				break;
			}
		 }
	}

	this.AnimateObject = function ( endPosition, endRotation, animationDuration, object ){

		console.warn("Deprecated: Please use Animation instead, this will be removed in later versions.");
		// Animation duration in seconds.
		// Positions are cartesian.
		var startPosition = new THREE.Vector3(object.position.x, object.position.y, object.position.z);
		if (endPosition == null) endPosition = startPosition;
		var startTime = Date.now();
		var startRotation = new THREE.Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
		if (endRotation == null) endRotation = startPosition;
		var endTime = startTime + animationDuration*1000;
		var animation = {
			"startPosition":startPosition,
			"endPosition":endPosition,
			"startTime":startTime,
			"endTime":endTime,
			"object":object,
			"startRotation":startRotation,
			"endRotation":endRotation
		};
		CancelAnimationsForObjectNamed(object.name);
		this.Animations.push(animation);
		return animation;
	}

	this.GetCameraViewData = function ( stringify ) {

    var position = this.RadialCam.position;

		if (stringify){
      // Convert target to a readable object.
      position.target = { x:position.target._x, y:position.target._y, z:position.target._z };
			return JSON.stringify(position);
		}else{
			return position;
    }

  }

	this.AnimateCamera = function ( start, end, duration, callback ){

		// Make sure the shortest route to the target is taken. Should never be rotating more than 180 degrees (Pi radians)
		if (!start.radius)
			start.radius = 0;
		if (!end.radius)
			end.radius = 0;

		while (end.target.x - start.target.x < -Math.PI){
			end.target.x += 2*Math.PI;
		}
		while (end.target.y - start.target.y < -Math.PI){
			end.target.y += 2*Math.PI;
		}
		while (end.target.z - start.target.z < -Math.PI){
			end.target.z += 2*Math.PI;
		}

		// Prevent camera flipping, the x values should never change.
		// Correct the rotations to account for this.
		if (end.target.x != start.target.x){
			var diff = end.target.x - start.target.x;
			end.target.x = start.target.x;
			end.target.y += diff;
			end.target.z += diff;
		}

		// Make sure we never take the long route to the destination
		// The rotations should always be beloe 180 degrees (Pi radians)
		while (end.target.y - start.target.y > Math.PI){
			end.target.y -= 2*Math.PI;
		}
		while (end.target.y - start.target.y < -Math.PI){
			end.target.y += 2*Math.PI;
		}
		while (end.target.z - start.target.z > Math.PI){
			end.target.z -= 2*Math.PI;
		}
		while (end.target.z - start.target.z < -Math.PI){
			end.target.z += 2*Math.PI;
		}


		this.CameraAnimation = [
			this.makeAnimation( 'x', start.origin.x, end.origin.x ),
			this.makeAnimation( 'y', start.origin.y, end.origin.y ),
			this.makeAnimation( 'z', start.origin.z, end.origin.z ),
			this.makeAnimation( 'x', start.target.x, end.target.x ),
			this.makeAnimation( 'y', start.target.y, end.target.y ),
			this.makeAnimation( 'z', start.target.z, end.target.z ),
			this.makeAnimation( 'radius', start.radius, end.radius )
		];

		var startTime = Date.now();
		var endTime = startTime + duration*1000;
		this.CameraAnimation.endTime = endTime;
		this.CameraAnimation.callback = callback;

		this.CameraAnimation[0].Run(this.RadialCam.pivotObject.position, startTime, endTime);
		this.CameraAnimation[1].Run(this.RadialCam.pivotObject.position, startTime, endTime);
		this.CameraAnimation[2].Run(this.RadialCam.pivotObject.position, startTime, endTime);
		this.CameraAnimation[3].Run(this.RadialCam.pivotObject.rotation, startTime, endTime);
		this.CameraAnimation[4].Run(this.RadialCam.pivotObject.rotation, startTime, endTime);
		this.CameraAnimation[5].Run(this.RadialCam.pivotObject.rotation, startTime, endTime);
		this.CameraAnimation[6].Run(this.RadialCam, startTime, endTime);

		return this.CameraAnimation;

	}

	this.HaltCameraAnimation = function () {

		console.log("Halting camera animation.");
		var len = this.CameraAnimation.length;
		for (var i=0; i<len; i++){
			this.CameraAnimation[i].Halt();
		}

	}

	// Mouse Controls

	this.AddInputListeners = function (event){

		window.addEventListener( 'devicemotion', this.HandleMotionEvent, true);
		this.Canvas.addEventListener( 'mousewheel', this.MouseWheelEvent );
		this.Canvas.addEventListener( 'wheel', this.WheelEvent );
		this.Canvas.addEventListener( "touchstart", this.TouchStartEvent );
		this.Canvas.addEventListener( "touchend", this.TouchEndEvent );
		this.Canvas.addEventListener( "touchmove", this.TouchMoveEvent );
		this.Canvas.addEventListener( 'contextmenu', this.ContextMenuEvent, false );
		this.Canvas.addEventListener( 'mousedown', this.MouseDownEvent );
		this.Canvas.addEventListener( 'mousemove', this.MouseMoveEvent );
		this.Canvas.addEventListener( 'mouseup', this.MouseUpEvent );
		this.Canvas.addEventListener( 'mouseout', this.MouseOutEvent );
		this.Canvas.addEventListener( 'mouseover', this.MouseOverEvent );

	}

	this.RemoveInputListeners = function () {

		window.removeEventListener( 'devicemotion', this.HandleMotionEvent, true);
		this.Canvas.removeEventListener( 'mousewheel', this.MouseWheelEvent );
		this.Canvas.removeEventListener( 'wheel', this.WheelEvent );
		this.Canvas.removeEventListener( "touchstart", this.TouchStartEvent );
		this.Canvas.removeEventListener( "touchend", this.TouchEndEvent );
		this.Canvas.removeEventListener( "touchmove", this.TouchMoveEvent );
		this.Canvas.removeEventListener( 'contextmenu', this.ContextMenuEvent, false );
		this.Canvas.removeEventListener( 'mousedown', this.MouseDownEvent );
		this.Canvas.removeEventListener( 'mousemove', this.MouseMoveEvent );
		this.Canvas.removeEventListener( 'mouseup', this.MouseUpEvent );
		this.Canvas.removeEventListener( 'mouseout', this.MouseOutEvent );
		this.Canvas.removeEventListener( 'mouseover', this.MouseOverEvent );


	}

	this.MouseOverEvent = function (event){

	    _engine.dispatchEvent( { type: 'Mouse-Over', data: event, message: 'Mouse Over.' } );
	}

	this.MouseOutEvent = function (event){

		// Check if the user mouse is down when dragging out of the active window.
		// Trigger mouse up if so we can remove any custom styling etc.
	    if (_Input1Down || _Input2Down) {

	    	// InputUp resets the interal status of input1down and input2down
			_engine.InputUp(event);
	    }

	    _engine.dispatchEvent( { type: 'Mouse-Out', data: event, message: 'Mouse Out.' } );

	}

	this.MouseUpEvent = function ( event ){

		_engine.InputUp(event);
		if(_engine.ClickCallback && _ListenForTap){
			_engine.ClickCallback(event);
		}else if( _ListenForTap ){
			_engine.dispatchEvent( { type: 'Click', data: event, message: 'Mouse Clicked.' } );
			_engine.dispatchEvent( { type: 'Click-Tap', data: event, message: 'Mouse Clicked.' } );
		}

	}

	this.MouseMoveEvent = function (event){

		_engine.InputMove(event);
		_engine.dispatchEvent( { type: 'MouseMoved', data: event, message: 'Mouse Moved in the Canvas.' } );

	}

	this.MouseDownEvent = function (event){

		event.preventDefault();
		if (event.button == 0)
			_engine.Input1Down(event);
		else if(event.button == 2)
			_engine.Input2Down(event);

	}

	this.MouseDownEvent = function (event){

		event.preventDefault();
		if (event.button == 0)
			_engine.Input1Down(event);
		else if(event.button == 2)
			_engine.Input2Down(event);

	}

	this.ContextMenuEvent = function (event){

		event.preventDefault();

	}

	this.TouchMoveEvent = function(event){

		event.preventDefault();

		if (event.touches.length == 1 && !_engine._zooming)
			_engine.InputMove(event);
		else if(event.touches.length == 2)
			_engine.InputZoom(event);


	}

	this.TouchEndEvent = function(event) {

		event.preventDefault();
		_engine.Input1Down(event);
		_TouchScale = null;

		if(_engine.ClickCallback && _engine.ListenForTap)
			_engine.ClickCallback();
		else if( _engine.ListenForTap ){

			_engine.dispatchEvent( { type: 'Tap', data: event, message: 'Tapped.' } );
			_engine.dispatchEvent( { type: 'Click-Tap', data: event, message: 'Tapped.' } );

		}

		_engine.InputUp(event);

	}

	this.WheelEvent = function(event) {

		event.preventDefault();
		_engine.InputZoom(event);

	}

	this.TouchStartEvent = function(event) {

		event.preventDefault();

		if (event.touches.length == 2){

			_TouchRadius = _engine.RadialCam.radius || _engine.RadialCam.camera.fov;
			_Input1Down = false;
			_Input2Down = false;

		}else
			_engine._zooming = false;

		_engine.Input1Down(event);
		if (_debug);
			console.log("touch start");

	}

	this.MouseWheelEvent = function(event) {

		event.preventDefault();
		_engine.InputZoom(event);

	}

	this.InputUp = function (event){

		var p = document.getElementById('canvas');

		event.preventDefault();
		_Input1Down = false;
		_Input2Down = false;

		_engine.dispatchEvent( { type: 'InputUp', data: event, message: 'Input Up.' } );

		if( _engine.InputUpCallback )
			_engine.InputUpCallback();

	}

	this.Input2Down = function (event){

		_Input2Down = true;
		if (event.pageX){

			// Mouse events
			_InputPosition.x = event.pageX - _engine.RendererOffsets().x;
			_InputPosition.y = event.pageY - _engine.RendererOffsets().y;
			_InputPosition.timeStamp = Date.now();

		}else{

			// Touch events
			_InputPosition.x = event.changedTouches[0].clientX - _engine.RendererOffsets().x;
			_InputPosition.y = event.changedTouches[0].clientY - _engine.RendererOffsets().y;
			_InputPosition.timeStamp = Date.now();

		}

		_engine.dispatchEvent( { type: 'InputDown', data: event, message: 'Input Down.' } );
		_engine.dispatchEvent( { type: 'Input1Down', data: event, message: 'Input 1 Down.' } );
		if( _engine.Input2DownCallback )
			_engine.Input2DownCallback();

	}

	this.Input1Down = function (event){

		_ListenForTap = true;
		_Input1Down = true;
		if (event.pageX ){

			// Mouse events
			_InputPosition.x = event.pageX - _engine.RendererOffsets().x;
			_InputPosition.y = event.pageY - _engine.RendererOffsets().y;
			_InputPosition.timeStamp = Date.now();

		}else{

			// Touch events
			_InputPosition.x = event.changedTouches[0].clientX - _engine.RendererOffsets().x;
			_InputPosition.y = event.changedTouches[0].clientY - _engine.RendererOffsets().y;
			_InputPosition.timeStamp = Date.now();

		}

		_engine.dispatchEvent( { type: 'InputDown', data: event, message: 'Input Down.' } );
		_engine.dispatchEvent( { type: 'Input2Down', data: event, message: 'Input 2 Down.' } );
		if ( _engine.Input1DownCallback )
			_engine.Input1DownCallback(event);

	}

	this.InputMove = function (event){

		var newInputPosition = { x:0, y:0 };

		if (_Input2Down && _engine.PanEnabled){
			// cancel any camera animations
			_engine.PanCamera(event);

		} else if (_Input1Down && _engine.PivotEnabled){

			// cancel any camera animations
			_engine.PivotCamera(event);

		}

		if ( event.pageX ){

			newInputPosition.x = event.pageX - _engine.RendererOffsets().x;
			newInputPosition.y = event.pageY - _engine.RendererOffsets().y;

		}else if (event.changedTouches){

			newInputPosition.x = event.changedTouches[0].clientX - _engine.RendererOffsets().x;
			newInputPosition.y = event.changedTouches[0].clientY - _engine.RendererOffsets().y;

		}

		if (_ListenForTap && newInputPosition.x != _InputPosition.x && newInputPosition.y != _InputPosition.y )
			_ListenForTap = false;

		_InputPosition.x = newInputPosition.x;
		_InputPosition.y = newInputPosition.y;
		_InputPosition.timeStamp = Date.now();

		if ( _InputPosition.x < 0 )
			_Input1Down = false;
		if ( _InputPosition.y < 0 )
			_Input1Down = false;

	}

	this.HandleMotionEvent = function (event){

		if( !_engine.DeviceHasGyros && (event.rotationRate.alpha || event.rotationRate.beta || event.rotationRate.gamma ))
			_engine.DeviceHasGyros = true;

		// If VR is on, don't do anything, leave it to the VR motion controls.
		if (_engine.VROn || _engine.CameraAnimation || _engine.PivotSpeed == 0  )
			return;

		if ( _engine.DeviceMotionEnabled && event.rotationRate.alpha && event.rotationRate.beta && event.rotationRate.gamma ){

			//_engine.DeviceMotionEnabled = true;
			if (_engine.DeviceMotionCallback)
				_engine.DeviceMotionCallback();

		}else if ( !_engine.DeviceMotionEnabled )
			return;

		var x;
		var y;

		/*
			Retrieve x and y rotations based on the device orientation.
		*/

		if ( window.orientation == 0 ){

			x = event.rotationRate.alpha;
			y = event.rotationRate.beta;

		}else if( window.orientation < 0 ){

			y = -event.rotationRate.alpha;
			x = event.rotationRate.beta;

		}else if ( window.orientation == 180 ){

			x = -event.rotationRate.alpha;
			y = -event.rotationRate.beta;

		}else if( window.orientation > 0 ){


			y = event.rotationRate.alpha;
			x = -event.rotationRate.beta;

		}

		var divider; 		// A constant to correct the rotations for a realistic movement speed.
							// Varies depending on OS
							// Arbitrary values determined through trial and error.
		if ( PIKENG.MobileOS() == MOBOS.IOS )
			divider = 3700;
		else
			divider = 70;

		/*
			This might need work for different camera up axis' at some point
		*/

		_engine.RadialCam.pivotObject.rotation.set(_engine.RadialCam.pivotObject.rotation.x,
		_engine.RadialCam.pivotObject.rotation.y + y/divider,
		_engine.RadialCam.pivotObject.rotation.z + x/divider);

	}

	this.RendererOffsets = function (){

		var offsets = _Canvas.getBoundingClientRect();
		var top = offsets.top;
		var left = offsets.left;
		return{ "x":offsets.left + document.body.scrollLeft, "y":offsets.top + document.body.scrollTop }

	}

	this.PanCamera = function (event){

		var dX;
		var dY;
		var timeDifference;

		if (event.pageX == 0)
			return;

		timeDifference = Date.now() - _InputPosition.timeStamp;
		if (timeDifference == 0)
			return;

		if (event.pageX){
			dX = (event.pageX - this.RendererOffsets().x - _InputPosition.x)/(timeDifference);
			dY = (event.pageY - this.RendererOffsets().y - _InputPosition.y)/(timeDifference);
		}else{
			dX = (event.changedTouches[0].clientX - this.RendererOffsets().x - _InputPosition.x)/(timeDifference);
			dY = (event.changedTouches[0].clientY - this.RendererOffsets().y - _InputPosition.y)/(timeDifference);
		}

		this.PanVelocity.dy = dY/_Canvas.offsetHeight;
		this.PanVelocity.dx = dX/_Canvas.offsetWidth;

		if (this.CameraAnimation)
			this.HaltCameraAnimation();

	}

	this.PivotCamera = function (event){

		var dX;
		var dY;
		var timeDifference;

		if (event.pageX == 0)
			return;

		timeDifference = Date.now() - _InputPosition.timeStamp;
		if (timeDifference == 0)
			return;

		if (event.pageX){
			dX = (event.pageX - this.RendererOffsets().x - _InputPosition.x)/timeDifference;
			dY = (event.pageY - this.RendererOffsets().y - _InputPosition.y)/timeDifference;
		}else{
			dX = (event.changedTouches[0].clientX - this.RendererOffsets().x - _InputPosition.x)/timeDifference;
			dY = (event.changedTouches[0].clientY - this.RendererOffsets().y - _InputPosition.y)/timeDifference;
		}

		// console.log(dX);
		// if (dX > 10 || dX < -10)
		// 	console.log("broken");

		this.PivotVelocity.dy = dY/_Canvas.offsetHeight;
		this.PivotVelocity.dx = dX/_Canvas.offsetWidth;

		if (this.CameraAnimation)
			this.HaltCameraAnimation();

	}

	this.InputZoom = function (event){

		this._zooming = true;
		if (!this.ZoomEnabled){
			return;
		};
		// Cancel any camera animations
		if (this.CameraAnimation)
			this.HaltCameraAnimation();

		var location = null;

		if (this.RadialCam.radius == 0){

			this.FovZoom( event );
			return;

		}

		// Mouse wheel events
		if (event.wheelDeltaY > 0 && this.RadialCam.radius && this.RadialCam.radius != 0 ) {

			this.RadialCam.radius = this.RadialCam.radius * 0.9;
			// limit
			if (this.RadialCam.radius < this.RadiusMin )
				this.RadialCam.radius = this.RadiusMin;

		}else if (event.wheelDeltaY < 0 && this.RadialCam.radius != 0){

			this.RadialCam.radius = this.RadialCam.radius * 1.1;
			// limit
			if (this.RadialCam.radius > this.RadiusMax )
				this.RadialCam.radius = this.RadiusMax;

		}else if (event.scale && this.RadialCam.radius != 0){

			if( !_TouchScale )
				_TouchScale = event.scale;

			this.RadialCam.radius = _TouchRadius * (1 + _TouchScale - event.scale);

		}else if (event.deltaY > 0 && this.RadialCam.radius != 0){ // Mozilla

			this.RadialCam.radius = this.RadialCam.radius * 0.9 - 1;
			// limit

		}else if (event.deltaY < 0 && this.RadialCam.radius != 0){ // Mozilla

			this.RadialCam.radius = 1+ this.RadialCam.radius *1.1;


		}else if(event.changedTouches){

		 	if( event.changedTouches.length == 2 && this.RadialCam.radius != 0 ){ // limit

				var dX = (event.changedTouches[0].screenX - event.changedTouches[1].screenX)/_Canvas.width;
				var dY = (event.changedTouches[0].screenY - event.changedTouches[1].screenY)/_Canvas.width
				var scale =  Math.sqrt(dX*dX+dY*dY);
				if( !_TouchScale )
					_TouchScale = scale;
				this.RadialCam.radius = _TouchRadius * (1 + _TouchScale - scale);
			}

		}

		if (this.RadialCam.radius < this.RadiusMin && this.RadialCam.radius != 0 )
			this.RadialCam.radius = this.RadiusMin;

		if (this.RadialCam.radius > this.RadiusMax )
			this.RadialCam.radius = this.RadiusMax;

		this.dispatchEvent( { type: 'CameraZoomed', message: 'Camera Zoomed.', data: location } );
		this.dispatchEvent( { type: 'CameraMoved', message: 'Camera Moved.', data: location } );

		// Add a frame to the que so the zoom trasnition is visible to the user.
		if (PIKENG.frameQueue <= 0)
				PIKENG.frameQueue = 1;

	}

  this.FovZoom = function ( event ) {

        // Mouse wheel events
    if ( event.wheelDeltaY > 0 ) {

      this.RadialCam.camera.fov = this.RadialCam.camera.fov * 0.9;
      // limit
      if (this.RadialCam.camera.fov < this.FovMin )
        this.RadialCam.camera.fov = this.FovMin;

    }else if ( event.wheelDeltaY < 0 ){

      this.RadialCam.camera.fov = this.RadialCam.camera.fov * 1.1;
      // limit
      if (this.RadialCam.camera.fov > this.FovMax )
        this.RadialCam.camera.fov = this.FovMax;

    }else if ( event.scale ){

      if( !_TouchScale )
        _TouchScale = event.scale;

      this.RadialCam.camera.fov = _TouchRadius * _TouchScale/event.scale;

    }else if ( event.deltaY > 0 ){ // Mozilla

      this.RadialCam.camera.fov = this.RadialCam.camera.fov * 0.9 - 1;
      // limit

    }else if (event.deltaY < 0 ){ // Mozilla

      this.RadialCam.camera.fov = 1+ this.RadialCam.camera.fov *1.1;


    }else if(event.changedTouches){

      if( event.changedTouches.length == 2 && this.RadialCam.camera.fov != 0 ){ // limit

        var dX = (event.changedTouches[0].screenX - event.changedTouches[1].screenX)/_Canvas.width;
        var dY = (event.changedTouches[0].screenY - event.changedTouches[1].screenY)/_Canvas.width
        var scale =  Math.sqrt(dX*dX+dY*dY);
        if( !_TouchScale )
          _TouchScale = scale;
        this.RadialCam.camera.fov = _TouchRadius * (1 + _TouchScale - scale);
      }

    }

    if (this.RadialCam.camera.fov < this.FovMin && this.RadialCam.camera.fov != 0 )
      this.RadialCam.camera.fov = this.FovMin;

    if (this.RadialCam.camera.fov > this.FovMax )
      this.RadialCam.camera.fov = this.FovMax;

    this.dispatchEvent( { type: 'CameraZoomed', message: 'Camera Zoomed.', data: location } );
    this.dispatchEvent( { type: 'CameraMoved', message: 'Camera Moved.', data: location } );

    // Add a frame to the que so the zoom trasnition is visible to the user.
    _engine.RadialCam.camera.updateProjectionMatrix();
    if (PIKENG.frameQueue <= 0)
		PIKENG.frameQueue = 1;

  }

	// Utilities

	this.TraverseObjectForVerts = function ( object ) {

		var verts = 0;

		if ( object.children )
			if ( object.children.length > 0 )
				for ( var i=0; i<object.children.length; i++) {
					verts += this.TraverseObjectForVerts (object.children[i]);
				}

		if ( object.type == 'Mesh' ){

			if ( object.geometry.vertices )
				verts += object.geometry.vertices.length;
			else if ( object.geometry.attributes )
				verts += object.geometry.attributes.position.array.length/3;

		}

		return verts;

	}

	this.TraverseObjectForGeometry = function ( object ) {

		var meshes = [];

		if ( object.children )
			if ( object.children.length > 0 )
				for ( var i=0; i<object.children.length; i++) {
					meshes = meshes.concat(this.TraverseObjectForGeometry (object.children[i]));
				}

		if ( object.geometry )
			meshes.push(object);

		return meshes;

	}

	this.DModeOn = function () {

		this.RadialCam.camera.quaternion.set (0.5,0,0.3,0);

	}

	this.DModeOff = function () {

		this.RadialCam.camera.quaternion.set (0,0,0,0);

	}

	this.ComputeSceneBoundingSphere = function ( ){

		// Not a real bounding sphere, it is a sphere that bounds a bounding box.
		var largestValues = new THREE.Vector3( );
		var smallestValues = new THREE.Vector3( );
		var first = true;
		this.Scene.updateMatrixWorld();

		this.Scene.traverse( function( object ){

			if ( object.geometry ){
				if ( object.geometry.vertices ){

					var len = object.geometry.vertices.length;
					for ( var i=0; i<len; i++ ){

						var vertex = object.geometry.vertices[i].clone();
						vertex.applyMatrix4( object.matrixWorld );

						if (first){

							largestValues.x = vertex.x;
							largestValues.y = vertex.y;
							largestValues.z = vertex.z;
							smallestValues.x = vertex.z;
							smallestValues.y = vertex.y;
							smallestValues.z = vertex.z;
							first = false;

						}else{

							if ( vertex.x > largestValues.x )
								largestValues.x = vertex.x;
							else if ( vertex.x < smallestValues.x )
								smallestValues.x = vertex.x;

							if ( vertex.y > largestValues.y )
								largestValues.y = vertex.y;
							else if ( vertex.y < smallestValues.y )
								smallestValues.y = vertex.y;

							if ( vertex.z > largestValues.z )
								largestValues.z = vertex.z;
							else if ( vertex.z < smallestValues.z )
								smallestValues.z = vertex.z;

						}
					}
				}
			}
		});

		var center = new THREE.Vector3();
		center.add(largestValues);
		center.add(smallestValues);
		center.divideScalar(2);
		var radius = largestValues.sub(center).length();

		// Display Sphere to test
		/*var sphereGeo = new THREE.SphereGeometry( radius, 20, 20 );
		var lineMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
		var sphereMesh = new THREE.Mesh( sphereGeo, lineMat );
		sphereMesh.position.set( center.x, center.y, center.z );
		this.Scene.add(sphereMesh);*/

		this.SceneBoundingSphere = { center:center, radius:radius };
		return this.SceneBoundingSphere;

	}

	this.StopRendering = function () {

		_stopContinuousRendering = true;
		PIKENG.frameQueue = 1; // Rest the frame queue so that when Render is called it will render and inital frame.

	}

	this.ComputeObjectBounds = function ( root ){

		var sceneBSCenter = new THREE.Vector3();
		var sceneBSRadius = 0;

		root.traverse( function (object) {

			  if (object.geometry){

					// Object radius
					if (!object.geometry.boundingSphere)
						object.geometry.computeBoundingSphere();
					var radius = object.geometry.boundingSphere.radius;

					// Object center in world space
					var objectCenterLocal = object.position.clone();
					var objectCenterWorld = objectCenterLocal.applyMatrix4(object.matrixWorld);

					// New center in world space
					var newCenter = new THREE.Vector3();
					newCenter.add(sceneBSCenter);
					newCenter.add(object.geometry.boundingSphere.center);
					newCenter.divideScalar(2.0);

					// New radius in world space
					var dCenter = newCenter.distanceTo(sceneBSCenter);
					var newRadius = Math.max(dCenter + radius, dCenter + sceneBSRadius);
					sceneBSCenter = newCenter;
					sceneBSRadius = newRadius;

			  }

		 });

		var vector = new THREE.Vector3();
		vector.setFromMatrixPosition( root.matrixWorld );

		sceneBSCenter.x = sceneBSCenter.x + vector.x;
		sceneBSCenter.y = sceneBSCenter.y + vector.y;
		sceneBSCenter.z = sceneBSCenter.z + vector.z;

		return {

			center: sceneBSCenter,
			radius: sceneBSRadius

		};

	}

	this.NormaliseCamera = function ( object ) {

		var sceneBounds, camNorm, camRot, radialLoc;

		if ( object && object.type == 'RadialPosition'){

			camNorm = this.CameraNormalised = { origin:object.origin, radius:object.radius };
			camRot = object.target;

		}else{

			sceneBounds = this.ComputeObjectBounds(this.Scene);
			camNorm = this.CameraNormalised = { origin:sceneBounds.center, radius:sceneBounds.radius*5 };
			camRot = new THREE.Vector3(1.57, 0, 0)

		}

		// Camera needs an initial radius to compute orientation correctly to begin with
		var makePano = false;
		if (!camNorm.radius){
			camNorm.radius = 1;
			makePano = true;
		}

		this.RadialCam.set(camNorm.origin, camRot, camNorm.radius);
		this.RadialCam.camera.near = camNorm.radius/500;
		this.RadialCam.camera.far = camNorm.radius*40;
		this.RadiusMax = camNorm.radius*40;
		this.RadiusMin = camNorm.radius/500;
		this.RadialCam.camera.updateProjectionMatrix();

		// Set camera radius to 0 now that it's orinetation is set.
		if (makePano)
			this.RadialCam.radius = 0;

		if (PIKENG.frameQueue <= 0)
			PIKENG.frameQueue = 1;

	}

	this.RaycasterFromMouse = function (){

		if ( this.Raycaster == null )
			this.Raycaster = new THREE.Raycaster();

		var canvasWidth = parseInt(window.getComputedStyle(_Canvas, null).getPropertyValue("width"), 10);
		var canvasHeight = parseInt(window.getComputedStyle(_Canvas, null).getPropertyValue("height"), 10);

		var x = 2*(_InputPosition.x/(canvasWidth - parseInt(window.getComputedStyle( _Canvas ).paddingLeft))) - 1;
		var y = 2*(-_InputPosition.y/(canvasHeight - parseInt(window.getComputedStyle( _Canvas ).paddingTop))) + 1;
		var normalisedTouch = new THREE.Vector2( x, y );
		this.Raycaster.setFromCamera( normalisedTouch, this.RadialCam.camera );

		return this.Raycaster;

	}

	this.ArrayContainsObject = function ( array, object ) {

		for (var i=0; i<array.length;i++){
			var arrayObject = array[i];
			if (arrayObject == object) {
				return true;
			};
		}

		return false;

	}

	//Defaults

	this.SetDefaults = function () {

		// Renderer Defaults
		this.Renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
		this.Renderer.setClearColor( 0x000000, 0 );

		// Camera Defaults
		this.Scene.add(this.RadialCam.pivotObject);

	}


	// Over write user defined parameters
	for ( parameter in parameters ){

		this[parameter] = parameters[parameter];

	}

	return this;

};

Object.assign( PIKENG.prototype, {

	addEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) this._listeners = {};

		var listeners = this._listeners;

		if ( listeners[ type ] === undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	},

	hasEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return false;

		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {

			return true;

		}

		return false;

	},

	removeEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {

			var index = listenerArray.indexOf( listener );

			if ( index !== - 1 ) {

				listenerArray.splice( index, 1 );

			}

		}

	},

	dispatchEvent: function ( event ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [], i = 0;
			var length = listenerArray.length;

			for ( i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}

} );

PIKENG.WireframeMat = new THREE.MeshBasicMaterial( { color:0x000, side:THREE.DoubleSide, wireframe:true } );

PIKENG.MobileOS = function (){

	if(MOBOS.MobileOS != null)
		return MOBOS.MobileOS;

	var userAgent = navigator.userAgent || navigator.vendor || window.opera;

	if (/windows phone/i.test(userAgent))
		MOBOS.MobileOS = MOBOS.WINDOWS;
	else if (/android/i.test(userAgent))
		MOBOS.MobileOS = MOBOS.ANDROID;
	else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream)
		MOBOS.MobileOS = MOBOS.IOS;
	else
		MOBOS.MobileOS = MOBOS.UNKNOWN;

	return MOBOS.MobileOS;

}

PIKENG.RadialLocation = function ( radius, target, origin ){

	if (!origin){

		origin = {x:0, y:0, z:0};
		console.warn("Origin should be set as { x:val, y:val, z:val }");

	}else if ( isNaN(origin.x) || isNaN(origin.y) || isNaN(origin.z) ){

		origin = {x:0, y:0, z:0};
		console.warn("Origin should be set as { x:val, y:val, z:val }");

	}

	if (!target){

	 target = {x:0, y:0, z:0};
	 console.warn("Target should be set as { x:val, y:val, z:val }");

	}else if ( isNaN(target.x) || isNaN(target.y) || isNaN(target.z) ){

		target = {x:0, y:0, z:0};
		console.warn("Target should be set as { x:val, y:val, z:val }");

  }

	return {
		"radius":radius,
		"target":{x:target.x, y:target.y, z:target.z},
		"origin":{x:origin.x, y:origin.y, z:origin.z}
  	};
}

// Utility functions

PIKENG.RemoveObjectFromArray = function(object, array) {

	for (var i=0; i<array.length;i++){
		var arrayObject = array[i];
		if (arrayObject === object) {
			array.splice(i, 1);
			return;
		};
	}
}

PIKENG.SplitImage = function ( image, vertical, horizontal ){

	var widthOfOnePiece = image.width/vertical;
	var heightOfOnePiece = image.height/horizontal;
	var imagePieces = [];

	for(var x = 0; x < vertical; ++x) {

		var row = [];
		imagePieces.push(row);

		for(var y = 0; y < horizontal; ++y) {

			var canvas = document.createElement('canvas');
			canvas.width = widthOfOnePiece;
			canvas.height = heightOfOnePiece;
			var context = canvas.getContext('2d');
			context.drawImage(image, x * widthOfOnePiece, y * heightOfOnePiece, widthOfOnePiece, heightOfOnePiece, 0, 0, canvas.width, canvas.height);
			var cropped = document.createElement('img');
			cropped.src = canvas.toDataURL();
			row.push(cropped);

		}
	}

	 return imagePieces;
}

PIKENG.MobileCheck = function() {

	console.warn("[DEPRECATED] Not very relaible anymore, should implement some sort of feature test if you need this.");
	var check = false;
	(function(a){
		if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))
			check = true
		}
	)(navigator.userAgent||navigator.vendor||window.opera);
	return check;

}



THREE.DeviceOrientationControls = function( object ) {

	var scope = this;

	this.object = object;
	this.object.rotation.reorder( "YXZ" );

	this.enabled = true;

	this.deviceOrientation = {};
	this.screenOrientation = 0;

	this.alpha = 0;
	this.alphaOffsetAngle = 0;


	var onDeviceOrientationChangeEvent = function( event ) {

		scope.deviceOrientation = event;

	};

	var onScreenOrientationChangeEvent = function() {

		scope.screenOrientation = window.orientation || 0;

	};

	// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

	var setObjectQuaternion = function() {

		var zee = new THREE.Vector3( 0, 0, 1 );

		var euler = new THREE.Euler();

		var q0 = new THREE.Quaternion();

		var q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

		return function( quaternion, alpha, beta, gamma, orient ) {

			euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

			quaternion.setFromEuler( euler ); // orient the device

			quaternion.multiply( q1 ); // camera looks out the back of the device, not the top

			quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

		}

	}();

	this.connect = function() {

		onScreenOrientationChangeEvent(); // run once on load

		window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = true;

	};

	this.disconnect = function() {

		window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = false;

	};

	this.update = function() {

		if ( scope.enabled === false ) return;

		var alpha = scope.deviceOrientation.alpha ? THREE.Math.degToRad( scope.deviceOrientation.alpha ) + this.alphaOffsetAngle : 0; // Z
		var beta = scope.deviceOrientation.beta ? THREE.Math.degToRad( scope.deviceOrientation.beta ) : 0; // X'
		var gamma = scope.deviceOrientation.gamma ? THREE.Math.degToRad( scope.deviceOrientation.gamma ) : 0; // Y''
		var orient = scope.screenOrientation ? THREE.Math.degToRad( scope.screenOrientation ) : 0; // O

		setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
		this.alpha = alpha;

	};

	this.updateAlphaOffsetAngle = function( angle ) {

		this.alphaOffsetAngle = angle;
		this.update();

	};

	this.dispose = function() {

		this.disconnect();

	};

	this.connect();

};

/**
 * @author alteredq / http://alteredqualia.com/
 * @authod mrdoob / http://mrdoob.com/
 * @authod arodic / http://aleksandarrodic.com/
 * @authod fonserbc / http://fonserbc.github.io/
*/

THREE.StereoEffect = function ( renderer ) {

	var _stereo = new THREE.StereoCamera();
	_stereo.aspect = 0.5;

	this.setEyeSeparation = function ( eyeSep ) {

		_stereo.eyeSep = eyeSep;

	};

	this.setSize = function ( width, height ) {

		renderer.setSize( width, height );

	};

	this.render = function ( scene, camera ) {

		scene.updateMatrixWorld();

		if ( camera.parent === null ) camera.updateMatrixWorld();

		_stereo.update( camera );

		var size = renderer.getSize();

		if ( renderer.autoClear ) renderer.clear();
		renderer.setScissorTest( true );

		renderer.setScissor( 0, 0, size.width / 2, size.height );
		renderer.setViewport( 0, 0, size.width / 2, size.height );
		renderer.render( scene, _stereo.cameraL );

		renderer.setScissor( size.width / 2, 0, size.width / 2, size.height );
		renderer.setViewport( size.width / 2, 0, size.width / 2, size.height );
		renderer.render( scene, _stereo.cameraR );

		renderer.setScissorTest( false );

	};

};


// THREE.js extentions and overrides start here

PIKENG.SetMap = function ( type, attributes, onLoad, onProgress, onError ) {


	if (attributes == null) {

		console.log("Cannot load null diffuse file path.")
		return;

  	}

	var url, scaleX = 1, scaleY =1;

	if ( typeof attributes  === "string")
		url = attributes;
	else {

		url = attributes.url;
		if (attributes.scaleX)
			scaleX = attributes.scaleX;
		if (attributes.scaleY)
			scaleY = attributes.scaleY;

	}

	var scope = this;
	var textureLoader = new THREE.TextureLoader();
	textureLoader.crossOrigin = '';
	PIKENG.LoadingManager.load();
	textureLoader.load(url,
	function(texture){

		texture.wrapT = texture.wrapS = THREE.RepeatWrapping;
		scope[type] = texture;

		if ( type == 'normalMap' ){

			scope.normalScale = new THREE.Vector2( 1, 1 );

		}else if ( type == 'map' ){

			texture.repeat.height = scaleY;
			texture.repeat.width = scaleX;

		}else if ( type == 'alphaMap' ){

			scope.transparent = true;

		}

		scope.needsUpdate = true;
		texture.dispose();
		if( onLoad )
			onLoad( texture );
		PIKENG.LoadingManager.succeeded();
		PIKENG.frameQueue = 1;

	},
	function( xhr ){

		if( onProgress )
			onProgress( xhr );

	},
	function( xhr ){

		PIKENG.LoadingManager.failed();
		if( onError )
			onError( xhr );

	});

}

PIKENG.SetEnvMap =  function ( path, urls, onLoad, onProgress, onError ) {

	var loader = new THREE.CubeTextureLoader();
	loader.setPath( path );
	var textureCube = loader.load( urls, onLoad, onProgress, onError );
	this.envMap = textureCube;

}

THREE.BufferGeometry.prototype.rotateUVs = function ( channel, rotation ) {

	// This will rotate UVs from current rotation.

	var mapName, uvMap, i, rotMap, mapPreserve;
	if (channel == 1 || channel == 0)
		channel = '';
	mapName = 'uv' + channel;
	uvMap = this.attributes[mapName];

	// Preserve the original map
	mapPreserve = mapName + "Preserve";
	if (this.attributes[mapPreserve] == undefined)
		this.attributes[mapPreserve] = uvMap.clone();

	rotMap = uvMap.clone();

	for ( i=0; i<uvMap.array.length; i=i+2){

		rotMap.array[i] = uvMap.array[i]*Math.cos(rotation) - uvMap.array[i+1]*Math.sin(rotation);
		rotMap.array[i+1] = uvMap.array[i]*Math.sin(rotation) + uvMap.array[i+1]*Math.cos(rotation);

	}

	this.attributes[mapName] = rotMap;
	this.uvsNeedUpdate = true;

}

THREE.BufferGeometry.prototype.setUVRotation = function ( channel, rotation ) {

	// This will set the UV rotation from the original UVs

	var mapName, uvMap, i, rotMap;
	if (channel == 1 || channel == 0)
		channel = '';
	mapName = 'uv' + channel;

	// Preserve the original map
	mapPreserve = mapName + "Preserve";
	if (this.attributes[mapPreserve] == undefined)
		this.attributes[mapPreserve] = this.attributes[mapName].clone();

	uvMap = this.attributes[mapPreserve];
	rotMap = uvMap.clone();

	for ( i=0; i<uvMap.array.length; i=i+2){

		rotMap.array[i] = uvMap.array[i]*Math.cos(rotation) - uvMap.array[i+1]*Math.sin(rotation);
		rotMap.array[i+1] = uvMap.array[i]*Math.sin(rotation) + uvMap.array[i+1]*Math.cos(rotation);

	}

	this.attributes[mapName] = rotMap;
	this.uvsNeedUpdate = true;

}

THREE.MeshStandardMaterial.prototype.setRoughnessMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'roughnessMap', attributes, onLoad, onProgress, onError );

}

var setDiffuse = function ( attributes, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'map', attributes, onLoad, onProgress, onError );

}

THREE.MeshStandardMaterial.prototype.setDiffuse = setDiffuse;
THREE.MeshPhongMaterial.prototype.setDiffuse = setDiffuse;
THREE.MeshBasicMaterial.prototype.setDiffuse = setDiffuse;
setDiffuse = undefined;

var setAlphaMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'alphaMap', filePath, onLoad, onProgress, onError );

}

THREE.MeshPhongMaterial.prototype.setAlphaMap = setAlphaMap;
THREE.MeshStandardMaterial.prototype.setAlphaMap = setAlphaMap;
setAlphaMap = undefined;

THREE.MeshPhongMaterial.prototype.setSpecularMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'specularMap', filePath, onLoad, onProgress, onError );

}

THREE.MeshStandardMaterial.prototype.setMetalnessMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'metalnessMap', filePath, onLoad, onProgress, onError );

}

var setEnvMap = function ( path, urls, onLoad, onProgress, onError ){

	PIKENG.SetEnvMap.call( this, path, urls, onLoad, onProgress, onError );

}

THREE.MeshPhongMaterial.prototype.setEnvMap = setEnvMap;
THREE.MeshStandardMaterial.prototype.setEnvMap = setEnvMap;
setEnvMap = undefined;

var setLightMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'lightMap', filePath, onLoad, onProgress, onError );

}

THREE.MeshPhongMaterial.prototype.setLightMap = setLightMap;
THREE.MeshStandardMaterial.prototype.setLightMap = setLightMap;
setLightMap = undefined;

var setNormalMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'normalMap', filePath, onLoad, onProgress, onError );

}

THREE.MeshPhongMaterial.prototype.setNormalMap = setNormalMap;
THREE.MeshStandardMaterial.prototype.setNormalMap = setNormalMap;
setNormalMap = undefined;

THREE.MeshPhongMaterial.prototype.setAOMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'aoMap', filePath, onLoad, onProgress, onError );

}

var setBumpMap = function ( filePath, onLoad, onProgress, onError ){

	PIKENG.SetMap.call( this, 'bumpMap', filePath, onLoad, onProgress, onError );

}

THREE.MeshPhongMaterial.prototype.setBumpMap = setBumpMap;
THREE.MeshStandardMaterial.prototype.setBumpMap = setBumpMap;
setBumpMap = undefined;


THREE.MeshPhongMaterial.prototype.cloneThree = THREE.MeshPhongMaterial.prototype.clone;
THREE.MeshPhongMaterial.prototype.clone = function () {

	var clone = this.cloneThree();
	clone.lightMapOverrideIntensity = this.lightMapOverrideIntensity;
	return clone;

}

THREE.Geometry.prototype.GetMaterialIds = function () {

	// Check to see if materialIds have been computed before.
	if ( this.materialIds )
		return this.materialIds;

	// If not then compute them.

	var ids = [];
	var highest = -1;
	var len = this.faces.length;
	this.sortFacesByMaterialIndex();

	for ( var i=0; i<len; i++ ) {

		var face = this.faces[i];

		if ( face.materialIndex > highest ){

			ids.push(face.materialIndex);
			highest = face.materialIndex;

		}

	}

	// Set material ids for this geometry for future reference.
	this.materialIds = ids;

	return ids;
}

THREE.Object3D.prototype.tranverseForObjectsNamed = function(name){

	var objects = [];
	this.traverse (function (object){
		if ( object.name == name )
		 objects.push(object)
	});
	return objects;

}

THREE.Object3D.prototype.applyMaterial = function (material) {

	var len, i, meshes, material, mesh;

	meshes = PIKENG.TraverseObjectForGeometry(this);
	len = meshes.length;

	for (i=0; i<len; i++){

		mesh = meshes[i];
		mesh.material = material;
		if (mesh.lightMap && !material.lightMap) // Apply mesh lightmap if material doens't have one.
			mesh.material.lightMap = mesh.lightMap;
		if ( mesh.lightMapIntensity && !mesh.lightMapOverrideIntensity ) // Apply light map intensity
			material.lightMapIntensity = mesh.lightMapIntensity;

	}

}

THREE.Object3D.prototype.applyMaterialToId = function (material, id) {

	var len, i, meshes, material, mesh;

	meshes = PIKENG.TraverseObjectForGeometry(this);
	len = meshes.length;

	for (i=0; i<len; i++){

		mesh = meshes[i];
		if (mesh.materialId == id){
			if (!material.lightMap && mesh.lightMap) // Apply light map from the model if the material doens't have one.
				material.lightMap = mesh.lightMap;
			if ( mesh.lightMapIntensity && !mesh.lightMapOverrideIntensity ) // Apply light map intensity
				material.lightMapIntensity = mesh.lightMapIntensity;
			mesh.material = material;
			
		}
	}

}

THREE.Object3D.prototype.getMaterials = function () {

	var len, i, meshes, materials, mesh;

	materials = [];
	meshes = PIKENG.TraverseObjectForGeometry(this);
	len = meshes.length;

	for (i=0; i<len; i++){

		mesh = meshes[i];
		materials.push(mesh.material);

	}

	return materials;
}

// Override clone function, we also need to clone mat ids
THREE.Object3D.prototype.cloneThree = THREE.Object3D.prototype.clone;
THREE.Object3D.prototype.clone = function () {

	var clone = this.cloneThree();
	clone.lightMapIntensity = this.lightMapIntensity;
	clone.lightMap = this.lightMap;
	clone.materialId = this.materialId;
	return clone;

}

THREE.Mesh.prototype.cloneThree = THREE.Mesh.prototype.clone;
THREE.Mesh.prototype.clone = function () {

	var clone = this.cloneThree();
	clone.lightMapIntensity = this.lightMapIntensity;
	clone.lightMap = this.lightMap;
	clone.materialId = this.materialId;
	return clone;

}


var MOBOS = {

	UNKNOWN:    "unknown",
	WINDOWS:    "windows phone",
	ANDROID:    "android",
	IOS:        "ios",
	MobileOS:   null

}

PIKENG.frameQueue = 0;

PIKENG.RadialCamera = function () {

	/*
	Radius is set on the camera's x position
	Origin is the camera's container position
	Target what the cam container is facing and by extention the camera it's self.
	*/
	this.pivotObject = new THREE.Object3D();
	this.camera = new THREE.PerspectiveCamera( 32.2, 2, 1, 20000 );

	_radialCam = this;
	_position = new PIKENG.RadialPosition();

	Object.defineProperty(this, 'origin', {
		get :  function() {

			return _radialCam.pivotObject.position;

		},
		set :  function(val) {

			_position.origin = val;
			_radialCam.pivotObject.position.set(val.x, val.y, val.z);
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'target', {
		get :  function() {

			return _radialCam.pivotObject.rotation;

		},
		set :  function(val) {

			_position.target = val;
			_radialCam.pivotObject.rotation.set(
				val.x,
				val.y,
				val.z );
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'radius', {
		get :  function() {

			return -_radialCam.camera.position.x;

		},
		set :  function(val) {

			_position.radius = val;
			_radialCam.camera.position.x = -val;
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'position', {
		get :  function() {

			return new PIKENG.RadialPosition(
				_radialCam.pivotObject.position,
				_radialCam.pivotObject.rotation,
				-_radialCam.camera.position.x,
				_radialCam.camera.fov

			);

		},
		set :  function(val) {

			_radialCam.pivotObject.rotation.set(val.target.x, val.target.y, val.target.z);
			_radialCam.camera.position.x = -val.radius;
			_radialCam.pivotObject.position.set(val.origin.x, val.origin.y, val.origin.z);
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();
			_radialCam.camera.fov = val.fov;

		}

	});

	this.setPositionFromJson = function (jsonString) {

		var val = JSON.parse(jsonString);
		_radialCam.pivotObject.rotation.set(val.target._x, val.target._y, val.target._z);
		_radialCam.camera.position.x = -val.radius;
		_radialCam.pivotObject.position.set(val.origin.x, val.origin.y, val.origin.z);
		_radialCam.pivotObject.updateMatrixWorld();
		_radialCam.camera.updateMatrixWorld();
		_radialCam.camera.updateProjectionMatrix();

	}

	this.position.copy = function() {

		var origin = new THREE.Vector3(
			_radialCam.pivotObject.position.x,
			_radialCam.pivotObject.position.y,
			_radialCam.pivotObject.position.z
			);

		var target = new THREE.Vector3(
			_radialCam.pivotObject.rotation.x,
			_radialCam.pivotObject.rotation.y,
			_radialCam.pivotObject.rotation.z
			);

		return new RadialPosition(
			origin,
			target,
			-_radialCam.camera.position.x,
     		 _radialCam.camera.fov
		);

	};

	this.updateTarget = function () {

		_position.target = this.pivotObject.rotation;

	}

	this.set = function (origin, target, radius) {

		this.origin = origin;
		this.target = target;
		this.radius = radius;
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		_radialCam.pivotObject.updateMatrixWorld();
		_radialCam.camera.updateMatrixWorld();
		_radialCam.camera.updateProjectionMatrix();

	}

	this.pivotObject.add(this.camera);
	this.pivotObject.up = new THREE.Vector3(0,0,1);
	return this;

}

PIKENG.RadialPosition = function (origin, target, radius, fov) {

	this.type = 'RadialPosition';
	this.origin = origin || null;
	this.target = target || null;
	this.radius = radius || null;
  	this.fov = fov || null;

	this.copy = function () {

		var newOrigin = new THREE.Vector3(this.origin.x, this.origin.y, this.origin.z);
		var newTarget = new THREE.Euler(this.target.x, this.target.y, this.target.z);
		var newRadius = this.radius;
		var newFov = this.fov;

		return new PIKENG.RadialPosition(newOrigin, newTarget, newRadius, newFov);

	}

	this.clone = this.copy;

	return this;

}

var RadialCam = function ( ) {

	console.warn('Depricated, use PIKENG.RadialCamera instead');

	/*
	Radius is set on the camera's x position
	Origin is the camera's container position
	Target what the cam container is facing and by extention the camera it's self.
	*/
	this.pivotObject = new THREE.Object3D();
	this.camera = new THREE.PerspectiveCamera( 32.2, 2, 1, 20000 );

	_radialCam = this;
	_position = new PIKENG.RadialPosition();

	Object.defineProperty(this, 'origin', {
		get :  function() {

			return _radialCam.pivotObject.position;

		},
		set :  function(val) {

			_position.origin = val;
			_radialCam.pivotObject.position.set(val.x, val.y, val.z);
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'target', {
		get :  function() {

			return _radialCam.pivotObject.rotation;

		},
		set :  function(val) {

			_position.target = val;
			_radialCam.pivotObject.rotation.set(
				val.x,
				val.y,
				val.z );
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'radius', {
		get :  function() {

			return -_radialCam.camera.position.x;

		},
		set :  function(val) {

			_position.radius = val;
			_radialCam.camera.position.x = -val;
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();

		}

	});

	Object.defineProperty(this, 'position', {
		get :  function() {

			return new RadialPosition(
				_radialCam.pivotObject.position,
				_radialCam.pivotObject.rotation,
				-_radialCam.camera.position.x,
				_radialCam.camera.fov

			);

		},
		set :  function(val) {

			_radialCam.pivotObject.rotation.set(val.target.x, val.target.y, val.target.z);
			_radialCam.camera.position.x = -val.radius;
			_radialCam.pivotObject.position.set(val.origin.x, val.origin.y, val.origin.z);
			_radialCam.pivotObject.updateMatrixWorld();
			_radialCam.camera.updateMatrixWorld();
			_radialCam.camera.updateProjectionMatrix();
			_radialCam.camera.fov = val.fov;

		}

	});

	this.setPositionFromJson = function (jsonString) {

		var val = JSON.parse(jsonString);
		_radialCam.pivotObject.rotation.set(val.target._x, val.target._y, val.target._z);
		_radialCam.camera.position.x = -val.radius;
		_radialCam.pivotObject.position.set(val.origin.x, val.origin.y, val.origin.z);
		_radialCam.pivotObject.updateMatrixWorld();
		_radialCam.camera.updateMatrixWorld();
		_radialCam.camera.updateProjectionMatrix();

	}

	this.position.copy = function() {

		var origin = new THREE.Vector3(
			_radialCam.pivotObject.position.x,
			_radialCam.pivotObject.position.y,
			_radialCam.pivotObject.position.z
			);

		var target = new THREE.Vector3(
			_radialCam.pivotObject.rotation.x,
			_radialCam.pivotObject.rotation.y,
			_radialCam.pivotObject.rotation.z
			);

		return new RadialPosition(
			origin,
			target,
			-_radialCam.camera.position.x,
      _radialCam.camera.fov
		);

	};

	this.updateTarget = function () {

		_position.target = this.pivotObject.rotation;

	}

	this.set = function (origin, target, radius) {

		this.origin = origin;
		this.target = target;
		this.radius = radius;
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		_radialCam.pivotObject.updateMatrixWorld();
		_radialCam.camera.updateMatrixWorld();
		_radialCam.camera.updateProjectionMatrix();

	}

	this.pivotObject.add(this.camera);
	this.pivotObject.up = new THREE.Vector3(0,0,1);
	return this;

}

var RadialPosition = function (origin, target, radius, fov) {

	console.warn('Depricated, use PIKENG.RadialPosition instead');

	this.type = 'RadialPosition';
	this.origin = origin || null;
	this.target = target || null;
	this.radius = radius || null;
  	this.fov = fov || null;

	this.copy = function () {

		var newOrigin = new THREE.Vector3(this.origin.x, this.origin.y, this.origin.z);
		var newTarget = new THREE.Euler(this.target.x, this.target.y, this.target.z);
		var newRadius = this.radius;
		var newFov = this.fov;

		return new RadialPosition(newOrigin, newTarget, newRadius, newFov);

	}

	this.clone = this.copy;

	return this;

}

var PartitionedCube =  function ( size, partitions, defaultMaterial ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	// A cube has 6 faces, I know right...
	if ( !partitions )
		partitions = 1;

	var partitionSize = size/partitions;
	this.faces = [];
	this.meshes = [];

	// Positions and rotations for the planes that make up the cube faces.
	var planePos = [
		{ rot:{ x:0,             y:-Math.PI/2,  z:0 },      offset:{ x:size/2,   y:0,       z: 0 } }, // Right
		{ rot:{ x:0,             y:Math.PI/2,   z:0 },      offset:{ x:-size/2,  y:0,       z: 0 } }, // Left
		{ rot:{ x:Math.PI/2,     y:0,           z:0 },      offset:{ x:0,        y:size/2,  z: 0 } }, // Top
		{ rot:{ x:-Math.PI/2,    y:0,           z:0 },      offset:{ x:0,        y:-size/2, z: 0 } }, // Bottom
		{ rot:{ x:0,             y:0,           z:0 },      offset:{ x:0,        y:0,       z: -size/2 } }, // Front
		{ rot:{ x:0,             y:Math.PI,     z:0 },      offset:{ x:0,        y:0,       z: size/2 } }, // Rear
	];

	for ( var i=0; i<6; i++ ){

		var plane = new THREE.Group();
		var planeOffset = planePos[i].offset;
		var rot = planePos[i].rot;
		plane.position.set( planeOffset.x, planeOffset.y, planeOffset.z );
		plane.rotateX(rot.x);
		plane.rotateY(rot.y);
		plane.rotateZ(rot.z);
		this.faces.push(plane);

		// Create the tiles for each face.
		for ( var j=partitions-1; j>=0; j-- ){

			for ( var k=0; k<partitions; k++ ){

				var partition = new THREE.PlaneGeometry( partitionSize, partitionSize );
				var mesh = new THREE.Mesh( partition );
				if ( defaultMaterial )
					mesh.material = defaultMaterial;
				else
					mesh.material = new THREE.MeshBasicMaterial( { color:0x000, side:THREE.DoubleSide, wireframe:true } );
				mesh.position.set( k*size/partitions + size/(partitions*2) - size/2,
					j*size/partitions + size/(partitions*2) - size/2, 0 );
				plane.add(mesh);
				this.meshes.push(mesh);

			}
		}
	}

	return this;

}

PartitionedCube.prototype.AddTo = function ( object ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	var len = this.faces.length;
	var container = new THREE.Group();

	for ( var i=0; i<len; i++ ) {

		var face = this.faces[i];
		container.add(face);

	}
	this.container = container;
	object.add(this.container)

}

// Create a sube from 6 planes.

PartitionedCube.prototype.SetCubePartsFromCubeMap = function ( cubeMap ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	// Image splits are different from cube partitions, cube is split into faces first before tiling.
	var partitions = this.faces.length/6;
	var splitImage = PIKENG.SplitImage( cubeMap, 6*partitions, 1*partitions );

	for ( var i=1; i<this.faces.length+1; i++ ){

		for ( var j=0; j<partitions*partitions; j++ ){

			var cubePart = this.faces[i-1].children[j];
			var texture = new THREE.Texture( splitImage[(i-1)][j] );
			texture.needsUpdate = true;
			cubePart.material = new THREE.MeshBasicMaterial ( {map:texture} );

		}

	}

}

PartitionedCube.prototype.cursorLocationOnTile = function (  ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	var raycaster = pikeng.RaycasterFromMouse();
	var intersects = raycaster.intersectObjects(this.meshes);

	if ( intersects.length > 0 ) {

		var intersect = intersects[0];
		var intersectMesh = intersects[0].object;

		var ilen = this.faces.length;
		for ( var i=0; i<ilen; i++ ) {

			var cubeFace = this.faces[i];
			var jlen = cubeFace.children.length;

			for ( var j=0; j<jlen; j++ ){

				var tile = cubeFace.children[j];
				if ( tile === intersectMesh ){

					if ( !tile.geometry.boundingBox )
						tile.geometry.computeBoundingBox();

					var position = tile.getWorldPosition();
					var offset = position.addScaledVector( intersect.point, -1 );

					var xPos, yPos;
					// detmine which part of the offset represents tile x and y.
					var tileHeight = tile.geometry.boundingBox.max.y - tile.geometry.boundingBox.min.y;
					var tileWidth = tile.geometry.boundingBox.max.x - tile.geometry.boundingBox.min.x;
					if ( cubeFace.position.x > 0 ){

						xPos = 50 - 100*offset.z/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}else if ( cubeFace.position.x < 0 ) {

						xPos = 50 + 100*offset.z/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}else if ( cubeFace.position.y > 0 ){

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.z/tileHeight;

					}else if ( cubeFace.position.y < 0 ) {

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 - 100*offset.z/tileHeight;

					}else if ( cubeFace.position.z > 0 ) {

						xPos = 50 + 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					} else if ( cubeFace.position.z < 0 ) {

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}

					return { face:i, tile:j, x:xPos, y:yPos };

				}

			}

		}

	}else {

		console.log('Something went wrong, couldn\'t find any intersects');

	}

}

PartitionedCube.prototype.cursorLocationOnFace = function (  ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	var tilePos = this.cursorLocationOnTile();
	var cubeFace = this.faces[0];
	var faceHeight = Math.sqrt(cubeFace.children.length); // How many tiles high is a face, width is the same.

	var tileYPos = ~~tilePos.tile/faceHeight;
	var tileXPos = tilePos.tile%faceHeight;
	var tilePercentage = 100/faceHeight;

	var faceXPos = tileXPos*tilePercentage + tilePos.x/faceHeight;
	var faceYPos = tileYPos*tilePercentage + tilePos.y/faceHeight;

	console.log( tilePos.face, faceXPos, faceYPos );
	return { face:tilePos.face, x:faceXPos, y:faceYPos};

}

PartitionedCube.prototype.getTile = function ( face, x, y ) {

	console.warn('Depricated, use PIKENG.PartitionedCube instead');

	var face = this.faces[face];
	var faceHeight = Math.sqrt(face.children.length);
	var tile = face.children[x*faceHeight+y];

	return tile;

}


PIKENG.RemoveModelWithNameFromObject = function ( modelName, target ){

	var object = target.getObjectByName( modelName );
	if (object) {

		target.remove(object);
		//object.geometry.dispose();
		object = undefined;

	}

}

PIKENG.PartitionedCube = function ( size, partitions, defaultMaterial ) {

	// A cube has 6 faces, I know right...
	if ( !partitions )
		partitions = 1;

	var partitionSize = size/partitions;
	this.faces = [];
	this.meshes = [];

	// Positions and rotations for the planes that make up the cube faces.
	var planePos = [
		{ rot:{ x:0,             y:-Math.PI/2,  z:0 },      offset:{ x:size/2,   y:0,       z: 0 } }, // Right
		{ rot:{ x:0,             y:Math.PI/2,   z:0 },      offset:{ x:-size/2,  y:0,       z: 0 } }, // Left
		{ rot:{ x:Math.PI/2,     y:0,           z:0 },      offset:{ x:0,        y:size/2,  z: 0 } }, // Top
		{ rot:{ x:-Math.PI/2,    y:0,           z:0 },      offset:{ x:0,        y:-size/2, z: 0 } }, // Bottom
		{ rot:{ x:0,             y:0,           z:0 },      offset:{ x:0,        y:0,       z: -size/2 } }, // Front
		{ rot:{ x:0,             y:Math.PI,     z:0 },      offset:{ x:0,        y:0,       z: size/2 } }, // Rear
	];

	for ( var i=0; i<6; i++ ){

		var plane = new THREE.Group();
		var planeOffset = planePos[i].offset;
		var rot = planePos[i].rot;
		plane.position.set( planeOffset.x, planeOffset.y, planeOffset.z );
		plane.rotateX(rot.x);
		plane.rotateY(rot.y);
		plane.rotateZ(rot.z);
		this.faces.push(plane);

		// Create the tiles for each face.
		for ( var j=partitions-1; j>=0; j-- ){

			for ( var k=0; k<partitions; k++ ){

				var partition = new THREE.PlaneGeometry( partitionSize, partitionSize );
				var mesh = new THREE.Mesh( partition );
				if ( defaultMaterial )
					mesh.material = defaultMaterial;
				else
					mesh.material = new THREE.MeshBasicMaterial( { color:0x000, side:THREE.DoubleSide, wireframe:true } );
				mesh.position.set( k*size/partitions + size/(partitions*2) - size/2,
					j*size/partitions + size/(partitions*2) - size/2, 0 );
				plane.add(mesh);
				this.meshes.push(mesh);

			}
		}
	}

	return this;

}

PIKENG.PartitionedCube.prototype.AddTo = function ( object ) {

	var len = this.faces.length;
	var container = new THREE.Group();

	for ( var i=0; i<len; i++ ) {

		var face = this.faces[i];
		container.add(face);

	}
	this.container = container;
	object.add(this.container)

}

// Create a sube from 6 planes.

PIKENG.PartitionedCube.prototype.SetCubePartsFromCubeMap = function ( cubeMap ) {

	// Image splits are different from cube partitions, cube is split into faces first before tiling.
	var partitions = this.faces.length/6;
	var splitImage = PIKENG.SplitImage( cubeMap, 6*partitions, 1*partitions );

	for ( var i=1; i<this.faces.length+1; i++ ){

		for ( var j=0; j<partitions*partitions; j++ ){

			var cubePart = this.faces[i-1].children[j];
			var texture = new THREE.Texture( splitImage[(i-1)][j] );
			texture.needsUpdate = true;
			cubePart.material = new THREE.MeshBasicMaterial ( {map:texture} );

		}

	}

}

PIKENG.PartitionedCube.prototype.cursorLocationOnTile = function (  ) {

	var raycaster = pikeng.RaycasterFromMouse();
	var intersects = raycaster.intersectObjects(this.meshes);

	if ( intersects.length > 0 ) {

		var intersect = intersects[0];
		var intersectMesh = intersects[0].object;

		var ilen = this.faces.length;
		for ( var i=0; i<ilen; i++ ) {

			var cubeFace = this.faces[i];
			var jlen = cubeFace.children.length;

			for ( var j=0; j<jlen; j++ ){

				var tile = cubeFace.children[j];
				if ( tile === intersectMesh ){

					if ( !tile.geometry.boundingBox )
						tile.geometry.computeBoundingBox();

					var position = tile.getWorldPosition();
					var offset = position.addScaledVector( intersect.point, -1 );

					var xPos, yPos;
					// detmine which part of the offset represents tile x and y.
					var tileHeight = tile.geometry.boundingBox.max.y - tile.geometry.boundingBox.min.y;
					var tileWidth = tile.geometry.boundingBox.max.x - tile.geometry.boundingBox.min.x;
					if ( cubeFace.position.x > 0 ){

						xPos = 50 - 100*offset.z/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}else if ( cubeFace.position.x < 0 ) {

						xPos = 50 + 100*offset.z/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}else if ( cubeFace.position.y > 0 ){

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.z/tileHeight;

					}else if ( cubeFace.position.y < 0 ) {

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 - 100*offset.z/tileHeight;

					}else if ( cubeFace.position.z > 0 ) {

						xPos = 50 + 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					} else if ( cubeFace.position.z < 0 ) {

						xPos = 50 - 100*offset.x/tileWidth;
						yPos = 50 + 100*offset.y/tileHeight;

					}

					return { face:i, tile:j, x:xPos, y:yPos };

				}

			}

		}

	}else {

		console.log('Something went wrong, couldn\'t find any intersects');

	}

}

PIKENG.PartitionedCube.prototype.cursorLocationOnFace = function (  ) {

	var tilePos = this.cursorLocationOnTile();
	var cubeFace = this.faces[0];
	var faceHeight = Math.sqrt(cubeFace.children.length); // How many tiles high is a face, width is the same.

	var tileYPos = ~~tilePos.tile/faceHeight;
	var tileXPos = tilePos.tile%faceHeight;
	var tilePercentage = 100/faceHeight;

	var faceXPos = tileXPos*tilePercentage + tilePos.x/faceHeight;
	var faceYPos = tileYPos*tilePercentage + tilePos.y/faceHeight;

	console.log( tilePos.face, faceXPos, faceYPos );
	return { face:tilePos.face, x:faceXPos, y:faceYPos};

}

PIKENG.PartitionedCube.prototype.getTile = function ( face, x, y ) {

	var face = this.faces[face];
	var faceHeight = Math.sqrt(face.children.length);
	var tile = face.children[x*faceHeight+y];

	return tile;

}

PIKENG.TraverseObjectForVerts = function ( object ) {

	var verts = 0;

	if ( object.children )
		if ( object.children.length > 0 )
			for ( var i=0; i<object.children.length; i++) {
				verts += PIKENG.TraverseObjectForVerts (object.children[i]);
			}

	if ( object.type == 'Mesh' ){

		if ( object.geometry.vertices )
			verts += object.geometry.vertices.length;
		else if ( object.geometry.attributes )
			verts += object.geometry.attributes.position.array.length/3;

	}

	return verts;

}

PIKENG.TraverseObjectForGeometry = function ( object ) {

	var meshes = [];

	if ( object.children )
		if ( object.children.length > 0 )
			for ( var i=0; i<object.children.length; i++) {
				meshes = meshes.concat(PIKENG.TraverseObjectForGeometry (object.children[i]));
			}

	if ( object.geometry )
		meshes.push(object);

	return meshes;

}

PIKENG.loadingManager = function ( engine ){

	this.debug = false;
	this.loading = 0;
	this.successes = 0;
	this.fails = 0;
	this.finished = 0;
	this.callback = null;
	this.data = null;
	this.engine = engine || null;

	this.reset = function(){

		this.loading = 0;
		this.successes = 0;
		this.fails = 0;
		this.finished = 0;
		if (this.debug)
			console.log("Reseting Laoding Manager");

	};

	this.succeeded = function (){

		this.loading--;
		this.successes++;
		this.finished++;
		if (this.debug)
			console.log("Successes: " + this.successes);
		if (this.loading == 0)
			this.loadingCompleted(this.data);

	};

	this.failed = function(){

		this.loading--;
		this.fails++;
		this.finished++;
		if (this.debug)
			console.log("Failed: " + this.fails);
		if (this.loading == 0)
			this.loadingCompleted(this.data);

	};

	this.load = function( path, parameters, completed, progress, failed ){

		var self = this;
		var extSplit, folderSplit, ext, type;
		parameters = parameters || {};

		// Check there's an engine set.
		if (path && this.engine){

			// Work out what loader to use based on the file extention.
			extSplit = path.split(".");
			ext = extSplit[extSplit.length-1];
			if ( ext == "json" ){

				// Is it a material or model json? Split the rest of the path by folders.
				folderSplit = extSplit[extSplit.length-2].split("/");
				type = folderSplit[folderSplit.length-1];
				if (type == "material" ){

					this.engine.LoadMaterialFromJSON(
						path,
						function (e){

							if (completed)
								completed(e);
							self.succeeded();

						},
						function (e){

							if(progress)
								progress(e);

						},
						function(e){

							if (failed)
								failed(e);
							self.failed();

						});

				}else if ( type == "model" ){

					this.engine.LoadModelsFromJSON(
						path,
						parameters.name,
						parameters.parentName,
						function (e){

							if (completed)
								completed(e);
							self.succeeded();

						},
						function (e){

							if(progress)
								progress(e);

						},
						function(e){

							if (failed)
								failed(e);
							self.failed();

						});

				}else{

					console.warn("JSON type not supported, needs to be a model or a material");

				}

			}else{

				console.warn("File extention now recognised");

			}

		}else if( path && !this.engine ){

			console.warn("There needs to be an engine set in the loader if you want to load a file");

		}

		this.loading++;
		if (this.debug)
			console.log("Loading: " + this.loading);

	};

	this.loadingCompleted = function (data){

		if (this.debug)
			console.log("Loading completed");
		if (this.callback)
			this.callback(data);

  }
};
PIKENG.LoadingManager = new PIKENG.loadingManager();

PIKENG.getJSON = function(url, callback) {

	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'json';

	xhr.onload = function() {

		var status = xhr.status;
		if (status === 200)
			callback(null, xhr.response);
		else
			callback(status, xhr.response);

	};
	xhr.send();

};

PIKENG.Animation = function( engine, parameter, startVal, endVal, duration, type ) {

	if ( typeof parameter === 'object' ){

		startVal = parameter.startVal;
		endVal = parameter.endVal;
		duration = parameter.duration;
		type = parameter.type;


	}

	this.engine = engine;
	this.AnimationTypes = { default:"sinusiodal", sinusiodal:"sinusiodal", linear:"linear" };

	if( typeof parameter === "string" || parameter instanceof String )
		this.parameter = parameter;
	else
		throw "parameter must be a string";

	if ( isNaN(startVal) )
		throw "startVal must be a number";
	else
		this.startVal = startVal;

	if ( isNaN(endVal) )
		throw "endVal must be a number";
	else
		this.endVal = endVal;

	if ( isNaN(duration) && duration != undefined )
		throw "duration must be a number";
	else
		this.duration = duration;

	if ( type == null || type == undefined )
		this.type = this.AnimationTypes.default;
	else
		this.type = type;

	this.startTime = null;
	this.endTime = null;
	this.target = null;
	this.completed = null;

	return this;

};

/*
Execute the animation on a target object by adding it to the Animations list.
*/

PIKENG.Animation.prototype.Execute = function ( target, completed ) {

	this.target = target;
	this.startTime = Date.now();
	this.endTime = this.startTime + this.duration * 1000;
	this.completed = completed;

	if (!target.animations){

		target.animations = [];

	}

	// If this target's paramter is already being animated then
	for (var i=0; i<target.animations.length; i++){

		if (this.parameter == target.animations[i].parameter)
			target.animations[i].Halt();

	}

	target.animations.push(this);
	this.engine.Animations.push(this);

}

PIKENG.Animation.prototype.Run = function ( target, start, end ) {

	this.target = target;
	this.startTime = start;
	this.endTime = end;
	this.engine.Animations.push(this);

}

/*
Calculate the frame position at a given time and set the target's parameter value to the computed value.
*/

PIKENG.Animation.prototype.setFrame = function ( time ) {

	var frameVal;

	// Set parameter to end val if the time is passed the end time of the Animation.
	if (time >= this.endTime) {

		frameVal = this.endVal;
		if (this.target.animations)
			PIKENG.RemoveObjectFromArray( this, this.target.animations );
		PIKENG.RemoveObjectFromArray( this, this.engine.Animations );

		if ( this.target instanceof Array ){

			for (var i=0; i<this.target.length; i++){

		  		this.target[i][this.parameter] = frameVal;

			}

		}else
			this.target[this.parameter] = frameVal;


		PIKENG.RemoveObjectFromArray(this, this.engine.Animations);

		if ( this.completed ){
			this.completed();
		}

		return frameVal;

	// Do nothing if the time isn't yet passed the start time.
	}else if(time <= this.startTime){

		frameVal = null;
		return frameVal;

	// Compute sinusiodal frame position.
	}else if ( this.type == this.AnimationTypes.sinusiodal ){

		var dt = Date.now()-this.startTime;
		var T = this.endTime - this.startTime;
		var x = this.endVal-this.startVal;
		var dx = x*(1+Math.sin((dt/T)*Math.PI-Math.PI/2))/2;
		frameVal = this.startVal + dx;

	}else if( this.type == this.AnimationTypes.linear ){

		var dt = Date.now()-this.startTime;
		var T = this.endTime - this.startTime;
		var x = this.endVal-this.startVal;
		var dx = (dt/T)*x;
		frameVal = this.startVal + dx;

	}

	// Could implement linear and quadratic Animations here at some point.

 	if ( this.target instanceof Array ){

		for (var i=0; i<this.target.length; i++){

	  		this.target[i][this.parameter] = frameVal;

		}

	}else
		this.target[this.parameter] = frameVal;

	return frameVal;

}

/*
Cancel the Animation and set it to it's start value.
*/

PIKENG.Animation.prototype.Cancel = function ( ) {

	this.target[this.parameter] = this.startVal;
	PIKENG.RemoveObjectFromArray( this, this.target.animations );
	PIKENG.RemoveObjectFromArray( this, this.engine.Animations );

}

/*
Cancel the Animation and set it to it's end value.
*/

PIKENG.Animation.prototype.Finish = function ( ) {

	this.target[this.parameter] = this.endVal;
	PIKENG.RemoveObjectFromArray( this, this.target.animations );
	PIKENG.RemoveObjectFromArray( this, this.engine.Animations );

}

/*
Cancel the Animation at it's current position;
*/

PIKENG.Animation.prototype.Halt = function ( ) {

	PIKENG.RemoveObjectFromArray( this, this.target.animations );
	PIKENG.RemoveObjectFromArray( this, this.engine.Animations );

}

/*
 * object.watch polyfill
 *
 * 2012-04-03
 *
 * By Eli Grey, http://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

// object.watch
if (!Object.prototype.watch) {
	Object.defineProperty(Object.prototype, "watch", {
		  enumerable: false
		, configurable: true
		, writable: false
		, value: function (handler) {
			var
			  oldval = this
			, newval = oldval
			, getter = function () {
				return newval;
			}
			, setter = function (val) {
				oldval = newval;
				return newval = handler.call(this, oldval, val);
			}
			;
		}
	});
}
