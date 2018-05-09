    /**
     * @author mrdoob / http://mrdoob.com/
     */



    /**
     * @author mrdoob / http://mrdoob.com/
     * @author *kile / http://kile.stravaganza.org/
     * @author philogb / http://blog.thejit.org/
     * @author mikael emtinger / http://gomo.se/
     * @author egraether / http://egraether.com/
     * @author WestLangley / http://github.com/WestLangley
     */

var Vector3 = function ( x, y, z ) {

        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;

    }

Vector3.prototype = {


    isVector3: true,



    subVectors: function ( a, b ) {

        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;

        return this;

    },

    cross: function ( v, w ) {

        if ( w !== undefined ) {

            console.warn( 'THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead.' );
            return this.crossVectors( v, w );

        }

        var x = this.x, y = this.y, z = this.z;

        this.x = y * v.z - z * v.y;
        this.y = z * v.x - x * v.z;
        this.z = x * v.y - y * v.x;

        return this;

    },

    crossVectors: function ( a, b ) {

        var ax = a.x, ay = a.y, az = a.z;
        var bx = b.x, by = b.y, bz = b.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;

        return this;

    },

    fromArray: function ( array, offset ) {

        if ( offset === undefined ) offset = 0;

        this.x = array[ offset ];
        this.y = array[ offset + 1 ];
        this.z = array[ offset + 2 ];

        return this;

    },
};



// self.addEventListener('message', function(e) {
//   self.postMessage(e.data);
// }, false);

    /**
     * @author alteredq / http://alteredqualia.com/
     * @author mrdoob / http://mrdoob.com/
     */


self.addEventListener('message', function( message ) {


    var indices =  message.data.indices;
    var positions =  new Float32Array(message.data.positions) ;
    var normals = new Float32Array( positions.length);
    groups = [];


    console.log('pos count ' + positions.length);


        // var positions = attributes.position.array;


        // var normals = attributes.normal.array;

        var vA, vB, vC, x, y, z, n;
        var pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
        var cb = new Vector3(), ab = new Vector3();

        // indexed elements

        // var indices = index.array;

        // if ( groups.length === 0 ) {

        //     this.addGroup( 0, indices.length );

        // }

    // self.postMessage(normals.array);

    // return;


            for ( var i = 0, il = indices.length; i < il; i += 3 ) {

                vA = indices[ i + 0 ] * 3;
                vB = indices[ i + 1 ] * 3;
                vC = indices[ i + 2 ] * 3;
                // we can stip out all uneeded vector3 stuff
                pA.fromArray( positions, vA );
                pB.fromArray( positions, vB );
                pC.fromArray( positions, vC );

                cb.subVectors( pC, pB );
                ab.subVectors( pA, pB );
                cb.cross( ab );

                // if (i ===0 ) {
                //     console.log(cb.x);
                //     console.log(cb.y);
                //     console.log(cb.z);
                // }

                normals[ vA ] += cb.x;
                normals[ vA + 1 ] += cb.y;
                normals[ vA + 2 ] += cb.z;

                normals[ vB ] += cb.x;
                normals[ vB + 1 ] += cb.y;
                normals[ vB + 2 ] += cb.z;

                normals[ vC ] += cb.x;
                normals[ vC + 1 ] += cb.y;
                normals[ vC + 2 ] += cb.z;

            }


            for ( i = 0, il = normals.length; i < il; i += 3 ) {

                x = normals[ i ];
                y = normals[ i + 1 ];
                z = normals[ i + 2 ];

                n = 1.0 / Math.sqrt( x * x + y * y + z * z );

                normals[ i ] *= n;
                normals[ i + 1 ] *= n;
                normals[ i + 2 ] *= n;

            }




        // var geometries = this.splitGeometryByMatIds( geometry );

        var objData = {
            indices: indices,
            // positions : positions,
            normals: normals   
        };

        // self.postMessage( objData );
        self.postMessage( objData, [objData.indices.buffer, objData.normals.buffer]  );


}, false);