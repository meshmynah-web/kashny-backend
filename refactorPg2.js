const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'controllers');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/pool\.getConnection/g, 'pool.connect');
    content = content.replace(/const connection = /g, 'const client = ');
    content = content.replace(/connection\./g, 'client.');
    content = content.replace(/client\.release\(\)/g, 'if (client) client.release()');
    content = content.replace(/client\.beginTransaction\(\)/g, "client.query('BEGIN')");
    content = content.replace(/client\.commit\(\)/g, "client.query('COMMIT')");
    content = content.replace(/client\.rollback\(\)/g, "client.query('ROLLBACK')");
    
    content = content.replace(/const\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+(client|pool)\.query/g, 'const { rows: $1 } = await $2.query');
    content = content.replace(/let\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+(client|pool)\.query/g, 'let { rows: $1 } = await $2.query');

    // Special conversions
    // productController.js -> res.status(201).json({ message: "Product created", id: result.insertId });
    // But we don't have result.insertId anymore unless we do RETURNING id.
    // Instead of complex AST, I will manually fix INSERTs to RETURNING later if they cause errors, or just replace `.insertId` with `[?].id`.
    content = content.replace(/\.insertId/g, '[0]?.id'); 
    
    // Replace ? placeholders with $1, $2 inside query strings
    // This uses a regex to match the first argument of .query()
    const queryRegex = /(\.query\(\s*)(`[^`]*`|"[^"]*"|'[^']*')/g;
    content = content.replace(queryRegex, (match, prefix, queryStr) => {
        let count = 1;
        // make sure we don't accidentally replace inline JS conditionals inside template literals
        // only match literal ? not inside ${} -> actually we just do a simple fallback
        // we replace literal '?' 
        let newQueryStr = queryStr.replace(/\?(?![^{]*\})/g, () => `$${count++}`);
        return prefix + newQueryStr;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Processed ${path.basename(filePath)}`);
    }
}

fs.readdirSync(controllersDir).forEach(file => {
    if (file.endsWith('.js')) {
        processFile(path.join(controllersDir, file));
    }
});
