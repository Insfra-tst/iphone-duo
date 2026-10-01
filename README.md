# iPhone Duo HTML app

This project packages the interactive Duo HTML interface as an offline iPhone app. A small native WKWebView shell loads `preview/index.html` from inside the IPA. It does not need a server or internet connection after installation.

The app has two virtual iPhone panels, home screen icons, app demos, notes, calculator, clock, and a hinge you can tap to fold/unfold or drag for a partial fold. It runs on regular iPhones with iOS 15 or newer.

## Push to GitHub and build the IPA

Open Terminal and run:

```bash
cd "/Users/kosala/Documents/Codex/Jailbreak/IPA Creation/iPhoneDuo"
git status --short
git add -A
git commit -m "Package Duo HTML app as an iPhone IPA"
git push origin main
```

The `git add -A` replaces the old SwiftUI game/demo implementation in the next commit with the HTML app and its native WebKit wrapper. The existing Git history stays in place. Check `git status --short` first; this project folder is its own repository and its origin must be `https://github.com/Insfra-tst/iphone-duo.git`.

If Git says there is nothing to commit, check the GitHub Actions page for the latest run. If HTTPS requests a password, use a GitHub personal access token with write access to repository contents and workflow files. Do not put a token in this folder or in the remote URL.

GitHub Actions uses its macOS runner and Xcode to build an unsigned iPhone IPA. No Xcode installation or Apple signing credentials are needed on this computer.

1. Visit [GitHub Actions](https://github.com/Insfra-tst/iphone-duo/actions) after pushing.
2. Open the latest **Build IPA** run and wait for success.
3. Download **iPhoneDuo-HTML-unsigned-IPA** from **Artifacts**.
4. Extract that ZIP once to get `iPhoneDuo-unsigned.ipa`.
5. Install it with iloader or another installer that signs unsigned IPAs for your iPhone.

Build artifacts expire after 14 days. The workflow also uploads the Xcode build log when a run fails. Open the log and find the first `error:` line for a compiler failure.

## Project files

- `preview/index.html` is the HTML, CSS, and JavaScript app. It also works as a browser preview from a local web server.
- `DuoSimulator/DuoWebApp.swift` opens that bundled page in WKWebView.
- `DuoSimulator/Assets.xcassets` contains the app icon.
- `project.yml` configures an iPhone-only Xcode app target.
- `scripts/build-ipa.sh` creates an unsigned device IPA.
- `scripts/verify-ipa.py` checks the archive, iPhone-only metadata, ARM64 app binary, bundled HTML and icon assets.
- `.github/workflows/build-ipa.yml` builds and uploads the artifact.

For a local browser preview on macOS, run:

```bash
python3 -m http.server 8766 --directory preview
```

Then visit [http://localhost:8766](http://localhost:8766). The native IPA embeds the same HTML file, so the preview and installed app share the Duo interface source.
