# eCTD Dossier Builder

A browser-based practice platform for regulatory publishing. You assemble, publish and validate an eCTD dossier for a fictional product, the way a regulatory operations team does: place documents into the CTD tree, complete Module 1, build the XML backbone, clear the validator, and manage lifecycle sequences.

Built for regulatory affairs freshers and students, RAC candidates, and anyone who wants to see how eCTD works from the inside.

> **Training only.** Every product, company, document, study and person in the app is fictional. Section codes, form numbers and XML element names follow the public ICH and FDA specifications, but nothing the app produces is suitable for a real submission.

## What is in this release (Phase 1 · Core)

- **Learn:** lessons 1–7 (What CTD is; CTD vs eCTD vs NeeS; Granularity; The backbone; Lifecycle; v3.2.2 vs v4.0; Regional differences), each with an interactive exercise and a quiz, plus a searchable glossary.
- **One fictional product:** Ostrevia (lumiravostat) film-coated tablets, 10 mg and 25 mg, a new chemical entity, with a 106-document library and two granularity decoys.
- **US pack, eCTD v3.2.2:** the US Module 1 tree (1.1–1.20) with a metadata form, NDA checklist, cover-letter generator and a practice 356h form; the full ICH Modules 2–5 heading tree with repeatable 3.2.S, 3.2.P and 5.3.5 sections.
- **Real stub PDFs:** every library document is generated in the browser with pdf-lib: a title page, invented content, bookmarks, an optional linked table of contents and relative cross-document links. Defects are built into the file: the PDF version in the header, non-embedded fonts, scanned pages without text, missing bookmarks and broken links (document security is simulated, as pdf-lib cannot encrypt). Open any document in the browser's PDF viewer or download it.
- **Builder:** drag and drop documents onto headings (with a keyboard alternative: *Pick up*, select a heading, press Enter), misplacement and granularity warnings, a placeholder view (required, optional, not used in eCTD), a dossier map heat map, and a properties panel with "publishing tool" fixes for PDF problems.
- **Study tagging files (US):** study ID and file tag on every Module 4.2 and 5.3 leaf, one generated STF per study and heading, listed in the backbone.
- **Publishing tools:** bookmark editor with auto-bookmarking, table-of-contents generator, hyperlink manager, a broken-link finder and a leaf-title consistency checker.
- **Backbone viewer:** live `index.xml`, `m1/us/us-regional.xml`, `index-md5.txt` and study tagging files; publishing generates every PDF and records the MD5 of its real bytes, a reviewer-style rendered view next to the raw XML, the folder tree, and a publishing log.
- **Validation engine:** 39 core rules across backbone, files and folders, PDF, lifecycle, Module 1, study grouping, content and granularity; high/medium/low severity; each finding links to its heading with an explanation and a fix; a verdict on whether an agency would likely reject the sequence; the report downloads as PDF or CSV.
- **Lifecycle:** sequences 0000, 0001 …, new/replace/append/delete with an operation picker (expert mode allows invalid targets on purpose), publish-and-freeze, current vs cumulative view, per-document history.
- **Missions 1, 4 and 11** at guided, standard and expert levels: first NDA; answer an information request; rescue a dossier with 25 planted defects in 30 minutes.
- **Project export and import** as a JSON file.

Later phases add the EU, Japan (v4.0), Canada, Switzerland and India packs, consistency QC, the review clock, planning and tracking, scoring badges and classroom mode. The data model already carries a `userId` and `classId` on every project and attempt, so classroom mode needs no migration.

## How it works

The app is fully static. There is no server and no account: projects are stored in the browser's IndexedDB, and the project file is the way to move work between devices or hand it to a mentor.

Content lives in data files so it can grow without code changes:

| File | What it holds |
| --- | --- |
| `src/data/ctd-tree.json` | ICH Modules 2–5 headings, element names and folder names |
| `src/data/us-m1.json` | US Module 1 headings, submission types, forms and checklists |
| `src/data/products/nce-tablet.json` | The fictional product and its document library |
| `src/data/rules.json` | Validation rule library and required headings |
| `src/data/missions.json` | Mission briefs, steps, hints and checks |
| `src/data/lessons.json` | Lesson text and quizzes |
| `src/data/ectd-status.json` | Where eCTD v3.2.2 and v4.0 stand by region (dated) |
| `src/data/glossary.json` | Glossary terms |

The engine (`src/engine/`) is plain JavaScript with no UI dependencies: `tree.js` (heading index and paths), `model.js` (project model and lifecycle state), `ops.js` (placement, fixes, publishing), `validate.js` (rule engine), `backbone.js` (XML and checksums), `stf.js` (study tagging files), `pdfgen.js` and `pdfmeta.js` (stub PDFs, loaded only when a PDF is built), `report.js` (validation report), `missions.js` (seeds and scoring), `db.js` (IndexedDB) and `io.js` (export and import).

## Run it locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests
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
