/**
 * Modul: Geteilter Zutaten-Auswahl-Schritt vor dem Sprung auf eine Einkaufsliste
 * Zweck: Rezepte und Essensplan übertrugen bisher IMMER die komplette
 *        Zutatenliste in einem Schritt - keine Möglichkeit, die zwei Zutaten
 *        abzuwählen, die schon im Schrank stehen. Dieses Modul kapselt den
 *        fehlenden Zwischenschritt: eine Checkliste, aus der der Nutzer eine
 *        Teilmenge wählt, kombiniert mit der Listenauswahl im selben Dialog -
 *        statt zwei Dialoge nacheinander (erst Häkchen setzen, dann
 *        `resolveShoppingTarget()` fragen „Auf welche Liste?"), was einen
 *        zusätzlichen Klick und einen Kontextwechsel gekostet hätte.
 *
 * Vertrag von `selectIngredientsForShoppingList()`:
 *   - Löst NIE ab (spiegelt `resolveShoppingTarget()`/`selectModal()`): jeder
 *     Ausgang - Bestätigen, Abbrechen, Escape, Klick auf den Overlay - endet in
 *     `resolve()`, nie in `reject()`. Aufrufer brauchen kein try/catch.
 *   - `null` heißt „nichts weitermachen" und deckt drei Fälle ab: der Nutzer hat
 *     abgebrochen, ODER `ingredients` war leer (Aufruferfehler - siehe Kommentar
 *     an der Stelle, kein Toast, das bleibt Sache der aufrufenden Stelle wie
 *     heute), ODER `lists` war leer (rein defensiv: die Aufrufstelle soll das
 *     „noch keine Einkaufsliste"-Verhalten längst über `resolveShoppingTarget()`
 *     abgefangen haben, bevor sie hierher kommt).
 *   - Bei genau einer Liste entfällt die Listenauswahl im Dialog - dieselbe
 *     „eine Liste → keine Rückfrage"-Regel wie in `resolveShoppingTarget()`
 *     (kitchen-transfer.js), nur diesmal als eingebettetes `<select>` statt als
 *     zweiter Dialog.
 *   - Die zurückgegebenen `ingredientIds` sind die ORIGINALEN `id`-Werte aus
 *     `ingredients` (per Index zurückverfolgt, nicht aus dem DOM geparst) -
 *     damit bleibt der Typ erhalten, egal ob eine Zutat eine `recipe_ingredients`-
 *     oder `meal_ingredients`-PK trägt; dieses Modul unterscheidet die beiden
 *     nicht und muss es auch nicht.
 *   - Mengen werden als reiner Text gerendert. Bruchzahlen-Formatierung
 *     (`formatQuantityFractions()`, utils/fraction.js) ist bewusst NICHT
 *     importiert: nicht jeder Aufrufer will sie, und ein geteilter Baustein soll
 *     nicht erzwingen, was nur manche seiner Nutzer möchten. Wer sie will,
 *     formatiert `ingredients[].quantity` vor dem Aufruf selbst.
 */

import { t } from '/i18n.js';
import { esc } from '/utils/html.js';
import { openModal, closeModal, reportFieldError } from '/components/modal.js';

/**
 * Öffnet die geteilte Zutaten-Checkliste und (falls nötig) die Listenauswahl in
 * einem einzigen Dialog.
 *
 * @param {object} opts
 * @param {Array<{id: number|string, name: string, quantity?: string|null}>} opts.ingredients
 *        Auswählbare Zutaten. Alle Checkboxen starten angehakt - der Normalfall
 *        ist „fast alles senden, ein paar abwählen", nicht umgekehrt.
 * @param {Array<{id: number, name: string}>} opts.lists  Verfügbare Ziel-Listen.
 * @param {string} [opts.title]  Dialogtitel; Default `t('common.selectIngredients')`.
 * @returns {Promise<{listId: number, ingredientIds: Array<number|string>}|null>}
 *          `null` bei Abbruch oder wenn `ingredients`/`lists` leer sind (siehe
 *          Modul-Kommentar). Löst nie ab.
 */
export async function selectIngredientsForShoppingList({ ingredients, lists, title } = {}) {
  const items = Array.isArray(ingredients) ? ingredients : [];
  // Leere Zutatenliste ist ein Aufruferfehler, kein Nutzerzustand: jede
  // bestehende Übertragungsstelle meldet „nichts zu übertragen" bereits selbst
  // per Toast, bevor sie diese Funktion überhaupt aufrufen würde (siehe
  // recipes.js#transferRecipe's `toShoppingNoIngredients`). Diese Stelle bleibt
  // darum stumm und öffnet schlicht keinen Dialog ohne Inhalt.
  if (!items.length) return null;

  const available = Array.isArray(lists) ? lists : [];
  // Keine Einkaufsliste vorhanden: die Aufrufstelle hat dafür bereits
  // `resolveShoppingTarget()` durchlaufen (das den „noch keine Liste"-Toast samt
  // Ausweg besitzt), bevor sie hierher kommt. Ein leeres `lists` ist hier also
  // ein rein defensiver No-Op, kein UX-Pfad, den dieses Modul gestalten muss.
  if (!available.length) return null;

  const singleList = available.length === 1 ? available[0] : null;

  return new Promise((resolve) => {
    let resolved = false;
    function finish(value) {
      if (resolved) return;
      resolved = true;
      closeModal({ force: true });
      resolve(value);
    }

    const rowsHtml = items.map((ing, idx) => `
      <div class="ingredient-select__row">
        <label class="form-check">
          <input type="checkbox" class="ingredient-select__checkbox" data-index="${idx}" checked>
          <span class="ingredient-select__name">${esc(ing.name)}</span>
          <span class="ingredient-select__qty">${esc(ing.quantity ?? '')}</span>
        </label>
      </div>`).join('');

    // Eine Liste → keine Rückfrage (dieselbe Regel wie `resolveShoppingTarget()`
    // in kitchen-transfer.js), nur eingebettet statt als zweiter Dialog danach -
    // genau der Zwei-Schritt-Ablauf, den dieser Baustein ersetzt.
    const listPickerHtml = singleList ? '' : `
      <div class="form-group">
        <label class="form-label" for="ingredient-select-target">${esc(t('common.toShoppingListWhich'))}</label>
        <select class="form-input" id="ingredient-select-target">
          ${available.map((list) => `<option value="${esc(list.id)}">${esc(list.name)}</option>`).join('')}
        </select>
      </div>`;

    openModal({
      title: title ?? t('common.selectIngredients'),
      size: 'md',
      content: `
        <div class="ingredient-select__bulk">
          <button type="button" class="btn btn--secondary btn--sm" id="ingredient-select-all">${esc(t('common.selectAllIngredients'))}</button>
          <button type="button" class="btn btn--secondary btn--sm" id="ingredient-select-none">${esc(t('common.deselectAllIngredients'))}</button>
        </div>
        <div class="form-field ingredient-select__list" id="ingredient-select-list">
          ${rowsHtml}
        </div>
        ${listPickerHtml}
        <div class="modal-panel__footer modal-panel__footer--plain">
          <button type="button" class="btn btn--secondary" data-action="close-modal">${esc(t('common.cancel'))}</button>
          <button type="button" class="btn btn--primary" id="ingredient-select-confirm">${esc(t('common.apply'))}</button>
        </div>`,
      onClose: () => finish(null),
      onSave(panel) {
        const listGroup = panel.querySelector('#ingredient-select-list');
        const checkboxes = () => [...panel.querySelectorAll('.ingredient-select__checkbox')];

        panel.querySelector('#ingredient-select-all')
          ?.addEventListener('click', () => checkboxes().forEach((cb) => { cb.checked = true; }));
        panel.querySelector('#ingredient-select-none')
          ?.addEventListener('click', () => checkboxes().forEach((cb) => { cb.checked = false; }));

        panel.querySelector('#ingredient-select-confirm').addEventListener('click', () => {
          const checked = checkboxes().filter((cb) => cb.checked);
          if (!checked.length) {
            // Feldbezogene Meldung statt Toast (geteiltes Muster, siehe
            // reportFieldError in components/modal.js) - `listGroup` trägt
            // `.form-field`, das „change" jeder Checkbox blubbert bis zu ihm
            // hoch und räumt die Meldung beim nächsten Umschalten selbst weg.
            reportFieldError(listGroup, t('common.selectIngredientsRequired'));
            return;
          }
          const listId = singleList
            ? singleList.id
            : Number(panel.querySelector('#ingredient-select-target').value);
          finish({
            listId,
            // Original-`id` per Index zurückverfolgt statt aus dem DOM geparst -
            // erhält den Typ (number|string), egal welche PK die Zutat trägt.
            ingredientIds: checked.map((cb) => items[Number(cb.dataset.index)].id),
          });
        });
      },
    });
  });
}
