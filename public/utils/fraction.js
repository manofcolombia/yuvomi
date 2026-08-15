/**
 * Modul: Bruchzahlen-Anzeige für Mengenangaben (fraction_quantities-Präferenz)
 * Zweck: Dezimale Mengen in Freitext ("1.5 cups", "0.25 tsp", "2 x 0.5 L") in
 *        gemischte Zahlen mit Unicode-Bruchglyphen umschreiben (1½ statt 1.5),
 *        wie es Kochrezepte üblicherweise notieren.
 * Abhängigkeiten: keine (bewusst frei von DOM und i18n, damit direkt testbar
 *        und von server- wie clientseitigem Code importierbar).
 *
 * Rundungstabelle: Kochmaße kennen praktisch nie Zwölftel oder Sechzehntel -
 * Messbecher/-löffel sind in Achteln, Dritteln und Vierteln geteilt. Der
 * Bruchteil jeder gefundenen Dezimalzahl wird auf den NÄCHSTGELEGENEN Wert
 * aus dieser Menge gerundet (kein Abschneiden, kein Aufrunden):
 *
 *   0    → (kein Glyph, ganze Zahl bleibt stehen)
 *   1/8  → ⅛
 *   1/4  → ¼
 *   1/3  → ⅓
 *   3/8  → ⅜
 *   1/2  → ½
 *   5/8  → ⅝
 *   2/3  → ⅔
 *   3/4  → ¾
 *   7/8  → ⅞
 *   1    → trägt in die nächste ganze Zahl (z. B. 1.97 → "2")
 *
 * Beispiel: 0.4 liegt 0.025 von 3/8 (0.375) und 0.067 von 1/3 (0.333)
 * entfernt - am nächsten ist 3/8, also wird daraus "⅜".
 */

// Nur Token, die tatsächlich einen Dezimalpunkt tragen - ganze Zahlen ("3"),
// Einheitswörter ("pinch") und bereits vorhandene Bruchglyphen bleiben unberührt.
const DECIMAL_TOKEN_RE = /\d+\.\d+/g;

const COOKING_FRACTIONS = [
  { value: 0, glyph: null },
  { value: 1 / 8, glyph: '⅛' },
  { value: 1 / 4, glyph: '¼' },
  { value: 1 / 3, glyph: '⅓' },
  { value: 3 / 8, glyph: '⅜' },
  { value: 1 / 2, glyph: '½' },
  { value: 5 / 8, glyph: '⅝' },
  { value: 2 / 3, glyph: '⅔' },
  { value: 3 / 4, glyph: '¾' },
  { value: 7 / 8, glyph: '⅞' },
  // value 1 hat absichtlich kein Glyph: statt "1"-Glyph trägt der Bruchteil
  // in die nächste ganze Zahl (Carry), siehe formatDecimalToken().
  { value: 1, glyph: null },
];

/** Findet den Eintrag aus COOKING_FRACTIONS, dessen Wert `frac` am nächsten liegt. */
function nearestCookingFraction(frac) {
  let best = COOKING_FRACTIONS[0];
  let bestDistance = Math.abs(frac - best.value);
  for (const candidate of COOKING_FRACTIONS) {
    const distance = Math.abs(frac - candidate.value);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Wandelt ein einzelnes "N.M"-Token in eine gemischte Zahl mit Bruchglyph um. */
function formatDecimalToken(token) {
  const value = Number(token);
  const whole = Math.trunc(value);
  const frac = value - whole;
  const nearest = nearestCookingFraction(frac);
  // nearest.value === 1 heißt: der Bruchteil rundet zur nächsten ganzen Zahl.
  const finalWhole = whole + (nearest.value === 1 ? 1 : 0);
  if (nearest.glyph === null) return String(finalWhole);
  return finalWhole > 0 ? `${finalWhole}${nearest.glyph}` : nearest.glyph;
}

/**
 * Ersetzt jedes Dezimalzahl-Token (`/\d+\.\d+/`) in `text` durch eine gemischte
 * Zahl mit Unicode-Bruchglyph, gerundet auf die nächste Koch-Bruchzahl (siehe
 * Modul-Kommentar). Alles andere - ganze Zahlen, Einheiten, bereits vorhandene
 * Brüche, nicht-numerischer Text - bleibt unverändert.
 *
 * @param {string} text Freitext-Mengenangabe, z. B. "1.5 cups", "2 x 0.5 L".
 * @returns {string} Text mit Bruchglyphen statt Dezimalzahlen; '' bei leerer/
 *   fehlender Eingabe.
 */
export function formatQuantityFractions(text) {
  if (!text) return '';
  return String(text).replace(DECIMAL_TOKEN_RE, formatDecimalToken);
}
