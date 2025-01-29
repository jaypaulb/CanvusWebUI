#!/bin/bash

echo "Stopping  webui..."
pm2 stop webui

echo "Pulling latest changes..."
git pull

echo "Starting webui..."
pm2 start webui

echo "Update complete!" 