# eCTD Dossier Builder

A browser-based practice platform for regulatory publishing. You assemble, publish and validate an eCTD dossier for a fictional product, the way a regulatory operations team does: place documents into the CTD tree, complete Module 1, build the XML backbone, clear the validator, and manage lifecycle sequences.

Built for regulatory affairs freshers and students, RAC candidates, and anyone who wants to see how eCTD works from the inside.

> **Training only.** Every product, company, document, study and person in the app is fictional. Section codes, form numbers and XML element names follow the public ICH and FDA specifications, but nothing the app produces is suitable for a real submission.

## What is in this release (Phases 1 and 2)

**Learn.** Lessons 1–7 (What CTD is; CTD vs eCTD vs NeeS; Granularity; The backbone; Lifecycle; v3.2.2 vs v4.0; Regional differences), each with an interactive exercise and a quiz, eight lifecycle drills, and a searchable glossary.

**Products.** Three fictional products, each with its own document library and structured facts:
- Ostrevia (lumiravostat) film-coated tablets: a new chemical entity (US NDA or EU MAA), with two granularity decoys.
- Talmisartan tablets: a generic referencing a fictional listed drug (US ANDA), with bioequivalence studies and a biowaiver request.
- Nelvaprox (velnaprozine) solution for injection in vials (US NDA or EU MAA), with sterile-product documents.

**Regions.** The engine is region-neutral; each region is a data pack.
- US: the full Module 1 heading list from FDA's Comprehensive Table of Contents (v2.3.5), the us-regional.xml metadata, FDA submission types and sub-types (from the Module 1 backbone specification v2.6), checklists for NDA and ANDA applications, supplements, amendments, annual reports and periodic safety reports, and study tagging files for Modules 4 and 5.
- EU: the Module 1 tree, folders and file-naming conventions from the EU M1 specification, the eu-regional.xml envelope (UUID, tracking number, submission type and mode, submission unit, related sequence), centralised MAA, response and variation checklists, and an eAF practice form.

**Builder and publishing.** Drag and drop (or Pick up and Enter) into the CTD tree; misplacement and granularity warnings; required/optional view and a dossier map; real stub PDFs generated with pdf-lib (title page, bookmarks, linked table of contents, cross-document links, key facts, defects built into the file); a publishing tab with a bookmark editor, TOC generator, hyperlink manager, broken-link finder and leaf-title consistency checker.

**Backbone and validation.** index.xml, the regional XML, index-md5.txt and study tagging files, shown raw and rendered, with a folder tree and publishing log; publishing records the MD5 of every file's real bytes. 57 core rules across backbone, files and folders, PDF, lifecycle, US and EU Module 1, study grouping, content and granularity, with a verdict line and PDF/CSV report download.

**Lifecycle.** Sequences with new, replace, append and delete; an operation picker with an expert mode; publish-and-freeze; current and cumulative views; per-document history; EU related sequences, grouping and worksharing.

**Cross-module consistency QC.** Every document states structured facts (strengths, dosage form, shelf life, storage, manufacturers, limits, excipients, batches, patient numbers, indication). A matrix compares each fact wherever it is stated and highlights contradictions; reviewer's eye mode hides the highlights so you hunt first; corrections revise a draft document or create a new version to send with replace.

**Missions.** Eleven missions at guided, standard and expert levels: 1 first NDA; 2 centralised MAA; 4 information request; 5 EU list of questions; 6 new manufacturing site (PAS vs Type IB); 7 safety labelling update (CBE-0 vs Type II); 8 annual report and PADER; 9 DMF support; 10 paper to eCTD baseline; 11 rescue the dossier; 12 generic application. Each is scored on technical validity, lifecycle correctness, cross-module consistency and time.

**Progress.** Career levels (Associate, Specialist, Senior Specialist, Lead), eight badges, strengths and weak areas, and mission and lesson history.

**Project files.** Export and import as JSON. Every project and attempt carries a user ID and class ID, so classroom mode (Phase 4) needs no migration.

Phase 3 adds eCTD v4.0 and the Japan pack, the mock gateway and review clock, the questions engine, planning and tracking, India Module 1 and biologic products.

## How it works

The app is fully static. There is no server and no account: projects are stored in the browser's IndexedDB, and the project file is the way to move work between devices or hand it to a mentor.

Content lives in data files so it can grow without code changes:

| File | What it holds |
| --- | --- |
| `src/data/ctd-tree.json` | ICH Modules 2–5 headings, element names and folder names |
| `src/data/us-m1.json` | US Module 1 headings, submission types, forms and checklists |
| `src/data/eu-m1.json` | EU Module 1 headings, folders, envelope values and checklists |
| `src/data/consistency.json` | Facts compared across modules and the headings that state them |
| `src/data/drills.json` | Lifecycle drills |
| `src/data/products/*.json` | The fictional products, their facts and document libraries |
| `src/data/rules.json` | Validation rule library and required headings |
| `src/data/missions.json` | Mission briefs, steps, hints and checks |
| `src/data/lessons.json` | Lesson text and quizzes |
| `src/data/ectd-status.json` | Where eCTD v3.2.2 and v4.0 stand by region (dated) |
| `src/data/glossary.json` | Glossary terms |

The engine (`src/engine/`) is plain JavaScript with no UI dependencies: `tree.js` (heading index and paths), `model.js` (project model and lifecycle state), `ops.js` (placement, fixes, publishing), `validate.js` (rule engine), `backbone.js` (XML and checksums), `stf.js` (study tagging files), `regiondocs.js` (generated regional Module 1 documents), `consistency.js` (cross-module QC), `progress.js` (levels and badges), `pdfgen.js` and `pdfmeta.js` (stub PDFs, loaded only when a PDF is built), `report.js` (validation report), `missions.js` (seeds and scoring), `db.js` (IndexedDB) and `io.js` (export and import).

## Run it locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine and mission tests
node tests/pdf-sample.mjs out/   # write sample stub PDFs to inspect
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173
```

## Publish to GitHub Pages

The build uses relative paths, so it works from `https://<user>.github.io/<repo>/` without configuration.

1. Create a public repository, for example `ectd-dossier-builder`, under your account and push this source to `main`.
2. Build locally: `npm run build`.
3. Push the contents of `dist/` to a `gh-pages` branch, for example with `npx gh-pages -d dist --dotfiles`.
4. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, and select `gh-pages` / root.

The site appears at `https://<user>.github.io/ectd-dossier-builder/` after a minute or two. Repeat steps 2 and 3 for each update.

## Accessibility

Every drag-and-drop action has a keyboard path, tree headings are reachable with Tab and arrow keys, status is never shown by colour alone (dots have outlines and labels, severities have words), and the layout works from phone width up, in light and dark themes.

## Sources for the status table

- PMDA eCTD v4.0 mandate guide — meddeviceguide.com
- ProductLife Group, global eCTD v4.0 adoption
- EMA eSubmission, EU eCTD v4.0 validation criteria
- GMP-Compliance, Swissmedic eCTD v4.0
- Freyr, India and SUGAM

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). If you reuse or adapt this code, keep the NOTICE file so the author stays credited.

Built by **Khan Gulrez Shagufa Fazal Ahmed** · ORCID [0009-0009-6195-0329](https://orcid.org/0009-0009-6195-0329)
