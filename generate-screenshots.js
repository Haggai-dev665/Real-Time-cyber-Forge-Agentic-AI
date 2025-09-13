#!/usr/bin/env node

/**
 * Desktop Application Screenshot Generator
 * Generates mock screenshots for documentation purposes
 */

const fs = require('fs');
const path = require('path');

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, 'docs', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Mock screenshot data for documentation
const screenshots = {
    'dashboard.png': {
        description: 'Main dashboard with real-time security metrics and threat overview',
        dimensions: '1600x1000',
        features: ['Real-time threat counter', 'System health metrics', 'Security status indicators']
    },
    'sidebar.png': {
        description: 'Enhanced sidebar navigation with 35+ components organized in collapsible sections',
        dimensions: '280x1000',
        features: ['Collapsible sections', 'Search functionality', 'Component animations']
    },
    'ai-assistant.png': {
        description: 'AI assistant interface with chat functionality and intelligent recommendations',
        dimensions: '800x600',
        features: ['Natural language chat', 'AI insights', 'Contextual recommendations']
    },
    'threat-center.png': {
        description: 'Comprehensive threat detection center with real-time analysis',
        dimensions: '1200x800',
        features: ['Live threat feed', 'Threat classification', 'Incident timeline']
    },
    'api-management.png': {
        description: 'API management console for backend service configuration',
        dimensions: '1000x700',
        features: ['Endpoint configuration', 'Health monitoring', 'Test functionality']
    },
    'database-connector.png': {
        description: 'Database connector with query console and real-time results',
        dimensions: '1200x800',
        features: ['Multi-database support', 'Query editor', 'Results visualization']
    },
    'analytics.png': {
        description: 'Security analytics dashboard with interactive charts and metrics',
        dimensions: '1400x900',
        features: ['Interactive charts', 'Trend analysis', 'Export capabilities']
    }
};

// Generate screenshot placeholder files
Object.entries(screenshots).forEach(([filename, data]) => {
    const filePath = path.join(screenshotsDir, filename);
    const placeholderContent = `# Screenshot Placeholder: ${filename}

## Description
${data.description}

## Dimensions
${data.dimensions}

## Key Features
${data.features.map(feature => `- ${feature}`).join('\n')}

## How to Generate Actual Screenshot
1. Start the desktop application: \`npm run dev:desktop\`
2. Navigate to the relevant screen
3. Use screenshot tool or browser dev tools
4. Save as ${filename} in docs/screenshots/

## Expected Visual Elements
- Black and white theme consistency
- Professional typography and spacing
- Smooth animations and transitions
- Clear information hierarchy
- Responsive layout elements
`;

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath.replace('.png', '.md'), placeholderContent);
    }
});

console.log('📷 Screenshot placeholders generated in docs/screenshots/');
console.log('🎯 To generate actual screenshots:');
console.log('   1. Run: npm run dev:desktop');
console.log('   2. Navigate through the application');
console.log('   3. Capture screenshots of each major screen');
console.log('   4. Replace .md files with actual .png images');

// Generate a simple HTML preview page
const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cyber Forge AI - Screenshots Preview</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: #000;
            color: #fff;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .screenshot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        .screenshot-card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 20px;
            transition: transform 0.3s ease;
        }
        .screenshot-card:hover {
            transform: translateY(-5px);
            border-color: #fff;
        }
        .screenshot-placeholder {
            width: 100%;
            height: 200px;
            background: linear-gradient(135deg, #333 0%, #555 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ccc;
            font-size: 14px;
            margin-bottom: 15px;
        }
        .screenshot-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #fff;
        }
        .screenshot-description {
            font-size: 14px;
            color: #ccc;
            line-height: 1.5;
            margin-bottom: 15px;
        }
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .feature-list li {
            padding: 5px 0;
            color: #aaa;
            font-size: 13px;
        }
        .feature-list li:before {
            content: '✓';
            color: #4ade80;
            margin-right: 8px;
            font-weight: bold;
        }
        h1 {
            text-align: center;
            color: #fff;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #aaa;
            margin-bottom: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ Cyber Forge AI Desktop Application</h1>
        <p class="subtitle">Screenshot Gallery - Professional Black & White Interface</p>
        
        <div class="screenshot-grid">
            ${Object.entries(screenshots).map(([filename, data]) => `
                <div class="screenshot-card">
                    <div class="screenshot-placeholder">
                        ${filename.replace('.png', '').replace('-', ' ').toUpperCase()} PREVIEW
                    </div>
                    <div class="screenshot-title">${filename.replace('.png', '').replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</div>
                    <div class="screenshot-description">${data.description}</div>
                    <ul class="feature-list">
                        ${data.features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(screenshotsDir, 'preview.html'), previewHtml);
console.log('🎨 Preview page generated at docs/screenshots/preview.html');