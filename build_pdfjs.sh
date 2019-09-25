#!/usr/bin/env bash
cd ./pdfjs/
gulp generic
cd ..
cp -r ./pdfjs/build/generic/build/. ./src/pdfjs/
sed -i -e 's/2\.1\.0/2.1.266/g' ./src/pdfjs/pdf.js
sed -i -e 's/2\.1\.0/2.1.266/g' ./src/pdfjs/pdf.worker.js
