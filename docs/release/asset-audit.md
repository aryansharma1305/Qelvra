# Beta artwork distribution audit

All seven previously unverified files have the final decision **REPLACED**. No redistribution right is claimed for the retired Stitch artwork. The original files are absent from the current source and built web distribution. The previous standalone brand reference is replaced as well. Historical Git commits are not rewritten.

The replacement SVGs were authored directly in this repository for the owner's October 6, 2026 request. They contain only original geometric paths/shapes: no portraits, stock images, external references, embedded fonts, scripts or traced source artwork. Copyright 2026 Aryan Sharma and Qelvra contributors; Apache-2.0, with SPDX/copyright comments in every SVG. The existing root LICENSE and NOTICE apply. No third-party attribution requirement is invented.

## Decisions for the seven originals

| Original repository path                        | Origin                                                    | Screens using it                              | Required?                                       | Original ownership/evidence                    | Decision | Replacement                                |
| ----------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | -------- | ------------------------------------------ |
| apps/web/public/stitch/avatar-michael.jpg       | Stitch export, Googleusercontent download; ADR 0002       | Onboarding sample team                        | No; sample avatar                               | No independent permission record; not retained | REPLACED | apps/web/public/artwork/avatar-michael.svg |
| apps/web/public/stitch/avatar-nova-portrait.jpg | Stitch export, Googleusercontent download; ADR 0002       | Onboarding sample team                        | No; sample avatar                               | No independent permission record; not retained | REPLACED | apps/web/public/artwork/avatar-nova.svg    |
| apps/web/public/stitch/avatar-atlas.jpg         | Stitch export, Googleusercontent download; ADR 0002       | Onboarding sample team                        | No; sample avatar                               | No independent permission record; not retained | REPLACED | apps/web/public/artwork/avatar-atlas.svg   |
| apps/web/public/stitch/avatar-scout.jpg         | Stitch export, Googleusercontent download; ADR 0002       | Onboarding sample team                        | No; sample avatar                               | No independent permission record; not retained | REPLACED | apps/web/public/artwork/avatar-scout.svg   |
| apps/web/public/stitch/avatar-user.jpg          | Stitch export, Googleusercontent download; ADR 0002       | App/onboarding headers, Terminal sample panel | No; preview identity                            | No independent permission record; not retained | REPLACED | apps/web/public/artwork/avatar-user.svg    |
| apps/web/public/stitch/brand-mark.png           | Stitch export, Googleusercontent brand download; ADR 0002 | App/onboarding headers                        | Branding slot retained; old drawing unnecessary | No independent permission record; not retained | REPLACED | apps/web/public/artwork/qelvra-mark.svg    |
| apps/web/public/stitch/brand-mark.svg           | Imported standalone Stitch brand export                   | Browser favicon; standalone brand reference   | Branding slot retained; old drawing unnecessary | No independent permission record; not retained | REPLACED | apps/web/public/artwork/qelvra-mark.svg    |

## Provenance and verification

[asset-audit.json](asset-audit.json) records original SHA-256 values, exact replacement paths and SHA-256 values, authorship evidence, copyright and license for every entry. Both logo entries resolve to the same original Qelvra circle-and-tail mark. All six retained SVGs have recorded first-party provenance. No private receipts, credentials or personal documents are committed.

`scripts/check-release-assets.mjs` validates the seven-entry inventory, removal of the retired files, replacement bytes/license and absence of embedded script/image/external-link payloads. The publication guard and production smoke invoke it. Production smoke additionally checks the SVGs served from the built web output and absence of retired files in that output. Reference HTML uses the same replacements, without fetching the former Googleusercontent images or introducing masks.

Third-party font and dependency license texts remain unchanged. THIRD_PARTY_NOTICES.md records this resolved artwork decision separately from third-party materials. Original fonts and their upstream notices remain in the distribution.
