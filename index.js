import Domodule from 'domodule';
import { on } from 'domassist';

const doc = document.documentElement;

class MediaCropper extends Domodule {
  get defaults() {
    return {
      minWidth: 60,
      minHeight: 60,
      maxWidth: 800,
      maxHeight: 900
    };
  }

  get required() {
    return {
      named: ['source', 'container']
    };
  }

  postInit() {
    this.originalSource = new Image();
    this.constrain = false;
    this.canvas = document.createElement('canvas');
    this.handlers = this.find('.resize-handle');
    this.eventState = {};

    // Keeping a copy of the original
    this.originalSource.src = this.els.source.src;
    on(this.handlers, 'mousedown', this.startResize.bind(this));
    on(this.handlers, 'touchstart', this.startResize.bind(this));
    on(this.els.source, 'mousedown', this.startMove.bind(this));
    on(this.els.source, 'touchstart', this.startMove.bind(this));

    this.boundResize = this.resize.bind(this);
    this.boundEndResize = this.endResize.bind(this);
    this.boundMove = this.move.bind(this);
    this.boundEndMove = this.endMove.bind(this);
  }

  saveState(event) {
    const offset = this.els.container.getBoundingClientRect();
    const mouse = MediaCropper.getMouseData(event);

    // Save the initial event details and container state
    this.eventState = {
      event,
      containerWidth: this.els.container.offsetWidth,
      containerHeight: this.els.container.offsetHeight,
      containerLeft: offset.left + MediaCropper.getScrollLeft(),
      containerTop: offset.top + MediaCropper.getScrollTop(),
      mouseX: mouse.x,
      mouseY: mouse.y
    };
  }

  startResize(event) {
    event.preventDefault();
    event.stopPropagation();
    this.saveState(event);
    doc.addEventListener('mousemove', this.boundResize);
    doc.addEventListener('touchmove', this.boundResize);
    doc.addEventListener('mouseup', this.boundEndResize);
    doc.addEventListener('touchend', this.boundEndResize);
  }

  resize(event) {
    const mouse = MediaCropper.getMouseData(event);
    let width;
    let height;
    let left;
    let top;

    switch (this.eventState.event.target.dataset.direction) {
      default:
        break;
      case 'se':
        width = mouse.x - this.eventState.containerLeft;
        height = mouse.y - this.eventState.containerTop;
        left = this.eventState.containerLeft;
        top = this.eventState.containerTop;
        break;
      case 'sw':
        width = this.eventState.containerWidth - (mouse.x - this.eventState.containerLeft);
        height = mouse.y - this.eventState.containerTop;
        left = mouse.x;
        top = this.eventState.containerTop;
        break;
      case 'nw':
        width = this.eventState.containerWidth - (mouse.x - this.eventState.containerLeft);
        height = this.eventState.containerHeight - (mouse.y - this.eventState.containerTop);
        left = mouse.x;
        top = mouse.y;
        if (this.constrain || event.shiftKey) {
          top = mouse.y -
            ((width / this.originalSource.width * this.originalSource.height) - height);
        }
        break;
      case 'ne':
        width = mouse.x - this.eventState.containerLeft;
        height = this.eventState.containerHeight - (mouse.y - this.eventState.containerTop);
        left = this.eventState.containerLeft;
        top = mouse.y;
        if (this.constrain || event.shiftKey) {
          top = mouse.y -
            ((width / this.originalSource.width * this.originalSource.height) - height);
        }

        break;
    }

    // Optionally maintain aspect ratio
    if (this.constrain || event.shiftKey) {
      height = width / this.originalSource.width * this.originalSource.height;
    }

    if (width > this.options.minWidth &&
        height > this.options.minHeight &&
        width < this.options.maxWidth &&
        height < this.options.maxHeight) {
      this.resizeImage(width, height);
      this.setOffset({ left, top });
    }
  }
  setOffset(offset) {
    const parentRect = this.els.container.parentElement.getBoundingClientRect();
    const parentLeft = parentRect.left + MediaCropper.getScrollLeft();
    const parentTop = parentRect.top + MediaCropper.getScrollTop();
    const top = offset.top - parentTop;
    const left = offset.left - parentLeft;

    this.els.container.style.left = `${left}px`;
    this.els.container.style.top = `${top}px`;
  }

  endResize(event) {
    event.preventDefault();
    this.resizeImageCanvas(
      this.els.source.width, this.els.source.height);
    doc.removeEventListener('mousemove', this.boundResize);
    doc.removeEventListener('touchmove', this.boundResize);
    doc.removeEventListener('mouseup', this.boundEndResize);
    doc.removeEventListener('touchend', this.boundEndResize);
  }

  resizeImage(width, height) {
    this.els.source.style.width = `${width}px`;
    this.els.source.style.height = `${height}px`;
  }

  resizeImageCanvas(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').drawImage(this.originalSource, 0, 0, width, height);
    this.els.source.src = this.canvas.toDataURL('image/jpg');
  }

  startMove(event) {
    event.preventDefault();
    event.stopPropagation();
    this.saveState(event);
    doc.addEventListener('mousemove', this.boundMove);
    doc.addEventListener('touchmove', this.boundMove);
    doc.addEventListener('mouseup', this.boundEndMove);
    doc.addEventListener('touchend', this.boundEndMove);
  }

  move(event) {
    const mouse = MediaCropper.getMouseData(event);
    event.preventDefault();
    event.stopPropagation();

    const touches = event.touches;

    this.setOffset({
      left: mouse.x - (this.eventState.mouseX - this.eventState.containerLeft),
      top: mouse.y - (this.eventState.mouseY - this.eventState.containerTop)
    });

    // Watch for pinch zoom gesture while moving
    if (this.eventState.event.touches &&
        this.eventState.event.touches.length > 1 &&
        touches.length > 1) {
      let width = this.eventState.containerWidth;
      let height = this.eventState.containerHeight;
      let a = this.eventState.event.touches[0].clientX -
              this.eventState.event.touches[1].clientX;
      a = a * a;
      let b = this.eventState.event.touches[0].clientY -
              this.eventState.event.touches[1].clientY;
      b = b * b;
      const dist1 = Math.sqrt(a + b);

      a = touches[0].clientX - touches[1].clientX;
      a = a * a;
      b = touches[0].clientY - touches[1].clientY;
      b = b * b;
      const dist2 = Math.sqrt(a + b);
      const ratio = dist2 / dist1;

      width = width * ratio;
      height = height * ratio;

      this.resizeImage(width, height);
    }
  }

  endMove(event) {
    event.preventDefault();
    doc.removeEventListener('mousemove', this.boundMove);
    doc.removeEventListener('touchmove', this.boundMove);
    doc.removeEventListener('mouseup', this.boundEndMove);
    doc.removeEventListener('touchend', this.boundEndMove);
  }

  crop() {
    const overlayRect = this.els.overlay.getBoundingClientRect();
    const containerRect = this.els.container.getBoundingClientRect();
    const left = (overlayRect.left + MediaCropper.getScrollLeft()) -
                  (containerRect.left + MediaCropper.getScrollLeft());
    const top = (overlayRect.top + MediaCropper.getScrollTop()) -
                  (containerRect.top + MediaCropper.getScrollTop());
    const width = this.els.overlay.offsetWidth;
    const height = this.els.overlay.offsetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    canvas.getContext('2d').drawImage(this.els.source, left, top, width, height, 0, 0, width, height);
    window.open(canvas.toDataURL('image/jpg'));
  }

  static getMouseData(event) {
    const x = (event.clientX || event.pageX || event.touches[0].clientX) + MediaCropper.getScrollLeft();
    const y = (event.clientY || event.pageY || event.touches[0].clientY) + MediaCropper.getScrollTop();
    return { x, y };
  }

  static getScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop;
  }

  static getScrollLeft() {
    return window.pageXOffset || document.documentElement.scrollLeft;
  }
}

Domodule.register('MediaCropper', MediaCropper);

export default MediaCropper;
