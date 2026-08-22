/**
 * Test: Kategorie-Beschriftung im Frontend (#783)
 * Zweck: Eine Seed-Kategorie traegt ihren Namen nicht in `name`, sondern als
 *        i18n-Key in `label_key` (inventory: Migration 143, tasks: 83,
 *        contacts: analog) - `name` ist dort NULL. Wer das Label roh aus
 *        `name` liest, rendert eine LEERE Beschriftung: genau so stand die
 *        Kategorie-Auswahl im Gegenstands-Formular unbeschriftet da (#783).
 *        Geprueft wird beides: das Verhalten der Auswahl-Erzeugung und - als
 *        Regel ueber alle Seiten, nicht als Liste bekannter Fundstellen - dass
 *        keine Seite mit label_key-Kategorien ein <option>-Label direkt aus
 *        `.name` speist.
 * Ausfuehren: node --loader ./test/test-browser-loader.mjs --test test/test-inventory-category-labels.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { withoutBlockComments } from './source-text.js';

const { __test: inventory } = await import('../public/pages/inventory.js');

// Wie die API sie liefert (siehe test:inventory-categories-routes): Seed-Zeilen
// mit label_key und name = NULL, Custom-Zeilen mit name und label_key = NULL.
const SEED = [
  { key: 'electronics', name: null, label_key: 'inventory.categoryElectronics', icon: 'cpu' },
  { key: 'vehicles',    name: null, label_key: 'inventory.categoryVehicles',    icon: 'car' },
  { key: 'household',   name: null, label_key: 'inventory.categoryHousehold',   icon: 'home' },
  { key: 'sports',      name: null, label_key: 'inventory.categorySports',      icon: 'dumbbell' },
  { key: 'other',       name: null, label_key: 'inventory.categoryOther',       icon: 'package' },
];
const CUSTOM = { key: 'werkzeug', name: 'Werkzeug', label_key: null, icon: 'wrench' };

/** Beschriftungen aus einer <option>-Liste ziehen (leere Labels bleiben sichtbar). */
function optionLabels(html) {
  return [...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)]
    .map((m) => ({ value: m[1], label: m[2] }));
}

test('die Kategorie-Auswahl beschriftet Seed-Kategorien (name = NULL) nicht leer', () => {
  const options = optionLabels(inventory.categoryOptionsHtml(SEED));
  assert.equal(options.length, SEED.length, 'jede Kategorie ergibt genau eine Option');
  for (const { value, label } of options) {
    assert.notEqual(label, '', `Kategorie "${value}" steht ohne Beschriftung in der Auswahl`);
  }
  // t() liefert im Test den Key zurueck - das Label muss aus label_key kommen
  // und nicht aus einem Rueckfall auf den technischen Key.
  assert.deepEqual(options.map((o) => o.label), SEED.map((c) => c.label_key));
});

test('die Kategorie-Auswahl beschriftet Custom-Kategorien mit ihrem Namen', () => {
  const options = optionLabels(inventory.categoryOptionsHtml([CUSTOM]));
  assert.deepEqual(options, [{ value: 'werkzeug', label: 'Werkzeug' }]);
});

test('die Auswahl behaelt Reihenfolge und Key als Wert (die Vorauswahl haengt am Key)', () => {
  const options = optionLabels(inventory.categoryOptionsHtml([...SEED, CUSTOM]));
  assert.deepEqual(options.map((o) => o.value), [...SEED.map((c) => c.key), CUSTOM.key]);
});

test('categoryLabel faellt der Reihe nach auf label_key, name, key zurueck', () => {
  assert.equal(inventory.categoryLabel({ key: 'other', name: null, label_key: 'inventory.categoryOther' }),
    'inventory.categoryOther');
  assert.equal(inventory.categoryLabel({ key: 'werkzeug', name: 'Werkzeug', label_key: null }), 'Werkzeug');
  assert.equal(inventory.categoryLabel({ key: 'unbekannt', name: null, label_key: null }), 'unbekannt');
  assert.equal(inventory.categoryLabel(null), '');
});

test('itemCategoryLabel loest die denormalisierten Item-Felder gleich auf', () => {
  assert.equal(inventory.itemCategoryLabel({ category: 'other', category_name: null, category_label_key: 'inventory.categoryOther' }),
    'inventory.categoryOther');
  assert.equal(inventory.itemCategoryLabel({ category: 'werkzeug', category_name: 'Werkzeug', category_label_key: null }),
    'Werkzeug');
  assert.equal(inventory.itemCategoryLabel({ category: 'weg', category_name: null, category_label_key: null }), 'weg');
});

// Regel statt Fundstellen-Liste: welche Seiten label_key-Kategorien fuehren,
// wird aus dem Quelltext ABGELEITET - ein neues Modul mit lokalisierten
// Kategorien faellt damit automatisch unter die Regel, statt an einer Allowlist
// vorbeizulaufen.
const pagesDir = new URL('../public/pages/', import.meta.url);
const localizedPages = readdirSync(pagesDir)
  .filter((f) => f.endsWith('.js'))
  // Kommentare raus, bevor der Guard liest: ein Kommentar, der `label_key` oder
  // `.name` erwaehnt, ist keine Regel (siehe Kopf von test/source-text.js).
  .map((f) => ({
    file: f,
    src: withoutBlockComments(readFileSync(new URL(f, pagesDir), 'utf8')).replace(/^\s*\/\/.*$/gm, ''),
  }))
  .filter(({ src }) => /label_key/.test(src));

test('mindestens die drei bekannten Seiten mit lokalisierten Kategorien werden erfasst', () => {
  const files = localizedPages.map((p) => p.file).sort();
  for (const expected of ['contacts.js', 'inventory.js', 'tasks.js']) {
    assert.ok(files.includes(expected), `${expected} fuehrt label_key-Kategorien, wird aber nicht geprueft - `
      + 'der Ableitungs-Filter greift nicht mehr');
  }
});

for (const { file, src } of localizedPages) {
  test(`${file}: kein <option>-Label kommt roh aus .name`, () => {
    const options = [...src.matchAll(/<option\s+value="\$\{esc\((\w+)\.key\)\}"[^>]*>([\s\S]*?)<\/option>/g)];
    assert.ok(options.length > 0, `keine Kategorie-Options in ${file} gefunden - das Muster greift nicht mehr`);
    for (const [, variable, label] of options) {
      assert.ok(!new RegExp(`\\b${variable}\\.name\\b`).test(label),
        `${file}: die Option liest ihr Label direkt aus ${variable}.name - bei einer Seed-Kategorie `
        + 'ist name NULL und die Beschriftung bleibt leer (#783). Ueber den Label-Resolver gehen.');
    }
  });
}
