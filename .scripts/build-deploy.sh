#!/bin/bash
set -e

# Remove any old .deb files from previous builds
rm -rf releases/pi/*.deb

# Build the new package
./.scripts/build-pi.sh

# Copy and install on the remote Pi
ssh mfsender@altfinity "rm -f ~/Downloads/*.deb" && \
scp releases/pi/*.deb mfsender@altfinity:~/Downloads/ && \
ssh mfsender@altfinity "sudo dpkg -i ~/Downloads/*.deb"