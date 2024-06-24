/*eslint no-unused-vars: 0*/

import React, { PureComponent } from "react";
import PropTypes from "prop-types";
import History from "./history";
import { uuid4 } from "./utils";
import Select from "./select";
import Pencil from "./pencil";
import Line from "./line";
import Arrow from "./arrow";
import Rectangle from "./rectangle";
import Circle from "./circle";
import Pan from "./pan";
import Tool from "./tools";
import FabricCanvasTool from "./fabrictool";
import { fabric } from "fabric";

export { FabricCanvasTool };
/**
 * Sketch Tool based on FabricJS for React Applications
 */
class SketchField extends PureComponent {
  static propTypes = {
    // the color of the line
    lineColor: PropTypes.string,
    // The width of the line
    lineWidth: PropTypes.number,
    // the fill color of the shape when applicable
    fillColor: PropTypes.string,
    // the background color of the sketch
    backgroundColor: PropTypes.string,
    // the opacity of the object
    opacity: PropTypes.number,
    // number of undo/redo steps to maintain
    undoSteps: PropTypes.number,
    // The tool to use, can be pencil, rectangle, circle, brush;
    tool: PropTypes.string,
    // image format when calling toDataURL
    imageFormat: PropTypes.string,
    // Sketch data for controlling sketch from
    // outside the component
    value: PropTypes.object,
    // Set to true if you wish to force load the given value, even if it is  the same
    forceValue: PropTypes.bool,
    // Specify some width correction which will be applied on auto resize
    widthCorrection: PropTypes.number,
    // Specify some height correction which will be applied on auto resize
    heightCorrection: PropTypes.number,
    // Specify action on change
    onChange: PropTypes.func,
    // Default initial value
    defaultValue: PropTypes.object,
    // Sketch width
    width: PropTypes.number,
    // Sketch height
    height: PropTypes.number,
    // Class name to pass to container div of canvas
    className: PropTypes.string,
    // Style options to pass to container div of canvas
    style: PropTypes.object,
  };

  static defaultProps = {
    lineColor: "black",
    lineWidth: 10,
    fillColor: "transparent",
    backgroundColor: "transparent",
    opacity: 1.0,
    undoSteps: 25,
    tool: Tool.Pencil,
    widthCorrection: 2,
    heightCorrection: 0,
    forceValue: false,
  };

  state = {
    parentWidth: 550,
    action: true,
  };

  _parseObject(obj) {
    if (this.props.parseObject) {
      return this.props.parseObject(obj);
    } else {
      delete obj.__originalState;
      const res = JSON.parse(obj);
      if (res.eraser) {
        // This is only fake async unless we are loading an image. If we start to load
        // stuff we need to rethink this
        fabric.Eraser.fromObject(res.eraser, (newEraser) => {
          res.eraser = newEraser;
        });
      } else {
        res.eraser = null;
      }
      return res;
    }
  }
  _initTools = (fabricCanvas) => {
    this._tools = {};
    this._tools[Tool.Select] = new Select(fabricCanvas);
    this._tools[Tool.Pencil] = new Pencil(fabricCanvas);
    this._tools[Tool.Line] = new Line(fabricCanvas);
    this._tools[Tool.Arrow] = new Arrow(fabricCanvas);
    this._tools[Tool.Rectangle] = new Rectangle(fabricCanvas);
    this._tools[Tool.Circle] = new Circle(fabricCanvas);
    this._tools[Tool.Pan] = new Pan(fabricCanvas);
  };

  /**
   * Enable touch Scrolling on Canvas
   */
  enableTouchScroll = () => {
    let canvas = this._fc;
    if (canvas.allowTouchScrolling) return;
    canvas.allowTouchScrolling = true;
  };

  addTool = (key, typeConstructor) => {
    this._tools[key] = new typeConstructor(this._fc);
    if (this.props.tool == key) {
      this._selectedTool.cleanupTool(this.props);
      this._selectedTool =
        this._tools[this.props.tool] || this._tools[Tool.Pencil];
      this._selectedTool.configureCanvas(this.props, this._history);
    }
  };
  /**
   * Disable touch Scrolling on Canvas
   */
  disableTouchScroll = () => {
    let canvas = this._fc;
    if (canvas.allowTouchScrolling) {
      canvas.allowTouchScrolling = false;
    }
  };

  /**
   * Add an image as object to the canvas
   *
   * @param dataUrl the image url or Data Url
   * @param options object to pass and change some options when loading image, the format of the object is:
   *
   * {
   *   left: <Number: distance from left of canvas>,
   *   top: <Number: distance from top of canvas>,
   *   scale: <Number: initial scale of image>
   * }
   */

  _objectToString = (obj) => {
    if (this.props.stringifyObject) {
      return this.props.stringifyObject(obj);
    }
    return JSON.stringify(obj);
  };

  addImg = (dataUrl, options = {}) => {
    let canvas = this._fc;
    fabric.Image.fromURL(dataUrl, (oImg) => {
      let opts = {
        left: Math.random() * (canvas.getWidth() - oImg.width * 0.5),
        top: Math.random() * (canvas.getHeight() - oImg.height * 0.5),
        scale: 0.5,
      };
      Object.assign(opts, options);
      oImg.scale(opts.scale);
      oImg.set({
        left: opts.left,
        top: opts.top,
      });
      canvas.add(oImg);
    });
  };

  _objToJSON(obj, params) {
    return obj.toJSON(params);
  }
  /**
   * Action when an object is added to the canvas
   */
  _onObjectAdded = (e) => {
    let obj = e.target;

    obj.__version = 1;
    // record current object state as json and save as originalState
    //BEAUTIFY ADD
    let objState = this._objToJSON(obj, { translateX: true, translateY: true });
    obj.__originalState = this._objectToString(objState);
    let state = obj.__originalState;
    // object, previous state, current state
    this._history.keep([obj, state, state]);
  };

  /**
   * Action when an object is moving around inside the canvas
   */
  _onObjectMoving = (e) => {};

  /**
   * Action when an object is scaling inside the canvas
   */
  _onObjectScaling = (e) => {};

  /**
   * Action when an object is rotating inside the canvas
   */
  _onObjectRotating = (e) => {};

  _onObjectModified = (e) => {
    let obj = e.target;
    if (!obj.__version && obj._objects) {
      this._history.atomicStart();
      let i = 0;
      for (const curObj of obj._objects) {
        this._onObjectModified({
          target: curObj,
          applyTransformToSaved: e.transform,
          index: i++,
        });
      }
      this._history.atomicEnd();

      return;
    }

    obj.__version += 1;

    let prevState = obj.__originalState;
    let objState = this._objToJSON(obj);
    // record current object state as json and update to originalState
    if (e.applyTransformToSaved) {
      const scale = obj.getTotalObjectScaling();
      const pos = fabric.util.transformPoint(
        { x: obj.left, y: obj.top },
        obj.group.calcTransformMatrix()
      );
      objState.flipX = false;
      objState.flipY = false;
      objState.angle = fabric.util.qrDecompose(obj.calcTransformMatrix()).angle;
      objState.scaleX = scale.scaleX || 1;
      objState.scaleY = scale.scaleY || 1;
      objState.top = pos.y;
      objState.left = pos.x;
    }

    obj.__originalState = this._objectToString(objState);

    this._history.keep([obj, prevState]);
  };

  /**
   * Action when an object is removed from the canvas
   */
  _onObjectRemoved = (e) => {
    let obj = e.target;
    if (obj.__removed) {
      obj.__version += 1;
      return;
    }
    obj.__version = 0;
  };

  /**
   * Action when the mouse button is pressed down
   */
  _onMouseDown = (e) => {
    // BEAUTIFY THIS NEVER SET FALSE?
    this.mouseDown = true;
    this._selectedTool.doMouseDown(e);
  };

  /**
   * Action when the mouse cursor is moving around within the canvas
   */
  _onMouseMove = (e) => {
    this._selectedTool.doMouseMove(e);
  };

  /**
   * Action when the mouse cursor is moving out from the canvas
   */
  _onMouseOut = (e) => {
    this._selectedTool.doMouseOut(e);
    if (this.props.onChange && this.mouseDown) {
      let onChange = this.props.onChange;
      //   setTimeout(() => {
      onChange(e.e);
      //  }, 10)
    }
  };

  _onMouseUp = (e) => {
    this._selectedTool.doMouseUp(e);
    // Update the final state to new-generated object
    // Ignore Path object since it would be created after mouseUp
    // Assumed the last object in canvas.getObjects() in the newest object
    if (
      this.props.tool !== Tool.Pencil &&
      this.props.tool != "eraser" &&
      this.props.tool != "select"
    ) {
      const canvas = this._fc;
      const objects = canvas.getObjects();
      const newObj = objects[objects.length - 1];
      if (newObj && newObj.__version === 1) {
        newObj.__originalState = this._objectToString(this._objToJSON(newObj));
      }
    }
    if (this.props.onChange) {
      let onChange = this.props.onChange;
      setTimeout(() => {
        onChange(e.e);
      }, 10);
    }
  };

  /**
   * Track the resize of the window and update our state
   *
   * @param e the resize event
   * @private
   */
  _resize = (e) => {
    if (e) e.preventDefault();
    let { widthCorrection, heightCorrection } = this.props;
    let canvas = this._fc;
    let { offsetWidth, clientHeight } = this._container;
    let prevWidth = canvas.getWidth();
    let prevHeight = canvas.getHeight();
    let wfactor = ((offsetWidth - widthCorrection) / prevWidth).toFixed(2);
    let hfactor = ((clientHeight - heightCorrection) / prevHeight).toFixed(2);
    canvas.setWidth(offsetWidth - widthCorrection);
    canvas.setHeight(clientHeight - heightCorrection);
    if (canvas.backgroundImage) {
      // Need to scale background images as well
      let bi = canvas.backgroundImage;
      bi.width = bi.width * wfactor;
      bi.height = bi.height * hfactor;
    }
    let objects = canvas.getObjects();
    for (let i in objects) {
      let obj = objects[i];
      let scaleX = obj.scaleX;
      let scaleY = obj.scaleY;
      let left = obj.left;
      let top = obj.top;
      let tempScaleX = scaleX * wfactor;
      let tempScaleY = scaleY * hfactor;
      let tempLeft = left * wfactor;
      let tempTop = top * hfactor;
      obj.scaleX = tempScaleX;
      obj.scaleY = tempScaleY;
      obj.left = tempLeft;
      obj.top = tempTop;
      obj.setCoords();
    }
    /* BEAUTIFY REMOVE?
    this.setState({
      parentWidth: offsetWidth
    });
    */
    canvas.renderAll();
    canvas.calcOffset();
  };

  /**
   * Sets the background color for this sketch
   * @param color in rgba or hex format
   */
  _backgroundColor = (color) => {
    if (!color) return;
    let canvas = this._fc;
    canvas.setBackgroundColor(color, () => canvas.renderAll());
  };

  /**
   * Zoom the drawing by the factor specified
   *
   * The zoom factor is a percentage with regards the original, for example if factor is set to 2
   * it will double the size whereas if it is set to 0.5 it will half the size
   *
   * @param factor the zoom factor
   */
  zoom = (factor) => {
    let canvas = this._fc;
    let objects = canvas.getObjects();
    for (let i in objects) {
      objects[i].scaleX = objects[i].scaleX * factor;
      objects[i].scaleY = objects[i].scaleY * factor;
      objects[i].left = objects[i].left * factor;
      objects[i].top = objects[i].top * factor;
      objects[i].setCoords();
    }
    canvas.renderAll();
    canvas.calcOffset();
  };

  _handleUndo(obj, prevState) {
    if (obj == this.backgroundImage) {
      const eraserObj = JSON.parse(prevState);
      if (!eraserObj.eraser) {
        this.backgroundImage.eraser = null;
        this.backgroundImage.__lastEraser = "{}";
        this.backgroundImage.applyFilters();
      } else {
        fabric.Eraser.fromObject(eraserObj.eraser, (newEraser) => {
          this.backgroundImage.eraser = newEraser;
          this.backgroundImage.__lastEraser = prevState;
          this.backgroundImage.applyFilters();
        });
      }
    } else if (obj.__removed) {
      //this.setState({ action: false }, () => {
      this._fc.add(obj);
      if (obj.group) {
        const transform = t.group.calcTransformMatrix();
        const decomp = fabric.util.qrDecompose(o);
        const trans = {
          x: decomp.translateX,
          y: decomp.translateY,
        };

        obj.transformMatrix = [1, 0, 0, 1, 0, 0];
        (obj.flipX = false),
          (obj.flipY = false),
          trans.setOptions(r),
          obj.setPositionByOrigin(trans, "center", "center");
        obj.group.remove(t);
      }
      obj.__version -= 1;
      obj.__removed = false;
      //});
    } else if (obj.__version <= 1) {
      // HANDLE GROUP?
      this._fc.remove(obj);
    } else {
      obj.__version -= 1;
      obj.setOptions(this._parseObject(prevState));
      obj.setCoords();
      obj.__originalState = prevState;
      // this._fc.renderAll();
    }
  }
  /**
   * Perform an undo operation on canvas, if it cannot undo it will leave the canvas intact
   */
  undo = () => {
    this._fc.discardActiveObject();
    let history = this._history;

    let [obj, prevState] = history.getCurrent();
    history.undo();
    history.ignore = true;
    this._fc.clearContext(this._fc.contextTop);
    this._fc.renderAll();
    if (obj.atomicList) {
      obj.atomicList.forEach((item) => {
        this._handleUndo(item[0], item[1]);
      });
    } else {
      this._handleUndo(obj, prevState);
    }
    this._fc.renderAll();
    history.ignore = false;

    if (this.props.onChange) {
      this.props.onChange();
    }
  };

  /**
   * Perform a redo operation on canvas, if it cannot redo it will leave the canvas intact
   */

  _handleRedo(obj, next, curState) {
    if (obj.__version == 0) {
      this.canvas.add(obj);
      obj.__version = 1;
    } else {
      obj.__version += 1;
      obj.setOptions(this._parseObject(curState));
      obj.setCoords();
    }
  }
  redo = () => {
    const history = this._history;
    history.ignore = true;
    if (history.canRedo()) {
      let [obj, prevState] = history.getCurrent();

      if (obj.atomicList) {
        obj.atomicList.forEach((item) => {
          this._hanldeRedo(this.history[0], this.history[1]);
        });
      } else {
        this._hanldeRedo(obj, prevState);
      }
    }
    this._fc.renderAll();
    history.ignore = true;
    if (this.props.onChange) {
      this.props.onChange();
    }
  };

  /**
   * Delegation method to check if we can perform an undo Operation, useful to disable/enable possible buttons
   *
   * @returns {*} true if we can undo otherwise false
   */
  canUndo = () => {
    return this._history.canUndo();
  };

  /**
   * Delegation method to check if we can perform a redo Operation, useful to disable/enable possible buttons
   *
   * @returns {*} true if we can redo otherwise false
   */
  canRedo = () => {
    return this._history.canRedo();
  };

  /**
   * Exports canvas element to a dataurl image. Note that when multiplier is used, cropping is scaled appropriately
   *
   * Available Options are
   * <table style="width:100%">
   *
   * <tr><td><b>Name</b></td><td><b>Type</b></td><td><b>Argument</b></td><td><b>Default</b></td><td><b>Description</b></td></tr>
   * <tr><td>format</td> <td>String</td> <td><optional></td><td>png</td><td>The format of the output image. Either "jpeg" or "png"</td></tr>
   * <tr><td>quality</td><td>Number</td><td><optional></td><td>1</td><td>Quality level (0..1). Only used for jpeg.</td></tr>
   * <tr><td>multiplier</td><td>Number</td><td><optional></td><td>1</td><td>Multiplier to scale by</td></tr>
   * <tr><td>left</td><td>Number</td><td><optional></td><td></td><td>Cropping left offset. Introduced in v1.2.14</td></tr>
   * <tr><td>top</td><td>Number</td><td><optional></td><td></td><td>Cropping top offset. Introduced in v1.2.14</td></tr>
   * <tr><td>width</td><td>Number</td><td><optional></td><td></td><td>Cropping width. Introduced in v1.2.14</td></tr>
   * <tr><td>height</td><td>Number</td><td><optional></td><td></td><td>Cropping height. Introduced in v1.2.14</td></tr>
   *
   * </table>
   *
   * @returns {String} URL containing a representation of the object in the format specified by options.format
   */
  toDataURL = (options) => this._fc.toDataURL(options);

  /**
   * Returns JSON representation of canvas
   *
   * @param propertiesToInclude Array <optional> Any properties that you might want to additionally include in the output
   * @returns {string} JSON string
   */
  toJSON = (propertiesToInclude) => this._fc.toJSON(propertiesToInclude);

  /**
   * Populates canvas with data from the specified JSON.
   *
   * JSON format must conform to the one of fabric.Canvas#toDatalessJSON
   *
   * @param json JSON string or object
   */
  fromJSON = (json) => {
    if (!json) return;
    let canvas = this._fc;
    setTimeout(() => {
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        if (this.props.onChange) {
          this.props.onChange();
        }
      });
    }, 100);
  };

  /**
   * Clear the content of the canvas, this will also clear history but will return the canvas content as JSON to be
   * used as needed in order to undo the clear if possible
   *
   * @param propertiesToInclude Array <optional> Any properties that you might want to additionally include in the output
   * @returns {string} JSON string of the canvas just cleared
   */
  clear = (propertiesToInclude) => {
    let discarded = this.toJSON(propertiesToInclude);
    this._fc.clear();
    this._history.clear();
    if (this.backgroundImage) {
      this.backgroundImage.eraser = null;
      this._history.ignore = true;
      this._fc.add(this.backgroundImage);
      this._history.ignore = false;
    }
    return discarded;
  };

  /**
   * Remove selected object from the canvas
   */
  removeSelected = () => {
    let canvas = this._fc;
    const isDrawingMide = this._fc.isDrawingMode;
    this._fc.isDrawingMode && (this._fc.isDrawingMode = false);
    let activeObj = canvas.getActiveObject();
    if (activeObj) {
      let selected = [];
      if (activeObj.type === "activeSelection") {
        activeObj.forEachObject((obj) => selected.push(obj));
      } else {
        selected.push(activeObj);
      }
      this._history.atomicStart();
      selected.forEach((obj) => {
        obj.__removed = true;
        let objState = this._objectToJSON(obj);
        obj.__originalState = JSON.stringify(objState);
        let state = this._objectToString(objState);
        this._history.keep([obj, state, state]);
        canvas.remove(obj);
      });
      this._history.atomicEnd();

      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  };

  copy = () => {
    let canvas = this._fc;
    canvas.getActiveObject().clone((cloned) => (this._clipboard = cloned));
  };

  paste = () => {
    // clone again, so you can do multiple copies.
    this._clipboard.clone((clonedObj) => {
      let canvas = this._fc;
      canvas.discardActiveObject();
      clonedObj.set({
        left: clonedObj.left + 10,
        top: clonedObj.top + 10,
        evented: true,
      });
      if (clonedObj.type === "activeSelection") {
        // active selection needs a reference to the canvas.
        clonedObj.canvas = canvas;
        clonedObj.forEachObject((obj) => canvas.add(obj));
        clonedObj.setCoords();
      } else {
        canvas.add(clonedObj);
      }
      this._clipboard.top += 10;
      this._clipboard.left += 10;
      canvas.setActiveObject(clonedObj);
      canvas.requestRenderAll();
    });
  };

  /**
   * Sets the background from the dataUrl given
   *
   * @param dataUrl the dataUrl to be used as a background
   * @param options
   */
  setBackgroundFromDataUrl = (dataUrl, options = {}) => {
    let canvas = this._fc;
    if (options.stretched) {
      delete options.stretched;
      Object.assign(options, {
        width: canvas.width,
        height: canvas.height,
      });
    }
    if (options.stretchedX) {
      delete options.stretchedX;
      Object.assign(options, {
        width: canvas.width,
      });
    }
    if (options.stretchedY) {
      delete options.stretchedY;
      Object.assign(options, {
        height: canvas.height,
      });
    }
    let img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () =>
      canvas.setBackgroundImage(
        new fabric.Image(img),
        () => canvas.renderAll(),
        options
      );
    img.src = dataUrl;
  };

  updateBackgroundImageFromProps() {}

  addText = (text, options = {}) => {
    let canvas = this._fc;
    let iText = new fabric.IText(text, options);
    let opts = {
      left: (canvas.getWidth() - iText.width) * 0.5,
      top: (canvas.getHeight() - iText.height) * 0.5,
    };
    Object.assign(options, opts);
    iText.set({
      left: options.left,
      top: options.top,
    });

    canvas.add(iText);
  };

  getCanvas = () => {
    return this._fc;
  };
  componentDidMount = () => {
    let { tool, value, undoSteps, defaultValue, backgroundColor } = this.props;

    let canvas = (this._fc = new fabric.Canvas(
      this._canvas /*, {
         preserveObjectStacking: false,
         renderOnAddRemove: false,
         skipTargetFind: true
         }*/
    ));

    this._initTools(canvas);

    // set initial backgroundColor
    this._backgroundColor(backgroundColor);

    let selectedTool = this._tools[tool];
    selectedTool.configureCanvas(this.props);
    this._selectedTool = selectedTool;

    // Control resize
    window.addEventListener("resize", this._resize, false);

    // Initialize History, with maximum number of undo steps
    this._history = new History(undoSteps, this.props.debugHistory);

    // Events binding
    canvas.on("object:added", this._onObjectAdded);
    canvas.on("object:modified", this._onObjectModified);
    canvas.on("object:removed", this._onObjectRemoved);
    canvas.on("mouse:down", this._onMouseDown);
    canvas.on("mouse:move", this._onMouseMove);
    canvas.on("mouse:up", this._onMouseUp);
    canvas.on("mouse:out", this._onMouseOut);
    canvas.on("object:moving", this._onObjectMoving);
    canvas.on("object:scaling", this._onObjectScaling);
    canvas.on("object:rotating", this._onObjectRotating);
    canvas.on("erasing:end", (e) => {
      if (!e?.targets?.length) {
        return;
      }
      this._history.atomicStart();

      for (const target of e.targets) {
        if (target) {
          if ((target = this.backgroundImage)) {
            this._history.keep([
              this.backgroundImage,
              this.backgroundImage.__lastEraser || "{}",
            ]);
            let objState = target.eraser
              ? this._objToJSON(target.eraser)
              : null;
            this.backgroundImage.__lastEraser = this._objectToString({
              eraser: objState,
            });
          } else {
            this._onObjectModified({ target: target });
          }
        }
      }
      // this._onObjectAdded({ target: e.path });
      this._history.atomicEnd();
    });
    // IText Events fired on Adding Text
    // canvas.on("text:event:changed", console.log)
    // canvas.on("text:selection:changed", console.log)
    // canvas.on("text:editing:entered", console.log)
    // canvas.on("text:editing:exited", console.log)

    this.disableTouchScroll();

    this._resize();
    if (this.props.imageData) {
      fabric.Image.fromURL(this.props.imageData, function (image) {
        this.backgroundImage = image;
        var ratio = image.width / image.height;
        var width = this.props.width;
        var height = width / ratio;
        // Needs to be cleaned up
        if (this.props.height < height) {
          width = (height = this.props.height) * height;
        }
        var i = {
          left: (this.props.width - width) / 2,
          top: (this.props.height - height) / 2,
          width: width,
          height: height,
        };
        image.setOptions(i);
        this._history.ignore = true;
        image.filters.push(
          new fabric.Image.filters.Grayscale({
            mode: "luminosity",
          })
        );
        image.applyFilters();
        this._fc.add(e);
        this._fc.renderAll();
        if (this.props.onChange) {
          var s = t.props.onChange;
          setTimeout(function () {
            s();
          }, 10);
        }
        (this._history.ignore = false), this._history.clear();
      });
    }

    // initialize canvas with controlled value if exists
    (value || defaultValue) && this.fromJSON(value || defaultValue);
  };

  componentWillUnmount() {
    window.removeEventListener("resize", this._resize);
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.parentWidth !== prevState.parentWidth ||
      this.props.width !== prevProps.width ||
      this.props.height !== prevProps.height
    ) {
      this._resize();
    }

    if (this.props.tool !== prevProps.tool) {
      this._selectedTool.cleanupTool(this.props);
      this._selectedTool =
        this._tools[this.props.tool] || this._tools[Tool.Pencil];
    }

    //Bring the cursor back to default if it is changed by a tool
    this._fc.defaultCursor = "default";
    this._selectedTool.configureCanvas(this.props, this._history);

    if (this.props.backgroundColor !== prevProps.backgroundColor) {
      this._backgroundColor(this.props.backgroundColor);
    }

    if (
      this.props.value !== prevProps.value ||
      (this.props.value && this.props.forceValue)
    ) {
      this.fromJSON(this.props.value);
    }
    if (this.backgroundImage && this.props.imageMode != prevProps.imageMode) {
      var n = new fabric.Image.filters.Invert();
      this.backgroundImage.filters.push(n);
      this.backgroundImage.applyFilters();
      this._fc.requestRenderAll();
      if (this.props.onChange) {
        var onChange = this.props.onChange;
        setTimeout(function () {
          onChange();
        }, 10);
      }
    }
  }

  render = () => {
    let { className, style, width, height } = this.props;

    let canvasDivStyle = Object.assign(
      {},
      style ? style : {},
      width ? { width: width } : {},
      height ? { height: height } : { height: 512 }
    );

    return (
      <div
        className={className}
        ref={(c) => (this._container = c)}
        style={canvasDivStyle}
      >
        <canvas id={uuid4()} ref={(c) => (this._canvas = c)}>
          Sorry, Canvas HTML5 element is not supported by your browser :(
        </canvas>
      </div>
    );
  };
}

export default SketchField;
