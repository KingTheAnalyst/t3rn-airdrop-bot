require('colors');
const { Wallet, JsonRpcProvider, ethers, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');
const readlineSync = require('readline-sync');
const moment = require('moment');
const T3RN_ABI = require('./contracts/ABI');
const { displayHeader } = require('./utils/display');
const { transactionData, delay } = require('./chains/arbt/helper');
const { getAmount } = require('./chains/arbt/api');
const { writeLog } = require('./utils/log'); 

const TOKEN_FILE_PATH = path.join(__dirname, 'ARBT_TX_HASH.txt');
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const RPC_URLS = T3RN_ABI.map((entry) => entry.RPC_ARBT);

let currentRpcIndex = 0;

async function getProvider() {
  for (let i = 0; i < RPC_URLS.length; i++) {
    const rpc = RPC_URLS[currentRpcIndex];
    currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
    try {
      const provider = new JsonRpcProvider(rpc);
      await provider.getBlockNumber(); // Test RPC connectivity
      console.log(`✅ Using RPC: ${rpc}`.green);
      return provider;
    } catch (error) {
      console.log(`❌ RPC failed: ${rpc}, trying next...`.red);
    }
  }
  throw new Error('All RPCs failed!');
}

(async () => {
  displayHeader();
  console.log('⏳ Please wait...'.yellow);
  console.log('');

  const options = readlineSync.question(
    'Choose the network that you want to use 👇\n\n1. Arbitrum Sepolia to Base Sepolia\n2. Arbitrum Sepolia to Blast Sepolia\n3. Arbitrum Sepolia to Optimism Sepolia\n4. Exit\n\nEnter 1, 2, 3, or 4: '
  );

  if (options === '4' || !options) {
    console.log('👋 Exiting the bot. See you next time!'.cyan);
    process.exit(0);
  }

  const numTx = readlineSync.questionInt('🔄 How many times you want to swap or bridge? ');

  if (numTx <= 0) {
    console.log('❌ Number of transactions must be greater than 0!'.red);
    process.exit(1);
  }

  const provider = await getProvider();

  for (const PRIVATE_KEY of PRIVATE_KEYS) {
    const wallet = new Wallet(PRIVATE_KEY, provider);
    let totalSuccess = 0;

    while (totalSuccess < numTx) {
      try {
        const balance = await provider.getBalance(wallet.address);
        const balanceInEth = ethers.formatUnits(balance, 'ether');

        console.log(`⚙️ [ ${moment().format('HH:mm:ss')} ] Processing transactions for ${wallet.address}...`.yellow);

        if (balanceInEth < 0.01) {
          console.log(`❌ Insufficient balance (💰 ${balanceInEth} ETH), please claim faucet!`.red);
          process.exit(0);
        }

        let counter = numTx - totalSuccess;

        while (counter > 0) {
          try {
            const amount = await getAmount(options);
            if (!amount) {
              console.log(`❌ Failed to get the amount. Skipping transaction...`.red);
              continue;
            }

            const request = transactionData(wallet.address, amount.hex, options);
            const gasPrice = parseUnits('0.1', 'gwei');
            const gasLimit = await provider.estimateGas({
              to: T3RN_ABI.at(-1).CA_ARBT,
              data: request,
              value: parseUnits('0.01', 'ether'),
              gasPrice,
            });

            const transaction = {
              data: request,
              to: T3RN_ABI.at(-1).CA_ARBT,
              gasLimit,
              gasPrice,
              from: wallet.address,
              value: parseUnits('0.01', 'ether'),
            };

            const result = await wallet.sendTransaction(transaction);
            console.log(`✅ Transaction successful to ${options === '1' ? 'Base' : options === '2' ? 'Blast' : 'OP'} Sepolia!`.green);
            console.log(`🔗 Transaction hash: https://sepolia-explorer.arbitrum.io/tx/${result.hash}`.green);
            writeLog(TOKEN_FILE_PATH, `[${moment().format('HH:mm:ss')}] https://sepolia-explorer.arbitrum.io/tx/${result.hash}`);
            console.log('✅ Transaction hash saved to ARBT_TX_HASH.txt.'.green);

            totalSuccess++;
            counter--;

            if (counter > 0) {
              await delay(30000);
            }
          } catch (error) {
            console.log(`❌ Error during transaction: ${error}`.red);
          }
        }
      } catch (error) {
        console.log(`❌ Error in processing transactions: ${error}`.red);
      }
    }
  }

  console.log(`🎉 All ${numTx} transactions complete!`.green);
  console.log(`📢 Subscribe: https://t.me/HappyCuanAirdrop`.green);
})();
