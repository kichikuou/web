const expand_all = document.getElementById('expand-all');
const collapse_all = document.getElementById('collapse-all');

expand_all.addEventListener('click', () => {
    for (const e of document.getElementsByTagName('details')) {
        e.open = true;
    }
    expand_all.classList.add('d-hide');
    collapse_all.classList.remove('d-hide');
});

collapse_all.addEventListener('click', () => {
    for (const e of document.getElementsByTagName('details')) {
        e.open = false;
    }
    collapse_all.classList.add('d-hide');
    expand_all.classList.remove('d-hide');
});
