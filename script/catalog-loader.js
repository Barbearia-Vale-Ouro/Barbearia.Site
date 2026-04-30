/**
 * catalog-loader.js
 * Busca os itens do banco de dados (via API REST) e injeta
 * nas páginas públicas: cortes.html, servicos.html, produtos.html.
 * Os cards são inseridos nos grids existentes para manter o mesmo tamanho e estilo.
 */
(function () {
    'use strict';

    var API            = '/api';
    var WHATSAPP_BASE  = 'https://wa.me/5512991898466?text=';
    var BOOKING_APP    = 'https://play.google.com/store/apps/details?id=br.com.starapp.appbarbercli';

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    function buildWhatsappUrl(msg) {
        return WHATSAPP_BASE + encodeURIComponent(msg || 'Olá, vim pelo site da Barbearia Vale Ouro');
    }

    function buildCatalogCard(item) {
        var article = document.createElement('article');
        article.className = 'catalog-card';
        var waUrl  = buildWhatsappUrl(item.whatsapp_msg || ('Olá, quero agendar ' + item.title));
        var imgTag = item.image_path
            ? '<img src="/' + item.image_path + '" alt="' + escHtml(item.title) + '" loading="lazy">'
            : '';
        article.innerHTML =
            imgTag +
            '<h4>' + escHtml(item.title) + '</h4>' +
            '<p class="expandable-desc" data-expanded="false">' + escHtml(item.description) + '</p>' +
            '<div class="card-actions">' +
                '<a class="btn btn-whatsapp" href="' + escHtml(waUrl) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>' +
                '<a class="btn btn-primary" href="' + escHtml(BOOKING_APP) + '" target="_blank" rel="noopener"><i class="fas fa-calendar-check"></i> Agendar</a>' +
            '</div>';
        return article;
    }

    function buildProductCard(item) {
        var article = document.createElement('article');
        article.className = 'product-card';
        var waUrl  = buildWhatsappUrl(item.whatsapp_msg || ('Olá, tenho interesse em ' + item.title));
        var imgTag = item.image_path
            ? '<img src="/' + item.image_path + '" alt="' + escHtml(item.title) + '" loading="lazy">'
            : '';
        article.innerHTML =
            imgTag +
            '<h4>' + escHtml(item.title) + '</h4>' +
            '<p class="expandable-desc" data-expanded="false">' + escHtml(item.description) + '</p>' +
            '<a class="btn btn-whatsapp" href="' + escHtml(waUrl) + '" target="_blank" rel="noopener">Consultar Produto</a>';
        return article;
    }

    var DEFAULT_LABEL = {
        cortes:   'Cortes',
        servicos: 'Serviços',
        produtos: 'Produtos'
    };

    function injectIntoExistingGrid(category, items) {
        if (!items || items.length === 0) return;

        // Agrupa itens por subcategoria, preservando a ordem de inserção
        var groups = {};
        var order  = [];
        items.forEach(function (item) {
            var key = (item.subcategory && item.subcategory.trim()) ? item.subcategory.trim() : '';
            if (!groups[key]) { groups[key] = []; order.push(key); }
            groups[key].push(item);
        });

        var isProdutos = category === 'produtos';

        // Container explícito por categoria
        var container = isProdutos
            ? document.getElementById('produtos-section')
            : document.getElementById('catalog-sections');

        if (!container) {
            container = document.querySelector('main') || document.body;
        }

        order.forEach(function (key) {
            var groupItems = groups[key];
            // Título da seção: usa a subcategoria registrada ou o nome padrão da categoria
            var label = key || DEFAULT_LABEL[category] || category;

            if (isProdutos) {
                var catBlock = document.createElement('div');
                catBlock.className = 'product-category';
                var h3 = document.createElement('h3');
                h3.textContent = label;
                catBlock.appendChild(h3);
                var grid = document.createElement('div');
                grid.className = 'product-grid';
                groupItems.forEach(function (item) { grid.appendChild(buildProductCard(item)); });
                catBlock.appendChild(grid);
                container.appendChild(catBlock);
            } else {
                var block = document.createElement('div');
                block.className = 'catalog-block';
                var h3 = document.createElement('h3');
                h3.textContent = label.toUpperCase();
                block.appendChild(h3);
                var grid = document.createElement('div');
                grid.className = 'catalog-grid';
                groupItems.forEach(function (item) { grid.appendChild(buildCatalogCard(item)); });
                block.appendChild(grid);
                container.appendChild(block);
            }
        });
    }

    function detectCategory() {
        var p = window.location.pathname.toLowerCase();
        if (p.indexOf('cortes')   !== -1) return 'cortes';
        if (p.indexOf('servicos') !== -1) return 'servicos';
        if (p.indexOf('produtos') !== -1) return 'produtos';
        return null;
    }

    var category = detectCategory();
    if (!category) return;

    function load() {
        fetch(API + '/items?category=' + category)
            .then(function (res) { return res.ok ? res.json() : []; })
            .then(function (items) { injectIntoExistingGrid(category, items); })
            .catch(function () { /* Falha silenciosa em páginas públicas */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }

    // Adicionar clique para expandir descrições
    function initExpandable() {
        document.querySelectorAll('.expandable-desc').forEach(function(el) {
            if (!el.dataset.expanded) {
                el.dataset.expanded = 'false';
            }
            el.onclick = function() {
                var isExpanded = this.dataset.expanded === 'true';
                this.dataset.expanded = !isExpanded;
            };
        });
    }

    // Inicializar após carregar os itens
    var originalInject = injectIntoExistingGrid;
    injectIntoExistingGrid = function(category, items) {
        originalInject(category, items);
        setTimeout(initExpandable, 100);
    };

    // Também inicializar para elementos já existentes
    if (document.readyState === 'complete') {
        initExpandable();
    }

}());
