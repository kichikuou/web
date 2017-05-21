[鬼畜王 on Web](https://github.com/kichikuou/web/) のソースコードです。

以下、各ディレクトリの説明です。

#### shell
鬼畜王 on Web のJavaScript部分のソースコードです。

* CDイメージファイルの読み込み
* UI（ツールバー、設定ダイアログなど）　
* ゲームエンジンの下回り（CD音源再生など）

などのコードが含まれています。ビルドにはNode.jsが必要です。以下のコマンドでビルドできます。

    $ cd shell
    $ npm install
    $ ./node_modules/.bin/tsc

#### fslib
鬼畜王 on Web ではCDイメージのロードが始まってからゲームエンジン (system3 / xsystem35) を初期化するのですが、それ以前にemscriptenのIDBFSファイルシステムにアクセスしたい場合があります。これを実現するためのダミーのEmscriptenプログラムです。

#### docs
https://kichikuou.github.io/web/ で公開されるディレクトリです。HTMLなどの静的ファイルと、ビルド済みのJavaScript/Wasmファイルが入っています。
`system3.*` ファイルは [system3-sdl2](https://github.com/kichikuou/system3-sdl2)、`xsystem35.*` ファイルは [xsystem35-sdl2](https://github.com/kichikuou/xsystem35-sdl2) をビルドしたものです。
