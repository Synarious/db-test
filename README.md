# Deviant Bound BDSM Quiz

The repo root serves an adults-only BDSM Quiz. Standard mode has 30 questions and covers all 29 categories. Advanced mode adds 39 follow-ups across the same categories. Both use a 1–5 scale and calculate separate weighted scores for each category.

## Run locally

With Node.js and npm installed, run `npm run dev` and open `http://127.0.0.1:4173/`. Use `QUIZ_PORT` to override the port. The site has zero package dependencies and requires no build. Serve the HTML over HTTP so the browser can load the JavaScript modules.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `quiz.html`, `results.html`, `profiles.html`, `about.html` | Home, questionnaires, results, profile management, and privacy pages |
| `css/site.css`, `js/site.js` | Shared navigation, controls, and theme customization |
| `css/quiz.css`, `css/results.css` | Quiz and chart layouts, including print styling |
| `js/questions.js`, `js/roles.js` | Statement bank, per-item weights and reasoning, and category definitions |
| `js/quiz-state.js`, `js/quiz.js`, `js/session.js` | Response scale, quiz navigation, and per-mode guest or profile drafts |
| `js/profile-store.js`, `js/profiles-page.js` | Local profile storage, backup files, and profile management |
| `js/scoring.js`, `js/score-list.js`, `js/results-page.js` | Weighted scoring, chart rendering, and report actions |
| `docs/question-bank.md` | Reviewable questions, weights, reasoning, and category coverage |
| `scripts/serve.js` | Local static file server |

`working.html` forwards to the new quiz page. The existing `CNAME` remains the static host configuration.

## Maintaining the questionnaire

Edit the canonical items in `js/questions.js` and regenerate the [question bank reference](docs/question-bank.md) with `npm run questions`. Keep item IDs stable for wording clarifications. Increment the draft storage version when changing the meaning of an existing item. Run `npm test` to verify coverage and scoring.

Guest answers and age confirmation use session storage for the current tab. Named profiles use local storage for their themes, optional results details, and separate drafts for both modes. Use **Profiles** to create a profile, optionally copy this tab’s guest progress, or transfer a profile with a JSON backup. Share links open a generic example via `results.html#preview`. Printing saves the chart and optional details currently shown.
