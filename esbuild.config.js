/* eslint-env node */
/* eslint-disable no-console, no-process-exit */

import * as esbuild from 'esbuild';
import { globSync } from 'glob';

// Get all TypeScript files
const entryPoints = globSync('./src/**/*.ts', {
  ignore: ['./src/**/*.test.ts']
});

async function build() {
  try {
    await esbuild.build({
      entryPoints,
      bundle: false,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outdir: './dist',
      outExtension: { '.js': '.js' },
      sourcemap: true,
      preserveSymlinks: true,
      banner: {
        js: '#!/usr/bin/env node',
      },
    });

    console.log('Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 