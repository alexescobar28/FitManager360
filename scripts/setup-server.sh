#!/bin/bash

# Server setup script for FitManager360
# Run this script on your production server (VPS/EC2)

set -e

echo "🖥️ Setting up FitManager360 production server..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo "📝 Installing Git..."
sudo apt install git -y

# Install curl (if not present)
sudo apt install curl -y

# Create project directory
echo "📁 Creating project directory..."
sudo mkdir -p /opt/fitmanager360
sudo chown $USER:$USER /opt/fitmanager360

# Clone repository
echo "📥 Cloning repository..."
cd /opt/fitmanager360
git clone https://github.com/AtikTF/FitManager360.git .

# Set up environment file
echo "⚙️ Setting up environment file..."
cp .env.prod.example .env.prod

echo "✅ Server setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Edit /opt/fitmanager360/.env.prod with your configuration"
echo "2. Set up GitHub Container Registry access:"
echo "   - Create a GitHub Personal Access Token with read:packages permission"
echo "   - Add GITHUB_TOKEN and GITHUB_USERNAME to .env.prod"
echo "3. Configure your domain and SSL certificates"
echo "4. Run the deployment script: ./scripts/deploy.sh"
echo ""
echo "🔐 For GitHub Actions deployment, add these secrets to your repository:"
echo "   - DEPLOY_SSH_KEY: Your server's SSH private key"
echo "   - DEPLOY_USER: Username for SSH connection"
echo "   - DEPLOY_HOST: Your server's IP address or domain"
echo "   - SLACK_WEBHOOK: (Optional) Slack webhook for notifications"
