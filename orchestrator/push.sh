#!/bin/bash

# Set variables
IMAGE_NAME="orch"
TAG="latest"
USER="arnavmehta7"

# Build the Docker image
echo "Building Docker image..."
docker build -t $USER/$IMAGE_NAME:$TAG .

# Check if the build was successful
if [ $? -ne 0 ]; then
    echo "Docker build failed. Exiting."
    exit 1
fi

# Push the Docker image to a registry
# Note: Ensure you are logged in to your Docker registry before running this script
echo "Tagging Docker image..."
docker tag $USER/$IMAGE_NAME:$TAG $USER/$IMAGE_NAME:$TAG
echo "Pushing Docker image to registry..."
docker push $USER/$IMAGE_NAME:$TAG

# Check if the push was successful
if [ $? -ne 0 ]; then
    echo "Docker push failed. Exiting."
    exit 1
fi

echo "Docker image pushed successfully."
