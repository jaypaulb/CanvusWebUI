const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Path to CSS file
const CSS_FILE_PATH = path.join(__dirname, '../public/css/styles.css');

// Helper function to read CSS file
async function readCSSFile() {
    try {
        return await fs.readFile(CSS_FILE_PATH, 'utf8');
    } catch (error) {
        console.error('Error reading CSS file:', error);
        throw new Error('Failed to read theme file');
    }
}

// Helper function to write CSS file
async function writeCSSFile(content) {
    try {
        await fs.writeFile(CSS_FILE_PATH, content, 'utf8');
    } catch (error) {
        console.error('Error writing CSS file:', error);
        throw new Error('Failed to save theme changes');
    }
}

// Helper function to update theme variables in CSS
function updateThemeVariables(css, theme, styles) {
    const themePrefix = theme === 'default' ? '' : `${theme}-`;
    const cssLines = css.split('\n');
    let inThemeBlock = false;
    let updatedCss = '';

    for (const line of cssLines) {
        if (line.includes(`[data-theme="${theme}"]`)) {
            inThemeBlock = true;
            updatedCss += line + '\n';
            // Add updated variables
            Object.entries(styles).forEach(([key, value]) => {
                updatedCss += `  ${key}: ${value};\n`;
            });
        } else if (inThemeBlock && line.includes('}')) {
            inThemeBlock = false;
            updatedCss += line + '\n';
        } else if (!inThemeBlock) {
            updatedCss += line + '\n';
        }
    }

    return updatedCss;
}

// Helper function to create new theme block
function createThemeBlock(name, baseTheme, css) {
    const baseThemeStyles = extractThemeStyles(css, baseTheme);
    return `
/* ${name} theme */
[data-theme="${name}"] {
${baseThemeStyles}
}
`;
}

// Helper function to extract theme styles
function extractThemeStyles(css, theme) {
    const themeRegex = new RegExp(`\\[data-theme="${theme}"\\] {([^}]+)}`);
    const match = css.match(themeRegex);
    return match ? match[1].trim() : '';
}

// Update theme endpoint
router.post('/update-theme', async (req, res) => {
    try {
        const { theme, styles } = req.body;
        console.log('[update-theme] Received request:', { theme, styles });
        
        if (!theme || !styles) {
            console.log('[update-theme] Missing data:', { theme: !!theme, styles: !!styles });
            return res.status(400).json({ error: 'Missing theme or styles data' });
        }

        let css = await readCSSFile();
        css = updateThemeVariables(css, theme, styles);
        await writeCSSFile(css);

        res.json({ success: true, message: 'Theme updated successfully' });
    } catch (error) {
        console.error('Error updating theme:', error);
        res.status(500).json({ error: 'Failed to update theme' });
    }
});

// Create theme endpoint
router.post('/create-theme', async (req, res) => {
    try {
        const { name, baseTheme } = req.body;
        console.log('[create-theme] Received request:', { name, baseTheme });
        
        if (!name || !baseTheme) {
            console.log('[create-theme] Missing data:', { name: !!name, baseTheme: !!baseTheme });
            return res.status(400).json({ error: 'Missing theme name or base theme' });
        }

        // Read current CSS
        let css = await readCSSFile();
        
        // Check if theme already exists
        if (css.includes(`[data-theme="${name}"]`)) {
            return res.status(400).json({ error: 'Theme already exists' });
        }

        // Create new theme block
        const newThemeBlock = createThemeBlock(name, baseTheme, css);
        
        // Add new theme block to CSS
        css += newThemeBlock;
        
        // Save updated CSS
        await writeCSSFile(css);

        res.json({ success: true, message: 'Theme created successfully' });
    } catch (error) {
        console.error('Error creating theme:', error);
        res.status(500).json({ error: 'Failed to create theme' });
    }
});

module.exports = router; 