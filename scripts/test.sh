#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
swiftc DuoSimulator/CalculatorEngine.swift Tests/main.swift -o build/calculator-tests
build/calculator-tests
