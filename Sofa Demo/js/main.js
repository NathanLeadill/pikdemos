class Sofa {
  constructor () {
    this.pikeng = new PIKENG(); // Create a local reference to the Pikeng object
    this.pikeng.Canvas = document.getElementById('canvas'); // Set Canvas
    this.pikeng.MATERIALS = {};
    this.modelManager = new PIKENG.loadingManager(this.pikeng);
    this.materialManager = new PIKENG.loadingManager(this.pikeng);
    const materials, model
    this.modelManager.callback = () => {
      this.loadMaterials();
      this.materialManager.callback = () => {
        this.applyMaterials();
        this.pikeng.NormaliseCamera();
        this.pikeng.RadialCam.radius = 5250;
        this.pikeng.RadiusMax = 5250; //5250;
        this.pikeng.RadiusMin = 2000;
        this.pikeng.Render();
        this.pikeng.CanvasResized();
        this.addListeners();


      }
    }
    let canvas = document.getElementById('canvas');
    let ctx = canvas.getContext('webgl');
  }

  loadModels () {
    this.loadModel('sofa', 'res/models/BASE_01/model.json');
  }

  loadModel (name, location) {
    let self = this;

    this.modelManager.load(location, {name: name}, (model) => {
      // const defaultColor = t

    })
  }

  loadMaterials () {
    this.colorNames.forEach((color, index, array) => {
      this.materialManager.load('res/materials/' + color + '/material.json', null, (mat) => {
        this.pikeng.MATERIALS[color] = mat;
      });
    });
  }

  applyMaterials () {

  }
}


let sofa = new Sofa();

pikcellsapi.materials = ['test'];
pikcellsapi.models =   ['test'];
