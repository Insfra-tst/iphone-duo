#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build dist
xcodebuild -version
xcodegen generate
if ! grep -Fq 'web' AIMobileOS.xcodeproj/project.pbxproj; then
  echo 'XcodeGen did not add the web asset folder to the generated project.' >&2
  exit 1
fi
xcodebuild -project AIMobileOS.xcodeproj -scheme AIMobileOS \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData TARGETED_DEVICE_FAMILY=1 CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' build 2>&1 | tee build/xcodebuild.log
app='build/DerivedData/Build/Products/Release-iphoneos/AIMobileOS.app'
test -f "$app/AIMobileOS"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/Payload"
ditto "$app" "$stage/Payload/AIMobileOS.app"
output="$PWD/dist/AIMobileOS-unsigned.ipa"
rm -f "$output"
(cd "$stage" && /usr/bin/zip -qry "$output" Payload)
python3 scripts/verify-ipa.py "$output"
echo "Created $output"
