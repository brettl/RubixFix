# RubixFix

Scan a Rubik's cube with your camera and get a step-by-step solution, built into one self-contained HTML page.

- `npm run build` (or `rubixfix.bat build`) inlines the CSS, the solver and the app into `dist/index.html`.
- `rubixfix.bat start` builds, serves on `http://localhost:5210` (localhost counts as a secure origin, so the camera works) and opens the browser.
- `npm test` sanity-checks the solver.

The solver in `vendor/` is [cubejs](https://github.com/ldenoue/cubejs) (MIT, see `vendor/cubejs-LICENSE.txt`).

This repository is published for viewing only, see `LICENSE`.
