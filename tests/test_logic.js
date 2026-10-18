'use strict';
/* donation-tracker-bd — Node unit tests for js/logic.js (no DOM). */
var assert = require('assert');
var L = require('../js/logic.js');

var passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('ok - ' + name);
}

// Bengali digits 1,5,0,0 . 5,0 as \u escapes (ASCII source)
var BN_1500_50 = '\u09E7\u09EB\u09E6\u09E6.\u09EB\u09E6';
var TAKA = '\u09F3';

check('parseAmount western', function () {
  assert.strictEqual(L.parseAmount('1,500.50'), 150050);
  assert.strictEqual(L.parseAmount('1500'), 150000);
  assert.strictEqual(L.parseAmount('1500.5'), 150050);
  assert.strictEqual(L.parseAmount('  2,500  '), 250000);
  assert.strictEqual(L.parseAmount(TAKA + '1500'), 150000);
});
check('parseAmount Bengali digits', function () {
  assert.strictEqual(L.parseAmount(BN_1500_50), 150050);
  assert.strictEqual(L.parseAmount('\u09E7\u09E6\u09E6\u09E6'), 100000);
});
check('parseAmount invalid', function () {
  assert.strictEqual(L.parseAmount(''), null);
  assert.strictEqual(L.parseAmount('abc'), null);
  assert.strictEqual(L.parseAmount('10.555'), null);
  assert.strictEqual(L.parseAmount('-5'), null);
  assert.strictEqual(L.parseAmount('10.5.2'), null);
  assert.strictEqual(L.parseAmount('100000001'), null); // over cap
  assert.strictEqual(L.parseAmount(null), null);
});
check('formatMoney en', function () {
  assert.strictEqual(L.formatMoney(150050, 'en'), TAKA + '1,500.50');
  assert.strictEqual(L.formatMoney(0, 'en'), TAKA + '0.00');
  assert.strictEqual(L.formatMoney(100000000 * 100, 'en'), TAKA + '100,000,000.00');
});
check('formatMoney bn digits', function () {
  // 1,500.50 in Bengali digits: ১,৫০০.৫০
  assert.strictEqual(L.formatMoney(150050, 'bn'), TAKA + '\u09E7,\u09EB\u09E6\u09E6.\u09EB\u09E6');
  assert.strictEqual(L.formatMoney(0, 'bn'), TAKA + '\u09E6.\u09E6\u09E6');
});
check('isValidDate', function () {
  assert.strictEqual(L.isValidDate('2026-02-29'), false); // 2026 not leap
  assert.strictEqual(L.isValidDate('2024-02-29'), true); // leap
  assert.strictEqual(L.isValidDate('2026-13-01'), false);
  assert.strictEqual(L.isValidDate('2026-10-18'), true);
  assert.strictEqual(L.isValidDate('18-10-2026'), false);
});

var TODAY = '2026-10-18';
function mk(over) {
  var d = { id: 'x1', date: '2026-10-01', recipient: 'Masjid', category: 'Zakat',
    amountPaisa: 500000, method: 'Cash', receipt: false, note: '' };
  Object.keys(over || {}).forEach(function (k) { d[k] = over[k]; });
  return d;
}
check('validateDonation valid + each error', function () {
  assert.deepStrictEqual(L.validateDonation(mk(), TODAY), []);
  assert.deepStrictEqual(L.validateDonation(mk({ recipient: '  ' }), TODAY), ['ERR_RECIPIENT']);
  assert.deepStrictEqual(L.validateDonation(mk({ recipient: 'x'.repeat(101) }), TODAY), ['ERR_RECIPIENT']);
  assert.deepStrictEqual(L.validateDonation(mk({ date: '2026-10-19' }), TODAY), ['ERR_DATE_FUTURE']);
  assert.deepStrictEqual(L.validateDonation(mk({ date: '2026-13-01' }), TODAY), ['ERR_DATE']);
  assert.deepStrictEqual(L.validateDonation(mk({ category: 'Nope' }), TODAY), ['ERR_CATEGORY']);
  assert.deepStrictEqual(L.validateDonation(mk({ amountPaisa: 0 }), TODAY), ['ERR_AMOUNT']);
  assert.deepStrictEqual(L.validateDonation(mk({ amountPaisa: 10.5 }), TODAY), ['ERR_AMOUNT']);
  assert.deepStrictEqual(L.validateDonation(mk({ method: 'Barter' }), TODAY), ['ERR_METHOD']);
  assert.deepStrictEqual(L.validateDonation(mk({ receipt: 'yes' }), TODAY), ['ERR_RECEIPT']);
  assert.deepStrictEqual(L.validateDonation(mk({ note: 'x'.repeat(201) }), TODAY), ['ERR_NOTE']);
  assert.deepStrictEqual(L.validateDonation(mk({ note: 'x'.repeat(200) }), TODAY), []);
});

check('add/update/delete round-trip', function () {
  var list = [];
  var r1 = L.addDonation(list, mk({ id: undefined }), TODAY);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.list.length, 1);
  assert.strictEqual(list.length, 0); // input not mutated
  var rBad = L.addDonation(r1.list, mk({ amountPaisa: 0 }), TODAY);
  assert.strictEqual(rBad.ok, false);
  var r2 = L.updateDonation(r1.list, r1.donation.id, { amountPaisa: 750050 }, TODAY);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.donation.amountPaisa, 750050);
  var r3 = L.updateDonation(r1.list, 'missing', { amountPaisa: 1 }, TODAY);
  assert.strictEqual(r3.ok, false);
  assert.strictEqual(L.deleteDonation(r2.list, r1.donation.id).length, 0);
});

check('summarize hand-verified scenario', function () {
  var list = [
    mk({ id: 'a', date: '2026-10-01', recipient: 'Masjid', category: 'Zakat', amountPaisa: 500000 }),
    mk({ id: 'b', date: '2026-10-15', recipient: 'Orphanage', category: 'Sadaqah', amountPaisa: 250050 }),
    mk({ id: 'c', date: '2025-12-20', recipient: 'Masjid', category: 'Zakat', amountPaisa: 100000 })
  ];
  var s = L.summarize(list, TODAY);
  assert.strictEqual(s.total, 850050);
  assert.strictEqual(s.thisYear, 750050);
  assert.strictEqual(s.thisMonth, 750050);
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.byCategory.Zakat.total, 600000);
  assert.strictEqual(s.byCategory.Zakat.count, 2);
  assert.strictEqual(s.byCategory.Sadaqah.total, 250050);
  assert.strictEqual(s.byCategory.Fitrana.total, 0);
  assert.strictEqual(s.topRecipient, 'Masjid');
  assert.strictEqual(s.topRecipientTotal, 600000);
  assert.strictEqual(s.monthly.length, 12);
  assert.strictEqual(s.monthly[11].month, '2026-10');
  assert.strictEqual(s.monthly[11].total, 750050);
  assert.strictEqual(s.monthly[10].month, '2026-09');
  assert.strictEqual(s.monthly[10].total, 0);
  assert.deepStrictEqual(s.byYear, [
    { year: '2026', total: 750050, count: 2 },
    { year: '2025', total: 100000, count: 1 }
  ]);
  // share: 600000/850050 = 70.588...%
  assert.ok(Math.abs(s.byCategory.Zakat.share - 70.588) < 0.01);
  var empty = L.summarize([], TODAY);
  assert.strictEqual(empty.total, 0);
  assert.strictEqual(empty.topRecipient, null);
  assert.strictEqual(empty.byCategory.Zakat.share, 0);
});

check('filterDonations', function () {
  var list = [
    mk({ id: 'a', date: '2026-10-01', recipient: 'Masjid', category: 'Zakat', amountPaisa: 500000 }),
    mk({ id: 'b', date: '2026-10-15', recipient: 'Orphanage', category: 'Sadaqah', amountPaisa: 250050, note: 'eid help' }),
    mk({ id: 'c', date: '2025-12-20', recipient: 'Masjid', category: 'Zakat', amountPaisa: 100000 })
  ];
  assert.strictEqual(L.filterDonations(list, { category: 'Zakat' }).length, 2);
  assert.strictEqual(L.filterDonations(list, { year: '2025' }).length, 1);
  assert.strictEqual(L.filterDonations(list, { query: 'orphan' }).length, 1);
  assert.strictEqual(L.filterDonations(list, { query: 'EID' }).length, 1); // case-insensitive, note field
  assert.strictEqual(L.filterDonations(list, { query: 'masjid' }).length, 2);
  var asc = L.filterDonations(list, { sort: 'amount-asc' });
  assert.strictEqual(asc[0].id, 'c');
  assert.strictEqual(asc[2].id, 'a');
  var desc = L.filterDonations(list, {});
  assert.strictEqual(desc[0].id, 'b'); // newest date first
  assert.strictEqual(L.filterDonations(list, { category: 'Qurbani' }).length, 0);
});

check('export/import round-trip', function () {
  var list = [mk({ id: 'a' })];
  var env = L.buildExport(list);
  assert.strictEqual(env.app, 'donation-tracker-bd');
  assert.strictEqual(env.version, 1);
  var res = L.validateImport(JSON.parse(JSON.stringify(env)), TODAY);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.donations, list);
});

check('validateImport rejects malformed', function () {
  var good = L.buildExport([mk({ id: 'a' })]);
  function bad(mut) {
    var copy = JSON.parse(JSON.stringify(good));
    mut(copy);
    var res = L.validateImport(copy, TODAY);
    assert.strictEqual(res.ok, false, JSON.stringify(mut));
  }
  bad(function (o) { o.app = 'other-app'; });
  bad(function (o) { o.version = 2; });
  bad(function (o) { delete o.donations; });
  bad(function (o) { o.donations = 'nope'; });
  bad(function (o) { o.donations.push(mk({ id: 'a' })); }); // duplicate id
  bad(function (o) { o.donations[0].id = ''; });
  bad(function (o) { o.donations[0].amountPaisa = -5; });
  bad(function (o) { o.donations[0].date = '2030-01-01'; }); // future vs TODAY
  bad(function (o) { o.donations[0].category = 'Bogus'; });
  bad(function (o) { o.donations[0].note = 'x'.repeat(201); });
  bad(function (o) { o.donations[0].receipt = 1; });
  bad(function (o) { o.donations[0].recipient = ''; });
  assert.strictEqual(L.validateImport(null, TODAY).ok, false);
  assert.strictEqual(L.validateImport([], TODAY).ok, false);
  assert.strictEqual(L.validateImport('str', TODAY).ok, false);
  // empty list is valid
  var e = L.validateImport({ app: 'donation-tracker-bd', version: 1, donations: [] }, TODAY);
  assert.strictEqual(e.ok, true);
  assert.deepStrictEqual(e.donations, []);
});

console.log('ALL ' + passed + ' TEST BLOCKS PASSED');
