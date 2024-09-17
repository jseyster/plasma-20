/**
 * Copyright 2023 Justin Seyster
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the “Software”), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import "./third-party/iro.min.js";

// How long the controls stay visible after the user stops hovering over them.
const kOpacityLingerTimeMS = 1000;

const kStyleSheet = `
:host {
    position: relative;
    display: flex;
    flex-direction: column;

    width: 512px;
    height: 70px;

    --slider-size: 16px;

    --marker-color: #rgb(0, 0, 0);
    --marker-height: 8px;
    --marker-width: 8px;

    /* Extra space between bottom marker strip and rail. */
    --marker-strip-clearance: 6px;

    /* Space between point of the triangle marker and the gradient display. */
    --marker-clearance: 2px;

    --opacity-transition-time: 500ms;
    --marker-transition-time: 200ms;
    --slider-transition-time: 150ms;
}

canvas {
    flex-grow: 1;

    width: 100%;
    height: 1px;

    margin: var(--marker-height) 0;

    border-radius: 4px;
}

div.rail {
    display: flex;
    flex-direction: row;
    align-items: center;

    width: 100%;
    height: var(--slider-size);

    margin-top: var(--marker-strip-clearance);

    cursor: pointer;
}

div.rail-guide {
    width: 100%;
    height: 2px;

    background-color: rgb(0, 0, 0);

    z-index: -2;
}

div.slider-container {
    position: absolute;

    padding: 0px;
    margin: 0px;
    border: 0px;

    left: 0px;
    top: 0px;
    width: 100%;
    height: 100%;

    clip-path: padding-box inset(-20px 0px);

    pointer-events: none;
}

div.rail-slider-base {
    /* The slider's distance along the rail as a number in the range [0, 1]. */
    --offset: 0;

    position: absolute;

    left: calc(var(--offset) * 100%);
    top: 0px;

    height: 100%;
}

div.rail-slider {
    position: absolute;

    left: 0px;
    bottom: 0px;
    width: var(--slider-size);
    height: var(--slider-size);

    transform: translateX(-50%);

    cursor: pointer;
    pointer-events: all;

    /* Using the offset value for the z-index ensures that, when multiple sliders overlap, they
     * stack from left to right. */
    z-index: calc(1000000 * var(--offset));
}

div.rail-slider:hover,
div.rail-slider-base.sliding div.rail-slider {
    z-index: 10000000000;
}

div.rail-slider::before {
    content: ' ';
    display: block;

    width: 100%;
    height: 100%;

    border-radius: 50%;

    background-color: var(--gradient-stop-color);

    transition: transform var(--slider-transition-time);
}

div.rail-slider-base.selected div.rail-slider::before {
    box-shadow: 0px 0px 0px 3px #000000;
}

div.rail-slider:hover::before,
div.rail-slider-base.sliding div.rail-slider::before {
    transform: scale(1.3);
}

div.rail-slider-base.just-created div.rail-slider::before {
    transform: scale(0);
}

div.rail-slider-base.destroyed div.rail-slider {
    pointer-events: none;
}

div.rail-slider-base.destroyed div.rail-slider::before {
    transform: scale(0);
}

div.guide-blocker {
    position: absolute;

    left: 0px;
    bottom: 0px;
    width: calc(var(--slider-size) + 6px);
    height: var(--slider-size);

    transform: translateX(-50%);
    transition: transform var(--slider-transition-time);

    background-color: var(--rail-background-color, rgb(255, 255, 255));

    z-index: -1;
}

div.rail-slider:hover + div.guide-blocker,
div.rail-slider-base.sliding div.guide-blocker {
    transform: translateX(-50%) scaleX(1.3);
}

div.rail-slider-base.just-created div.guide-blocker,
div.rail-slider-base.destroyed div.guide-blocker {
    transform: translateX(-50%) scaleX(0);
}

div.triangle-marker-top {
    position: absolute;
    left: 0px;
    top: calc(-1 * var(--marker-clearance));

    width: 0px;
    height: 0px;

    border-top-width: var(--marker-height);
    border-top-style: solid;
    border-top-color: var(--marker-color);
    border-left-width: calc(var(--marker-width)/ 2);
    border-left-style: solid;
    border-left-color: transparent;
    border-right-width: calc(var(--marker-width)/ 2);
    border-right-style: solid;
    border-right-color: transparent;

    opacity: 0%;
    transform: translateX(-50%);
    transition: opacity var(--marker-transition-time), transform var(--marker-transition-time);
}

div.rail-slider-base.sliding div.triangle-marker-top {
    opacity: 100%;
    transform: translateX(-50%) translateY(6px);
}

div.triangle-marker-bottom {
    position: absolute;
    left: 0px;
    bottom: calc(var(--slider-size) + var(--marker-strip-clearance) - var(--marker-clearance));

    width: 0px;
    height: 0px;

    border-left-width: calc(var(--marker-width)/ 2);
    border-left-style: solid;
    border-left-color: transparent;
    border-right-width: calc(var(--marker-width)/ 2);
    border-right-style: solid;
    border-right-color: transparent;
    border-bottom-width: var(--marker-height);
    border-bottom-style: solid;
    border-bottom-color: var(--marker-color);

    opacity: 0%;
    transform: translateX(-50%);
    transition: opacity var(--marker-transition-time), transform var(--marker-transition-time);
}

div.rail-slider-base.sliding div.triangle-marker-bottom {
    transform: translateX(-50%) translateY(-6px);
}

:host(.active-gesture) div.triangle-marker-bottom {
    opacity: 100%;
}

div.rail-slider-base.destroyed div.triangle-marker-top,
div.rail-slider-base.destroyed div.triangle-marker-bottom {
        opacity: 0%;
}

.show-on-control-hover {
    opacity: 0%;
    transition: opacity var(--opacity-transition-time);
}

:host(:hover) .show-on-control-hover,
:host(.linger) .show-on-control-hover,
:host(.revealed-following-touch) .show-on-control-hover,
:host(.active-gesture) .show-on-control-hover,
:host(.open-dialog) .show-on-control-hover {
    opacity: 100%;
}

dialog {
    display: flex;
    flex-direction: column;
    gap: 10px;

    position: absolute;
    left: 0;
    top: calc(100% + 20px);
    z-index: 90000000000;
}

.dialog-row {
    display: flex;
    flex-direction: row;
}

.swatch {
    background-color: #ff0000;

    flex-grow: 1;
    border-radius: 4px;
}

.IroHandle:not(.IroHandle--isActive) {
    opacity: 50%;
}`;

async function waitForAllTransitions(element) {
    const animatingElements =
        Array.from(element.querySelectorAll("*"))
            .filter(child => child.getAnimations().some(anim => anim instanceof CSSTransition));
    if (animatingElements.length === 0) {
        return Promise.resolve();
    }

    const transitionPromises = animatingElements.map(
        child => new Promise(resolve => {
            child.addEventListener('transitionend', () => { resolve(); }, {once: true});
        }));
    return Promise.all(transitionPromises).then(() => { waitForAllTransitions(element); });
}

class ColorChooserDialog extends EventTarget {
    #dialog;
    #colorInput;
    #swatch;
    #currentSelectedIndex;
    constructor(dialogParent, initialValues, selectedIndex) {
        super();

        this.#dialog = document.createElement("dialog");
        this.#colorInput = new iro.ColorPicker(
            this.#dialog.insertAdjacentElement("afterbegin", document.createElement("div")),
            {colors: initialValues});
        this.#colorInput.setActiveColor(selectedIndex);
        this.#colorInput.on("input:change", color => {
            this.#swatch.style.backgroundColor = color.hexString;
            this.dispatchEvent(
                new CustomEvent("color-input", {detail: {newValue: color.hexString}}));
        });

        this.#currentSelectedIndex = selectedIndex;
        this.#colorInput.on("color:setActive", event => {
            if (event.index !== this.#currentSelectedIndex) {
                this.#currentSelectedIndex = event.index;
                this.#swatch.style.backgroundColor = event.hexString;
                this.dispatchEvent(new CustomEvent(
                    "selection-changed", {detail: {selectedIndex: this.#currentSelectedIndex}}));
            }
        });

        this.#swatch = document.createElement("div");
        this.#swatch.classList.add("swatch");
        this.#swatch.style.backgroundColor = initialValues[selectedIndex];

        const deleteButton = document.createElement("button");
        deleteButton.innerText = "Delete";
        deleteButton.addEventListener("click", () => { this.dispatchEvent(new Event("delete")); });

        const doneButton = document.createElement("button");
        doneButton.innerText = "Done";

        const dialogRow = document.createElement("div");
        dialogRow.classList.add("dialog-row");
        dialogRow.appendChild(this.#swatch);
        dialogRow.appendChild(deleteButton);
        dialogRow.appendChild(doneButton);
        this.#dialog.appendChild(dialogRow);

        const dialogEventsScope = new AbortController();
        new Promise(resolve => {
            doneButton.addEventListener("click", () => { this.#dialog.close(); });
            window.addEventListener("keydown", event => {
                if ("Escape" === event.key) {
                    this.#dialog.close();
                } else if ("Delete" === event.key || "Backspace" === event.key) {
                    this.dispatchEvent(new Event("delete"));
                }
            }, {signal: dialogEventsScope.signal});

            this.#dialog.addEventListener("mousedown", event => { event.stopPropagation(); });
            document.body.addEventListener(
                "mousedown", () => { this.#dialog.close(); }, {signal: dialogEventsScope.signal});

            this.#dialog.addEventListener("close", () => { resolve(); });
        }).finally(() => {
            this.#dialog.remove();
            dialogEventsScope.abort();

            this.dispatchEvent(new Event("dismiss"));
        });

        dialogParent.appendChild(this.#dialog);
        this.#dialog.show();
    }

    close() {
        this.#dialog.close();
    }

    addColor(newColor) {
        const newIndex = this.#colorInput.colors.length;
        this.#colorInput.addColor(newColor);
        this.#colorInput.setActiveColor(newIndex);
    }

    setSelectedIndex(newIndex) {
        this.#currentSelectedIndex = newIndex;
        this.#colorInput.setActiveColor(this.#currentSelectedIndex);
        this.#swatch.style.backgroundColor = this.#colorInput.color.hexString;
    }
}

class RailSlider {
    #sliderBase;
    #sliderContainer;
    #gradientStopModel;
    #controlRoot;
    constructor(gradientStopModel, sliderContainer, controlRoot, justCreated = false) {
        this.#sliderContainer = sliderContainer;
        this.#gradientStopModel = gradientStopModel;
        this.#controlRoot = controlRoot;

        this.#gradientStopModel.offset =
            [0, this.#gradientStopModel.offset, 1].sort((a, b) => a - b)[1];

        this.#sliderBase = document.createElement("div");
        this.#sliderBase.classList.add("rail-slider-base",
                                       ...(justCreated ? ["just-created"] : []));
        this.#sliderBase.style.setProperty("--offset", this.#gradientStopModel.offset);

        const slider = document.createElement("div");
        slider.classList.add("rail-slider", "show-on-control-hover");
        if (this.#gradientStopModel.color) {
            this.#sliderBase.style.setProperty("--gradient-stop-color",
                                               this.#gradientStopModel.color);
        }

        slider.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
            this._handlePressStart(this.#sliderBase.offsetLeft,
                                   {x: event.clientX, y: event.clientY});
        });

        slider.addEventListener("touchstart", event => {
            event.preventDefault();
            event.stopPropagation();

            // If the user is able to get two touch points onto the same slider, we ignore all but
            // one.
            const touch = event.changedTouches[0];
            this._handlePressStart(this.#sliderBase.offsetLeft,
                                   {x: touch.clientX, y: event.clientY},
                                   touch.identifier);
        }, {passive: false});

        const blocker = document.createElement("div");
        blocker.classList.add("guide-blocker");

        const triangleMarkerTop = document.createElement("div");
        triangleMarkerTop.classList.add("triangle-marker-top");

        const triangleMarkerBottom = document.createElement("div");
        triangleMarkerBottom.classList.add("triangle-marker-bottom");

        this.#sliderBase.appendChild(slider);
        this.#sliderBase.appendChild(blocker);
        this.#sliderBase.appendChild(triangleMarkerTop);
        this.#sliderBase.appendChild(triangleMarkerBottom);
        this.#sliderContainer.appendChild(this.#sliderBase);
    }

    get colorValue() {
        return this.#gradientStopModel.color;
    }

    markAsSelected() {
        this.#sliderBase.classList.add("selected");
    }

    unmarkAsSelected() {
        this.#sliderBase.classList.remove("selected");
    }

    #updateHandlers = [];
    addUpdateHandler(handler) {
        this.#updateHandlers.push(handler);
    }

    #deleteHandlers = [];
    addDeleteHandler(handler) {
        this.#deleteHandlers.push(handler);
    }

    handleSlideGestureFromCreation(startSliderPosition, slideStart, touchIdentifier = null) {
        setTimeout(() => { this.#sliderBase.classList.remove("just-created"); }, 0);
        const destroyWhenCanceled = true;
        this._handlePressStart(
            startSliderPosition, slideStart, touchIdentifier, touchIdentifier, destroyWhenCanceled);

        for (let handler of this.#updateHandlers) {
            handler();
        }
    }

    _installMouseEventsForSlide(startSliderPosition, slideStart, slideEventsScope, resolveSlide) {
        let sliderMoved = false;
        window.addEventListener("mousemove", event => {
            sliderMoved = true;
            this._handleSlide(
                startSliderPosition, slideStart, {x: event.clientX, y: event.clientY});
        }, {signal: slideEventsScope.signal});
        window.addEventListener("mouseup", () => {
            this.#sliderBase.dispatchEvent(
                new CustomEvent("press-finish", {bubbles: true, detail: {fromTouch: false}}));
            if (!sliderMoved) {
                this.#sliderBase.dispatchEvent(
                    new CustomEvent("press-finish-without-input",
                                    {bubbles: true, detail: {controller: this, fromTouch: false}}));
            }

            resolveSlide();
        }, {signal: slideEventsScope.signal});
    }

    _installTouchEventsForSlide(
        startSliderPosition, slideStart, identifier, slideEventsScope, resolveSlide) {
        let sliderMoved = false;
        window.addEventListener("touchmove", event => {
            const touch =
                Array.from(event.changedTouches).find(touch => touch.identifier === identifier);
            if (touch) {
                // It's difficult to tap a slider without moving it at all, so we allow a little bit
                // of wiggle room for touch events.
                if (Math.abs(slideStart.x - touch.clientX) > 5) {
                    sliderMoved = true;
                }
                this._handleSlide(
                    startSliderPosition, slideStart, {x: touch.clientX, y: touch.clientY});
            }
        }, {signal: slideEventsScope.signal, passive: false});
        window.addEventListener("touchend", event => {
            this.#sliderBase.dispatchEvent(
                new CustomEvent("press-finish", {bubbles: true, detail: {fromTouch: true}}));
            if (Array.from(event.changedTouches).find(touch => touch.identifier === identifier)) {
                if (!sliderMoved) {
                    this.#sliderBase.dispatchEvent(new CustomEvent(
                        "press-finish-without-input",
                        {bubbles: true, detail: {controller: this, fromTouch: true}}));
                }

                resolveSlide();
            }
        }, {signal: slideEventsScope.signal});
    }

    _handlePressStart(startSliderPosition,
                      slideStart,
                      touchIdentifier = null,
                      destroyWhenCanceled = false) {
        this.#sliderBase.dispatchEvent(
            new CustomEvent("press-start", {bubbles: true, detail: {controller: this}}));
        const slideEventsScope = new AbortController();
        new Promise(resolve => {
            const startOffset = this.#gradientStopModel.offset;

            this.#sliderBase.classList.add("sliding");
            this.#controlRoot.classList.add("active-gesture");

            if (touchIdentifier === null) {
                this._installMouseEventsForSlide(
                    startSliderPosition, slideStart, slideEventsScope, resolve);
            } else {
                this._installTouchEventsForSlide(
                    startSliderPosition, slideStart, touchIdentifier, slideEventsScope, resolve);
            }

            window.addEventListener("keydown", event => {
                if ("Escape" === event.key) {
                    if (destroyWhenCanceled) {
                        this.delete();
                        resolve();
                    } else {
                        this._setOffset(startOffset);
                        resolve();
                    }
                } else if ("Delete" === event.key || "Backspace" === event.key) {
                    this.delete();
                    resolve();
                }
            }, {signal: slideEventsScope.signal});
        }).then(() => {
            slideEventsScope.abort();

            this.#sliderBase.classList.remove("sliding");
            this.#controlRoot.classList.remove("active-gesture");
        });
    }

    updateColor(newColor) {
        this.#sliderBase.style.setProperty("--gradient-stop-color", newColor);
        this.#gradientStopModel.color = newColor;

        for (let handler of this.#updateHandlers) {
            handler();
        }
    }

    delete() {
        this.#sliderBase.classList.add("destroyed");
        waitForAllTransitions(this.#sliderBase).then(() => { this.#sliderBase.remove(); });

        for (let handler of this.#deleteHandlers) {
            handler(this.#gradientStopModel);
        }
    }

    _handleSlide(startSliderPosition, slideStart, slideCurrent) {
        const maxPosition = this.#sliderContainer.clientWidth;
        const newPosition =
            [0, startSliderPosition + slideCurrent.x - slideStart.x, maxPosition].sort(
                (a, b) => a - b)[1];

        this._setOffset(newPosition / maxPosition);
    }

    _setOffset(newOffset) {
        this.#gradientStopModel.offset = newOffset;
        this.#sliderBase.style.setProperty("--offset", newOffset);

        for (let handler of this.#updateHandlers) {
            handler();
        }
    }
}

class GradientDesigner extends HTMLElement {
    #gradientCanvas;
    #rail;
    #sliderContainer;
    #colorChooser;
    #selectedSlider;
    constructor() {
        super();

        this.attachShadow({mode: "open"});

        const style = document.createElement("style");
        style.textContent = kStyleSheet;
        this.shadowRoot.append(style);

        this.#gradientCanvas = document.createElement("canvas");
        this.shadowRoot.append(this.#gradientCanvas);

        // This rail region holds the circular sliders used to move each gradient stop.
        this.#rail = document.createElement("div");
        this.#rail.classList.add("rail");
        this.shadowRoot.append(this.#rail);

        // The rail guide is the line that visualizes the extent of the sliders' draggable range.
        const guide = document.createElement("div");
        guide.classList.add("rail-guide", "show-on-control-hover");
        this.#rail.appendChild(guide);

        // Each slider lives in a thin vertical "root" that contains the slider itself, its
        // "blocker" (which creates the whitespace to each side of the slider), and the triangle
        // markers directly above and below the gradient display.
        //
        // These root elements live in the "slider container," which covers the entire area of the
        // gradient designer control.
        this.#sliderContainer = document.createElement("div");
        this.#sliderContainer.classList.add("slider-container");
        this.shadowRoot.appendChild(this.#sliderContainer);

        for (let stop of this.querySelectorAll("gradient-stop")) {
            if (!stop.hasAttribute("offset") || !stop.hasAttribute("color")) {
                continue;
            }

            const offset = parseFloat(stop.getAttribute("offset"));
            if (Number.isNaN(offset)) {
                continue;
            }

            const color = stop.getAttribute("color");
            if (!color.match(/#[0-9a-zA-Z]{6}/)) {
                continue;
            }

            this.addRailSlider(offset, color);
        }

        this.#rail.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();

            // Something is funky with the computation of event.offsetLeft, so we need to work
            // around it.
            const maxPosition = this.#sliderContainer.clientWidth;
            const clickPosition =
                event.clientX - this.#sliderContainer.getBoundingClientRect().left;
            const startSliderPosition = [0, clickPosition, maxPosition].sort((a, b) => a - b)[1];

            this._handleSliderCreation(startSliderPosition / maxPosition,
                                       startSliderPosition,
                                       {x: event.clientX, y: event.clientY});
        });

        this.#rail.addEventListener("touchstart", event => {
            event.preventDefault();
            event.stopPropagation();

            const maxPosition = this.#sliderContainer.clientWidth;
            for (let touch of event.changedTouches) {
                // Something is funky with the computation of event.offsetLeft, so we need to work
                // around it.
                const touchPosition =
                    touch.clientX - this.#sliderContainer.getBoundingClientRect().left;
                const startSliderPosition =
                    [0, touchPosition, maxPosition].sort((a, b) => a - b)[1];

                this._handleSliderCreation(startSliderPosition / maxPosition,
                                           startSliderPosition,
                                           {x: touch.clientX, y: touch.clientY},
                                           touch.identifier);
            }
        }, {passive: false});

        this.#sliderContainer.addEventListener("press-start", event => {
            if (this.#colorChooser) {
                this.#selectedSlider.unmarkAsSelected();

                this.#selectedSlider = event.detail.controller;
                this.#selectedSlider.markAsSelected();
                this.#colorChooser.setSelectedIndex(
                    this.#sliderControllers.indexOf(this.#selectedSlider));
            }
        });

        this.#sliderContainer.addEventListener("press-finish", event => {
            if (event.detail.fromTouch) {
                this._linger(3000);
            }
        });

        this.#sliderContainer.addEventListener("press-finish-without-input", event => {
            if (!this.#colorChooser) {
                console.assert(!this.#selectedSlider);
                this.#selectedSlider = event.detail.controller;
                this.#selectedSlider.markAsSelected();

                this.classList.add("open-dialog");
                this.#colorChooser = new ColorChooserDialog(
                    this.shadowRoot,
                    this.#sliderControllers.map(controller => controller.colorValue),
                    this.#sliderControllers.indexOf(this.#selectedSlider));
                this.#colorChooser.addEventListener(
                    "color-input",
                    event => { this.#selectedSlider.updateColor(event.detail.newValue); });
                this.#colorChooser.addEventListener("selection-changed", event => {
                    this.#selectedSlider.unmarkAsSelected();
                    this.#selectedSlider = this.#sliderControllers[event.detail.selectedIndex];
                    this.#selectedSlider.markAsSelected();
                });
                this.#colorChooser.addEventListener("dismiss", () => {
                    this.classList.remove("open-dialog");
                    this.#selectedSlider.unmarkAsSelected();
                    this.#selectedSlider = null;
                    this.#colorChooser = null;
                });
                this.#colorChooser.addEventListener("delete", () => {
                    this.#selectedSlider.delete();
                    this.#colorChooser.close();
                })
            }
        });

        this.addEventListener("mouseleave", () => { this._linger(kOpacityLingerTimeMS); });

        this._waitForTouch();

        setTimeout(() => { this._notifyAndUpdate(); }, 0);
    }

    #gradientStops = [];
    #sliderControllers = [];
    addRailSlider(offset, color, justCreated = false) {
        const gradientStopModel = {offset: offset, color: color};
        this.#gradientStops.push(gradientStopModel);

        const railSlider = new RailSlider(
            gradientStopModel, this.#sliderContainer, this.shadowRoot.host, justCreated);
        railSlider.addUpdateHandler(() => {this._notifyAndUpdate()});
        railSlider.addDeleteHandler(deletedStop => {
            this.#gradientStops.splice(this.#gradientStops.indexOf(deletedStop), 1);
            this._notifyAndUpdate();
        });

        this.#sliderControllers.push(railSlider);

        if (this.#colorChooser) {
            this.#colorChooser.addColor(gradientStopModel.color);
        }

        return railSlider;
    }

    colorAtOffset(offset) {
        const canvasX =
            [0, Math.round(offset * this.#gradientCanvas.width), this.#gradientCanvas.width].sort(
                (a, b) => a - b)[1];
        const imageData = this.#gradientCanvas.getContext("2d").getImageData(
            0, 0, this.#gradientCanvas.width, this.#gradientCanvas.height);
        return `#${
            Array.from(imageData.data.slice(4 * canvasX, 4 * canvasX + 3))
                .map(n => n.toString(16).padStart(2, "0"))
                .join("")}`;
    }

    updateGradient() {
        this.#gradientCanvas.width = 1024;
        this.#gradientCanvas.height = 1;
        const context = this.#gradientCanvas.getContext("2d");
        const gradientFill = context.createLinearGradient(0, 0, 1023, 1);
        for (stop of this.#gradientStops) {
            gradientFill.addColorStop(stop.offset, stop.color);
        }

        context.fillStyle = gradientFill;
        context.fillRect(0, 0, 1024, 1);
    }

    get valueAsImageData() {
        return this.#gradientCanvas.getContext("2d").getImageData(
            0, 0, this.#gradientCanvas.width, this.#gradientCanvas.height);
    }

    // The "linger" class keeps the controls visible as if ":hover" were still in effect,
    // allowing a short delay between when the user stops hovering and when the controls fade
    // out. It's simpler to do this in CSS by adjusting the "transition-delay" property, but
    // there is no way to prevent the delay from being in effect if the hover ends while the
    // controls are partially faded in. That leads to the control freezing briefly in the faded
    // state instead of fading all the way in and then all the way out.
    _linger(lingerTime) {
        let cancelTimer;
        new Promise(resolve => {
            this.classList.add("linger");

            const timer = setTimeout(() => { resolve(); }, lingerTime);

            cancelTimer = () => {
                clearTimeout(timer);
                resolve();
            };
            cancelTimer = this.addEventListener("mouseenter", cancelTimer);
        }).then(() => {
            this.removeEventListener("mouseenter", cancelTimer);
            this.classList.remove("linger");
        });
    }

    _waitForTouch() {
        this.classList.remove("revealed-following-touch");
        this.addEventListener("touchstart", event => {
            event.preventDefault();
            event.stopPropagation();
            this._handleTouch();
        }, {once: true})
    }

    _handleTouch() {
        let cancelTimer;
        new Promise((resolve, reject) => {
            this.classList.add("revealed-following-touch");

            const timer = setTimeout(() => { resolve(); }, 3000);

            cancelTimer = () => {
                clearTimeout(timer);
                reject();
            };
            this.addEventListener("touchstart", cancelTimer);
        })
            .then(() => {
                // Hide the slider interface and go back to waiting for a touch event to
                // reveal it.
                this._waitForTouch();
            })
            .catch(() => {
                // Restart the timer that waits for enough time passed without any touch event to
                // hide the slider interface again.
                this._handleTouch();
            })
            .finally(() => { this.removeEventListener("touchstart", cancelTimer); });
    }

    _handleSliderCreation(startOffset, startSliderPosition, slideStart, touchIdentifier = null) {
        const justCreated = true;
        const newSlider =
            this.addRailSlider(startOffset, this.colorAtOffset(startOffset), justCreated);
        newSlider.handleSlideGestureFromCreation(startSliderPosition, slideStart, touchIdentifier);
    }

    _notifyAndUpdate() {
        if (this.dispatchEvent(
                new Event("input", {cancelable: true, composed: true, bubbles: true}))) {
            window.requestAnimationFrame(() => { this.updateGradient(); })
        } else {
            // An event listener called preventDefault() to stop the gradient from being redrawn.
        }
    }
}
customElements.define("gradient-designer", GradientDesigner);

class GradientStop extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define("gradient-stop", GradientStop);
