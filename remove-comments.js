const fs = require('fs');
const path = require('path');

async function removeCommentsFromFile(filePath) {
    try {
        console.log(`Reading file: ${filePath}`);
        let content = await fs.promises.readFile(filePath, 'utf8');
        
        console.log(`Processing: ${filePath}`);
        // Remove single-line comments (// ...) but not URLs
        let cleaned = content.replace(/([^:]\/\/.*|^\s*\/\/.*)/gm, '');
        
        // Remove multi-line comments (/* ... */)
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove empty lines
        cleaned = cleaned.replace(/^[ \t]*\n/gm, '');
        
        await fs.promises.writeFile(filePath, cleaned, 'utf8');
        console.log(`Successfully processed: ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
    }
}

async function processDirectory(directory) {
    try {
        console.log(`Scanning directory: ${directory}`);
        const files = await fs.promises.readdir(directory, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = path.join(directory, file.name);
            
            if (file.isDirectory()) {
                await processDirectory(fullPath);
            } else if (file.name.endsWith('.js')) {
                await removeCommentsFromFile(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${directory}:`, error.message);
    }
}

// Main execution
async function main() {
    try {
        const commandsDir = path.resolve(__dirname, 'src');
        console.log(`Starting to process files in: ${commandsDir}`);
        
        if (!fs.existsSync(commandsDir)) {
            throw new Error(`Directory does not exist: ${commandsDir}`);
        }
        
        await processDirectory(commandsDir);
        console.log('Finished removing comments from all files.');
    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
