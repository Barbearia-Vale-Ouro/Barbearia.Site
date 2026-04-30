/**
 * script.js — Barbearia Vale Ouro
 * Funções globais do site público: menu mobile, scroll e utilidades.
 */
(function () {
    'use strict';

    /* ── Ano atual ─────────────────────────────────────────────────────────── */
    var yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ── Menu mobile ───────────────────────────────────────────────────────── */
    function getNav() { return document.querySelector('.nav-links'); }

    window.toggleMenu = function () {
        var nav = getNav();
        if (!nav) return;
        var isOpen = nav.classList.toggle('active');
        var btn = document.querySelector('.hamburger');
        if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    /* Fecha o menu ao clicar fora da barra de navegação */
    document.addEventListener('click', function (e) {
        var nav = getNav();
        if (nav && nav.classList.contains('active')) {
            if (!e.target.closest('nav')) {
                nav.classList.remove('active');
                var btn = document.querySelector('.hamburger');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    /* Fecha o menu ao clicar em um link (mobile) */
    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.nav-links a').forEach(function (link) {
            link.addEventListener('click', function () {
                var nav = getNav();
                if (nav) nav.classList.remove('active');
            });
        });

        /* ── Carregar Profissionais (Barbeiros) — executa em qualquer página com #teamGrid ── */
        var teamGrid = document.getElementById('teamGrid');
        if (teamGrid) {
            loadProfissionais(teamGrid);
        }

        function loadProfissionais(grid) {
            grid.innerHTML = '<div class="team-loading">Carregando profissionais...</div>';
            fetch('/api/items?category=profissionais')
                .then(function (res) { return res.json(); })
                .then(function (items) {
                    if (!items || items.length === 0) {
                        grid.innerHTML = '<div class="team-empty">Nenhum profissional cadastrado ainda.</div>';
                        return;
                    }
                    grid.innerHTML = items.map(function (item) {
                        var imageHtml = item.image_path 
                            ? '<img src="/' + item.image_path + '" alt="' + escHtml(item.title) + '">' 
                            : '<div class="barber-card-placeholder"><i class="fas fa-user"></i></div>';
                        var whatsMsg = encodeURIComponent('Olá, vim pelo site e quero agendar com o(a) barbeiro(a) ' + item.title);
                        var specialty = item.specialty || 'Cortes Masculinos';
                        var tags = item.tags ? item.tags.split(',').map(function(t) { return t.trim(); }).slice(0, 3) : ['Corte', 'Barba', 'Acabamento'];
                        
                        return '<article class="barber-card" data-expanded="false">' +
                            '<div class="barber-card-image">' + imageHtml +
                            '<div class="barber-card-overlay">' +
                            '<h3 class="barber-card-name">' + escHtml(item.title) + '</h3>' +
                            '<div class="barber-card-specialty">' + escHtml(specialty) + '</div>' +
                            '</div>' +
                            '</div>' +
                            '<div class="barber-card-body">' +
                            '<p class="barber-card-bio">' + escHtml(item.description) + '</p>' +
                            '<div class="barber-tags">' +
                            tags.map(function(tag) { return '<span class="barber-tag">' + escHtml(tag) + '</span>'; }).join('') +
                            '</div>' +
                            '<a class="barber-card-btn" href="https://wa.me/5512991898466?text=' + whatsMsg + '" target="_blank" rel="noopener">' +
                            '<i class="fas fa-calendar-check"></i> Agendar' +
                            '</a>' +
                            '</div>' +
                            '</article>';
                    }).join('');
                    
                    // Adicionar clique para expandir/recorrer bio
                    document.querySelectorAll('.barber-card-bio').forEach(function(bio) {
                        bio.classList.add('expandable-desc');
                        bio.dataset.expanded = 'false';
                        bio.onclick = function() {
                            var card = this.closest('.barber-card');
                            var isExpanded = this.dataset.expanded === 'true';
                            this.dataset.expanded = !isExpanded;
                            card.classList.toggle('expanded', !isExpanded);
                        };
                    });
                })
                .catch(function () {
                    grid.innerHTML = '<div class="team-empty">Falha ao carregar profissionais.</div>';
                });
        }

        /* ── Lógica de abas (apenas se existir) ─────────────────────────────── */
        var tabs = document.querySelectorAll('.profile-tab');
        var panels = document.querySelectorAll('.profile-panel');

        function setActiveTab(name) {
            tabs.forEach(function (tab) {
                tab.classList.toggle('active', tab.dataset.panel === name);
            });
            panels.forEach(function (panel) {
                panel.classList.toggle('active', panel.dataset.panel === name);
            });
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                setActiveTab(this.dataset.panel);
            });
        });

        if (tabs.length && panels.length) {
            setActiveTab('profissionais');
        }

        /* ── Carregar Destaques (Highlights) ───────────────────────────────── */
        var highlightsGrid = document.getElementById('highlightsGrid');
        if (highlightsGrid) {
            fetch('/api/highlights')
                .then(function (res) { return res.json(); })
                .then(function (items) {
                    if (!items || items.length === 0) return;
                    highlightsGrid.innerHTML = items.map(function (item) {
                        var badgeHtml = item.badge ? '<span class="highlight-card-badge"><i class="fas fa-star"></i> ' + escHtml(item.badge) + '</span>' : '';
                        var link = item.link || '#';
                        return '<article class="highlight-card">' +
                            badgeHtml +
                            '<img src="/' + escHtml(item.image_path) + '" alt="' + escHtml(item.title) + '" loading="lazy">' +
                            '<div class="highlight-card-body">' +
                            '<h3>' + escHtml(item.title) + '</h3>' +
                            '<p data-expanded="false">' + escHtml(item.description) + '</p>' +
                            '<a class="btn btn-primary" href="' + escHtml(link) + '">Ver Mais</a>' +
                            '</div>' +
                            '</article>';
                    }).join('');
                    
                    // Adicionar clique para expandir descrições dos highlights
                    document.querySelectorAll('.highlight-card-body p').forEach(function(el) {
                        el.onclick = function() {
                            var isExpanded = this.dataset.expanded === 'true';
                            this.dataset.expanded = !isExpanded;
                        };
                    });
                })
                .catch(function () {
                    // Mantém os cards padrão em caso de erro
                });
        }
    });

    /* ── Scroll suave ao topo ──────────────────────────────────────────────── */
    window.scrollToTop = function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

}());
