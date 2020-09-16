import svelte from 'rollup-plugin-svelte';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.js',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'app', // export window.app
    file: '../server/_static/bundle.js'
  },
  external: [ 'mermaid' ],
  plugins: [
    svelte({
      extensions: ['.svelte', '.svg'],
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file - better for performance
      css: css => {
        css.write('../server/_static/bundle.css');
      },
    }),

    // to resolve (import) thrid-party libs
    nodeResolve({
      browser: true,
      dedupe: ['svelte']
    }),

    // to import commonjs module (using `module.exports`)
    commonjs(),
  ],
  watch: {
    include: 'src/**',
    chokidar: false,
    clearScreen: false,
  },
};
