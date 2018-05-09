/* George Fuller 01/02/2017
  Merging of all components for pikctm support

  lzma.js"
  pikctm-format.js
  PIKCTMLoader.js

  // VERSION 2.0
  // Includes support for .bin files exported from the material maker.

*/

// LZMA decomression used by the original ctm format DEPRECATED

var LZMAD = LZMAD || {};

// browserify support
if ( typeof module === 'object' ) {

  module.exports = LZMAD;

}

LZMAD.OutWindow = function() {
  this._windowSize = 0;
};

LZMAD.OutWindow.prototype.create = function(windowSize) {
  if ( (!this._buffer) || (this._windowSize !== windowSize) ) {
    this._buffer = [];
  }
  this._windowSize = windowSize;
  this._pos = 0;
  this._streamPos = 0;
};

LZMAD.OutWindow.prototype.flush = function() {
  var size = this._pos - this._streamPos;
  if (size !== 0) {
    while (size --) {
      this._stream.writeByte(this._buffer[this._streamPos ++]);
    }
    if (this._pos >= this._windowSize) {
      this._pos = 0;
    }
    this._streamPos = this._pos;
  }
};

LZMAD.OutWindow.prototype.releaseStream = function() {
  this.flush();
  this._stream = null;
};

LZMAD.OutWindow.prototype.setStream = function(stream) {
  this.releaseStream();
  this._stream = stream;
};

LZMAD.OutWindow.prototype.init = function(solid) {
  if (!solid) {
    this._streamPos = 0;
    this._pos = 0;
  }
};

LZMAD.OutWindow.prototype.copyBlock = function(distance, len) {
  var pos = this._pos - distance - 1;
  if (pos < 0) {
    pos += this._windowSize;
  }
  while (len --) {
    if (pos >= this._windowSize) {
      pos = 0;
    }
    this._buffer[this._pos ++] = this._buffer[pos ++];
    if (this._pos >= this._windowSize) {
      this.flush();
    }
  }
};

LZMAD.OutWindow.prototype.putByte = function(b) {
  this._buffer[this._pos ++] = b;
  if (this._pos >= this._windowSize) {
    this.flush();
  }
};

LZMAD.OutWindow.prototype.getByte = function(distance) {
  var pos = this._pos - distance - 1;
  if (pos < 0) {
    pos += this._windowSize;
  }
  return this._buffer[pos];
};

LZMAD.RangeDecoder = function() {
};

LZMAD.RangeDecoder.prototype.setStream = function(stream) {
  this._stream = stream;
};

LZMAD.RangeDecoder.prototype.releaseStream = function() {
  this._stream = null;
};

LZMAD.RangeDecoder.prototype.init = function() {
  var i = 5;

  this._code = 0;
  this._range = -1;
  
  while (i --) {
    this._code = (this._code << 8) | this._stream.readByte();
  }
};

LZMAD.RangeDecoder.prototype.decodeDirectBits = function(numTotalBits) {
  var result = 0, i = numTotalBits, t;

  while (i --) {
    this._range >>>= 1;
    t = (this._code - this._range) >>> 31;
    this._code -= this._range & (t - 1);
    result = (result << 1) | (1 - t);

    if ( (this._range & 0xff000000) === 0) {
      this._code = (this._code << 8) | this._stream.readByte();
      this._range <<= 8;
    }
  }

  return result;
};

LZMAD.RangeDecoder.prototype.decodeBit = function(probs, index) {
  var prob = probs[index],
      newBound = (this._range >>> 11) * prob;

  if ( (this._code ^ 0x80000000) < (newBound ^ 0x80000000) ) {
    this._range = newBound;
    probs[index] += (2048 - prob) >>> 5;
    if ( (this._range & 0xff000000) === 0) {
      this._code = (this._code << 8) | this._stream.readByte();
      this._range <<= 8;
    }
    return 0;
  }

  this._range -= newBound;
  this._code -= newBound;
  probs[index] -= prob >>> 5;
  if ( (this._range & 0xff000000) === 0) {
    this._code = (this._code << 8) | this._stream.readByte();
    this._range <<= 8;
  }
  return 1;
};

LZMAD.initBitModels = function(probs, len) {
  while (len --) {
    probs[len] = 1024;
  }
};

LZMAD.BitTreeDecoder = function(numBitLevels) {
  this._models = [];
  this._numBitLevels = numBitLevels;
};

LZMAD.BitTreeDecoder.prototype.init = function() {
  LZMAD.initBitModels(this._models, 1 << this._numBitLevels);
};

LZMAD.BitTreeDecoder.prototype.decode = function(rangeDecoder) {
  var m = 1, i = this._numBitLevels;

  while (i --) {
    m = (m << 1) | rangeDecoder.decodeBit(this._models, m);
  }
  return m - (1 << this._numBitLevels);
};

LZMAD.BitTreeDecoder.prototype.reverseDecode = function(rangeDecoder) {
  var m = 1, symbol = 0, i = 0, bit;

  for (; i < this._numBitLevels; ++ i) {
    bit = rangeDecoder.decodeBit(this._models, m);
    m = (m << 1) | bit;
    symbol |= bit << i;
  }
  return symbol;
};

LZMAD.reverseDecode2 = function(models, startIndex, rangeDecoder, numBitLevels) {
  var m = 1, symbol = 0, i = 0, bit;

  for (; i < numBitLevels; ++ i) {
    bit = rangeDecoder.decodeBit(models, startIndex + m);
    m = (m << 1) | bit;
    symbol |= bit << i;
  }
  return symbol;
};

LZMAD.LenDecoder = function() {
  this._choice = [];
  this._lowCoder = [];
  this._midCoder = [];
  this._highCoder = new LZMAD.BitTreeDecoder(8);
  this._numPosStates = 0;
};

LZMAD.LenDecoder.prototype.create = function(numPosStates) {
  for (; this._numPosStates < numPosStates; ++ this._numPosStates) {
    this._lowCoder[this._numPosStates] = new LZMAD.BitTreeDecoder(3);
    this._midCoder[this._numPosStates] = new LZMAD.BitTreeDecoder(3);
  }
};

LZMAD.LenDecoder.prototype.init = function() {
  var i = this._numPosStates;
  LZMAD.initBitModels(this._choice, 2);
  while (i --) {
    this._lowCoder[i].init();
    this._midCoder[i].init();
  }
  this._highCoder.init();
};

LZMAD.LenDecoder.prototype.decode = function(rangeDecoder, posState) {
  if (rangeDecoder.decodeBit(this._choice, 0) === 0) {
    return this._lowCoder[posState].decode(rangeDecoder);
  }
  if (rangeDecoder.decodeBit(this._choice, 1) === 0) {
    return 8 + this._midCoder[posState].decode(rangeDecoder);
  }
  return 16 + this._highCoder.decode(rangeDecoder);
};

LZMAD.Decoder2 = function() {
  this._decoders = [];
};

LZMAD.Decoder2.prototype.init = function() {
  LZMAD.initBitModels(this._decoders, 0x300);
};

LZMAD.Decoder2.prototype.decodeNormal = function(rangeDecoder) {
  var symbol = 1;

  do {
    symbol = (symbol << 1) | rangeDecoder.decodeBit(this._decoders, symbol);
  }while (symbol < 0x100);

  return symbol & 0xff;
};

LZMAD.Decoder2.prototype.decodeWithMatchByte = function(rangeDecoder, matchByte) {
  var symbol = 1, matchBit, bit;

  do {
    matchBit = (matchByte >> 7) & 1;
    matchByte <<= 1;
    bit = rangeDecoder.decodeBit(this._decoders, ( (1 + matchBit) << 8) + symbol);
    symbol = (symbol << 1) | bit;
    if (matchBit !== bit) {
      while (symbol < 0x100) {
        symbol = (symbol << 1) | rangeDecoder.decodeBit(this._decoders, symbol);
      }
      break;
    }
  }while (symbol < 0x100);

  return symbol & 0xff;
};

LZMAD.LiteralDecoder = function() {
};

LZMAD.LiteralDecoder.prototype.create = function(numPosBits, numPrevBits) {
  var i;

  if (this._coders
    && (this._numPrevBits === numPrevBits)
    && (this._numPosBits === numPosBits) ) {
    return;
  }
  this._numPosBits = numPosBits;
  this._posMask = (1 << numPosBits) - 1;
  this._numPrevBits = numPrevBits;

  this._coders = [];

  i = 1 << (this._numPrevBits + this._numPosBits);
  while (i --) {
    this._coders[i] = new LZMAD.Decoder2();
  }
};

LZMAD.LiteralDecoder.prototype.init = function() {
  var i = 1 << (this._numPrevBits + this._numPosBits);
  while (i --) {
    this._coders[i].init();
  }
};

LZMAD.LiteralDecoder.prototype.getDecoder = function(pos, prevByte) {
  return this._coders[( (pos & this._posMask) << this._numPrevBits)
    + ( (prevByte & 0xff) >>> (8 - this._numPrevBits) )];
};

LZMAD.Decoder = function() {
  this._outWindow = new LZMAD.OutWindow();
  this._rangeDecoder = new LZMAD.RangeDecoder();
  this._isMatchDecoders = [];
  this._isRepDecoders = [];
  this._isRepG0Decoders = [];
  this._isRepG1Decoders = [];
  this._isRepG2Decoders = [];
  this._isRep0LongDecoders = [];
  this._posSlotDecoder = [];
  this._posDecoders = [];
  this._posAlignDecoder = new LZMAD.BitTreeDecoder(4);
  this._lenDecoder = new LZMAD.LenDecoder();
  this._repLenDecoder = new LZMAD.LenDecoder();
  this._literalDecoder = new LZMAD.LiteralDecoder();
  this._dictionarySize = -1;
  this._dictionarySizeCheck = -1;

  this._posSlotDecoder[0] = new LZMAD.BitTreeDecoder(6);
  this._posSlotDecoder[1] = new LZMAD.BitTreeDecoder(6);
  this._posSlotDecoder[2] = new LZMAD.BitTreeDecoder(6);
  this._posSlotDecoder[3] = new LZMAD.BitTreeDecoder(6);
};

LZMAD.Decoder.prototype.setDictionarySize = function(dictionarySize) {
  if (dictionarySize < 0) {
    return false;
  }
  if (this._dictionarySize !== dictionarySize) {
    this._dictionarySize = dictionarySize;
    this._dictionarySizeCheck = Math.max(this._dictionarySize, 1);
    this._outWindow.create( Math.max(this._dictionarySizeCheck, 4096) );
  }
  return true;
};

LZMAD.Decoder.prototype.setLcLpPb = function(lc, lp, pb) {
  var numPosStates = 1 << pb;

  if (lc > 8 || lp > 4 || pb > 4) {
    return false;
  }

  this._literalDecoder.create(lp, lc);

  this._lenDecoder.create(numPosStates);
  this._repLenDecoder.create(numPosStates);
  this._posStateMask = numPosStates - 1;

  return true;
};

LZMAD.Decoder.prototype.init = function() {
  var i = 4;

  this._outWindow.init(false);

  LZMAD.initBitModels(this._isMatchDecoders, 192);
  LZMAD.initBitModels(this._isRep0LongDecoders, 192);
  LZMAD.initBitModels(this._isRepDecoders, 12);
  LZMAD.initBitModels(this._isRepG0Decoders, 12);
  LZMAD.initBitModels(this._isRepG1Decoders, 12);
  LZMAD.initBitModels(this._isRepG2Decoders, 12);
  LZMAD.initBitModels(this._posDecoders, 114);

  this._literalDecoder.init();

  while (i --) {
    this._posSlotDecoder[i].init();
  }

  this._lenDecoder.init();
  this._repLenDecoder.init();
  this._posAlignDecoder.init();
  this._rangeDecoder.init();
};

LZMAD.Decoder.prototype.decode = function(inStream, outStream, outSize) {
  var state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, nowPos64 = 0, prevByte = 0,
      posState, decoder2, len, distance, posSlot, numDirectBits;

  this._rangeDecoder.setStream(inStream);
  this._outWindow.setStream(outStream);

  this.init();

  while (outSize < 0 || nowPos64 < outSize) {
    posState = nowPos64 & this._posStateMask;

    if (this._rangeDecoder.decodeBit(this._isMatchDecoders, (state << 4) + posState) === 0) {
      decoder2 = this._literalDecoder.getDecoder(nowPos64 ++, prevByte);

      if (state >= 7) {
        prevByte = decoder2.decodeWithMatchByte(this._rangeDecoder, this._outWindow.getByte(rep0) );
      }else {
        prevByte = decoder2.decodeNormal(this._rangeDecoder);
      }
      this._outWindow.putByte(prevByte);

      state = state < 4 ? 0 : state - (state < 10 ? 3 : 6);

    }else {

      if (this._rangeDecoder.decodeBit(this._isRepDecoders, state) === 1) {
        len = 0;
        if (this._rangeDecoder.decodeBit(this._isRepG0Decoders, state) === 0) {
          if (this._rangeDecoder.decodeBit(this._isRep0LongDecoders, (state << 4) + posState) === 0) {
            state = state < 7 ? 9 : 11;
            len = 1;
          }
        }else {
          if (this._rangeDecoder.decodeBit(this._isRepG1Decoders, state) === 0) {
            distance = rep1;
          }else {
            if (this._rangeDecoder.decodeBit(this._isRepG2Decoders, state) === 0) {
              distance = rep2;
            }else {
              distance = rep3;
              rep3 = rep2;
            }
            rep2 = rep1;
          }
          rep1 = rep0;
          rep0 = distance;
        }
        if (len === 0) {
          len = 2 + this._repLenDecoder.decode(this._rangeDecoder, posState);
          state = state < 7 ? 8 : 11;
        }
      }else {
        rep3 = rep2;
        rep2 = rep1;
        rep1 = rep0;

        len = 2 + this._lenDecoder.decode(this._rangeDecoder, posState);
        state = state < 7 ? 7 : 10;

        posSlot = this._posSlotDecoder[len <= 5 ? len - 2 : 3].decode(this._rangeDecoder);
        if (posSlot >= 4) {

          numDirectBits = (posSlot >> 1) - 1;
          rep0 = (2 | (posSlot & 1) ) << numDirectBits;

          if (posSlot < 14) {
            rep0 += LZMAD.reverseDecode2(this._posDecoders,
                rep0 - posSlot - 1, this._rangeDecoder, numDirectBits);
          }else {
            rep0 += this._rangeDecoder.decodeDirectBits(numDirectBits - 4) << 4;
            rep0 += this._posAlignDecoder.reverseDecode(this._rangeDecoder);
            if (rep0 < 0) {
              if (rep0 === -1) {
                break;
              }
              return false;
            }
          }
        }else {
          rep0 = posSlot;
        }
      }

      if (rep0 >= nowPos64 || rep0 >= this._dictionarySizeCheck) {
        return false;
      }

      this._outWindow.copyBlock(rep0, len);
      nowPos64 += len;
      prevByte = this._outWindow.getByte(0);
    }
  }

  this._outWindow.flush();
  this._outWindow.releaseStream();
  this._rangeDecoder.releaseStream();

  return true;
};

LZMAD.Decoder.prototype.setDecoderProperties = function(properties) {
  var value, lc, lp, pb, dictionarySize;

  if (properties.size < 5) {
    return false;
  }

  value = properties.readByte();
  lc = value % 9;
  value = ~~(value / 9);
  lp = value % 5;
  pb = ~~(value / 5);

  if ( !this.setLcLpPb(lc, lp, pb) ) {
    return false;
  }

  dictionarySize = properties.readByte();
  dictionarySize |= properties.readByte() << 8;
  dictionarySize |= properties.readByte() << 16;
  dictionarySize += properties.readByte() * 16777216;

  return this.setDictionarySize(dictionarySize);
};

LZMAD.decompress = function(properties, inStream, outStream, outSize) {
  var decoder = new LZMAD.Decoder();

  if ( !decoder.setDecoderProperties(properties) ) {
    throw "Incorrect stream properties";
  }

  if ( !decoder.decode(inStream, outStream, outSize) ) {
    throw "Error in data stream";
    // Use backup lzma decompressor instead of throwing an error.

  }

  return true;
};


/*
Copyright (c) 2011 Juan Mellado
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
References:
- "OpenCTM: The Open Compressed Triangle Mesh file format" by Marcus Geelnard
  http://openctm.sourceforge.net/
*/

var CTM = CTM || {};

CTM.profiling = false;
CTM.debugging = false;

CTM.CompressionMethod = {
  RAW: 0x00574152,
  MG1: 0x0031474d,
  MG2: 0x0032474d
};

CTM.Flags = {
  NORMALS: 0x00000001,
  SMOOTH:  0x00000010,
  MATID:   0x00000100,
};

CTM.File = function(stream, alt){
  this.load(stream, alt);
};

CTM.File.prototype.load = function(stream, alt){
  this.header = new CTM.FileHeader(stream);

  this.body = new CTM.FileBody(this.header);

  this.getReader().read(stream, this.body, alt);
};

CTM.File.prototype.getReader = function(){
  var reader;

  switch(this.header.compressionMethod){
    case CTM.CompressionMethod.RAW:
      reader = new CTM.ReaderRAW();
      break;
    case CTM.CompressionMethod.MG1:
      reader = new CTM.ReaderMG1();
      break;
    case CTM.CompressionMethod.MG2:
      reader = new CTM.ReaderMG2();
      break;
  }

  return reader;
};

CTM.FileHeader = function(stream){
  stream.readInt32(); //magic "OCTM"
  this.fileFormat = stream.readInt32();
  this.compressionMethod = stream.readInt32();
  this.vertexCount = stream.readInt32();
  this.triangleCount = stream.readInt32();
  this.uvMapCount = stream.readInt32();
  this.attrMapCount = stream.readInt32();
  this.flags = stream.readInt32();
  this.comment = stream.readString();
};

CTM.FileHeader.prototype.hasNormals = function(){
  return this.flags & CTM.Flags.NORMALS;
};

CTM.FileHeader.prototype.hasSmooth = function(){
  return this.flags & CTM.Flags.SMOOTH;
};

CTM.FileHeader.prototype.hasMatID = function(){
  return this.flags & CTM.Flags.MATID;
};

CTM.FileBody = function(header){
  var i = header.triangleCount * 3,
      v = header.vertexCount * 3,
      n = header.hasNormals()? header.vertexCount * 3: 0,
      s = header.hasSmooth()? header.triangleCount: 0,
      m = header.hasMatID()? header.triangleCount: 0,
      u = header.vertexCount * 2,
      a = header.vertexCount * 4,
      j = 0;

  var data = new ArrayBuffer(
    (i + v + n + s + m + (u * header.uvMapCount) + (a * header.attrMapCount) ) * 4);

  this.indices = new Uint32Array(data, 0, i);

  this.vertices = new Float32Array(data, i * 4, v);

  if ( header.hasNormals() ){
    this.normals = new Float32Array(data, (i + v) * 4, n);
  }
  if ( header.hasSmooth() ){
    this.Smooth = new Uint32Array(data, (i + v + n) * 4, s);
  }
  if ( header.hasMatID() ){
    this.MatID = new Uint32Array(data, (i + v + n + s) * 4, m);
  }
  if (header.uvMapCount){
    this.uvMaps = [];
    for (j = 0; j < header.uvMapCount; ++ j){
      this.uvMaps[j] = {uv: new Float32Array(data,
        (i + v + n + s + m + (j * u) ) * 4, u) };
    }
  }
  if (header.attrMapCount){
    this.attrMaps = [];
    for (j = 0; j < header.attrMapCount; ++ j){
      this.attrMaps[j] = {attr: new Float32Array(data,
        (i + v + n + s + m + (u * header.uvMapCount) + (j * a) ) * 4, a) };
    }
  }
};

CTM.FileMG2Header = function(stream){
  stream.readInt32(); //magic "MG2H"
  this.vertexPrecision = stream.readFloat32();
  this.normalPrecision = stream.readFloat32();
  this.lowerBoundx = stream.readFloat32();
  this.lowerBoundy = stream.readFloat32();
  this.lowerBoundz = stream.readFloat32();
  this.higherBoundx = stream.readFloat32();
  this.higherBoundy = stream.readFloat32();
  this.higherBoundz = stream.readFloat32();
  this.divx = stream.readInt32();
  this.divy = stream.readInt32();
  this.divz = stream.readInt32();

  this.sizex = (this.higherBoundx - this.lowerBoundx) / this.divx;
  this.sizey = (this.higherBoundy - this.lowerBoundy) / this.divy;
  this.sizez = (this.higherBoundz - this.lowerBoundz) / this.divz;
};

CTM.ReaderRAW = function(){
};

CTM.ReaderRAW.prototype.read = function(stream, body){
  this.readIndices(stream, body.indices);
  this.readVertices(stream, body.vertices);

  if (body.normals){
    this.readNormals(stream, body);
  }

  if (body.smooth){
    this.readSmooth(stream, body.smooth);
  }

  if (body.matID){
    this.readMatID(stream, body.MatID);
  }

  if (body.uvMaps){
    this.readUVMaps(stream, body.uvMaps);
  }
  if (body.attrMaps){
    this.readAttrMaps(stream, body.attrMaps);
  }
};

CTM.ReaderRAW.prototype.readIndices = function(stream, indices){
  stream.readInt32(); //magic "INDX"
  stream.readArrayInt32(indices);
};

CTM.ReaderRAW.prototype.readVertices = function(stream, vertices){
  stream.readInt32(); //magic "VERT"
  stream.readArrayFloat32(vertices);
};

CTM.ReaderRAW.prototype.readNormals = function(stream, body){
  stream.readInt32(); //magic "NORM"
  stream.readArrayFloat32(body);
};

CTM.ReaderRAW.prototype.readSmooth = function(stream, smooth){
  stream.readInt32(); //magic "FSMG"
  stream.readArrayInt32(smooth);
};

CTM.ReaderRAW.prototype.readMatID = function(stream, smooth){
  stream.readInt32(); //magic "FMID"
  stream.readArrayInt32(smooth);
};


CTM.ReaderRAW.prototype.readUVMaps = function(stream, uvMaps){
  var i = 0;
  for (; i < uvMaps.length; ++ i){
    stream.readInt32(); //magic "TEXC"

    uvMaps[i].name = stream.readString();
    uvMaps[i].filename = stream.readString();
    stream.readArrayFloat32(uvMaps[i].uv);
  }
};

CTM.ReaderRAW.prototype.readAttrMaps = function(stream, attrMaps){
  var i = 0;
  for (; i < attrMaps.length; ++ i){
    stream.readInt32(); //magic "ATTR"

    attrMaps[i].name = stream.readString();
    stream.readArrayFloat32(attrMaps[i].attr);
  }
};

CTM.ReaderMG1 = function(){
};

CTM.ReaderMG1.prototype.read = function(stream, body){
  this.readIndices(stream, body.indices);
  this.readVertices(stream, body.vertices);

  if (body.normals){
    this.readNormals(stream, body);
  }
  if (body.smooth){
    this.readSmooth(stream, body.smooth);
  }
  if (body.matID){
    this.readMatID(stream, body.matID);
  }
  if (body.uvMaps){
    this.readUVMaps(stream, body.uvMaps);
  }
  if (body.attrMaps){
    this.readAttrMaps(stream, body.attrMaps);
  }
};

CTM.ReaderMG1.prototype.readIndices = function(stream, indices){
  stream.readInt32(); //magic "INDX"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(indices, 3);
  CTM.decompress(stream, size, interleaved);

  CTM.restoreIndices(indices, indices.length);
};

CTM.ReaderMG1.prototype.readVertices = function(stream, vertices){
  stream.readInt32(); //magic "VERT"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(vertices, 1);
  CTM.decompress(stream, size, interleaved);
};

CTM.ReaderMG1.prototype.readNormals = function(stream, normals){
  stream.readInt32(); //magic "NORM"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(normals, 3);
  CTM.decompress(stream, size, interleaved);
};

CTM.ReaderMG1.prototype.readSmooth = function(stream, smooth){
  stream.readInt32(); //magic "FSMG"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(smooth, 1);
  CTM.decompress(stream, size, interleaved);
};

CTM.ReaderMG1.prototype.readMatID = function(stream, matID){
  stream.readInt32(); //magic "FMID"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(matID, 1);
  CTM.decompress(stream, size, interleaved);
};

CTM.ReaderMG1.prototype.readUVMaps = function(stream, uvMaps){
  var i = 0;
  for (; i < uvMaps.length; ++ i){
    stream.readInt32(); //magic "TEXC"

    uvMaps[i].name = stream.readString();
    uvMaps[i].filename = stream.readString();

    var size = stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(uvMaps[i].uv, 2);
    CTM.decompress(stream, size, interleaved);
  }
};

CTM.ReaderMG1.prototype.readAttrMaps = function(stream, attrMaps){
  var i = 0;
  for (; i < attrMaps.length; ++ i){
    stream.readInt32(); //magic "ATTR"

    attrMaps[i].name = stream.readString();

    var size = stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(attrMaps[i].attr, 4);
    CTM.decompress(stream, size, interleaved);
  }
};

CTM.ReaderMG2 = function(){
};

CTM.ReaderMG2.prototype.read = function(stream, body, alt){
  this.MG2Header = new CTM.FileMG2Header(stream);

  this.readVertices(stream, body.vertices, alt);
  this.readIndices(stream, body.indices, alt);

  if (body.normals){
    this.readNormals(stream, body);
  }
  if (body.Smooth){
    this.readSmooth(stream, body.Smooth);
  }
  if (body.MatID){
    this.readMatID(stream, body.MatID);
  }
  if (body.uvMaps){
    this.readUVMaps(stream, body.uvMaps, alt);
  }
  if (body.attrMaps){
    this.readAttrMaps(stream, body.attrMaps);
  }
};

CTM.ReaderMG2.prototype.readVertices = function(stream, vertices, alt){
  stream.readInt32(); //magic "VERT"
  var size = stream.readInt32(); //packed sizer

  var interleaved = new CTM.InterleavedStream(vertices, 3);
  if (CTM.profiling)
    console.time( "Decompress verts" );
  CTM.decompress(stream, size, interleaved, vertices, alt);
  if (CTM.profiling)
    console.timeEnd( "Decompress verts" );

  if (CTM.profiling)
    console.time( "Read Grid Indices" );
  var gridIndices = this.readGridIndices(stream, vertices, alt);
  if (CTM.profiling)
    console.timeEnd( "Read Grid Indices" );

  if (CTM.profiling)
    console.time( "Restore Vertices" );
  if ( alt )
    CTM.CustomRestoreVertices( vertices, this.MG2Header, gridIndices );
  else
    CTM.restoreVertices(vertices, this.MG2Header, gridIndices, this.MG2Header.vertexPrecision);
  if (CTM.profiling)
    console.timeEnd( "Restore Vertices" );
  
};

CTM.CustomRestoreVertices = function ( vertices, mg2Header, gridIndices ) {

  var grid = mg2Header;
  var precision = mg2Header.vertexPrecision;

    var gridIdx, delta, x, y, z,
      ydiv = grid.divx, zdiv = ydiv * grid.divy,
      prevGridIdx = 0x7fffffff, prevDelta = 0,
      i = 0, j = 0, len = gridIndices.length;

  for (; i < len; j += 3){
    x = gridIdx = gridIndices[i ++];

    z = ~~(x / zdiv);
    x -= ~~(z * zdiv);
    y = ~~(x / ydiv);
    x -= ~~(y * ydiv);

    delta = vertices[j];
    if (gridIdx === prevGridIdx){
      delta += prevDelta;
    }

    vertices[j]     = grid.lowerBoundx +
      x * grid.sizex + precision * delta;
    vertices[j + 1] = grid.lowerBoundy +
      y * grid.sizey + precision * vertices[j + 1];
    vertices[j + 2] = grid.lowerBoundz +
      z * grid.sizez + precision * vertices[j + 2];

    prevGridIdx = gridIdx;
    prevDelta = delta;
  }

  vertices = null;

}


CTM.ReaderMG2.prototype.readGridIndices = function(stream, vertices, alt){
  stream.readInt32(); //magic "GIDX"
  var size = stream.readInt32(); //packed size

  var gridIndices = new Uint32Array(vertices.length / 3);

  var interleaved = new CTM.InterleavedStream(gridIndices, 1);
  CTM.decompress(stream, size, interleaved, gridIndices, alt);

  CTM.restoreGridIndices(gridIndices, gridIndices.length);

  return gridIndices;
};

CTM.ReaderMG2.prototype.readIndices = function(stream, indices, alt){
  stream.readInt32(); //magic "INDX"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(indices, 3);
  if (CTM.profiling)
    console.time("Decompress indices");
  CTM.decompress(stream, size, interleaved, indices, alt);
  if (CTM.profiling)
    console.timeEnd("Decompress indices");

  if (CTM.profiling)
    console.time("Restore indices");
  if ( alt )
    CTM.CustomRestoreIndices( indices );
  else
    CTM.restoreIndices(indices, indices.length);
  if (CTM.profiling)
    console.timeEnd("Restore indices");

};

CTM.ReaderMG2.prototype.readNormals = function(stream, body){
  stream.readInt32(); //magic "NORM"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(body.normals, 3);
  CTM.decompress(stream, size, interleaved);

  var smooth = CTM.calcSmoothNormals(body.indices, body.vertices);

  CTM.restoreNormals(body.normals, smooth, this.MG2Header.normalPrecision);
};

CTM.ReaderMG2.prototype.readSmooth = function(stream, smooth){
  stream.readInt32(); //magic "FSMG"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(smooth, 1);
  CTM.decompress(stream, size, interleaved);
  // need restore?
};

CTM.ReaderMG2.prototype.readMatID = function(stream, matID){
  stream.readInt32(); //magic "FMID"
  var size = stream.readInt32(); //packed size

  var interleaved = new CTM.InterleavedStream(matID, 1);
  CTM.decompress(stream, size, interleaved);
  // need restore?
};

CTM.CustomRestoreIndices = function ( indices ) {

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

}


CTM.ReaderMG2.prototype.readUVMaps = function(stream, uvMaps, alt){

  var i = 0;
  for (; i < uvMaps.length; ++ i){
    stream.readInt32(); //magic "TEXC"

    uvMaps[i].name = stream.readString();
    uvMaps[i].filename = stream.readString();

    var precision = stream.readFloat32();

    var size = stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(uvMaps[i].uv, 2);

    if (CTM.profiling)
      console.time("UV Maps decompress time");
    CTM.decompress(stream, size, interleaved, uvMaps[i].uv, alt);
    if (CTM.profiling)
      console.timeEnd("UV Maps decompress time");

    if (CTM.profiling)
      console.time("UV Maps restore time");
    if ( alt ){
      CTM.customRestoreMap(uvMaps[i].uv, 2, precision);
    }else {
      CTM.restoreMap(uvMaps[i].uv, 2, precision);
    }
    if (CTM.profiling)
      console.timeEnd("UV Maps restore time");

  }
};

CTM.ReaderMG2.prototype.readAttrMaps = function(stream, attrMaps){
  var i = 0;
  for (; i < attrMaps.length; ++ i){
    stream.readInt32(); //magic "ATTR"

    attrMaps[i].name = stream.readString();

    var precision = stream.readFloat32();

    var size = stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(attrMaps[i].attr, 4);
    CTM.decompress(stream, size, interleaved);

    CTM.restoreMap(attrMaps[i].attr, 4, precision);
  }
};

CTM.customRestoreMap = function( map, count, precision ){

  var value, i = 0, j, len = map.length;

  for (; i < count; ++ i){

    for (j = i; j < len; j += count){

      value = map[j];

      map[j] = value * precision;

    }
  }

};

CTM.decompress = function( stream, size, interleaved, target, alt ){
    var offset = stream.offset;

    // Doing compression in the browser rather than in js for alt now.
    if ( !alt ) {
        // Try old lzma converter
        LZMAD.decompress(stream, stream, interleaved, interleaved.data.length);
        stream.offset = offset + 5 + size;

    } else {

      stream.offset = offset; // rest the offset to try loading again.
      interleaved.data = stream.data.subarray(offset, offset+size);
      stream.offset = offset + size;

      if ( !target )
        return;
      var len = target.length;
      var leafSize = interleaved.count/4;
      // Remove interleaving and reconstruct as integers
      var j,i,k;
      for ( j=0; j<leafSize; j++ ){
        ilen = len/leafSize;
        k=0;
        for ( i=j*ilen; i<(j+1)*ilen; i++ ){

            target[j+k*leafSize] = CTM.UInt8BytesToInt([
              interleaved.data[i], 
              interleaved.data[i+len], 
              interleaved.data[i+2*len], 
              interleaved.data[i+3*len] 
              ]);
            k++;
        }
      }
    }

    //     // Load with latest lzma converter
    //     stream.offset = offset; // rest the offset to try loading again.
    //     //var my_lzma = new LZMA("pikeng-2.0/pikctm/lzma_worker.js");
    //     var binary_array = stream.data.subarray(offset, offset+size);
    //     interleaved.data = LZMA.decompress(binary_array);
    //     stream.offset = offset + size;

    //     if ( !target )
    //       return;
    //     var len = interleaved.data.length/4;
    //     // Remove byte interleaving and reconstruct as integers
    //     for ( var i=0; i<target.length; i++ ){

    //       var uint8 = new Uint8Array(4)
    //       uint8[0] = interleaved.data[i];
    //       uint8[1] = interleaved.data[i+len];
    //       uint8[2] = interleaved.data[i+2*len];
    //       uint8[3] = interleaved.data[i+3*len];

    //      target[i] = CTM.UInt8BytesToInt( uint8 );

    //     }
    // }
};

CTM.UInt8BytesToInt = function ( data ){

    var integer = data[0] + data[1]*Math.pow(2, 8) + data[2]*Math.pow(2, 16) + data[3]*Math.pow(2, 24);
    if ( integer > (Math.pow(2, 32)/2) ){

        integer =  - Math.pow(2, 32) + integer;

    }
    return integer;

}

CTM.restoreSmooth = function(smooth, len){
  console.log(smooth);
}

CTM.restoreMaterialIDs = function(materialIDs, len){

  console.log(materialIDs);

}

CTM.restoreIndices = function(indices, len){
  var i = 3;
  if (len > 0){
    indices[2] += indices[0];
    indices[1] += indices[0];
  }
  for (; i < len; i += 3){
    indices[i] += indices[i - 3];

    if (indices[i] === indices[i - 3]){
      indices[i + 1] += indices[i - 2];
    }else{
      indices[i + 1] += indices[i];
    }

    indices[i + 2] += indices[i];
  }
};

CTM.restoreGridIndices = function(gridIndices, len){
  var i = 1;
  for (; i < len; ++ i){
    gridIndices[i] += gridIndices[i - 1];
  }
};

CTM.restoreVertices = function(vertices, grid, gridIndices, precision){
  var gridIdx, delta, x, y, z,
      intVertices = new Uint32Array(vertices.buffer, vertices.byteOffset, vertices.length),
      ydiv = grid.divx, zdiv = ydiv * grid.divy,
      prevGridIdx = 0x7fffffff, prevDelta = 0,
      i = 0, j = 0, len = gridIndices.length;

  for (; i < len; j += 3){
    x = gridIdx = gridIndices[i ++];

    z = ~~(x / zdiv);
    x -= ~~(z * zdiv);
    y = ~~(x / ydiv);
    x -= ~~(y * ydiv);

    delta = intVertices[j];
    if (gridIdx === prevGridIdx){
      delta += prevDelta;
    }

    vertices[j]     = grid.lowerBoundx +
      x * grid.sizex + precision * delta;
    vertices[j + 1] = grid.lowerBoundy +
      y * grid.sizey + precision * intVertices[j + 1];
    vertices[j + 2] = grid.lowerBoundz +
      z * grid.sizez + precision * intVertices[j + 2];

    prevGridIdx = gridIdx;
    prevDelta = delta;
  }
};

CTM.restoreNormals = function(normals, smooth, precision){
  var ro, phi, theta, sinPhi,
      nx, ny, nz, by, bz, len,
      intNormals = new Uint32Array(normals.buffer, normals.byteOffset, normals.length),
      i = 0, k = normals.length,
      PI_DIV_2 = 3.141592653589793238462643 * 0.5;

  for (; i < k; i += 3){
    ro = intNormals[i] * precision;
    phi = intNormals[i + 1];

    if (phi === 0){
      normals[i]     = smooth[i]     * ro;
      normals[i + 1] = smooth[i + 1] * ro;
      normals[i + 2] = smooth[i + 2] * ro;
    }else{

      if (phi <= 4){
        theta = (intNormals[i + 2] - 2) * PI_DIV_2;
      }else{
        theta = ( (intNormals[i + 2] * 4 / phi) - 2) * PI_DIV_2;
      }

      phi *= precision * PI_DIV_2;
      sinPhi = ro * Math.sin(phi);

      nx = sinPhi * Math.cos(theta);
      ny = sinPhi * Math.sin(theta);
      nz = ro * Math.cos(phi);

      bz = smooth[i + 1];
      by = smooth[i] - smooth[i + 2];

      len = Math.sqrt(2 * bz * bz + by * by);
      if (len > 1e-20){
        by /= len;
        bz /= len;
      }

      normals[i]     = smooth[i]     * nz +
        (smooth[i + 1] * bz - smooth[i + 2] * by) * ny - bz * nx;
      normals[i + 1] = smooth[i + 1] * nz -
        (smooth[i + 2]      + smooth[i]   ) * bz  * ny + by * nx;
      normals[i + 2] = smooth[i + 2] * nz +
        (smooth[i]     * by + smooth[i + 1] * bz) * ny + bz * nx;
    }
  }
};

CTM.restoreMap = function(map, count, precision){
  var delta, value,
      intMap = new Uint32Array(map.buffer, map.byteOffset, map.length),
      i = 0, j, len = map.length;

  for (; i < count; ++ i){
    delta = 0;

    for (j = i; j < len; j += count){
      value = intMap[j];

      delta += value & 1? -( (value + 1) >> 1): value >> 1;

      map[j] = delta * precision;
    }
  }
};

CTM.calcSmoothNormals = function(indices, vertices){
  var smooth = new Float32Array(vertices.length),
      indx, indy, indz, nx, ny, nz,
      v1x, v1y, v1z, v2x, v2y, v2z, len,
      i, k;

  for (i = 0, k = indices.length; i < k;){
    indx = indices[i ++] * 3;
    indy = indices[i ++] * 3;
    indz = indices[i ++] * 3;

    v1x = vertices[indy]     - vertices[indx];
    v2x = vertices[indz]     - vertices[indx];
    v1y = vertices[indy + 1] - vertices[indx + 1];
    v2y = vertices[indz + 1] - vertices[indx + 1];
    v1z = vertices[indy + 2] - vertices[indx + 2];
    v2z = vertices[indz + 2] - vertices[indx + 2];

    nx = v1y * v2z - v1z * v2y;
    ny = v1z * v2x - v1x * v2z;
    nz = v1x * v2y - v1y * v2x;

    len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10){
      nx /= len;
      ny /= len;
      nz /= len;
    }

    smooth[indx]     += nx;
    smooth[indx + 1] += ny;
    smooth[indx + 2] += nz;
    smooth[indy]     += nx;
    smooth[indy + 1] += ny;
    smooth[indy + 2] += nz;
    smooth[indz]     += nx;
    smooth[indz + 1] += ny;
    smooth[indz + 2] += nz;
  }

  for (i = 0, k = smooth.length; i < k; i += 3){
    len = Math.sqrt(smooth[i] * smooth[i] + 
      smooth[i + 1] * smooth[i + 1] +
      smooth[i + 2] * smooth[i + 2]);

    if(len > 1e-10){
      smooth[i]     /= len;
      smooth[i + 1] /= len;
      smooth[i + 2] /= len;
    }
  }

  return smooth;
};

CTM.isLittleEndian = (function(){
  var buffer = new ArrayBuffer(2),
      bytes = new Uint8Array(buffer),
      ints = new Uint16Array(buffer);

  bytes[0] = 1;

  return ints[0] === 1;
}());

CTM.InterleavedStream = function(data, count){
  this.data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  this.offset = CTM.isLittleEndian? 3: 0;
  this.count = count * 4;
  this.len = this.data.length;
};

CTM.InterleavedStream.prototype.writeByte = function(value){
  this.data[this.offset] = value;

  this.offset += this.count;
  if (this.offset >= this.len){

    this.offset -= this.len - 4;
    if (this.offset >= this.count){

      this.offset -= this.count + (CTM.isLittleEndian? 1: -1);
    }
  }
};

CTM.Stream = function(data){
  this.data = data;
  this.offset = 0;
};

CTM.Stream.prototype.TWO_POW_MINUS23 = Math.pow(2, -23);

CTM.Stream.prototype.TWO_POW_MINUS126 = Math.pow(2, -126);

CTM.Stream.prototype.readByte = function() {
  return this.data[this.offset ++] & 0xff;
};

CTM.Stream.prototype.readInt32 = function(){
  var i = this.readByte();
  i |= this.readByte() << 8;
  i |= this.readByte() << 16;
  return i | (this.readByte() << 24);
};

CTM.Stream.prototype.readFloat32 = function(){
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
};

CTM.Stream.prototype.readString = function(){
  var len = this.readInt32();

  this.offset += len;

  return String.fromCharCode.apply(null, this.data.subarray(this.offset - len, this.offset));
};

CTM.Stream.prototype.readArrayInt32 = function(array){
  var i = 0, len = array.length;

  while(i < len){
    array[i ++] = this.readInt32();
  }

  return array;
};

CTM.Stream.prototype.readArrayFloat32 = function(array){
  var i = 0, len = array.length;

  while(i < len){
    array[i ++] = this.readFloat32();
  }

  return array;
};

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

    var gx,gy,gz;

    if (this.gridSize[0] == 0)
      gx = 0;
    else

      gx = (vertex.x - this.lbx)/this.gridSize[0];
    if(this.gridSize[1] == 0)
      gy = 0;
    else
      gy = (vertex.y - this.lby)/this.gridSize[1];

    if(this.gridSize[2] == 0)
      gz = 0;
    else
      gz = (vertex.z - this.lbz)/this.gridSize[2];

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

THREE.CTMLoader = function () {

    THREE.Loader.call( this );

    // Deprecated

    Object.defineProperties( this, {
        statusDomElement: {
            get: function () {

                if ( this._statusDomElement === undefined ) {
                    this._statusDomElement = document.createElement( 'div' );
                }

                console.warn( 'THREE.BinaryLoader: .statusDomElement has been removed.' );
                return this._statusDomElement;

            }
        },
    } );

};

THREE.CTMLoader.prototype = Object.create( THREE.Loader.prototype );
THREE.CTMLoader.prototype.constructor = THREE.CTMLoader;

// Load CTMLoader compressed models
//  - parameters
//      - url (required)
//      - callback (required)

THREE.CTMLoader.prototype.load = function( url, callback, parameters, callbackProgress, onReadyStateChange ) {

    parameters = parameters || {};
    var scope = this;
    var offsets = parameters.offsets !== undefined ? parameters.offsets : [ 0 ];
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {

        if (onReadyStateChange) {
            onReadyStateChange( this );
        };
        if ( xhr.readyState === 4 ) {

            if ( xhr.status === 200 || xhr.status === 0 ) {

                var binaryData = new Uint8Array(xhr.response);
                if (parameters.useWorker == true) {

                    scope.loadModelWithWorker(binaryData, offsets, callback, parameters);
                }else {

                    scope.loadModel(binaryData, offsets, callback, parameters);
                }

            } else {

                console.error( "Couldn't load [" + url + "] [" + xhr.status + "]" );
            }

        };
    };

    xhr.onprogress = function( e ){
        if (callbackProgress){
            callbackProgress( e );
        }
    }

    xhr.open( "GET", url, true );
    xhr.responseType = "arraybuffer";
    xhr.send( null );
};

THREE.CTMLoader.prototype.loadModel = function ( binaryData, offsets, callback, parameters ) {

     for ( var i = 0; i < offsets.length; i ++ ) {

        var stream = new CTM.Stream( binaryData );
        stream.offset = offsets[ i ];
        var ctmFile = new CTM.File( stream, parameters.alt );
        this.createModel( ctmFile, callback, parameters );

    }

}

THREE.CTMLoader.prototype.createModel = function ( file, callback, parameters ) {

    var scope = this;

    var uvMaps = file.body.uvMaps;
    var indices = file.body.indices;
    var positions = file.body.vertices;
    var normals = file.body.normals;
    var smooth = file.body.Smooth;
    var matIDs = file.body.MatID;

    var Model = function () {

        //var start = new Date().getTime();

        THREE.Geometry.call( this );

        this.faces = [];
        this.faceVertexUvs = [];
        this.vertices = [];
        this.materials = [];


        // if (positions.length/3 > 65536){
        //     console.warn("65536 vertices exceeded! Geometry " + file + " has " + positions.length/3 + " vertices");
        // }

        var color;

        if ( positions.length/3 > 65536 ){
          color = "background:red";
        }else if ( positions.length/3 > 40000 ){
          color = "background:orange";
        }else if ( positions.length/3 > 20000 ) {
          color = "background:yellow";
        }else {
          color = "background:green";
        }

        if (CTM.debugging)
          console.log("%c Geometry ", color, + file + " has " + positions.length/3 + " vertices");

        var vertexNormals = [];
        var emptyVector = new THREE.Vector3(0,0,0);
        var len;
        var vertex;
        var normal;
        var face;
        var materialIndex = 0;

        if (normals){

            len = positions.length;
            
            for (var i=0; i<len; i=i+3){

                vertex = new THREE.Vector3(positions[i],positions[i+1],positions[i+2]);
                normal = new THREE.Vector3(normals[i], normals[i+1], normals[i+2]);
                normal.normalize();
                this.vertices.push(vertex);
                vertexNormals.push(normal);

            }
            len = indices.length
            
            for (var i=0; i<len; i=i+3){

                if (matIDs)
                    materialIndex = matIDs[i/3];
                
                face = new THREE.Face3( indices[i], indices[i+1], indices[i+2], null, null, materialIndex );
                face.vertexNormals = [ vertexNormals[indices[i]], vertexNormals[indices[i+1]], vertexNormals[indices[i+2]] ];
                this.faces.push( face );

            }

        }else{

            len = positions.length;
            for (var i=0; i<len; i=i+3){
                this.vertices.push(new THREE.Vector3(positions[i],positions[i+1],positions[i+2]));
            }
            len = indices.length;
            if (matIDs){
                for (var i=0; i<len; i=i+3){
                    materialIndex = matIDs[i/3];
                    this.faces.push(new THREE.Face3(indices[i], indices[i+1], indices[i+2], emptyVector, null, materialIndex));
                } 
            }else{
                for (var i=0; i<len; i=i+3){
                    this.faces.push(new THREE.Face3(indices[i], indices[i+1], indices[i+2], emptyVector, null, materialIndex));
                }  
            }

        }
        var uvIndexA;
        var uvIndexB;
        var uvIndexC;
        var uvMap;
        var faceVertexUV;
        var uvFaceArray;
        if (!uvMaps){
          uvMaps = [];
          this.computeBoundingBox();
          var max = this.boundingBox.max,
              min = this.boundingBox.min;
          var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
          var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
          var faces = this.faces;

          this.faceVertexUvs[0] = [];

          for (var i = 0; i < faces.length ; i++) {

              var v1 = this.vertices[faces[i].a], 
                  v2 = this.vertices[faces[i].b], 
                  v3 = this.vertices[faces[i].c];

              this.faceVertexUvs[0].push([
                  new THREE.Vector2((v1.x + offset.x)/range.x ,(v1.y + offset.y)/range.y),
                  new THREE.Vector2((v2.x + offset.x)/range.x ,(v2.y + offset.y)/range.y),
                  new THREE.Vector2((v3.x + offset.x)/range.x ,(v3.y + offset.y)/range.y)
              ]);
          }
          this.uvsNeedUpdate = true;
        }
        for (var uvChannel=0; uvChannel<uvMaps.length; uvChannel++){
            uvMap = uvMaps[uvChannel].uv;
            len = this.faces.length;
            this.faceVertexUvs.push([]);
            for (var i=0; i<len; i++){
                face = this.faces[i];
                this.faceVertexUvs[uvChannel].push([
                    new THREE.Vector2(uvMap[face.a*2],uvMap[face.a*2+1]),
                    new THREE.Vector2(uvMap[face.b*2],uvMap[face.b*2+1]), 
                    new THREE.Vector2(uvMap[face.c*2],uvMap[face.c*2+1])
                    ]);
            }
        }

        if(normals){
          if (CTM.debugger)
            console.log("Have normals");
        /*}else if (smooth){
            console.log ("Computing normals from smoothGroups");
            scope.createNormalsFromSmoothGroups(this, smooth);*/
        }else{
            if (CTM.debugger)
              console.log ("No normal or smooth data found, computing average normals.");
            this.computeFaceNormals();
            this.computeVertexNormals();
        }

        //var end = new Date().getTime();
        //var time = end - start;
        //console.log('Face execution time: ' + time);
    };

    Model.prototype = Object.create( THREE.Geometry.prototype );
    Model.prototype.constructor = Model;

    var geometry = new Model();
    if ( parameters.splitByMatId && matIDs ){

        var geometries = this.splitGeometryByMatIds( geometry );
        callback( geometries );

    }else{
        callback( [geometry] );
    }

};

THREE.CTMLoader.prototype.splitGeometryByMatIds = function ( geometry ) {

    // Sort faces by mat ids.
    geometry.sortFacesByMaterialIndex();
    // Step through faces and create new geometry every time a new mat id appears.
    var geometries = [];
    var highestMatId = -1;
    var len = geometry.faces.length;
    var currentGeo = null;
    for ( var i=0; i<len; i++ ){

        var face = geometry.faces[i];
        if ( face.materialIndex > highestMatId ){

            highestMatId = face.materialIndex;
            currentGeo = new THREE.Geometry();
            currentGeo.materialId = face.materialIndex;
            currentGeo.lookUp = {};
            // Initialise faveVertexUvs
            currentGeo.faceVertexUvs = [];
            for ( j=0; j<geometry.faceVertexUvs.length; j++ ){    
              currentGeo.faceVertexUvs.push([]);
            }
            geometries.push(currentGeo);

        }
     
        // Reindex vertices for new geometry.
        // Add faces to the new geometry and new vertices when needed.   
        if ( !currentGeo.lookUp[face.a] ){
            currentGeo.lookUp[face.a] = currentGeo.vertices.length;
            currentGeo.vertices.push(geometry.vertices[face.a]);
        }
        if ( !currentGeo.lookUp[face.b] ){
            currentGeo.lookUp[face.b] = currentGeo.vertices.length;
            currentGeo.vertices.push(geometry.vertices[face.b]);
        }
        if ( !currentGeo.lookUp[face.c] ){
            currentGeo.lookUp[face.c] = currentGeo.vertices.length;
            currentGeo.vertices.push(geometry.vertices[face.c]);
        }
        face.a = currentGeo.lookUp[face.a];
        face.b = currentGeo.lookUp[face.b];
        face.c = currentGeo.lookUp[face.c];
        currentGeo.faces.push(face);

        // Add face vertex UVs.
        for ( var j=0; j<geometry.faceVertexUvs.length; j++ ){

          currentGeo.faceVertexUvs[j].push(geometry.faceVertexUvs[j][i]);

        }

    }

    return geometries;

}

THREE.CTMLoader.prototype.createNormalsFromSmoothGroups = function (model, smooth){

        var smoothGroups = [ [],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[] ];
        var scope = this;
        model.computeFaceNormals();
        for (var i=0; i<smooth.length; i++){
            var smoothGroup = smooth[i];
            if (smoothGroup != 0){
                if (smoothGroups[smoothGroup]) {
                    smoothGroups[smoothGroup].push(i);
                }else{
                    smoothGroups[smoothGroup] = [];
                    smoothGroups[smoothGroup].push(i);
                };
            }
        }
        smoothGroups.forEach(function(smoothGroup){
            scope.computeVertexNormalsForFaces(smoothGroup, model);
        });
}

THREE.CTMLoader.prototype.loadModelWithWorker = function ( binaryData, offsets, callback ) {

    var scope = this;
    var geometry = new THREE.Geometry();
    var worker = new Worker( "../pikcellsEngine/ENGINE/PikctmWorker.js" );
    // Can't use face normals with bugger geometry so using regular Geometry. Buffer Geometry would be more efficient though.
    // Ugly code to maximize efficiecy

    var start = new Date().getTime();

    worker.onmessage = function( event ){
        if (event.data.vertex) {
            geometry.vertices.push(new THREE.Vector3( event.data.vertex.x,event.data.vertex.y, event.data.vertex.z ));

        }else if (event.data.faces) {
            geometry.faces.push(new THREE.Face3( event.data.faces.a, event.data.faces.b, event.data.faces.c, new THREE.Vector3( 0,0,0 ), null, event.data.faces.matID ));

        }else if ( event.data.uvChannel >= 0 ) {
            while( !geometry.faceVertexUvs[event.data.uvChannel] ){
                geometry.faceVertexUvs.push([]);
            }
            geometry.faceVertexUvs[event.data.uvChannel].push(
                [new THREE.Vector2(event.data.uvA.x, event.data.uvA.y),
                new THREE.Vector2(event.data.uvB.x, event.data.uvB.y),
                new THREE.Vector2(event.data.uvC.x, event.data.uvC.y) ]);
        }else if(event.data.computeFaceNormals){
            geometry.computeFaceNormals();

        } else if (event.data.smoothGroup){
            scope.computeVertexNormalsForFaces(event.data.smoothGroup, geometry);

        } else if (event.data.completed) {
            callback( geometry );
            var end = new Date().getTime();
            var time = end - start;
            console.log('Overall execution time: ' + time);

        };
    };
    worker.postMessage ( { "binaryData": binaryData, "offsets":offsets } );
}

THREE.CTMLoader.prototype.computeVertexNormalsForFaces = function ( faces , model ) {

    var v, vl, f, fl, face, vertices;

    vertices = new Array( model.vertices.length );

    for ( v = 0, vl = model.vertices.length; v < vl; v ++ ) {

        vertices[ v ] = new THREE.Vector3();

    }

    for ( f = 0; f < faces.length; f ++ ) {

        face = model.faces[ [faces[f]] ];

        vertices[ face.a ].add( face.normal );
        vertices[ face.b ].add( face.normal );
        vertices[ face.c ].add( face.normal );

    }

    for ( v = 0, vl = model.vertices.length; v < vl; v ++ ) {

        vertices[ v ].normalize();

    }

    for ( f = 0; f < faces.length; f ++ ) {

        face = model.faces[ faces[f] ];

        var vertexNormals = face.vertexNormals;

        if ( vertexNormals.length === 3 ) {

            vertexNormals[ 0 ].copy( vertices[ face.a ] );
            vertexNormals[ 1 ].copy( vertices[ face.b ] );
            vertexNormals[ 2 ].copy( vertices[ face.c ] );

        } else {

            vertexNormals[ 0 ] = vertices[ face.a ].clone();
            vertexNormals[ 1 ] = vertices[ face.b ].clone();
            vertexNormals[ 2 ] = vertices[ face.c ].clone();

        }

    }
};
