import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';

const WATCH = process.env.ROLLUP_WATCH;

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/burypoint.js',
      name: 'barypoint',
      format: 'iife',
      sourcemap: !WATCH,
      strict: true,
    },
    {
      file: 'dist/burypoint.es.js',
      name: 'barypoint',
      format: 'es',
      sourcemap: !WATCH,
      strict: true,
    },
  ],
  plugins: [
    commonjs(),
    resolve(),
    json(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
    }),
    replace({
      preventAssignment: true,
      ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    !WATCH && terser(),
  ],
  watch: {
    chokidar: true,
    include: 'src/**',
    exclude: 'node_modules/**',
  },
};
