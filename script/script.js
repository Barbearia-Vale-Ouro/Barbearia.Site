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

        var tabs = document.querySelectorAll('.profile-tab');
        var panels = document.querySelectorAll('.profile-panel');
        var teamGrid = document.getElementById('teamGrid');
        var teamLoaded = false;

        function setActiveTab(name) {
            tabs.forEach(function (tab) {
                tab.classList.toggle('active', tab.dataset.panel === name);
            });
            panels.forEach(function (panel) {
                panel.classList.toggle('active', panel.dataset.panel === name);
            });
            if (name === 'profissionais' && !teamLoaded) {
                teamLoaded = true;
                if (teamGrid) {
                    teamGrid.innerHTML = '<div class="team-loading">Carregando profissionais...</div>';
                    fetch('/api/items?category=profissionais')
                        .then(function (res) { return res.json(); })
                        .then(function (items) {
                            if (!items || items.length === 0) {
                                teamGrid.innerHTML = '<div class="team-empty">Nenhum profissional cadastrado ainda.</div>';
                                return;
                            }
                            teamGrid.innerHTML = items.map(function (item) {
                                return '<article class="team-card">' +
                                    (item.image_path ? '<img src="/' + item.image_path + '" alt="' + escHtml(item.title) + '">' : '<div class="team-card-image placeholder"></div>') +
                                    '<div class="team-card-body">' +
                                    '<h3>' + escHtml(item.title) + '</h3>' +
                                    '<p>' + escHtml(item.description) + '</p>' +
                                    '</div>' +
                                    '</article>';
                            }).join('');
                        })
                        .catch(function () {
                            teamGrid.innerHTML = '<div class="team-empty">Falha ao carregar profissionais.</div>';
                        });
                }
            }
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                setActiveTab(this.dataset.panel);
            });
        });

        if (tabs.length && panels.length) {
            setActiveTab('profissionais');
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
