/**
 * Modul: Bruchzahlen-Formatierung-Test (fraction_quantities-Präferenz)
 * Zweck: formatQuantityFractions() - reine Funktion, kein DOM/Server nötig.
 * Ausführen: node --test test/test-fraction-format.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { formatQuantityFractions } from '../public/utils/fraction.js';

test('exakte Brüche: Hälften/Drittel/Viertel/Achtel treffen ihren Glyph genau', () => {
  assert.equal(formatQuantityFractions('1.5 cups'), '1½ cups');
  assert.equal(formatQuantityFractions('0.5 tsp'), '½ tsp');
  assert.equal(formatQuantityFractions('2.333333 cups'), '2⅓ cups');
  assert.equal(formatQuantityFractions('0.666667 cups'), '⅔ cups');
  assert.equal(formatQuantityFractions('0.25 tsp'), '¼ tsp');
  assert.equal(formatQuantityFractions('1.75 cups'), '1¾ cups');
  assert.equal(formatQuantityFractions('0.125 cup'), '⅛ cup');
  assert.equal(formatQuantityFractions('0.375 cup'), '⅜ cup');
  assert.equal(formatQuantityFractions('0.625 cup'), '⅝ cup');
  assert.equal(formatQuantityFractions('0.875 cup'), '⅞ cup');
});

test('rundet einen unrunden Dezimalwert auf die nächste Koch-Bruchzahl (0.4 → 3/8)', () => {
  // 0.4 liegt 0.025 von 3/8 (0.375) und 0.067 von 1/3 (0.333) entfernt -
  // gegen die Rundungstabelle im Modul-Kommentar ist 3/8 am nächsten.
  assert.equal(formatQuantityFractions('0.4 cups'), '⅜ cups');
});

test('trägt in die nächste ganze Zahl, wenn der Bruchteil zu 1 rundet', () => {
  assert.equal(formatQuantityFractions('1.97 cups'), '2 cups');
  assert.equal(formatQuantityFractions('0.99'), '1');
});

test('ganze Zahlen ohne Rest bleiben ganzzahlig ("2.0" → "2")', () => {
  assert.equal(formatQuantityFractions('2.0 L'), '2 L');
  assert.equal(formatQuantityFractions('3.00 kg'), '3 kg');
});

test('mehrere Dezimalzahlen im selben String werden einzeln ersetzt', () => {
  assert.equal(formatQuantityFractions('2 x 0.5 L'), '2 x ½ L');
  assert.equal(formatQuantityFractions('1.5 cups flour, 0.25 cup sugar'), '1½ cups flour, ¼ cup sugar');
});

test('nicht-numerischer und ganzzahliger Text bleibt unverändert', () => {
  assert.equal(formatQuantityFractions('3'), '3');
  assert.equal(formatQuantityFractions('pinch'), 'pinch');
  assert.equal(formatQuantityFractions('to taste'), 'to taste');
  assert.equal(formatQuantityFractions('½ cup'), '½ cup');
});

test('leere/fehlende Eingabe liefert leeren String', () => {
  assert.equal(formatQuantityFractions(''), '');
  assert.equal(formatQuantityFractions(null), '');
  assert.equal(formatQuantityFractions(undefined), '');
});
