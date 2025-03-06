const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
require("colors");
const { jwtDecode } = require("jwt-decode");
const axios = require("axios");

async function checkProxyIP(proxy) {
  try {
    const proxyAgent = new HttpsProxyAgent(proxy);
    const response = await axios.get("https://api.ipify.org?format=json", { httpsAgent: proxyAgent });
    if (response.status === 200) {
      response.data.ip;
      return response.data.ip;
    }
    console.log(`Failed to check IP address from proxy: ${proxy}`.yellow);
    return null;
  } catch (error) {
    console.log(`Failed to check IP address from proxy: ${proxy}`.yellow);
    return null;
  }
}

const newAgent = (proxy = null) => {
  if (proxy) {
    if (proxy.startsWith("http://")) {
      return new HttpsProxyAgent(proxy);
    } else if (proxy.startsWith("socks4://") || proxy.startsWith("socks5://")) {
      return new SocksProxyAgent(proxy);
    } else {
      console.log(`Unsupported proxy type: ${proxy}`.yellow);
      return null;
    }
  }
  return null;
};

function decodeJWT(token) {
  const decoded = jwtDecode(token);
  return decoded;
}

function isTokenExpired(token) {
  if (!token) return true;

  try {
    const [, payload] = token.split(".");
    if (!payload) return true;

    const decodedPayload = JSON.parse(Buffer.from(payload, "base64").toString());
    const now = Math.floor(Date.now() / 1000);

    if (!decodedPayload.exp) {
      // console.log("Eternal token".yellow);
      return false;
    }
    const expirationDate = new Date(decodedPayload.exp * 1000);
    const isExpired = now > decodedPayload.exp;

    console.log(`Token expires after: ${expirationDate.toLocaleString()}`.magenta);
    console.log(`Token status: ${isExpired ? "Expired".yellow : "Valid".green}`);

    return isExpired;
  } catch (error) {
    console.log(`Error checking token: ${error.message}`.red);
    return true;
  }
}

module.exports = { newAgent, isTokenExpired, decodeJWT, checkProxyIP };
