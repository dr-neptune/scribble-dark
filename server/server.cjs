const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const WebSocket = require('ws'); // For real-time notifications

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up WebSocket server
const wss = new WebSocket.Server({ port: 5001 }); // WebSocket on port 5001

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Function to update CSS files based on dark-mode-colors.json
function updateDarkModeStyles(colorsData) {
  const cssFiles = Object.keys(colorsData);
  const updatedFiles = [];

  cssFiles.forEach((cssFile) => {
    const cssFilePath = path.resolve(
      __dirname,
      '..',
      'public',
      'pairs-and-lists',
      '4.10 Pairs and Lists_files',
      cssFile
    );

    if (!fs.existsSync(cssFilePath)) {
      console.error(`CSS file not found: ${cssFilePath}`);
      return;
    }

    const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
    const root = postcss.parse(cssContent);

    // Find the @media (prefers-color-scheme: dark) rule or create it if it doesn't exist
    let darkModeMedia = null;
    root.walkAtRules('media', (rule) => {
      if (rule.params === '(prefers-color-scheme: dark)') {
        darkModeMedia = rule;
      }
    });

    if (!darkModeMedia) {
      darkModeMedia = postcss.atRule({ name: 'media', params: '(prefers-color-scheme: dark)' });
      root.append(darkModeMedia);
    }

    // Collect all selectors and properties from colorsData for this CSS file
    const colorsSelectors = colorsData[cssFile]; // { selector: { property: color, ... }, ... }

    // Create a Set of valid selectors and properties based on colorsData
    const validDeclarations = new Set();
    Object.entries(colorsSelectors).forEach(([selector, properties]) => {
      Object.keys(properties).forEach((property) => {
        validDeclarations.add(`${selector}||${property}`);
      });
    });

    // Remove declarations not present in colorsData
    darkModeMedia.walkRules((rule) => {
      const selector = rule.selector;
      rule.walkDecls((decl) => {
        const key = `${selector}||${decl.prop}`;
        if (!validDeclarations.has(key)) {
          decl.remove();
          console.log(`Removed declaration: ${selector} { ${decl.prop}: ${decl.value}; }`);
        }
      });

      // If a rule has no declarations left, remove the rule
      if (rule.nodes.length === 0) {
        rule.remove();
        console.log(`Removed empty selector: ${selector}`);
      }
    });

    // Iterate over colorsData and add/update declarations
    Object.entries(colorsSelectors).forEach(([selector, properties]) => {
      Object.entries(properties).forEach(([property, newColor]) => {
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
            console.log(`Updated declaration: ${selector} { ${property}: ${newColor}; }`);
          } else {
            existingRule.append({ prop: property, value: newColor });
            console.log(`Added declaration: ${selector} { ${property}: ${newColor}; }`);
          }
        } else {
          // Create a new rule with the property
          const newRule = postcss.rule({ selector });
          newRule.append({ prop: property, value: newColor });
          darkModeMedia.append(newRule);
          console.log(`Added new selector and declaration: ${selector} { ${property}: ${newColor}; }`);
        }
      });
    });

    // Safely check if darkModeMedia.nodes exists before accessing length
    if (!darkModeMedia.nodes || darkModeMedia.nodes.length === 0) {
      darkModeMedia.remove();
      console.log('Removed empty @media (prefers-color-scheme: dark) block.');
    }

    // Write the updated CSS back to the file
    const updatedCss = root.toResult().css;
    fs.writeFileSync(cssFilePath, updatedCss, 'utf-8');
    console.log(`Updated dark mode styles in ${cssFile}`);
    updatedFiles.push(cssFile);
  });

  return updatedFiles;
}

// Endpoint to receive dark-mode-colors.json data
app.post('/save-colors', (req, res) => {
  const colorsData = req.body;

  // Basic validation to ensure colorsData is an object
  if (typeof colorsData !== 'object' || colorsData === null) {
    console.error('Invalid colorsData format.');
    return res.status(400).json({ message: 'Invalid data format.' });
  }

  // Optionally, add further validation for color formats here

  // Define the path to save dark-mode-colors.json
  const filePath = path.resolve(__dirname, '..', 'public', 'dark-mode-colors.json');

  // Write the JSON data to the file
  fs.writeFile(filePath, JSON.stringify(colorsData, null, 2), 'utf-8', (err) => {
    if (err) {
      console.error('Error writing dark-mode-colors.json:', err);
      return res.status(500).json({ message: 'Failed to save colors.' });
    }

    console.log('dark-mode-colors.json has been updated successfully.');

    // Update dark mode styles
    const updatedFiles = updateDarkModeStyles(colorsData);

    // Notify frontend via WebSocket
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update' }));
      }
    });

    res.status(200).json({ message: 'Colors saved successfully.', updatedFiles });
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
