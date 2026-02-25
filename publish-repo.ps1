
# Check if gh is installed
if (Get-Command "gh" -ErrorAction SilentlyContinue) {
    echo "GitHub CLI found. Logging in..."
    # This might require interactive login if not already logged in
    gh auth login
    
    echo "Creating private repository 'dashboard-testnet'..."
    gh repo create dashboard-testnet --private --source=. --remote=origin --push
    
    echo "Successfully pushed to GitHub!"
} else {
    echo "GitHub CLI (gh) not found."
    echo "Please install it from https://cli.github.com/ or use the manual steps below:"
    echo "1. Create a new repository on GitHub named 'dashboard-testnet'."
    echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/dashboard-testnet.git"
    echo "3. Run: git push -u origin master"
}
