import terser from '@rollup/plugin-terser';

export default {
    input: 'script/plasma-20-entry.mjs',
    output:
        [
            {file: 'script/plasma-20-bundle.js', format: 'es'},
            {file: 'script/plasma-20-bundle.min.js', format: 'iife', plugins: [terser()]}
        ]
};
