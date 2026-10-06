#!/bin/bash
# Rebuild the app's data from a fresh export of the Claude board and push it (only if something changed).
# usage: bash tools/sync.sh <export-folder>   (folder holds stocklots/, clients/, meta/, sent/, followup/, inquiries/ as exported by ArtifactData list out_dir)
set -e
cd "$(dirname "$0")/.."
mkdir -p "$1/inquiries" "$1/followup" "$1/sent"
node tools/build_vault.mjs "$1" .
# keep each report PDF named after its reference next to the app (PDFs are added by Claude when a list is approved)
if git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then echo "APP ALREADY UP TO DATE"; exit 0; fi
git add -A
git commit -q -m "Sync app with board $(date +%Y-%m-%d_%H:%M)"
git push -q origin main
echo "APP UPDATED"
