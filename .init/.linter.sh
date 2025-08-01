#!/bin/bash
cd /home/kavia/workspace/code-generation/media-subtitle-synchronizer-93101/subtitle_sync_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

