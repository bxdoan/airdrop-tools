const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class GameBot {
  constructor() {
    this.queryId = null;
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
    const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    switch(type) {
      case 'success':
        console.log(`[*] ${msg}`.green);
        break;
      case 'error':
        console.log(`[!] ${msg}`.red);
        break;
      case 'warning':
        console.log(`[*] ${msg}`.yellow);
        break;
      default:
        console.log(`[*] ${msg}`.blue);
    }
    await this.randomDelay();
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

  async getNewToken() {
    const url = 'https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP';
    const data = JSON.stringify({ query: this.queryId, referralToken: "", });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.randomDelay();
        const response = await axios.post(url, data, { headers: await this.headers() });
        if (response.status === 200) {
          await this.log('Login successful', 'success');
          this.token = response.data.token.refresh;
          return this.token;
        } else {
          await this.log(JSON.stringify(response.data), 'warning');
          await this.log(`Failed to get token, try again ${attempt}`, 'warning');
        }
      } catch (error) {
        await this.log(`Failed to get token, try again ${attempt}: ${error.message}`, 'error');
        await this.log(error.toString(), 'error');
      }
    }
    await this.log('Failed to get token after 3 attempts.', 'error');
    return null;
  }

  async getUserInfo() {
    try {
      await this.randomDelay();
      const response = await axios.get('https://user-domain.blum.codes/api/v1/user/me', { headers: await this.headers(this.token) });
      if (response.status === 200) {
        this.userInfo = response.data;
        return this.userInfo;
      } else {
        const result = response.data;
        if (result.message === 'Token is invalid') {
          await this.log('Invalid token, getting new token...', 'warning');
          const newToken = await this.getNewToken();
          if (newToken) {
            await this.log('New token available, try again...', 'info');
            return this.getUserInfo();
          } else {
            await this.log('Failed to get new token.', 'error');
            return null;
          }
        } else {
          await this.log('Unable to get user information', 'error');
          return null;
        }
      }
    } catch (error) {
      await this.log(`Failed to get user information: ${error.message}`, 'error');
      return null;
    }
  }

  async getBalance() {
    try {
      await this.randomDelay();
      const response = await axios.get('https://game-domain.blum.codes/api/v1/user/balance', { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Failed to get balance information: ${error.message}`, 'error');
      return null;
    }
  }

  async playGame() {
    const data = JSON.stringify({ game: 'example_game' });
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/game/play', data, { headers: await this.headers(this.token) });
      if (response.status === 200) {
        this.currentGameId = response.data.gameId;
        return response.data;
      } else {
        await this.log('Cannot play game', 'error');
        return null;
      }
    } catch (error) {
      await this.log(`Unable to play game: ${error.message}`, 'error');
      return null;
    }
  }

  async claimGame(points) {
    if (!this.currentGameId) {
      await this.log('No current gameId to claim.', 'warning');
      return null;
    }

    const data = JSON.stringify({ gameId: this.currentGameId, points: points });
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/game/claim', data, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Unable to claim game reward: ${error.message}`, 'error');
      await this.log(error.toString(), 'error');
      return null;
    }
  }

  async claimBalance() {
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/farming/claim', {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Failed to get balance: ${error.message}`, 'error');
      return null;
    }
  }

  async startFarming() {
    const data = JSON.stringify({ action: 'start_farming' });
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/farming/start', data, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Failed to start farming: ${error.message}`, 'error');
      return null;
    }
  }

  async checkBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await axios.get(`https://user-domain.blum.codes/api/v1/friends/balance`, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Unable to check friend balance: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await axios.post(`https://user-domain.blum.codes/api/v1/friends/claim`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Unable to get friend balance!`, 'error');
      return null;
    }
  }

  async checkDailyReward() {
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/daily-reward?offset=-420', {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`You have already checked in or failed to check in daily!`, 'error');
      return null;
    }
  }

  async Countdown(seconds) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[*] Waiting ${i} seconds to continue...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async getTasks() {
    try {
      await this.randomDelay();
      const response = await axios.get('https://game-domain.blum.codes/api/v1/tasks', { headers: await this.headers(this.token) });
      if (response.status === 200) {
        return response.data;
      } else {
        await this.log('Failed to get task list', 'error');
        return [];
      }
    } catch (error) {
      await this.log(`Failed to get task list: ${error.message}`, 'error');
      return [];
    }
  }

  async startTask(taskId) {
    try {
      await this.randomDelay();
      const response = await axios.post(`https://game-domain.blum.codes/api/v1/tasks/${taskId}/start`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async claimTask(taskId) {
    try {
      await this.randomDelay();
      const response = await axios.post(`https://game-domain.blum.codes/api/v1/tasks/${taskId}/claim`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
  }

  async joinTribe(tribeId) {
    const url = `https:///tribe-domain.blum.codes/api/v1/tribe/${tribeId}/join`;
    try {
      await this.randomDelay();
      const response = await axios.post(url, {}, { headers: await this.headers(this.token) });
      if (response.status === 200) {
        await this.log('You have successfully joined the tribe', 'success');
        return true;
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message === 'USER_ALREADY_IN_TRIBE') {
        await this.log('You have joined the tribe', 'warning');
      } else {
        await this.log(`Failed to join tribe: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async main() {
    const dataFile = path.join(__dirname, 'data.txt');
    const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    const nhiemvu = await this.askQuestion('Do you want to do the quest? (y/n): ');
    const hoinhiemvu = nhiemvu.toLowerCase() === 'y';

    while (true) {
      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];

        const token = await this.getNewToken();
        if (!token) {
          await this.log('Failed to get token, skipping this account', 'error');
          continue;
        }

        const userInfo = await this.getUserInfo();
        if (userInfo === null) {
          await this.log('Unable to get user info, skipping this account', 'error');
          continue;
        }

        console.log(`========== Account ${i + 1} | ${userInfo.username.green} ==========`);
        await this.randomDelay();
        
        const balanceInfo = await this.getBalance();
        if (balanceInfo) {
            await this.log('Getting info....', 'info');
            await this.log(`Balance: ${balanceInfo.availableBalance}`, 'success');
            await this.log(`Play tickets game: ${balanceInfo.playPasses}`, 'success');

            const tribeId = 'b372af40-6e97-4782-b70d-4fc7ea435022';
            await this.joinTribe(tribeId);
            
            if (!balanceInfo.farming) {
                const farmingResult = await this.startFarming();
                if (farmingResult) {
                    await this.log('Farming started successfully!', 'success');
                }
            } else {
                const endTime = DateTime.fromMillis(balanceInfo.farming.endTime);
                const formattedEndTime = endTime.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy HH:mm:ss');
                await this.log(`Farm completion time: ${formattedEndTime}`, 'info');
                if (i === 0) {
                  this.firstAccountEndTime = endTime;
                }
                const currentTime = DateTime.now();
                if (currentTime > endTime) {
                    const claimBalanceResult = await this.claimBalance();
                    if (claimBalanceResult) {
                        await this.log('Claim farm successful!', 'success');
                    }

                    const farmingResult = await this.startFarming();
                    if (farmingResult) {
                        await this.log('Farming started successfully!', 'success');
                    }
                } else {
                    const timeLeft = endTime.diff(currentTime).toFormat('hh:mm:ss');
                    await this.log(`Time left for farming: ${timeLeft}`, 'info');
                }
            }
        } else {
            await this.log('Unable to get balance information', 'error');
        }

        if (hoinhiemvu) {
          const taskListResponse = await this.getTasks();
          if (taskListResponse && Array.isArray(taskListResponse) && taskListResponse.length > 0) {
            let allTasks = taskListResponse.flatMap(section => section.tasks || []);
            
            await this.log('Getted task list', 'info');
            
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
            console.log('[*] Total tasks:', allTasks.length);
            
            const notStartedTasks = allTasks.filter(task => task.status === "NOT_STARTED");
            await this.log(`Number of unstarted tasks: ${notStartedTasks.length}`, 'info');
            
            for (const task of notStartedTasks) {
              await this.log(`Starting task: ${task.title} | ${task.id}`, 'info');
              
              const startResult = await this.startTask(task.id);
              if (startResult) {
                await this.log(`Started task: ${task.title}`, 'success');
              } else {
                continue;
              }
              
              await this.Countdown(3);
              
              const claimResult = await this.claimTask(task.id);
              if (claimResult && claimResult.status === "FINISHED") {
                await this.log(`Running task ${task.title.yellow}${`... status: success!`.green}`, 'success');
              } else {
                await this.log(`Unable to claim reward for task: ${task.title.yellow}`, 'error');
              }
            }
          } else {
            await this.log('Could not get task list or task list is empty', 'error');
          }
        }

        const dailyRewardResult = await this.checkDailyReward();
        if (dailyRewardResult) {
          await this.log('Daily reward claimed!', 'success');
        }

        const friendBalanceInfo = await this.checkBalanceFriend();
        if (friendBalanceInfo) {
          await this.log(`Friend Balance: ${friendBalanceInfo.amountForClaim}`, 'info');
          if (friendBalanceInfo.amountForClaim > 0) {
            const claimFriendBalanceResult = await this.claimBalanceFriend();
            if (claimFriendBalanceResult) {
              await this.log('Friend balance received successfully!', 'success');
            }
          } else {
            await this.log('No friend balance to claim!', 'info');
          }
        } else {
          await this.log('Unable to check friend balance!', 'error');
        }
        
        if (balanceInfo && balanceInfo.playPasses > 0) {
          for (let j = 0; j < balanceInfo.playPasses; j++) {
            let playAttempts = 0;
            const maxAttempts = 10;
        
            while (playAttempts < maxAttempts) {
              try {
                const playResult = await this.playGame();
                if (playResult) {
                  await this.log(`Starting game ${j + 1}...`, 'success');
                  await this.Countdown(30);
                  const randomNumber = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
                  const claimGameResult = await this.claimGame(randomNumber);
                  if (claimGameResult) {
                    await this.log(`Received ${j + 1}th game reward successfully with ${randomNumber} points!`, 'success');
                  }
                  break;
                }
              } catch (error) {
                playAttempts++;
                await this.log(`Cannot play game ${j + 1}, ${playAttempts} attempt: ${error.message}`, 'warning');
                if (playAttempts < maxAttempts) {
                  await this.log(`Retrying...`, 'info');
                  await this.Countdown(5);
                } else {
                  await this.log(`Tried ${maxAttempts} multiple times without success, skipping this turn`, 'error');
                }
              }
            }
          }
        } else {
          await this.log('No game tickets', 'info');
        }

        await this.log(`Done processing account ${userInfo.username}`, 'success');
        console.log(''); 
      }

      if (this.firstAccountEndTime) {
        const currentTime = DateTime.now();
        const timeLeft = this.firstAccountEndTime.diff(currentTime).as('seconds');

        if (timeLeft > 0) {
          await this.Countdown(timeLeft);
        } else {
          await this.log('Waiting 10 minutes before starting a new round...', 'info');
          await this.Countdown(600);
        }
      } else {
        await this.log('Waiting 10 minutes before starting a new round...', 'info');
        await this.Countdown(600);
      }
    }
  }
}

if (require.main === module) {
  const gameBot = new GameBot();
  gameBot.main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
