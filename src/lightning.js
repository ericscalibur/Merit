const axios = require('axios');

async function withRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}

async function resolveLightningAddress(address) {
  const [user, domain] = address.split('@');
  if (!user || !domain) throw new Error(`Invalid Lightning address: ${address}`);

  const url = `https://${domain}/.well-known/lnurlp/${user}`;

  const response = await withRetry(() =>
    axios.get(url, { timeout: 10000 }).then(r => r.data)
  );

  if (response.status === 'ERROR') throw new Error(`LNURL error: ${response.reason}`);
  if (!response.callback) throw new Error(`Invalid LNURL-pay response from ${domain}`);

  return {
    callback: response.callback,
    minSendable: Math.ceil(response.minSendable / 1000),
    maxSendable: Math.floor(response.maxSendable / 1000),
  };
}

async function fetchInvoice(callback, amountSats) {
  const response = await withRetry(() =>
    axios.get(callback, {
      params: { amount: amountSats * 1000 },
      timeout: 10000,
    }).then(r => r.data)
  );

  if (response.status === 'ERROR') throw new Error(`Invoice error: ${response.reason}`);
  if (!response.pr) throw new Error('No invoice returned from LNURL callback');

  return response.pr;
}

async function payInvoice(nwcConnectionString, invoice) {
  const { nwc } = require('@getalby/sdk');
  const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcConnectionString });
  try {
    const result = await client.payInvoice({ invoice });
    return result;
  } finally {
    client.close();
  }
}

async function sendPayment(nwcConnectionString, lightningAddress, amountSats) {
  const lnurl = await resolveLightningAddress(lightningAddress);

  if (amountSats < lnurl.minSendable) {
    throw new Error(`${amountSats} sats is below the minimum of ${lnurl.minSendable} sats for ${lightningAddress}`);
  }
  if (amountSats > lnurl.maxSendable) {
    throw new Error(`${amountSats} sats is above the maximum of ${lnurl.maxSendable} sats for ${lightningAddress}`);
  }

  const invoice = await fetchInvoice(lnurl.callback, amountSats);
  await payInvoice(nwcConnectionString, invoice);
}

module.exports = { sendPayment };
