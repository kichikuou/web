//@ts-ignore
import SevenZipFactory from "https://unpkg.com/7z-wasm@1.0.0-beta.5/7zz.es6.js";
onmessage = async (e) => {
    try {
        const { file } = e.data;
        let stdout = [];
        const sevenZip = await SevenZipFactory({
            print: (s) => stdout.push(s)
        });
        sevenZip.FS.mkdir('/archive');
        sevenZip.FS.mount(sevenZip.WORKERFS, {
            files: [file],
        }, '/archive');
        // Fail early if the archive contains no game files.
        sevenZip.callMain(['l', '/archive/' + file.name]);
        if (!stdout.some(line => line.match(/\.(dat|ald)$/i))) {
            postMessage({ error: 'no game data' });
            return;
        }
        stdout = [];
        // Extract files.
        sevenZip.FS.mkdir('/out');
        sevenZip.callMain([
            'e', '-o/out',
            '-aos',
            '-bsp0',
            '/archive/' + file.name,
        ]);
        // Send the extracted files to the main thread.
        const files = [];
        const transferable = [];
        for (const fname of sevenZip.FS.readdir('/out')) {
            if (fname === '.' || fname === '..') {
                continue;
            }
            const path = '/out/' + fname;
            if (sevenZip.FS.isDir(sevenZip.FS.stat(path).mode)) {
                continue;
            }
            const content = sevenZip.FS.readFile(path);
            files.push({ name: fname, content });
            transferable.push(content.buffer);
        }
        postMessage({ files }, transferable);
    }
    catch (e) {
        console.warn(e);
        postMessage({ error: 'extraction failed' });
    }
    close();
};
