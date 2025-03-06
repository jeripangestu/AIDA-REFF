const axios = require("axios");
const { ethers } = require("ethers");
const fs = require("fs").promises;
const readline = require("readline");
const { newAgent } = require("./utils");
const { config } = require("./config");
const { jwtDecode } = require("jwt-decode");

// Fungsi untuk menampilkan banner dengan warna-warni
function showBanner() {
    const banner = `
    \x1b[34m____\x1b[0m                           
   \x1b[34m/ __ \\____ __________ ______\x1b[0m    
  \x1b[34m/ / / / __ \`/ ___/ __ \`/ ___/\x1b[0m    
 \x1b[34m/ /_/ / /_/ (__  ) /_/ / /\x1b[0m        
\x1b[34m/_____/_\__,_/____/\__,_/_/\x1b[0m          
    
    \x1b[32m____\x1b[0m                       \x1b[33m__\x1b[0m    
   \x1b[32m/ __ \\___  ____ ___  __  __/ /_\x1b[0m \x1b[33m ______  ____ _\x1b[0m    
  \x1b[32m/ /_/ / _ \\/ __ \`__ \\/ / / / / /\x1b[0m \x1b[33m/ __ \/ __ \`/\x1b[0m    
 \x1b[32m/ ____/  __/ / / / / / /_/ / / /\x1b[0m \x1b[33m/ / / / /_/ /\x1b[0m     
\x1b[32m/_/    \___/_/ /_/ /_/\__,_/_/\x1b[0m \x1b[33m/ / /_/\__, /\x1b[0m      
                                         \x1b[33m/____/\x1b[0m        
    
====================================================    
     \x1b[35mAutomation\x1b[0m         : \x1b[36mAuto Install Node and Bot\x1b[0m    
     \x1b[35mTelegram Channel\x1b[0m   : \x1b[36m@dasarpemulung\x1b[0m    
     \x1b[35mTelegram Group\x1b[0m     : \x1b[36m@parapemulung\x1b[0m    
====================================================    
    `;

    console.log(banner); 
}

// Referral configuration
defaultConfig = {
  baseUrl: "https://back.aidapp.com",
  campaignId: "6b963d81-a8e9-4046-b14f-8454bc3e6eb2",
  excludedMissionId: "f8edb0b4-ac7d-4a32-8522-65c5fb053725",
  headers: {
    accept: "*/*",
    origin: "https://my.aidapp.com",
    referer: "https://my.aidapp.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
};

// User input function
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Function to create a new wallet
function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  console.log(`New Wallet: ${wallet.address}`);
  console.log(`PrivateKey: ${wallet.privateKey}`);
  console.log(`Seed Phrase: ${wallet.mnemonic.phrase}`);
  return wallet;
}

// Function to save account
async function saveAccount(wallet, refCode) {
  const data = `\nAddress: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nSeed Phrase: ${wallet.mnemonic.phrase}\nRefCode: ${refCode}\n=================================\n`;
  await fs.appendFile("accounts.txt", data);
  console.log(`Account saved to accounts.txt`.green);
}

// Function to save token
async function saveToken(token) {
  await fs.appendFile("token.txt", `${token.access_token}\n`);
  console.log(`Access token saved to token.txt`.green);
}

// Function to sign authentication message
async function signMessage(wallet, message) {
  return await wallet.signMessage(message);
}

// Function to login
async function login(wallet, inviterCode, proxyAgent) {
  const timestamp = Date.now();
  const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
  const signature = await signMessage(wallet, message);

  const url = `${defaultConfig.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${inviterCode}`;

  try {
    const response = await axios.get(url, {
      headers: defaultConfig.headers,
      ...(proxyAgent && { httpsAgent: proxyAgent }),
    });
    console.log(`Login Success`.green);
    // Save account and token
    await saveAccount(wallet, response.data.user.refCode);
    await saveToken(response.data.tokens);
    await fs.appendFile("privateKeys.txt", `\n${wallet.privateKey}`);
    console.log(`PrivateKey saved to privateKeys.txt`.green);
    return response.data.tokens.access_token;
  } catch (error) {
    console.error(`Login Failed:`.yellow, error.response?.data || error.message);
    return null;
  }
}

// Function to read tokens
async function readFile(filename) {
  try {
    const content = await fs.readFile(filename, "utf8");
    return content
      .trim()
      .split("\n")
      .filter((token) => token.length > 0);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

// Get available missions
async function getAvailableMissions(accessToken, proxyAgent) {
  try {
    const currentDate = new Date().toISOString();
    const response = await axios.get(`${defaultConfig.baseUrl}/questing/missions?filter%5Bdate%5D=${currentDate}&filter%5BcampaignId%5D=${defaultConfig.campaignId}`, {
      headers: { ...defaultConfig.headers, authorization: `Bearer ${accessToken}` },
      ...(proxyAgent && { httpsAgent: proxyAgent }),
    });

    return response.data.data.filter((mission) => mission.progress === "0" && mission.id !== defaultConfig.excludedMissionId);
  } catch (error) {
    console.error("Error fetching available missions:".yellow, error.response?.data || error.message);
    return [];
  }
}

// Complete mission
async function completeMission(missionId, accessToken, proxyAgent) {
  try {
    await axios.post(
      `${defaultConfig.baseUrl}/questing/mission-activity/${missionId}`,
      {},
      {
        headers: { ...defaultConfig.headers, authorization: `Bearer ${accessToken}` },
        ...(proxyAgent && { httpsAgent: proxyAgent }),
      }
    );
    console.log(`Mission ${missionId} completed successfully!`.green);
    return true;
  } catch (error) {
    console.error(`Error completing mission ${missionId}`.yellow);
    return false;
  }
}

// Claim mission reward
async function claimMissionReward(missionId, accessToken, proxyAgent) {
  try {
    await axios.post(
      `${defaultConfig.baseUrl}/questing/mission-reward/${missionId}`,
      {},
      {
        headers: { ...defaultConfig.headers, authorization: `Bearer ${accessToken}` },
        ...(proxyAgent && { httpsAgent: proxyAgent }),
      }
    );
    console.log(`Reward for mission ${missionId} claimed successfully!`.green);
    return true;
  } catch (error) {
    console.error(`Error claiming reward for mission ${missionId}`.red);
    return false;
  }
}

// Run bot
async function runBot(accessToken, proxy) {
  const proxyAgent = newAgent(proxy);
  const tokenInfo = jwtDecode(accessToken);
  console.log(`Processing account: ${tokenInfo.id} | ${proxy}...`.blue);
  const availableMissions = await getAvailableMissions(accessToken, proxyAgent);
  if (availableMissions.length === 0) {
    console.log("No available missions to complete.".yellow);
    return;
  }
  for (const mission of availableMissions) {
    console.log(`Processing mission: ${mission.label} (ID: ${mission.id})`.blue);
    const completed = await completeMission(mission.id, accessToken, proxyAgent);
    if (completed) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await claimMissionReward(mission.id, accessToken, proxyAgent);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Main function
async function main() {
  showBanner();
  const inviterCode = config.ref_code;
  const numAccounts = config.num_ref;
  rl.close();
  await fs.writeFile("tokens.txt", "");
  const proxies = await readFile("proxy.txt");
  if (proxies.length < numAccounts) {
    return console.log(`Buff ref need proxy, the number of proxies must be equal to or greater than the number of refs to be created`.yellow);
  }

  for (let i = 0; i < numAccounts; i++) {
    console.log(`\nCreating account ${i + 1}/${numAccounts}...`.blue);
    const wallet = createWallet();
    const proxyAgent = newAgent(proxies[i]);
    const access_token = await login(wallet, inviterCode, proxyAgent);
    if (!access_token) {
      continue;
    }
    await runBot(access_token, proxies[i]);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log("\nAll accounts have been successfully created.".green);
}

main().catch((error) => console.error("Bot encountered an error:", error));
