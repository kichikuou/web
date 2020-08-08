// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { loadScript, JSZIP_SCRIPT, readFileAsArrayBuffer, JSZipOptions, mkdirIfNotExist } from './util.js';
import { saveDirReady } from './moduleloader.js';
import { addToast, downloadAs } from './widgets.js';
import { message } from './strings.js';
export class SaveDataManager {
    constructor() {
        if (window.FS)
            this.FSready = saveDirReady;
        if (!this.FSready) {
            this.FSready = (async () => {
                await loadScript('fslib.js');
                const fslib = await FSLib();
                return fslib.saveDirReady;
            })();
        }
        loadScript(JSZIP_SCRIPT);
    }
    hasSaveData() {
        function find(fs, dir) {
            if (!fs.isDir(fs.stat(dir).mode))
                return false;
            for (let name of fs.readdir(dir)) {
                if (name[0] === '.')
                    continue;
                if (name.toLowerCase().endsWith('.asd') || name.toLowerCase().endsWith('.dat'))
                    return true;
                if (find(fs, dir + '/' + name))
                    return true;
            }
            return false;
        }
        return this.FSready.then((fs) => find(fs, '/save'));
    }
    async download() {
        await loadScript(JSZIP_SCRIPT);
        let zip = new JSZip();
        storeZip(await this.FSready, '/save', zip.folder('save'));
        let blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        if (navigator.msSaveBlob) { // Edge
            navigator.msSaveBlob(blob, 'savedata.zip');
        }
        else {
            downloadAs('savedata.zip', URL.createObjectURL(blob));
        }
        ga('send', 'event', 'Savedata', 'Downloaded');
    }
    async extract(file) {
        try {
            let fs = await this.FSready;
            if (file.name.toLowerCase().endsWith('.asd')) {
                addSaveFile(fs, '/save/' + file.name, await readFileAsArrayBuffer(file));
            }
            else {
                await loadScript(JSZIP_SCRIPT);
                let zip = new JSZip();
                await zip.loadAsync(await readFileAsArrayBuffer(file), JSZipOptions());
                let entries = [];
                zip.folder('save').forEach((path, z) => { entries.push(z); });
                for (let z of entries) {
                    if (z.dir)
                        mkdirIfNotExist('/' + z.name.slice(0, -1), fs);
                    else
                        addSaveFile(fs, '/' + z.name, await z.async('arraybuffer'));
                }
            }
            await new Promise((resolve, reject) => {
                fs.syncfs(false, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            addToast(message.restore_success, 'success');
            ga('send', 'event', 'Savedata', 'Restored');
        }
        catch (err) {
            addToast(message.restore_failure, 'error');
            ga('send', 'event', 'Savedata', 'RestoreFailed', err.message);
            console.warn(err);
            ga('send', 'exception', { exDescription: err.stack, exFatal: false });
        }
    }
}
function storeZip(fs, dir, zip) {
    for (let name of fs.readdir(dir)) {
        let path = dir + '/' + name;
        if (name[0] === '.') {
            continue;
        }
        else if (fs.isDir(fs.stat(path).mode)) {
            storeZip(fs, path, zip.folder(name));
        }
        else if (!name.toLowerCase().endsWith('.asd.')) {
            let content = fs.readFile(path, { encoding: 'binary' });
            zip.file(name, content);
        }
    }
}
function addSaveFile(fs, path, content) {
    fs.writeFile(path, new Uint8Array(content));
}
