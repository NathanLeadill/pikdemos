/*

  Exporter for THREE.js geometry to PIKCTM format.
  Author: George Fuller

  Converts a THREE.Geometry object into a PIKCTM bianry format for
  writing out.

*/

THREE.PIKCTMExporter = function () {

};

THREE.PIKCTMExporter.prototype.convert = function ( geometry, vertexNormals, matIds, smoothGroups, comment ) {

  // Create header
  // Most of these integer values read something as strings, not that we really care.
  var header = {

	 "identifier": 1297367887, // Reads MTCO as a string
	 "version": 6,
	 "compression": 3295053, // MG2: 3295053, MG 1: 3229517, RAW: 5718354 
	 "vertices":geometry.vertices.length,
	 "faces":geometry.faces.length,
	 "uvMaps":geometry.faceVertexUvs.length,
	 "attrMapCount": 0,
	 "flags":0, // 256 - Mat Ids, 16 - Smooth Groups, 1 - Vertex Normals
	 "commentLength":0,
	 "comment":""

  }

  var verticesIdentifier = 1414677846;
  var gridIndicesIdentifier = 1480870215;
  var uvMapIdentifier = 1129858388;
  var indiciesIdentifier = 1480871497;
  var len, ilen, jlen, klen, i, j, k;
  var scope = this;

  // Add bit flags
  if (vertexNormals) header.flags += 1;
  if (matIds) header.flags += 256;
  if (smoothGroups) header.flags += 16;

  // Add comment
  if (comment) {
	 header.comment = comment;
	 header.commentLength = comment.length;
  }

  // Only supporting MG2 body for now

  // MG2 Header
  var mg2Header = {

	 "identifier":1211254605,
	 "vertexPrecision":0.0009765625, // Use this, I don't understand the significance though.
	 "normalPrecision": 0.00390625  // Same for this one.

  };

  // Compute geometry bounding box
  if ( !geometry.boundingBox )
	 geometry.computeBoundingBox();

  // Set bounding box limits in the header
  mg2Header.lbx = geometry.boundingBox.min.x;
  mg2Header.lby = geometry.boundingBox.min.y;
  mg2Header.lbz = geometry.boundingBox.min.z;
  mg2Header.hbx = geometry.boundingBox.max.x;
  mg2Header.hby = geometry.boundingBox.max.y;
  mg2Header.hbz = geometry.boundingBox.max.z;


  /* Magic happens! BOOM! Converted this from ctm converter, don't know what it does.

									 ____/ (  (    )   )  \___
								 /( (  (  )   _    ))  )   )\
							  ((     (   )(    )  )   (   )  )
							((/  ( _(   )   (   _) ) (  () )  )
						  ( (  ( (_)   ((    (   )  .((_ ) .  )_
						 ( (  )    (      (  )    )   ) . ) (   )
						(  (   (  (   ) (  _  ( _) ).  ) . ) ) ( )
						( (  (   ) (  )   (  ))     ) _)(   )  )  )
					  ( (  ( \ ) (    (_  ( ) ( )  )   ) )  )) ( )
						(  (   (  (   (_ ( ) ( _    )  ) (  )  )   )
					  ( (  ( (  (  )     (_  )  ) )  _)   ) _( ( )
						((  (   )(    (     _    )   _) _(_ (  (_ )
						 (_((__(_(__(( ( ( |  ) ) ) )_))__))_)___)
						 ((__)        \\||lll|l||///          \_))
										  /(/ (  )  ) )\   
								(      ( ( ( | | ) ) )\   )
										 /(| / ( )) ) ) )) 
										 ( ((((_(|)_)))))     
											||\(|(|)|/||     
											|(||(||)||||          
								  (     //|/l|||)|\\ \     )     \O/ < --- PETE
								(/ / //  /|//||||\\  \ \  \ _)    |
---------------------------------------------------------/ \--------------------- */


  var factor = [0,0,0];
  mg2Header.divs = [0,0,0];
  mg2Header.gridSize = [0,0,0];

  factor[0] = mg2Header.hbx - mg2Header.lbx;
  factor[1] = mg2Header.hby - mg2Header.lby;
  factor[2] = mg2Header.hbz - mg2Header.lbz;

  var sum = factor[0] + factor[1] + factor[2];
  if(sum > 1e-30){

	 sum = 1.0 / sum;

	 for(var i = 0; i < 3; i++){
		factor[i] *= sum;
	 }    

	 var wantedGrids = Math.pow(100.0 * geometry.vertices.length, 1/3);

	 for( var i=0; i < 3; i++ ){
		mg2Header.divs[i] = Math.ceil( wantedGrids * factor[i] );
		if(mg2Header.divs[i] < 1)
		  mg2Header.divs[i] = 1;
	 }

  }else{

	 mg2Header.divs[0] = 4;
	 mg2Header.divs[1] = 4;
	 mg2Header.divs[2] = 4;

  }

  // Work out grid sizes
  mg2Header.gridSize[0] = (mg2Header.hbx - mg2Header.lbx) / mg2Header.divs[0];
  mg2Header.gridSize[1] = (mg2Header.hby - mg2Header.lby) / mg2Header.divs[1];
  mg2Header.gridSize[2] = (mg2Header.hbz - mg2Header.lbz) / mg2Header.divs[2];

  // End of magic happening

  // Set divisions in the header;
  mg2Header.divx = mg2Header.divs[0];
  mg2Header.divy = mg2Header.divs[1];
  mg2Header.divz = mg2Header.divs[2];

  // Store vertex indices as a property

  var vertices = [];

  mg2Header.gridIndexForVert = function ( vertex ) {

	 var gx = (vertex.x - this.lbx)/this.gridSize[0];
	 var gy = (vertex.y - this.lby)/this.gridSize[1];
	 var gz = (vertex.z - this.lbz)/this.gridSize[2];

	 if ( gx < this.divx )
		gx = ~~gx;
	 else if ( gx !=0 )
		gx --;

	 if ( gy < this.divy )
		gy = ~~gy;
	 else if ( gy !=0 )
		gy --;

	 if ( gz < this.divz )
		gz = ~~gz;
	 else if ( gz !=0 )
		gz --;

	 var gi = gx + this.divs[0]*( gy + this.divs[1]*gz );

	 return { "gi":Math.round(gi), "gx":Math.round(gx), "gy":Math.round(gy), "gz":Math.round(gz) };

  };

  mg2Header.originForGridIndex = function ( index ) {

	 var vector = [0,0,0];

	 vector[0] = this.lbx + ( this.hbx - this.lbx ) * index.gx/this.divs[0];
	 vector[1] = this.lby + ( this.hby - this.lby ) * index.gy/this.divs[1];
	 vector[2] = this.lbz + ( this.hbz - this.lbz ) * index.gz/this.divs[2];

	 return vector;

  }

  // Calculate grid index for each vertices.
  for ( i=0; i<geometry.vertices.length; i++ ){

	 var vertex = {};
	 vertex.x = geometry.vertices[i].x;
	 vertex.y = geometry.vertices[i].y;
	 vertex.z = geometry.vertices[i].z;
	 vertex.index = i;
	 vertex.gridIndex = mg2Header.gridIndexForVert( geometry.vertices[i] );
	 vertices.push( vertex );

  }

  // Build vertex uvs from the face vertex uvs

  ilen = geometry.faceVertexUvs.length;
  var vertexUvMaps = [];
 
  for ( i=0; i<ilen; i++ ){

	 var uvMap = geometry.faceVertexUvs[i];
	 jlen = uvMap.length;

	 for ( j=0; j<jlen; j++ ){

		var faceUvs = uvMap[j];
		var face = geometry.faces[j];
		var klen = faceUvs.length;

		var vertA = face.a;
		var vertB = face.b;
		var vertC = face.c;

		if ( vertices[vertA].uv == undefined )
		  vertices[vertA].uv = new Array(ilen);
		if ( vertices[vertB].uv == undefined )
		  vertices[vertB].uv = new Array(ilen);
		if ( vertices[vertC].uv == undefined )
		  vertices[vertC].uv = new Array(ilen);

		if ( vertices[vertA].uv[i] == undefined )
		  vertices[vertA].uv[i] = faceUvs[0];
		if ( vertices[vertB].uv[i] == undefined )
		 vertices[vertB].uv[i] = faceUvs[1];
		if ( vertices[vertC].uv[i] == undefined )
		  vertices[vertC].uv[i] = faceUvs[2];

	 }

  }

  // Sort Vertices

  var compare = function ( a, b ) {

	 if ( a.gridIndex.gi != b.gridIndex.gi )
		return a.gridIndex.gi - b.gridIndex.gi;
	 return a.x - b.x;

  }

  vertices.sort(compare);

  // Create vertex look up table

  ilen = vertices.length;
  var vertexLookUp = new Array(vertices.length);

  for ( i=0; i<ilen; i++ ){

	 vertexLookUp[ vertices[i].index ] = i;

  }

  // Compute verts for best compression
  len = geometry.vertices.length;
  var computedVerts = [];

  for ( i=0; i<len; i++ ){

	 var computedVert = {};
	 computedVert.gridIndex = mg2Header.gridIndexForVert(vertices[i]);
	 computedVert.x = Math.floor((vertices[i].x - mg2Header.originForGridIndex(computedVert.gridIndex)[0])/mg2Header.vertexPrecision);
	 computedVert.y = Math.floor((vertices[i].y - mg2Header.originForGridIndex(computedVert.gridIndex)[1])/mg2Header.vertexPrecision);
	 computedVert.z = Math.floor((vertices[i].z - mg2Header.originForGridIndex(computedVert.gridIndex)[2])/mg2Header.vertexPrecision);
	 computedVerts.push( computedVert );

  }

  // Calcualte differential verts for even better compression

  var differentialVerts = [];

  for ( i=0; i<len; i++ ){

	 var differentialVert = {};
		
	 if ( i > 0 )
		if ( computedVerts[i].gridIndex.gi == computedVerts[i-1].gridIndex.gi )
		  differentialVert.x =  computedVerts[i].x - computedVerts[i-1].x;
		else
		  differentialVert.x = computedVerts[i].x;
	 else
		differentialVert.x = computedVerts[i].x;

	 differentialVert.y = computedVerts[i].y;
	 differentialVert.z = computedVerts[i].z;
	 differentialVerts.push(differentialVert);

  }

  // Interleave the vertices

  len = differentialVerts.length;
  var elemInterleavedVertices = new Array(len*3);

  for ( i=0; i<len; i++ ){

	 elemInterleavedVertices[i] = differentialVerts[ i ].x;
	 elemInterleavedVertices[i+len] = differentialVerts[ i ].y;
	 elemInterleavedVertices[i+len*2] = differentialVerts[ i ].z;

  }

  len = elemInterleavedVertices.length;

  var binaryVertices = new Uint8Array(len*4);

  for ( i=0; i<len; i++ ) {

	 var vertBinary = this.integer32ToUint8Array(elemInterleavedVertices[i]);
	 binaryVertices.set( [vertBinary[0]], i );
	 binaryVertices.set( [vertBinary[1]], i+len );
	 binaryVertices.set( [vertBinary[2]], i+2*len );
	 binaryVertices.set( [vertBinary[3]], i+3*len );

  }

  // Grid indices

  // Indices - stored in the vertices

  var differentialGridIndices = [];
  len = differentialVerts.length;

  for ( i=0; i<len; i++ ){

	 if ( i==0 )
		differentialGridIndices.push(computedVerts[i].gridIndex.gi);
	 else
		differentialGridIndices.push(computedVerts[i].gridIndex.gi - computedVerts[i-1].gridIndex.gi);

  }


  len = differentialGridIndices.length;

  var binaryGridIndices = new Uint8Array(len*4);

  for ( i=0; i<len; i++ ) {

	 var gridBinary = this.integer32ToUint8Array(differentialGridIndices[i]);
	 binaryGridIndices.set( [gridBinary[0]], i );
	 binaryGridIndices.set( [gridBinary[1]], i+len );
	 binaryGridIndices.set( [gridBinary[2]], i+2*len );
	 binaryGridIndices.set( [gridBinary[3]], i+3*len );

  }


  // Reindex Faces and interleave

  var sortedFaces = [];

  // Reorder the faces so face.a is always the smallest number.
  for ( i=0; i<geometry.faces.length; i++ ){

	 var face = geometry.faces[i];
	 var lookUpA = vertexLookUp[face.a];
	 var lookUpB = vertexLookUp[face.b];
	 var lookUpC = vertexLookUp[face.c];
	 var lookUpFace = new THREE.Face3( 0, 0, 0, face.normal, face.color, face.materialIndex );

	 var faceA;
	 var faceB;
	 var faceC;

	 if ( lookUpA < lookUpB && lookUpA < lookUpC ){
		faceA = lookUpA;
		faceB = lookUpB;
		faceC = lookUpC
	 }else if( lookUpB < lookUpA && lookUpB < lookUpC ) {
		faceA = lookUpB;
		faceB = lookUpC;
		faceC = lookUpA;
	 }else {
		faceA = lookUpB;
		faceB = lookUpC;
		faceC = lookUpA;
	 }

	 lookUpFace.a = faceA;
	 lookUpFace.b = faceB;
	 lookUpFace.c = faceC;

	 sortedFaces.push(lookUpFace);

  }

  // Sort face array by face.a
  var compareFaces = function ( a, b ) {
	 return a.a - b.a;
  }

  sortedFaces.sort(compareFaces);

  ilen =  sortedFaces.length;

  var indices = new Array ( ilen*3 );

  for ( i=0; i<ilen; i++ ) {

	 var face = sortedFaces[i];

	 var indexA = face.a;
	 var indexB = face.b;
	 var indexC = face.c;

	 if ( i > 0 ){

		var prevFace = sortedFaces[i-1];

		indexC -= indexA;
		if ( indexA == prevFace.a )
		  indexB -= prevFace.b;
		else
		  indexB -= indexA;
		indexA -= prevFace.a;

	 }

	 indices[i] = indexA;
	 indices[ilen+i] = indexB;
	 indices[2*ilen+i] = indexC;

  }

	// UV Maps

  var noOfMaps = vertices[0].uv.length;
  var diffUvMaps = [];

  for ( i=0; i<noOfMaps; i++ ){

	 var uvMapHeader = {

		"identifier":1129858388,
		"name":"",
		"fileReference":"",
		"precision":0.000244140625 // Arbitrary value

	 };

	 len = vertices.length;
	 var diffUvMap = [];

	 for ( j=0; j<len; j++ ){

		// This is to fix an error with the uvs. Sometimes there is no uv set.
		// This error needs tracing properly at some point;
		var uv;
		try {
		  uv = vertices[j].uv[i];
		} catch ( e ){
		  uv = new THREE.Vector2( 0,0 );
		}
		var diffUv = [];

		// if ( j > 0 ){

		//   var uvPrev = vertices[j-1].uv[i];
		//   var u = uv.x/uvMapHeader.precision - uvPrev.x;
		//   var v = uv.y/uvMapHeader.precision - uvPrev.y;
		//   diffUv = [ u, v ];

		// }else{

		  var u = uv.x/uvMapHeader.precision;
		  var v = uv.y/uvMapHeader.precision;
		  diffUv = [ u, v ];

		//}
		  
		diffUvMap.push(diffUv);

	 }

	 diffUvMaps.push(diffUvMap);

  }

  // Do UVmap Interleaving

  var interleavedUvMaps = [];

  for ( i=0; i<diffUvMaps.length; i++ ){

	 var diffUvMap = diffUvMaps[i];
	 jlen = diffUvMap.length;
	 // Initialised the interleaving array it needs to store uvs in sequence rather than in nested arrays.
	 var interleavedUvs = new Array( jlen * 2 );

	 for ( j=0; j<jlen; j++ ){

		  var diffuv = diffUvMap[j];
		  var u = diffuv[0];
		  var v = diffuv[1];

		  interleavedUvs[j] = u;
		  interleavedUvs[jlen+j] = v;


	 }

	 interleavedUvMaps.push(interleavedUvs);

  }

  ilen = interleavedUvMaps.length;
  var binaryUvMaps = new Array( ilen );

  for ( i=0; i<ilen; i++ ){

	 var uvMap = interleavedUvMaps[i];
	 jlen = uvMap.length;
	 var binaryUvMap = new Uint8Array(jlen*4);
	
	 for ( j=0; j<jlen; j++ ) {

		// Signed Magnitude needs doing.
		var uvBinary = this.integer32ToSignedMagitudeUint8Array(uvMap[j]);
		binaryUvMap.set( [uvBinary[0]], j );
		binaryUvMap.set( [uvBinary[1]], j+jlen );
		binaryUvMap.set( [uvBinary[2]], j+2*jlen );
		binaryUvMap.set( [uvBinary[3]], j+3*jlen );

	 }
	 binaryUvMaps[i] = binaryUvMap;

  }


  len = indices.length;

  var binaryIndices = new Uint8Array(len*4);
 
  for ( i=0; i<len; i++ ) {

	 var indexBinary = this.integer32ToUint8Array(indices[i]);
	 binaryIndices.set( [indexBinary[0]], i );
	 binaryIndices.set( [indexBinary[1]], i+len );
	 binaryIndices.set( [indexBinary[2]], i+2*len );
	 binaryIndices.set( [indexBinary[3]], i+3*len );

  }

  // Compression time

  // There are 8 modes, 0-7. Mode 1 is the fastest to decompress.
  var compressionMode = 1;

  var compressedVertices = binaryVertices;//LZMA.compress( binaryVertices, compressionMode );
  var compressedGridIndices = binaryGridIndices;//LZMA.compress( binaryGridIndices, compressionMode );
  var compressedIndices = binaryIndices;//LZMA.compress( binaryIndices, compressionMode );
  var compressedUvs = new Array(binaryUvMaps.length);

  for ( i=0; i<compressedUvs.length; i++ ){

	 compressedUvs[i] = binaryUvMaps[i]//LZMA.compress(binaryUvMaps[i], compressionMode);

  }

  // Create body by converting to binary. Since js doesn't actually handle binary uint8 is the
  // the closest thing to a byte of data.

  var uvMapLength = 0;

  for ( i=0; i<compressedUvs.length; i++ ){

	 uvMapLength += 20;
	 uvMapLength += compressedUvs[i].length;

  }

  var binary = new Uint8Array( 116 + compressedVertices.length + compressedGridIndices.length + compressedIndices.length + uvMapLength );

  binary.offset = 0;
  binary.writeByte = function ( byte ) {

	 this.set( [byte], this.offset );
	 this.offset = this.offset + 1;

  }
  binary.writeBytes = function ( bytes ) {

	 this.set( bytes, this.offset );
	 this.offset = this.offset + bytes.length;

  }

  //binary.offset = 0;

  // Build the binary header
  binary.writeBytes( scope.integer32ToUint8Array(header.identifier) );
  binary.writeBytes( scope.integer32ToUint8Array(header.version) );
  binary.writeBytes( scope.integer32ToUint8Array(header.compression) );
  binary.writeBytes( scope.integer32ToUint8Array(header.vertices) ); 
  binary.writeBytes( scope.integer32ToUint8Array(header.faces) );
  binary.writeBytes( scope.integer32ToUint8Array(header.uvMaps) );
  binary.writeBytes( scope.integer32ToUint8Array(0) );
  binary.writeBytes( scope.integer32ToUint8Array(header.flags) );
  binary.writeBytes( scope.integer32ToUint8Array(0) );

  // Make MG2 binary header

  binary.writeBytes( scope.integer32ToUint8Array(mg2Header.identifier) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.vertexPrecision) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.normalPrecision) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.lbx) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.lby) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.lbz) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.hbx) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.hby) );
  binary.writeBytes( scope.floatToUint8Array(mg2Header.hbz) );
  binary.writeBytes( scope.integer32ToUint8Array(mg2Header.divx) );
  binary.writeBytes( scope.integer32ToUint8Array(mg2Header.divy) );
  binary.writeBytes( scope.integer32ToUint8Array(mg2Header.divz) );

  // Make Vertices identifier

  binary.writeBytes( scope.integer32ToUint8Array( verticesIdentifier ) );

  // Write vertices binary

  len = compressedVertices.length;
  console.log( "Packed vertices :" + len);
  binary.writeBytes( scope.integer32ToUint8Array( len ));

  for ( i=0; i<len; i++ ){

	 var bin = compressedVertices[i];
	 binary.writeByte( bin );

  }

  // Make Vertices identifier

  binary.writeBytes( scope.integer32ToUint8Array( gridIndicesIdentifier ));

  // Write grid indices binary

  len = compressedGridIndices.length;
  console.log( "Packed grid :" + len);
  binary.writeBytes( scope.integer32ToUint8Array( len ) );

  for ( i=0; i<len; i++ ){

	 var bin = compressedGridIndices[i];
	 binary.writeByte( bin );

  }

  // Write grid indicied identifier

  binary.writeBytes( scope.integer32ToUint8Array( indiciesIdentifier ) );

  // Write grid indices bianry

  len = compressedIndices.length;
  console.log( "Packed indices :" + len);
  binary.writeBytes( scope.integer32ToUint8Array( len ) );

  for ( i=0; i<len; i++ ){

	 var bin = compressedIndices[i];
	 binary.writeByte( bin );

  }

  for ( i=0; i<compressedUvs.length; i++ ){

	 var compressedMap = compressedUvs[i];

	 binary.writeBytes( scope.integer32ToUint8Array( uvMapIdentifier ) );
	 binary.writeBytes( scope.integer32ToUint8Array( 0 ) ); // No map name
	 binary.writeBytes( scope.integer32ToUint8Array( 0 ) ); // No map file reference
	 binary.writeBytes( scope.floatToUint8Array( uvMapHeader.precision ) );
	 binary.writeBytes( scope.integer32ToUint8Array( compressedMap.length ) );

	 jlen = compressedMap.length;
	 for ( j=0; j<jlen; j++ ){

		var bin = compressedMap[j];
		binary.writeByte( bin );

	 }

  }

  // // For Testing

  // var downloadBlob, downloadURL;

  // downloadBlob = function(data, fileName, mimeType) {
  //   var blob, url;
  //   blob = new Blob([data], {
  //     type: mimeType
  //   });
  //   url = window.URL.createObjectURL(blob);
  //   downloadURL(url, fileName, mimeType);
  //   setTimeout(function() {
  //     return window.URL.revokeObjectURL(url);
  //   }, 1000);
  // };

  // downloadURL = function(data, fileName) {
  //   var a;
  //   a = document.createElement('a');
  //   a.href = data;
  //   a.download = fileName;
  //   document.body.appendChild(a);
  //   a.style = 'display: none';
  //   a.click();
  //   a.remove();
  // };

  // var int8Array = new Int8Array(binary.length);
  // int8Array.set( binary, 0 );

  // downloadBlob(int8Array, 'some-file.bin', 'application/octet-stream');

  return binary;

}

THREE.PIKCTMExporter.prototype.floatToUint8Array = function ( float, isBigEndian ) {

  var uint8Array = new Uint8Array(4); // 2^24 - 2^16 - 2^8 - 0

  if ( float == 0 ){

	 uint8Array[0] = 0;
	 uint8Array[1] = 0;
	 uint8Array[2] = 0;
	 uint8Array[3] = 0;

	 return uint8Array;
  }

  var sign = 1;
  if ( float < 0 )
	 sign = -1

  float = float * sign;

  var preDecimalVal = Math.floor(float);
  var afterDecimalVal = float - preDecimalVal;

  var scientificNotation = 0;

  // Fill 23 bits of data, we might not use them all in the end.
  var val = afterDecimalVal;
  for ( var i=0; i<23; i++ ){

	 val = val * 2;
	 if ( val >= 1 ){
		scientificNotation += Math.pow( 10, -(i+1) );
		val = val -1;
	 }
  }

  // Get binary representation of pre decimal
  var preval = preDecimalVal;
  for ( var i=30; i>=0; i-- ){

	 var testVal = Math.pow(2, i );

	 if ( preval >= testVal  ){
		scientificNotation += Math.pow( 10, i );
		preval = preval - testVal;
	 }

  }

  var exponent = 0;
  if ( scientificNotation > 2 ){
	 while ( scientificNotation > 2 ){

		scientificNotation = scientificNotation / 10;
		exponent++;

	 }
  }else {

	 while ( scientificNotation < 1 && scientificNotation != 0 ){

		scientificNotation = scientificNotation * 10;
		exponent--;

	 }

  }

  if ( sign < 0 )
	 uint8Array[0] = 128;

  uint8Array[0] = uint8Array[0] + Math.floor(( exponent + 127 )/2);
  if ( ( exponent + 127 ) % 2 )
	 uint8Array[1] = 128;

  var mantissa = scientificNotation - 1;
  var mantissaFirstByte = 0;
  var mantissaSecondByte = 0;
  var mantissaThirdByte = 0;

  for ( var i=6; i>=0; i-- ){

	 mantissa = mantissa * 10;
	 if ( mantissa >= 1 ){
		mantissaFirstByte += Math.pow( 2, i );
		mantissa -= 1; 
	 }

  }

  for ( var i=7; i>=0; i-- ){

	 mantissa = mantissa * 10;
	 if ( mantissa >= 1 ){
		mantissaSecondByte += Math.pow( 2, i );
		mantissa -= 1; 
	 }

  }

  for ( var i=7; i>=0; i-- ){

	 mantissa = mantissa * 10;
	 if ( mantissa >= 1 ){
		mantissaThirdByte += Math.pow( 2, i );
		mantissa -= 1; 
	 }

  }

  uint8Array[1] = uint8Array[1] + mantissaFirstByte;
  uint8Array[2] = mantissaSecondByte;
  uint8Array[3] = mantissaThirdByte;

  if ( !isBigEndian ){

	 var tempArray = new Array(4);
	 tempArray[0] = uint8Array[0];
	 tempArray[1] = uint8Array[1];
	 tempArray[2] = uint8Array[2];
	 tempArray[3] = uint8Array[3];
	 uint8Array[0] = tempArray[3];
	 uint8Array[1] = tempArray[2];
	 uint8Array[2] = tempArray[1];
	 uint8Array[3] = tempArray[0];

  }

  return uint8Array;

  //   var sign = 1;
  //   if (data[3] >= Math.pow(2, 7)){
  //       sign = -1;
  //       data[3] -= Math.pow(2, 7);
  //   }
  //   if ( data[0] == 0 && data[1] == 0 && data[2] == 0 && data[3] == 0 ){  
  //       return 0;
  //   }

  //   var exponent = data[3]*2 - 127;
  //   var leadingBit = 1;

  //   if (data[2] > Math.pow(2, 7) - 1 ){
  //       exponent += 1
  //       data[2] -= 128
  //   }
	 
  //   var mantissa = (data[0] + data[1]*Math.pow(2, 8) + data[2]*Math.pow(2, 16))/(Math.pow(2,23));
  //   mantissa = mantissa + leadingBit;

  //   return sign * Math.pow(2,exponent) * mantissa;

}

THREE.PIKCTMExporter.prototype.signedInteger32ToUint8Array = function ( integer, isBigEndian ) {

  var signBit = 0;
  if ( integer < 0 ){
	 integer = integer * -1;
	 signBit = 128;
  }

  var uint8Array = new Uint8Array(4); // 2^24 - 2^16 - 2^8 - 0
  uint8Array[0] = signBit + Math.floor(integer / ( Math.pow(2,24) ));
  integer = integer - uint8Array[0]*Math.pow(2,24);
  uint8Array[1] = Math.floor(integer / ( Math.pow(2,16) ));
  integer = integer - uint8Array[1]*Math.pow(2,16);
  uint8Array[2] = Math.floor(integer / ( Math.pow(2,8) ));
  integer = integer - uint8Array[1]*Math.pow(2,8);
  uint8Array[3] = Math.floor( integer );

  if ( !isBigEndian ){

	 var tempArray = new Array(4);
	 tempArray[0] = uint8Array[0];
	 tempArray[1] = uint8Array[1];
	 tempArray[2] = uint8Array[2];
	 tempArray[3] = uint8Array[3];
	 uint8Array[0] = tempArray[3];
	 uint8Array[1] = tempArray[2];
	 uint8Array[2] = tempArray[1];
	 uint8Array[3] = tempArray[0];

  }

  return uint8Array;

}

THREE.PIKCTMExporter.prototype.Integer32ToUint8Array = function ( integer, isBigEndian ) {

  var uint8Array = new Uint8Array(4); // 2^24 - 2^16 - 2^8 - 0
  uint8Array[0] = Math.floor(integer / ( Math.pow(2,24) ));
  integer = integer - uint8Array[0]*Math.pow(2,24);
  uint8Array[1] = Math.floor(integer / ( Math.pow(2,16) ));
  integer = integer - uint8Array[1]*Math.pow(2,16);
  uint8Array[2] = Math.floor(integer / ( Math.pow(2,8) ));
  integer = integer - uint8Array[1]*Math.pow(2,8);
  uint8Array[3] = Math.floor( integer );

  if ( !isBigEndian ){

	 var tempArray = new Array(4);
	 tempArray[0] = uint8Array[0];
	 tempArray[1] = uint8Array[1];
	 tempArray[2] = uint8Array[2];
	 tempArray[3] = uint8Array[3];
	 uint8Array[0] = tempArray[3];
	 uint8Array[1] = tempArray[2];
	 uint8Array[2] = tempArray[1];
	 uint8Array[3] = tempArray[0];

  }

  return uint8Array;

}

THREE.PIKCTMExporter.prototype.integer32ToUint8Array = function ( integer, isBigEndian ) {

  var uint8Array = new Uint8Array(4); // 2^24 - 2^16 - 2^8 - 0
  uint8Array[0] = Math.floor(integer / ( Math.pow(2,24) ));
  integer = integer - uint8Array[0]*Math.pow(2,24);
  uint8Array[1] = Math.floor(integer / ( Math.pow(2,16) ));
  integer = integer - uint8Array[1]*Math.pow(2,16);
  uint8Array[2] = Math.floor(integer / ( Math.pow(2,8) ));
  integer = integer - uint8Array[1]*Math.pow(2,8);
  uint8Array[3] = Math.floor( integer );

  if ( !isBigEndian ){

	 var tempArray = new Array(4);
	 tempArray[0] = uint8Array[0];
	 tempArray[1] = uint8Array[1];
	 tempArray[2] = uint8Array[2];
	 tempArray[3] = uint8Array[3];
	 uint8Array[0] = tempArray[3];
	 uint8Array[1] = tempArray[2];
	 uint8Array[2] = tempArray[1];
	 uint8Array[3] = tempArray[0];

  }

  return uint8Array;

}

THREE.PIKCTMExporter.prototype.integer32ToSignedMagitudeUint8Array = function ( integer, isBigEndian ) {

  if (integer > Math.pow(2,31)-1)
	 console.warn("Integer too large for signed magnitude");

  var sign = 0;
  if (integer < 0)
	 sign = -1;

  integer = integer - sign * (Math.pow(2,31)-1);

  var uint8Array = new Uint8Array(4); // 2^24 - 2^16 - 2^8 - 0

  uint8Array[0] = Math.floor(integer / ( Math.pow(2,24) ));
  integer = integer - uint8Array[0]*Math.pow(2,24);
  uint8Array[1] = Math.floor(integer / ( Math.pow(2,16) ));
  integer = integer - uint8Array[1]*Math.pow(2,16);
  uint8Array[2] = Math.floor(integer / ( Math.pow(2,8) ));
  integer = integer - uint8Array[1]*Math.pow(2,8);
  uint8Array[3] = Math.floor( integer );

  if ( sign == -1 )
	 uint8Array[0] = uint8Array[0] + 128;

  if ( !isBigEndian ){

	 var tempArray = new Array(4);
	 tempArray[0] = uint8Array[0];
	 tempArray[1] = uint8Array[1];
	 tempArray[2] = uint8Array[2];
	 tempArray[3] = uint8Array[3];
	 uint8Array[0] = tempArray[3];
	 uint8Array[1] = tempArray[2];
	 uint8Array[2] = tempArray[1];
	 uint8Array[3] = tempArray[0];

  }

  return uint8Array;

}

/**
 * Loader for CTM encoded models generated by OpenCTM tools:
 *  http://openctm.sourceforge.net/
 *
 * Uses js-openctm library by Juan Mellado
 *  http://code.google.com/p/js-openctm/
 *
 * @author alteredq / http://alteredqualia.com/
 */