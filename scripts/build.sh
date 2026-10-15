#!/bin/sh
# Build dist/thunselect-<version>.xpi from the source tree.
set -eu
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="dist/thunselect-$version.xpi"
mkdir -p dist
rm -f "$out"
zip -q -X "$out" manifest.json api/schema.json api/implementation.js options/options.html options/options.js options/options.css icons/icon.svg LICENSE icons/LICENSE
echo "$out"
