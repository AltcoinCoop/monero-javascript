const assert = require("assert");
const MoneroUtils = require("../src/utils/MoneroUtils");
const TestUtils = require("./TestUtils");
const MoneroDaemonRpc = require("../src/daemon/MoneroDaemonRpc");
const GenUtils = require("../src/utils/GenUtils");

// get and test daemon
let daemon = TestUtils.getDaemonRpc();
describe("Monero Daemon RPC", function() {

  it("Can get the blockchain height", async function() {
    let height = await daemon.getHeight();
    assert(height, "Height must be initialized");
    assert(height > 0, "Height must be greater than 0");
  });

  it("Can get a block hash by height", async function() {
    let lastHeader = await daemon.getLastBlockHeader();
    let hash = await daemon.getBlockHash(lastHeader.getHeight());
    assert(hash);
    assert.equal(64, hash.length);
  });
  
  it("Can get a block template", async function() {
    let template = await daemon.getBlockTemplate(TestUtils.TEST_ADDRESS, 2);
    testDaemonResponseInfo(template, true, true);
    testBlockTemplate(template);
  });

  it("Can get the last block's header", async function() {
    let lastHeader = await daemon.getLastBlockHeader();
    testDaemonResponseInfo(lastHeader, true, true);
    testBlockHeader(lastHeader, true);
  });
  
  it("Can get a block header by hash", async function() {
    
    // retrieve by hash of last block
    let lastHeader = await daemon.getLastBlockHeader();
    let hash = await daemon.getBlockHash(lastHeader.getHeight());
    let header = await daemon.getBlockHeaderByHash(hash);
    testDaemonResponseInfo(header, true, true);
    testBlockHeader(header, true);
    assert.deepEqual(lastHeader, header);
    
    // retrieve by hash of previous to last block
    hash = await daemon.getBlockHash(lastHeader.getHeight() - 1);
    header = await daemon.getBlockHeaderByHash(hash);
    testDaemonResponseInfo(header, true, true);
    testBlockHeader(header, true);
    assert.equal(lastHeader.getHeight() - 1, header.getHeight());
  });
  
  it("Can get a block header by height", async function() {
    
    // retrieve by height of last block
    let lastHeader = await daemon.getLastBlockHeader();
    let header = await daemon.getBlockHeaderByHeight(lastHeader.getHeight());
    testDaemonResponseInfo(header, true, true);
    testBlockHeader(header, true);
    assert.deepEqual(lastHeader, header);
    
    // retrieve by height of previous to last block
    header = await daemon.getBlockHeaderByHeight(lastHeader.getHeight() - 1);
    testDaemonResponseInfo(header, true, true);
    testBlockHeader(header, true);
    assert.equal(lastHeader.getHeight() - 1, header.getHeight());
  });
  
  // TODO: test start with no end, vice versa, inclusivity
  it("Can get block headers by range", async function() {
    
    // determine start and end height based on number of blocks and how many blocks ago
    let numBlocks = 100;
    let numBlocksAgo = 100;
    let currentHeight = await daemon.getHeight();
    let startHeight = currentHeight - numBlocksAgo;
    let endHeight = currentHeight - (numBlocksAgo - numBlocks) - 1;
    
    // fetch headers
    let headers = await daemon.getBlockHeadersByRange(startHeight, endHeight);
    
    // test headers
    assert.equal(numBlocks, headers.length);
    for (let i = 0; i < numBlocks; i++) {
      let header = headers[i];
      assert.equal(startHeight + i, header.getHeight());
      testDaemonResponseInfo(header, true, true);
      testBlockHeader(header, true);
    }
  });
  
  it("Can get a block by hash", async function() {
    
    // config for testing blocks
    let testBlockConfig = { hasHex: true, headerIsFull: true, hasTxs: false };
    
    // retrieve by hash of last block
    let lastHeader = await daemon.getLastBlockHeader();
    let hash = await daemon.getBlockHash(lastHeader.getHeight());
    let block = await daemon.getBlockByHash(hash);
    testDaemonResponseInfo(block, true, true);
    testBlock(block, testBlockConfig);
    assert.deepEqual(await daemon.getBlockByHeight(block.getHeader().getHeight()), block);
    assert(block.getTxs() === undefined);
    
    // retrieve by hash of previous to last block
    hash = await daemon.getBlockHash(lastHeader.getHeight() - 1);
    block = await daemon.getBlockByHash(hash);
    testDaemonResponseInfo(block, true, true);
    testBlock(block, testBlockConfig);
    assert.deepEqual(await daemon.getBlockByHeight(lastHeader.getHeight() - 1), block);
    assert(block.getTxs() === undefined);
  });
  
  it("Can get a block by height", async function() {
    
    // config for testing blocks
    let testBlockConfig = { hasHex: true, headerIsFull: true, hasTxs: false };
    
    // retrieve by height of last block
    let lastHeader = await daemon.getLastBlockHeader();
    let block = await daemon.getBlockByHeight(lastHeader.getHeight());
    testDaemonResponseInfo(block, true, true);
    testBlock(block, testBlockConfig);
    assert.deepEqual(await daemon.getBlockByHeight(block.getHeader().getHeight()), block);
    
    // retrieve by height of previous to last block
    block = await daemon.getBlockByHeight(lastHeader.getHeight() - 1);
    testDaemonResponseInfo(block, true, true);
    testBlock(block, testBlockConfig);
    assert.deepEqual(lastHeader.getHeight() - 1, block.getHeader().getHeight());
  });
  
  it("Can get blocks by height which is a binary request and includes transactions", async function() {
    
    // set number of blocks to test
    const numBlocks = 25;
    
    // select random heights  // TODO: this is horribly inefficient way of computing last 100 blocks if not shuffling
    let currentHeight = await daemon.getHeight();
    let allHeights = [];
    for (let i = 0; i < currentHeight - 1; i++) allHeights.push(i);
    //GenUtils.shuffle(allHeights);
    let heights = [];
    for (let i = allHeights.length - numBlocks; i < allHeights.length; i++) heights.push(allHeights[i]);
    
    // TODO: don't override heights
    //heights = [111, 222, 333];
    
    // fetch blocks
    let blocks = await daemon.getBlocksByHeight(heights);
    
    // config for testing blocks
    let testBlockConfig = { hasHex: false, headerIsFull: false, hasTxs: true, txConfig: { hasHex: false, hasJson: true, isPruned: true, isFull: false } };
    
    // test blocks
    let txFound = false;
    assert.equal(numBlocks, blocks.length);
    for (let i = 0; i < heights.length; i++) {
      let block = blocks[i];
      if (block.getTxs().length) txFound = true;
      testDaemonResponseInfo(block, true, true);
      testBlock(block, testBlockConfig);
      assert.equal(heights[i], block.getHeader().getHeight());      
    }
    assert(txFound, "No transactions found to test");
  });
  
  it("Can get blocks by range", async function() {
    
    // get current height
    let height = await daemon.getHeight();
    
    // get valid height range
    let numBlocks = 1; // TODO: RequestError: Error: read ECONNRESET or  RequestError: Error: socket hang up if > 64 or (or > 1 if test getBlocksByHeight() runs first)
    let numBlocksAgo = 190;
    assert(numBlocks > 0);
    assert(numBlocksAgo >= numBlocks);
    assert(height - numBlocksAgo + numBlocks - 1 < height);
    let startHeight = height - numBlocksAgo;
    let endHeight = height - numBlocksAgo + numBlocks - 1;
    
    // test known start and end heights
    //console.log("Height: " + height);
    //console.log("Fecthing " + (endHeight - startHeight + 1) + " blocks [" + startHeight + ", " + endHeight + "]");
    await testRange(startHeight, endHeight);
    
    // test unspecified start
    await testRange(null, numBlocks - 1);
    
    // test unspecified end
    await testRange(height - numBlocks - 1, null);
    
    // test unspecified start and end 
    //await testRange(null, null);  // TODO: RequestError: Error: socket hang up
    
    async function testRange(startHeight, endHeight) {
      let realStartHeight = startHeight === null ? 0 : startHeight;
      let realEndHeight = endHeight === null ? height - 1 : endHeight;
      let blocks = await daemon.getBlocksByRange(startHeight, endHeight);
      assert.equal(realEndHeight - realStartHeight + 1, blocks.length);
      for (let i = 0; i < blocks.length; i++) {
        assert.equal(realStartHeight + i, blocks[i].getHeader().getHeight());
      }
    }
  });
  
  it("Can get transactions", async function() {
    
    // get valid height range
    let height = await daemon.getHeight();
    let numBlocks = 100;
    let numBlocksAgo = 100;
    assert(numBlocks > 0);
    assert(numBlocksAgo >= numBlocks);
    assert(height - numBlocksAgo + numBlocks - 1 < height);
    let startHeight = height - numBlocksAgo;
    let endHeight = height - numBlocksAgo + numBlocks - 1;
    
    // get blocks
    let blocks = await daemon.getBlocksByRange(startHeight, endHeight);
    
    // collect tx hashes
    let txHashes = blocks.map(block => block.getTxHashes()).reduce((a, b) => { a.push.apply(a, b); return a; });
    assert(txHashes.length > 0, "No transactions found in the range [" + startHeight + ", " + endHeight + "]");
    
    // fetch txs by hash
    let decodeAsJson = true;
    let prune = false;
    let txs = await daemon.getTxs(txHashes, decodeAsJson, prune);
    for (let tx of txs) {
      testDaemonResponseInfo(tx, true, true); // TODO: duplicating response info is going to be too expensive so must be common reference
      testTx(tx, { hasHex: true, hasJson: decodeAsJson, isPruned: prune, isFull: true });
    }
    
    // TODO: test binary vs json encoding
  });
  
  it("Has general information", async function() {
    let info = await daemon.getInfo();
    testDaemonResponseInfo(info, true, true);
    testInfo(info);
  });
  
  it("Has sync information", async function() {
    let syncInfo = await daemon.getSyncInfo();
    testDaemonResponseInfo(info, true, true);
    testSyncInfo(info);
  });
  
  it("Has connections to peers", async function() {
    throw new Error("Not implemented");
  });
  
  it("Has hard fork information", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can ban a peer", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can ban multiple peers", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can flush a transaction from the pool by id", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can flush multiple transactions from the pool by id", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get an output histogram", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get an output distribution", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get the coinbase transaction sum", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get a fee estimate", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get alternative chains", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get relay a transaction", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get relay multiple transactions", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get the transaction pool backlog", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get the known blocks hashes which are not on the main chain", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can determine if key images can be spent", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can start mining", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can stop mining", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get mining status", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can set bandwidth limit", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can get bandwidth limit", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can limit the number of outgoing peers", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can limit the number of incoming peers", async function() {
    throw new Error("Not implemented");
  });
  
  it("Can submit a block to the network", async function() {
    throw new Error("Not implemented");
  });
});

function testDaemonResponseInfo(model, initializedStatus, initializedIsUntrusted) {
  assert(model.getResponseInfo());
  if (initializedStatus) assert.equal("OK", model.getResponseInfo().getStatus());
  else assert(model.getResponseInfo().getStatus() === undefined);
  if (initializedIsUntrusted) assert(model.getResponseInfo());
  else assert(model.getResponseInfo().getIsTrusted() === undefined);
}

function testBlockHeader(header, isFull) {
  assert(typeof isFull === "boolean");
  assert(header);
  assert(header.getHeight() >= 0);
  assert(header.getMajorVersion() >= 0);
  assert(header.getMinorVersion() >= 0);
  assert(header.getTimestamp() >= 0);
  assert(header.getPrevHash());
  assert(header.getNonce());
  assert(header.getPowHash() === undefined);  // never seen defined
  assert(!isFull ? undefined === header.getBlockSize() : header.getBlockSize());
  assert(!isFull ? undefined === header.getDepth() : header.getDepth() >= 0);
  assert(!isFull ? undefined === header.getDifficulty() : header.getDifficulty());
  assert(!isFull ? undefined === header.getCumulativeDifficulty() : header.getCumulativeDifficulty());
  assert(!isFull ? undefined === header.getHash() : header.getHash());
  assert(!isFull ? undefined === header.getNumTxs() : header.getNumTxs() >= 0);
  assert(!isFull ? undefined === header.getOrphanStatus() : typeof header.getOrphanStatus() === "boolean");
  assert(!isFull ? undefined === header.getReward() : header.getReward());
  assert(!isFull ? undefined === header.getBlockWeight() : header.getBlockWeight());
}

function testBlock(block, config) {
  
  // check inputs
  assert(config);
  assert(typeof config.hasHex === "boolean");
  assert(typeof config.headerIsFull === "boolean");
  assert(typeof config.hasTxs === "boolean");
  
  // test required fields
  assert(block);
  assert(Array.isArray(block.getTxHashes())); // TODO: tx hashes probably part of tx
  assert(block.getTxHashes().length >= 0);
  testMinerTx(block.getMinerTx());            // TODO: miner tx doesn't have as much stuff, can't call testTx?
  testBlockHeader(block.getHeader(), config.headerIsFull);
  
  if (config.hasHex) {
    assert(block.getHex());
    assert(block.getHex().length > 1);
  } else {
    assert(block.getHex() === undefined)
  }
  
  if (config.hasTxs) {
    assert(typeof config.txConfig === "object");
    assert(block.getTxs() instanceof Array);
    for (let tx of block.getTxs()) testTx(tx, config.txConfig);
  } else {
    assert(config.txConfig === undefined);
    assert(block.getTxs() === undefined);
  }
}

function testMinerTx(minerTx) {
  assert(minerTx);
  assert(minerTx.getVersion() >= 0)
  assert(Array.isArray(minerTx.getExtra()));
  assert(minerTx.getExtra().length > 0);
  assert(minerTx.getUnlockTime() >= 0);
}

function testTx(tx, config) {
  
  // check inputs
  assert(tx);
  assert(typeof config === "object");
  assert(typeof config.hasHex === "boolean");
  assert(typeof config.hasJson === "boolean");
  assert(typeof config.isPruned === "boolean");
  assert(typeof config.isFull === "boolean");
  
  // required fields
  assert(tx.getId().length === 64);
  assert(tx.getHeight() >= 0);
  
  // fields that come with decoded json
  if (config.hasJson) {
    assert(tx.getVersion() >= 0);
    assert(tx.getUnlockTime() >= 0);
    assert(tx.getVin() && Array.isArray(tx.getVin()) && tx.getVin().length >= 0);
    assert(tx.getVin()[0].key.k_image.length === 64);
    assert(tx.getVout() && Array.isArray(tx.getVout()) && tx.getVout().length >= 0);
    tx.getVout().map(vout => { if (vout.target) assert(vout.target.key.length === 64); });
    assert(Array.isArray(tx.getExtra()) && tx.getExtra().length > 0);
    assert(typeof tx.getRctSignatures().type === "number");
  } else {
    assert(tx.getVersion() === undefined);
    assert(tx.getUnlockTime() === undefined);
    assert(tx.getVin() === undefined);
    assert(tx.getVout() === undefined);
    assert(tx.getExtra() === undefined);
    assert(tx.getRctSignatures() === undefined);    
  }
  
  // prunable
  assert(config.isPruned ? undefined === tx.getRctSigPrunable() : typeof tx.getRctSigPrunable().nbp === "number");
  
  // hex only comes from /get_transactions
  assert(!config.hasHex ? undefined === tx.getHex() : tx.getHex().length > 0);
  
  // fields that only come with /get_transactions
  assert(!config.isFull ? undefined === tx.getTimestamp() : tx.getTimestamp() >= 0);
  assert(!config.isFull ? undefined === tx.getIsConfirmed() : tx.getIsConfirmed() >= 0);
  assert(!config.isFull ? undefined === tx.getIsDoubleSpend() : tx.getIsDoubleSpend() >= 0);
}

function testBlockTemplate(template) {
  assert(template);
  assert(template.getTemplateBlob());
  assert(template.getHashBlob());
  assert(template.getDifficulty());
  assert(template.getExpectedReward());
  assert(template.getHeight());
  assert(template.getPrevHash());
  assert(template.getReservedOffset());
}

function testInfo(info) {
  assert(info.getAltBlocksCount() >= 0);
  assert(info.getBlockSizeLimit());
  assert(info.getBlockSizeMedian());
  assert(typeof info.getBootstrapDaemonAddress() === "string");
  assert(info.getCumulativeDifficulty());
  assert(info.getFreeSpace());
  assert(info.getGreyPeerlistSize());
  assert(info.getWhitePeerlistSize());
  assert(info.getHeight());
  assert(info.getHeightWithoutBootstrap());
  assert(info.getIncomingConnectionsCount());
  assert(info.getNetworkType());
  assert(typeof info.getIsOffline() === "boolean");
  assert(info.getOutgoingConnectionsCount() >= 0);
  assert(info.getRpcConnectionsCount() >= 0);
  assert(info.getStartTime());
  assert(info.getTarget());
  assert(info.getTargetHeight());
  assert(info.getTopBlockHash());
  assert(info.getTxCount() > 0);
  assert(info.getTxPoolSize() >= 0);
  assert(typeof info.getWasBootstrapEverUsed() === "boolean");
  assert(info.getBlockWeightLimit());
  assert(info.getBlockWeightMedian());
  assert(info.getDatabaseSize());
  assert(typeof info.getUpdateAvailable() === "boolean");
}

function testSyncInfo(syncInfo) {
  throw new Error("Not implemented");
}

function testConnectionInfo(connectionInfo) {
  throw new Error("Not implemented");
}