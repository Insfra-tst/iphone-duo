import AppKit
import ImageIO

let directory = "DuoSimulator/Assets.xcassets/AppIcon.appiconset"
try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
let entries = [("20x20", "2x"), ("20x20", "3x"), ("29x29", "2x"), ("29x29", "3x"),
               ("40x40", "2x"), ("40x40", "3x"), ("60x60", "2x"), ("60x60", "3x"), ("1024x1024", "1x")]
var images: [[String: String]] = []
for (size, scale) in entries {
    let pixels = Int(size.components(separatedBy: "x")[0])! * Int(scale.dropLast())!
    let context = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8,
                            bytesPerRow: pixels * 4, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
    func shape(_ rect: CGRect, _ color: CGColor, _ radius: CGFloat = 0) {
        context.setFillColor(color)
        context.addPath(CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.fillPath()
    }
    shape(CGRect(x: 0, y: 0, width: 1024, height: 1024), CGColor(red: 0.025, green: 0.035, blue: 0.055, alpha: 1))
    for (x, color) in [(150.0, CGColor(red: 0.12, green: 0.8, blue: 0.92, alpha: 1)),
                       (530.0, CGColor(red: 0.64, green: 0.4, blue: 0.96, alpha: 1))] {
        shape(CGRect(x: x, y: 230, width: 344, height: 570), color, 55)
        shape(CGRect(x: x + 20, y: 250, width: 304, height: 530), CGColor(gray: 0.08, alpha: 1), 40)
        shape(CGRect(x: x + 43, y: 360, width: 258, height: 355), color, 24)
        shape(CGRect(x: x + 124, y: 744, width: 96, height: 12), CGColor(gray: 0.3, alpha: 1), 6)
        for offset in [0.0, 90.0, 180.0] {
            shape(CGRect(x: x + 48 + offset, y: 282, width: 68, height: 45), color, 14)
        }
        shape(CGRect(x: x + 70, y: 630, width: 150, height: 16), CGColor(gray: 1, alpha: 0.6), 8)
        shape(CGRect(x: x + 70, y: 594, width: 205, height: 12), CGColor(gray: 1, alpha: 0.35), 6)
    }
    shape(CGRect(x: 505, y: 390, width: 14, height: 250), CGColor(gray: 0.65, alpha: 1), 7)
    let filename = "icon-\(pixels).png"
    let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "\(directory)/\(filename)") as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    precondition(CGImageDestinationFinalize(destination))
    images.append(["idiom": pixels == 1024 ? "ios-marketing" : "iphone", "size": size, "scale": scale, "filename": filename])
}
let contents: [String: Any] = ["images": images, "info": ["author": "xcode", "version": 1] as [String: Any]]
try JSONSerialization.data(withJSONObject: contents, options: [.prettyPrinted, .sortedKeys])
    .write(to: URL(fileURLWithPath: "\(directory)/Contents.json"))
