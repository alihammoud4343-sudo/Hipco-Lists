# HIPCO Stocklot app

Live app: https://alihammoud4343-sudo.github.io/Hipco-Lists/

Daily update (done by Claude): export the Claude board's database (stocklots, clients, meta, sent, followup, inquiries) to a folder,
then run `node tools/build_vault.mjs <export-folder> .` and push. Removed lists disappear from the app automatically.
Prices, suppliers and protected salesmen's clients stay encrypted inside each list (`sec`), opened only by the team password.

## Keeping the app in sync with the board (standing rule)
Every time the Claude board changes (new list approved, price, sold, deleted list, clients), the app must be updated in the same step:
1. Export the board's collections with ArtifactData `list` + `out_dir` into one folder (stocklots, clients, meta, sent, followup, inquiries).
2. Run `bash tools/sync.sh <folder>` — it rebuilds data/vault.json and pushes only if something changed.
A scheduled task also runs this sync every hour during work hours, so changes made directly on the board reach the app too.
