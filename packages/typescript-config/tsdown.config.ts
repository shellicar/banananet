import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/**/*.ts'],
  format: 'esm',
  outDir: 'dist',
  hash: false,
  clean: true,
  dts: false,
  platform: 'node',
  external: ['@shellicar/build-version/version'],
  target: 'node22',
});
