# Mordheim Manager: aanbevelingen voor structuur en navigatie

*Vervolg op `app-structuur-overzicht.md`. Uitgangspunten: de spec-conventies (❓ met een beredeneerde standaard, oude URL's blijven werken, meten via de bestaande `$pageview` en consent-gated events), §5.4 (body ≥16px, niets onder 12px) en §39.2 (3–5 tabs).*

---

## 0. In één alinea

Breng de nav terug naar **vijf plekken: Home · Warbands · Play · Campaigns · Rules**, met labels. Account verdwijnt uit de tabbalk en wordt een **avatar in de header van elk tab-scherm**. Die avatar vervangt meteen de twee zwevende knoppen. Alles wat nu "los" hangt (dice, map, solo, compare, custom builder, gallery) krijgt een vaste tab. Account wordt een kort **"Jij"-scherm** met vijf rijen naar subschermen in plaats van tien kaarten. Campagnes krijgen een **eigen URL**, en de verborgen "actieve campagne" verdwijnt. De spelersdirectory wordt een **subtab van Campaigns**.

---

## 1. Navigatie

### 1.1 Vijf tabs, altijd met label

| # | Tab | Route | Bevat | Licht op voor |
|---|---|---|---|---|
| 1 | **Home** | `/` | "wat nu?": hervatten, volgende game night, je warbands | `/` |
| 2 | **Warbands** | `/warbands` | je warbands, gallery, compare, custom builder | `/warbands/**` *(behalve de battle-flow)*, `/gallery`, `/rosters/*`, `/compare`, `/custom-warbands/**` |
| 3 | **Play** | `/play` | battle starten/hervatten, je battles, solo, map, dice | `/play/**`, `/warbands/:id/{pre,during,post}-battle`, `/solo/**`, `/map`, `/dice` |
| 4 | **Campaigns** | `/campaigns` | je campagnes, spelers zoeken | `/campaigns/**`, `/players/**` *(behalve je eigen profiel)* |
| 5 | **Rules** | `/rules` | ongewijzigd | `/rules/**` |
| — | *Avatar (Jij)* | `/account` | profiel, instellingen, data, hulp, admin | `/account/**`, `/players/:mijnId`, `/admin/**` |

- **Labels op elke breedte:** icoon met daaronder een label van 12px (de §5.4-ondergrens). Bij vijf tabs is elke knop ≥75px breed, dus "Campaigns" past.
- **Trading verdwijnt als tab.** Kopen en verkopen gebeurt altijd voor één warband, en de knop staat al in de actierij van de roster. `/trading` blijft bestaan als redirect naar de kiezer.
  - ❓ **Trading echt uit de nav? Standaard: ja, na een meting.** Haal eerst uit PostHog hoe vaak `$pageview /trading` voorkomt tegenover `/warbands/:id/trading` (afgelopen 30 dagen). Komt meer dan ~25% van de trading-bezoeken via de tab, voeg dan in Warbands › Mine een "Trading Post"-knop toe die de kiezer opent.
- **Account uit de tabbalk, naar een avatar.** Dat is het Material 3-patroon (account-avatar in de top app bar) en het patroon van Instagram en X. Account is geen plek waar je naartoe navigeert tijdens het spelen.
  - ❓ **Avatar of vijfde tab "Jij" (met Rules dan in Play)? Standaard: avatar.** Rules is de publieke deur voor wie zonder account aan tafel zit, en die hoort in de nav.
- **Desktop (SideNav):** dezelfde vijf, met onderaan de rail de avatar en je naam. Die vervangt `AuthNavButton`. Uitgelogd staat daar "Sign in".

### 1.2 Eén header voor tab-schermen, geen zwevende knoppen

- Nieuw: **`TabHeader`** (UI-kit §5.6) met een titel links en rechts een slot voor de **avatar**. Gebruik hem op de vijf tab-schermen. Uitgelogd toont het slot een "Sign in"-knop. Detailschermen houden `BackHeader` zonder avatar.
- **Weg:** de zwevende **?** en de zwevende **dobbelsteen**, plus de `pr-14`-uitzondering in `App.tsx`.
  - Dice: als header-actie op Rules, Play en het during-battle-scherm. Op die drie plekken heb je dobbelstenen nodig, en daar blijven ze dus één tik weg.
  - Tour: draait automatisch bij de eerste start (zoals nu), en daarna via Jij › Help › "Rondleiding opnieuw".
- `ReportIssueButton` onderaan elke pagina blijft. Die is licht en staat goed.

### 1.3 Oplichten via één tabel in plaats van uitzonderingen

Vervang `activeFor`, `alsoActiveFor` en `notActiveFor` door één functie `tabForPath(pathname, userId) → TabId | 'account' | null`, gevoed door een geordende lijst van patronen (specifiek vóór algemeen). Voeg een test toe die **elke route uit `App.tsx`** langsloopt en eist dat er een tab bij hoort. Alleen de auth-schermen en `/design` mogen expliciet `null` zijn. Zo kan een nieuw scherm nooit meer "nergens" landen.

---

## 2. Per tab

### 2.1 Home: één taak, "wat nu?"

Volgorde, van boven naar onder:

1. **Hervatten**, alleen als er een onafgemaakte battle of post-battle-wizard is (de `localStorage`-draft uit §4.3 en §35.2): "Grim Blades: post-battle, stap 4 van 8 · Verder".
2. **Campagnekaart**: naam, volgende game night met RSVP-status, en één link **Open campaign**. "Open Campaign Log", "View Campaign Log" en "All my campaigns" vallen weg. De tab doet dat laatste al.
3. **Je warbands**: maximaal 3 (laatst gebruikt eerst), met "Alle warbands ›" en "+ New".
4. **Eén primaire knop: Start a battle.** Die leidt naar Play.
5. Install-nudge (ongewijzigd).

**Weg van Home:** de rij Quick Actions (Trading, Campaign Log, Solo, Map: die verhuizen naar Play en Warbands) en het blok About (dat gaat naar Jij › Help & about). Uitgelogd blijft Home zoals het is, inclusief de gallery-link.

### 2.2 Warbands

- Subtabs **Mine · Gallery · Rules**. "Public" heet voortaan "Gallery", één woord voor één ding. `/gallery` toont hetzelfde en licht voortaan Warbands op.
- Onder de lijst op *Mine* een kleine rij **Tools**: *Compare warbands* · *Custom warband types*. De custom builder (`/custom-warbands`) is nu alleen via New Warband te vinden.
- Roster: de actierij wordt **Play · Trading · Print · Share**. "Pre-battle" en "Post-battle" worden één **Play**-knop. Die opent pre-battle, of hervat de lopende battle als er één is. Post-battle zonder pre-battle (een battle achteraf invoeren) blijft beschikbaar als tweede optie in Play.

### 2.3 Play (nieuw hub-scherm op `/play`)

| Blok | Inhoud |
|---|---|
| **Hervatten** | lopende battle/wizard, als die er is |
| **Start a battle** | warbandkiezer (laatst gebruikt eerst, §35.1). Daarna: in campagne of friendly (§34) |
| **Your battles** | de huidige `PersonalBattles` |
| **Tools** | Dice roller · Battlefield generator (beta) · Solo battle (beta) |

- De routes van de battle-flow blijven onder `/warbands/:id/…`, want ze horen bij een warband. Ze lichten **Play** op via de tabel uit §1.3.
- `/post-battle` → redirect naar `/play`.
- ❓ **Label "Play" of "Battle"? Standaard: Play.** De tab dekt nu ook solo, map en dice, en "Play" is in het Engels kort genoeg.

### 2.4 Campaigns

- **Eigen URL per campagne:** `/campaigns/:id`, met subtabs als route: `/campaigns/:id/activity|standings|players|territories|settings`, plus `/campaigns/:id/events[/:eventId]` en `/calendar`. Daarmee werken delen, bookmarks en Back zoals verwacht, en het scherm valt uiteen in vijf bestanden in plaats van één van 1.448 regels.
- **De "actieve campagne" verdwijnt als verborgen context.** De battle-commit gebruikt al `resolveWarbandCampaign` (§34.4), dus alleen Home en het oude `/campaign` lezen de actieve keuze. Home toont voortaan **de laatst geopende** campagne (nog steeds `localStorage`, maar als gemak, niet als modus). "Switch to this campaign" wordt overal gewoon **Open**. De subtitel "You're in 6 campaigns" vervalt.
  - Redirects: `/campaign` → `/campaigns/:laatstGeopend` (of `/campaigns` als die er niet is). `/campaign/events…` en `/campaign/warbands/:id` gaan naar hun nieuwe equivalent.
- **Twee subtabs op het tab-scherm: Campaigns · Players.** *Players* is de directory (`/players`). Daarmee is "Find players" vanaf elke plek in de app één tik, en staat het niet meer op y≈1.740.
- **De campagnelijst wordt compacter:** de hele kaart is de link (naam, rol, spelers/battles, volgende game night). De join code verhuist naar de campagne zelf (Players-subtab), want daar deel je hem. Onder de lijst staan **Join with code** en **Start a campaign** als twee knoppen naast elkaar, die een sheet of uitklapper openen.
- **Termen gelijktrekken:** "Battle log" voor battles en "**Chronicle**" voor het verhalende logboek (nu "Campaign Log"). Home zegt "Open campaign".
  - ❓ **"Chronicle"? Standaard: ja.** Het past bij het Mordheim-register en botst niet met "Activity" of "Battle log".

### 2.5 Rules

Blijft zoals het is. Twee kleine wijzigingen: dice als header-actie (§1.2), en de contextuele Rules-subtabs in Warbands en Trading Post krijgen onderaan een link "Volledige regels ›" naar `/rules`.

### 2.6 Jij (Account): kort scherm met subschermen

**`/account`, eerste scherm, past binnen 812px:**

1. **Identiteit** (ongewijzigd van §39): avatar, naam, land, Listed-chip, *View profile ›* en *Edit*.
2. Een lijst met rijen (nieuw kit-component **`ListRow`**: icoon, label, korte status rechts, chevron):
   - **Profiel bewerken** → `/account/profile`
   - **Instellingen** → `/account/settings`: thema, notificaties, installeren, analytics. Status-hint: "Grimdark · meldingen aan"
   - **Je data** → `/account/data`: export/import, je activiteit
   - **Help & over** → `/account/about`: rondleiding opnieuw, changelog, Discord, game data, datafout melden, privacybeleid, app-versie
   - **Admin** → `/admin` *(alleen voor admins)*
3. **Ingelogd als e-mail · Sign out**, direct onder de lijst en dus op het eerste scherm.

**Uitgelogd:** een kaart met Sign in / Register, daarna alleen *Instellingen* en *Help & over*.

**Redirects:** `/account#install` → `/account/settings#install`, `/account#profile` → `/account/profile` (bestaat al), `/account/changelog` blijft (nu onder Help & over).

- ❓ **Thema direct op het Jij-scherm laten staan (zoals nu)? Standaard: nee.** Het is één keer kiezen. De rij "Instellingen" laat de huidige keuze als status zien.

### 2.7 Admin

Blijft een eigen layout met subtabs, bereikbaar via Jij › Admin. Op desktop zie je hem ook in het avatar-menu onderaan de rail. Admin-schermen lichten de avatar op. Verplaats `AdminUserScreen.tsx` naar `screens/admin/`.

---

## 3. Profielen en sociaal (aanvulling op §39)

- De directory is een **subtab van Campaigns** (zie 2.4). De bestaande deuren (empty state, invites, het Looking-for-group-blok) blijven.
- Je eigen profiel: avatar → *View profile* (2 tikken, ongewijzigd).
  - ❓ **Lang drukken op de avatar opent direct je profiel? Standaard: nee.** Houd het simpel: één tik opent het Jij-scherm.
- Namen linken overal naar profielen, behalve in de gallery (§39.3: een geneste link is ongeldige HTML). Daar komt de naam onder de kaart als aparte link.

---

## 4. Opschonen in code en spec

| Wat | Wijziging |
|---|---|
| `SettingsScreen`, `strings.settings`, `nav.settings` | → `AccountScreen`, `strings.account`, `nav.account` |
| `strings.nav.help.settings` | herschrijven: noemt nog "display name" |
| `/post-battle` | → `/play` (redirect) |
| `CampaignScreen.tsx` (1.448 r.) | splitsen per subtab-route |
| `navItems.tsx` uitzonderingen | → `tabForPath` + routetest (§1.3) |
| Spec §4 | tabs bijwerken, conflict 7 sluiten, "Settings"-vermeldingen corrigeren |

---

## 5. Meten

- **Vooraf (baseline, 30 dagen, PostHog):** `$pageview` per route voor `/trading`, `/warbands/:id/trading`, `/dice`, `/map`, `/solo`, `/compare`, `/gallery`, `/players`, `/account`, plus `directory_opened {surface}` (§39.7).
- **Eén nieuw event:** `nav_tab_tapped { tab }` (gesloten set: `home|warbands|play|campaigns|rules|account`), consent-gated volgens §23.7.
- **Na 3–4 weken vergelijken:** bezoeken aan tools (dice/map/solo) en de directory moeten stijgen, het aandeel `$pageview /account` dat binnen 10 seconden weer weggaat moet dalen, en er mag geen daling zijn in trading-bezoeken.

---

## 6. Bouwvolgorde (elke stap los uitrolbaar)

1. **`tabForPath` + routetest.** Geen zichtbare verandering, behalve dat de "onverlichte" schermen voortaan een tab oplichten. Klein en veilig.
2. **Campagne-URL's** (`/campaigns/:id/…`), redirects, "Switch" → "Open", Home leest de laatst geopende campagne. Daarna `CampaignScreen` splitsen.
3. **Jij-scherm**: `ListRow`, de vier subschermen, redirects. About verhuist van Home naar Help & over.
4. **Nav naar vijf + Play-hub + `TabHeader` met avatar**. Zwevende ? en dobbelsteen weg. Labels op telefoon. *(Eerst de Trading-baseline uit §5 bekijken.)*
5. **Home afslanken**: hervat-kaart, één campagnelink, max. 3 warbands, één CTA.
6. **Warbands**: Gallery-naam, Tools-rij, Play-knop op de roster.
7. **Campaigns**: subtab Players, compacte kaarten, join code naar de campagne, Chronicle.
8. **Opschonen**: renames, spec §4.

**Acceptatie (bij elke stap):** op 375×812 in beide thema's geen overlap in headers, labels ≥12px, elke route licht precies één tab of de avatar op, en alle oude URL's uit het overzicht landen op hun nieuwe plek.

---

## 7. Open beslissingen, samengevat

| ❓ | Standaard |
|---|---|
| Trading uit de nav | ja, na de baselinemeting |
| Account als avatar of als 5e tab | avatar |
| Label "Play" of "Battle" | Play |
| Campagne-subtabs als eigen URL | ja |
| "Chronicle" voor het verhalende log | ja |
| Thema direct op het Jij-scherm | nee, in Instellingen |
