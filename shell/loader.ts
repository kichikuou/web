// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';
import {config} from './config.js';
import {LoaderSource, CDImageSource, FileSource, ZipSource, SevenZipSource, NoGamedataError} from './loadersource.js';
import {setCDDALoader} from './cdda.js';
import {addToast} from './widgets.js';
import * as midiPlayer from './midi.js';
import * as volumeControl from './volume.js';
import {message} from './strings.js';
import { isDeflateSupported } from './zip.js';

let imageFile: File | undefined;
let metadataFile: File | undefined;
let patchFiles: File[] = [];
let installing = false;

function init() {
    $('#fileselect').addEventListener('change', handleFileSelect, false);
    document.body.ondragover = handleDragOver;
    document.body.ondrop = handleDrop;
}

function handleFileSelect(evt: Event) {
    let input = <HTMLInputElement>evt.target;
    handleFiles(input.files!);
    input.value = '';
}

function handleDragOver(evt: DragEvent) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer!.dropEffect = 'copy';
}

function handleDrop(evt: DragEvent) {
    evt.stopPropagation();
    evt.preventDefault();
    const items = evt.dataTransfer?.items;
    if (!items) return;
    if (items.length === 1) {
        const entry = items[0].webkitGetAsEntry();
        if (entry?.isDirectory) {
            handleDirectory(entry as FileSystemDirectoryEntry)
            return;
        }
    }
    handleFiles(evt.dataTransfer.files);
}

async function handleDirectory(entry: FileSystemDirectoryEntry) {
    const files: File[] = [];
    async function walk(entry: FileSystemDirectoryEntry, depth: number) {
        const entries = await new Promise<FileSystemEntry[]>(
            (res, rej) => entry.createReader().readEntries(res, rej));
        for (const e of entries) {
            if (e.isDirectory && depth > 0) {
                await walk(e as FileSystemDirectoryEntry, depth - 1);
            } else if (e.isFile) {
                const file = await new Promise<File>(
                    (res, rej) => (e as FileSystemFileEntry).file(res, rej));
                files.push(file);
            }
        }
    }
    await walk(entry, 1);
    handleFiles(files);
}

async function handleFiles(files: FileList | File[]) {
    if (installing || files.length === 0)
        return;

    let hasALD = false;
    let recognized = false;
    for (let file of files) {
        if (isImageFile(file)) {
            imageFile = file;
            $('#imgReady').classList.remove('notready');
            $('#imgReady').textContent = file.name;
            recognized = true;
        } else if (isMetadataFile(file)) {
            metadataFile = file;
            $('#cueReady').classList.remove('notready');
            $('#cueReady').textContent = file.name;
            recognized = true;
        } else if (file.name.match(/\.(ald|ain)$/i) || file.name.toLowerCase() === 'adisk.dat') {
            hasALD = true;
            patchFiles.push(file);
        }
    }

    let source: LoaderSource | null = null;
    if (imageFile && (metadataFile || imageFile.name.toLowerCase().endsWith('.iso'))) {
        source = new CDImageSource(imageFile, metadataFile, patchFiles);
    } else if (!imageFile && !metadataFile) {
        if (files.length == 1 && files[0].name.toLowerCase().endsWith('.zip') && isDeflateSupported) {
            source = new ZipSource(files[0]);
        } else if (files.length == 1 && files[0].name.match(/\.(zip|rar|7z)$/i)) {
            source = new SevenZipSource(files[0]);
        } else if (files.length > 2 && hasALD) {
            source = new FileSource(files);
        }
    }

    if (!source) {
        if (!recognized)
            addToast(`${files[0].name}: ${message.unrecognized_format}`, 'warning');
        return;
    }

    installing = true;
    try {
        await source.startLoad();
        setCDDALoader(source.getCDDALoader());
        loaded(source.hasMidi);
    } catch (err) {
        if (err instanceof NoGamedataError) {
            gtag('event', 'NoGamedata', { event_category: 'Loader', event_label: err.message });
            addToast(`${message.cannot_install}: ${err.message}`, 'warning');
        } else if (err instanceof Error) {
            gtag('event', 'LoadFailed', { event_category: 'Loader', event_label: err.message });
            addToast(`${message.cannot_install}: ${message.unrecognized_format}`, 'warning');
        }
    }
    installing = false;
}

function isImageFile(file: File): boolean {
    let name = file.name.toLowerCase();
    return name.endsWith('.img') || name.endsWith('.mdf') || name.endsWith('.iso');
}

function isMetadataFile(file: File): boolean {
    let name = file.name.toLowerCase();
    return name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds');
}

function loaded(hasMidi: boolean) {
    if (hasMidi)
        midiPlayer.init(volumeControl.audioNode());
    $('#xsystem35').hidden = false;
    document.body.classList.add('game');
    $('#toolbar').classList.remove('before-game-start');
    window.onbeforeunload = onBeforeUnload;
    setTimeout(() => {
        Module!.arguments.push(config.antialias ? '-antialias' : '-noantialias');
        Module!.arguments.push('-fm');
        Module!.removeRunDependency('gameFiles');
        document.dispatchEvent(new Event('gamestart'));
    }, 0);
}

function onBeforeUnload(e: BeforeUnloadEvent) {
    if (config.unloadConfirmation) {
        e.returnValue = message.unload_confirmation;
        volumeControl.suspendForModalDialog();
    }
}

init();
