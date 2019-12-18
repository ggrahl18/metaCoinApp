
const Web3 = require("web3");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
// Not to forget our built contract
const metaCoinJson = require("../../build/contracts/MetaCoin.json");

// Supports Metamask, and other wallets that provide / inject 'web3'.
if (typeof web3 !== 'undefined') {
  // Use the Mist/wallet/Metamask provider.
  window.web3 = new Web3(web3.currentProvider);
} else {
  // Your preferred fallback.
  window.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

const MetaCoin = truffleContract(metaCoinJson);
MetaCoin.setProvider(window.web3.currentProvider);

window.addEventListener('load', function () {
  return web3.eth.getAccounts()
    .then(accounts => {
      if (accounts.length == 0) {
        $("#balance").html("N/A");
        throw new Error("No account with which to transact");
      }
      window.account = accounts[0];
      console.log("Account:", window.account);
      return web3.eth.net.getId();
    })
    .then(network => {
      console.log("Network:", network.toString(10));
      return MetaCoin.deployed();
    })
    .then(deployed => deployed.getBalance.call(window.account))
    // Notice how the conversion to a string is done only when displaying.
    .then(balance => $("#balance").html(balance.toString(10)))
    // We wire it when the system looks in order.
    .then(() => $("#send").click(sendCoin))
    // Never let an error go unlogged.
    .catch(console.error);
});

const sendCoin = function () {
  // Sometimes you have to force the gas amount to a value you know is enough because
  // `web3.eth.estimateGas` may get it wrong.
  const gas = 300000; let deployed;
  // We return the whole promise chain so that other parts of the UI can be informed when
  // it is done.
  return MetaCoin.deployed()
    .then(_deployed => {
      deployed = _deployed;
      // We simulate the real call and see whether this is likely to work.
      // No point in wasting gas if we have a likely failure.
      return _deployed.sendCoin.call(
        $("input[name='recipient']").val(),
        // Giving a string is fine
        $("input[name='amount']").val(),
        { from: window.account, gas: gas });
    })
    .then(success => {
      if (!success) {
        throw new Error("The transaction will fail anyway, not sending");
      }
      // Ok, we move onto the proper action.
      return deployed.sendCoin(
        $("input[name='recipient']").val(),
        // Giving a string is fine
        $("input[name='amount']").val(),
        { from: window.account, gas: gas })
        // .sendCoin takes time in real life, so we get the txHash immediately while it 
        // is mined.
        .on(
          "transactionHash",
          txHash => $("#status").html("Transaction on the way " + txHash)
        );
    })
    // Now we wait for the tx to be mined.
    .then(txObj => {
      const receipt = txObj.receipt;
      console.log("got receipt", receipt);
      if (!receipt.status) {
        console.error("Wrong status");
        console.error(receipt);
        $("#status").html("There was an error in the tx execution, status not 1");
      } else if (receipt.logs.length == 0) {
        console.error("Empty logs");
        console.error(receipt);
        $("#status").html("There was an error in the tx execution, missing expected event");
      } else {
        console.log(receipt.logs[0]);
        $("#status").html("Transfer executed");
      }
      // Make sure we update the UI.
      return deployed.getBalance.call(window.account);
    })
    .then(balance => $("#balance").html(balance.toString(10)))
    .catch(e => {
      $("#status").html(e.toString());
      console.error(e);
    });
};

require("file-loader?name=../index.html!../index.html");