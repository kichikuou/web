# Launching the Game

This site only provides the runtime environment. To play a game, you’ll need to load a CD-ROM image or a ZIP archive.

## How to Launch

First, download the disk image of the game you want to play. For download sources, refer to [Supported Games](games.md).

- **If you downloaded a RAR file (CD image):**
    1. Extract the RAR archive to obtain the CD-ROM image.
        - Recommended extraction tools:
            - Windows: [7-Zip](https://www.7-zip.org/)
            - macOS: [The Unarchiver](https://itunes.apple.com/jp/app/the-unarchiver/id425424353)
            - Android: [ZArchiver](https://play.google.com/store/apps/details?id=ru.zdevs.zarchiver&hl=en)
    2. Load the following files from the extracted folder:
        - A file with the extension `.img` or `.mdf`
        - A file with the extension `.cue`, `.ccd`, or `.mds`

        You can drag and drop the files onto the *Kichikuou on Web* page, or click the “Choose File” button on the page to select them manually. If you're unsure which files to select, feel free to drop all files in the folder.

- **If you downloaded a ZIP file (Windows archive):**

    Simply drag and drop the downloaded ZIP file onto the *Kichikuou on Web* page, or use the “Choose File” button to load it.

Once the game files are loaded, the game will automatically launch.
Saves are stored in your browser, so as long as you load the same CD image or ZIP file again later, you can continue from where you left off.

## How to Launch on iOS

This section explains how to extract a CD-ROM image from a RAR file and launch the game on iOS/iPadOS.

If you're playing a game that uses a ZIP file (like Rance 1–3, Toushin Toshi 1, etc.), you can simply load the ZIP file directly as described above in [How to Launch](#how-to-launch).

The screenshots below are from an iPad, but the steps are the same on iPhone.

1. Go to "Settings" → "General" → "iPhone Storage" to check your available space. At least 1.4GB of free space is required.
2. Install [iZip](https://itunes.apple.com/jp/app/izip-zip%E5%9C%A7%E7%B8%AE-zip%E8%A7%A3%E5%87%8D-rar%E8%A7%A3%E5%87%8D%E3%81%AE%E3%81%9F%E3%82%81%E3%81%AE%E3%83%84%E3%83%BC%E3%83%AB/id413971331?mt=8) from the App Store to extract RAR archives.
3. Download the CD image from the [distribution site](https://alicefree.fastlast.org/). These files are several hundred megabytes, so after tapping the download link, it may take some time—please be patient.
4. Once the download is complete, you will see a screen like this. Tap "Open in 'iZip'".<br/>![download](images/ios-download.png)
5. When prompted to extract all files, tap “OK” to start extraction. This may also take a few minutes.<br/>![iZip](images/ios-izip.png)
6. Return to Safari, go to the *Kichikuou on Web* page, and tap the “Choose File” button. Then navigate to "Choose File" → "On My iPhone" → "iZip", and select the disk image files. Since file extensions may not be shown, all files may appear to have the same name—however, the ~600MB file is the `.img`, and the 1–2KB file is the `.cue`.<br/>![file chooser](images/ios-filer.png)
7. Once both `.img` and `.cue` are loaded, the game will launch.
8. After the game has launched, you can delete the downloaded `.rar` file using iZip or the built-in iOS "Files" app.