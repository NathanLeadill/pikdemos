class RadialMenu {

  constructor (activeImage) {
    this.sectorCount = 16;
    this.colors = ['BLUE_SAIL', 'BOMBAY_PINK', 'BONDI', 'CARMEN', 'CUTICLE_PINK', 'FRIENDS', 'PALE_MUSTARD', 'PURPLE_BALANCE', 'SIR_EDMUND', 'SOFT_FRESCO', 'SOLUTION', 'TANGERINE_FLAKE',];
    this.definePatterns(this.colors);
    const activeIndex = this.colors.indexOf(activeImage);
    this.colors.splice(activeIndex, 1);
    this.sectorNumber = 0;
    this.activeImage = activeImage;

    for(let i = 0; i < this.sectorCount; i++)
    {
      if(i < (this.sectorCount / 4) || i > (3 * (this.sectorCount / 4) - 1))
      {
        console.log(i);
        console.log((3 * (this.sectorCount / 4)));
        this.drawSector(125, 125, 40, 23, i);
      }
      else
      {
        this.drawHalfSector(125, 125, 40, 180, i);
        i = (3 * (this.sectorCount / 4) - 1);
      }
    }
  }

  definePatterns(colors) {
    const $definitions = $('#svg defs');
    colors.forEach((color) =>{
      this.addPattern(document.getElementById('svg'), color);
      // $($definitions).append(pattern);
      // document.getElementById('image-' + color).setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'http://www.jampez.co.uk/sensoryuk/events/test.jpg');
    });
  }

  addPattern(svg, id) {
    let svgNS = svg.namespaceURI;
    let pattern = document.createElementNS(svgNS, 'pattern');

    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', 500);
    pattern.setAttribute('height', 500);

    let image = document.createElementNS(svgNS, 'image');
    image.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href', 'imgs/'+ id +'/diffuse.jpg');
    image.setAttribute('x', -100);
    image.setAttribute('y', -100);
    image.setAttribute('width', 500);
    image.setAttribute('height', 500);

    pattern.appendChild(image);

    let defs = svg.querySelector('defs') ||
    svg.insertBefore( document.createElementNS(svgNS,'defs'), svg.firstChild);

    $('svg polygon').attr('fill', 'url(#' + id + ')');

    return defs.appendChild(pattern);
  }

  drawSector(centerX, centerY, radius, sectorWidth, number, color ) {
    let svgElem   = document.getElementById("svg");
    const cx      = centerX;
    const cy      = centerY;

    let p = svgElem.createSVGPoint();
        p.x = 0;
        p.y = 1;


    let m = svgElem.createSVGMatrix();


    let p2 = p.matrixTransform(m.rotate(sectorWidth));
        p2.x = cx + p2.x*radius;
        p2.y = cy + p2.y*radius;
    this.p2 = p2;
    let rotate = ((360 / this.sectorCount) * number );

    let path = document.createElementNS("http://www.w3.org/2000/svg","path");
        svgElem.appendChild(path);
    let d="M"+cx+" "+(cy+radius)+"A"+radius+" "+radius+" 0 0 1"+p2.x+" "+p2.y+"L"+cx+" "+cy+"z";
        this.sectorString = d;
        path.setAttribute("d",d);
        path.setAttribute("id",this.colors[this.sectorNumber]);
        path.setAttribute("fill",'url(#'+ this.colors[this.sectorNumber]+ ')');
        path.style.transformOrigin = 'center';
        path.setAttribute('style', 'transform: rotate(' + rotate + 'deg);transform-origin: center;');

    this.sectorNumber++;
  }
  updateRenderFrame(timestamp,y,z, radius, sectorWidth, number, color)
  {
    console.log(color);
    const start = this.start;
    const duration = 1000;
    let currentTime = Date.now();
    const startWidth = 23;
    const changeWidth = 7;
    if(start + duration > currentTime)
    {
      window.requestAnimationFrame(() => {
        this.updateRenderFrame(timestamp);
      });
      let percent = ((currentTime - start) / duration);
      // console.log(percent);
      let newWidth = startWidth + (percent * changeWidth);
      console.log(newWidth);
      this.updateSector(125,125, 40, newWidth, 5, 'SOFT_FRESCO');
    }
    else
    {
    }


  }
  updateSector(centerX, centerY, radius, sectorWidth, number, color  )
  {
    number = 1;
    $('#update').remove();
    let svgElem   = document.getElementById("svg");
    const cx      = centerX;
    const cy      = centerY;

    let p = svgElem.createSVGPoint();
        p.x = 0;
        p.y = 1;


    let m = svgElem.createSVGMatrix();


    let p2 = p.matrixTransform(m.rotate(sectorWidth));
        p2.x = cx + p2.x*radius;
        p2.y = cy + p2.y*radius;
    this.p2 = p2;
    let rotate = ((360 / this.sectorCount) * number );

    let path = document.createElementNS("http://www.w3.org/2000/svg","path");
        svgElem.appendChild(path);
    let d="M"+cx+" "+(cy+radius)+"A"+radius+" "+radius+" 0 0 1"+p2.x+" "+p2.y+"L"+cx+" "+cy+"z";
        this.sectorString = d;
        path.setAttribute("d",d);
        path.setAttribute("id",'update');
        path.setAttribute("fill",'url(#SOFT_FRESCO)');
        path.style.transformOrigin = 'center';
        path.setAttribute('style', 'transform: rotate(' + rotate + 'deg);transform-origin: center;');

    this.sectorNumber++;
  }

  drawHalfSector(centerX, centerY, radius, sectorWidth, number ) {
    let svgElem   = document.getElementById("svg");
    const cx      = centerX;
    const cy      = centerY;

    let p = svgElem.createSVGPoint();
      p.x = 0;
      p.y = 1;

    let m = svgElem.createSVGMatrix();


    let p2 = p.matrixTransform(m.rotate(sectorWidth));
      p2.x = cx + p2.x*radius;
      p2.y = cy + p2.y*radius;

    let rotate = Number((360 / this.sectorCount) * number );

    let path = document.createElementNS("http://www.w3.org/2000/svg","path");
      svgElem.appendChild(path);

    let d="M"+cx+" "+(cy+radius)+"A"+radius+" "+radius+" 0 0 1"+p2.x+" "+p2.y+"L"+cx+" "+cy+"z";
      this.halfString = d;
      path.setAttribute("d",d);
      path.setAttribute("id",'half');
      path.setAttribute('fill', 'url(#'+ this.activeImage + ')');
      path.style.transformOrigin = 'center';
      path.setAttribute('style', 'transform: rotate(' + rotate + 'deg);transform-origin: center;');
  }

  expand() {
    const colors = this.colors;
    colors.forEach((color, index, array) => {
      console.log('test');
      const timeStampInMs = window.performance && window.performance.now && window.performance.timing && window.performance.timing.navigationStart ? window.performance.now() + window.performance.timing.navigationStart : Date.now();
      this.start = timeStampInMs;
      this.updateRenderFrame(timeStampInMs, 125, 125, 40, 23, index, color);
    });
  }

  contract() {
    const sector = this.sectorString;
    const half   = this.halfString;
  }
}


let rad = new RadialMenu('BLUE_SAIL');
$('#svg').hover((e) => {
  console.log(e);
  // Mouse Enter
  if(e.type == 'mouseenter')
  {
    rad.expand();
  }
  // Mouse Leave
  else if(e.type == 'mouseleave')
  {
    rad.contract();
  }
});
