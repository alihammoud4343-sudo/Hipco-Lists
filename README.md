# HIPCO Stocklot app

Live app: https://alihammoud4343-sudo.github.io/Hipco-Lists/

Daily update (done by Claude): export the Claude board's database (stocklots, clients, meta, sent, followup, inquiries) to a folder,
then run `node tools/build_vault.mjs <export-folder> .` and push. Removed lists disappear from the app automatically.
Prices, suppliers and protected salesmen's clients stay encrypted inside each list (`sec`), opened only by the team password.

## Where updates happen (from 6 Oct 2026)
The app is the only tool. New approved lists, prices, origins and sold/removed lists are written straight into the app's data:
data/vault.json holds every list (prices, suppliers and protected clients stay encrypted inside each list's "sec"),
rebuilt with tools/build_vault.mjs and pushed; each list's PDF sits next to index.html. The old Claude board is no longer updated.

## Matching exclusions (standing rules)
- **Rikabi carton & paper** (client of Ouseili) must never be matched on lists from **Opti (O)** or **Khalil Zein (K / KZ)**, even if his interests match. Applies to every new list from those suppliers (decided by Ali, 7 Oct 2026).

## Client line picking
PDFs are tickable forms (one box next to each numbered line, none next to quality headings). The yellow "TAP HERE" button was removed on request (`tools/remove_pick_button.py`); the tap-to-select page `pick.html` + `data/lines.json` still exist but are not linked from the PDFs.
