<!-- version: 2.28.0 -->
<!--
  Die `releaseNotes` fuer den Umbrel-App-Store, von Hand fuer JEDEN Release
  geschrieben. `umbrel-publish.yml` nimmt den Text unter diesem Kommentar
  woertlich und verweigert den Lauf, wenn die Versionsmarke oben nicht zur
  veroeffentlichten Version passt - eine veraltete Notiz ist schlimmer als keine.

  WARUM VON HAND. Bis v2.6.0 hat der Workflow den GitHub-Release-Body
  umgeformt: Ueberschriften weg, Aufzaehlungszeichen weg, Rest als Prosa. Unser
  CHANGELOG ist aber fuer Entwickler geschrieben - Messwerte, Tokennamen,
  Selektoren, Guard-Namen - und im Store steht dieser Text im
  Update-Dialog eines Haushalts. Umbrels Maintainer hat ihn deshalb vor dem
  Merge von v2.6.0 umgeschrieben und darum gebeten, kuenftig ihre `AGENTS.md`
  zu befolgen (getumbrel/umbrel-apps, Kommentar an PR #5980):
  `.claude/skills/umbrel-update-app/` verlangt "concise Umbrel-user
  releaseNotes ... Omit upstream CI, docs-only, build, and internal dependency
  churn" plus einen Link auf die vollen Notizen.

  REGELN FUER DEN TEXT (aus deren Skill, nicht erfunden):
    - Fuer jemanden, der eine BESTEHENDE Installation aktualisiert.
    - Thematische Absaetze, keine Bullet-Liste, kein Markdown.
    - Nutzersichtbare Funktionen, Fehlerbehebungen, Sicherheitshinweise.
    - Migrationen und Breaking Changes ausdruecklich als Handlung benennen
      (z.B. eine neue Pflicht-Env-Variable) - das ist der wichtigste Absatz,
      wenn es einen gibt.
    - Keine internen Details: keine CSS-Klassen, keine Pixelwerte, keine
      Tokennamen, keine Testnamen.
    - Letzter Absatz ist der Link auf die vollen Release Notes.
    - Leerzeile zwischen den Absaetzen: der Store rendert ein gefaltetes
      YAML-Blockskalar, dort ist die Leerzeile der Absatzumbruch.

  HINWEIS ZU DIESER VERSION: eine Sicherheitsaenderung, die STOPPEN kann, plus
  drei Verbesserungen. Der Sicherheitsabsatz steht zuerst und benennt die
  Handlung ausdruecklich - das ist der Fall, in dem ein Haushalt nach dem Update
  einen Container sieht, der nicht mehr startet. Genau dafuer verlangt Umbrels
  Skill "Migrationen und Breaking Changes ausdruecklich als Handlung".

  Betroffen ist nur, wer den Platzhalter aus der Beispielkonfiguration nie
  ersetzt hat. Auf Umbrel ist das praktisch niemand: der Store setzt
  SESSION_SECRET selbst aus dem App-Seed. Der Absatz bleibt trotzdem drin und
  bleibt kurz - wer von Hand installiert oder umgezogen ist, muss ihn lesen, und
  fuer alle anderen kostet er drei Zeilen.

  Draussen bleibt die Bauart: Namen von Umgebungsvariablen ausser der einen, die
  man wirklich eintragen muss; wie die Grenze intern zusammengefuehrt wurde; die
  Speicherschluessel der beiden Schalter; warum ein Gruppenkopf jetzt ein Knopf
  ist.
-->
Wichtig, falls du Yuvomi von Hand aufgesetzt hast: der Server startet nicht mehr, solange in der Konfiguration noch der Beispielwert fuer SESSION_SECRET steht. Dieser Wert ist oeffentlich einsehbar, und wer ihn kennt, kann sich als beliebiges Mitglied anmelden - deshalb laeuft Yuvomi damit nicht weiter, statt still angreifbar zu bleiben. Wer betroffen ist, traegt einen selbst erzeugten Wert ein und startet neu; danach muessen sich alle einmal neu anmelden, sonst geht nichts verloren. Ueber den App Store installierte Haushalte sind nicht betroffen, dort wird der Wert automatisch gesetzt.

Die Obergrenze fuer Datei-Uploads laesst sich jetzt einstellen. Bisher waren fuenf Megabyte fest eingebaut, was fuer eingescannte Handbuecher oder laengere Vertraege oft zu wenig war; die Grenze gilt einheitlich fuer Dokumente, Anhaenge an Terminen und Belege der Haushaltshilfe, und die Hinweise in der Oberflaeche nennen den Wert, den du eingestellt hast. Wer mehr braucht, hebt sie in der Konfiguration an - mit Augenmass, denn eine hochgeladene Datei liegt waehrend der Uebertragung im Arbeitsspeicher und ein sehr grosser Wert kann ein kleines Geraet ueberfordern.

Geburtstage lassen sich im Kalender ausblenden. Bei einem grossen Adressbuch fuellen sie den Kalender mit Eintraegen, die niemand als Termin geplant hat, und sie einzeln zu loeschen half nicht - der naechste Abgleich legte sie wieder an. Ein Schalter in der Kalender-Leiste blendet sie aus, so wie es ihn fuer Feiertage und Schulferien schon gab. Eigene Termine bleiben stehen, auch wenn "Geburtstag" im Titel steht.

In den Aufgaben lassen sich Abschnitte zuklappen. Ein Klick auf die Ueberschrift faltet die Liste darunter zusammen; die Anzahl bleibt sichtbar, und der Zustand bleibt erhalten, bis du ihn wieder aenderst.

Full release notes are available at https://github.com/ulsklyc/yuvomi/releases/tag/v2.28.0
