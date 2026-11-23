const fs = require('node:fs');
const path = require('node:path');

const actionsDir = path.join(process.cwd(), 'include', 'actions');
const phpFiles = fs.readdirSync(actionsDir)
    .filter((name) => name.endsWith('.php'))
    .map((name) => path.join(actionsDir, name));

let checkedScripts = 0;
let errors = 0;

for (const file of phpFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const scripts = source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);

    for (const match of scripts) {
        checkedScripts++;
        const javascript = match[1]
            .replace(/<\?=\s*[\s\S]*?\?>/g, 'PHP_OUTPUT')
            .replace(/<\?(?:php)?[\s\S]*?\?>/g, '');

        try {
            new Function(javascript);
        } catch (error) {
            errors++;
            process.stderr.write(
                path.relative(process.cwd(), file) +
                ': inline script ' + checkedScripts +
                ': ' + error.message + '\n'
            );
        }
    }
}

process.stdout.write('Checked ' + checkedScripts + ' inline scripts in ' + phpFiles.length + ' PHP files.\n');
if (errors > 0) process.exit(1);
