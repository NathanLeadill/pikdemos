/**
 * # Radial Menu
*/
class RadialMenu {

  constructor (id, titles) {
    this.wheel = new wheelnav(id);
    // Declaring class properties
    this.colors = ['#364C4A', '#497C7F', '#92C5C0', '#858168'];
    this.labels = titles;
    // Radial Menu properties

    // Width of the inner circle that is shown when the wheel is closed, and at the center of an open wheel.
    this.innerRadius = 30;
    // Width of the main expanded wheel.
    this.wheelRadius = 135;
    // Time it takes to animate from one selection to the next
    this.animateTime = 750;
    // If true radial menu is expandable
    this.isExpandable = true;

    this.pathContracted   = {fill: '#ffffff', 'stroke-width': 3, stroke: '#000'};
    this.pathExpanded     = {fill: '#ffffff', 'stroke-width': 3, stroke: '#ffffff'};
    this.titleContracted  = {fill: '#ffffff'};
    this.titleExpanded    = {fill: '#ffffff'};

    // this.setTooltips(this.activeColorNames[name]);


    console.log(this);


  }

  loadParameters () {
    // DO NOT MODIFY
    this.wheel.spreaderEnable = this.isExpandable;
    this.wheel.spreaderRadius = this.innerRadius;
    this.wheel.wheelRadius    = this.wheelRadius;
    this.wheel.animatetime    = this.animateTime;

    this.wheel.spreaderPathInAttr   = this.pathContracted;
    this.wheel.spreaderPathOutAttr  = this.pathExpanded;
    this.wheel.spreaderTitleInAttr  = this.titleContracted;
    this.wheel.spreaderTitleOutAttr = this.titleExpanded;


    this.wheel.slicePathFunction     = slicePath().PieSlice;
    this.wheel.sliceSelectedTransformFunction = sliceTransform().MoveMiddleTransform;
    console.log(this.wheel);
    this.wheel.colors = this.colors;
    this.wheel.initWheel(this.labels);
    this.setupWheel();

    this.wheel.createWheel();

  }

  setupWheel () {
    const numberOfItems = this.wheel.navItemCount;
    console.log('test');
    for(let i =0; i < numberOfItems; i++)
    {
      this.wheel.navItems[i].navigateFunction =  (e) => {
        console.log("Slice " + i + " has been clicked.");
        this.onClicked(e,i);
      };
    }
  }
  onClicked (event, index) {
    console.log(event);
    console.log(index);
  }

  /**
   * @method getColors
   * @author Nathan Leadill
   * @memberof RadialMenu
   * @description Returns array of set hex colors for radial menu to use.
   * @return {Array} Array of Hex-coded colors.
   */
  get colors () {
    return this._colors;
  }

  /**
   * @method setColors
   * @author Nathan Leadill
   * @memberof RadialMenu
   * @description Sets the local properties for the colors the radial menu will use.
   * @param {Array} colors Array of colors for the radial menu to use
   */
  set colors (colors) {
    colors.some(function(color)
    {
      if(color.indexOf('#') < 0) {
        throw("All Colors Must Be Of Hex-Code Format INCLUDING the Hash");
      }
    });
    this._colors = colors;
  }




}
