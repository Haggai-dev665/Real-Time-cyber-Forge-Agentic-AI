#!/bin/bash

# ============================================================================
# CyberForge AI - Hugging Face Space Deployment Script
# ============================================================================

set -e

echo "🔐 CyberForge AI - Hugging Face Deployment"
echo "==========================================="

# Configuration
SPACE_ID="${HF_SPACE_ID:-Che237/cyberforge}"
HF_TOKEN="${HF_TOKEN:-}"
SPACE_DIR="./huggingface_space"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Hugging Face CLI is installed
check_hf_cli() {
    if ! command -v huggingface-cli &> /dev/null; then
        echo -e "${YELLOW}Installing Hugging Face CLI...${NC}"
        pip install huggingface_hub[cli]
    fi
    echo -e "${GREEN}✓ Hugging Face CLI available${NC}"
}

# Login to Hugging Face
hf_login() {
    if [ -z "$HF_TOKEN" ]; then
        echo -e "${YELLOW}Please login to Hugging Face:${NC}"
        huggingface-cli login
    else
        echo -e "${GREEN}Using HF_TOKEN from environment${NC}"
        huggingface-cli login --token "$HF_TOKEN"
    fi
}

# Clone the Space repository
clone_space() {
    echo -e "\n${YELLOW}Cloning Hugging Face Space...${NC}"
    
    if [ -d "hf_space_repo" ]; then
        echo "Removing existing clone..."
        rm -rf hf_space_repo
    fi
    
    git clone "https://huggingface.co/spaces/$SPACE_ID" hf_space_repo
    echo -e "${GREEN}✓ Space cloned successfully${NC}"
}

# Copy files to Space repo
copy_files() {
    echo -e "\n${YELLOW}Copying files to Space repository...${NC}"
    
    # Copy main app
    cp "$SPACE_DIR/app.py" hf_space_repo/
    cp "$SPACE_DIR/requirements.txt" hf_space_repo/
    cp "$SPACE_DIR/trainer.py" hf_space_repo/
    cp "$SPACE_DIR/hf_client.py" hf_space_repo/
    
    # Copy README if exists
    if [ -f "$SPACE_DIR/README.md" ]; then
        cp "$SPACE_DIR/README.md" hf_space_repo/
    fi
    
    echo -e "${GREEN}✓ Files copied${NC}"
}

# Push to Hugging Face
push_space() {
    echo -e "\n${YELLOW}Pushing to Hugging Face Space...${NC}"
    
    cd hf_space_repo
    
    git add .
    git commit -m "Deploy CyberForge AI ML Training Platform $(date +%Y-%m-%d)"
    git push
    
    cd ..
    
    echo -e "${GREEN}✓ Pushed to Hugging Face${NC}"
}

# Clean up
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    rm -rf hf_space_repo
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main deployment flow
main() {
    echo -e "\n${YELLOW}Starting deployment...${NC}\n"
    
    check_hf_cli
    hf_login
    clone_space
    copy_files
    push_space
    cleanup
    
    echo -e "\n${GREEN}=========================================${NC}"
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo -e "\nYour Space is available at:"
    echo -e "${YELLOW}https://huggingface.co/spaces/$SPACE_ID${NC}"
    echo -e "\nIt may take a few minutes for the Space to build and start."
}

# Run main
main
