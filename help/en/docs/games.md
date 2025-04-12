# Supported Games

## Royalty-Free Games

These games are declared as [royalty-free](https://www.alicesoft.com/about/#cont08)
by AliceSoft and can be played on this site.

- Rance: Quest for Hikari
- Rance II: Rebellious Maidens
- Rance III: The Fall of Leazas
- RanceIV: Legacy of the Sect
- Rance 4.1: Save the Medicine Plant!
- Rance 4.2: Angel Army
- Kichikuou Rance
- Toushin Toshi
- Toushin Toshi II
- Little Vampire
- Intruder
- Crescent Moon Girl
- Abunai Tengu Densetsu
- Dream Program System (D.P.S.)
- D.P.S. SG
- D.P.S. SG set2
- D.P.S. SG set3
- DALK
- Dr.STOP!
- Super D.P.S.
- Prostudent G
- Ayumi-chan Monogatari
- AmbivalenZ
- Space Thief Funny Bee
- ALICE's Mansion 3
- Gakuen KING
- Mugen Houyou
- D.P.S. All

You can download the game files from the following sites:

- [AliceSoft Archives](http://retropc.net/alice/)
- [AliceSoft Free Distribution](https://alicefree.fastlast.org/)

### MSX Games

Among the titles declared free for distribution, the following MSX games are not supported on this site, but can be played in your browser using WebMSX, a separate site:

- Little PRINCESS
- Gakuen Senki

Follow these steps to play:

1. Download the "MSX2/2+ Disk Image" from [AliceSoft Archives](http://retropc.net/alice/).
2. Open the [WebMSX](https://webmsx.org/?M=MSX2PJ) page and drag & drop the downloaded ZIP file onto it.
3. Click the power icon at the bottom left and select "Reset" from the menu to restart. The disk image will be loaded, and the game will start.
4. For *Little PRINCESS*, you need to enable CAPS and KANA on the MSX keyboard for text input. By default, these are mapped to the <kbd>NonConvert</kbd> and <kbd>PageDown</kbd> keys respectively (you can change them in "Help & Settings").

## Games Not Covered by the Royalty-Free Declaration

Even if a game isn’t part of the free distribution declaration, you can still play it on this site if it's supported by the xsystem35 or system3-sdl2 engines and you have the CD image or ZIP archive yourself.

- [List of games supported by xsystem35](https://github.com/kichikuou/xsystem35-sdl2/blob/master/game_compatibility.md)
- [List of games supported by system3-sdl2](https://github.com/kichikuou/system3-sdl2/blob/master/game_compatibility.md)

The setup process differs depending on whether you have a **CD-ROM** or a **download edition**.

### For Download Editions

Install the game on your PC, then **compress the installation folder into a ZIP file**.
Drag and drop the ZIP onto this site to launch the game.

### For CD-ROM

There are two ways to prepare the game:

- Compress the CD contents into a ZIP file (recommended)
- Convert the CD into a disk image

#### Compressing the CD Contents into a ZIP (Recommended)

Some titles store music as CD audio tracks. In such cases, use CD ripping software (like Windows Media Player) to extract the audio tracks in MP3 format.

!!! note "Note"
    The MP3 file names must include a **track number**, such as “02” or “03”.

Place the ripped MP3 files together with the contents of the `GAMEDATA` folder from the CD, and compress everything into a ZIP file.

#### Creating a CD Image

Use CD imaging software to convert your CD-ROM into a `.bin`/`.cue` format image file.

!!! Warning
    Some free CD imaging tools may include adware or viruses in their installers. Be sure to download from trusted sources.

For more details about supported file formats, see [Advanced Usage](advanced.md#supported-file-formats).

## Games Using System4

Games developed with AliceSoft’s System4 engine[^1] are not supported by *Kichikuou on Web*.
If you want to play them on a mobile device, the following options are available:

- Android: [xsystem4-android](https://github.com/kichikuou/xsystem4-android)
- iOS / iPadOS: [XSystem4 Web Installer](https://xsystem4-pwa.web.app)

[^1]: "DALK Gaiden" (released in 2002) and all games released by AliceSoft in 2003 or later.
