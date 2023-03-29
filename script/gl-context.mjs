const kFragmentShaderResource = 0;
const kVertexShaderResource = 1;
const kShaderProgramResource = 2;
const kFloat32ArrayResource = 3;
const kRGBATextureResource = 4;
const kF32TextureResource = 5;

export class GLContext {
    static get fragmentShaderResourceType() {
        return kFragmentShaderResource;
    }

    static get vertexShaderResourceType() {
        return kVertexShaderResource;
    }

    static get shaderProgramResourceType() {
        return kShaderProgramResource;
    }

    static get float32ArrayResourceType() {
        return kFloat32ArrayResource;
    }

    static get rgbaTextureResourceType() {
        return kRGBATextureResource;
    }

    static get f32TextureResourceType() {
        return kF32TextureResource;
    }

    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = canvas.clientWidth;
        this.canvas.height = canvas.clientHeight;

        this.gl = canvas.getContext("webgl2");
        if (null === this.gl) {
            // TODO: Error handling
            throw "Failed to load WebGL";
        }

        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clearDepth(1.0);

        this.resizeHandler = null;
        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const resizedCanvas = entry.target;
                const resizedGl = resizedCanvas.getContext("webgl2");

                resizedCanvas.width = resizedCanvas.clientWidth;
                resizedCanvas.height = resizedCanvas.clientHeight;
                resizedGl.viewport(0.0, 0.0, canvas.clientWidth, canvas.clientHeight);

                if (this.resizeHandler) {
                    this.resizeHandler(resizedCanvas);
                }
            }
        });
    }

    attachResizeHandler(handler) {
        this.resizeHandler = handler;
        this.resizeObserver.observe(this.canvas);
    }

    detachResizeHandler() {
        this.resizeHandler = null;
        this.resizeObserver.disconnect();
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    drawToTexture(resourceType, width, height, drawFunction) {
        if (kF32TextureResource === resourceType &&
            !this.gl.getExtension("EXT_color_buffer_float")) {
            return null;
        }

        let keepOutputTexture = false;
        const outputTexture = this.getTextureResource(resourceType, null, width, height);
        const framebuffer = this.gl.createFramebuffer();
        try {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER,
                                         this.gl.COLOR_ATTACHMENT0,
                                         this.gl.TEXTURE_2D,
                                         outputTexture.resource,
                                         0);
            this.gl.viewport(0, 0, width, height);

            if (this.gl.FRAMEBUFFER_COMPLETE !==
                this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER)) {
                this.destroyResources(outputTexture);
                return null;
            }

            drawFunction(this);

            keepOutputTexture = true;
            return outputTexture;
        } finally {
            if (!keepOutputTexture) {
                this.destroyResources(outputTexture);
            }
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
            this.gl.deleteFramebuffer(framebuffer);
        }
    }

    drawTriangleStrip(first, count) {
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, first, count);
    }

    setActiveShaderProgram(shaderProgramResource) {
        console.assert(kShaderProgramResource === shaderProgramResource.resourceType);
        this.activeShaderProgram = shaderProgramResource;
        this.gl.useProgram(shaderProgramResource.resource);
    }

    setActiveTexture(unit, textureResource) {
        this.gl.activeTexture(this.gl.TEXTURE0 + unit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, textureResource.resource);
    }

    // TODO: Support other kinds of array.
    assignVertexAttribute(
        attributeName, arrayResource, dimension, normalized = false, stride = 0, offset = 0) {
        console.assert(kFloat32ArrayResource === arrayResource.resourceType);
        if (!this.activeShaderProgram.attributeLocations.hasOwnProperty(attributeName)) {
            this.activeShaderProgram.attributeLocations[attributeName] =
                this.gl.getAttribLocation(this.activeShaderProgram.resource, attributeName);
        }

        const location = this.activeShaderProgram.attributeLocations[attributeName];
        this.gl.enableVertexAttribArray(location);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, arrayResource.resource);
        this.gl.vertexAttribPointer(location, dimension, this.gl.FLOAT, normalized, stride, offset);
    }

    assignIntUniformAttribute(attributeName, ...values) {
        console.assert(values.length > 0 && values.length < 5);
        const location = this._getLocationForUniform(this.activeShaderProgram, attributeName);

        const setMethods =
            [undefined, this.gl.uniform1i, this.gl.uniform2i, this.gl.uniform3i, this.gl.uniform4i];
        setMethods[values.length].call(this.gl, location, ...values);
    }

    assignFloatUniformAttribute(attributeName, ...values) {
        console.assert(values.length > 0 && values.length < 5);
        const location = this._getLocationForUniform(this.activeShaderProgram, attributeName);

        const setMethods =
            [undefined, this.gl.uniform1f, this.gl.uniform2f, this.gl.uniform3f, this.gl.uniform4f];
        setMethods[values.length].call(this.gl, location, ...values);
    }

    _getLocationForUniform(shaderProgram, attributeName) {
        console.assert(kShaderProgramResource === shaderProgram.resourceType);
        if (!shaderProgram.uniformLocations.hasOwnProperty(attributeName)) {
            shaderProgram.uniformLocations[attributeName] =
                this.gl.getUniformLocation(shaderProgram.resource, attributeName);
        }

        return shaderProgram.uniformLocations[attributeName];
    }

    getShaderProgramResource(...shaderResources) {
        const shaderProgram = this.gl.createProgram();
        for (let shader of shaderResources) {
            console.assert(kVertexShaderResource === shader.resourceType ||
                           kFragmentShaderResource === shader.resourceType);
            this.gl.attachShader(shaderProgram, shader.resource);
        }

        this.gl.linkProgram(shaderProgram);
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            // TODO: Is it necessary to delete the shader program?
            throw this.gl.getProgramInfoLog(shaderProgram);
        }

        return {
            resourceType: kShaderProgramResource,
            resource: shaderProgram,
            attributeLocations: {},
            uniformLocations: {}
        };
    }

    getShaderResource(resourceType, sourceCode) {
        console.assert(kVertexShaderResource === resourceType ||
                       kFragmentShaderResource === resourceType);

        const shader =
            this.gl.createShader(kVertexShaderResource === resourceType ? this.gl.VERTEX_SHADER
                                                                        : this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(shader, sourceCode);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            // TODO: Handle errors.
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw error;
        }

        return {resourceType: resourceType, resource: shader};
    }

    // TODO: Support usage values other than gl.STATIC_DRAW.
    getFloat32ArrayResource(values) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(values), this.gl.STATIC_DRAW);
        return {resourceType: kFloat32ArrayResource, resource: buffer};
    }

    getTextureResource(resourceType, data, width, height) {
        console.assert(kRGBATextureResource == resourceType || kF32TextureResource == resourceType);

        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Turn off mipmapping and use clamping for out-of-bounds texture coordinates.
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D,
                              this.gl.TEXTURE_MIN_FILTER,
                              (kF32TextureResource != resourceType ||
                               this.gl.getExtension("OES_texture_float_linear"))
                                  ? this.gl.LINEAR
                                  : this.gl.NEAREST);

        const result = {resourceType: resourceType, resource: texture};
        this.loadTexture(result, data, width, height);
        return result;
    }

    loadTexture(texture, data, width, height) {
        console.assert(kRGBATextureResource == texture.resourceType ||
                       kF32TextureResource == texture.resourceType);

        if ("undefined" === typeof width && "undefined" === typeof height) {
            width = data.width;
            height = data.height;
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture.resource);
        const [internalFormat, baseFormat, type] = (() => {
            switch (texture.resourceType) {
            case kRGBATextureResource:
                return [this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE];
            case kF32TextureResource:
                return [this.gl.R32F, this.gl.RED, this.gl.FLOAT];
            }
        })();
        this.gl.texImage2D(
            this.gl.TEXTURE_2D, 0, internalFormat, width, height, 0, baseFormat, type, data);
    }

    destroyResources(...resourceArgs) {
        for (let resource of resourceArgs) {
            if ("undefined" === typeof resource || null === resource) {
                continue;
            }

            switch (resource.resourceType) {
            case kFragmentShaderResource:
            case kVertexShaderResource:
                this.gl.deleteShader(resource.resource);
                break;
            case kShaderProgramResource:
                this.gl.deleteProgram(resource.resource);
                break;
            case kFloat32ArrayResource:
                this.gl.deleteBuffer(resource.resource);
                break;
            case kRGBATextureResource:
            case kF32TextureResource:
                this.gl.deleteTexture(resource.resource);
                break;
            }
        }
    }
}
