package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "gmw",
	Short: "Go Maven Wrapper - Interactive deployment helper for WildFly projects",
	Long: `GMW (Go Maven Wrapper) helps you build and deploy Maven projects to WildFly.

It provides interactive, guided workflows for:
- Building Maven modules with correct profiles
- Deploying to local WildFly instances
- Generating remote deployment instructions
- Detecting when WildFly restarts are needed

Examples:
  gmw build              # Build current module with default profile
  gmw build TEST         # Build with TEST profile (sinfomar only)
  gmw deploy ./target/EJBPcs.jar   # Deploy artifact locally`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
