// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

const dictionary_en = {
    cannot_install: 'Cannot install',
    error_occurred: 'An error occurred.',
    game_over: 'The game is over.',
    input_char_limit: (maxLength: number) => `Up to ${maxLength} characters`,
    module_load_failed: (src: string) => `Failed to load ${src}. Please reload the page.`,
    no_ald_in_zip: 'No game files (*SA.ALD or *.DAT) in the zip file.',
    no_gamedata_dir: 'No GAMEDATA folder in the image.',
    floppy_images_cant_be_used: 'Floppy disk images cannot be loaded.',
    restart_confirmation: 'Restart the game?',
    restore_success: 'Save files has been restored successfully.',
    restore_failure: 'Save files could not be restored.',
    unload_confirmation: 'Unsaved data will be lost.',
    unrecognized_format: 'Unrecognized format.',
};
type Dictionary = typeof dictionary_en;

const dictionary_ja: Dictionary = {
    cannot_install: 'インストールできません',
    error_occurred: 'エラーが発生しました。',
    game_over: 'ゲームは終了しました。',
    input_char_limit: (maxLength: number) => `全角${maxLength}文字まで`,
    module_load_failed: (src: string) => src + 'の読み込みに失敗しました。リロードしてください。',
    no_ald_in_zip: 'ZIP内にゲームデータ (*SA.ALD または *.DATファイル) が見つかりません。',
    no_gamedata_dir: 'イメージ内にGAMEDATAフォルダが見つかりません。',
    floppy_images_cant_be_used: 'フロッピーディスクイメージは読み込めません。Windows版のデータを使用してください。',
    restart_confirmation: 'ゲームを再起動しますか？',
    restore_success: 'セーブデータの復元に成功しました。',
    restore_failure: 'セーブデータを復元できませんでした。',
    unload_confirmation: 'セーブしていないデータは失われます。',
    unrecognized_format: '認識できない形式です。',
};

const dicts:{[language: string]: Dictionary} = {
    en: dictionary_en,
    ja: dictionary_ja
};

function selectDictionary(): Dictionary {
    let lang = document.documentElement.getAttribute('lang');
    if (lang && dicts[lang])
        return dicts[lang];
    return dictionary_en;
}
export const message = selectDictionary();
