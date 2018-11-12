const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
const fs = require('fs');
// const readdir = promisify(fs.readdir);

// full path to anon-cli location
let dir_anon_cli = "";

// location where to save result
let dir_save_result = "";

// till which block do we scan?
let scan_up_to_block = 0;

//extract arguments provided by the user
process.argv.forEach(function (val, index, array) {
    // console.log(index + ': ' + val);
    if(index == 2) 
        dir_anon_cli = val + " ";
    else if (index == 2) 
        dir_save_result = val + "/";
    // else if (index == 3) 
    //     scan_up_to_block = Number(val);
  });

//Don't change this numbers unless you know what you are doing
let nForkStartHeight = 3;
let nForkHeightRange = 16737;
let nZtransparentStartBlock = 9893 + nForkStartHeight;
let nZshieldedStartBlock = 10132 + nForkStartHeight;

let post_aidrop_transactions = [];
let aidrop_transactions = [];
let spent_tx_inputs = [];
let vin_tx = {};

let forkEnd = nForkStartHeight + nForkHeightRange;

let date = new Date();
date = date.toISOString();
date = date.split(':').join("-");

//remove time zone
date = date.slice(0, -5);

async function getInfo() {
    const info = await exec(dir_anon_cli + 'getinfo')
    return { info }
};

async function getBlock(block_num) {
    const block = await exec(dir_anon_cli + 'getblock ' + block_num, { maxBuffer: 1024 * 5000 })
    return { block }
};

async function getRawTransaction(transaction) {
    const json_transaction = await exec(dir_anon_cli + 'getrawtransaction ' + transaction + " 1", { maxBuffer: 1024 * 5000 })
    return { json_transaction }
};

async function getTxOut(transaction, vout) {
    if (vout < 0)
        return console.error("vout cannot be negative");
    const utxo = await exec(dir_anon_cli + ' gettxout ' + transaction + " " + vout, { maxBuffer: 1024 * 5000 })
    return { utxo }
};

// Airdrop block range 4-16740 (including)
async function printStats() {

//#########GET-INFO#############
    //timer on
    // console.time('Call getInfo')
    
    //call the RPC
    let { info } = await getInfo();
    
     //in case the RPC command fails
    if (!info.stdout)
        return console.error("getInfo didn't return any data.");
    
    //parse result from the RPC command
    info = JSON.parse(info.stdout)
    
    console.log(info)
    console.log()
    
    //timer off
    // console.timeEnd('Call getInfo')
//#########GET-INFO-END#############

//##########GET-BLOCK###############
    //LOOP THROUGHT EACH POST AIDROP BLOCK AND SAVE ALL THE TX HASHES EXCEPT COINBASE 
    
    //timer on
    // console.time('Call getBlocks post fork')
    
    // console.log()
    console.log("Starting to scan post fork blocks...")

    // info['blocks'] = scan_up_to_block <= forkEnd ? info['blocks'] : scan_up_to_block;
    let info_blocks_length = info['blocks'] - forkEnd + 1;
    scan_up_to_block = info['blocks'];

    for (let i = forkEnd + 1; i <= info['blocks']; i++) {
        
        printProgress(((i - forkEnd + 1) / info_blocks_length) * 100);
        
        //call RPC
        let { block } = await getBlock(i);
        
        //in case rpc command fails
        if (!block.stdout)
            return console.error("getBlock didn't return any data.");
        
        //parse result from the RPC command
        block = JSON.parse(block.stdout)
        
        //do not include coinbase transactions
        block['tx'].shift();

        //append transactions to the array
        post_aidrop_transactions = post_aidrop_transactions.concat(block['tx']);
    }
    console.log()
    
    //timer off
    // console.timeEnd('Call getBlocks post fork')
//##########GET-BLOCK-END###############

//########GET-RAW-TRANSACTION###########
    //LOOP THROUGHT EACH TX HASH and SAVE ITS INPUTS
    // console.time('Call getRawTransaction')
    console.log("\nStarting to save inputs...")
    let p_a_length = post_aidrop_transactions.length

    for (let j = 0; j < p_a_length; j++) {
        printProgress((j / (p_a_length - 1)) * 100);
        
        //call RPC
        let { json_transaction } = await getRawTransaction(post_aidrop_transactions[j]);
        
        //in case rpc command fails
        if (!json_transaction.stdout)
            return console.error("getRawTransaction didn't return any data.");
        
        //parse result from the RPC command
        json_transaction = JSON.parse(json_transaction.stdout)
        
        let vin = json_transaction['vin'];

        //loop thought all inputs save theirs tx hashes
        for (let z = 0; z < vin.length; z++) {
            vin_tx[vin[z]['txid']] = 1;
        }
    }
    //time off
    console.log()
    // console.timeEnd('Call getRawTransaction')
    // console.log()
//###########GET-RAW-END############

    //LOOP THROUGHT EACH AIDROP BLOCK and MAP ITS TX HASHES TO INPUTS FROM THE ABOVE RPC CALL
    
    //timer on
    console.log("\nStarting to scan fork blocks...")
    // console.time('Call getBlocks airdrop')

//##############GET-AIRDROP-BLOCK#################
    //loop to call RPC getBlock for each aidrop block
    for (let i = nForkStartHeight + 1; i <= forkEnd; i++) {
        printProgress((i / forkEnd) * 100);
        
        //call RPC
        let { block } = await getBlock(i);
        
        //in case rpc command fails
        if (!block.stdout)
            return console.error("getBlock didn't return any data.");
        //parse result from the RPC command
        block = JSON.parse(block.stdout)

        //check if the outputs were spent and push them to vin_tx
        aidrop_transactions = aidrop_transactions.concat(block['tx']);
        for (let k = 0; k < aidrop_transactions.length; k++) {
            if (vin_tx[aidrop_transactions[k]]) {
                // console.log("yes, it spent")
                spent_tx_inputs.push(aidrop_transactions[k]);
            } else {
                continue;
            }
        }
        aidrop_transactions = [];
    }
    console.log("\n")
    // console.timeEnd('Call getBlocks airdrop')
    // console.log("Spent inputs")
//##############GET-AIRDROP-END#################
    
//SAVE as JSON file
    let spent_tx_inputs_content = JSON.stringify(spent_tx_inputs);
    
    await fs.writeFileSync(dir_save_result + `spent_tx_inputs-up-to-block-${scan_up_to_block}.json`, spent_tx_inputs_content, 'utf8')
    console.log("The file was saved!");
    
    let = spent_transactions = await JSON.parse(fs.readFileSync(dir_save_result + `spent_tx_inputs-up-to-block-${scan_up_to_block}.json`, 'utf8'));

    //READ JSON file
    let final_info = [];
    
    //timer on
    console.log("\nGetting spent inputs data...")
    // console.time('spent intputs')

    //loop trought each spent output and get more info - like amount, address, block.
    
    let spent_transactions_length = spent_transactions.length;
    for (let i = 0; i < spent_transactions_length; i++) {
        printProgress((i / (spent_transactions_length-1)) * 100);
        
        //call RPC
        let { json_transaction } = await getRawTransaction(spent_transactions[i]);
        
        //in case rpc command fails
        if (!json_transaction.stdout)
            return console.error("getBlock didn't return any data.");
        
        //parse result from the RPC command
        json_transaction = JSON.parse(json_transaction.stdout)
        // console.log(JSON.stringify(json_transaction))
        // console.log(json_transaction['vout'].length)
        if(json_transaction['vout'].length > 1)
            return console.error("more than 1 vout.");
        
        //handle segwit outputs which doesn't provide recipient address
        let address = json_transaction['vout'][0]['scriptPubKey']['type'] == "witness_v0_keyhash" ? "segwit_no_address" : json_transaction['vout'][0]['scriptPubKey']['addresses'][0]
        // console.log(address)
        
        //push final info to the array of objects

        if(json_transaction['vjoinsplit'].length == 0){
            final_info.push({
                "block": json_transaction['height'],
                "amount": json_transaction['vout'][0]['value'],
                "address": address,
                "txid": json_transaction['txid']
            })
        } else {
        // return console.error("Error: size of vjoinsplit more than 1");
            var tempInput = {
                "block": json_transaction['height'],
                "amount": json_transaction['vjoinsplit'][0]['vpub_new'] != 0 ? json_transaction['vjoinsplit'][0]['vpub_new'] : json_transaction['vjoinsplit'][0]['vpub_old'],
                "address": address,
                "txid": json_transaction['txid']
                }
            //loop through all vjoinsplits
            for(let k = 1; k < json_transaction['vjoinsplit'].length; k++){
                tempInput['amount'] +=  json_transaction['vjoinsplit'][k]['vpub_new'] != 0 ? json_transaction['vjoinsplit'][k]['vpub_new'] : json_transaction['vjoinsplit'][k]['vpub_old'];
            }
            final_info.push(tempInput);
        }
        
    }
    //timer off
    // console.timeEnd('spent intputs')

    //save the result as JSON file
    let final_info_content = JSON.stringify(final_info);
    await fs.writeFileSync(dir_save_result + `list-of-claimed-inputs-up-to-block-${scan_up_to_block}.json`, final_info_content, 'utf8')
    console.log();
    console.log("The file was saved!");

}

async function analyzeData(data_path) {
  
    let data = await JSON.parse(fs.readFileSync(data_path, 'utf8'));
    let total = {"zcl-t": 0, "btc": 0, "zcl-z": 0 }; 
    let total_amount = 0;
    // console.log(data)
    for(let i = 0; i < data.length; i++) {
        // console.log(x)
        total_amount += data[i]['amount'];
        if(data[i]['block'] < nZtransparentStartBlock)
            total['btc'] += data[i]['amount'];
        else if(data[i]['block'] < nZshieldedStartBlock)
            total['zcl-t'] += data[i]['amount'];
        else if(data[i]['block'] >= nZshieldedStartBlock)
            total['zcl-z'] += data[i]['amount'];
        else 
            return console.error("wtf");
    } 
    console.log("Total BTC: " + total['btc'])
    console.log("Total ZCL-T: " + total['zcl-t'])
    console.log("Total ZCL-Z: " + total['zcl-z'])
    console.log("Total amount: " + total_amount)
    let total_content = JSON.stringify(total);
    total_content['total'] = total_amount;
    await fs.writeFileSync(dir_save_result + `claimed_coins_total-up-to-block-${scan_up_to_block}.json`, total_content, 'utf8')
    console.log("Result was saved to " + dir_save_result + `claimed_coins_total-up-to-block-${scan_up_to_block}.json`);
}

function printProgress(progress) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(progress.toFixed(2) + '%');
}

async function start(){
    console.time("Total time spent running this script");
    await printStats();
    await analyzeData(dir_save_result + `list-of-claimed-inputs-up-to-block-${scan_up_to_block}.json`);
    console.timeEnd("Total time spent running this script");
}
start();