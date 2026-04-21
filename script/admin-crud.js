/**
 * admin-crud.js
 * Painel administrativo � opera��es CRUD via API REST (MySQL).
 */
(function () {
    'use strict';

    AdminAuth.requireAuth();

    var API = '/api';

    // -- Estado --------------------------------------------------------------
    var state = {
        section:       'cortes',
        editingId:     null,
        pendingDelete: null,
        removeImage:   false
    };

    // -- API helpers ----------------------------------------------------------
    function authHeaders() {
        return { 'Authorization': 'Bearer ' + AdminAuth.getToken() };
    }

    function handleUnauth() {
        AdminAuth.logout();
        window.location.replace('admin-login.html');
    }

    async function apiFetch(url, options) {
        options = options || {};
        options.headers = Object.assign({}, options.headers, authHeaders());
        var res = await fetch(url, options);
        if (res.status === 401) { handleUnauth(); throw new Error('Unauthorized'); }
        return res;
    }

    async function apiGetPublic(url) {
        var res = await fetch(url);
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
    }

    // -- XSS helpers ----------------------------------------------------------
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleDateString('pt-BR');
    }

    // -- Renderiza��o do grid -------------------------------------------------
    async function renderGrid(section) {
        var grid  = document.getElementById('adminGrid');
        var empty = document.getElementById('emptyState');

        grid.innerHTML = '<div style="padding:2.5rem;color:var(--adm-muted);text-align:center">' +
                         '<i class="fas fa-spinner fa-spin"></i>&nbsp; Carregando...</div>';
        grid.hidden  = false;
        empty.hidden = true;

        var items;
        try {
            items = await apiGetPublic(API + '/items?category=' + section);
        } catch (e) {
            grid.innerHTML = '<div style="padding:2rem;color:var(--adm-danger)">' +
                             '<i class="fas fa-exclamation-triangle"></i> Erro ao carregar. ' +
                             'Verifique se o servidor est\u00e1 rodando.</div>';
            return;
        }

        grid.innerHTML = '';

        if (items.length === 0) {
            grid.hidden  = true;
            empty.hidden = false;
            return;
        }

        items.forEach(function (item) {
            var card = document.createElement('div');
            card.className = 'admin-card';

            var imgHtml = item.image_path
                ? '<img class="admin-card-img" src="/' + escHtml(item.image_path) + '" alt="' + escHtml(item.title) + '" loading="lazy">'
                : '<div class="admin-card-img placeholder"><i class="fas fa-image"></i></div>';

            var subcatBadge = item.subcategory
                ? '<span class="admin-card-subcat"><i class="fas fa-tag"></i> ' + escHtml(item.subcategory) + '</span>'
                : '';

            card.innerHTML =
                imgHtml +
                '<div class="admin-card-body">' +
                    subcatBadge +
                    '<h4>' + escHtml(item.title) + '</h4>' +
                    '<p>' + escHtml(item.description) + '</p>' +
                    '<span class="admin-card-date">' + formatDate(item.created_at) + '</span>' +
                '</div>' +
                '<div class="admin-card-actions">' +
                    '<button class="action-btn edit" data-id="' + item.id + '">' +
                        '<i class="fas fa-pen"></i> Editar' +
                    '</button>' +
                    '<button class="action-btn delete" data-id="' + item.id + '">' +
                        '<i class="fas fa-trash-alt"></i> Excluir' +
                    '</button>' +
                '</div>';

            grid.appendChild(card);
        });

        grid.addEventListener('click', onGridClick, { once: true });
    }

    function onGridClick(e) {
        var editBtn   = e.target.closest('.action-btn.edit');
        var deleteBtn = e.target.closest('.action-btn.delete');
        if (editBtn)   openEdit(editBtn.dataset.id);
        if (deleteBtn) openConfirmDelete(deleteBtn.dataset.id);
        document.getElementById('adminGrid').addEventListener('click', onGridClick, { once: true });
    }

    // -- Estat�sticas ---------------------------------------------------------
    async function updateStats() {
        try {
            var all = await apiGetPublic(API + '/items');
            var c = all.filter(function (i) { return i.category === 'cortes'; }).length;
            var s = all.filter(function (i) { return i.category === 'servicos'; }).length;
            var f = all.filter(function (i) { return i.category === 'profissionais'; }).length;
            var p = all.filter(function (i) { return i.category === 'produtos'; }).length;
            document.getElementById('statCortes').textContent       = c;
            document.getElementById('statServicos').textContent     = s;
            document.getElementById('statProfissionais').textContent = f;
            document.getElementById('statProdutos').textContent     = p;
            document.getElementById('statTotal').textContent        = c + s + f + p;
            document.getElementById('sectionCount').textContent =
                all.filter(function (i) { return i.category === state.section; }).length + ' itens';
        } catch (_) {}
    }

    // -- Troca de seção -------------------------------------------------------
    var SUBCATS = {
        cortes:        ['Cortes', 'Mais Estilos', 'Degradês', 'Estilos Especiais'],
        servicos:      ['Serviços', 'Experiência Premium', 'Tratamentos', 'Pacotes'],
        profissionais: ['Barbeiros', 'Estilistas', 'Atendimento VIP', 'Técnicas Especiais'],
        produtos:      ['Shampoo e Condicionador', 'Modeladores', 'Linha de Barba', 'Destaques da Vitrine', 'Hidratação'],
        promocoes:     ['Promoção do Mês', 'Combo', 'Desconto', 'Lançamento', 'Oferta Limitada']
    };

    function updateSubcatList(section) {
        var dl = document.getElementById('subcategoryOptions');
        if (!dl) return;
        var opts = SUBCATS[section] || [];
        dl.innerHTML = opts.map(function (o) { return '<option value="' + escHtml(o) + '">'; }).join('');
    }

    function updateFormBySection(section) {
        var waGroup = document.getElementById('itemWhatsapp').closest('.form-group');
        if (!waGroup) return;
        if (section === 'profissionais') {
            waGroup.hidden = true;
            document.getElementById('itemWhatsapp').value = '';
        } else {
            waGroup.hidden = false;
        }
    }

    function switchSection(section) {
        state.section = section;
        document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        var titles = { cortes: 'Cortes', servicos: 'Serviços', profissionais: 'Profissionais', produtos: 'Produtos', promocoes: 'Promoções' };
        document.getElementById('sectionTitle').textContent = titles[section] || section;
        updateSubcatList(section);
        updateFormBySection(section);
        renderGrid(section);
        updateStats();
    }

    // -- Modal ----------------------------------------------------------------
    function openModal(title) {
        document.getElementById('modalTitle').textContent = title || 'Adicionar Item';
        document.getElementById('modalOverlay').hidden = false;
        document.body.style.overflow = 'hidden';
        document.getElementById('itemTitle').focus();
    }

    function closeModal() {
        document.getElementById('modalOverlay').hidden = true;
        document.body.style.overflow = '';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('uploadPreview').hidden    = true;
        document.getElementById('uploadPlaceholder').hidden = false;
        document.getElementById('previewImg').src = '';
        document.getElementById('formError').hidden = true;
        document.getElementById('descCount').textContent = '0';
        state.editingId   = null;
        state.removeImage = false;
    }

    function openAdd() {
        state.editingId   = null;
        state.removeImage = false;
        document.getElementById('itemCategory').value    = state.section;
        document.getElementById('itemSubcategory').value = '';
        updateSubcatList(state.section);
        updateFormBySection(state.section);
        openModal('Adicionar Item');
    }

    async function openEdit(id) {
        state.editingId   = id;
        state.removeImage = false;
        document.getElementById('itemId').value       = id;
        document.getElementById('itemCategory').value = state.section;
        updateFormBySection(state.section);
        openModal('Editar Item');

        try {
            var item = await apiGetPublic(API + '/items/' + id);
            document.getElementById('itemTitle').value       = item.title;
            document.getElementById('itemSubcategory').value = item.subcategory || '';
            document.getElementById('itemDesc').value        = item.description;
            document.getElementById('descCount').textContent = (item.description || '').length;
            document.getElementById('itemWhatsapp').value    = item.whatsapp_msg || '';

            if (item.image_path) {
                document.getElementById('previewImg').src          = '/' + item.image_path;
                document.getElementById('uploadPreview').hidden    = false;
                document.getElementById('uploadPlaceholder').hidden = true;
            }
        } catch (e) {
            showFormError('Erro ao carregar dados do item.');
        }
    }

    function showFormError(msg) {
        var el = document.getElementById('formError');
        el.textContent = msg;
        el.hidden = false;
    }

    // -- Salvar (POST / PUT) --------------------------------------------------
    document.getElementById('itemForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        var title       = document.getElementById('itemTitle').value.trim();
        var subcategory = document.getElementById('itemSubcategory').value.trim();
        var desc        = document.getElementById('itemDesc').value.trim();
        var waMsg       = document.getElementById('itemWhatsapp').value.trim();
        var category    = document.getElementById('itemCategory').value;
        var fileInp     = document.getElementById('itemImage');
        var editId      = document.getElementById('itemId').value;

        document.getElementById('formError').hidden = true;
        if (!title) { showFormError('Informe o t\u00edtulo.'); return; }
        if (!desc)  { showFormError('Informe a descri\u00e7\u00e3o.'); return; }

        var btnSave = document.getElementById('btnSave');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        var fd = new FormData();
        fd.append('category',    category);
        fd.append('subcategory', subcategory);
        fd.append('title',       title);
        fd.append('description', desc);
        fd.append('whatsapp_msg', waMsg);
        if (state.removeImage) fd.append('remove_image', '1');
        var file = fileInp.files && fileInp.files[0];
        if (file) fd.append('image', file);

        try {
            var url    = editId ? API + '/items/' + editId : API + '/items';
            var method = editId ? 'PUT' : 'POST';
            var res = await apiFetch(url, { method: method, body: fd });

            if (!res.ok) {
                var errData = await res.json().catch(function () { return {}; });
                showFormError(errData.error || 'Erro ao salvar.');
                return;
            }

            closeModal();
            renderGrid(category);
            updateStats();
        } catch (err) {
            if (err.message !== 'Unauthorized') {
                showFormError('Erro de conex\u00e3o com o servidor.');
            }
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
    });

    // -- Exclus�o -------------------------------------------------------------
    function openConfirmDelete(id) {
        state.pendingDelete = id;
        document.getElementById('confirmOverlay').hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
        document.getElementById('confirmOverlay').hidden = true;
        document.body.style.overflow = '';
        state.pendingDelete = null;
    }

    document.getElementById('confirmDelete').addEventListener('click', async function () {
        var id = state.pendingDelete;
        if (!id) return;

        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';

        try {
            var res = await apiFetch(API + '/items/' + id, { method: 'DELETE' });
            if (!res.ok) {
                var errData = await res.json().catch(function () { return {}; });
                alert(errData.error || 'Erro ao excluir.');
                return;
            }
            closeConfirm();
            renderGrid(state.section);
            updateStats();
        } catch (e) {
            if (e.message !== 'Unauthorized') alert('Erro de conex\u00e3o.');
        } finally {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-trash-alt"></i> Excluir';
        }
    });

    document.getElementById('confirmCancel').addEventListener('click', closeConfirm);

    // -- Upload de imagem -----------------------------------------------------
    var uploadArea  = document.getElementById('uploadArea');
    var fileInput   = document.getElementById('itemImage');
    var placeholder = document.getElementById('uploadPlaceholder');
    var preview     = document.getElementById('uploadPreview');
    var previewImg  = document.getElementById('previewImg');

    uploadArea.addEventListener('click', function (e) {
        if (!e.target.closest('#removeImage')) fileInput.click();
    });

    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', function () {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        var f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) handleFileSelect(f);
    });

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) handleFileSelect(this.files[0]);
    });

    document.getElementById('removeImage').addEventListener('click', function () {
        fileInput.value    = '';
        previewImg.src     = '';
        preview.hidden     = true;
        placeholder.hidden = false;
        state.removeImage  = true;
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 25 * 1024 * 1024) { showFormError('Imagem muito grande. M\u00e1ximo: 25MB.'); return; }
        state.removeImage = false;
        var reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src     = e.target.result;
            preview.hidden     = false;
            placeholder.hidden = true;
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('itemDesc').addEventListener('input', function () {
        document.getElementById('descCount').textContent = this.value.length;
    });

    // -- Sidebar / navega��o --------------------------------------------------
    document.querySelectorAll('.sidebar-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchSection(this.dataset.section);
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('open');
        });
    });

    document.getElementById('btnAdd').addEventListener('click', openAdd);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('btnCancel').addEventListener('click', closeModal);

    document.getElementById('sidebarToggle').addEventListener('click', function () {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('open');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', function () {
        document.getElementById('sidebar').classList.remove('open');
        this.classList.remove('open');
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (!document.getElementById('modalOverlay').hidden)   closeModal();
            if (!document.getElementById('confirmOverlay').hidden) closeConfirm();
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
        AdminAuth.logout();
        window.location.replace('admin-login.html');
    });

    // -- Init -----------------------------------------------------------------
    switchSection('cortes');
    var btnAddEmpty = document.getElementById('btnAddEmpty');
    if (btnAddEmpty) btnAddEmpty.addEventListener('click', openAdd);

}());
