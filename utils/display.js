require('colors');

function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log('========================================'.cyan);
  console.log('=      🚀 T3rn Auto Bridge Bot 🚀      ='.cyan);
  console.log('=     Modified by kingkhuta      ='.cyan);
  console.log('=    original made by https://t.me/HappyCuanAirdrop     ='.cyan);
  console.log('========================================'.cyan);
  console.log();
}

module.exports = { displayHeader };
