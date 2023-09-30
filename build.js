import * as fsPromises from 'node:fs/promises';
import * as process from 'node:process';
import * as esbuild from 'esbuild';

const logLevel = 'info';
const outdir = 'dist';

// An esbuild plugin that rewrites module specifiers for the external modules.
const resolveExternalModules = {
    name: 'resolveExternalModules',
    setup(build) {
        build.onResolve({ filter: /^[^.]/ }, async (args) => {
            switch (args.path) {
                case '7z-wasm': return { path: './lib/7zz.es6.js', external: true };
                case 'js-fatfs': return { path: './lib/fatfs.js', external: true };
                case '@irori/idbfs': return { path: './lib/idbfs.js', external: true };
            }
        })
    },
}

async function installExternalModules() {
    return Promise.all([
        fsPromises.copyFile('node_modules/7z-wasm/7zz.es6.js', 'dist/lib/7zz.es6.js'),
        fsPromises.copyFile('node_modules/7z-wasm/7zz.wasm', 'dist/lib/7zz.wasm'),
        fsPromises.copyFile('node_modules/js-fatfs/dist/fatfs.js', 'dist/lib/fatfs.js'),
        fsPromises.copyFile('node_modules/js-fatfs/dist/fatfs.wasm', 'dist/lib/fatfs.wasm'),
        fsPromises.copyFile('node_modules/@irori/idbfs/idbfs.js', 'dist/lib/idbfs.js'),
    ]);
}

const configs = [
    // Shell
    {
        entryPoints: [
            'shell/shell.ts',
            'shell/fdimage.ts',
        ],
        external: [
            './fdimage.js',
        ],
        plugins: [resolveExternalModules],
        bundle: true,
        minify: true,
        charset: 'utf8',
        format: 'esm',
        target: ['es2017'],
        outdir,
        sourcemap: true,
        logLevel,
    },
    // Worker
    {
        entryPoints: [
            'worker/archiveworker.ts',
        ],
        plugins: [resolveExternalModules],
        bundle: true,
        minify: true,
        charset: 'utf8',
        format: 'esm',
        target: ['es2017'],
        outdir,
        sourcemap: true,
        logLevel,
    },
    // CSS
    {
        entryPoints: [
            'css/style.css',
        ],
        supported: {
            nesting: false,
        },
        bundle: true,
        outdir,
        logLevel,
    },
];

for (const config of configs) {
    if (process.argv[2] === '--watch') {
        (await esbuild.context(config)).watch();
    } else {
        esbuild.build(config);
    }
}

await installExternalModules();
