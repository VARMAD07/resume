# Portfolio maintenance checklist

This repository is intended to stay evidence-first. Update factual status before adding visual features.

## Update immediately when any of these change

Central current states live in `data/portfolio-state.json`. Update that record first; the hero stage, reviewer summary, status dashboard, academic cards, research/project labels and timeline should derive from it rather than being rewritten independently.

- **Class 12 / school status:** revise current-stage wording once the 2026–27 school year ends.
- **IIT Madras BS DS&A status:** update qualifier/application wording as soon as the portal stage changes. Do not present a qualifier-stage record as completed degree enrolment.
- **Research status:** revise the healthcare-AI entry if the manuscript, archive, methodology or publication status changes.
- **Credentials:** add a credential only when the issuer record or supplied certificate is available.
- **Résumé:** keep the public résumé link and QR destination synchronized with the latest file.
- **Projects:** update repository/live-app links when projects move, archive or materially change.
- **Evidence review date:** refresh the centralized `lastVerified` value after a real verification pass.
- **Sitemap:** update `<lastmod>` when a substantial public update ships.
- **Social preview:** update the versioned JPEG referenced by Open Graph and Twitter tags in `index.html`, along with its dimensions; update `assets/images/identity-banner-20260924.webp` for the page banner only when the portfolio identity/banner changes.

## Evidence vocabulary

Prefer these labels consistently:

- **ISSUER RECORD** — issuer-backed public credential record.
- **PUBLIC SOURCE** — public repository, archive or profile.
- **SUPPLIED DOCUMENT** — document reviewed for this portfolio but not necessarily public.
- **PORTAL EVIDENCE** — private account/portal evidence reviewed for public status; sensitive account details remain unpublished.
- **SELF-REPORTED** — claim currently supported only by the applicant’s supplied record.

## Quality gates

GitHub Actions checks:

1. internal anchors and local assets,
2. public external links for definitive 404/410 failures,
3. Lighthouse category floors for performance, accessibility, best practices and SEO.

A visual update should not be merged if it makes the page harder to verify, slower to use, less accessible or less precise.

## Production rule

The visual identity is considered stable. Future changes should normally be factual state/evidence updates, verified credentials, genuine project/research changes, or bug fixes. Do not redesign the portfolio merely because a status changes.
