# GitHub Upload and Pages Deployment Guide

> No remote operation was performed during local preparation. Review the files and commands before running them.

## 1. Pre-upload review

From the project root, rerun the checks:

```bash
python -m unittest discover -s tests -v
node --test tests/test_dashboard_metrics.js
```

Confirm that `README.md`, `dashboard/`, `data/`, `src/`, `tests/`, `reports/`, and `.github/workflows/deploy-pages.yml` are present. Generated working files under `work/` and local delivery archives under `outputs/` are intentionally ignored.

## 2. Connect the local project to GitHub

First confirm that `565zybn2sn/manufacturing-financial-analysis` is empty or that replacing its contents is intended. Do not use a force push.

For an empty repository:

```bash
git init
git branch -M main
git add .
git status --short
git commit -m "Add manufacturing FP&A analysis dashboard"
git remote add origin https://github.com/565zybn2sn/manufacturing-financial-analysis.git
git remote -v
git push -u origin main
```

If the remote repository already contains commits, clone it first and copy the reviewed project files into that checkout. Commit normally after resolving any overlap; do not overwrite remote history.

## 3. Enable GitHub Pages

1. Open **Settings → Pages** in the repository.
2. Set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy Dashboard to GitHub Pages**.
4. Run the workflow manually, or allow the push to `main` to trigger it.
5. Confirm that the required-file check, JavaScript tests, artifact upload, and deployment steps all pass.

Expected public URL:

```text
https://565zybn2sn.github.io/manufacturing-financial-analysis/
```

## 4. Post-deployment checks

- English Dashboard loads with charts and 31.62% full-year Actual Gross Margin.
- `EN / 中文` switching works.
- Month and product-line filters update KPIs and charts.
- Browser console contains no errors.
- README screenshot and Synthetic Data / Simulated Company notices remain visible.
