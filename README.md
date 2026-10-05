# HIPCO Stocklot app

Live app: https://alihammoud4343-sudo.github.io/Hipco-Lists/

Daily update (done by Claude): export the Claude board's database (stocklots, clients, meta, sent, followup, inquiries) to a folder,
then run `node tools/build_vault.mjs <export-folder> .` and push. Removed lists disappear from the app automatically.
Prices, suppliers and protected salesmen's clients stay encrypted inside each list (`sec`), opened only by the team password.
