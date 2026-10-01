import SwiftUI
import WebKit
import UIKit

@main
struct DuoWebApp: App {
    var body: some Scene {
        WindowGroup {
            BundledDuoPage()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .preferredColorScheme(.light)
        }
    }
}

/// Loads the project's HTML directly from the signed app bundle. No server or network is required.
private struct BundledDuoPage: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = UIColor(red: 0.87, green: 0.90, blue: 0.95, alpha: 1)
        webView.isOpaque = false
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        guard let page = Bundle.main.url(forResource: "index", withExtension: "html") else {
            webView.loadHTMLString("<html><body style='font:17px -apple-system;padding:40px'>Duo screen could not load. Rebuild the app.</body></html>", baseURL: nil)
            return webView
        }
        webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
