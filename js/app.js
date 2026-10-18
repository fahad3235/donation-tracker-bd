'use strict';
/* donation-tracker-bd - DOM glue. All math/validation lives in js/logic.js. */
(function () {
  var L = window.DonationLogic;
  var LS_DATA = 'donation-tracker-bd:v1';
  var LS_LANG = 'donation-tracker-bd:lang';
  var params = new URLSearchParams(window.location.search);
  var ASOF = params.get('asof') || L.todayStr();
  var lang = 'en';
  try { lang = window.localStorage.getItem(LS_LANG) || 'en'; } catch (e) { lang = 'en'; }
  if (lang !== 'bn') lang = 'en';

  var state = { donations: [] };
  var editingId = null;

  function t(key) {
    var dict = (window.I18N && window.I18N[lang]) || {};
    return dict[key] !== undefined ? dict[key] : key;
  }
  function catName(c) { var m = (window.I18N[lang] || {}).categoryNames || {}; return m[c] || c; }
  function methodName(m) { var mm = (window.I18N[lang] || {}).methodNames || {}; return mm[m] || m; }
  function money(p) { return L.formatMoney(p, lang); }
  function num(x) { return lang === 'bn' ? L.toBnDigits(String(x)) : String(x); }
  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (text !== undefined && text !== null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(LS_DATA);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      var res = L.validateImport(parsed, L.todayStr());
      if (res.ok) state.donations = res.donations;
    } catch (e) { /* corrupt storage -> start empty */ }
  }
  function save() {
    try { window.localStorage.setItem(LS_DATA, JSON.stringify(L.buildExport(state.donations))); } catch (e) { /* storage full/blocked */ }
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    document.documentElement.lang = lang;
    buildSelects();
    renderAll();
  }

  function buildSelects() {
    var fc = $('fCategory');
    var fm = $('fMethod');
    var filtC = $('fFilterCategory');
    var filtY = $('fFilterYear');
    fc.innerHTML = '';
    L.CATEGORIES.forEach(function (c) { fc.appendChild(el('option', catName(c))); fc.lastChild.value = c; });
    fm.innerHTML = '';
    L.METHODS.forEach(function (m) { fm.appendChild(el('option', methodName(m))); fm.lastChild.value = m; });
    var prevC = filtC.value || 'All';
    filtC.innerHTML = '';
    var allOpt = el('option', t('filterCategory')); allOpt.value = 'All'; filtC.appendChild(allOpt);
    L.CATEGORIES.forEach(function (c) { var o = el('option', catName(c)); o.value = c; filtC.appendChild(o); });
    filtC.value = prevC;
    var years = {};
    state.donations.forEach(function (d) { years[d.date.slice(0, 4)] = true; });
    years[ASOF.slice(0, 4)] = true;
    var prevY = filtY.value || 'All';
    filtY.innerHTML = '';
    var allY = el('option', t('filterYear')); allY.value = 'All'; filtY.appendChild(allY);
    Object.keys(years).sort().reverse().forEach(function (y) { var o = el('option', y); o.value = y; filtY.appendChild(o); });
    filtY.value = prevY;
  }

  function renderDashboard() {
    var s = L.summarize(state.donations, ASOF);
    $('statTotal').textContent = money(s.total);
    $('statThisYear').textContent = money(s.thisYear);
    $('statThisMonth').textContent = money(s.thisMonth);
    $('statCount').textContent = num(s.count);
    var cb = $('categoryBreakdown');
    cb.innerHTML = '';
    var any = false;
    L.CATEGORIES.forEach(function (c) {
      var row = s.byCategory[c];
      if (!row.count) return;
      any = true;
      var div = el('div', null, 'cat-row');
      div.appendChild(el('span', catName(c)));
      div.appendChild(el('span', money(row.total)));
      div.appendChild(el('span', row.share.toFixed(1) + '%'));
      var bar = el('div', null, 'bar');
      var fill = el('i'); fill.style.width = row.share.toFixed(1) + '%'; bar.appendChild(fill);
      div.appendChild(bar);
      cb.appendChild(div);
    });
    if (!any) cb.appendChild(el('p', t('topRecipientNone'), 'help'));
    $('topRecipient').textContent = s.topRecipient
      ? s.topRecipient + ' - ' + money(s.topRecipientTotal)
      : t('topRecipientNone');
    var yt = $('yearlyTable');
    yt.innerHTML = '';
    if (!s.byYear.length) { yt.appendChild(el('p', t('topRecipientNone'), 'help')); }
    else {
      var table = el('table');
      var thead = el('thead'); var hr = el('tr');
      hr.appendChild(el('th', t('yearCol'))); hr.appendChild(el('th', t('totalCol'), 'num')); hr.appendChild(el('th', t('countCol'), 'num'));
      thead.appendChild(hr); table.appendChild(thead);
      var tb = el('tbody');
      s.byYear.forEach(function (y) {
        var r = el('tr');
        r.appendChild(el('td', num(y.year)));
        r.appendChild(el('td', money(y.total), 'num'));
        r.appendChild(el('td', num(y.count), 'num'));
        tb.appendChild(r);
      });
      table.appendChild(tb); yt.appendChild(table);
    }
    var chart = $('monthlyChart');
    chart.innerHTML = '';
    var max = 0;
    s.monthly.forEach(function (m) { if (m.total > max) max = m.total; });
    var wrap = el('div', null, 'monthly');
    s.monthly.forEach(function (m) {
      var col = el('div', null, 'mcol');
      var bar = el('div', null, 'mbar');
      bar.style.height = max > 0 ? Math.max(2, Math.round((m.total / max) * 110)) + 'px' : '2px';
      bar.title = m.month + ': ' + money(m.total);
      col.appendChild(bar);
      col.appendChild(el('span', m.month.slice(5), 'mlabel'));
      wrap.appendChild(col);
    });
    chart.appendChild(wrap);
    var lines = s.monthly.filter(function (m) { return m.total > 0; })
      .map(function (m) { return m.month + ': ' + money(m.total); });
    if (lines.length) chart.appendChild(el('p', lines.join('  |  '), 'help'));
  }

  function currentFilters() {
    return {
      category: $('fFilterCategory').value,
      year: $('fFilterYear').value,
      query: $('fSearch').value,
      sort: $('fSort').value
    };
  }

  function renderList() {
    var rows = L.filterDonations(state.donations, currentFilters());
    $('listCount').textContent = num(rows.length) + ' ' + t('donationsUnit');
    var tb = $('donationRows');
    tb.innerHTML = '';
    $('emptyList').classList.toggle('hidden', rows.length > 0);
    rows.forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(el('td', num(d.date)));
      tr.appendChild(el('td', d.recipient));
      tr.appendChild(el('td', catName(d.category)));
      tr.appendChild(el('td', money(d.amountPaisa), 'num'));
      tr.appendChild(el('td', methodName(d.method)));
      tr.appendChild(el('td', d.receipt ? t('receiptYes') : t('receiptNo')));
      var actions = el('td');
      var eb = el('button', t('edit'), 'small'); eb.type = 'button';
      eb.addEventListener('click', function () { startEdit(d.id); });
      var db = el('button', t('delete'), 'small'); db.type = 'button';
      db.addEventListener('click', function () {
        if (window.confirm(t('deleteConfirm'))) {
          state.donations = L.deleteDonation(state.donations, d.id);
          save(); renderAll();
        }
      });
      actions.appendChild(eb); actions.appendChild(document.createTextNode(' ')); actions.appendChild(db);
      tr.appendChild(actions);
      tb.appendChild(tr);
    });
  }

  function renderAll() { renderDashboard(); renderList(); }

  function resetForm() {
    editingId = null;
    $('donationForm').reset();
    $('fDate').value = ASOF;
    $('formTitle').textContent = t('addTitle');
    $('cancelEditBtn').classList.add('hidden');
    $('formErrors').textContent = '';
  }

  function startEdit(id) {
    var d = null;
    for (var i = 0; i < state.donations.length; i++) if (state.donations[i].id === id) d = state.donations[i];
    if (!d) return;
    editingId = id;
    $('fDate').value = d.date;
    $('fRecipient').value = d.recipient;
    $('fCategory').value = d.category;
    $('fAmount').value = (d.amountPaisa / 100).toFixed(2);
    $('fMethod').value = d.method;
    $('fReceipt').checked = d.receipt;
    $('fNote').value = d.note;
    $('formTitle').textContent = t('editTitle');
    $('cancelEditBtn').classList.remove('hidden');
    $('formErrors').textContent = '';
    document.querySelector('[data-tab="donations"]').click();
    $('donationForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var amount = L.parseAmount($('fAmount').value);
    var candidate = {
      date: $('fDate').value,
      recipient: $('fRecipient').value.trim(),
      category: $('fCategory').value,
      amountPaisa: amount === null ? NaN : amount,
      method: $('fMethod').value,
      receipt: $('fReceipt').checked,
      note: $('fNote').value
    };
    var errs = L.validateDonation(candidate, ASOF);
    var box = $('formErrors');
    if (errs.length) {
      box.textContent = errs.map(function (c) { return t(c); }).join(' ');
      return;
    }
    if (editingId) {
      var res = L.updateDonation(state.donations, editingId, candidate, ASOF);
      if (!res.ok) { box.textContent = res.errors.map(function (c) { return t(c); }).join(' '); return; }
      state.donations = res.list;
    } else {
      var res2 = L.addDonation(state.donations, candidate, ASOF);
      if (!res2.ok) { box.textContent = res2.errors.map(function (c) { return t(c); }).join(' '); return; }
      state.donations = res2.list;
    }
    save();
    resetForm();
    buildSelects();
    renderAll();
  }

  function onExport() {
    var blob = new Blob([JSON.stringify(L.buildExport(state.donations), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'donation-tracker-bd-export-' + ASOF + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function onImport() {
    var file = $('importFile').files[0];
    var msg = $('dataMsg');
    if (!file) { msg.textContent = t('importFail'); msg.classList.remove('ok'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var res = L.validateImport(JSON.parse(reader.result), L.todayStr());
        if (!res.ok) { msg.textContent = t('importFail') + ' (' + res.errors.slice(0, 3).join(', ') + ')'; msg.classList.remove('ok'); return; }
        state.donations = res.donations;
        save(); buildSelects(); renderAll();
        msg.textContent = t('importOk'); msg.classList.add('ok');
      } catch (e) {
        msg.textContent = t('importFail'); msg.classList.remove('ok');
      }
    };
    reader.readAsText(file);
  }

  function onErase() {
    var msg = $('dataMsg');
    if ($('eraseInput').value !== 'DELETE') { msg.textContent = t('eraseWrong'); msg.classList.remove('ok'); return; }
    state.donations = [];
    save(); buildSelects(); renderAll();
    $('eraseInput').value = '';
    msg.textContent = t('erased'); msg.classList.add('ok');
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      var active = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
  }

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });
  $('langBtn').addEventListener('click', function () {
    lang = lang === 'en' ? 'bn' : 'en';
    try { window.localStorage.setItem(LS_LANG, lang); } catch (e) { /* ignore */ }
    applyLang();
  });
  $('donationForm').addEventListener('submit', onSubmit);
  $('clearFormBtn').addEventListener('click', resetForm);
  $('cancelEditBtn').addEventListener('click', resetForm);
  ['fSearch', 'fFilterCategory', 'fFilterYear', 'fSort'].forEach(function (id) {
    $(id).addEventListener('input', renderList);
    $(id).addEventListener('change', renderList);
  });
  $('exportBtn').addEventListener('click', onExport);
  $('importBtn').addEventListener('click', onImport);
  $('eraseBtn').addEventListener('click', onErase);

  load();
  applyLang();
  resetForm();
  renderAll();
})();
