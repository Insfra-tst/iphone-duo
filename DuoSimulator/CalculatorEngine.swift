import Foundation

struct CalculatorEngine {
    private(set) var display = "0"
    private var stored: Double?
    private var operation: String?
    private var fresh = true

    mutating func press(_ key: String) {
        if key == "AC" { self = CalculatorEngine(); return }
        if display == "Error" { self = CalculatorEngine() }
        switch key {
        case "0"..."9":
            if fresh || display == "0" { display = key; fresh = false }
            else if display.filter({ $0.isNumber }).count < 12 { display += key }
        case ".":
            if fresh { display = "0"; fresh = false }
            if !display.contains(".") { display += "." }
        case "±":
            if display != "0" { display = display.hasPrefix("-") ? String(display.dropFirst()) : "-" + display }
        case "%":
            show((Double(display) ?? 0) / 100)
        case "⌫":
            guard !fresh else { return }
            display = String(display.dropLast())
            if display.isEmpty || display == "-" { display = "0" }
        case "+", "−", "×", "÷":
            if operation != nil && !fresh { calculate() }
            guard display != "Error" else { return }
            stored = Double(display)
            operation = key
            fresh = true
        case "=":
            if operation != nil { calculate() }
            operation = nil
            stored = nil
            fresh = true
        default: break
        }
    }

    private mutating func calculate() {
        guard let lhs = stored, let rhs = Double(display), let op = operation else { return }
        switch op {
        case "+": show(lhs + rhs)
        case "−": show(lhs - rhs)
        case "×": show(lhs * rhs)
        case "÷": show(rhs == 0 ? .nan : lhs / rhs)
        default: break
        }
    }

    private mutating func show(_ value: Double) {
        display = value.isFinite ? String(format: "%.10g", locale: Locale(identifier: "en_US_POSIX"), value) : "Error"
        fresh = true
    }
}
