const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { DateTime, Duration } = require('luxon');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { HttpsProxyAgent } = require('https-proxy-agent');

// try load ./../.env file and get DATA_DIR environment variable
try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}
catch (error) {
    console.error('Không thể load file .env');
}
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');


class GameBot {
  constructor(queryId, accountIndex, proxy) {
    this.queryId = queryId;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.token = null;
    this.userInfo = null;
    this.currentGameId = null;
    this.firstAccountEndTime = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async randomDelay() {
    const delay = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const accountPrefix = `[Tài khoản ${this.accountIndex + 1}]`;
    const ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : '[Unknown IP]';
    let logMessage = '';

    switch(type) {
      case 'success':
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
        break;
      case 'error':
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
        break;
      case 'warning':
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
        break;
      default:
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
    }

    console.log(logMessage);
    await this.randomDelay();
  }

  async checkProxyIP() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxy);
      const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
      if (response.status === 200) {
        this.proxyIP = response.data.ip;
        await this.log(`Đang sử dụng proxy IP: ${this.proxyIP}`, 'info');
      } else {
        throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
      }
    } catch (error) {
      await this.log(`Error khi kiểm tra IP của proxy: ${error.message}`, 'error');
    }
  }

  async headers(token = null) {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://telegram.blum.codes',
      'referer': 'https://telegram.blum.codes/',
      'user-agent': this.getRandomUserAgent(),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async makeRequest(method, url, data = null, useToken = false) {
    const config = {
      method: method,
      url: url,
      headers: await this.headers(useToken ? this.token : null),
      httpsAgent: new HttpsProxyAgent(this.proxy)
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getNewToken() {
    const url = 'https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP';
    const data = JSON.stringify({ query: this.queryId, referralToken: "", });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.randomDelay();
        const response = await this.makeRequest('post', url, data);
        this.token = response.token.refresh;
        return this.token;
      } catch (error) {
        await this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}: ${error.message}`, 'error');
      }
    }
    await this.log('Lấy token thất bại sau 3 lần thử.', 'error');
    return null;
  }

  async getUserInfo() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('get', 'https://user-domain.blum.codes/api/v1/user/me', null, true);
      this.userInfo = response;
      return this.userInfo;
    } catch (error) {
      await this.log(`Không thể lấy thông tin người dùng: ${error.message}`, 'error');
      return null;
    }
  }

  async getBalance() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('get', 'https://game-domain.blum.codes/api/v1/user/balance', null, true);
      return response;
    } catch (error) {
      await this.log(`Không thể lấy thông tin số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async playGame() {
    const data = JSON.stringify({ game: 'example_game' });
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://game-domain.blum.codes/api/v1/game/play', data, true);
      this.currentGameId = response.gameId;
      return response;
    } catch (error) {
      return null;
    }
  }

  async claimGame(points) {
    if (!this.currentGameId) {
      await this.log('Không có gameId hiện tại để claim.', 'warning');
      return null;
    }

    const data = JSON.stringify({ gameId: this.currentGameId, points: points });
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://game-domain.blum.codes/api/v1/game/claim', data, true);
      return response;
    } catch (error) {
      await this.log(`Không thể nhận phần thưởng game: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalance() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://game-domain.blum.codes/api/v1/farming/claim', {}, true);
      return response;
    } catch (error) {
      await this.log(`Không thể nhận số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async startFarming() {
    const data = JSON.stringify({ action: 'start_farming' });
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://game-domain.blum.codes/api/v1/farming/start', data, true);
      return response;
    } catch (error) {
      await this.log(`Không thể bắt đầu farming: ${error.message}`, 'error');
      return null;
    }
  }

  async checkBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('get', 'https://user-domain.blum.codes/api/v1/friends/balance', null, true);
      return response;
    } catch (error) {
      await this.log(`Không thể kiểm tra số dư bạn bè: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://user-domain.blum.codes/api/v1/friends/claim', {}, true);
      return response;
    } catch (error) {
      await this.log(`Không thể nhận số dư bạn bè!`, 'error');
      return null;
    }
  }

  async checkDailyReward() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', 'https://game-domain.blum.codes/api/v1/daily-reward?offset=-420', {}, true);
      return response;
    } catch (error) {
      return null;
    }
  }

  async Countdown(seconds) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`${`[Tài khoản ${this.accountIndex + 1}]`.padEnd(15)} [*] Chờ ${i} giây để tiếp tục...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async getTasks() {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('get', 'https://game-domain.blum.codes/api/v1/tasks', null, true);
      return response;
    } catch (error) {
      await this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
      return [];
    }
  }

  async startTask(taskId) {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', `https://game-domain.blum.codes/api/v1/tasks/${taskId}/start`, {}, true);
      return response;
    } catch (error) {
      return null;
    }
  }

  async claimTask(taskId) {
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', `https://game-domain.blum.codes/api/v1/tasks/${taskId}/claim`, {}, true);
      return response;
    } catch (error) {
      return null;
    }
  }

  async joinTribe(tribeId) {
    const url = `https:///tribe-domain.blum.codes/api/v1/tribe/${tribeId}/join`;
    try {
      await this.randomDelay();
      const response = await this.makeRequest('post', url, {}, true);
      if (response) {
        await this.log('Bạn đã gia nhập tribe thành công', 'success');
        return true;
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message === 'USER_ALREADY_IN_TRIBE') {
      } else {
        await this.log(`Không thể gia nhập tribe: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async runAccount() {
    await this.checkProxyIP();

    let remainingFarmingTime = null;

    const token = await this.getNewToken();
    if (!token) {
      await this.log('Không thể lấy token, bỏ qua tài khoản này', 'error');
      return Duration.fromMillis(0);
    }

    const userInfo = await this.getUserInfo();
    if (userInfo === null) {
      await this.log('Không thể lấy thông tin người dùng, bỏ qua tài khoản này', 'error');
      return Duration.fromMillis(0);
    }

    await this.log(`Bắt đầu xử lý tài khoản ${userInfo.username}`, 'info');

    const balanceInfo = await this.getBalance();
    if (balanceInfo) {
      await this.log(`Số dư: ${balanceInfo.availableBalance} | Game : ${balanceInfo.playPasses}`, 'success');

      const tribeId = 'b372af40-6e97-4782-b70d-4fc7ea435022';
      await this.joinTribe(tribeId);

      if (!balanceInfo.farming) {
        const farmingResult = await this.startFarming();
        if (farmingResult) {
          await this.log('Đã bắt đầu farming thành công!', 'success');
          remainingFarmingTime = Duration.fromObject({ hours: 8 });
        }
      } else {
        const endTime = DateTime.fromMillis(balanceInfo.farming.endTime);
        const formattedEndTime = endTime.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy HH:mm:ss');
        const currentTime = DateTime.now();
        if (currentTime > endTime) {
          const claimBalanceResult = await this.claimBalance();
          if (claimBalanceResult) {
            await this.log('Claim farm thành công!', 'success');
          }

          const farmingResult = await this.startFarming();
          if (farmingResult) {
            await this.log('Đã bắt đầu farming thành công!', 'success');
            remainingFarmingTime = Duration.fromObject({ hours: 8 });
          }
        } else {
          remainingFarmingTime = endTime.diff(currentTime);
          const timeLeft = remainingFarmingTime.toFormat('hh:mm:ss');
          await this.log(`Thời gian còn lại để farming: ${timeLeft}`, 'info');
        }
      }
    } else {
      await this.log('Không thể lấy thông tin số dư', 'error');
    }
    const taskListResponse = await this.getTasks();
    if (taskListResponse && Array.isArray(taskListResponse) && taskListResponse.length > 0) {
      let allTasks = taskListResponse.flatMap(section => section.tasks || []);

      const excludedTaskIds = [
        "5daf7250-76cc-4851-ac44-4c7fdcfe5994",
        "3b0ae076-9a85-4090-af55-d9f6c9463b2b",
        "89710917-9352-450d-b96e-356403fc16e0",
        "220ee7b1-cca4-4af8-838a-2001cb42b813",
        "c4e04f2e-bbf5-4e31-917b-8bfa7c4aa3aa",
        "f382ec3f-089d-46de-b921-b92adfd3327a",
        "d3716390-ce5b-4c26-b82e-e45ea7eba258",
        "5ecf9c15-d477-420b-badf-058537489524",
        "d057e7b7-69d3-4c15-bef3-b300f9fb7e31",
        "a4ba4078-e9e2-4d16-a834-02efe22992e2"
      ];

      allTasks = allTasks.filter(task => !excludedTaskIds.includes(task.id));

      const notStartedTasks = allTasks.filter(task => task.status === "NOT_STARTED");
      for (const task of notStartedTasks) {
        const startResult = await this.startTask(task.id);
        if (startResult) {
          await new Promise(resolve => setTimeout(resolve, 3000));

          const claimResult = await this.claimTask(task.id);
          if (claimResult && claimResult.status === "FINISHED") {
            await this.log(`Làm nhiệm vụ ${task.title}... trạng thái: thành công!`, 'success');
          } else {
            await this.log(`Không thể nhận phần thưởng cho nhiệm vụ: ${task.title}`, 'error');
          }
        } else {
          await this.log(`Không thể bắt đầu nhiệm vụ: ${task.title}`, 'error');
        }
      }
    } else {
      await this.log('Không thể lấy danh sách nhiệm vụ hoặc danh sách nhiệm vụ trống', 'error');
    }

    const dailyRewardResult = await this.checkDailyReward();
    if (dailyRewardResult) {
      await this.log('Đã nhận phần thưởng hàng ngày!', 'success');
    }

    const friendBalanceInfo = await this.checkBalanceFriend();
    if (friendBalanceInfo) {
      if (friendBalanceInfo.amountForClaim > 0) {
        await this.log(`Số dư bạn bè: ${friendBalanceInfo.amountForClaim}`, 'info');
        const claimFriendBalanceResult = await this.claimBalanceFriend();
        if (claimFriendBalanceResult) {
          await this.log('Đã nhận số dư bạn bè thành công!', 'success');
        }
      }
    } else {
      await this.log('Không thể kiểm tra số dư bạn bè!', 'error');
    }

    if (balanceInfo && balanceInfo.playPasses > 0) {
      for (let j = 0; j < balanceInfo.playPasses; j++) {
        let playAttempts = 0;
        const maxAttempts = 10;

        while (playAttempts < maxAttempts) {
          try {
            const playResult = await this.playGame();
            if (playResult) {
              await this.log(`Bắt đầu chơi game lần thứ ${j + 1}...`, 'success');
              await new Promise(resolve => setTimeout(resolve, 30000));
              const randomNumber = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
              const claimGameResult = await this.claimGame(randomNumber);
              if (claimGameResult) {
                await this.log(`Đã nhận phần thưởng game lần thứ ${j + 1} thành công với ${randomNumber} điểm!`, 'success');
              }
              break;
            }
          } catch (error) {
            playAttempts++;
            await this.log(`Không thể chơi game lần thứ ${j + 1}, lần thử ${playAttempts}: ${error.message}`, 'warning');
            if (playAttempts < maxAttempts) {
              await this.log(`Đang thử lại...`, 'info');
              await this.Countdown(5);
            } else {
              await this.log(`Đã thử ${maxAttempts} lần không thành công, bỏ qua lượt chơi này`, 'error');
            }
          }
        }
      }
    }

    await this.log(`Hoàn thành xử lý tài khoản ${userInfo.username}`, 'success');

    return remainingFarmingTime || Duration.fromMillis(0);
  }
}

async function runWorker(workerData) {
  const { queryId, accountIndex, proxy } = workerData;
  const gameBot = new GameBot(queryId, accountIndex, proxy);
  const remainingTime = await gameBot.runAccount();
  parentPort.postMessage({ accountIndex, remainingTime: remainingTime.as('seconds') });
}


function formatProxy(proxy) {
  // from ip:port:user:pass to http://user:pass@ip:port
  // if http format, just keep it
  if (proxy.startsWith('http')) {
    return proxy;
  }
  const parts = proxy.split(':');
  if (parts.length === 4) {
    return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`
  } else {
    return `http://${parts[0]}:${parts[1]}`;
  }
}

indexProxies = 0;
function getProxy(listProxies) {
    const proxy = listProxies[indexProxies];
    indexProxies++;
    if (indexProxies >= listProxies.length) {
      indexProxies = 0;
    }
    return proxy;
}


async function main() {

  this.indexProxies = 0;


  const maxThreads = 10;
    const proxyFile = path.join(`${DATA_DIR}/proxy.txt`);
  const listProxies = fs.readFileSync(proxyFile, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .filter(Boolean);

  // if (queryIds.length !== proxies.length) {
  //   console.error('Số lượng proxy và data phải bằng nhau.'.red);
  //   console.log(`Data: ${queryIds.length}`);
  //   console.log(`Proxy: ${proxies.length}`);
  //   process.exit(1);
  // }
    while (true) {
      let currentIndex = 0;
      let minRemainingTime = Infinity;

      const dataFile = path.join(`${DATA_DIR}/blum.txt`);
      const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

      while (currentIndex < queryIds.length) {
        console.log(`Đã sợ thì đừng dùng, đã dùng thì đừng sợ!`.magenta);
        const workerPromises = [];
        const proxy = formatProxy(getProxy(listProxies));

        const batchSize = Math.min(maxThreads, queryIds.length - currentIndex);
        for (let i = 0; i < batchSize; i++) {
          const worker = new Worker(__filename, {
            workerData: {
              queryId: queryIds[currentIndex],
              accountIndex: currentIndex,
              proxy: proxy
            }
          });

        workerPromises.push(
          new Promise((resolve, reject) => {
            worker.on('message', (message) => {
              const { remainingTime } = message;
              if (remainingTime < minRemainingTime) {
                minRemainingTime = remainingTime;
              }
              resolve();
            });
            worker.on('error', reject);
            worker.on('exit', (code) => {
              if (code !== 0) reject(new Error(`Luồng bị dừng: ${code}`));
              else resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (currentIndex < queryIds.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const waitTimeSeconds = Math.max(minRemainingTime, 600);
    const gameBot = new GameBot(null, 0, proxies[0]);
    await gameBot.Countdown(waitTimeSeconds);
  }
}

if (isMainThread) {
  main().catch(error => {
    console.error('Lỗi rồi:', error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}