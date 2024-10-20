import { rspack } from '@rsbuild/core';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
	output: {
		assetPrefix: './',
	},
	plugins: [pluginReact()],
	tools: {
		rspack: {
			plugins: [new rspack.electron.ElectronTargetPlugin()],
		},
	},
});
