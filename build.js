import * as process from 'node:process';
import * as esbuild from 'esbuild';

const logLevel = 'info';
const outdir = 'dist';

const configs = [
    // Shell
    {
        entryPoints: [
            'shell/shell.ts',
        ],
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
