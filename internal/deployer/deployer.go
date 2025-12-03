package deployer

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/ppowo/jmw/internal/config"
	"github.com/ppowo/jmw/internal/detector"
)

// Deployer handles deployment operations
type Deployer struct {
	cfg         *config.Config
	projectInfo *detector.ProjectInfo
}

// NewDeployer creates a new Deployer instance
func NewDeployer(cfg *config.Config, projectInfo *detector.ProjectInfo) *Deployer {
	return &Deployer{
		cfg:         cfg,
		projectInfo: projectInfo,
	}
}

// Deploy deploys an artifact to WildFly
func (d *Deployer) Deploy(artifactPath string) error {
	// Resolve artifact path
	absPath, err := filepath.Abs(artifactPath)
	if err != nil {
		return fmt.Errorf("failed to resolve artifact path: %w", err)
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return fmt.Errorf("artifact not found: %s", absPath)
	}

	artifactName := filepath.Base(absPath)
	isGlobal := d.projectInfo.IsGlobalModule

	// Show deployment plan
	d.showDeploymentPlan(artifactName, isGlobal)

	// Ask for confirmation
	if !d.confirm("Proceed?") {
		fmt.Println("Deployment cancelled.")
		return nil
	}

	// Execute deployment
	fmt.Println()
	if isGlobal {
		if err := d.deployGlobalModule(absPath); err != nil {
			return err
		}
	} else {
		if err := d.deployNormalModule(absPath); err != nil {
			return err
		}
	}

	fmt.Println("\n✅ Deployed successfully")

	// Check restart requirements
	d.checkRestartRequired(isGlobal, artifactName)

	// Show remote deployment guide
	d.showRemoteGuide(artifactPath, artifactName, isGlobal)

	return nil
}

// showDeploymentPlan displays the deployment plan
func (d *Deployer) showDeploymentPlan(artifactName string, isGlobal bool) {
	fmt.Println("\n📦 LOCAL DEPLOYMENT")
	fmt.Println(strings.Repeat("━", 50))
	fmt.Printf("Project: %s\n", d.projectInfo.Name)
	fmt.Printf("Module: %s", d.projectInfo.ModuleName)

	if isGlobal {
		fmt.Printf(" (global)\n")
		targetPath := d.projectInfo.GetGlobalModulePath()
		fmt.Printf("Source: %s\n", artifactName)
		fmt.Printf("Target: %s\n", targetPath)
		fmt.Println("\nCommands:")
		fmt.Printf("  1. cp %s %s\n", artifactName, targetPath)
	} else {
		fmt.Printf(" (normal)\n")
		if d.projectInfo.Config.WildFlyMode == "domain" {
			fmt.Printf("Server group: %s\n", d.projectInfo.Config.ServerGroup)
			fmt.Println("\nCommands:")
			fmt.Println("  1. jboss-cli.sh undeploy (if exists)")
			fmt.Printf("  2. jboss-cli.sh deploy --server-groups=%s\n", d.projectInfo.Config.ServerGroup)
		} else {
			deployPath := filepath.Join(d.projectInfo.Config.WildFlyRoot, "standalone", "deployments")
			fmt.Printf("Target: %s\n", deployPath)
			fmt.Println("\nCommands:")
			fmt.Printf("  1. cp %s %s\n", artifactName, deployPath)
			fmt.Printf("  2. touch %s/%s.dodeploy\n", deployPath, artifactName)
		}
	}
}

// deployGlobalModule deploys a global module
func (d *Deployer) deployGlobalModule(artifactPath string) error {
	targetDir := d.projectInfo.GetGlobalModulePath()
	targetPath := filepath.Join(targetDir, filepath.Base(artifactPath))

	fmt.Printf("📦 Copying to global module directory...\n")
	fmt.Printf("   %s\n", targetDir)

	// Create target directory if it doesn't exist
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory: %w", err)
	}

	// Copy file
	if err := copyFile(artifactPath, targetPath); err != nil {
		return fmt.Errorf("failed to copy artifact: %w", err)
	}

	return nil
}

// deployNormalModule deploys a normal module
func (d *Deployer) deployNormalModule(artifactPath string) error {
	if d.projectInfo.Config.WildFlyMode == "domain" {
		return d.deployDomain(artifactPath)
	}
	return d.deployStandalone(artifactPath)
}

// deployDomain deploys to domain mode WildFly
func (d *Deployer) deployDomain(artifactPath string) error {
	jbossCli := filepath.Join(d.projectInfo.Config.WildFlyRoot, "bin", "jboss-cli.sh")
	artifactName := filepath.Base(artifactPath)
	serverGroup := d.projectInfo.Config.ServerGroup

	// Undeploy first (ignore errors if not deployed)
	fmt.Printf("📦 Undeploying existing deployment (if any)...\n")
	undeployCmd := exec.Command(jbossCli, "--connect", "controller=localhost",
		fmt.Sprintf("undeploy %s --server-groups=%s", artifactName, serverGroup))
	if err := undeployCmd.Run(); err != nil {
		// Continue anyway - artifact might not be deployed
		fmt.Printf("   (No existing deployment found or undeploy failed - continuing)\n")
	}

	// Deploy
	fmt.Printf("📦 Deploying to server group %s...\n", serverGroup)
	deployCmd := exec.Command(jbossCli, "--connect", "controller=localhost",
		fmt.Sprintf("deploy %s --server-groups=%s", artifactPath, serverGroup))
	deployCmd.Stdout = os.Stdout
	deployCmd.Stderr = os.Stderr

	if err := deployCmd.Run(); err != nil {
		return fmt.Errorf("deployment failed: %w", err)
	}

	return nil
}

// deployStandalone deploys to standalone mode WildFly
func (d *Deployer) deployStandalone(artifactPath string) error {
	deployDir := filepath.Join(d.projectInfo.Config.WildFlyRoot, "standalone", "deployments")
	artifactName := filepath.Base(artifactPath)
	targetPath := filepath.Join(deployDir, artifactName)
	dodepFile := targetPath + ".dodeploy"

	// Copy artifact
	fmt.Printf("📦 Copying to deployments directory...\n")
	if err := copyFile(artifactPath, targetPath); err != nil {
		return fmt.Errorf("failed to copy artifact: %w", err)
	}

	// Create .dodeploy marker
	fmt.Printf("📦 Creating deployment marker...\n")
	if err := os.WriteFile(dodepFile, []byte{}, 0644); err != nil {
		return fmt.Errorf("failed to create .dodeploy marker: %w", err)
	}

	// Wait for deployment
	fmt.Printf("📦 Waiting for deployment...\n")
	time.Sleep(2 * time.Second)

	deployedFile := targetPath + ".deployed"
	failedFile := targetPath + ".failed"

	if _, err := os.Stat(deployedFile); err == nil {
		fmt.Printf("✅ %s.deployed found\n", artifactName)
	} else if _, err := os.Stat(failedFile); err == nil {
		fmt.Printf("❌ Deployment failed - check server logs\n")
	}

	return nil
}

// checkRestartRequired determines if a restart is needed
func (d *Deployer) checkRestartRequired(isGlobal bool, artifactName string) {
	fmt.Println()

	severity, reason := d.determineRestartRequirement(isGlobal, artifactName)

	if severity == "none" {
		fmt.Println("ℹ️  NO RESTART NEEDED")
		fmt.Printf("Reason: %s\n", reason)
		return
	}

	switch severity {
	case "recommended":
		fmt.Println("⚠️  RESTART RECOMMENDED")
		fmt.Printf("Reason: %s\n", reason)
	case "required":
		fmt.Println("⚠️  RESTART REQUIRED")
		fmt.Printf("Reason: %s\n", reason)
	}

	// Show restart commands
	fmt.Println("\nRestart command:")
	wildflyBin := filepath.Join(d.projectInfo.Config.WildFlyRoot, "bin")
	fmt.Printf("  cd %s\n", wildflyBin)
	fmt.Printf("  ./jboss-cli.sh --connect")
	if d.projectInfo.Config.WildFlyMode == "domain" {
		fmt.Printf(" controller=localhost")
	}
	fmt.Printf(" --command=\":shutdown\"\n")

	// Show alias if available
	switch d.projectInfo.Name {
	case "sinfomar":
		fmt.Printf("  sin-wildfly\n")
	case "mto":
		fmt.Printf("  mto-wildfly\n")
	}
}

// determineRestartRequirement uses config rules to determine restart needs
func (d *Deployer) determineRestartRequirement(isGlobal bool, artifactName string) (string, string) {
	// Check global module override
	if isGlobal && d.cfg.RestartRules != nil && d.cfg.RestartRules.GlobalModule {
		return "required", "Global module modification"
	}

	// If no restart rules configured, fall back to basic checks
	if d.cfg.RestartRules == nil || len(d.cfg.RestartRules.Patterns) == 0 {
		return d.fallbackRestartCheck(isGlobal, artifactName)
	}

	// Check artifact name against patterns
	for _, pattern := range d.cfg.RestartRules.Patterns {
		matched, err := regexp.MatchString(pattern.Match, artifactName)
		if err != nil {
			// Skip invalid regex patterns
			continue
		}
		if matched {
			return pattern.Severity, pattern.Reason
		}
	}

	// Check source files against patterns
	matches := d.checkSourceFilesAgainstPatterns()
	if len(matches) > 0 {
		// Return the highest severity match
		highestSeverity := "recommended"
		for _, match := range matches {
			if match.Severity == "required" {
				highestSeverity = "required"
				break
			}
		}
		return highestSeverity, fmt.Sprintf("Source code changes: %s", matches[0].Reason)
	}

	// No patterns matched, check WAR for hot-deployment
	if strings.HasSuffix(artifactName, ".war") {
		return "none", "WAR hot-deployment"
	}

	return "recommended", "Standard deployment (restart to ensure changes are loaded)"
}

// checkSourceFilesAgainstPatterns scans source files for pattern matches
func (d *Deployer) checkSourceFilesAgainstPatterns() []*config.RestartPattern {
	if d.cfg.RestartRules == nil || len(d.cfg.RestartRules.Patterns) == 0 {
		return nil
	}

	var matches []*config.RestartPattern

	// Look for patterns in the module path
	for _, pattern := range d.cfg.RestartRules.Patterns {
		// Create regex
		matcher, err := regexp.Compile(pattern.Match)
		if err != nil {
			continue
		}

		// Check if any file in module path matches the pattern
		err = filepath.WalkDir(d.projectInfo.ModulePath, func(path string, info os.DirEntry, err error) error {
			if err != nil {
				return nil // Skip errors
			}

			// Get relative path from module root
			relPath, err := filepath.Rel(d.projectInfo.ModulePath, path)
			if err != nil {
				return nil
			}

			// Match against pattern
			if matcher.MatchString(relPath) {
				matches = append(matches, pattern)
				return filepath.SkipAll // Found match, stop walking
			}

			return nil
		})

		if err == filepath.SkipAll {
			// Pattern matched, continue to check other patterns
			continue
		}
	}

	return matches
}

// fallbackRestartCheck provides basic restart checks when no rules are configured
func (d *Deployer) fallbackRestartCheck(isGlobal bool, artifactName string) (string, string) {
	if isGlobal {
		return "required", "Global module modification"
	}

	if strings.HasSuffix(artifactName, ".jar") && strings.Contains(artifactName, "EJB") {
		return "recommended", "EJB implementation JAR"
	}

	if strings.HasSuffix(artifactName, ".war") {
		return "none", "WAR hot-deployment"
	}

	return "recommended", "Standard deployment (restart to ensure changes are loaded)"
}

// showRemoteGuide displays remote deployment instructions
func (d *Deployer) showRemoteGuide(artifactPath string, artifactName string, isGlobal bool) {
	if d.projectInfo.Config.Remote == nil {
		return
	}

	remote := d.projectInfo.Config.Remote

	fmt.Println("\n📝 REMOTE DEPLOYMENT GUIDE")
	fmt.Println(strings.Repeat("━", 50))
	fmt.Printf("Host: %s@%s\n\n", remote.User, remote.Host)

	if isGlobal {
		remotePath := filepath.Join(remote.WildFlyPath, d.projectInfo.DeploymentPath)
		fmt.Println("1. Copy artifact:")
		fmt.Printf("   scp %s %s@%s:%s\n", artifactPath, remote.User, remote.Host, remotePath)
	} else {
		if d.projectInfo.Config.WildFlyMode == "standalone" {
			deployPath := filepath.Join(remote.WildFlyPath, "standalone", "deployments")
			fmt.Println("1. Copy artifact:")
			fmt.Printf("   scp %s %s@%s:%s\n", artifactPath, remote.User, remote.Host, deployPath)
			fmt.Println("\n2. Trigger deployment:")
			fmt.Printf("   ssh %s@%s \"touch %s/%s.dodeploy\"\n", remote.User, remote.Host, deployPath, artifactName)
		} else {
			// Domain mode
			serverGroup := d.projectInfo.Config.ServerGroup
			fmt.Println("1. Copy artifact to remote server:")
			fmt.Printf("   scp %s %s@%s:/tmp/\n", artifactPath, remote.User, remote.Host)
			fmt.Println("\n2. Deploy via jboss-cli:")
			jbossCli := filepath.Join(remote.WildFlyPath, "bin", "jboss-cli.sh")
			fmt.Printf("   ssh %s@%s \"%s --connect controller=localhost 'undeploy %s --server-groups=%s'\"\n",
				remote.User, remote.Host, jbossCli, artifactName, serverGroup)
			fmt.Printf("   ssh %s@%s \"%s --connect controller=localhost 'deploy /tmp/%s --server-groups=%s'\"\n",
				remote.User, remote.Host, jbossCli, artifactName, serverGroup)
		}
	}

	fmt.Println("\n2. Restart WildFly:")
	fmt.Printf("   ssh %s@%s \"%s\"\n", remote.User, remote.Host, remote.RestartCmd)

	fmt.Println("\n3. Verify deployment:")
	logPath := filepath.Join(remote.WildFlyPath, "standalone", "log", "server.log")
	if d.projectInfo.Config.WildFlyMode == "domain" {
		logPath = filepath.Join(remote.WildFlyPath, "domain", "log", "server.log")
	}
	fmt.Printf("   ssh %s@%s \"tail -f %s\"\n", remote.User, remote.Host, logPath)
}

// copyFile copies a file
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

// confirm asks the user for confirmation
func (d *Deployer) confirm(question string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("\n%s [Y/n] ", question)

	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	response = strings.TrimSpace(strings.ToLower(response))
	return response == "" || response == "y" || response == "yes"
}
