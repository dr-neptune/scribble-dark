// src/update-dark-mode.cjs

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

// Path to the dark-mode-colors.json configuration file
const configPath = path.resolve(__dirname, '..', 'public', 'dark-mode-colors.json');

if (!fs.existsSync(configPath)) {
  console.error('Configuration file dark-mode-colors.json not found. Please generate it using the React app.');
  process.exit(1);
}

// Read and parse the configuration
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// List of CSS files to update
const cssFiles = Object.keys(config);

// Iterate over each CSS file
cssFiles.forEach((cssFile) => {
  const cssFilePath = path.resolve(__dirname, 'assets', '4.10 Pairs and Lists_files', cssFile);

  if (!fs.existsSync(cssFilePath)) {
    console.error(`CSS file not found: ${cssFilePath}`);
    return;
  }

  // Read the CSS file content
  const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

  // Parse the CSS using PostCSS
  const root = postcss.parse(cssContent);

  // Find the @media (prefers-color-scheme: dark) rule or create it if it doesn't exist
  let darkModeMedia = null;
  root.walkAtRules('media', (rule) => {
    if (rule.params === '(prefers-color-scheme: dark)') {
      darkModeMedia = rule;
    }
  });

  if (!darkModeMedia) {
    // Create the media rule at the end of the CSS
    darkModeMedia = postcss.atRule({ name: 'media', params: '(prefers-color-scheme: dark)' });
    root.append(darkModeMedia);
  }

  // Iterate over each selector and property to update
  Object.entries(config[cssFile]).forEach(([selector, properties]) => {
    Object.entries(properties).forEach(([property, newColor]) => {
      // Find the existing rule within the media query
      let existingRule = null;
      darkModeMedia.walkRules(selector, (rule) => {
        existingRule = rule;
      });

      if (existingRule) {
        // Update the property if it exists, else add it
        let existingDecl = null;
        existingRule.walkDecls(property, (decl) => {
          existingDecl = decl;
        });

        if (existingDecl) {
          existingDecl.value = newColor;
        } else {
          existingRule.append({ prop: property, value: newColor });
        }
      } else {
        // Create a new rule with the property
        const newRule = postcss.rule({ selector });
        newRule.append({ prop: property, value: newColor });
        darkModeMedia.append(newRule);
      }
    });
  });

  // Write the updated CSS back to the file
  const updatedCss = root.toResult().css;
  fs.writeFileSync(cssFilePath, updatedCss, 'utf-8');
  console.log(`Updated dark mode styles in ${cssFile}`);
});
