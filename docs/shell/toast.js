// Copyright (c) 2019 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import { $ } from './util.js';
export function addToast(msg, type) {
    let container = $('.toast-container');
    let div = document.createElement('div');
    div.classList.add('toast');
    if (type)
        div.classList.add('toast-' + type);
    if (typeof msg === 'string')
        div.innerText = msg;
    else
        div.appendChild(msg);
    let btn = document.createElement('button');
    btn.setAttribute('class', 'btn btn-clear float-right');
    function dismiss() { if (div.parentNode === container)
        container.removeChild(div); }
    btn.addEventListener('click', dismiss);
    let timeout = type ? { success: 5000, warning: 10000, error: null }[type] : 5000;
    if (timeout)
        setTimeout(dismiss, timeout);
    div.insertBefore(btn, div.firstChild);
    container.insertBefore(div, container.firstChild);
    return div;
}
