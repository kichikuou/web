import * as process from 'node:process';
import * as esbuild from 'esbuild';

const logLevel = 'info';

const shellOpts = {
    entryPoints: [
        'shell/shell.ts',
    ],
    bundle: true,
    minify: true,
    charset: 'utf8',
    format: 'esm',
    target: ['es2017'],
    outdir: 'docs',
    sourcemap: true,
    logLevel,
};

const cssOpts = {
    entryPoints: [
        'css/style.css',
    ],
    supported: {
        nesting: false,
    },
    bundle: true,
    outdir: 'docs',
    logLevel,
};

if (process.argv[2] === '--watch') {
    (await esbuild.context(shellOpts)).watch();
    (await esbuild.context(cssOpts)).watch();
} else {
    esbuild.build(shellOpts);
    esbuild.build(cssOpts);
}
