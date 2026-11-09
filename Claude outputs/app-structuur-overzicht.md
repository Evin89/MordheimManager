# Mordheim Manager: structuuroverzicht en navigatie-audit

*Gemeten op `main` @ merge #42 (§39 profielen, 2026-11-02 21:00), in de code en in demo mode op 375×812. Alleen rapportage: er is niets gewijzigd.*

---

## 0. Samenvatting

- **De app is gegroeid tot 64 routes (+6 redirects) achter 7 tabs.** Op een telefoon (<640px) zijn dat 7 iconen zonder labels. Tussen 640 en 767px zijn het 7 labels zonder iconen. Uitgelogd komt er een 8e knop bij (Sign in). Spec §4 noemt de drukte al ("recorded, not yet acted on").
- **Acht bestemmingen hebben geen eigen ingang in de nav, en terwijl je erop staat licht er geen tab op:** dice, map, solo, gallery, gedeelde roster, compare, eigen custom warbands en admin. Sommige zijn alleen te bereiken via één knop op één scherm.
- **Account is een verzamelbak.** Het scherm is 2.700px hoog (≈3,3 schermen) met 9–10 kaarten uit 6 verschillende categorieën: identiteit, apparaat, data, sessie, activiteit, admin en referentiedata. Uitloggen en Admin staan pas op het tweede scherm, onder data, notificaties en thema.
- **Profielen zijn sinds §39 beter, maar de directory ("Find players") staat bij 6 campagnes op y≈1.740px**, onder de hele campagnelijst.
- **Campagnes hebben geen eigen URL.** `/campaign` toont "de actieve campagne" uit `localStorage`. "Switch to this campaign" wijzigt dus stilletjes wat Home en de battle-flow laten zien.
- **De tabs dekken niet de werkelijke structuur.** Trading en Battle zijn per-warband-acties die zich als hoofdsecties voordoen. Daardoor licht in de Trading Post de tab *Warbands* op en niet *Trading*.

---

## 1. Het navigatieskelet

### 1.1 Vaste elementen op elk scherm

| Element | Positie | Bron |
|---|---|---|
| **BottomNav**: 7 tabs (<768px) | onderaan, fixed, 56px | `BottomNav.tsx` + `navItems.tsx` |
| **SideNav**: rail met iconen (768px), iconen + labels (≥1024px) | links, sticky | `SideNav.tsx` |
| **? (rondleiding)** | rechtsboven, fixed | `NavTour.tsx` (§20.4) |
| **Dobbelsteenknop** | rechtsboven, onder de ? | `DiceButton.tsx` |
| **"Report an issue on this page"** | onderaan elke pagina | `ReportIssueButton.tsx` |
| Overlays: What's New, Leader claim, Consent, Connection banner | modaal/banner | `App.tsx` |

De twee zwevende knoppen rechtsboven liggen over de headers. Daarvoor bestaat een CSS-hack in `App.tsx` (`[&>div>header:first-child]:pr-14`). Op de screenshots valt de dobbelsteen over de titelregel ("Tabletop Kingdom Summe…").

### 1.2 De zeven tabs

| # | Label | Route | Icoon (<640px) | Opmerking |
|---|---|---|---|---|
| 1 | Home | `/` | huis | — |
| 2 | Warbands | `/warbands` | drie poppetjes | — |
| 3 | Battle | `/post-battle` | gekruiste zwaarden | route heet nog post-battle |
| 4 | Trading | `/trading` | munt + pijlen | picker; bij 1 warband direct door naar `/warbands/:id/trading` |
| 5 | Campaign | `/campaigns` | kaart/rol | label enkelvoud, scherm "My Campaigns" |
| 6 | Rules | `/rules` | open boek | lijkt op het Campaign-icoon |
| 7 | Account | `/account` | hoofd+schouders | code heet nog `settings` / `SettingsScreen` |

Labels ontbreken op telefoons, dus de app leunt op de ?-rondleiding om de iconen uit te leggen. De hulptekst van Account noemt nog "display name". Die zit sinds §39 op een ander scherm.

---

## 2. Volledige routekaart

Legenda: 🔓 publiek · 🔒 inloggen vereist · **Licht** = welke tab oplicht · **Ingang** = waar vandaan je er komt

### 2.1 Buiten de shell (geen nav)
`/login` · `/register` · `/forgot-password` · `/reset-password` · `/design` (sandbox, niet gelinkt)

### 2.2 Home
| Route | | Licht | Ingang |
|---|---|---|---|
| `/` | 🔓 | Home | tab |

### 2.3 Warbands-domein
| Route | | Licht | Ingang |
|---|---|---|---|
| `/warbands` (tabs: Mine · Public · Rules) | 🔒 | Warbands | tab, Home |
| `/warbands/new` | 🔒 | Warbands | Warbands, Home, Rules-per-warband, Solo |
| `/warbands/:id` (roster) | 🔒 | Warbands | lijst, Home |
| `…/add-hero` · `/add-henchmen` · `/add-hired-sword` | 🔒 | Warbands | roster |
| `…/hero/:m` · `/hired-sword/:m` · `/henchmen/:g` | 🔒 | Warbands | roster |
| `…/print` | 🔒 | Warbands | roster |
| `…/trading` (tabs: Shop · Rules) | 🔒 | **Warbands** ⚠️ | roster, Trading-tab |
| `/compare` | 🔒 | **geen** ⚠️ | alleen een link in de warbandlijst |
| `/custom-warbands` · `/custom-warbands/:id` | 🔒 | **geen** ⚠️ | alleen via New Warband |
| `/gallery` | 🔓 | **geen** ⚠️ | alleen Home in **uitgelogde** staat (ingelogd: Warbands › Public, met dezelfde component) |
| `/rosters/:id` (gedeelde roster) | 🔓 | **geen** | gallery, comments, profielen |

### 2.4 Battle-domein
| Route | | Licht | Ingang |
|---|---|---|---|
| `/post-battle` (warbandkiezer + "Your battles") | 🔒 | Battle | tab, Home |
| `/warbands/:id/pre-battle` | 🔒 | Battle | kiezer, roster |
| `/warbands/:id/during-battle` | 🔒 | Battle | pre-battle |
| `/warbands/:id/post-battle` (wizard, 8 stappen) | 🔒 | Battle | roster, during |
| `/solo` · `/solo/collection` · `/solo/:id` | 🔒 | **geen** ⚠️ | alleen Home › Quick actions |
| `/map` | 🔓 | **geen** ⚠️ | Home › Quick actions; scenarioregel |
| `/dice` | 🔓 | **geen** | zwevende dobbelsteen, Rules |

### 2.5 Trading
| Route | | Licht | Ingang |
|---|---|---|---|
| `/trading` (kiezer, slaat over bij 1 warband) | 🔒 | Trading, daarna **Warbands** | tab, Home |

### 2.6 Campagne-domein
| Route | | Licht | Ingang |
|---|---|---|---|
| `/campaigns` (My Campaigns) | 🔒 | Campaign | tab, Home |
| `/campaign` (actieve campagne; tabs: Activity · Standings · Players · Territories · Settings) | 🔒 | Campaign | lijst, Home (2×) |
| `/campaign/events` · `/campaign/calendar` · `/campaign/events/:id` | 🔒 | Campaign | Home, lijstkaart, banner |
| `/campaign/warbands/:id` | 🔒 | Campaign | legacy |
| `/players` (directory) | 🔓* | Campaign | My Campaigns (onderaan), empty state, invites |
| `/players/:id` (ander) | 🔓* | Campaign | namen in members/standings/comments |
| `/players/:mijnId` | 🔓* | Account | Account › View profile |

*\* Regelt de uitgelogde staat zelf af.*

### 2.7 Rules-domein
| Route | | Licht | Ingang |
|---|---|---|---|
| `/rules` (zoeken, hoofdstukken, dice-link, custom gallery-link) | 🔓 | Rules | tab |
| `/rules/:ruleId` | 🔓 | Rules | rules, overal |
| `/rules/warbands/:slug` | 🔓 | Rules | rules, New Warband |
| `/rules/custom-warbands` | 🔓 | Rules | rules, warband-rules, contextuele Rules-tabs |

Daarnaast bestaan er **contextuele Rules-tabs** in Warbands (`TabRules tab="warbands"`) en in de Trading Post (`tab="trading"`).

### 2.8 Account-domein
| Route | | Licht | Ingang |
|---|---|---|---|
| `/account` | 🔓 | Account | tab |
| `/account/profile` (profiel bewerken) | 🔒 | Account | Account, eigen profiel, directory |
| `/account/changelog` | 🔓 | Account | **Home** › About, What's New-overlay (niet vanaf Account) |
| redirects: `/settings`, `/profile`, `…/changelog` | | | |

### 2.9 Admin (niet in de nav)
`/admin` → layout met 7 subtabs: Overview · Issues · Players (+ `:userId`, `/battles`, `/warbands/:id`) · Campaigns (+ `:id`) · Custom · Deleted · Maintenance. Ingang: **alleen** de Admin-kaart op Account (≈y 1.300, scherm 2). Licht: geen.

---

## 3. Opbouw per hoofdscherm

### 3.1 Home (ingelogd, 1.312px)
1. **Campaign**-kaart: naam, battles, links *Open Campaign Log* · *Game nights* · *All my campaigns*
2. **Your Warbands**: lijst + "+ New Warband"
3. **Quick Actions**: Start Post-Battle · Trading · View Campaign Log · Solo battle (beta) · Battlefield generator (beta)
4. **About**: Discord · What's New (Changelog)
5. Install-nudge

Bevindingen: *Open Campaign Log* en *View Campaign Log* gaan allebei naar `/campaign`. Quick Actions herhaalt Battle, Trading en Campaign, die ook als tab bestaan. Solo en Map zijn **alleen** hier te vinden. "About" (changelog, Discord) hoort inhoudelijk bij Account. De strings komen ook uit `strings.settings.aboutSection`.

### 3.2 Warbands
Header + "New Warband". Daaronder tabs **Mine · Public · Rules**. *Public* is dezelfde `PublicWarbandBrowser` als `/gallery`. *Compare* is één tekstlink boven de lijst. De custom-warband-builder staat niet op dit scherm.

**Roster** (`/warbands/:id`): actierij Pre-battle · Trading · Print · Post-battle, daarna Heroes / Henchmen / Hired swords met elk "+ Add". Delen, foto, sharing en de danger zone staan onderaan.

### 3.3 Battle
De warbandkiezer met "Your battles" (persoonlijke historie) eronder. Daarna pre → during → post-battle, allemaal onder `/warbands/:id/…`. Gevolg: tijdens een battle is de URL warband-gebonden, terwijl Battle oplicht. Dat werkt, maar alleen via een uitzondering (`notActiveFor`).

### 3.4 Trading
Een tab die in de praktijk een doorverwijzing is. Met één warband land je direct in `/warbands/:id/trading`, waar **Warbands** oplicht. Je tikt dus op Trading en ziet een andere tab actief worden. De Trading Post heeft de subtabs Shop · Rules.

### 3.5 My Campaigns (2.000px bij 6 campagnes)
1. Open invites (`CampaignInvitesCard`)
2. Per campagne een kaart: rol, stats, join code, *Game nights*, knop "Open campaign" of "**Switch to this campaign**"
3. Daaronder: Join met code · **Find players** · Start another campaign (ingeklapt)

Bevindingen: "Switch" verandert de globale actieve campagne. Die keuze geldt per apparaat (`localStorage`) en stuurt ook Home en de battle-commit. *Find players* staat bij 6 campagnes op y≈1.740.

### 3.6 Campagne-detail `/campaign` (2.675px op Activity)
BackHeader met de naam en "You're in 6 campaigns". Vijf subtabs:
- **Activity**: aankondiging, volgende game night, recent activity, Battle Log, Campaign Log (narratief)
- **Standings**: standings, rating chart, honours/awards, BTB-objectives, recap
- **Players**: members, join code, pending invites (leader)
- **Territories**
- **Settings**: campagne-instellingen, house rules, danger zone

Bevindingen: de naamgeving loopt door elkaar. De nav-tab heet "Campaign", Home zegt "Campaign Log" en de subtab heet "Activity", waarin zowel een "Battle Log" als een "Campaign Log" staat. De campagne heeft geen eigen URL, dus een link "kijk naar onze campagne" kun je niet delen. `CampaignScreen.tsx` is 1.448 regels: alle vijf tabs zitten in één bestand.

### 3.7 Rules
Zoeken, hoofdstukken, een dice-roller-link en een link naar de custom warbands-galerij. Goed gestructureerd. Wel bestaan er drie rule-ingangen naast elkaar: de tab, de contextuele Rules-subtabs (Warbands, Trading) en `/rules/warbands/:slug`.

### 3.8 Account (2.693px, telefoon)
Volgorde zoals gemeten:

| # | Kaart | Categorie | y (ca.) |
|---|---|---|---|
| 1 | Identiteit (avatar, naam, Listed-chip, View/Edit profile) | **jij** | 90 |
| 2 | Appearance (thema) | apparaat | 320 |
| 3 | Install the app *(conditioneel)* | apparaat | — |
| 4 | Your Data (export/import) | data | 520 |
| 5 | Notifications | apparaat | 720 |
| 6 | Analytics *(conditioneel)* | apparaat/privacy | — |
| 7 | Your details: e-mail + **Sign out** | sessie | 935 (knop ≈1.015) |
| 8 | Your activity | jij | 1.110 |
| 9 | **Admin** | beheer | 1.300 |
| 10 | Game data: 16 bestanden + data-foutmelding | referentie | 1.500 |
| 11 | Demo data *(dev)* | dev | 2.340 |

Bevindingen: zes soorten inhoud zonder groepering, alles in losse kaarten van gelijk gewicht. Apparaatinstellingen staan aan weerszijden van "Your Data". Uitloggen (≈1.015px) en Admin (≈1.300px) vallen allebei buiten het eerste scherm. Game data (16 disclosures en een formulier) is het grootste blok en het minst gebruikt. Changelog en Discord, de natuurlijke "Over de app"-inhoud, staan op Home en niet hier.

### 3.9 Profiel en directory (na §39)
- Eigen profiel: Account › kaart 1 › *View profile* (2 tikken). Bewerken: `/account/profile`.
- Andere spelers: via namen in members, standings, comments en RSVP's.
- Directory `/players`: via My Campaigns (onderaan), de empty state "Looking for a group" en de pending invites van leaders. Niet via Home, Account of de nav.

---

## 4. Probleemanalyse

### 4.1 Navigatie
1. **Te veel tabs, en zonder labels.** 7 (uitgelogd 8) is boven de 3–5 van Material en de 5 van Apple, zie §39.2. Op telefoons ontbreken de labels, en de iconen van Campaign en Rules lijken op elkaar.
2. **De tabs mengen twee soorten bestemmingen.** Home, Warbands, Campaigns, Rules en Account zijn *plekken*. Battle en Trading zijn *acties op een warband*, met een kiezer ervoor. Dat veroorzaakt de oplicht-uitzonderingen (`notActiveFor`, `alsoActiveFor`) en de Trading-→-Warbands-sprong.
3. **Er is geen thuis voor "gereedschap".** Dice, map, solo, compare en de custom builder liggen verspreid. Op die schermen licht niets op, dus de speler raakt zijn plek kwijt, hetzelfde probleem dat §39 voor profielen oploste.
4. **De zwevende knoppen concurreren met headers.** Er zijn twee fixed knoppen plus een CSS-uitzondering per header.

### 4.2 Account
5. **Geen hiërarchie.** Identiteit, apparaatinstellingen, data, sessie, activiteit, admin en referentie staan door elkaar in kaarten van gelijk gewicht.
6. **Veelgebruikte zaken staan diep:** uitloggen en Admin op scherm 2, onder kaarten die je zelden aanraakt.
7. **"Over de app" is versnipperd:** changelog en Discord op Home, game data en datafout-melding op Account.

### 4.3 Profielen en social
8. **De directory is bijna onvindbaar zodra je campagnes hebt:** onderaan een lange lijst, en nergens anders.
9. **Je eigen profiel is een subpagina van Account,** niet iets wat de app als "jou" presenteert. Bij andere apps (Strava, Discord, lichess) staat het eigen profiel bovenaan of in een vast avatar-element.

### 4.4 Campagne-model
10. **De actieve campagne is verborgen globale state.** `/campaign` zonder id, en "Switch" wijzigt Home en de battle-commit per apparaat. Campagnes zijn niet deelbaar of bookmarkbaar, en de back-knop gedraagt zich onvoorspelbaar.
11. **De termen zijn inconsistent:** Campaign / Campaigns / Campaign Log / Activity / Battle Log.

### 4.5 Naamgevingsdrift in code (laag risico, wel verwarrend)
`SettingsScreen` en `strings.settings` heten nu "Account", de tab "Battle" heeft route `/post-battle`, `AdminUserScreen` staat buiten `screens/admin/`, en de spec §4 noemt de tab nog "Settings".

---

## 5. Richtingen om te bespreken (nog geen besluiten)

Dit zijn alleen opties, als startpunt voor de volgende stap.

- **A. Nav naar 5.** Bijvoorbeeld *Home · Warbands · Play · Campaigns · Rules*, met Account als avatar in de header of als 5e "Jij"-tab. Trading verhuist naar de roster, waar het per warband toch al leeft. *Play* bundelt battle, solo, map en dice.
- **B. Account opsplitsen** in: *Jij* (profiel, activiteit) · *Instellingen* (thema, notificaties, install, analytics) · *Je data* · *Over* (changelog, Discord, game data, datafout) · *Admin*. Dat kan als korte lijst met rijen naar subschermen in plaats van tien kaarten. Uitloggen komt onderaan in zicht.
- **C. Campagnes met een eigen URL** (`/campaigns/:id`). "Actieve campagne" blijft dan alleen een standaardkeuze voor Home en de battle-flow, geen verborgen context.
- **D. Directory hoger:** als knop in de header van My Campaigns en/of als "Spelers"-subtab naast "Mijn campagnes".
- **E. Labels terug op telefoons** (klein, onder het icoon). Die keuze hangt samen met A: met 5 tabs passen ze wel.
- **F. Zwevende knoppen opruimen:** de ? en de dobbelsteen naar een header-actie of naar Play/Rules.

---

*Bronnen: `src/App.tsx`, `src/components/navItems.tsx`, `BottomNav.tsx`, `SideNav.tsx`, `src/screens/*`, `src/lib/backNavigation.ts`, `src/lib/activeCampaign.ts`, spec §4, §4.6, §20.4 en §39. Screenshots in demo mode op 375×812.*
