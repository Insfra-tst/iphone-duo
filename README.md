# iPhone Duo

A dual-screen/foldable iPhone concept simulator **for regular iPhones running iOS 15 or later**. Built in SwiftUI with original vector icons. This is an interactive interface concept, not an emulator of another operating system or a way to run other installed apps side by side.

## What you can do

- Open Notes, Calculator, or Clock independently on either screen.
- Save different notes on each screen; they persist across app launches.
- Keep separate calculator state on each screen while the app is open.
- Rotate the phone for automatic side-by-side layout, or choose Stack / Side by side yourself.
- Drag the hinge slider to tilt the second screen, or fold it away using the top-right button.
- Open a panel's grid menu to switch demos and use Home to return to its launcher.
- Everything works offline. No accounts, ads, permissions, or downloaded dependencies inside the app.

The calculator performs operations in entry order, like a basic pocket calculator. Clock uses your device's local time zone. In narrow layouts, demo content scrolls so controls remain accessible. Tap Done in Notes to dismiss the keyboard. Notes survive folding and rotation; reinstalling over the same app identity normally preserves them, while deleting the app removes them.

## Push to your GitHub repository

This project has its own Git repository, separate from Pocket Flap. Its `origin` is already configured as `https://github.com/Insfra-tst/iphone-duo.git`.

Run these commands in Terminal, from this exact project folder:

```bash
cd "/Users/kosala/Documents/Codex/Jailbreak/IPA Creation/iPhoneDuo"
git rev-parse --show-toplevel
git remote -v
git add .gitignore .github DuoSimulator Tests scripts project.yml README.md
git commit -m "Add iPhone Duo simulator and IPA build workflow"
git push -u origin main
```

The top-level path must end in `/iPhoneDuo` and the remote must end in `/iphone-duo.git`. Do not run these commands from the parent Pocket Flap folder.

If Git needs an identity, set it in this project and retry the commit:

```bash
git config user.name "YOUR NAME"
git config user.email "YOUR GITHUB EMAIL OR NOREPLY EMAIL"
```

Use your existing GitHub authentication. If HTTPS asks for a password, use a personal access token, not your normal GitHub password. The token needs permission to push contents and workflow files. Never store the token in the project or remote URL. Do not force-push if the remote gained commits; fetch and reconcile them first.

## Create and download the IPA — no local Xcode needed

1. Push to `main` using the commands above.
2. Open [GitHub Actions](https://github.com/Insfra-tst/iphone-duo/actions).
3. Enable Actions if requested. Open the latest **Build IPA** run.
4. Wait for success, then download **iPhoneDuo-unsigned-IPA** from **Artifacts**.
5. Extract the artifact ZIP once to obtain **iPhoneDuo-unsigned.ipa**.

You can also start a fresh build with **Build IPA → Run workflow → main**. Downloads expire after 14 days; rerun to create a new one. GitHub account/repository Actions policies and usage limits apply.

GitHub's macOS runner runs calculator tests, generates the Xcode project using XcodeGen, builds an ARM64 iPhone app with signing disabled, packages it under `Payload/DuoSimulator.app`, and validates the IPA before upload. No Apple credentials or repository secrets are needed. A `build-log` artifact is retained even when compilation fails; search it for the first `error:` message.

## Install on your regular iPhone

Import the extracted `.ipa` into [iloader](https://iloader.app/) or another tool that can sign unsigned IPAs. Connect and unlock the phone, trust the computer if asked, and follow the sideloader's Apple Account sign-in and signing steps.

If prompted by iOS, trust the developer profile under Settings → General → VPN & Device Management. On iOS 16+, enable Developer Mode under Settings → Privacy & Security if requested, restart, and confirm. Free-account installations generally need refreshing every seven days. Use the sideloader's refresh/signing instructions.

The IPA is intentionally unsigned: a transfer-only installer cannot install it on a stock iPhone. No special “iPhone Duo” hardware or jailbreak is required. The app's iPhone target also distinguishes it from an iPad-optimized app.

## Files and validation

- `DuoSimulator/DuoApp.swift`: dual-panel interface and demos.
- `DuoSimulator/CalculatorEngine.swift`: calculator rules.
- `project.yml`: source of the generated Xcode project.
- `.github/workflows/build-ipa.yml`: cloud build and artifact upload.
- `scripts/build-ipa.sh`: device build and packaging.
- `scripts/verify-ipa.py`: archive, metadata, and binary checks.
- `scripts/make-icon.swift`: regenerates original icons on macOS.

Run `bash scripts/test.sh` on a Mac with Swift command-line tools. Full iOS compilation requires Xcode and runs in GitHub Actions. Local SwiftUI type-checking against the available macOS SDK can catch shared API mistakes, but it does not replace the iOS build or on-device testing.

After installing, test both panels, notes persistence after relaunch, calculator independence, portrait/landscape rotation, and folding/unfolding. The UI can be visually inspected only after an iOS build; no iPhone runtime test has been performed locally.

References: [GitHub workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [iloader](https://iloader.app/), [Apple personal-team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).
