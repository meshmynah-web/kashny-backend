const fs = require('fs');
const path = require('path');

function replacePlaceholders(queryStr) {
    let count = 1;
    return queryStr.replace(/\?/g, () => `$${count++}`);
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. connection -> client for transactions
    content = content.replace(/pool\.getConnection/g, 'pool.connect');
    content = content.replace(/const connection = /g, 'const client = ');
    content = content.replace(/connection\./g, 'client.');
    // release
    content = content.replace(/client\.release\(\)/g, 'if (client) client.release()');
    content = content.replace(/client\.beginTransaction\(\)/g, "client.query('BEGIN')");
    content = content.replace(/client\.commit\(\)/g, "client.query('COMMIT')");
    content = content.replace(/client\.rollback\(\)/g, "client.query('ROLLBACK')");
    
    // 2. [rows] destructuring to { rows: resultName }
    // Example: const [shift] = await client.query(...) -> const { rows: shift } = await client.query(...)
    content = content.replace(/const\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+(client|pool)\.query/g, 'const { rows: $1 } = await $2.query');
    content = content.replace(/let\s+\[([a-zA-Z0-9_]+)\]\s*=\s*await\s+(client|pool)\.query/g, 'let { rows: $1 } = await $2.query');

    // 3. insertId fixing
    // const sale_id = saleResult.insertId; -> we need RETURNING id, but automatic replacement is hard.
    // I will manually fix specific ones later.

    // 4. replace `?` with `$1`, `$2`
    let queryRegex = /(\.query\(\s*`[^`]*`\s*,)|(\.query\(\s*"[^"]*"\s*,)|(\.query\(\s*'[^']*'\s*,)/g;
    
    // We can't simply regex the whole file easily because queries might be concatenated.
    // Instead, I'll do a basic pass where I know the strings are literal.
    const parts = content.split(/(\.query\(\s*(?:`[^`]*`|"[^"]*"|'[^']*')\s*(?:,[^)]*)?\))/);
    for (let i = 1; i < parts.length; i += 2) {
        let qCall = parts[i];
        let strMatch = qCall.match(/(["'`])([^"'\\]*(?:\\.[^"'\\]*)*)\1/);
        if (strMatch) {
            let origStr = strMatch[0];
            let newStr = replacePlaceholders(origStr);
            parts[i] = qCall.replace(origStr, newStr);
        }
    }
    content = parts.join('');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${filePath}`);
}

processFile(path.join(__dirname, 'controllers/salesController.js'));
processFile(path.join(__dirname, 'controllers/userController.js'));
processFile(path.join(__dirname, 'controllers/shiftController.js'));
processFile(path.join(__dirname, 'controllers/settingsController.js'));
