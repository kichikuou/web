import SevenZipFactory from "7z-wasm";

onmessage = async (e: MessageEvent) => {
    try {
        const { file } = e.data as { file: File };

        let stdout: string[] = [];
        const sevenZip = await SevenZipFactory({
            print: (s: string) => stdout.push(s)
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
            'e', '-o/out',  // Extract to /out
            '-aos',         // Skip extracting of existing files
            '-bsp0',        // Disable progress output
            '/archive/' + file.name,
        ]);

        // Send the extracted files to the main thread.
        const files: { name: string, content: Uint8Array }[] = [];
        const transferable: Transferable[] = [];
        for (const fname of (sevenZip.FS.readdir('/out') as string[])) {
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
        postMessage({files}, transferable);
    } catch (e) {
        console.warn(e);
        postMessage({ error: 'extraction failed' });
    }
    close();
}
