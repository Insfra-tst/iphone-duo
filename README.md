# AI Mobile OS iPhone app

This repository packages the `Experiment` AI Mobile OS web app as an offline iPhone app. The native SwiftUI shell opens its bundled HTML, CSS, JavaScript, icons, and app-store data in a WKWebView. The project targets iPhones on iOS 15 or later and can be built in GitHub Actions without Xcode on your computer.

The shell serves local files on a private in-app URL scheme so browser storage and the local app catalog work without a web server. Built-in demo apps run locally. Links and hosted pages need internet. AI features that call OpenAI require a valid API key entered/configured by the user; no key is included in this project.

## Build and install

Push the repository to `main` or run **Build IPA** manually from [GitHub Actions](https://github.com/Insfra-tst/iphone-duo/actions). Download the `AI-Mobile-OS-unsigned-IPA` artifact, extract the ZIP, then sign and install `AIMobileOS-unsigned.ipa` with iloader, SideStore, or another compatible sideloading tool. The IPA is unsigned because it is built without an Apple developer signing certificate.

```bash
git add -A
git commit -m "Package AI Mobile OS as an iPhone app"
git push origin main
```

## Local preview

```bash
python3 -m http.server 8766 --directory web
```

Then open http://localhost:8766. The same `web` folder is embedded in the IPA.

## Build files

- `web/` contains the experiment app and its bundled runtime data.
- `MobileOS/` contains the SwiftUI/WebKit shell and iPhone app icon.
- `project.yml` defines the iPhone-only XcodeGen project.
- `scripts/build-ipa.sh` builds and packages an unsigned IPA.
- `scripts/verify-ipa.py` validates the IPA structure and embedded app resources.
- `.github/workflows/build-ipa.yml` builds the app on GitHub Actions macOS runners.
