import Foundation

func result(_ keys: [String]) -> String {
    var engine = CalculatorEngine()
    keys.forEach { engine.press($0) }
    return engine.display
}
func check(_ keys: [String], _ expected: String) {
    let actual = result(keys)
    precondition(actual == expected, "\(keys): expected \(expected), got \(actual)")
}
check(["2", "+", "3", "="], "5")
check(["9", "−", "4", "="], "5")
check(["6", "×", "7", "="], "42")
check(["8", "÷", "2", "="], "4")
check(["1", ".", "5", "+", "2", ".", "5", "="], "4")
check(["1", "÷", "0", "="], "Error")
check(["1", "÷", "0", "=", "3"], "3")
check(["2", "+", "3", "×", "4", "="], "20")
check(["2", "+", "×", "3", "="], "6")
check(["5", "±"], "-5")
check(["5", "0", "%"], "0.5")
check(["1", "2", "⌫"], "1")
check(["1", "AC"], "0")
check(["2", "+", "3", "=", "7"], "7")
var first = CalculatorEngine()
let second = CalculatorEngine()
first.press("9")
precondition(second.display == "0", "Calculators must have independent state")
print("PASS: arithmetic, decimals, chaining, operator replacement, zero division, recovery, editing and independent state")
