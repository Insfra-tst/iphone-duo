import SwiftUI
import WebKit
import UIKit

@main
struct AIMobileOSApp: App {
    var body: some Scene {
        WindowGroup {
            MobileOSPage()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .preferredColorScheme(.light)
        }
    }
}

private struct MobileOSPage: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(MobileOSResourceHandler(), forURLScheme: "mobile-os")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = UIColor(red: 0.08, green: 0.08, blue: 0.11, alpha: 1)
        webView.isOpaque = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: URL(string: "mobile-os://app/index.html")!))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

/// Serves bundled files on one stable origin so localStorage, IndexedDB, and JSON fetches work.
private final class MobileOSResourceHandler: NSObject, WKURLSchemeHandler {
    private let mimeTypes: [String: String] = [
        "html": "text/html", "css": "text/css", "js": "text/javascript",
        "json": "application/json", "png": "image/png", "jpg": "image/jpeg",
        "jpeg": "image/jpeg", "svg": "image/svg+xml", "gif": "image/gif",
        "webp": "image/webp", "woff": "font/woff", "woff2": "font/woff2",
        "ttf": "font/ttf", "mp4": "video/mp4", "wav": "audio/wav"
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.host == "app",
              let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        let decodedPath = url.path.removingPercentEncoding ?? url.path
        let relativePath = decodedPath == "/" ? "index.html" : String(decodedPath.dropFirst())
        let fileURL = webRoot.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(webRoot.standardizedFileURL.path + "/"),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let type = mimeTypes[fileURL.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type])!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
