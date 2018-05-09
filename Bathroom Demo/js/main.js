class PikDemoAPI {
  constructor () {
    this.pikeng           = new PIKENG(); // Create a local reference to the Pikeng object
    this.pikeng.Canvas    = document.getElementById('canvas'); // Set Canvas

    this.pikeng.MATERIALS = {};

    this.MATERIALS        = {};
    this.MODELS           = {};
    this.OBJECTS          = {};
    this.WHEELS           = [];
    this.TARGETS          = {};
    this.RADIALS          = {};
    this.POSITIONS        = {};
    this.MODELGROUPS      = {};
    this.DEFAULTS         = {};

    this.cameraWobbling   = false;

    this._reflectionCube  = null;
    this.modelManager     = new PIKENG.loadingManager(this.pikeng);
    this.materialManager  = new PIKENG.loadingManager(this.pikeng);
    this.readSceneFile();

    this.pikeng.RenderCallback = () => {
      PIKENG.frameQueue++;
      let wheelKeys   = Object.keys(this.POSITIONS).map(key => this.POSITIONS[key]);
      let wheelValues = Object.values(this.POSITIONS).map(key => this.POSITIONS[key]);
      wheelKeys.forEach((a,b,c) => {
        $('#' + Object.keys(this.RADIALS)[b]).css('left', this.toScreenPosition(a, this.pikeng.RadialCam.camera).x - 256).css('top', this.toScreenPosition(a, this.pikeng.RadialCam.camera).y - 174).css('position', 'absolute');
      });
    }

  }

  toScreenPosition (vector, camera) {
    let vec3 = new THREE.Vector3(vector.x,vector.y,vector.z)
    // To Convert to screen space on the canvas!
    vec3.project( this.pikeng.RadialCam.camera );

    var screenPos = new THREE.Vector2(
      parseFloat(((   vec3.x + 1 ) * this.pikeng.Canvas.width))/ 2,
      parseFloat((( - vec3.y + 1 ) * this.pikeng.Canvas.height))/ 2
    );
  return screenPos;
  };

  setupEnvironment() {
    this.loadModels();
    this.modelManager.callback = () => {
      this.loadMaterials();
      this.materialManager.callback = () => {
        this.applyMaterials();
        this.pikeng.NormaliseCamera();
        this.pikeng.RadialCam.radius = 8000;
        this.pikeng.RadiusMax = 8000;
        this.pikeng.RadiusMin = 2000;
        this.pikeng.RadialCam.target = {'x':1.57,'y':8.051649231478851,'z':-0.1519800800808339};
        this.pikeng.RadialCam.origin = {x: 1083.0872341972836, y: 400.6183833701236, z: -1275.3081473775828};
        this.pikeng.Render();
        this.pikeng.CanvasResized();
        this.addListeners();
        this.pikeng.LoadLightingFromJson( "res/models/lighting/lighting.json" );
      }
    }
    let canvas = document.getElementById('canvas');
    let ctx = canvas.getContext('webgl');


  }

  addListeners () {
    $('.back').click(() => {
  window.location.href = '/demos/listings.php'
});
  }

  addSVGPattern (svg, id, material) {
    let svgNS = svg.namespaceURI;
    let pattern = document.createElementNS(svgNS, 'pattern');

    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', 500);
    pattern.setAttribute('height', 500);


    let image = document.createElementNS(svgNS, 'image');
    image.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href', 'res/materials/' + material + '/diffuse.jpg');
    image.setAttribute('x', 0);
    image.setAttribute('y', 0);
    image.setAttribute('width', 500);
    image.setAttribute('height', 500);

    pattern.appendChild(image);

    let defs = svg.querySelector('defs') ||
    svg.insertBefore( document.createElementNS(svgNS,'defs'), svg.firstChild);

    return defs.appendChild(pattern);
  }
   _getOrCreateReflectionCube ( ) {
  		// Are we returning our cached cube?
  		if (this._reflectionCube) {
  			return this._reflectionCube;
      // If not return a new cube handled by THREE.CubeTextureLoader
  		} else {

  			var path = '/cubes/';
  			var format = '.jpg';
  			var urls = [
  					'nx' + format, 'px' + format,
  					'ny' + format, 'pz' + format,
  					'nz' + format, 'py' + format
  				];
  			this._reflectionCube = new THREE.CubeTextureLoader()
  		        .setPath( path )
      			.load( urls );

  			return this._reflectionCube;
  		}
  	}
  readFile (file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function() {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    }
    rawFile.send(null);
  }

  readSceneFile () {
    this.readFile("res/scene.json", (text) => {
      var data = JSON.parse(text);
      this.MATERIALS   = data.materials;
      this.MODELS      = data.models;
      this.TARGETS     = data.modelTargets;
      this.WHEELS      = data.wheels;
      this.DEFAULTS    = data.modelDefaults;
      this.setupEnvironment();
      this.createWheels(this.WHEELS);
      $('.wheel svg').attr('viewBox', '0 0 512 512');
    });
  }

  createWheels (wheels) {
    console.log(wheels);
    wheels = Object.keys(wheels).map(key => wheels[key]);
    wheels.forEach((a,b,c) => {
      console.log(a);
      if(a.type == 'model') this.createModelWheel(a);
      else this.createColorWheel(a);
    });
  }

  createColorWheel (wheel) {
    let wheelPos   = wheel.position;

    this.RADIALS[wheel.name] = new RadialMenu(wheel.name,wheel.wheelLabels);
    this.RADIALS[wheel.name].slices = wheel.availableMaterials;
    this.RADIALS[wheel.name].loadParameters();
    this.RADIALS[wheel.name].textured = true;
    this.RADIALS[wheel.name].lineEnd = wheel.lineEnd;
    this.RADIALS[wheel.name].lineStart = wheel.position;
    console.log(this.RADIALS[wheel.name]);
    if(wheel.multiModel) this.RADIALS[wheel.name].activeModel = wheel.activeModel;

    this.RADIALS[wheel.name].onClicked =  (e,  index) => {
      let activeSlice = this.RADIALS[wheel.name].slices[index];
      if(wheel.targetModels.models.length > 0)
      {
        wheel.targetModels.models.forEach((a,b,c) => {
          let model = this.pikeng.GetObjectNamed(a);
          model.applyMaterial(this.pikeng.MATERIALS[activeSlice].clone());
        });
      }
      if(wheel.targetModels.modelGroups.length > 0)
      {
        wheel.targetModels.modelGroups.forEach((a,b,c) => {
          let model = this.pikeng.GetObjectNamed(this.MODELGROUPS[a].activeModel);
          this.MODELGROUPS[a].activeColor = activeSlice;
          model.applyMaterial(this.pikeng.MATERIALS[activeSlice].clone());
        });
      }

      PIKENG.frameQueue++;
    }
    wheel.targetModels.modelGroups.forEach((a,b,c) => {
      this.MODELGROUPS[a].activeColor = wheel.availableMaterials[0];
    });
    this.setupWheelTextures(wheel.name, this.RADIALS[wheel.name].wheel.navItemCount);
    this.POSITIONS[wheel.name]    = new THREE.Vector3(wheelPos[0],wheelPos[1],wheelPos[2]);
  }

  createModelWheel (wheel) {
    let wheelPos = wheel.position;
    this.MODELGROUPS[wheel.modelGroup] = [];
    this.RADIALS[wheel.name] = new RadialMenu(wheel.name, wheel.wheelLabels);
    // this.RADIALS[wheel.name].colors = wheel.availableMaterials;
    this.RADIALS[wheel.name].slices = wheel.wheelLabels;
    this.RADIALS[wheel.name].loadParameters();
    this.RADIALS[wheel.name].textured = true;
    this.RADIALS[wheel.name].activeModel = wheel.activeModel;
    this.RADIALS[wheel.name].onClicked =  (e,  index) => {
      let activeSlice  = this.RADIALS[wheel.name].slices[index];
      let newModel     = wheel.availableModels[index];
      this.pikeng.RemoveModelNamed(this.RADIALS[wheel.name].activeModel);
      this.pikeng.LoadModelsFromJSON('res/models/' + newModel + '/model.json', newModel, null, () => {
        this.RADIALS[wheel.name].activeModel = newModel;
        PIKENG.frameQueue++;
        this.MODELGROUPS[wheel.modelGroup].activeModel = newModel;
        if(this.MODELGROUPS[wheel.modelGroup].activeColor)
        {
          let model = this.pikeng.GetObjectNamed(this.MODELGROUPS[wheel.modelGroup].activeModel);
          model.applyMaterial(this.pikeng.MATERIALS[this.MODELGROUPS[wheel.modelGroup].activeColor].clone());
        }
        else
        {
          this.DEFAULTS.forEach((a,b,c) => {
            let group = Object.keys(a);
            let material = Object.values(a);
            if(group[0] == wheel.modelGroup)
            {
              let model = this.pikeng.GetObjectNamed(this.MODELGROUPS[wheel.modelGroup].activeModel);
              model.applyMaterial(this.pikeng.MATERIALS[material].clone());
            }
            console.log(group[0]);
          });
        }
      });

    }
    this.MODELGROUPS[wheel.modelGroup].activeModel = wheel.activeModel;
    // this.setupWheelTextures(wheel.name, this.RADIALS[wheel.name].wheel.navItemCount);
    this.POSITIONS[wheel.name]    = new THREE.Vector3(wheelPos[0],wheelPos[1],wheelPos[2]);

  }


  setupWheelTextures (id,count) {
    for(let i = 0; i < count; i++)
    {
      let material = this.WHEELS[id].availableMaterials[i];
      let pattern = document.getElementsByTagName('svg')[0];
      this.addSVGPattern(pattern, 'wheelnav-' + id + '-slice-' + i + '-pattern', material)
      $('#wheelnav-' + id + '-slice-' + i + '').attr('fill', 'url(#' + 'wheelnav-' + id + '-slice-' + i + '-pattern' + ')');
    }
  }

  loadModels () {
    this.MODELS.forEach((model, index, array) => {
      this.loadModel(model, 'res/models/' + model + '/model.json');
    });
  }

  loadModel (name, location) {
    this.modelManager.load(location, {name: name}, (model) => {
      console.log('loaded');
    })
  }

  loadMaterials () {
    this.MATERIALS.forEach((material, index, array) => {
      this.loadMaterial(material, 'res/materials/' + material + '/material.json');
    });
  }

  loadMaterial (name, location) {
    this.materialManager.load(location, null, (mat) => {
      this.pikeng.MATERIALS[name] = mat;
      mat.envMap = this._getOrCreateReflectionCube();

    });
  }

  applyMaterials () {
    this.MATERIALS.forEach((material, index, array) => {
      if(this.TARGETS[material] !== undefined) {
        this.TARGETS[material].forEach((themodel, index, array) => {
          let model = Object.keys(themodel)[0];
          let id = Object.values(themodel)[0];
          let object = this.pikeng.GetObjectNamed(model);
          if(id == -1) object.applyMaterial(this.pikeng.MATERIALS[material].clone());
          else object.applyMaterialToId(this.pikeng.MATERIALS[material].clone(), id);
        });
      }
    });

  }

  startCameraWobble(size, duration)
  {
		if ( this.cameraWobbling == true )
			return;
		duration = duration || 3;
		size = size || 0.2;
		let positions = [];

		let startPos = this.pikeng.GetCameraViewData();
		let endPos = startPos.clone();

		endPos.target.z = endPos.target.z - size;
		positions.push(endPos.clone());

		endPos.target.z = startPos.target.z + size*Math.sin(Math.PI/6);
		endPos.target.y = startPos.target.y - size*Math.cos(Math.PI/6);
		positions.push(endPos.clone());

		endPos.target.z = startPos.target.z + size*Math.sin(Math.PI/6);
		endPos.target.y = startPos.target.y + size*Math.cos(Math.PI/6);
		positions.push(endPos.clone());

		this.wobbleCamera(positions, duration);
	}

  wobbleCamera(positions, duration, i)
  {
		i = i || 0;
		let startPos = this.pikeng.GetCameraViewData();
		if (this.pikeng.CameraAnimation != null)
			return; // If there is already an animation working then forget it.
		this.pikeng.AnimateCamera(startPos, positions[i], duration, () =>{
			this.wobbleCamera(positions, duration,i);
		});
		this.cameraWobbling = true;
		i++;
		if (i > positions.length-1)
			i=0;
  }
}

let pda = new PikDemoAPI();
