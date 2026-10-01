import SwiftUI

@main
struct DuoApp: App {
    var body: some Scene {
        WindowGroup { DuoView().preferredColorScheme(.light) }
    }
}

enum DemoApp: String, CaseIterable, Identifiable {
    case home = "Home", notes = "Notes", calculator = "Calculator", clock = "Clock"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .home: return "square.grid.2x2.fill"
        case .notes: return "note.text"
        case .calculator: return "plus.forwardslash.minus"
        case .clock: return "clock.fill"
        }
    }
    var tint: Color {
        switch self {
        case .home: return .cyan
        case .notes: return .yellow
        case .calculator: return .orange
        case .clock: return .mint
        }
    }
}

struct DuoView: View {
    @State private var left: DemoApp = .home
    @State private var right: DemoApp = .home
    @State private var folded = false
    @State private var layout = 0
    @State private var angle = 0.0
    @State private var showHelp = false
    @StateObject private var leftCalculator = CalculatorStore()
    @StateObject private var rightCalculator = CalculatorStore()

    var body: some View {
        GeometryReader { geometry in
            let sideBySide = layout == 2 || (layout == 0 && geometry.size.width > geometry.size.height)
            VStack(spacing: 12) {
                if sideBySide {
                    HStack(spacing: 5) {
                        panel(number: 1, app: $left, calculator: leftCalculator)
                        if !folded {
                            hinge(vertical: true)
                            panel(number: 2, app: $right, calculator: rightCalculator)
                                .rotation3DEffect(.degrees(-angle), axis: (x: 0, y: 1, z: 0), anchor: .leading, perspective: 0.3)
                        }
                    }
                } else {
                    VStack(spacing: 5) {
                        panel(number: 1, app: $left, calculator: leftCalculator)
                        if !folded {
                            hinge(vertical: false)
                            panel(number: 2, app: $right, calculator: rightCalculator)
                                .rotation3DEffect(.degrees(angle), axis: (x: 1, y: 0, z: 0), anchor: .top, perspective: 0.3)
                        }
                    }
                }
                if !folded {
                    HStack(spacing: 12) {
                        Image(systemName: "angle").foregroundColor(.cyan)
                        Slider(value: $angle, in: 0...65).tint(.cyan).accessibilityLabel("Hinge angle")
                        Text("\(Int(angle))°").font(.caption.monospacedDigit()).frame(width: 32)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(red: 0.93, green: 0.95, blue: 0.98).ignoresSafeArea())
        .sheet(isPresented: $showHelp) {
            VStack(alignment: .leading, spacing: 22) {
                Text("Meet Duo").font(.largeTitle.bold())
                Text("A playful foldable iPhone concept, running on your regular iPhone.")
                Label("Choose a demo app independently on each screen.", systemImage: "square.grid.2x2")
                Label("Rotate your iPhone for a wider, side-by-side workspace.", systemImage: "iphone.landscape")
                Label("Drag the hinge slider or fold away the second screen.", systemImage: "angle")
                Text("Notes save on this device. Calculators keep separate state while the app is open. All demos work offline. This simulates a dual-screen interface; it does not run other installed iOS apps.")
                    .font(.callout).foregroundColor(.secondary)
                Button("Got it") { showHelp = false }.buttonStyle(.borderedProminent).tint(.cyan)
            }.padding(28)
        }
    }

    private func panel(number: Int, app: Binding<DemoApp>, calculator: CalculatorStore) -> some View {
        PanelView(number: number, selected: app, calculator: calculator)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.black.opacity(0.10), lineWidth: 2))
    }

    private func hinge(vertical: Bool) -> some View {
        ZStack {
            Capsule().fill(LinearGradient(colors: [.gray.opacity(0.65), .white, .gray.opacity(0.65)],
                                          startPoint: vertical ? .leading : .top,
                                          endPoint: vertical ? .trailing : .bottom))
            Image(systemName: vertical ? "chevron.left.chevron.right" : "chevron.up.chevron.down")
                .font(.system(size: 9, weight: .bold)).foregroundColor(.secondary)
                .padding(6).background(.white).clipShape(Capsule())
                .overlay(Capsule().stroke(Color.gray.opacity(0.35)))
        }
        .frame(width: vertical ? 11 : 82, height: vertical ? 82 : 11)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.78)) {
                angle = angle < 30 ? 65 : 0
            }
        }
        .accessibilityLabel(angle < 30 ? "Fold second screen" : "Unfold second screen")
        .accessibilityAddTraits(.isButton)
    }
}

struct PanelView: View {
    let number: Int
    @Binding var selected: DemoApp
    @ObservedObject var calculator: CalculatorStore

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Circle().fill(number == 1 ? Color.cyan : Color.purple).frame(width: 6, height: 6)
                Text("SCREEN \(number)").font(.system(size: 9, weight: .bold)).tracking(1)
                Spacer(minLength: 2)
                Menu {
                    ForEach(DemoApp.allCases) { app in
                        Button { selected = app } label: { Label(app.rawValue, systemImage: app.icon) }
                    }
                } label: {
                    Image(systemName: "square.grid.2x2").frame(width: 44, height: 36)
                }.accessibilityLabel("Choose app on screen \(number)")
            }.foregroundColor(.secondary).padding(.horizontal, 14)
            Divider().overlay(Color.black.opacity(0.08))
            Group {
                switch selected {
                case .home: home
                case .notes: NotesDemo(key: "duo.notes.\(number)")
                case .calculator: CalculatorDemo(store: calculator)
                case .clock: ClockDemo()
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity)
            if selected != .home {
                Button { selected = .home } label: {
                    Label("Home", systemImage: "house.fill").font(.caption).frame(maxWidth: .infinity, minHeight: 36)
                }.foregroundColor(.secondary)
            }
        }
    }

    private var home: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(number == 1 ? "Make room" : "For more.")
                        .font(.system(size: 28, weight: .bold, design: .rounded)).minimumScaleFactor(0.7)
                    Text("One idea. Two perspectives.").font(.caption).foregroundColor(.secondary)
                }.padding(.top, 4)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 4), spacing: 18) {
                    homeIcon("Messages", "message.fill", .green)
                    homeIcon("Safari", "safari.fill", .blue)
                    homeIcon("Photos", "photo.fill", .orange)
                    homeIcon("Camera", "camera.fill", .gray)
                    homeIcon("Music", "music.note", .pink)
                    homeIcon("Notes", DemoApp.notes.icon, DemoApp.notes.tint) { selected = .notes }
                    homeIcon("Calculator", DemoApp.calculator.icon, DemoApp.calculator.tint) { selected = .calculator }
                    homeIcon("Clock", DemoApp.clock.icon, DemoApp.clock.tint) { selected = .clock }
                }
            }.padding(16)
        }
        .background(LinearGradient(colors: [number == 1 ? Color.cyan.opacity(0.18) : Color.purple.opacity(0.18), .white], startPoint: .topLeading, endPoint: .bottomTrailing))
    }

    private func homeIcon(_ title: String, _ symbol: String, _ color: Color, action: (() -> Void)? = nil) -> some View {
        Button { action?() } label: {
            VStack(spacing: 5) {
                Image(systemName: symbol).font(.title3).foregroundColor(.white)
                    .frame(width: 48, height: 48).background(color).clipShape(RoundedRectangle(cornerRadius: 13))
                Text(title).font(.system(size: 9, weight: .medium)).foregroundColor(.secondary)
            }.frame(maxWidth: .infinity)
        }.buttonStyle(.plain).disabled(action == nil)
    }
}

struct NotesDemo: View {
    @AppStorage private var note: String
    @FocusState private var editing: Bool
    init(key: String) { _note = AppStorage(wrappedValue: "", key) }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Notes").font(.headline)
                Spacer()
                if editing {
                    Button("Done") { editing = false }.font(.caption)
                } else {
                    Text("Saved locally").font(.system(size: 9)).foregroundColor(.secondary)
                }
            }
            ZStack(alignment: .topLeading) {
                TextEditor(text: $note).font(.body).focused($editing).accessibilityLabel("Note text")
                if note.isEmpty {
                    Text("A little space for your ideas…").font(.body).foregroundColor(.secondary)
                        .padding(.top, 8).padding(.leading, 5).allowsHitTesting(false)
                }
            }
        }.padding(12)
    }
}

final class CalculatorStore: ObservableObject {
    @Published var engine = CalculatorEngine()
    func press(_ key: String) { engine.press(key) }
}

struct CalculatorDemo: View {
    @ObservedObject var store: CalculatorStore
    private let keys = [["AC", "±", "%", "÷"], ["7", "8", "9", "×"], ["4", "5", "6", "−"], ["1", "2", "3", "+"], ["0", ".", "⌫", "="]]
    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(store.engine.display).font(.system(size: 34, weight: .light, design: .rounded))
                    .lineLimit(1).minimumScaleFactor(0.3).frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.vertical, 8).accessibilityLabel("Result \(store.engine.display)")
                ForEach(keys, id: \.self) { row in
                    HStack(spacing: 5) {
                        ForEach(row, id: \.self) { key in
                            Button { store.press(key) } label: {
                                Text(key).font(.system(size: 19, weight: .medium)).frame(maxWidth: .infinity, minHeight: 44)
                                    .background(["÷", "×", "−", "+", "="].contains(key) ? Color.orange.opacity(0.85) : Color.white.opacity(0.10))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }.buttonStyle(.plain)
                        }
                    }
                }
            }.padding(10)
        }
    }
}

struct ClockDemo: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            ScrollView {
                VStack(spacing: 12) {
                    Image(systemName: "globe").font(.system(size: 28, weight: .thin)).foregroundColor(.mint)
                    Text(context.date, style: .time).font(.system(size: 36, weight: .light, design: .rounded))
                        .lineLimit(1).minimumScaleFactor(0.4)
                    Text(context.date, style: .date).font(.caption).foregroundColor(.secondary)
                    Text(TimeZone.current.identifier.replacingOccurrences(of: "_", with: " "))
                        .font(.caption2).foregroundColor(.mint)
                    Text("A moment to breathe.").font(.caption).foregroundColor(.secondary)
                }.frame(maxWidth: .infinity).padding(20)
            }
        }
    }
}
