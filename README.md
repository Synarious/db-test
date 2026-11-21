# Deviant Bound BDSM Test

The repo root serves an adults-only BDSM Test. Quick has 30 questions and covers all 29 categories. Advanced adds 39 follow-ups across the same categories. Both use a 1–5 scale and calculate separate weighted scores for each category.

## Run locally

Open `index.html` or `quiz.html` directly in your browser. Keep the `css`, `img`, and `js` folders alongside the HTML files. The browser bundle is included, so opening the pages requires no install or local server. Profile and progress storage for files opened directly depends on your browser. You can transfer progress between the local files and the hosted site with a JSON backup.

For an HTTP preview, run `npm run dev` and open `http://127.0.0.1:4173/`. Use `QUIZ_PORT` to override the port. To work on the JavaScript, install the build dependency with `npm ci`. After editing the JavaScript source or `img/icon-texture.png`, run `npm run build` and include the updated `js/browser.bundle.js` with your changes.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `quiz.html`, `results.html`, `profiles.html`, `about.html` | Home, questionnaires, results, profile management, and privacy pages |
| `css/site.css`, `js/site.js` | Shared navigation, controls, and theme customization |
| `js/browser.js`, `js/browser.bundle.js` | Browser entry point and generated classic script for local and hosted pages |
| `css/quiz.css`, `css/results.css` | Quiz and chart layouts, including print styling |
| `js/questions.js`, `js/roles.js` | Statement bank, per-item weights and reasoning, and category definitions |
| `js/quiz-state.js`, `js/quiz.js`, `js/session.js` | Response scale, quiz navigation, and per-mode drafts for Default and saved profiles |
| `js/profile-store.js`, `js/profiles-page.js` | Local profile storage, backup files, and profile management |
| `js/scoring.js`, `js/score-list.js`, `js/results-page.js` | Weighted scoring, chart rendering, and report actions |
| `docs/question-bank.md` | Reviewable questions, weights, reasoning, and category coverage |
| `scripts/serve.js` | Local static file server |

`working.html` forwards to the new quiz page. The existing `CNAME` remains the static host configuration.

## Maintaining the questionnaire

Edit the canonical items in `js/questions.js` and regenerate the [question bank reference](docs/question-bank.md) with `npm run questions`. Keep item IDs stable for wording clarifications. Increment the draft storage version when changing the meaning of an existing item. Run `npm test` to verify coverage and scoring.

The browser remembers your age choice across pages, tabs, and visits. Default and named profiles use local storage for separate drafts in both modes. Named profiles also store themes and optional results details. Opening the quiz from the main navigation resumes the most recently edited unfinished test for the active profile. Local report addresses reopen the same profile and test mode in that browser. If browser storage cannot keep finished answers between tabs, the quiz shows the scores with backup and sharing options on the same page.

Use **Save / Share → Download JSON backup** on a local report or **Export backup** in Profiles to preserve individual answers, profile settings, and any imported report. Default progress can also be backed up from Profiles. Importing a JSON backup creates a separate named profile. **Copy results link** and native sharing transfer role scores via the URL fragment. To save those scores locally, use **Profiles → Import share link** or **Import shared results** on an open shared report. Example links open `results.html#preview`. Printing saves the chart and optional details currently shown.
