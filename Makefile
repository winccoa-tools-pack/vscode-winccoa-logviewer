.PHONY: help install build clean watch package test

# Variables
EXTENSION_NAME := winccoa-vscode-logviewer
VERSION := $(shell node -p "require('./package.json').version")
BIN_DIR := bin

# Default target
help:
	@echo "Available targets:"
	@echo "  make install    - Install all dependencies (root + webview)"
	@echo "  make build      - Build extension and webview"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make watch      - Watch mode for development"
	@echo "  make package    - Package extension as .vsix"
	@echo "  make test       - Run tests"

# Install dependencies
install:
	@echo "Installing root dependencies..."
	npm install
	@echo "Installing webview dependencies..."
	cd webview && npm install
	@echo "Dependencies installed successfully!"

# Build everything
build:
	@echo "Building extension..."
	npm run compile
	@echo "Build completed successfully!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf webview/dist/
	rm -rf out/
	rm -rf bin/
	rm -rf node_modules/
	rm -rf webview/node_modules/
	@echo "Clean completed!"

# Watch mode for development
watch:
	@echo "Starting watch mode..."
	npm run watch

# Package extension
package: build
	@echo "Packaging extension..."
	@mkdir -p $(BIN_DIR)
	npx vsce package --out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Package created: $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

# Run tests
test:
	@echo "Running tests..."
	npm test
