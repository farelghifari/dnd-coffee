const fs = require('fs');
const path = 'app/admin/report/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Line 886 is index 885
if (lines[885].includes('</Card>')) {
    console.log('Found extra card at 886, removing...');
    lines.splice(885, 1);
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed!');
} else {
    console.log('Extra card not found at expected position.');
}
