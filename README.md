# eCTD Dossier Builder

A browser-based practice platform for regulatory publishing. You assemble, publish and validate an eCTD dossier for a fictional product, the way a regulatory operations team does: place documents into the CTD tree, complete Module 1, build the XML backbone, clear the validator, and manage lifecycle sequences.

Built for regulatory affairs freshers and students, RAC candidates, and anyone who wants to see how eCTD works from the inside.

> **Training only.** Every product, company, document, study and person in the app is fictional. Section codes, form numbers and XML element names follow the public ICH and FDA specifications, but nothing the app produces is suitable for a real submission.

## What is in this release (Phases 1 to 5)

**Learn.** Lessons 1–7 (What CTD is; CTD vs eCTD vs NeeS; Granularity; The backbone; Lifecycle; v3.2.2 vs v4.0; Regional differences), each with an interactive exercise and a quiz, eight lifecycle drills, and a searchable glossary.

**Products.** Six fictional products, each with its own document library and structured facts:
- Ostrevia (lumiravostat) film-coated tablets: a new chemical entity (US NDA or EU MAA), with two granularity decoys.
- Talmisartan tablets: a generic referencing a fictional listed drug (US ANDA), with bioequivalence studies and a biowaiver request.
- Nelvaprox (velnaprozine) solution for injection in vials (US NDA or EU MAA), with sterile-product documents.
- Arventa (olvecitamab) concentrate for infusion: a monoclonal antibody (US BLA under 351(a) or EU MAA), with cell bank, viral safety and immunogenicity documents.
- Selvanta (olvecitamab-kzrt): a proposed biosimilar to Arventa (US 351(k) BLA or EU MAA with 1.5.2), with comparative analytical, PK and efficacy studies.
- Talvera XR (talmisartan) extended-release capsules: a 505(b)(2) NDA relying on a listed drug and literature, bridged by a relative bioavailability study.

Ostrevia can also be built as a US initial IND, a US Type II DMF (from the API maker's side), an EU decentralised or national procedure, an EU ASMF with applicant's and restricted parts, an India clinical trial application (Form CT-04), a Canadian new drug submission and a Swiss new active substance application.

**Regions.** The engine is region-neutral; each region is a data pack.
- US: the full Module 1 heading list from FDA's Comprehensive Table of Contents (v2.3.5), the us-regional.xml metadata, FDA submission types and sub-types (from the Module 1 backbone specification v2.6), checklists for NDA and ANDA applications, supplements, amendments, annual reports and periodic safety reports, and study tagging files for Modules 4 and 5.
- EU: the Module 1 tree, folders and file-naming conventions from the EU M1 specification, the eu-regional.xml envelope (UUID, tracking number, submission type and mode, submission unit, related sequence), centralised MAA, response, variation, renewal and transfer checklists, and an eAF practice form.
- Japan (eCTD v4.0): Module 1 headings 1.1 to 1.13 in English and Japanese, the cover filed outside the XML, Japanese Module 1 and Module 2 documents, and submission unit metadata (reception number, brand name, JAN, applicant, product category).
- India: the CTD Module 1 for the online portal (no backbone XML), Form CT-18 for import and CT-21 for manufacture, the fee receipt, the authorised agent's documents and the request to waive the local clinical trial; and the clinical trial application in Form CT-04 with the protocol, investigator's brochure, informed consent documents and investigators' undertakings.
- Canada: the Canadian Module 1 from Health Canada's placement guidance, ca-regional.xml with the regulatory transaction information (dossier identifier, regulatory activity, sequence description), and NDS checklists (product monograph, labels, CPID, risk management plan, empty 1.2.2 and 1.5).
- Switzerland: the Swiss Module 1 and its folders under m1/ch/<galenic form>/, ch-regional.xml with the Swiss envelope (including article-13-tpa), and checklists for a new active substance.
- EU procedures beyond centralised: decentralised, mutual recognition and national, with one envelope per receiving member state, country and language folders for product information, and the procedure number formats; and the ASMF, one sequence with 2.3.S and 3.2.S split into AP and RP.
- US application types beyond NDA, ANDA and BLA: the initial IND (Forms 1571, 1572 and 3674, the general investigational plan in 1.20, the investigator's brochure, the protocol tagged protocol-or-amendment), the 505(b)(2) NDA (patent certification for the listed drug) and the Type II DMF (Form FDA 3938, letters of authorization).

**Builder and publishing.** Drag and drop (or Pick up and Enter) into the CTD tree; misplacement and granularity warnings; required/optional view and a dossier map; real stub PDFs generated with pdf-lib (title page, bookmarks, linked table of contents, cross-document links, key facts, defects built into the file); a publishing tab with a bookmark editor, TOC generator, hyperlink manager, broken-link finder and leaf-title consistency checker.

**Backbone and validation.** index.xml, the regional XML, index-md5.txt and study tagging files, shown raw and rendered, with a folder tree and publishing log; publishing records the MD5 of every file's real bytes. 104 rules across backbone, files and folders, PDF, lifecycle, eCTD v4.0, US, EU, Japan, India, Canada and Switzerland Module 1, study grouping, content and granularity, with a verdict line and PDF/CSV report download.

**eCTD v4.0.** One submissionunit.xml per unit, modelled on the ICH and PMDA v4.0 implementation guides: units numbered 1, 2, 3; documents placed by contexts of use with priority numbers; replacementOf for replace; statusCode "suspended" in place of delete; document reuse by reference (the file is not sent again); study keywords in place of study tagging files; SHA-256 checksums and sha256.txt.

**Review simulator.** A mock gateway with staged acknowledgments (technical rejection reopens the sequence with the same number); region review clocks (US filing and goal date, EU Day 120 and Day 180 clock stops, Japan inquiries, India's 90 working days); a questions engine that raises questions from missing sections, contradictions and each product's scientific weaknesses; response checking; and a timeline.

**Planning and tracking.** A content plan per sequence (owner, due date, status, late flags), a dossier timeline with the critical path, a registration tracker, commitments, a correspondence log fed by the review simulator, reuse of Modules 2 to 5 for another country, and CSV exports.

**Lifecycle.** Sequences with new, replace, append and delete; an operation picker with an expert mode; publish-and-freeze; current and cumulative views; per-document history; EU related sequences, grouping and worksharing.

**Cross-module consistency QC.** Every document states structured facts (strengths, dosage form, shelf life, storage, manufacturers, limits, excipients, batches, patient numbers, indication). A matrix compares each fact wherever it is stated and highlights contradictions; reviewer's eye mode hides the highlights so you hunt first; corrections revise a draft document or create a new version to send with replace.

**Missions.** Twenty-four missions at guided, standard and expert levels: 1 first NDA; 2 centralised MAA; 3 Japan NDA under v4.0; 4 information request; 5 EU list of questions; 6 new manufacturing site (PAS vs Type IB); 7 safety labelling update (CBE-0 vs Type II); 8 annual report and PADER; 9 DMF support; 10 paper to eCTD baseline; 11 rescue the dossier; 12 generic application; 13 biosimilar application; 14 new drug application in India; 15 renewal and transfer; 16 withdrawal; 17 initial IND; 18 505(b)(2) application; 19 Type II DMF and a letter of authorization; 20 decentralised procedure; 21 active substance master file; 22 clinical trial application in India; 23 new drug submission in Canada; 24 Switzerland under Article 13. Each is scored on technical validity, lifecycle correctness, cross-module consistency and time.

**Region comparison.** The same Module 1 items side by side for the US, EU, Japan, India, Canada and Switzerland; "Where does it go?" and "One document, six regions" exercises; and a CTD to ASEAN ACTD conversion exercise.

**Quiz bank.** Over 120 RAC-style questions tied to every lesson and mission (the written bank plus every lesson quiz, mission quiz and lifecycle drill): practice by topic, or a 30-question, 40-minute mock exam with a topic breakdown.

**Exports.** A zipped eCTD folder per sequence or for every published sequence, with the backbone XML (or the v4.0 submission unit) and watermarked stub PDFs whose checksums match the backbone; plus the project file, the validation report and the planning CSVs.

**Certificate.** A completion certificate PDF, labelled as a portfolio exercise and not an accreditation, once every lesson, every mission, the mock exam and the region comparison exercises are passed (with distinction for 8 or more missions at expert level), with a verification code and a record of results. A statement of progress is available at any time.

**Classroom mode (optional).** An instructor creates a class and shares a join code; students join, start assigned missions with deadlines, and submit their project files; the instructor sees scores and validation results, re-scores each submission in their own browser, comments, and sees a leaderboard; optional email reminders go out through Brevo. It runs on a Cloudflare Worker and a D1 database from the `worker/` folder: add two Cloudflare secrets to the repository and run the "Deploy classroom server" action, which deploys it and rebuilds the site with it built in (see [worker/README.md](worker/README.md)). Without it, the app stays fully browser-only.

**Progress.** Career levels (Associate, Specialist, Senior Specialist, Lead), ten badges, strengths and weak areas, and mission and lesson history.

**Change packages from the Variations Classifier.** The [Variations Classifier](https://github.com/randomthingsonlineatsk-cloud/variations-classifier), a separate app, classifies post-approval changes and exports a `change-package.json`. On the Sequences tab, **Import change package** starts a draft sequence of the right submission type, uses the package's cover letter, and lists the leaves to add with their operations as a to-do list. Packages come for the US, EU, India, Canada (Level III notices, notifiable changes, SNDS and SANDS), Switzerland (Type IA to II) and Japan (partial change applications and change plans); the classroom server also hosts that app's classes under `/vc/v1`.

**Labelling packages from the Labelling Workbench.** The [Labelling Workbench](https://github.com/randomthingsonlineatsk-cloud/labelling-workbench) exports a `labelling-package.json`. On the Sequences tab, **Import labelling package** adds the labels to the draft sequence (or starts one of the package's submission type) in the Module 1 labelling node of their region: US 1.14, EU 1.3.1 (one combined product information document), India 1.3, Canada and Switzerland 1.3.1 and 1.3.2, and Japan 1.8 (the Workbench's insert is an English practice text, so the import warns that Japan expects Module 1 in Japanese).

**IND packages from the Clinical Trial Simulator.** The [Clinical Trial Simulator](https://github.com/randomthingsonlineatsk-cloud/clinical-trial-simulator) exports an `ind-package.json` from its US IND step. In a US project, **Import IND package** on the Sequences tab places the initial IND (21 CFR 312.23) in the draft sequence, or in a new original application: Forms FDA 1571, 1572 and 3674 in 1.1, the cover letter in 1.2, the general investigational plan in 1.20, the investigator's brochure in 1.14.4.1, the investigational labels in 1.14.4.2, the quality and nonclinical summaries in 2.3 and 2.4, and the protocol in 5.3.3.1 (healthy volunteers) or 5.3.3.2 (patients). It warns if the project is not an IND.

**Project files.** Export and import as JSON. Every project and attempt carries a user ID and class ID, so classroom mode (Phase 4) needs no migration.


## How it works

The app is fully static. There is no server and no account: projects are stored in the browser's IndexedDB, and the project file is the way to move work between devices or hand it to a mentor. Classroom mode is the one exception, and it is opt-in: it talks to the small API in `worker/`.

Content lives in data files so it can grow without code changes:

| File | What it holds |
| --- | --- |
| `src/data/ctd-tree.json` | ICH Modules 2–5 headings, element names and folder names |
| `src/data/us-m1.json` | US Module 1 headings, submission types, forms and checklists |
| `src/data/eu-m1.json` | EU Module 1 headings, folders, envelope values and checklists |
| `src/data/jp-m1.json` | Japan Module 1 headings (English and Japanese), controlled vocabulary codes and checklists |
| `src/data/in-m1.json` | India Module 1 headings, forms and checklists |
| `src/data/ca-m1.json` | Canada Module 1 headings, transaction values and checklists |
| `src/data/ch-m1.json` | Swiss Module 1 headings, folders, envelope values and checklists |
| `src/data/compare.json` | Module 1 items across six regions, and the CTD to ACTD map |
| `src/data/quizbank.json` | The written quiz bank, by topic, linked to lessons and missions |
| `src/data/review.json` | Gateway stages, review clocks and product weaknesses for the review simulator |
| `src/data/consistency.json` | Facts compared across modules and the headings that state them |
| `src/data/drills.json` | Lifecycle drills |
| `src/data/products/*.json` | The fictional products, their facts and document libraries |
| `src/data/rules.json` | Validation rule library and required headings |
| `src/data/missions.json` | Mission briefs, steps, hints and checks |
| `src/data/lessons.json` | Lesson text and quizzes |
| `src/data/ectd-status.json` | Where eCTD v3.2.2 and v4.0 stand by region (dated) |
| `src/data/glossary.json` | Glossary terms |

The engine (`src/engine/`) is plain JavaScript with no UI dependencies: `tree.js` (heading index and paths), `model.js` (project model and lifecycle state), `ops.js` (placement, fixes, publishing), `validate.js` (rule engine), `backbone.js` (XML and checksums), `stf.js` (study tagging files), `v4.js` and `sha256.js` (eCTD v4.0 submission unit and checksums), `review.js` (gateway, clock and questions), `planning.js` (content plan, critical path, trackers, reuse), `compare.js` (region comparison), `quiz.js` (quiz bank), `certpdf.js` (certificate), `zipexport.js` (zipped folders), `classroom.js` (classroom client), `regiondocs.js` (generated regional Module 1 documents), `consistency.js` (cross-module QC), `progress.js` (levels and badges), `pdfgen.js` and `pdfmeta.js` (stub PDFs, loaded only when a PDF is built), `report.js` (validation report), `missions.js` (seeds and scoring), `db.js` (IndexedDB) and `io.js` (export and import).

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

## Sources for the Phase 3 packs

- PMDA, eCTD v4.0 implementation guide and Japanese Module 1 code lists (pmda.go.jp)
- Japan Generic Medicines Association, CTD Module 1 structure (jga.gr.jp)
- CDSCO, guidance on the CTD format for India, and the New Drugs and Clinical Trials Rules, 2019 (Forms CT-18 and CT-21, Rule 101, the Sixth Schedule)
- EU eCTD harmonised technical guidance (technical validation and resubmission with the same sequence number)
- FDA, eCTD Module 1 backbone specification and comprehensive table of contents; 21 CFR 314.65 (withdrawal without prejudice to refiling)
- Health Canada, guidance on organization and document placement for Canadian Module 1
- Swissmedic, Swiss Module 1 specification for eCTD, version 1.6
- ASEAN, Common Technical Dossier: organization of the dossier

The review clocks are simplified teaching models of the public procedures, not a statement of any agency's current timelines.

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). If you reuse or adapt this code, keep the NOTICE file so the author stays credited.

Built by **Khan Gulrez Shagufa Fazal Ahmed** · ORCID [0009-0009-6195-0329](https://orcid.org/0009-0009-6195-0329)
