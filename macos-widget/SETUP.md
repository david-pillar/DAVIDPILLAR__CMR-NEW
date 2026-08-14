# SLATE widget na plochu Macu — návod (Xcode)

Toto vytvorí widget na plochu/Notification Center macOS, ktorý ukazuje tvoju **najbližšiu nadchádzajúcu zákazku** (názov, klient, o koľko dní). Dáta ťahá priamo z tej istej Supabase databázy ako webová appka SLATE.

Vyžaduje **macOS 14 (Sonoma) alebo novší** a **Xcode** (zadarmo). Celý postup trvá cca 30–45 minút, väčšinu času zaberie stiahnutie Xcode.

---

## 1. Nainštaluj Xcode

1. Otvor **App Store** na Macu, vyhľadaj **Xcode**, klikni **Get/Install** (je to cca 10–15 GB, môže to chvíľu trvať).
2. Po prvom spustení Xcode ťa požiada o inštaláciu ďalších komponentov — potvrď.
3. Ak nemáš Apple ID nastavené v Xcode: **Xcode → Settings → Accounts → +** a prihlás sa svojím bežným Apple ID (netreba platený Developer účet, appka zostáva len na tvojom Macu).

## 2. Vytvor nový projekt

1. **Xcode → File → New → Project…**
2. Vyber **macOS → App**, klikni **Next**.
3. Vyplň:
   - **Product Name:** `SlateWidgetHost`
   - **Team:** tvoje Apple ID
   - **Organization Identifier:** napr. `com.davidpillar` (čokoľvek, len použi to isté všade nižšie)
   - **Interface:** SwiftUI
   - **Language:** Swift
4. Ulož projekt kamkoľvek (napr. na Plochu, nezáleží — je to samostatný projekt od webovej appky SLATE).

## 3. Pridaj Widget Extension

1. **File → New → Target…**
2. Vyber **Widget Extension**, Next.
3. **Product Name:** `SlateWidgetExtension`
4. **Include Configuration Intent:** NECHAJ ODŠKRTNUTÉ (vypnuté).
5. Klikni **Finish**. Ak sa Xcode spýta "Activate scheme?" → **Activate**.

Teraz máš v projekte 2 targety: `SlateWidgetHost` (hlavná appka s prihlásením) a `SlateWidgetExtension` (samotný widget).

## 4. Zapni App Groups (zdieľanie dát medzi appkou a widgetom)

Toto treba urobiť **na oboch targetoch** rovnako:

1. V ľavom paneli klikni na modrú ikonu projektu hore → v strede vyber target **SlateWidgetHost** → tab **Signing & Capabilities**.
2. Klikni **+ Capability** → dvojklik na **App Groups**.
3. Klikni **+** pod zoznamom App Groups, zadaj presne: `group.com.davidpillar.slate`
   (ak si v kroku 2 použil iný Organization Identifier, uprav si aj toto meno — hlavne nech je **rovnaké všade**, vrátane `SlateShared.swift` nižšie).
4. Zopakuj kroky 1–3 pre target **SlateWidgetExtension** (rovnaký App Group string, zaškrtni ho).

## 5. Pridaj zdieľaný súbor `SlateShared.swift`

1. Klikni pravým na priečinok `SlateWidgetHost` v ľavom paneli → **New File from Template…** → **Swift File** → meno `SlateShared`.
2. **Dôležité:** v pravom paneli (File Inspector) pri **Target Membership** zaškrtni **OBIDVA** targety — `SlateWidgetHost` aj `SlateWidgetExtension`.
3. Vlož do neho celý obsah priloženého súboru **`SlateShared.swift`** (nahraď predvyplnený obsah).
4. Ak si v kroku 4 použil iný App Group string, uprav riadok `static let appGroupId = "group.com.davidpillar.slate"` v tomto súbore.

## 6. Nahraď obsah login obrazovky

1. V priečinku `SlateWidgetHost` otvor súbor **`ContentView.swift`**.
2. Vymaž všetko a vlož obsah priloženého súboru **`ContentView.swift`**.

## 7. Nahraď obsah widgetu

1. V priečinku `SlateWidgetExtension` nájdi súbor, ktorý Xcode vygeneroval (volá sa podľa product name, napr. `SlateWidgetExtension.swift`) — obsahuje `@main struct ... : WidgetBundle`.
2. Vymaž všetko a vlož obsah priloženého súboru **`NextProjectWidget.swift`**.
3. Ak v projekte ostal aj vygenerovaný súbor `AppIntent.swift` (vytvorený Xcode šablónou), môžeš ho pokojne zmazať — nepoužívame ho (nepoužívame configuration intent).

## 8. Spusti a prihlás sa

1. Hore v Xcode vyber scheme **SlateWidgetHost** (nie extension) a klikni **▶ Run** (alebo Cmd+R).
2. Otvorí sa malé okno appky — zadaj svoj SLATE e-mail a heslo (rovnaké, akým sa prihlasuješ do webovej appky) → **Prihlásiť sa**.
3. Zavri appku (nemusí bežať na pozadí, widget funguje nezávisle).

## 9. Pridaj widget na plochu

1. Klikni pravým na plochu (Desktop) → **Edit Widgets…** (alebo cez Notification Center vpravo hore → scroll dole → **Edit Widgets**).
2. Vyhľadaj **SlateWidgetHost** v zozname appiek vľavo.
3. Vyber veľkosť (malý/stredný) a **pretiahni na plochu**.

Widget by mal do pár sekúnd/minút ukázať tvoju najbližšiu zákazku. Ak ukáže "Nie si prihlásený", over že si sa naozaj prihlásil v kroku 8 a skús widget znova pridať.

---

### Poznámky

- Widget sa obnovuje raz za hodinu (typické pre macOS widgety — nie je to "živé" pripojenie). Po prihlásení/odhlásení v appke sa obnoví hneď.
- Heslo sa nikde needukladá — appka ho pošle len raz priamo do Supabase (rovnako ako webová appka) a dostane naspäť prihlasovací token, ktorý sa uloží lokálne na tvojom Macu (zdieľané úložisko medzi appkou a widgetom).
- Ak neskôr zmeníš heslo do SLATE, treba sa v `SlateWidgetHost` appke znova prihlásiť.
- Toto je samostatný projekt, nijako neovplyvňuje webovú appku SLATE ani jej kód.
