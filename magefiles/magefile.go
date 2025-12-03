//go:build mage

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

func isInPath(dir string) bool {
	pathEnv := os.Getenv("PATH")
	pathSeparator := ":"
	if runtime.GOOS == "windows" {
		pathSeparator = ";"
	}

	paths := strings.Split(pathEnv, pathSeparator)
	dir = filepath.Clean(dir)

	for _, p := range paths {
		cleanPath := filepath.Clean(p)
		if cleanPath == dir {
			return true
		}
	}
	return false
}

func getInstallDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	bioDir := homeDir + "/.bio/bin"
	if info, err := os.Stat(bioDir); err == nil && info.IsDir() {
		return bioDir, nil
	}

	var candidateDir string
	switch runtime.GOOS {
	case "linux":
		candidateDir = homeDir + "/.local/bin"
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			localAppData = homeDir + "\\AppData\\Local"
		}
		candidateDir = localAppData + "\\Microsoft\\WindowsApps"
	case "darwin":
		return "", fmt.Errorf("on macOS, please create ~/.bio/bin first, or use sudo to install to /usr/local/bin")
	default:
		return "", fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	// Only check PATH for platform-specific defaults
	if !isInPath(candidateDir) {
		return "", fmt.Errorf("installation directory %s is not in PATH - please create ~/.bio/bin and add it to your PATH, or add %s to your PATH", candidateDir, candidateDir)
	}

	return candidateDir, nil
}

// Install builds and installs jmw to ~/.local/bin or ~/.bio/bin
func Install() error {
	fmt.Println("Installing jmw...")

	installDir, err := getInstallDir()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(installDir, 0755); err != nil {
		return fmt.Errorf("failed to create install directory: %w", err)
	}

	mg.Deps(Build)

	binary := "jmw"
	if runtime.GOOS == "windows" {
		binary = "jmw.exe"
	}

	src := "bin/" + binary
	dst := installDir + "/" + binary
	if runtime.GOOS == "windows" {
		dst = installDir + "\\" + binary
	}

	if err := sh.Copy(dst, src); err != nil {
		return fmt.Errorf("failed to copy binary: %w", err)
	}

	if runtime.GOOS != "windows" {
		if err := os.Chmod(dst, 0755); err != nil {
			return fmt.Errorf("failed to make executable: %w", err)
		}
	}

	fmt.Printf("✓ Installed to %s\n", dst)
	return nil
}

// Build compiles the jmw binary
func Build() error {
	fmt.Println("Building jmw...")
	return sh.Run("go", "build", "-o", "bin/jmw", ".")
}

// Clean removes build artifacts
func Clean() error {
	fmt.Println("Cleaning...")
	return sh.Rm("bin")
}
