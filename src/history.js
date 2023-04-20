/**
 * Maintains the history of an object
 */
class History {
  constructor(undoLimit = 10, debug = false) {
    this.undoLimit = undoLimit;
    this.undoList = [];
    this.redoList = [];
    this.current = null;
    this.debug = debug;
    this.atomic = false;
    this.atomicList = false;
  }

  /**
   * Get the limit of undo/redo actions
   *
   * @returns {number|*} the undo limit, as it is configured when constructing the history instance
   */
  getUndoLimit() {
    return this.undoLimit;
  }

  atomicStart() {
    if (!this.atomic) {
      this.atomic = true;
      this.atomicList = [];
    }
  }
  atomicEnd() {
    this.atomic = false;
    if (this.atomicList.length > 0) {
      this.keep([
        {
          atomicList: this.atomicList,
        },
      ]);
      this.atomicList = [];
    }
  }

  /**
   * Get Current state
   *
   * @returns {null|*}
   */
  getCurrent() {
    return this.undoList[this.undoList.length - 1];
  }

  /**
   * Keep an object to history
   *
   * This method will set the object as current value and will push the previous "current" object to the undo history
   *
   * @param obj
   */
  keep(obj) {
    try {
      if (this.ignore) {
        return;
      }
      if (this.atomic) {
        this.atomicList.push(obj);
      } else {
        this.redoList = [];
        if (obj) {
          this.undoList.push(obj);
          if (this.undoList.length > this.undoLimit) {
            this.undoList.shift();
          }
        }
      }
    } catch (e) {
      //
    } finally {
      this.print();
    }
  }

  /**
   * Undo the last object, this operation will set the current object to one step back in time
   *
   * @returns the new current value after the undo operation, else null if no undo operation was possible
   */
  undo() {
    try {
      const t = this.undoList.pop();
      if (t) {
        this.redoList.push(t);
        if (this.redoList.length > this.undoLimit) {
          this.redoList.shift();
        }
        return t;
      }
      return t;
    } finally {
      this.print();
    }
  }

  /**
   * Redo the last object, redo happens only if no keep operations have been performed
   *
   * @returns the new current value after the redo operation, or null if no redo operation was possible
   */
  redo() {
    try {
      if (this.redoList.length > 0) {
        return this.redoList.pop();
      }
      return null;
    } finally {
      this.print();
    }
  }

  /**
   * Checks whether we can perform a redo operation
   *
   * @returns {boolean}
   */
  canRedo() {
    return this.redoList.length > 0;
  }

  /**
   * Checks whether we can perform an undo operation
   *
   * @returns {boolean}
   */
  canUndo() {
    return this.undoList.length > 0;
  }

  /**
   * Clears the history maintained, can be undone
   */
  clear() {
    this.undoList = [];
    this.redoList = [];
    this.current = null;
    this.print();
  }

  print() {
    if (this.debug) {
      /* eslint-disable no-console */
      console.log(
        this.undoList,
        " -> " + this.current + " <- ",
        this.redoList.slice(0).reverse()
      );
    }
  }
}

export default History;
