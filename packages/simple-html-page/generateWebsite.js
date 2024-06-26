const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the environment variable
const gitCommitHash = execSync('git rev-parse HEAD').toString().trim()
const gitCommitMsg = execSync('git log -1 --pretty=%B').toString().trim()

// Read the template HTML file
const templatePath = path.join(__dirname, 'template.html');
fs.readFile(templatePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the template file:', err);
        return;
    }

    // Replace the placeholder with the environment variable value
    const result = data.replace('{{ COMMIT_HASH }}', gitCommitHash).replace('{{ COMMIT_MSG }}', gitCommitMsg);

    // Write the result to a new HTML file
    const outputPath = path.join(__dirname, 'index.html');
    fs.writeFile(outputPath, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing the output file:', err);
            return;
        }
        console.log('HTML file generated successfully:', outputPath);
    });
});
