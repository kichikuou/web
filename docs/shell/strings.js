// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
const dictionary_en = {
    cannot_install: 'Cannot install',
    game_over: 'The game is over.',
    import_savedata_confirm: 'Import save files from Kichikuou on Chrome?',
    input_char_limit: (maxLength) => `Up to ${maxLength} characters`,
    module_load_failed: (src) => `Failed to load ${src}. Please reload the page.`,
    no_ald_in_zip: 'No game files (*.ALD/*.DAT) in the zip file.',
    no_gamedata_dir: 'No GAMEDATA folder in the image.',
    restore_success: 'Save files has been restored successfully.',
    restore_failure: 'Save files could not be restored.',
    unload_confirmation: 'Unsaved data will be lost.',
    unrecognized_format: 'Unrecognized format.',
};
const dictionary_ja = {
    cannot_install: 'インストールできません',
    game_over: 'ゲームは終了しました。',
    import_savedata_confirm: '鬼畜王 on Chrome のセーブデータを引き継ぎますか?',
    input_char_limit: (maxLength) => `全角${maxLength}文字まで`,
    module_load_failed: (src) => src + 'の読み込みに失敗しました。リロードしてください。',
    no_ald_in_zip: 'ZIP内にゲームデータ (*.ALD/*.DATファイル) が見つかりません。',
    no_gamedata_dir: 'イメージ内にGAMEDATAフォルダが見つかりません。',
    restore_success: 'セーブデータの復元に成功しました。',
    restore_failure: 'セーブデータを復元できませんでした。',
    unload_confirmation: 'セーブしていないデータは失われます。',
    unrecognized_format: '認識できない形式です。',
};
const dicts = {
    en: dictionary_en,
    ja: dictionary_ja
};
function selectDictionary() {
    let lang = document.documentElement.getAttribute('lang');
    if (lang && dicts[lang])
        return dicts[lang];
    return dictionary_en;
}
export const message = selectDictionary();
