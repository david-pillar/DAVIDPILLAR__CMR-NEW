# SLATE – Produkčný manažér

Jednoduchý CRM/produkčný manažér pre svadobnú a event videografiu. Beží čisto v prehliadači (žiadny backend, žiadna databáza) — všetky dáta sa ukladajú priamo v `localStorage` tvojho zariadenia.

## Štruktúra projektu

```
index.html              — hlavná stránka, načíta CSS a všetky JS moduly v správnom poradí
css/
  styles.css            — všetky štýly appky (3 vstavané témy: Filmová/Vibrantná/Elegantná)
js/
  01-state.js            — dátový model (DATA, PRICING, nastavenia), stavy zákaziek, Kôš
  02-utils-theme.js       — pomocné funkcie (dátumy, peniaze, telefón/WhatsApp), prepínanie témy
  03-pricing.js           — Cenotvorba (balíky, príplatky, kalkulačka, grafy)
  04-hours-expenses.js    — Hodiny a Náklady
  05-vendors-messages.js  — Dodávatelia, šablóny WhatsApp správ, DPH prepínač
  06-export-backup-pdf.js — export do Excelu, záloha/obnova dát, PDF zmluvy/faktúry
  07-weather-crmfolder.js — predpoveď počasia, QR platba, harmonogram dňa, priečinok na disku
  08-dashboard.js         — Dashboard (Bento Grid, chýbajúce správy, výročia, ročný súhrn)
  09-calendar.js          — Kalendár (filtre, drag&drop, denná agenda, kontaktný hárok)
  10-clients-projects-list.js — zoznamy klientov, zákaziek (kanban) a faktúr
  11-app-core.js          — prepínanie stránok, odznaky v menu, globálne vyhľadávanie
  12-bookings.js          — rezervácie, synchronizácia so zákazkami, export .ics
  13-clients-crud.js      — vytváranie/úprava/mazanie klienta
  14-project-pricing-fields.js — polia svadby/stužkovej, prepočet ceny, stavové indikátory
  15-project-extras.js    — podpis klienta, časovač práce, checklist
  16-project-crud.js      — vytváranie/úprava/mazanie/duplikovanie zákazky
  17-import.js            — import z Google Formulára a z textu (Pripomienky)
  18-invoices-crud.js     — faktúry, DPH prepočet
  19-init-autobackup.js   — automatická záloha, klávesové skratky, spustenie appky
```

**Dôležité:** súbory v `js/` sa načítavajú ako klasické `<script src="...">` (nie ES moduly) a **musia zostať v tomto poradí** — neskoršie súbory sa spoliehajú na premenné a funkcie definované v skorších (napr. `DATA`, `PRICING`, `uid()`).

## Ako to spustiť

### Lokálne (na počítači)
Kvôli tomu, že appka číta viacero súborov (`js/*.js`, `css/styles.css`), **nestačí len otvoriť `index.html` dvojklikom** — prehliadač by mal problém s `localStorage` na `file://` protokole. Spusti lokálny server, napr.:

```bash
cd slate-github
python3 -m http.server 8000
```
a otvor `http://localhost:8000` v prehliadači.

### Nasadenie na GitHub Pages
1. Nahraj celý obsah tohto priečinka do GitHub repozitára.
2. V nastaveniach repozitára (Settings → Pages) zapni GitHub Pages pre branch `main`, priečinok `/ (root)`.
3. Appka bude dostupná na `https://tvoj-username.github.io/nazov-repozitara/`.
4. Na iPhone otvor tento odkaz v Safari → Zdieľať → Pridať na plochu.

## Poznámky
- Dáta sa ukladajú len v prehliadači daného zariadenia. Medzi zariadeniami sa prenášajú cez Nastavenia → Záloha (stiahni `.json` na jednom, nahraj na druhom), alebo cez automatickú zálohu na súbor (funguje len v Chrome/Edge na počítači).
- Predpoveď počasia, QR platba a Google Form import vyžadujú internetové pripojenie — všetko ostatné funguje aj offline.
