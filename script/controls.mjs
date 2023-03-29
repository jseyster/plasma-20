const wordList = JSON.parse(document.getElementById("word-list").innerText);
const memeList = [
    "so fractal much plasma wow",
    "all your plasma are belong to us",
    "i can has plasma fractal",
    "yo dawg i heard you like self similarity",
    "bite my shiny metal fractal",
    "heres my number plasma maybe",
];

function seedFromCodeString(code) {
    code = code.toLowerCase();

    let seed = 1;
    for (let i = 0; i < code.length; i++) {
        const c = code.charCodeAt(i);
        if (c >= "a".charCodeAt(0) && c <= "z".charCodeAt(0)) {
            seed = seed * 36 + (c - "a".charCodeAt(0));
        } else if (c >= "0".charCodeAt(0) && c <= "9".charCodeAt(0)) {
            seed = seed * 36 + (26 + c - "0".charCodeAt(0));
        }
        seed &= 0xffffffff;
    }

    return seed;
}

function parseSeedInput(input) {
    if (input.match(/^\s*0x[0-9a-fA-F]{8}\s*$/)) {
        return parseInt(input);
    } else {
        return seedFromCodeString(input);
    }
}

function randomPhrase() {
    if (Math.random() < 0.95) {
        return Array.from({length: 4}, () => wordList[Math.floor(wordList.length * Math.random())])
            .join(" ");
    } else {
        // One out of every twenty random phrases is a meme.
        return memeList[Math.floor(memeList.length * Math.random())];
    }
}

for (let button of document.querySelectorAll(
         "[data-target-fractal][data-action='apply-seed'][data-source]")) {
    const plasmaFractal = document.getElementById(button.dataset.targetFractal);
    const source = document.getElementById(button.dataset.source);
    if (plasmaFractal && source) {
        button.addEventListener("click", () => {
            plasmaFractal.setAttribute("seed", parseSeedInput(source.value));
            plasmaFractal.drawPlasmaInAnimationFrame();
        });

        if ("" === source.value) {
            source.value = randomPhrase();
        }
        plasmaFractal.setAttribute("seed", parseSeedInput(source.value));

        source.addEventListener("keypress", event => {
            if ("Enter" === event.key) {
                button.click();
            }
        })
    }
}
for (let button of document.querySelectorAll(
         "[data-target-fractal][data-action='randomize-seed']")) {
    const plasmaFractal = document.getElementById(button.dataset.targetFractal);
    const sink = document.getElementById(button.dataset.sink);
    if (plasmaFractal) {
        button.addEventListener("click", () => {
            const phrase = randomPhrase();
            if (sink) {
                sink.value = phrase;
            }
            plasmaFractal.setAttribute("seed", seedFromCodeString(phrase));
            plasmaFractal.drawPlasmaInAnimationFrame();
        });
    }
}

for (let slider of document.querySelectorAll("input[data-target-fractal][data-target-variable]")) {
    const plasmaFractal = document.getElementById(slider.dataset.targetFractal);
    if (plasmaFractal) {
        slider.addEventListener("input", event => {
            plasmaFractal.setAttribute(slider.dataset.targetVariable, event.target.value);
            plasmaFractal.drawPlasmaInAnimationFrame();
        });
    }

    for (let output of document.querySelectorAll(
             `output[for=${CSS.escape(slider.getAttribute("name"))}]`)) {
        slider.addEventListener("input", event => { output.innerText = event.target.value; })
        output.innerText = slider.value;
    }
}

for (let plasmaElement of document.querySelectorAll(
         "interactive-plasma-fractal[gradient-source]")) {
    let gradientSource = document.getElementById(plasmaElement.getAttribute("gradient-source"));
    if (gradientSource) {
        gradientSource.addEventListener("input", event => {
            // Stop the gradient designer from drawing its update so that we can draw it together
            // with the plasma fractal update in the same frame of animation.
            event.preventDefault();

            window.requestAnimationFrame(() => {
                event.target.updateGradient();

                // Even if the new gradient source is the same as the old one, we need to set
                // the attribute so that the InteractivePlasmaFractal knows that it needs to
                // load the updated contents of the canvas.
                plasmaElement.setAttribute("gradient-source", event.target.id);
                plasmaElement.drawPlasma();
            })
        })
    }
}
