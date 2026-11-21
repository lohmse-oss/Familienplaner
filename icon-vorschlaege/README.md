# Icon-Vorschläge „schwarz neo" (nur Mockups, noch nicht verdrahtet)

Grundidee: schwarzer Grund **#0B0F19** (dunkles Nav-Schwarz der App) + Neon-Akzente –
passt zum Nothing-Stil-Widget. Weg vom weißen Kalender-Raster (Google-Look).

| Datei | Variante |
|---|---|
| `A-vier-neon-punkte.png` | **A:** 2×2-Neon-Punkte in den Personenfarben #7FB7D6 / #F06CA0 / #A98AE0 / #FF8A5C, rechts unten als Ring („heute/offen"), Glow |
| `B-neon-rahmen-haken.png` | **B:** dicker #7FB7D6-Rahmen auf schwarz, fetter weißer Haken |
| `C-neo-monogramm-F.png` | **C:** fettes geometrisches „F“ in #7FB7D6 mit pinkem Hart-Schatten #F06CA0 |
| `D-punkte-weisses-badge-schwarzer-haken.png` | **D (Mix A+B, empfohlen):** 4 Neon-Punkte, mittendrin weißes Badge mit **schwarzem** Haken |
| `D2-punkte-haken-knockout.png` | **D2:** 4 Neon-Punkte, schwarzer Haken direkt ausgestanzt – liest sich bei 48 px schlecht |
| `D3-kärtchen-oben-punkte-unten.png` | **D3:** oben weißes Kärtchen mit schwarzem Haken, unten die 4 Neon-Punkte |
| `*-48px.png` | jeweilige Variante in Launcher-Größe 48 px |
| `mockup-home-screen-96px.png` | A/B/C bei 96 px auf Home-Screen-Mockup |
| `mockup-home-screen-mix-96px.png` | D/D2/D3 bei 96 px auf Home-Screen-Mockup |

Umsetzung nach Wahl: `mipmap-*/ic_launcher{,_round}.png` (48–192 px) + adaptive
Foreground-PNGs (108–432 px, Glyph in 66-dp-Safezone) neu rendern, `ic_launcher_background` → #0B0F19.
