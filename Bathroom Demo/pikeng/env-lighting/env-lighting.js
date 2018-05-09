
/* George Fuller 01/02/2017
  Merging of all components for the env-lighting 

  PMREMGenerator.js"
  PMREMCubeUVPacker.js
  RGBELoader.js
  HDRLoader.js

*/


/**
 * @author Prashant Sharma / spidersharma03
 * @author Ben Houston / bhouston, https://clara.io
 *
 * To avoid cube map seams, I create an extra pixel around each face. This way when the cube map is
 * sampled by an application later(with a little care by sampling the centre of the texel), the extra 1 border
 *	of pixels makes sure that there is no seams artifacts present. This works perfectly for cubeUV format as
 *	well where the 6 faces can be arranged in any manner whatsoever.
 * Code in the beginning of fragment shader's main function does this job for a given resolution.
 *	Run Scene_PMREM_Test.html in the examples directory to see the sampling from the cube lods generated
 *	by this class.
 */

THREE.PMREMGenerator = function( sourceTexture ) {

	this.sourceTexture = sourceTexture;
	this.resolution = 256; // NODE: 256 is currently hard coded in the glsl code for performance reasons

	var monotonicEncoding = ( sourceTexture.encoding === THREE.LinearEncoding ) ||
		( sourceTexture.encoding === THREE.GammaEncoding ) || ( sourceTexture.encoding === THREE.sRGBEncoding );

	this.sourceTexture.minFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	this.sourceTexture.magFilter = ( monotonicEncoding ) ? THREE.LinearFilter : THREE.NearestFilter;
	this.sourceTexture.generateMipmaps = this.sourceTexture.generateMipmaps && monotonicEncoding;

	this.cubeLods = [];

	var size = this.resolution;
	var params = {
		format: this.sourceTexture.format,
		magFilter: this.sourceTexture.magFilter,
		minFilter: this.sourceTexture.minFilter,
		type: this.sourceTexture.type,
		generateMipmaps: this.sourceTexture.generateMipmaps,
		anisotropy: this.sourceTexture.anisotropy,
		encoding: this.sourceTexture.encoding
	 };

	// how many LODs fit in the given CubeUV Texture.
	this.numLods = Math.log2( size ) - 2;

	for ( var i = 0; i < this.numLods; i ++ ) {

		var renderTarget = new THREE.WebGLRenderTargetCube( size, size, params );
		this.cubeLods.push( renderTarget );
		size = Math.max( 16, size / 2 );

	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0.0, 1000 );

	this.shader = this.getShader();
	this.planeMesh = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2, 0 ), this.shader );
	this.planeMesh.material.side = THREE.DoubleSide;
	this.scene = new THREE.Scene();
	this.scene.add( this.planeMesh );
	this.scene.add( this.camera );

	this.shader.uniforms[ 'envMap' ].value = this.sourceTexture;
	this.shader.envMap = this.sourceTexture;

};

THREE.PMREMGenerator.prototype = {

	constructor : THREE.PMREMGenerator,

	/*
	 * Prashant Sharma / spidersharma03: More thought and work is needed here.
	 * Right now it's a kind of a hack to use the previously convolved map to convolve the current one.
	 * I tried to use the original map to convolve all the lods, but for many textures(specially the high frequency)
	 * even a high number of samples(1024) dosen't lead to satisfactory results.
	 * By using the previous convolved maps, a lower number of samples are generally sufficient(right now 32, which
	 * gives okay results unless we see the reflection very carefully, or zoom in too much), however the math
	 * goes wrong as the distribution function tries to sample a larger area than what it should be. So I simply scaled
	 * the roughness by 0.9(totally empirical) to try to visually match the original result.
	 * The condition "if(i <5)" is also an attemt to make the result match the original result.
	 * This method requires the most amount of thinking I guess. Here is a paper which we could try to implement in future::
	 * http://http.developer.nvidia.com/GPUGems3/gpugems3_ch20.html
	 */
	update: function( renderer ) {

		this.shader.uniforms[ 'envMap' ].value = this.sourceTexture;
		this.shader.envMap = this.sourceTexture;

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;

		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;

		for ( var i = 0; i < this.numLods; i ++ ) {

			var r = i / ( this.numLods - 1 );
			this.shader.uniforms[ 'roughness' ].value = r * 0.9; // see comment above, pragmatic choice
			var size = this.cubeLods[ i ].width;
			this.shader.uniforms[ 'mapSize' ].value = size;
			this.renderToCubeMapTarget( renderer, this.cubeLods[ i ] );

			if ( i < (this.cubeLods.length-1) ) this.shader.uniforms[ 'envMap' ].value = this.cubeLods[ i ].texture;

		}

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

	},

	renderToCubeMapTarget: function( renderer, renderTarget ) {

		for ( var i = 0; i < 6; i ++ ) {

			this.renderToCubeMapTargetFace( renderer, renderTarget, i )

		}

	},

	renderToCubeMapTargetFace: function( renderer, renderTarget, faceIndex ) {

		renderTarget.activeCubeFace = faceIndex;
		this.shader.uniforms[ 'faceIndex' ].value = faceIndex;
		renderer.render( this.scene, this.camera, renderTarget, true );

	},

	getShader: function() {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"faceIndex": { value: 0 },
				"roughness": { value: 0.5 },
				"mapSize": { value: 0.5 },
				"envMap": { value: null },
				"testColor": { value: new THREE.Vector3( 1, 1, 1 ) }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\n\
				varying vec2 vUv;\n\
				uniform int faceIndex;\n\
				uniform float roughness;\n\
				uniform samplerCube envMap;\n\
				uniform float mapSize;\n\
				uniform vec3 testColor;\n\
				\n\
				float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {\n\
					float a = ggxRoughness + 0.0001;\n\
					a *= a;\n\
					return ( 2.0 / a - 2.0 );\n\
				}\n\
				vec3 ImportanceSamplePhong(vec2 uv, mat3 vecSpace, float specPow) {\n\
					float phi = uv.y * 2.0 * PI;\n\
					float cosTheta = pow(1.0 - uv.x, 1.0 / (specPow + 1.0));\n\
					float sinTheta = sqrt(1.0 - cosTheta * cosTheta);\n\
					vec3 sampleDir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);\n\
					return vecSpace * sampleDir;\n\
				}\n\
				vec3 ImportanceSampleGGX( vec2 uv, mat3 vecSpace, float Roughness )\n\
				{\n\
					float a = Roughness * Roughness;\n\
					float Phi = 2.0 * PI * uv.x;\n\
					float CosTheta = sqrt( (1.0 - uv.y) / ( 1.0 + (a*a - 1.0) * uv.y ) );\n\
					float SinTheta = sqrt( 1.0 - CosTheta * CosTheta );\n\
					return vecSpace * vec3(SinTheta * cos( Phi ), SinTheta * sin( Phi ), CosTheta);\n\
				}\n\
				mat3 matrixFromVector(vec3 n) {\n\
					float a = 1.0 / (1.0 + n.z);\n\
					float b = -n.x * n.y * a;\n\
					vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);\n\
					vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);\n\
					return mat3(b1, b2, n);\n\
				}\n\
				\n\
				vec4 testColorMap(float Roughness) {\n\
					vec4 color;\n\
					if(faceIndex == 0)\n\
						color = vec4(1.0,0.0,0.0,1.0);\n\
					else if(faceIndex == 1)\n\
						color = vec4(0.0,1.0,0.0,1.0);\n\
					else if(faceIndex == 2)\n\
						color = vec4(0.0,0.0,1.0,1.0);\n\
					else if(faceIndex == 3)\n\
						color = vec4(1.0,1.0,0.0,1.0);\n\
					else if(faceIndex == 4)\n\
						color = vec4(0.0,1.0,1.0,1.0);\n\
					else\n\
						color = vec4(1.0,0.0,1.0,1.0);\n\
					color *= ( 1.0 - Roughness );\n\
					return color;\n\
				}\n\
				void main() {\n\
					vec3 sampleDirection;\n\
					vec2 uv = vUv*2.0 - 1.0;\n\
					float offset = -1.0/mapSize;\n\
					const float a = -1.0;\n\
					const float b = 1.0;\n\
					float c = -1.0 + offset;\n\
					float d = 1.0 - offset;\n\
					float bminusa = b - a;\n\
					uv.x = (uv.x - a)/bminusa * d - (uv.x - b)/bminusa * c;\n\
					uv.y = (uv.y - a)/bminusa * d - (uv.y - b)/bminusa * c;\n\
					if (faceIndex==0) {\n\
						sampleDirection = vec3(1.0, -uv.y, -uv.x);\n\
					} else if (faceIndex==1) {\n\
						sampleDirection = vec3(-1.0, -uv.y, uv.x);\n\
					} else if (faceIndex==2) {\n\
						sampleDirection = vec3(uv.x, 1.0, uv.y);\n\
					} else if (faceIndex==3) {\n\
						sampleDirection = vec3(uv.x, -1.0, -uv.y);\n\
					} else if (faceIndex==4) {\n\
						sampleDirection = vec3(uv.x, -uv.y, 1.0);\n\
					} else {\n\
						sampleDirection = vec3(-uv.x, -uv.y, -1.0);\n\
					}\n\
					mat3 vecSpace = matrixFromVector(normalize(sampleDirection));\n\
					vec3 rgbColor = vec3(0.0);\n\
					const int NumSamples = 1024;\n\
					vec3 vect;\n\
					float weight = 0.0;\n\
					for(int i=0; i<NumSamples; i++) {\n\
						float sini = sin(float(i));\n\
						float cosi = cos(float(i));\n\
						float r = rand(vec2(sini, cosi));\n\
						vect = ImportanceSampleGGX(vec2(float(i) / float(NumSamples), r), vecSpace, roughness);\n\
						float dotProd = dot(vect, normalize(sampleDirection));\n\
						weight += dotProd;\n\
						vec3 color = envMapTexelToLinear(textureCube(envMap,vect)).rgb;\n\
						rgbColor.rgb += color;\n\
					}\n\
					rgbColor /= float(NumSamples);\n\
					//rgbColor = testColorMap( roughness ).rgb;\n\
					gl_FragColor = linearToOutputTexel( vec4( rgbColor, 1.0 ) );\n\
				}",
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.ZeroFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.ZeroFactor,
			blendEquation: THREE.AddEquation
		} );

	}

};

/**
 * @author Prashant Sharma / spidersharma03
 * @author Ben Houston / bhouston, https://clara.io
 *
 * This class takes the cube lods(corresponding to different roughness values), and creates a single cubeUV
 * Texture. The format for a given roughness set of faces is simply::
 * +X+Y+Z
 * -X-Y-Z
 * For every roughness a mip map chain is also saved, which is essential to remove the texture artifacts due to
 * minification.
 * Right now for every face a PlaneMesh is drawn, which leads to a lot of geometry draw calls, but can be replaced
 * later by drawing a single buffer and by sending the appropriate faceIndex via vertex attributes.
 * The arrangement of the faces is fixed, as assuming this arrangement, the sampling function has been written.
 */


THREE.PMREMCubeUVPacker = function( cubeTextureLods, numLods ) {

	this.cubeLods = cubeTextureLods;
	this.numLods = numLods;
	var size = cubeTextureLods[ 0 ].width * 4;

	var sourceTexture = cubeTextureLods[ 0 ].texture;
	var params = {
		format: sourceTexture.format,
		magFilter: sourceTexture.magFilter,
		minFilter: sourceTexture.minFilter,
		type: sourceTexture.type,
		generateMipmaps: sourceTexture.generateMipmaps,
		anisotropy: sourceTexture.anisotropy,
		encoding: sourceTexture.encoding
	};

	this.CubeUVRenderTarget = new THREE.WebGLRenderTarget( size, size, params );
	this.CubeUVRenderTarget.texture.mapping = THREE.CubeUVReflectionMapping;
	this.camera = new THREE.OrthographicCamera( - size * 0.5, size * 0.5, - size * 0.5, size * 0.5, 0.0, 1000 );

	this.scene = new THREE.Scene();
	this.scene.add( this.camera );

	this.objects = [];
	var xOffset = 0;
	var faceOffsets = [];
	faceOffsets.push( new THREE.Vector2( 0, 0 ) );
	faceOffsets.push( new THREE.Vector2( 1, 0 ) );
	faceOffsets.push( new THREE.Vector2( 2, 0 ) );
	faceOffsets.push( new THREE.Vector2( 0, 1 ) );
	faceOffsets.push( new THREE.Vector2( 1, 1 ) );
	faceOffsets.push( new THREE.Vector2( 2, 1 ) );
	var yOffset = 0;
	var textureResolution = size;
	size = cubeTextureLods[ 0 ].width;

	var offset2 = 0;
	var c = 4.0;
	this.numLods = Math.log2( cubeTextureLods[ 0 ].width ) - 2;
	for ( var i = 0; i < this.numLods; i ++ ) {

		var offset1 = ( textureResolution - textureResolution / c ) * 0.5;
		if ( size > 16 )
		c *= 2;
		var nMips = size > 16 ? 6 : 1;
		var mipOffsetX = 0;
		var mipOffsetY = 0;
		var mipSize = size;

		for ( var j = 0; j < nMips; j ++ ) {

			// Mip Maps
			for ( var k = 0; k < 6; k ++ ) {

				// 6 Cube Faces
				var material = this.getShader();
				material.uniforms[ 'envMap' ].value = this.cubeLods[ i ].texture;
				material.envMap = this.cubeLods[ i ].texture;
				material.uniforms[ 'faceIndex' ].value = k;
				material.uniforms[ 'mapSize' ].value = mipSize;
				var color = material.uniforms[ 'testColor' ].value;
				//color.copy(testColor[j]);
				var planeMesh = new THREE.Mesh(
				new THREE.PlaneGeometry( mipSize, mipSize, 0 ),
				material );
				planeMesh.position.x = faceOffsets[ k ].x * mipSize - offset1 + mipOffsetX;
				planeMesh.position.y = faceOffsets[ k ].y * mipSize - offset1 + offset2 + mipOffsetY;
				planeMesh.material.side = THREE.DoubleSide;
				this.scene.add( planeMesh );
				this.objects.push( planeMesh );

			}
			mipOffsetY += 1.75 * mipSize;
			mipOffsetX += 1.25 * mipSize;
			mipSize /= 2;

		}
		offset2 += 2 * size;
		if ( size > 16 )
		size /= 2;

	}

};

THREE.PMREMCubeUVPacker.prototype = {

	constructor : THREE.PMREMCubeUVPacker,

	update: function( renderer ) {

		var gammaInput = renderer.gammaInput;
		var gammaOutput = renderer.gammaOutput;
		var toneMapping = renderer.toneMapping;
		var toneMappingExposure = renderer.toneMappingExposure;
		renderer.gammaInput = false;
		renderer.gammaOutput = false;
		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = 1.0;
		renderer.render( this.scene, this.camera, this.CubeUVRenderTarget, false );

		renderer.toneMapping = toneMapping;
		renderer.toneMappingExposure = toneMappingExposure;
		renderer.gammaInput = gammaInput;
		renderer.gammaOutput = gammaOutput;

	},

	getShader: function() {

		var shaderMaterial = new THREE.ShaderMaterial( {

			uniforms: {
				"faceIndex": { value: 0 },
				"mapSize": { value: 0 },
				"envMap": { value: null },
				"testColor": { value: new THREE.Vector3( 1, 1, 1 ) }
			},

			vertexShader:
				"precision highp float;\
				varying vec2 vUv;\
				void main() {\
					vUv = uv;\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\
				}",

			fragmentShader:
				"precision highp float;\
				varying vec2 vUv;\
				uniform samplerCube envMap;\
				uniform float mapSize;\
				uniform vec3 testColor;\
				uniform int faceIndex;\
				\
				void main() {\
					vec3 sampleDirection;\
					vec2 uv = vUv;\
					uv = uv * 2.0 - 1.0;\
					uv.y *= -1.0;\
					if(faceIndex == 0) {\
						sampleDirection = normalize(vec3(1.0, uv.y, -uv.x));\
					} else if(faceIndex == 1) {\
						sampleDirection = normalize(vec3(uv.x, 1.0, uv.y));\
					} else if(faceIndex == 2) {\
						sampleDirection = normalize(vec3(uv.x, uv.y, 1.0));\
					} else if(faceIndex == 3) {\
						sampleDirection = normalize(vec3(-1.0, uv.y, uv.x));\
					} else if(faceIndex == 4) {\
						sampleDirection = normalize(vec3(uv.x, -1.0, -uv.y));\
					} else {\
						sampleDirection = normalize(vec3(-uv.x, uv.y, -1.0));\
					}\
					vec4 color = envMapTexelToLinear( textureCube( envMap, sampleDirection ) );\
					gl_FragColor = linearToOutputTexel( color );\
				}",

			blending: THREE.CustomBlending,
			premultipliedAlpha: false,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.ZeroFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.ZeroFactor,
			blendEquation: THREE.AddEquation

		} );

		return shaderMaterial;

	}

};

/**
 * @author Nikos M. / https://github.com/foo123/
 */

// https://github.com/mrdoob/three.js/issues/5552
// http://en.wikipedia.org/wiki/RGBE_image_format

THREE.HDRLoader = THREE.RGBELoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

// extend THREE.BinaryTextureLoader
THREE.RGBELoader.prototype = Object.create( THREE.BinaryTextureLoader.prototype );

// adapted from http://www.graphics.cornell.edu/~bjw/rgbe.html
THREE.RGBELoader.prototype._parser = function( buffer ) {

	var
		/* return codes for rgbe routines */
		RGBE_RETURN_SUCCESS =  0,
		RGBE_RETURN_FAILURE = - 1,

		/* default error routine.  change this to change error handling */
		rgbe_read_error     = 1,
		rgbe_write_error    = 2,
		rgbe_format_error   = 3,
		rgbe_memory_error   = 4,
		rgbe_error = function( rgbe_error_code, msg ) {

			switch ( rgbe_error_code ) {
				case rgbe_read_error: console.error( "THREE.RGBELoader Read Error: " + ( msg || '' ) );
					break;
				case rgbe_write_error: console.error( "THREE.RGBELoader Write Error: " + ( msg || '' ) );
					break;
				case rgbe_format_error:  console.error( "THREE.RGBELoader Bad File Format: " + ( msg || '' ) );
					break;
				default:
				case rgbe_memory_error:  console.error( "THREE.RGBELoader: Error: " + ( msg || '' ) );
			}
			return RGBE_RETURN_FAILURE;

		},

		/* offsets to red, green, and blue components in a data (float) pixel */
		RGBE_DATA_RED      = 0,
		RGBE_DATA_GREEN    = 1,
		RGBE_DATA_BLUE     = 2,

		/* number of floats per pixel, use 4 since stored in rgba image format */
		RGBE_DATA_SIZE     = 4,

		/* flags indicating which fields in an rgbe_header_info are valid */
		RGBE_VALID_PROGRAMTYPE      = 1,
		RGBE_VALID_FORMAT           = 2,
		RGBE_VALID_DIMENSIONS       = 4,

		NEWLINE = "\n",

		fgets = function( buffer, lineLimit, consume ) {

			lineLimit = ! lineLimit ? 1024 : lineLimit;
			var p = buffer.pos,
				i = - 1, len = 0, s = '', chunkSize = 128,
				chunk = String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) )
			;
			while ( ( 0 > ( i = chunk.indexOf( NEWLINE ) ) ) && ( len < lineLimit ) && ( p < buffer.byteLength ) ) {

				s += chunk; len += chunk.length;
				p += chunkSize;
				chunk += String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) );

			}

			if ( - 1 < i ) {

				/*for (i=l-1; i>=0; i--) {
					byteCode = m.charCodeAt(i);
					if (byteCode > 0x7f && byteCode <= 0x7ff) byteLen++;
					else if (byteCode > 0x7ff && byteCode <= 0xffff) byteLen += 2;
					if (byteCode >= 0xDC00 && byteCode <= 0xDFFF) i--; //trail surrogate
				}*/
				if ( false !== consume ) buffer.pos += len + i + 1;
				return s + chunk.slice( 0, i );

			}
			return false;

		},

		/* minimal header reading.  modify if you want to parse more information */
		RGBE_ReadHeader = function( buffer ) {

			var line, match,

				// regexes to parse header info fields
				magic_token_re = /^#\?(\S+)$/,
				gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,
				exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,
				format_re = /^\s*FORMAT=(\S+)\s*$/,
				dimensions_re = /^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,

				// RGBE format header struct
				header = {

					valid: 0,                         /* indicate which fields are valid */

					string: '',                       /* the actual header string */

					comments: '',                     /* comments found in header */

					programtype: 'RGBE',              /* listed at beginning of file to identify it
													* after "#?".  defaults to "RGBE" */
														
					format: '',                       /* RGBE format, default 32-bit_rle_rgbe */

					gamma: 1.0,                       /* image has already been gamma corrected with
													* given gamma.  defaults to 1.0 (no correction) */
														
					exposure: 1.0,                    /* a value of 1.0 in an image corresponds to
													* <exposure> watts/steradian/m^2.
													* defaults to 1.0 */
														
					width: 0, height: 0               /* image dimensions, width/height */

				}
			;

			if ( buffer.pos >= buffer.byteLength || ! ( line = fgets( buffer ) ) ) {

				return rgbe_error( rgbe_read_error, "no header found" );

			}
			/* if you want to require the magic token then uncomment the next line */
			if ( ! ( match = line.match( magic_token_re ) ) ) {

				return rgbe_error( rgbe_format_error, "bad initial token" );

			}
			header.valid |= RGBE_VALID_PROGRAMTYPE;
			header.programtype = match[ 1 ];
			header.string += line + "\n";

			while ( true ) {

				line = fgets( buffer );
				if ( false === line ) break;
				header.string += line + "\n";

				if ( '#' === line.charAt( 0 ) ) {

					header.comments += line + "\n";
					continue; // comment line

				}

				if ( match = line.match( gamma_re ) ) {

					header.gamma = parseFloat( match[ 1 ], 10 );

				}
				if ( match = line.match( exposure_re ) ) {

					header.exposure = parseFloat( match[ 1 ], 10 );

				}
				if ( match = line.match( format_re ) ) {

					header.valid |= RGBE_VALID_FORMAT;
					header.format = match[ 1 ];//'32-bit_rle_rgbe';

				}
				if ( match = line.match( dimensions_re ) ) {

					header.valid |= RGBE_VALID_DIMENSIONS;
					header.height = parseInt( match[ 1 ], 10 );
					header.width = parseInt( match[ 2 ], 10 );

				}

				if ( ( header.valid & RGBE_VALID_FORMAT ) && ( header.valid & RGBE_VALID_DIMENSIONS ) ) break;

			}

			if ( ! ( header.valid & RGBE_VALID_FORMAT ) ) {

				return rgbe_error( rgbe_format_error, "missing format specifier" );

			}
			if ( ! ( header.valid & RGBE_VALID_DIMENSIONS ) ) {

				return rgbe_error( rgbe_format_error, "missing image size specifier" );

			}

			return header;

		},

		RGBE_ReadPixels_RLE = function( buffer, w, h ) {

			var data_rgba, offset, pos, count, byteValue,
				scanline_buffer, ptr, ptr_end, i, l, off, isEncodedRun,
				scanline_width = w, num_scanlines = h, rgbeStart
			;

			if (
				// run length encoding is not allowed so read flat
				( ( scanline_width < 8 ) || ( scanline_width > 0x7fff ) ) ||
				// this file is not run length encoded
				( ( 2 !== buffer[ 0 ] ) || ( 2 !== buffer[ 1 ] ) || ( buffer[ 2 ] & 0x80 ) )
			) {

				// return the flat buffer
				return new Uint8Array( buffer );

			}

			if ( scanline_width !== ( ( buffer[ 2 ] << 8 ) | buffer[ 3 ] ) ) {

				return rgbe_error( rgbe_format_error, "wrong scanline width" );

			}

			data_rgba = new Uint8Array( 4 * w * h );

			if ( ! data_rgba || ! data_rgba.length ) {

				return rgbe_error( rgbe_memory_error, "unable to allocate buffer space" );

			}

			offset = 0; pos = 0; ptr_end = 4 * scanline_width;
			rgbeStart = new Uint8Array( 4 );
			scanline_buffer = new Uint8Array( ptr_end );

			// read in each successive scanline
			while ( ( num_scanlines > 0 ) && ( pos < buffer.byteLength ) ) {

				if ( pos + 4 > buffer.byteLength ) {

					return rgbe_error( rgbe_read_error );

				}

				rgbeStart[ 0 ] = buffer[ pos ++ ];
				rgbeStart[ 1 ] = buffer[ pos ++ ];
				rgbeStart[ 2 ] = buffer[ pos ++ ];
				rgbeStart[ 3 ] = buffer[ pos ++ ];

				if ( ( 2 != rgbeStart[ 0 ] ) || ( 2 != rgbeStart[ 1 ] ) || ( ( ( rgbeStart[ 2 ] << 8 ) | rgbeStart[ 3 ] ) != scanline_width ) ) {

					return rgbe_error( rgbe_format_error, "bad rgbe scanline format" );

				}

				// read each of the four channels for the scanline into the buffer
				// first red, then green, then blue, then exponent
				ptr = 0;
				while ( ( ptr < ptr_end ) && ( pos < buffer.byteLength ) ) {

					count = buffer[ pos ++ ];
					isEncodedRun = count > 128;
					if ( isEncodedRun ) count -= 128;

					if ( ( 0 === count ) || ( ptr + count > ptr_end ) ) {

						return rgbe_error( rgbe_format_error, "bad scanline data" );

					}

					if ( isEncodedRun ) {

						// a (encoded) run of the same value
						byteValue = buffer[ pos ++ ];
						for ( i = 0; i < count; i ++ ) {

							scanline_buffer[ ptr ++ ] = byteValue;

						}
						//ptr += count;

					} else {

						// a literal-run
						scanline_buffer.set( buffer.subarray( pos, pos + count ), ptr );
						ptr += count; pos += count;

					}

				}


				// now convert data from buffer into rgba
				// first red, then green, then blue, then exponent (alpha)
				l = scanline_width; //scanline_buffer.byteLength;
				for ( i = 0; i < l; i ++ ) {

					off = 0;
					data_rgba[ offset ] = scanline_buffer[ i + off ];
					off += scanline_width; //1;
					data_rgba[ offset + 1 ] = scanline_buffer[ i + off ];
					off += scanline_width; //1;
					data_rgba[ offset + 2 ] = scanline_buffer[ i + off ];
					off += scanline_width; //1;
					data_rgba[ offset + 3 ] = scanline_buffer[ i + off ];
					offset += 4;

				}

				num_scanlines --;

			}

			return data_rgba;

		}
	;

	var byteArray = new Uint8Array( buffer ),
		byteLength = byteArray.byteLength;
	byteArray.pos = 0;
	var rgbe_header_info = RGBE_ReadHeader( byteArray );

	if ( RGBE_RETURN_FAILURE !== rgbe_header_info ) {

		var w = rgbe_header_info.width,
			h = rgbe_header_info.height
			, image_rgba_data = RGBE_ReadPixels_RLE( byteArray.subarray( byteArray.pos ), w, h )
		;
		if ( RGBE_RETURN_FAILURE !== image_rgba_data ) {

			return {
				width: w, height: h,
				data: image_rgba_data,
				header: rgbe_header_info.string,
				gamma: rgbe_header_info.gamma,
				exposure: rgbe_header_info.exposure,
				format: THREE.RGBEFormat, // handled as THREE.RGBAFormat in shaders
				type: THREE.UnsignedByteType
			};

		}

	}
	return null;

};

/**
* @author Prashant Sharma / spidersharma03
* @author Ben Houston / http://clara.io / bhouston
*/

THREE.HDRCubeTextureLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	// override in sub classes
	this.hdrLoader = new THREE.RGBELoader();

};

THREE.HDRCubeTextureLoader.prototype.load = function ( type, urls, onLoad, onProgress, onError ) {

	var RGBEByteToRGBFloat = function ( sourceArray, sourceOffset, destArray, destOffset ) {

		var e = sourceArray[ sourceOffset + 3 ];
		var scale = Math.pow( 2.0, e - 128.0 ) / 255.0;

		destArray[ destOffset + 0 ] = sourceArray[ sourceOffset + 0 ] * scale;
		destArray[ destOffset + 1 ] = sourceArray[ sourceOffset + 1 ] * scale;
		destArray[ destOffset + 2 ] = sourceArray[ sourceOffset + 2 ] * scale;

	};

	var RGBEByteToRGBHalf = ( function () {

		// Source: http://gamedev.stackexchange.com/questions/17326/conversion-of-a-number-from-single-precision-floating-point-representation-to-a/17410#17410

		var floatView = new Float32Array( 1 );
		var int32View = new Int32Array( floatView.buffer );

		/* This method is faster than the OpenEXR implementation (very often
		 * used, eg. in Ogre), with the additional benefit of rounding, inspired
		 * by James Tursa?s half-precision code. */
		function toHalf( val ) {

			floatView[ 0 ] = val;
			var x = int32View[ 0 ];

			var bits = ( x >> 16 ) & 0x8000; /* Get the sign */
			var m = ( x >> 12 ) & 0x07ff; /* Keep one extra bit for rounding */
			var e = ( x >> 23 ) & 0xff; /* Using int is faster here */

			/* If zero, or denormal, or exponent underflows too much for a denormal
			 * half, return signed zero. */
			if ( e < 103 ) return bits;

			/* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
			if ( e > 142 ) {

				bits |= 0x7c00;
				/* If exponent was 0xff and one mantissa bit was set, it means NaN,
						 * not Inf, so make sure we set one mantissa bit too. */
				bits |= ( ( e == 255 ) ? 0 : 1 ) && ( x & 0x007fffff );
				return bits;

			}

			/* If exponent underflows but not too much, return a denormal */
			if ( e < 113 ) {

				m |= 0x0800;
				/* Extra rounding may overflow and set mantissa to 0 and exponent
				 * to 1, which is OK. */
				bits |= ( m >> ( 114 - e ) ) + ( ( m >> ( 113 - e ) ) & 1 );
				return bits;

			}

			bits |= ( ( e - 112 ) << 10 ) | ( m >> 1 );
			/* Extra rounding. An overflow will set mantissa to 0 and increment
			 * the exponent, which is OK. */
			bits += m & 1;
			return bits;

		}

		return function ( sourceArray, sourceOffset, destArray, destOffset ) {

			var e = sourceArray[ sourceOffset + 3 ];
			var scale = Math.pow( 2.0, e - 128.0 ) / 255.0;

			destArray[ destOffset + 0 ] = toHalf( sourceArray[ sourceOffset + 0 ] * scale );
			destArray[ destOffset + 1 ] = toHalf( sourceArray[ sourceOffset + 1 ] * scale );
			destArray[ destOffset + 2 ] = toHalf( sourceArray[ sourceOffset + 2 ] * scale );

		};

	} )();

	//

	var texture = new THREE.CubeTexture();

	texture.type = type;
	texture.encoding = ( type === THREE.UnsignedByteType ) ? THREE.RGBEEncoding : THREE.LinearEncoding;
	texture.format = ( type === THREE.UnsignedByteType ) ? THREE.RGBAFormat : THREE.RGBFormat;
	texture.minFilter = ( texture.encoding === THREE.RGBEEncoding ) ? THREE.NearestFilter : THREE.LinearFilter;
	texture.magFilter = ( texture.encoding === THREE.RGBEEncoding ) ? THREE.NearestFilter : THREE.LinearFilter;
	texture.generateMipmaps = ( texture.encoding !== THREE.RGBEEncoding );
	texture.anisotropy = 0;

	var scope = this.hdrLoader;

	var loaded = 0;

	function loadHDRData( i, onLoad, onProgress, onError ) {

		var loader = new THREE.FileLoader( this.manager );
		loader.setResponseType( 'arraybuffer' );
		loader.load( urls[ i ], function ( buffer ) {

			loaded ++;

			var texData = scope._parser( buffer );

			if ( ! texData ) return;

			if ( type === THREE.FloatType ) {

				var numElements = ( texData.data.length / 4 ) * 3;
				var floatdata = new Float32Array( numElements );

				for ( var j = 0; j < numElements; j ++ ) {

					RGBEByteToRGBFloat( texData.data, j * 4, floatdata, j * 3 );

				}

				texData.data = floatdata;

			} else if ( type === THREE.HalfFloatType ) {

				var numElements = ( texData.data.length / 4 ) * 3;
				var halfdata = new Uint16Array( numElements );

				for ( var j = 0; j < numElements; j ++ ) {

					RGBEByteToRGBHalf( texData.data, j * 4, halfdata, j * 3 );

				}

				texData.data = halfdata;

			}

			if ( undefined !== texData.image ) {

				texture[ i ].images = texData.image;

			} else if ( undefined !== texData.data ) {

				var dataTexture = new THREE.DataTexture( texData.data, texData.width, texData.height );
				dataTexture.format = texture.format;
				dataTexture.type = texture.type;
				dataTexture.encoding = texture.encoding;
				dataTexture.minFilter = texture.minFilter;
				dataTexture.magFilter = texture.magFilter;
				dataTexture.generateMipmaps = texture.generateMipmaps;

				texture.images[ i ] = dataTexture;

			}

			if ( loaded === 6 ) {

				texture.needsUpdate = true;
				if ( onLoad ) onLoad( texture );

			}

		}, onProgress, onError );

	}

	for ( var i = 0; i < urls.length; i ++ ) {

		loadHDRData( i, onLoad, onProgress, onError );

	}

	return texture;

};
