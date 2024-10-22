// src/parse-css.cjs

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

// Directory containing the CSS files
const cssFilesDir = path.resolve(__dirname, 'assets/4.10 Pairs and Lists_files');

// List of CSS files to parse
const cssFiles = [
  'manual-racket.css',
  'scribble.css',
  'manual-style.css',
  'racket.css',
];

// Color-related properties to look for
const colorProperties = ['color', 'background-color', 'border-color', 'fill', 'stroke'];

const colorPropsSet = new Set(colorProperties);

let colorPropertiesData = {};

// Function to parse a CSS file
function parseCssFile(cssFilePath, cssFileName) {
  const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
  const root = postcss.parse(cssContent);

  root.walkRules((rule) => {
    const selector = rule.selector;
    rule.walkDecls((decl) => {
      if (colorPropsSet.has(decl.prop)) {
        if (!colorPropertiesData[cssFileName]) {
          colorPropertiesData[cssFileName] = {}
        }
        if (!colorPropertiesData[cssFileName][selector]) {
          colorPropertiesData[cssFileName][selector] = [];
        }
        if (!colorPropertiesData[cssFileName][selector].includes(decl.prop)) {
          colorPropertiesData[cssFileName][selector].push(decl.prop);
        }
      }
    });
  });
}

// Iterate over each CSS file
cssFiles.forEach((cssFileName) => {
  const cssFilePath = path.join(cssFilesDir, cssFileName);

  if (!fs.existsSync(cssFilePath)) {
    console.error(`CSS file not found: ${cssFilePath}`);
    return;
  }

  parseCssFile(cssFilePath, cssFileName);
});

// Write the extracted data to color-properties.json in public directory
const outputPath = path.resolve(__dirname, '..', 'public', 'color-properties.json');
fs.writeFileSync(outputPath, JSON.stringify(colorPropertiesData, null, 2), 'utf-8');
console.log(`Color properties extracted to ${outputPath}`);
