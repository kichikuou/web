This is the source code for [Kichikuou on Web](https://kichikuou.github.io/web/) website.

### Subdirectories

#### shell
The source code for the JavaScript part of the site, which is responsive for:

* Loading CD images
* User interface (toolbar, dialogs, etc.)
* Low-level platform code, such as audio playback

Node.js is required to build. You can build them with the following command:

    $ npm install
    $ npm run build-shell

#### scss
The source code for the site's stylesheet. You can build it with the following command:

    $ npm install
    $ npm run build-css

#### fslib
A dummy Emscripten program to allow access to save files stored in the Emscripten file system, before loading the game engine (system3 or xsystem35).

#### docs
The directory published as https://kichikuou.github.io/web/. It contains static files such as HTML, and compiled JavaScript / WASM / CSS files.
`system3.*` files are built from [system3-sdl2](https://github.com/kichikuou/system3-sdl2), and `xsystem35.*` files are built from [xsystem35-sdl2](https://github.com/kichikuou/xsystem35-sdl2).

### Licenses
Code under `shell/` and `fslib/` are licensed under the [MIT License](shell/LICENSE).

`docs/xsystem35.*` files were built from [xsystem35-sdl2](https://github.com/kichikuou/xsystem35-sdl2) and licensed under [GPL 2.0](https://github.com/kichikuou/xsystem35-sdl2/blob/master/COPYING).

`docs/system3.*` files were built from [system3-sdl2](https://github.com/kichikuou/system3-sdl2) and licensed under [GPL 2.0](https://github.com/kichikuou/system3-sdl2/blob/master/COPYING.txt).

`docs/fonts/MTLc3m.ttf` is the "モトヤLシーダ3等幅" font from Android Open Source Project, and lisenced under [Apache License 2.0](docs/fonts/MTLc3m.ttf.license).

`docs/fonts/mincho.otf` is a subset of [Source Han Serif](https://github.com/adobe-fonts/source-han-serif/) font, lisenced under the [SIL Open Font License 1.1](docs/fonts/mincho.otf.license). The script used for subsetting can be found in [xsystem35-sdl2/fonts](https://github.com/kichikuou/xsystem35-sdl2/blob/master/fonts/CMakeLists.txt).

This site also uses the following opensource softwares.
- [Font Awesome](https://fontawesome.com/v4.7.0/) by Dave Gandy ([License](https://fontawesome.com/v4.7.0/license/))
- [JSZip](https://stuk.github.io/jszip/) by Stuart Knightley ([License](https://github.com/Stuk/jszip/blob/v3.1.3/LICENSE.markdown))
- [Spectre.css](https://picturepan2.github.io/spectre/) by Yan Zhu ([License](https://github.com/picturepan2/spectre/blob/v0.5.8/LICENSE))
- [fmgen](http://retropc.net/cisc/m88/download.html) by cisc ([License](https://github.com/kichikuou/fmgen/blob/master/readme.txt))
- [WebAssembly port of libTiMidity](https://github.com/feross/timidity) by Feross Aboukhadijeh ([License](https://github.com/kichikuou/timidity/blob/kichikuou/LICENSE))
- [LAME MP3 encoder](https://lame.sourceforge.io/) ([License](https://github.com/kichikuou/lame-wasm/blob/master/lame/COPYING))
