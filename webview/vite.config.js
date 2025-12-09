import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: '../dist/webview',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                entryFileNames: `main.js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`,
            },
        },
    },
});
//# sourceMappingURL=vite.config.js.map