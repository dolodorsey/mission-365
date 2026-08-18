#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FASTLANE_BACKUP="${RUNNER_TEMP:-/tmp}/mission365-fastlane"
rm -rf "$FASTLANE_BACKUP"
mkdir -p "$FASTLANE_BACKUP"
if [[ -d ios/App/fastlane ]]; then
  cp -R ios/App/fastlane/. "$FASTLANE_BACKUP/"
fi

rm -rf ios
npx cap add ios

mkdir -p ios/App/fastlane
cp -R "$FASTLANE_BACKUP/." ios/App/fastlane/

python3 <<'PY'
from pathlib import Path
import re

podfile = Path('ios/App/Podfile')
if podfile.exists():
    text = podfile.read_text()
    text = re.sub(r"platform\s+:ios,\s*'[^']+'", "platform :ios, '15.0'", text)
    podfile.write_text(text)

for pbx in Path('ios').rglob('project.pbxproj'):
    text = pbx.read_text()
    text = re.sub(r'IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;', text)
    pbx.write_text(text)
PY

npx cap sync ios

python3 <<'PY'
from pathlib import Path
import re
for pbx in Path('ios').rglob('project.pbxproj'):
    text = pbx.read_text()
    text = re.sub(r'IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;', text)
    pbx.write_text(text)
PY

if [[ ! -f ios/App/App.xcodeproj/project.pbxproj ]]; then
  echo "Generated Capacitor Xcode project missing" >&2
  exit 1
fi
if [[ ! -f ios/App/Podfile ]]; then
  echo "Generated Capacitor Podfile missing" >&2
  exit 1
fi

(
  cd ios/App
  pod install
)

if [[ ! -f ios/App/Pods/Pods.xcodeproj/project.pbxproj ]]; then
  echo "CocoaPods project missing after pod install" >&2
  exit 1
fi

WORKSPACE="ios/App/App.xcworkspace"
WORKSPACE_DATA="$WORKSPACE/contents.xcworkspacedata"
if [[ ! -f "$WORKSPACE_DATA" ]]; then
  mkdir -p "$WORKSPACE"
  cat > "$WORKSPACE_DATA" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "group:App.xcodeproj">
   </FileRef>
   <FileRef
      location = "group:Pods/Pods.xcodeproj">
   </FileRef>
</Workspace>
EOF
fi

xcodebuild -workspace "$WORKSPACE" -scheme App -list >/dev/null

ICON_SOURCE="public/brand/mission365-focus.png"
ICONSET="ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [[ ! -f "$ICON_SOURCE" ]]; then
  echo "Mission 365 icon source missing: $ICON_SOURCE" >&2
  exit 1
fi
if [[ ! -f "$ICONSET/Contents.json" ]]; then
  echo "Generated AppIcon Contents.json missing" >&2
  exit 1
fi

ICON_TMP="${RUNNER_TEMP:-/tmp}/mission365-icon"
rm -rf "$ICON_TMP"
mkdir -p "$ICON_TMP"
WIDTH="$(sips -g pixelWidth "$ICON_SOURCE" | awk '/pixelWidth/{print $2}')"
HEIGHT="$(sips -g pixelHeight "$ICON_SOURCE" | awk '/pixelHeight/{print $2}')"
SIDE="$WIDTH"
if (( HEIGHT < WIDTH )); then SIDE="$HEIGHT"; fi
sips --cropToHeightWidth "$SIDE" "$SIDE" "$ICON_SOURCE" --out "$ICON_TMP/cropped.png" >/dev/null
sips -s format jpeg -s formatOptions 100 "$ICON_TMP/cropped.png" --out "$ICON_TMP/opaque.jpg" >/dev/null

python3 - "$ICONSET/Contents.json" "$ICON_TMP/targets.tsv" <<'PY'
import json,sys
source,out=sys.argv[1:]
with open(source,'r',encoding='utf-8') as f:
    doc=json.load(f)
rows=[]
for image in doc.get('images',[]):
    name=image.get('filename')
    size=image.get('size')
    scale=image.get('scale','1x')
    if not name or not size:
        continue
    points=float(str(size).split('x')[0])
    factor=float(str(scale).rstrip('x') or '1')
    pixels=max(1,round(points*factor))
    rows.append((name,pixels))
with open(out,'w',encoding='utf-8') as f:
    for name,pixels in rows:
        f.write(f"{name}\t{pixels}\n")
if not rows:
    raise SystemExit('Generated AppIcon catalog has no file-backed icon entries')
PY

while IFS=$'\t' read -r filename pixels; do
  sips -s format png -z "$pixels" "$pixels" "$ICON_TMP/opaque.jpg" --out "$ICONSET/$filename" >/dev/null
done < "$ICON_TMP/targets.tsv"

if [[ -f ios/App/App/Info.plist ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Mission 365" ios/App/App/Info.plist 2>/dev/null || true
fi

echo "Mission 365 iOS project regenerated, CocoaPods workspace prepared, deployment target set to 15.0, and branded icons prepared."
