#!/bin/bash

if ! command -v cloudflared &> /dev/null; then
    echo "Installing cloudflared..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    else
        wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    fi
fi

echo "Creating Cloudflare Tunnel..."
echo ""
echo "This will create a public URL for your planning system."
echo "The tunnel provides HTTPS and a public DNS name."
echo ""

cloudflared tunnel --url http://127.0.0.1:8080
