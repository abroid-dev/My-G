# Geleta Addis · Double Entry

The personal site of Geleta Addis, built as a ledger. Each role is entered on two sides, the customer side and the company side.

Sources: her LinkedIn export (`Profile.pdf`) and her CV (`Geleta Addis CV.pdf`), both November 2026. Where they disagree, the CV wins. Missing information is shown as red **TO RECONCILE** placeholders. Nothing has been invented.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # type-check + static build into dist/
npm run preview    # serve the built site
```

## Where everything lives

All facts are in `src/content/`. Components never contain biography.

| File | What it holds |
|---|---|
| `profile.yaml` | Name, **positioning** (provisional), statement, portrait annotations, contact, SEO, the `showPlaceholders` switch |
| `entries/*.md` | One file per role: dates, chapter, customer side, company side, figures, pending items |
| `studies/*.md` | Degrees, diploma, certificates |
| `chapters.yaml` | The five chapters of the journey and their "carried forward" lines |
| `accounts.yaml` | The chart of accounts (expertise). Evidence is computed from entries |
| `cases/*.md` | Case studies. Only `status: published` ones appear |
| `references/*.md` | Testimonials. Only `published` + `permission: true` ones appear |

## Updating from her CV

**Add a figure to a role.** Edit `src/content/entries/<role>.md`:
```yaml
reconciliation:
  - figure: "+40%"
    label: "growth in active merchants, 2023"
    source: "CV, 2026"        # required: every number names its source
pending: []                    # remove what you've now answered
```

**Add a new role.** Copy any entry file, rename it, and set `chapter`, `start`, `end` (`null` = present) and `accounts`. Numbering, durations, the "Alongside" overlaps, the path diagram and the chart of accounts all update automatically.

**Change the positioning.** In `profile.yaml`, set `positioning.title`. Set `provisional: false` once Geleta confirms it.

**Publish a case study.** Fill in `cases/_template-ebirr-campaigns.md` (or copy it), then set `status: published`. A page appears at `/entries/<file-name>/` and a "Selected entries" folio is added to the home page and index.

**Go live without placeholders.** Set `showPlaceholders: false` in `profile.yaml`. Empty fields then disappear cleanly.

**Receive form messages.** Paste a Formspree or Netlify Forms URL into `contact.formEndpoint`. Until then, the form opens a pre-filled email.

**Domain.** Replace `https://geletaaddis.com` in `astro.config.mjs`, `profile.yaml` and `public/robots.txt`.

## Share a review link (GitHub Pages)
1. Create a GitHub repo (private repos need a paid plan for Pages, so a public one is simplest), then push this folder to its `main` branch.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push. The link is `https://<your-username>.github.io/<repo-name>/` (shown in the Actions run).
4. The review deploy asks search engines not to index it (`PUBLIC_NOINDEX` in the workflow). Remove that line when the site goes live on its own domain, and set the real domain in `astro.config.mjs`, `profile.yaml` and `public/robots.txt`.

## CV vs LinkedIn: how conflicts were resolved
| Item | LinkedIn | CV | On the site |
|---|---|---|---|
| CCO employer | Emaal, Mar 2026 | FinPay Digital Financial Solution S.C, Feb 2026 | Both, as two current roles (confirmed by the user: she worked at two places) |
| Wildberries, Key Account Manager | Mar 2026 to now | not listed | Kept, flagged for review (`?review`) until she confirms |
| Chapa | Jan to Mar 2026 | 25 Dec 2025 to 20 Feb 2026 | CV |
| e-birr marketing | Aug 2020 to Feb 2024 | Aug 2022 to Jan 2024 | CV |
| e-birr call centre and sales rep | not listed | Mar to Aug 2021 | Added from the CV |
| YaYa Wallet | Nov 2024 to Dec 2025 | "Nov 25, 2025 to Dec 28, 2026" (impossible end date) | LinkedIn dates, flagged. Duties from the CV |
| Ethiopian Airlines title | Flight consultant, GCIC | International Call Center and Customer Care Agent | CV title, LinkedIn title kept as the note |
| Degrees | BSc / MBA | BA / MA | CV wording |
| Diploma | Aviation Academy Ethiopia | Ethiopian Airlines | CV institution |

Not published on purpose: her phone number and the three referees' names and numbers (privacy).

## Open questions for Geleta
- Emaal is on LinkedIn but not on her CV, and FinPay is on her CV but not LinkedIn. Add each to the other.
- YaYa Wallet: are the real dates Nov 2024 to Dec 2025 (LinkedIn)? The CV dates are inconsistent.
- Wildberries: is it a current role?
- BA or BSc for the engineering degree? Master's: MA or MBA?
- Marketing strategist or commercial leader: which does she want to lead with?
- What Emaal does, and her remit as CCO
- Scope of the Wildberries, Chapa and YaYa Wallet roles
- Figures for any role
- What AICE is (her headline says "AICE Mentor")
- LinkedIn recommendations she is happy to publish
- Permission for the portrait, and any further photography

## Design system
- **Paper** `#e8efe5` · **Ink** `#1a2340` (her blazer) · **Red ink** `#9b2c2c` (her lip colour) · **Gilt** `#8a6a36` (her earrings)
- Newsreader (variable, optical sizes) for everything read; IBM Plex Mono for labels, dates and figures
- Tokens in `src/styles/tokens.css`. Night ledger theme included, following the system setting or the toggle.
- Motion: pen-like rules, one load sequence, reveals once. Everything is static under `prefers-reduced-motion`.
