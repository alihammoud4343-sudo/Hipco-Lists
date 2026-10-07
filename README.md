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

## Client line picking (tap-to-select page)
Every tickable stocklot PDF carries a yellow "Can't tick? TAP HERE" link to `pick.html?ref=SLnnn`, where the client taps the numbered lines (they turn yellow) and sends the selection back on WhatsApp.
For every new PDF run, in this order: `python3 tools/add_pick_link.py` (adds the link, safe to re-run) and `python3 tools/extract_lines.py` (rebuilds `data/lines.json`, which pick.html reads). Commit the PDFs and `data/lines.json` together.
