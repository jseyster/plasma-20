import {GLContext} from './gl-context.mjs';

/**
 * The maximum number of times we can perform the recursive subdivision into quadrants. The fragment
 * shader uses a 32-bit int to track which of the quadrants it descended into at each step, and each
 * step requires 2 bits. That would allow us to encode 16 steps if we separately encoded which level
 * of the recursion we were at, but with a limit of 15, we can uniquely encode paths of all lengths
 * with no additional information.
 *
 * The 32-bit path identifier gets used to seed the random number generator, which ensures that,
 * at each level of recursion, each fragment shader chooses the same random displacement as its
 * peers in the same quadrant.
 */
const kMaxRecursionLevel = 15;

const projectCanvasCoordinatesToClipSpace = `#version 300 es
    precision highp float;
    precision highp int;

    uniform float uAspectRatio;

    // (0, 0) represents the top-left corner, and (1, 1) the bottom-right corner.
    in vec2 aCorner;

    // Each fragment gets assigned a "logical" coordinates within the outer bounding square of the
    // fractal. From most to least significant, the bits in each coordinate represent which
    // side of the center line the fragment belongs on at each recursive step.
    out vec2 vLogicalCoordinate;

    void main() {
        float maxLogicalCoordinate = float(${2 << (kMaxRecursionLevel)});
        vLogicalCoordinate = vec2(maxLogicalCoordinate, maxLogicalCoordinate) * aCorner;

        // Transform the corners into "clip space," which ranges from (-1, 1) in the top left to
        // (1, -1) in the bottom right. When the canvas's aspect ratio is not square, we lengthen
        // the rectangle in one direction to compensate.
        vec2 positionInClipSpace =  vec2(2.0, -2.0) * aCorner + vec2(-1.0, 1.0);
        if (uAspectRatio < 1.0) {
            positionInClipSpace.x /= uAspectRatio;
        } else if (uAspectRatio > 1.0) {
            positionInClipSpace.y *= uAspectRatio;
        }
        gl_Position = vec4(positionInClipSpace, 0.0, 1.0);
    }
`;

const computePlasma = `#version 300 es
    precision highp float;
    precision highp int;

    in vec2 vLogicalCoordinate;
    out vec4 FragColor;

    uniform int uSeed;

    uniform float uSigmaInitial;
    uniform float uMuInitial;
    uniform float uAttenuation;

    uniform sampler2D uGradient;
    uniform sampler2D uNormalLookupTable;

    const float maxRandomValue = pow(2.0, 31.0);

    /**
     * Implementation of the venerable "xorwow" algorithm.
     * Marsaglia, G. (2003). Xorshift RNGs. Journal of Statistical Software, 8(14), 1-6.
     * https://doi.org/10.18637/jss.v008.i14
     * 
     * This implementation originally used a struct to store the 6 state variables, but some GLSL
     * implementations use smaller ints in struct members, even when the members are explicitly
     * declared with the "highp" attribute. The smaller ints caused this algorithm to break on those
     * platforms.
     */
    void advancePRNG(inout int state[6]) {
        int temp = state[4] ^ (state[4] >> 2);
        state[4] = state[3];
        state[3] = state[2];
        state[2] = state[1];
        state[1] = state[0];
        state[0] = (state[0] ^ (state[0] << 4)) ^ (temp ^ (temp << 1));

        state[5] += 362437;
    }

    int readRandomValue(inout int state[6]) {
        return state[0] + state[5];
    }

    // We use the "xor" PRNG (from the same paper as "xorshift") to spread the bits of the two seed
    // values out to the 6 values needed to initialize "xorwow."
    int xor(inout int y) {
        y ^= y << 13;
        y ^= y >> 17;
        y ^= y << 5;
        return y;
    }

    void initPRNG(out int state[6], int seed1, int seed2) {
        int y1 = seed1;
        int y2 = seed2;

        // Note that each call to state() mutates the "y" input.
        state[0] = xor(y1);
        state[1] = xor(y2);
        state[2] = xor(y1);
        state[3] = xor(y2);
        state[4] = xor(y1);
        state[5] = xor(y2);

        // "Prime" the random number generator by flushing the seed data out of the initial state.
        // This step is not necessary in general, but this plasma fractal algorithm uses many
        // different PRNGs with seeds that we need to diverge right away, even when the seeds differ
        // by only a few bits. Without this priming step, the similarly-seeded generators generate
        // similar results, manifesting as visible repeating patterns in the output image.
        for (int i = 0; i < 15; ++i) {
            advancePRNG(state);
        }
    }

    void initCorners(inout float cornerValues[4]) {
        int[6] state;
        initPRNG(state, uSeed, 0x40000000);
        for (int i = 0; i < 4; i++) {
            advancePRNG(state);
            cornerValues[i] = abs(float(readRandomValue(state))) / maxRandomValue;
        }
    }

    // Box-Muller Transform
    // https://en.wikipedia.org/wiki/Box-Muller_transform
    float generateGuassianRandom(inout int state[6], float sigma, float mu) {
        // Choose random values u1 and u2 from the uniform distribution in range (0, 1), which we
        // map to a random variable from the standard normal distribution. The computation is
        // done in advance and stored in a table, which also shifts the output range of the uniform
        // PRNG (which can include 0) to the open interval.
        advancePRNG(state);
        float u1 = float(readRandomValue(state)) / (2.0 * maxRandomValue) + 0.5;

        advancePRNG(state);
        float u2 = float(readRandomValue(state)) / (2.0 * maxRandomValue) + 0.5;

        return sigma * texture(uNormalLookupTable, vec2(u1, u2)).x + mu;
    }

    void main() {
        float cornerValues[4];
        initCorners(cornerValues);

        float mu = uMuInitial;
        float sigma = uSigmaInitial;

        int quadrantMask = 1 << 15;
        int midpointIndex = 0x1;
        for (int i = 0; i < 8; i++) {
            int quadrant = ((int(vLogicalCoordinate.x) & quadrantMask) == 0 ? 0 : 1) ^
                ((int(vLogicalCoordinate.y) & quadrantMask) == 0 ? 0 : 3);

            float subQuadrantCornerValues[4];
            subQuadrantCornerValues[0] = cornerValues[quadrant];
            subQuadrantCornerValues[1] =
                (cornerValues[quadrant] + cornerValues[(quadrant + 1) % 4]) / 2.0;
            subQuadrantCornerValues[2] =
                (cornerValues[0] + cornerValues[1] + cornerValues[2] + cornerValues[3]) / 4.0;
            subQuadrantCornerValues[3] =
                (cornerValues[(quadrant + 3) % 4] + cornerValues[quadrant]) / 2.0;

            // Choose a random value to displace the midpoint by.
            int state[6];
            initPRNG(state, uSeed, midpointIndex);

            float displacement = generateGuassianRandom(state, sigma, mu);
            sigma *= uAttenuation;
            mu *= uAttenuation;

            subQuadrantCornerValues[2] += displacement;

            midpointIndex = midpointIndex << 2 | quadrant;

            for (int j = 0; j < 4; j++) {
                cornerValues[j] = subQuadrantCornerValues[(j - quadrant + 4) % 4];
            }

            quadrantMask >>= 1;
        }

        int quadrant = ((int(vLogicalCoordinate.x) & quadrantMask) == 0 ? 0 : 1) ^
            ((int(vLogicalCoordinate.y) & quadrantMask) == 0 ? 0 : 3);
        float value = cornerValues[quadrant];
        FragColor = texture(uGradient, vec2(value, 0.0));
    }
`;

const projectParameterCoordinatesToClipSpace = `#version 300 es
    precision highp float;
    precision highp int;

    in vec2 aCanvasCoordinates;
    in vec2 aParameterCoordinates;

    out vec2 vParameter;

    uniform vec2 uCanvasDimensions;

    void main() {
        vParameter = aParameterCoordinates;

        vec2 result = 2.0 * aCanvasCoordinates / uCanvasDimensions - 1.0;
        gl_Position = vec4(result, 0.0, 1.0);
    }
`;

// See the computeNormalLookupTable() method in the InteractivePlasmaFractal class.
const computeNormalLookupTable = `#version 300 es
    precision highp float;
    precision highp int;

    in vec2 vParameter;
    out vec4 FragColor;

    uniform int uSeed;

    const float twoPi = radians(360.0);

    void main() {
        float result = sqrt(-2.0 * log(vParameter.x)) * cos(twoPi * vParameter.y);
        FragColor = vec4(result, 0.0, 0.0, 1.0);
    }
`;

function stringToFloatWithDefault(str, defaultValue) {
    const result = parseFloat(str);
    return !isNaN(result) ? result : defaultValue;
}

class InteractivePlasmaFractal extends HTMLElement {
    static kDefaultSigmaInitial = 0.7;
    static kDefaultMuInitial = 0.0;
    static kDefaultAttenuation = 0.45;

    constructor() {
        super();

        this.attachShadow({mode: "open"});

        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
            }

            canvas {
                width: 100%;
                height: 100%;
            }`;

        this.shadowRoot.append(style);

        this.canvas = document.createElement("canvas");
        this.shadowRoot.append(this.canvas);

        this.glContext = new GLContext(this.canvas);
    }

    #seed;
    #sigmaInitial = InteractivePlasmaFractal.kDefaultSigmaInitial;
    #muInitial = InteractivePlasmaFractal.kDefaultMuInitial;
    #attenuation = InteractivePlasmaFractal.kDefaultAttenuation;
    #gradientSource;
    #gradientTexture = null;
    #isGradientUpToDate = false;
    connectedCallback() {
        this.initResources();

        let seedInput = NaN;
        if (this.hasAttribute("seed")) {
            seedInput = parseInt(this.getAttribute("seed"));
        }

        if (!isNaN(seedInput)) {
            this.#seed = seedInput & 0xffffffff;
        } else {
            this.#seed = Math.floor(Math.random() * 0xffffffff);
        }

        if (this.hasAttribute("gradient-source")) {
            this.#gradientSource = document.getElementById(this.getAttribute("gradient-source"));
        }

        if (this.hasAttribute("sigma-initial")) {
            this.#sigmaInitial =
                stringToFloatWithDefault(this.getAttribute("sigma-initial"), this.#sigmaInitial);
        }

        if (this.hasAttribute("mu-initial")) {
            this.#muInitial =
                stringToFloatWithDefault(this.getAttribute("mu-initial"), this.#sigmaInitial);
        }

        if (this.hasAttribute("attenuation")) {
            this.#attenuation =
                stringToFloatWithDefault(this.getAttribute("attenuation"), this.#attenuation);
        }

        this.glContext.attachResizeHandler(() => { this.drawPlasmaInAnimationFrame(); });
    }

    disconnectedCallback() {
        this.glContext.detachResizeHandler();

        this.#isGradientUpToDate = false;
        this.glContext.destroyResources(this.viewportRectangle,
                                        this.plasmaShaderProgram,
                                        this.projectionShader,
                                        this.plasmaShaderthis,
                                        this.#gradientTexture,
                                        this.#normalLookupTable);
        this.#gradientTexture = null;
    }

    static get observedAttributes() {
        return ["seed", "gradient-source", "sigma-initial", "mu-initial", "attenuation"];
    }

    attributeChangedCallback(attribute, oldValue, newValue) {
        if ("seed" === attribute) {
            const seedInput = parseInt(newValue);
            if (!isNaN(seedInput)) {
                this.#seed = seedInput & 0xffffffff;
            }
        }

        if ("gradient-source" === attribute) {
            this.#gradientSource = document.getElementById(newValue);
            this.#isGradientUpToDate = false;
        }

        if ("sigma-initial" === attribute) {
            this.#sigmaInitial = stringToFloatWithDefault(newValue, this.#sigmaInitial);
        }

        if ("mu-initial" === attribute) {
            this.#muInitial = stringToFloatWithDefault(newValue, this.#muInitial);
        }

        if ("attenuation" === attribute) {
            this.#attenuation = stringToFloatWithDefault(newValue, this.#attenuation);
        }
    }

    setRandomSeed() {
        this.#seed = Math.floor(Math.random() * 0xffffffff);
    }

    #normalLookupTable;
    initResources() {
        const cornerList = [[0, 0], [0, 1.0], [1.0, 0], [1.0, 1.0]].flat();
        this.viewportRectangle = this.glContext.getFloat32ArrayResource(cornerList);

        const projectionShader = this.glContext.getShaderResource(
            GLContext.vertexShaderResourceType, projectCanvasCoordinatesToClipSpace);
        const plasmaShader =
            this.glContext.getShaderResource(GLContext.fragmentShaderResourceType, computePlasma);
        this.plasmaShaderProgram =
            this.glContext.getShaderProgramResource(projectionShader, plasmaShader);

        // When possible, use the GPU to compute the lookup table for the Box-Muller transform. If
        // that fails fall back to using the CPU.
        this.#normalLookupTable =
            this.computeNormalLookupTableWithGPU() || this.computeNormalLookupTableWithCPU();
    }

    /**
     * Compute a lookup table that the plasma fractal fragment shader will be able to use for
     * choosing normally distributed random variables from random variables with uniform
     * distribution.
     *
     * The Box-Muller transform uses two inputs, u1 and u2, that are chosen with uniform probabilty
     * from the interval (0, 1). Because our random number generator's output range is actually
     * [0, 1) (i.e., it can output 0), we adjust the variables slightly to shift them to the desired
     * open interval.
     *
     * https://en.wikipedia.org/wiki/Box–Muller_transform
     */
    computeNormalLookupTableWithGPU() {
        return this.glContext.drawToTexture(
            GLContext.f32TextureResourceType, 1024, 1024, glContext => {
                const canvasCoordinatesList =
                    [[-1, -1], [-1, 1025], [1025, -1], [1025, 1025]].flat();
                const canvasCoordinates = glContext.getFloat32ArrayResource(canvasCoordinatesList);

                const parameterShader = glContext.getShaderResource(
                    GLContext.vertexShaderResourceType, projectParameterCoordinatesToClipSpace);
                const computeShader = glContext.getShaderResource(
                    GLContext.fragmentShaderResourceType, computeNormalLookupTable);
                const normalLookupTableProgram =
                    glContext.getShaderProgramResource(parameterShader, computeShader);

                glContext.clear();
                glContext.setActiveShaderProgram(normalLookupTableProgram);

                glContext.assignVertexAttribute("aCanvasCoordinates", canvasCoordinates, 2);
                glContext.assignVertexAttribute("aParameterCoordinates", this.viewportRectangle, 2);

                glContext.assignFloatUniformAttribute("uCanvasDimensions", 1024, 1024);

                glContext.drawTriangleStrip(0, 4);

                // On some platforms, resource destruction can race with the call to
                // drawTriangleStrip, causing it to fail. We eagerly destroy resources when
                // possible, but in this case, it's safer to let the garbage collector deal with it.
                // glContext.destroyResources(
                //     canvasCoordinates, normalLookupTableProgram, parameterShader, computeShader);
            });
    }

    /**
     * Fallback computation of the Box-Mull transform lookup table.
     */
    computeNormalLookupTableWithCPU() {
        const normalLookupTable = new Float32Array(1024 * 1024);
        for (let i = 0; i < 1024; i++) {
            for (let j = 0; j < 1024; j++) {
                const u1 = (i + 1) / 1026;
                const u2 = (j + 1) / 1026;
                normalLookupTable[j * 1024 + i] =
                    Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            }
        }
        return this.glContext.getTextureResource(
            GLContext.f32TextureResourceType, normalLookupTable, 1024, 1024);
    }

    drawPlasmaInAnimationFrame() {
        if (!this.isConnected) {
            return;
        }

        window.requestAnimationFrame(() => { this.drawPlasma(); });
    }

    drawPlasma() {
        if (!this.isConnected) {
            return;
        }

        this.updateGradientTexture();

        this.glContext.clear();
        this.glContext.setActiveShaderProgram(this.plasmaShaderProgram);
        this.glContext.setActiveTexture(0, this.#gradientTexture);
        this.glContext.setActiveTexture(1, this.#normalLookupTable);

        this.glContext.assignVertexAttribute("aCorner", this.viewportRectangle, 2);

        this.glContext.assignFloatUniformAttribute("uAspectRatio",
                                                   this.canvas.width / this.canvas.height);
        this.glContext.assignIntUniformAttribute("uSeed", this.#seed);
        this.glContext.assignFloatUniformAttribute("uSigmaInitial", this.#sigmaInitial);
        this.glContext.assignFloatUniformAttribute("uMuInitial", this.#muInitial);
        this.glContext.assignFloatUniformAttribute("uAttenuation", this.#attenuation);
        this.glContext.assignIntUniformAttribute("uGradient", 0);          // Texture unit 0.
        this.glContext.assignIntUniformAttribute("uNormalLookupTable", 1); // Texture unit 1.

        this.glContext.drawTriangleStrip(0, 4);
    }

    updateGradientTexture() {
        const source = this.#gradientSource.valueAsImageData || this.#gradientSource;
        if (!this.#gradientTexture) {
            this.#gradientTexture =
                this.glContext.getTextureResource(GLContext.rgbaTextureResourceType, source);
        } else if (!this.#isGradientUpToDate) {
            this.glContext.loadTexture(this.#gradientTexture, source);
        }

        this.#isGradientUpToDate = true;
    }
}
customElements.define("interactive-plasma-fractal", InteractivePlasmaFractal);
