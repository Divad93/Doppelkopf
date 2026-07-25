# Familien-Kartentisch

Eine hübsche, lokale Karten-App für Familienrunden.  
Sie läuft komplett im Browser, braucht kein Build-Tool und kann direkt auf GitHub Pages veröffentlicht werden.

## Dateien

```text
/
├─ index.html
├─ css/
│  └─ styles.css
└─ js/
   └─ app.js
```

## So benutzt du sie

1. Das komplette Projekt in ein GitHub-Repository hochladen.
2. Auf **Settings → Pages** gehen.
3. Als Quelle **Deploy from a branch** wählen.
4. Branch **main** und Ordner **/(root)** auswählen.
5. Speichern.

Danach ist die Seite online.

## Was die App kann

- schöne Karten mit Farben, Schatten und kleinen Symbolen
- flüssige Animationen ohne kompletten Reload
- 2 bis 8 Spieler
- Karten ziehen, spielen und Zug beenden
- lokaler Speicher im Browser
- einfache Spielregel: gleiche Farbe oder gleicher Wert

## Lokales Testen

Einfach die `index.html` im Browser öffnen.

Wenn du einen kleinen Webserver willst, kannst du im Projektordner auch zum Beispiel starten:

```bash
python -m http.server 8000
```

Dann im Browser `http://localhost:8000` öffnen.
