# Contract template validation

- Original: `src/assets/contracts/contrato-stayo-original.docx` (modelo RAVENA 106, inclui item 15 – Implantação); SHA-256 pinned in the template map.
- Generation edits text ranges in allowlisted paragraphs only. All other OOXML package parts, fixed clauses, table/run/paragraph properties and branding remain unchanged.
- Automated checks: identical uncompressed package with original inputs; all fixed clause XML and non-document parts unchanged with variable inputs; contractual duration and complementary percentages.
- Authenticated UI: example registration in this draft, Commercial → Generate contract → review → prepare → download; DOCX validated, no browser errors, no horizontal overflow at 838×626 or 390×844.
- Render comparison: original and unchanged generated file rendered identically on every page. LibreOffice produced ten pages, with an extra blank last page, whereas the uploaded document preview had nine. This is a conversion discrepancy, not certified pagination fidelity. No automatic PDF download is offered.
- Filled example: branding, summary tables and fixed clauses visually reviewed. Longer variable content can change wrapping and pagination in Word; exact page positions must not be promised without inspecting the filled document with the intended rendering engine.
- This generation does not publish, accept, sign or persist a contract, and does not change accepted proposal versions.

## Recheck — 2026-11-11

- Uploaded `RAVENA_106.docx` and the app template have identical SHA-256: `669b920a70ccadd49746aec0eaf9a75b3008086654940eabf7c81371c675dce6`.
- Eight automated tests passed, including template identity, all document properties preserved, styled name/street replacements and rejection of an altered template.
- Fresh original and same-data output rendered pixel-identically on all ten LibreOffice pages. This certifies equality under this converter, not Microsoft Word pagination.
- A fresh filled example preserves all XML structure and formatting properties after excluding text nodes. Branding, colors, fonts, margins, table properties and all non-document package parts remain unchanged.
- Visually inspected the first two pages side by side. Different text lengths move item 10 across the page boundary; exact filled-document pagination remains uncertified. LibreOffice still adds a final blank page to the original as well as generated documents.
- Authenticated flow repeated in the example property: Commercial → Generate → review → prepare → download. Downloaded Word passes ZIP and XML validation; only `word/document.xml` differs. No browser errors or horizontal overflow at 838×626 and 390×844.
- No generator changes were required by this recheck. Added regression tests only; preview build reports OK.

## Final regression stage — 2026-11-11

- 55 tests passed across six suites, including 14 additional certification cases. Structured inputs cover a principal, two parties with separate contacts, a represented company, special characters, a property without a tower and a long property description.
- Every variable-data case preserves fixed clauses and all non-document package parts. Text-node-stripped main XML is identical to the original, protecting fonts, colors, tables and run properties. This is structural fidelity, not identical wrapping or semantic bold placement for every description format.
- A fresh authenticated download passes parsing of every XML/relationship file; fixed clauses 43–148 and every package part outside `word/document.xml` are identical to the source.
- Real UI flow tested: incomplete data blocked, invalid CPFs blocked, final review, return to editing without loss, explicit discard, prepare, download, and edit invalidating the prepared document.
- Injected network failure returns no file and allows retry without losing fields. During delayed generation, editing and closing are disabled; Escape does not close. Removing authorization or substituting a nonexistent property in the real generated request blocks document delivery.
- Review and footer inspected at 1280×1800, 838×626, 390×844 and 320×700, with no horizontal overflow or page exceptions. Network errors now appear inline, in Portuguese, rather than a toast covering the mobile title.
- Microsoft Word pagination, a real unauthorized-role identity, identity changes during generation and concurrent operators remain unverified. No PDF, signed contract, persistent history or publication has been added.