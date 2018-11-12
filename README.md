# ANON scripts
This repo contains different scripts related to ANON blockchain.

### 1. Script: ```find_claimed_coins.js```.
       
**This script will scan ANON blockchain, find claimed coins (inputs) as of current block height, and save result to JSON file.**

#### PREREQUISITES:

   1. [Node.js](https://nodejs.org/en/download/) version >= 8.12
   2. Running ANON full node.
   3. Know how to use terminal.

#### HOW TO USE:
  1. [Download](https://github.com/anonymousbitcoin/anon-scripts/blob/master/find_claimed_coins.js) ```find_claimed_coins.js``` file.
  2. Make sure you **ANON full node** is running in background.
  2. From terminal run this script with the following agruments:
  
     ```node find_claimed_coins.js "full_path_to_anon-cli" "full_path_where_to_save_result"```
  
  
      Example: ```node find_claimed_coins.js "/Users/John/anon/src/anon-cli" "/Users/John/result"```
 
 4. Results will be **saved to 3 files** and a simple summary will be **printed to the terminal**:
     - **spent_tx_inputs.json**
     - **list-of-claimed-inputs.json**
     - **claimed_coins_total.json** (Simple summary)

**Note:** This script takes ~15-30 min to complete.
