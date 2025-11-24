package cmd

import (
	"fmt"

	"github.com/ppowo/gmw/internal/config"
	"github.com/ppowo/gmw/internal/deployer"
	"github.com/ppowo/gmw/internal/detector"
	"github.com/spf13/cobra"
)

var deployCmd = &cobra.Command{
	Use:   "deploy <artifact>",
	Short: "Deploy an artifact to WildFly",
	Long: `Deploy a JAR or WAR file to the local WildFly instance.

The command will:
1. Detect which project the artifact belongs to
2. Determine if it's a global module or normal deployment
3. Show the deployment plan
4. Ask for confirmation
5. Execute the deployment
6. Check if WildFly restart is needed
7. Show remote deployment instructions

Examples:
  gmw deploy ./target/EJBPcs.jar
  gmw deploy ./target/SinfoMto.war
  gmw deploy ../EJBMto/target/EJBMto.jar`,
	Args: cobra.ExactArgs(1),
	RunE: runDeploy,
}

func init() {
	rootCmd.AddCommand(deployCmd)
}

func runDeploy(cmd *cobra.Command, args []string) error {
	artifactPath := args[0]

	// Load configuration
	cfg, err := config.Load("config.yaml")
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Detect project from current directory
	cwd, err := detector.GetWorkingDirectory()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %w", err)
	}

	projectInfo, err := detector.DetectProject(cwd, cfg)
	if err != nil {
		return fmt.Errorf("failed to detect project: %w", err)
	}

	// Deploy the artifact
	d := deployer.NewDeployer(cfg, projectInfo)
	if err := d.Deploy(artifactPath); err != nil {
		return fmt.Errorf("deployment failed: %w", err)
	}

	return nil
}
