#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build dist
xcodebuild -version
xcodegen generate
xcodebuild -project DuoWebApp.xcodeproj -scheme DuoWebApp \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData TARGETED_DEVICE_FAMILY=1 CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' build 2>&1 | tee build/xcodebuild.log
app='build/DerivedData/Build/Products/Release-iphoneos/DuoWebApp.app'
test -f "$app/DuoWebApp"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/Payload"
ditto "$app" "$stage/Payload/DuoWebApp.app"
output="$PWD/dist/iPhoneDuo-unsigned.ipa"
rm -f "$output"
(cd "$stage" && /usr/bin/zip -qry "$output" Payload)
python3 scripts/verify-ipa.py "$output"
echo "Created $output"
