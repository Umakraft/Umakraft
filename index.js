// Project entrypoint for Umakraft UmaMoe modules (lightweight)
const Vault = require('./Umamoe/Vault/vault');
const refiner = require('./Refinery/Refiner/refiner');

module.exports = { Vault, refiner };

if(require.main === module){
  console.log('Umakraft Umamoe modules loaded. Run `npm test` to run unit tests.');
}
