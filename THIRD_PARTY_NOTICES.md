# Third-party notices and distribution audit

Qelvra original code is licensed under Apache-2.0, Copyright 2026 Aryan Sharma and Qelvra contributors. Third-party materials remain under their original licenses; this repository license does not relicense them.

## Distribution boundary

The beta is source-run. GitHub source archives omit node_modules and ignored dist output. The built web app bundles the libraries below and self-hosts fonts. Built server entrypoints inline Qelvra/shared code; npm dependencies remain external, including node-pty/native tooling. `npm ci` retrieves their packages and original licenses. The 77 installed production dependency entries were inspected; all declare a license. Exact versions/declarations/retained notice filenames are recorded in third-party/external-dependencies.json. abstract-logging declares MIT in its package and README but its npm package has no separate top-level LICENSE; it is external, not copied into a Qelvra source archive/bundle. Future binary/installers must re-audit external/native payloads.

## Bundled web code

Full, unmodified upstream copyright and license texts are in third-party/licenses. The build copies LICENSE, NOTICE, this document and a concatenated THIRD_PARTY_NOTICES.txt beside both server and web output. The extra parser notices conservatively include React Router dependencies even when a browser chunk tree-shakes their code.

| Package           | Locked version | License | Preserved license text                                     |
| ----------------- | -------------- | ------- | ---------------------------------------------------------- |
| react             | 19.3.0         | MIT     | [text](third-party/licenses/react-LICENSE.txt)             |
| react-dom         | 19.3.0         | MIT     | [text](third-party/licenses/react-dom-LICENSE.txt)         |
| scheduler         | 0.28.0         | MIT     | [text](third-party/licenses/scheduler-LICENSE.txt)         |
| react-router      | 7.18.4         | MIT     | [text](third-party/licenses/react-router-LICENSE.txt)      |
| @xterm/xterm      | 6.0.0          | MIT     | [text](third-party/licenses/xterm-xterm-LICENSE.txt)       |
| @xterm/addon-fit  | 0.11.0         | MIT     | [text](third-party/licenses/xterm-addon-fit-LICENSE.txt)   |
| zod               | 4.6.5          | MIT     | [text](third-party/licenses/zod-LICENSE.txt)               |
| cookie            | 1.1.1          | MIT     | [text](third-party/licenses/cookie-LICENSE.txt)            |
| set-cookie-parser | 2.7.2          | MIT     | [text](third-party/licenses/set-cookie-parser-LICENSE.txt) |

Tailwind CSS utility styles and Vite-generated browser bootstrap helpers also retain their upstream MIT notices. Verbatim tool license texts, including Vite's accompanying third-party notices, are included in third-party/licenses. These are attribution additions; no tool/dependency license is modified.

## Self-hosted fonts

- Geist: SIL OFL 1.1. Preserve both upstream copyright notices: the Geist Project Authors (2024) and Vercel in collaboration with basement.studio (2023). Sources: https://github.com/vercel/geist-font/blob/main/OFL.txt and LICENSE.txt. Both verbatim texts are included.
- JetBrains Mono: SIL OFL 1.1, Copyright 2020 The JetBrains Mono Project Authors. Source: https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt.
- Material Symbols Outlined: Apache-2.0, Google Material Design Icons project. Source: https://github.com/google/material-design-icons/blob/master/LICENSE and variablefont/. The upstream repository has no NOTICE file. Full license included.

The twelve existing Google Fonts WOFF2 files, their names and bytes are unchanged. No renamed/modified font or dependency-license change is made. Inventory SHA-256 values:

| File                                     | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| geist-68a810e5.woff2                     | `b7a545bbb08256bd809f11cfe66d88da3e22d169ea4407737b1ef0ec1ed3d791` |
| geist-a1c8a0c8.woff2                     | `6129fc8571c3e0cb0a4c41f5160c974a843b055009dc4ad8858bd808e18a2d86` |
| geist-a625f9ac.woff2                     | `f689f638f29fff460a2d5749edb5d5c38d7bef0389f32032d871f23fc6ebb008` |
| geist-e6da4874.woff2                     | `58a6b173d5ca1dec92166ea3c6cb1a84a4144556d10928ac14e8e6b40e4787bd` |
| geist-edc7ad59.woff2                     | `9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608` |
| jetbrains-mono-2565db8a.woff2            | `49c3da6c9a2b279b0f1f860f5cfb1f5dc38d88a5c7be9c9b1837bbc4e3db6111` |
| jetbrains-mono-856c310c.woff2            | `d44eb1936043a56038eb02dd70b243f379bef65783f94ec12f277550720411f1` |
| jetbrains-mono-9326b4c9.woff2            | `9c38cb2d0d2d93c1ee6e21fa78db76f13ea7e15e15cc64214c7ca89b6aaa35c4` |
| jetbrains-mono-a07c36cf.woff2            | `9343de2ca5d9549f792e7962375af8efb0f320c7643bfd36c884b5a30e5c396f` |
| jetbrains-mono-add2d251.woff2            | `4995a9a43ac659ec32fcd8b463755cd6a07b31a6e6b3894a6a153b661cf490e2` |
| jetbrains-mono-b87346fd.woff2            | `2c32b9b3ee358c119e210f6f5195f9bd34894d78a785ff2e95d60e718e400af4` |
| material-symbols-outlined-09b1d610.woff2 | `d3e74bde14bcb6e6619f86ec64c78b52f0c942982388ea4c521933e979361473` |

## Stitch-exported artwork — owner confirmation pending

The five portraits and two logo files below were supplied in the existing Stitch design and downloaded from Googleusercontent URLs (ADR0002). The repository contains no independent license/permission record for these images. A hosting URL does not establish redistribution permission. The original export, local bytes and design parity are preserved; they are not silently assigned a third-party license or replaced. Owner confirmation of generated/owned assets or documented permission is required before publication. This is a FAIL release gate until resolved.

| Existing file            | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| avatar-atlas.jpg         | `6df9714ffcd293ee3304001251e0796cf70de03823192246995c47565f2bda41` |
| avatar-michael.jpg       | `d735c3655d4ab01fde509d426a20eef33e9249575c46954a8e6e6a9da2af3853` |
| avatar-nova-portrait.jpg | `155b142aa0dd43657c97c12dd5e89f4318317493b6429f35adebcd4f4d1df02c` |
| avatar-scout.jpg         | `5af35f0ae51d4287465ce46beb2077053ff90ebb7dc59dc31022a7a2a4d4935c` |
| avatar-user.jpg          | `18e7390ea4000e661971a3c0a61f2a397c900dfdae6d6bef7ca5e64ac0d2afa1` |
| brand-mark.png           | `353decbf5c4dd06d8b0e7bd20539244072b3038e314ffe47952a6465475374c7` |
| brand-mark.svg           | `4ca6ec6212dc104f45f66149ca3eeaecca6491c0a2d16ac9f9ac405368886205` |

The original reference HTML links to Tailwind CDN and Google Fonts; those remote services are not vendored by the source archive. Their network-served code/assets are not covered by Qelvra's copyright notice. Original SVG icon/layout code supplied with the design is preserved. No third-party dependency license file in node_modules was modified.
