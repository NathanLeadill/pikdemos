if ( THREE.POPSLoader === undefined ) { THREE.POPSLoader = {} }

THREE.POPSLoader = function () {

	var POPSLoader_VERSION = "0.1";
	var parameters = null;

	function POPSLoader( manager ) {

		console.log( "Using THREE.POPSLoader version: " + POPSLoader_VERSION );
		this.manager = Validator.verifyInput( manager, THREE.DefaultLoadingManager );

	};

}

THREE.POPSLoader.prototype = {
	TWO_POW_32_MINUS_1: Math.pow(2, 32)-1,
	TWO_POW_31: Math.pow(2, 31),
	constructor:THREE.POPSLoader,
	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;
		var oReq = new XMLHttpRequest();

		oReq.addEventListener("progress", onProgress);
		oReq.addEventListener("load", onComplete);
		oReq.addEventListener("error", onError);
		oReq.open("GET", url);
		oReq.responseType = "arraybuffer";

		function onComplete(evt) {

		  var arrayBuffer = oReq.response;
		  if (arrayBuffer) {
		    var byteArray = new Uint8Array(arrayBuffer);
		    var dataStream = scope.dataStream(byteArray);
		    var file = scope.parse(dataStream);
		   	var models = scope.getModelsForScene(file);
		    onLoad(models);
		  }

		}

		oReq.send();

	},
	parse: function ( dataStream ) {
		// Check for format identifier
		if ( dataStream.readInt32() != 1347375187 ){
			console.log("Error, this format can't be idinfied as POPS format!");
			return;
		}
		var header = this.readHeader(dataStream);
		var body = this.readBody(header, dataStream);
		return {
			header:header, 
			body:body
		};
	},
	readHeader: function( dataStream ){
		var header = {};
		header.formatVersion = dataStream.readInt32();
		header.modelCount = dataStream.readInt32();
		header.cameraCount = dataStream.readInt32();
		header.upAxis = {
			x:dataStream.readFloat32(),
			y:dataStream.readFloat32(),
			z:dataStream.readFloat32(),
		};
		return header;
	},
	readBody: function( header, dataStream ){

		var j, modelHeader, modelBody, leni, lenj;
		var body = [];
		leni = header.modelCount;
		for (var i=0; i<leni; i++){

			modelHeader = this.readModelHeader(dataStream);
			modelBody = this.readModelBody(dataStream, modelHeader);
			body.push(modelBody);

		}

		return body;

	},
	getModelsForScene: function (file){

		var body = file.body;
		var i, len, models;
		models = [];
		len = body.length;
		for (i=0; i<len; i++){

			var model = body[i];
			var heirarchy = this.constructMeshHierarchy(model, file.header);
			models.push(heirarchy);

		}

		return models;

	},
	constructMeshHierarchy:function (model, fileHeader){
		var parent, i;
		if (model.indices.length == 0 || model.positions == 0){
			parent = new THREE.Object3D();
		}else{

			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute( 'position', new THREE.BufferAttribute( model.positions, 3, false ) );
			geometry.setIndex( new THREE.BufferAttribute( model.indices, 1 ) );
			geometry.computeVertexNormals();
			
			parent = new THREE.Mesh(geometry, PIKENG.WireframeMat);

			var len = model.children.length;
			for ( i=0; i<len; i++ ){
				var child = constructMeshHierarchy(model.children[i], fileHeader);
				parent.add(child);
			}

		}
		//parent.up = fileHeader.upAxis;
		//parent.matrix.elements = model.header.matrix.elements;
		return parent;
	},
	readModelHeader: function (dataStream){
		var modelHeader = {
			vertCount: dataStream.readInt32(),
			vertMin: {
				x:dataStream.readFloat32(),
				y:dataStream.readFloat32(),
				z:dataStream.readFloat32()
			},
			vertMax: {
				x:dataStream.readFloat32(),
				y:dataStream.readFloat32(),
				z:dataStream.readFloat32()
			},
			faceCount:dataStream.readInt32(),
			normals:dataStream.readByte(),
			matrix:dataStream.readMatrix4(),
			children:dataStream.readInt32()
		}
		console.log(modelHeader);
		return modelHeader;
	},
	readModelBody: function (dataStream, modelHeader ){

		var pos = [0,0,0];
		var modelBody = {
			header:modelHeader,
			indices:[],
			positions:[],
			children:[]
		}
		var gridSize = {
			x:(modelHeader.vertMax.x - modelHeader.vertMin.x)/this.TWO_POW_32_MINUS_1,
			y:(modelHeader.vertMax.y - modelHeader.vertMin.y)/this.TWO_POW_32_MINUS_1,
			z:(modelHeader.vertMax.z - modelHeader.vertMin.z)/this.TWO_POW_32_MINUS_1
		}
		lenj = modelHeader.vertCount*3;                    		
		modelBody.positions = new Float32Array(lenj);
		for ( j=0; j<lenj; j++ ){
			modelBody.positions[j] = dataStream.readInt32();
		}
		lenj = modelHeader.faceCount*3;
		modelBody.indices = new Int32Array(lenj);
		for ( j=0; j<lenj; j++ ){
			modelBody.indices[j] = dataStream.readInt32();
		}
		// restore vertices
		modelBody.positions = this.removeInterleaving(modelBody.positions, 3, "float");
		lenj = modelBody.positions.length;
		for ( j=0; j<lenj; j+=3 ){
			modelBody.positions[j] = (this.TWO_POW_31+modelBody.positions[j])*gridSize.x + modelHeader.vertMin.x;
			modelBody.positions[j+1] = (this.TWO_POW_31+modelBody.positions[j+1])*gridSize.y + modelHeader.vertMin.y;
			modelBody.positions[j+2] = (this.TWO_POW_31+modelBody.positions[j+2])*gridSize.z + modelHeader.vertMin.z;
		}

		// remove index interleaving
		modelBody.indices = this.removeInterleaving(modelBody.indices, 3, "uint");
		// restore faces
		this.restoreIndices(modelBody.indices);

		lenj = modelHeader.children;
		for ( j=0; j<lenj; j++ ){
			var childHeader = this.readModelHeader(dataStream);
			modelBody.children.push(this.readModelBody(dataStream, childHeader ));
		}

		return modelBody;

	},
	removeInterleaving: function ( target, leafSize, type ){

		var outTarget;
		if (type == "uint")
			outTarget = new Uint32Array(target.length);
		else if (type == "float")
			outTarget = new Float32Array(target.length);
		else
			throw "Need a valid interleaving type";
		var len = target.length;
		// Remove interleaving and reconstruct as integers
		var j,i,k, offset;
		for ( i=0; i<leafSize; i++ ){
			k=0;
			offset = i*len/leafSize
			for ( j=i; j<len; j+=leafSize ){
				outTarget[j] = target[offset+k];
				k++;
			}
		}
		return outTarget;

	},
	restoreIndices: function ( indices ) {

	  var len = indices.length;
	  var i = 3;
	  if (len > 0){
	    indices[2] += indices[0];
	    indices[1] += indices[0];
	  }
	  for (; i < len; i += 3){
	    indices[i] = indices[i] += indices[i - 3];

	    if (indices[i] === indices[i - 3]){
	      indices[i+1] = indices[i + 1] += indices[i - 2];
	    }else{
	      indices[i+1] = indices[i + 1] += indices[i];
	    }

	    indices[i+2] = indices[i + 2] += indices[i];
	  }

	},
	dataStream: function ( binary, offset ) {
		return {
			TWO_POW_MINUS23: Math.pow(2, -23),
			TWO_POW_MINUS126: Math.pow(2, -126),
			offset: offset || 0,
			data:binary,
			readBytes: function (numBytes) {

				var bytes = this.data.slice( this.offset, this.offset+numBytes );
				this.offset += numBytes;
				return bytes;

			},
			readInt32: function(){
			  var i = this.readByte();
			  i |= this.readByte() << 8;
			  i |= this.readByte() << 16;
			  return i | (this.readByte() << 24);
			},
			readFloat32: function(){
			  var m = this.readByte();
			  m += this.readByte() << 8;

			  var b1 = this.readByte();
			  var b2 = this.readByte();

			  m += (b1 & 0x7f) << 16; 
			  var e = ( (b2 & 0x7f) << 1) | ( (b1 & 0x80) >>> 7);
			  var s = b2 & 0x80? -1: 1;

			  if (e === 255){
			    return m !== 0? NaN: s * Infinity;
			  }
			  if (e > 0){
			    return s * (1 + (m * this.TWO_POW_MINUS23) ) * Math.pow(2, e - 127);
			  }
			  if (m !== 0){
			    return s * m * this.TWO_POW_MINUS126;
			  }
			  return s * 0;
			},
			readMatrix4: function(){

				var m = new THREE.Matrix4();
				var elements = [];
				for (var i=0; i<16; i++)
					elements.push(this.readFloat32());
				m.elements = elements;
				return m;

			}, 
			readByte: function() {
		 		return this.data[this.offset ++] & 0xff;
			}
		}
	},

}