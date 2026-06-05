const axios = require('axios');

const ADDRS = [
  '0xa18731b0ea9687508767303c6042480ab0c38f17339a074069984bb7a7de7702',
  '0xf4c3176fb6c80bf91ad9f1d30eca8bcba4e5b2943e5d212bf4a552856c89fa9b',
  '0x3e6cae68d783aeeb64f3619267903f9ac20b91b2cfe6a56213209aa861144d9a',
];

async function faucet() {
  for (const addr of ADDRS) {
    for (let retry = 0; retry < 5; retry++) {
      try {
        const resp = await axios.post('https://faucet.testnet.sui.io/gas', {
          FixedAmountRequest: { recipient: addr }
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
        console.log(addr.slice(0,10) + ': OK', JSON.stringify(resp.data).substring(0, 80));
        break;
      } catch (e) {
        const wait = (retry + 1) * 5;
        console.log(addr.slice(0,10) + ': retry ' + (retry+1) + ' (' + (e.response?.status || 'timeout') + '), waiting ' + wait + 's...');
        await new Promise(r => setTimeout(r, wait * 1000));
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\nChecking balances...');
  await new Promise(r => setTimeout(r, 5000));
  for (const addr of ADDRS) {
    const resp = await axios.post('https://fullnode.testnet.sui.io:443', {
      jsonrpc: '2.0', id: 1, method: 'suix_getBalance', params: [addr]
    }, { headers: { 'Content-Type': 'application/json' } });
    const bal = Number(resp.data.result?.totalBalance || 0) / 1e9;
    console.log(addr.slice(0,10) + ': ' + bal.toFixed(2) + ' SUI');
  }
}

faucet().catch(e => console.error('Failed:', e.message));
