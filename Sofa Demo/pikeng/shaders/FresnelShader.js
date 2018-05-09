/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Based on Nvidia Cg tutorial
 */

THREE.FresnelShader = {

	uniforms: {

		"mRefractionRatio": { value: 1.02 },
		"mFresnelBias": { value: 0.1 },
		"mFresnelPower": { value: 2.0 },
		"mFresnelScale": { value: 1.0 },
		"tCube": { value: null },

	},

	vertexShader: [

		"uniform float mRefractionRatio;",
		"uniform float mFresnelBias;",
		"uniform float mFresnelScale;",
		"uniform float mFresnelPower;",

		"varying vec3 vReflect;",
		"varying vec3 vRefract[3];",
		"varying float vReflectionFactor;",

		"void main() {",

			"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
			"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",

			"vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );",

			"vec3 I = worldPosition.xyz - cameraPosition;",

			"vReflect = reflect( I, worldNormal );",
			"vRefract[0] = refract( normalize( I ), worldNormal, mRefractionRatio );",
			"vRefract[1] = refract( normalize( I ), worldNormal, mRefractionRatio * 0.99 );",
			"vRefract[2] = refract( normalize( I ), worldNormal, mRefractionRatio * 0.98 );",
			"vReflectionFactor = mFresnelBias + mFresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), mFresnelPower );",

			"gl_Position = projectionMatrix * mvPosition;",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform samplerCube tCube;",

		"varying vec3 vReflect;",
		"varying vec3 vRefract[3];",
		"varying float vReflectionFactor;",

		"void main() {",

			"vec4 reflectedColor = textureCube( tCube, vec3( -vReflect.x, vReflect.yz ) );",
			"vec4 refractedColor = vec4( 1.0 );",

			"refractedColor.r = textureCube( tCube, vec3( -vRefract[0].x, vRefract[0].yz ) ).r;",
			"refractedColor.g = textureCube( tCube, vec3( -vRefract[1].x, vRefract[1].yz ) ).g;",
			"refractedColor.b = textureCube( tCube, vec3( -vRefract[2].x, vRefract[2].yz ) ).b;",

			"gl_FragColor = mix( refractedColor, reflectedColor, clamp( vReflectionFactor, 0.0, 1.0 ) );",

		"}"

	].join( "\n" )

};

THREE.FresnelShaderAlt = {

	uniforms: {
        color: {
          type: "c",
          value: new THREE.Color(0xCDA776),
        },
        fresnelBias: {
          type: "f",
          value: 0.8 // 0.1
        },
        fresnelScale: {
          type: "f",
          value: -1.0 // 1.0
        },
        fresnelPower: {
          type: 'f',
          value: 2.0 
        }
    },

	vertexShader: [

		"uniform float fresnelBias;",
		"uniform float fresnelScale;",
		"uniform float fresnelPower;",

		"varying float vReflectionFactor;",
		"varying vec3 vReflect;",

		"void main() {",
		  "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
		  "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",

		  "vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );",

		  "vec3 I = worldPosition.xyz - cameraPosition;",
		  
		  "vReflect = reflect( I, worldNormal );",
		  "vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );",

		  "gl_Position = projectionMatrix * mvPosition;",
		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform vec3 color;",
		"uniform samplerCube envMap;",

		"varying vec3 vReflect;",
		"varying float vReflectionFactor;",

		"void main() {",
		  "vec4 envColor = textureCube( envMap, vec3( -vReflect.x, vReflect.yz ) );",
		  "gl_FragColor = vec4(mix(color, envColor.xyz, vec3(clamp( vReflectionFactor, 0.0, 1.0 ))), 1.0);",
		"}"

	].join( "\n" )

};

THREE.TestShader = {

	uniforms: {
        color: {
          type: "c",
          value: new THREE.Color(0xCDA776),
        },
        fresnelBias: {
          type: "f",
          value: 0.8 // 0.1
        },
        fresnelScale: {
          type: "f",
          value: -1.0 // 1.0
        },
        fresnelPower: {
          type: 'f',
          value: 2.0 
        },
		amplitude: {
			type: 'f', // a float
			value: 0
		}

    },

	vertexShader: [

		"uniform float amplitude;",
		"attribute float displacement;",
		"varying vec3 vNormal;",
		"void main() {",
			"vNormal = normal;",
			"vec3 newPosition;",
			"newPosition = position + normal * vec3(displacement * amplitude);",
  			"gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition,1.0);",
		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform vec3 color;",
		"varying vec3 vNormal;",
		"void main() {",
			"vec3 light = vec3(0.5, 0.2, 1.0);",
			"light = normalize(light);",
			"float dProd = max(0.0,dot(vNormal, light));",
			"gl_FragColor = vec4(color[0]*dProd, color[1]*dProd, color[2]*dProd,1.0);",
		"}"

	].join( "\n" )

};