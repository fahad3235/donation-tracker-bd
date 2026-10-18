'use strict';
/*
 * donation-tracker-bd - pure logic (no DOM). Works in browser (window.DonationLogic)
 * and in Node (module.exports) so the same code is unit-tested.
 *
 * Money is integer paisa (1 BDT = 100 paisa) - no float error.
 * Dates are ISO YYYY-MM-DD strings, compared lexicographically (UTC-safe).
 */
(function (root) {
  var CATEGORIES = ['Zakat', 'Sadaqah', 'Fitrana', 'Qurbani', 'General', 'Other'];
  var METHODS = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank transfer', 'Card', 'Other'];
  var APP_ID = 'donation-tracker-bd';
  var EXPORT_VERSION = 1;
  var MAX_PAISA = 100000000 * 100; // 100,000,000 BDT cap per donation
  var MAX_NOTE = 200;
  var MAX_RECIPIENT = 100;

  // Bengali digits 0-9: U+09E6..U+09EF
  var BN_DIGIT = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA',
                  '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];
  var TAKA_SIGN = '\u09F3'; // TAKA SIGN

  function toAsciiDigits(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var idx = BN_DIGIT.indexOf(ch);
      out += idx >= 0 ? String(idx) : ch;
    }
    return out;
  }

  function toBnDigits(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      out += (ch >= '0' && ch <= '9') ? BN_DIGIT[ch.charCodeAt(0) - 48] : ch;
    }
    return out;
  }

  function groupThousands(intStr) {
    // Western grouping: 1500000 -> 1,500,000
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Parse a user-typed amount ("1,500.50", Bengali digits, or with Taka sign) -> paisa int, or null.
  function parseAmount(str) {
    if (typeof str !== 'string') return null;
    var s = toAsciiDigits(str).replace(/\s+/g, '');
    s = s.split(TAKA_SIGN).join('');
    s = s.replace(/,/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split('.');
    var taka = parseInt(parts[0], 10);
    var frac = parts.length > 1 ? parts[1] : '';
    while (frac.length < 2) frac += '0';
    var paisa = taka * 100 + parseInt(frac, 10);
    if (!isFinite(paisa) || paisa < 0 || paisa > MAX_PAISA) return null;
    return paisa;
  }

  // Format integer paisa. lang 'en' -> Taka sign + 1,500.50; 'bn' -> Bengali digits.
  function formatMoney(paisa, lang) {
    var neg = paisa < 0;
    var abs = Math.abs(paisa);
    var taka = Math.floor(abs / 100);
    var frac = abs % 100;
    var out = TAKA_SIGN + groupThousands(String(taka)) + '.' + (frac < 10 ? '0' : '') + frac;
    if (neg) out = '-' + out;
    return lang === 'bn' ? toBnDigits(out) : out;
  }

  function isValidDate(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var y = parseInt(iso.slice(0, 4), 10);
    var m = parseInt(iso.slice(5, 7), 10);
    var d = parseInt(iso.slice(8, 10), 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function todayStr() {
    var n = new Date();
    var y = n.getFullYear();
    var m = n.getMonth() + 1;
    var d = n.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  // Validate a donation object. Returns array of error codes (empty = valid).
  function validateDonation(d, today) {
    var errs = [];
    var t = today || todayStr();
    if (!d || typeof d !== 'object') return ['ERR_DONATION'];
    if (typeof d.recipient !== 'string' || d.recipient.trim().length === 0 ||
        d.recipient.trim().length > MAX_RECIPIENT) errs.push('ERR_RECIPIENT');
    if (!isValidDate(d.date)) errs.push('ERR_DATE');
    else if (d.date > t) errs.push('ERR_DATE_FUTURE');
    if (CATEGORIES.indexOf(d.category) < 0) errs.push('ERR_CATEGORY');
    if (typeof d.amountPaisa !== 'number' || Math.floor(d.amountPaisa) !== d.amountPaisa ||
        d.amountPaisa <= 0 || d.amountPaisa > MAX_PAISA) errs.push('ERR_AMOUNT');
    if (METHODS.indexOf(d.method) < 0) errs.push('ERR_METHOD');
    if (typeof d.receipt !== 'boolean') errs.push('ERR_RECEIPT');
    if (typeof d.note !== 'string' || d.note.length > MAX_NOTE) errs.push('ERR_NOTE');
    return errs;
  }

  var _idCounter = 0;
  function newId() {
    _idCounter += 1;
    return 'don_' + Date.now().toString(36) + '_' + _idCounter;
  }

  function cloneDonation(d) {
    return {
      id: d.id, date: d.date, recipient: d.recipient, category: d.category,
      amountPaisa: d.amountPaisa, method: d.method, receipt: d.receipt, note: d.note
    };
  }

  function addDonation(list, d, today) {
    var errs = validateDonation(d, today);
    if (errs.length) return { ok: false, errors: errs };
    var item = cloneDonation(d);
    if (!item.id) item.id = newId();
    var next = list.slice();
    next.push(item);
    return { ok: true, list: next, donation: item };
  }

  function updateDonation(list, id, patch, today) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, errors: ['ERR_NOT_FOUND'] };
    var merged = cloneDonation(list[idx]);
    var keys = ['date', 'recipient', 'category', 'amountPaisa', 'method', 'receipt', 'note'];
    for (var k = 0; k < keys.length; k++) {
      if (Object.prototype.hasOwnProperty.call(patch, keys[k])) merged[keys[k]] = patch[keys[k]];
    }
    var errs = validateDonation(merged, today);
    if (errs.length) return { ok: false, errors: errs };
    var next = list.slice();
    next[idx] = merged;
    return { ok: true, list: next, donation: merged };
  }

  function deleteDonation(list, id) {
    return list.filter(function (d) { return d.id !== id; });
  }

  function monthKey(iso) { return iso.slice(0, 7); }

  function last12Months(asOf) {
    var y = parseInt(asOf.slice(0, 4), 10);
    var m = parseInt(asOf.slice(5, 7), 10);
    var out = [];
    for (var i = 11; i >= 0; i--) {
      var total = (y * 12 + (m - 1)) - i;
      var yy = Math.floor(total / 12);
      var mm = (total % 12) + 1;
      out.push(yy + '-' + (mm < 10 ? '0' : '') + mm);
    }
    return out;
  }

  function summarize(list, asOf) {
    var a = asOf || todayStr();
    var year = a.slice(0, 4);
    var month = a.slice(0, 7);
    var s = {
      total: 0, count: list.length, thisYear: 0, thisMonth: 0,
      byCategory: {}, topRecipient: null, topRecipientTotal: 0,
      monthly: [], byYear: []
    };
    CATEGORIES.forEach(function (c) { s.byCategory[c] = { total: 0, count: 0, share: 0 }; });
    var byRec = {};
    var byMonthMap = {};
    var byYearMap = {};
    list.forEach(function (d) {
      s.total += d.amountPaisa;
      if (d.date.slice(0, 4) === year) s.thisYear += d.amountPaisa;
      if (monthKey(d.date) === month) s.thisMonth += d.amountPaisa;
      var cat = s.byCategory[d.category];
      cat.total += d.amountPaisa;
      cat.count += 1;
      var key = d.recipient.trim();
      byRec[key] = (byRec[key] || 0) + d.amountPaisa;
      byMonthMap[monthKey(d.date)] = (byMonthMap[monthKey(d.date)] || 0) + d.amountPaisa;
      var yk = d.date.slice(0, 4);
      if (!byYearMap[yk]) byYearMap[yk] = { total: 0, count: 0 };
      byYearMap[yk].total += d.amountPaisa;
      byYearMap[yk].count += 1;
    });
    CATEGORIES.forEach(function (c) {
      s.byCategory[c].share = s.total > 0 ? (s.byCategory[c].total / s.total) * 100 : 0;
    });
    Object.keys(byRec).forEach(function (r) {
      if (byRec[r] > s.topRecipientTotal) { s.topRecipientTotal = byRec[r]; s.topRecipient = r; }
    });
    s.monthly = last12Months(a).map(function (mk) {
      return { month: mk, total: byMonthMap[mk] || 0 };
    });
    s.byYear = Object.keys(byYearMap).sort().reverse().map(function (yk) {
      return { year: yk, total: byYearMap[yk].total, count: byYearMap[yk].count };
    });
    return s;
  }

  // opts: {category:'All'|<cat>, year:'All'|'YYYY', query:'', sort:'date-desc'|...}
  function filterDonations(list, opts) {
    var o = opts || {};
    var q = (o.query || '').trim().toLowerCase();
    var out = list.filter(function (d) {
      if (o.category && o.category !== 'All' && d.category !== o.category) return false;
      if (o.year && o.year !== 'All' && d.date.slice(0, 4) !== o.year) return false;
      if (q) {
        var hay = (d.recipient + ' ' + d.note + ' ' + d.category).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var sort = o.sort || 'date-desc';
    out.sort(function (a, b) {
      if (sort === 'date-asc') return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
      if (sort === 'amount-desc') return b.amountPaisa - a.amountPaisa;
      if (sort === 'amount-asc') return a.amountPaisa - b.amountPaisa;
      return a.date > b.date ? -1 : (a.date < b.date ? 1 : 0); // date-desc default
    });
    return out;
  }

  function buildExport(list) {
    return { app: APP_ID, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), donations: list.map(cloneDonation) };
  }

  // Strict import validation. Returns {ok, donations} or {ok:false, errors:[codes]}.
  function validateImport(obj, today) {
    var errs = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['ERR_IMPORT_NOT_OBJECT'] };
    if (obj.app !== APP_ID) errs.push('ERR_IMPORT_APP');
    if (obj.version !== EXPORT_VERSION) errs.push('ERR_IMPORT_VERSION');
    if (!Array.isArray(obj.donations)) return { ok: false, errors: errs.concat(['ERR_IMPORT_DONATIONS']) };
    var seen = {};
    var clean = [];
    obj.donations.forEach(function (d, i) {
      if (!d || typeof d !== 'object') { errs.push('ERR_IMPORT_ITEM_' + i); return; }
      if (typeof d.id !== 'string' || d.id.length === 0) { errs.push('ERR_IMPORT_ID_' + i); return; }
      if (seen[d.id]) { errs.push('ERR_IMPORT_DUP_ID_' + i); return; }
      seen[d.id] = true;
      var v = validateDonation(d, today);
      if (v.length) { errs.push('ERR_IMPORT_ITEM_' + i + ':' + v.join(',')); return; }
      clean.push(cloneDonation(d));
    });
    if (errs.length) return { ok: false, errors: errs };
    return { ok: true, donations: clean };
  }

  var api = {
    CATEGORIES: CATEGORIES, METHODS: METHODS, APP_ID: APP_ID, EXPORT_VERSION: EXPORT_VERSION,
    MAX_PAISA: MAX_PAISA, MAX_NOTE: MAX_NOTE, MAX_RECIPIENT: MAX_RECIPIENT,
    parseAmount: parseAmount, formatMoney: formatMoney, isValidDate: isValidDate,
    todayStr: todayStr, validateDonation: validateDonation, addDonation: addDonation,
    updateDonation: updateDonation, deleteDonation: deleteDonation,
    summarize: summarize, filterDonations: filterDonations,
    buildExport: buildExport, validateImport: validateImport,
    toAsciiDigits: toAsciiDigits, toBnDigits: toBnDigits
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DonationLogic = api;
})(typeof window !== 'undefined' ? window : this);
