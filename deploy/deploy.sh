#!/bin/bash

# Pull latest changes
echo "Pulling changes from GitHub..."
cd ~/FarmRA
git pull

# Copy files to web root
echo "Copying files to /var/www/html..."
sudo rm -rf /var/www/html/farmra.net/*
sudo cp -r ~/FarmRA/frontend/* /var/www/html/farmra.net/

# Copies deployment script to home directory" 
cp ~/FarmRA/deploy/deploy.sh ~/deploy.sh

echo "Repository copied to web root"