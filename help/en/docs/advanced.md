# Advanced Usage

## Applying Patch Files

You can apply patches or replace specific files by dragging and dropping them together with the CD image when launching the game.

For example, to use the [Unofficial Patch for Kichikuou Rance](http://alice.xfu.jp/doku.php?id=%E9%AC%BC%E7%95%9C%E7%8E%8B%E3%83%A9%E3%83%B3%E3%82%B9:%E9%9D%9E%E5%85%AC%E5%BC%8F%E4%BF%AE%E6%AD%A3), drag and drop the included `鬼畜王SA.ALD` and `System39.ain` files onto the page along with the CD image file.

!!! Note
    The patch files must be loaded every time you launch the game.

!!! Warning
    Most patch files are not compatible with existing save data. Loading pre-patch save data with a patched version (or vice versa) may corrupt the data.

## Supported File Formats

*Kichikuou on Web* supports the following file formats via drag-and-drop:

- CD Image Files
    - `.img` + `.cue`
    - `.bin` + `.cue`
    - `.mdf` + `.mds`
    - `.iso`
- Archive Files (archived CD image files are not supported)
    - `.zip`
    - `.7z`
    - `.rar`
- Game Files
    - You can directly drag and drop all relevant game files at once.
- Folders
    - Dragging and dropping a folder will load all files within it.

Even if you're not using a CD image, background music (BGM) can still be played by loading ripped audio tracks from the CD in one of the following formats:

- File types: `.mp3`, `.ogg`, or `.wav`
- Track numbers must be included at the beginning or end of the filename (before the extension)
    - Examples: `02 Opening.mp3`, `Track02.wav`
