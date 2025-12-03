package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "jmw",
	Short: "Java Maven WildFly - Interactive deployment helper for WildFly projects",
	Long: `JMW (Java Maven WildFly) helps you build and deploy Maven projects to WildFly.

It provides interactive, guided workflows for:
- Building Maven modules with correct profiles
- Deploying to local WildFly instances
- Generating remote deployment instructions
- Detecting when WildFly restarts are needed

Examples:
  jmw build              # Build current module with default profile
  jmw build TEST         # Build with TEST profile (sinfomar only)
  jmw deploy ./target/EJBPcs.jar   # Deploy artifact locally`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
