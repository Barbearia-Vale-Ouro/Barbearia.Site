/**
 * promo-loader.js
 * Carrega os itens da categoria "promocoes" da API e renderiza
 * os cards na seção #promocoes-section do index.html.
 * A seção fica oculta via CSS e só aparece quando há itens.
 */
(function () {
    'use strict';

    var API           = '/api';
    var WHATSAPP_BASE = 'https://wa.me/5512991898466?text=';

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    function buildPromoCard(item) {
        var waMsg = item.whatsapp_msg
            ? item.whatsapp_msg
            : 'Olá, vi a promoção "' + item.title + '" no site e quero saber mais!';
        var waUrl = WHATSAPP_BASE + encodeURIComponent(waMsg);

        var card = document.createElement('article');
        card.className = 'promo-card';

        var imgHtml = item.image_path
            ? '<img src="/' + escHtml(item.image_path) + '" alt="' + escHtml(item.title) + '" loading="lazy">'
            : '';

        var subcatBadge = item.subcategory
            ? '<span class="promo-card-badge">' + escHtml(item.subcategory) + '</span>'
            : '<span class="promo-card-badge">Promoção</span>';

        card.innerHTML =
            imgHtml +
            subcatBadge +
            '<div class="promo-card-body">' +
                '<h4>' + escHtml(item.title) + '</h4>' +
                '<p>' + escHtml(item.description) + '</p>' +
                '<a class="btn btn-whatsapp" href="' + escHtml(waUrl) + '" target="_blank" rel="noopener">' +
                    '<i class="fab fa-whatsapp"></i> Aproveitar Promoção' +
                '</a>' +
            '</div>';

        return card;
    }

    function load() {
        var section = document.getElementById('promocoes-section');
        var grid    = document.getElementById('promo-grid');
        if (!section || !grid) return;

        fetch(API + '/items?category=promocoes')
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (items) {
                if (!items || items.length === 0) return;
                items.forEach(function (item) {
                    grid.appendChild(buildPromoCard(item));
                });
                section.classList.add('has-promos');
            })
            .catch(function () { /* Falha silenciosa */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }

}());
