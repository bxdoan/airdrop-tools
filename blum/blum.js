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
          await this.log('Đăng nhập thành công', 'success');
          this.token = response.data.token.refresh;
          return this.token;
        } else {
          await this.log(JSON.stringify(response.data), 'warning');
          await this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}`, 'warning');
        }
      } catch (error) {
        await this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}: ${error.message}`, 'error');
        await this.log(error.toString(), 'error');
      }
    }
    await this.log('Lấy token thất bại sau 3 lần thử.', 'error');
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
          await this.log('Token không hợp lệ, đang lấy token mới...', 'warning');
          const newToken = await this.getNewToken();
          if (newToken) {
            await this.log('Đã có token mới, thử lại...', 'info');
            return this.getUserInfo();
          } else {
            await this.log('Lấy token mới thất bại.', 'error');
            return null;
          }
        } else {
          await this.log('Không thể lấy thông tin người dùng', 'error');
          return null;
        }
      }
    } catch (error) {
      await this.log(`Không thể lấy thông tin người dùng: ${error.message}`, 'error');
      return null;
    }
  }

  async getBalance() {
    try {
      await this.randomDelay();
      const response = await axios.get('https://game-domain.blum.codes/api/v1/user/balance', { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Không thể lấy thông tin số dư: ${error.message}`, 'error');
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
        await this.log('Không thể chơi game', 'error');
        return null;
      }
    } catch (error) {
      await this.log(`Không thể chơi game: ${error.message}`, 'error');
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
      const response = await axios.post('https://game-domain.blum.codes/api/v1/game/claim', data, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Không thể nhận phần thưởng game: ${error.message}`, 'error');
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
      await this.log(`Không thể nhận số dư: ${error.message}`, 'error');
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
      await this.log(`Không thể bắt đầu farming: ${error.message}`, 'error');
      return null;
    }
  }

  async checkBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await axios.get(`https://user-domain.blum.codes/api/v1/friends/balance`, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Không thể kiểm tra số dư bạn bè: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalanceFriend() {
    try {
      await this.randomDelay();
      const response = await axios.post(`https://user-domain.blum.codes/api/v1/friends/claim`, {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Không thể nhận số dư bạn bè!`, 'error');
      return null;
    }
  }

  async checkDailyReward() {
    try {
      await this.randomDelay();
      const response = await axios.post('https://game-domain.blum.codes/api/v1/daily-reward?offset=-420', {}, { headers: await this.headers(this.token) });
      return response.data;
    } catch (error) {
      await this.log(`Bạn đã điểm danh rồi hoặc không thể điểm danh hàng ngày!`, 'error');
      return null;
    }
  }

  async Countdown(seconds) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
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
        await this.log('Không thể lấy danh sách nhiệm vụ', 'error');
        return [];
      }
    } catch (error) {
      await this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
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
        await this.log('Bạn đã gia nhập tribe thành công', 'success');
        return true;
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message === 'USER_ALREADY_IN_TRIBE') {
        await this.log('Bạn đã gia nhập tribe rồi', 'warning');
      } else {
        await this.log(`Không thể gia nhập tribe: ${error.message}`, 'error');
      }
      return false;
    }
  }

  async main() {
    const dataFile = path.join(__dirname, './../data/blum.txt');
    const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    const nhiemvu = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
    const hoinhiemvu = nhiemvu.toLowerCase() === 'y';

    while (true) {
      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];

        const token = await this.getNewToken();
        if (!token) {
          await this.log('Không thể lấy token, bỏ qua tài khoản này', 'error');
          continue;
        }

        const userInfo = await this.getUserInfo();
        if (userInfo === null) {
          await this.log('Không thể lấy thông tin người dùng, bỏ qua tài khoản này', 'error');
          continue;
        }

        console.log(`========== Tài khoản ${i + 1} | ${userInfo.username.green} ==========`);
        await this.randomDelay();
        
        const balanceInfo = await this.getBalance();
        if (balanceInfo) {
            await this.log('Đang lấy thông tin....', 'info');
            await this.log(`Số dư: ${balanceInfo.availableBalance}`, 'success');
            await this.log(`Vé chơi game: ${balanceInfo.playPasses}`, 'success');

            const tribeId = 'b372af40-6e97-4782-b70d-4fc7ea435022';
            await this.joinTribe(tribeId);
            
            if (!balanceInfo.farming) {
                const farmingResult = await this.startFarming();
                if (farmingResult) {
                    await this.log('Đã bắt đầu farming thành công!', 'success');
                }
            } else {
                const endTime = DateTime.fromMillis(balanceInfo.farming.endTime);
                const formattedEndTime = endTime.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy HH:mm:ss');
                await this.log(`Thời gian hoàn thành farm: ${formattedEndTime}`, 'info');
                if (i === 0) {
                  this.firstAccountEndTime = endTime;
                }
                const currentTime = DateTime.now();
                if (currentTime > endTime) {
                    const claimBalanceResult = await this.claimBalance();
                    if (claimBalanceResult) {
                        await this.log('Claim farm thành công!', 'success');
                    }

                    const farmingResult = await this.startFarming();
                    if (farmingResult) {
                        await this.log('Đã bắt đầu farming thành công!', 'success');
                    }
                } else {
                    const timeLeft = endTime.diff(currentTime).toFormat('hh:mm:ss');
                    await this.log(`Thời gian còn lại để farming: ${timeLeft}`, 'info');
                }
            }
        } else {
            await this.log('Không thể lấy thông tin số dư', 'error');
        }

        if (hoinhiemvu) {
          const taskListResponse = await this.getTasks();
          if (taskListResponse && Array.isArray(taskListResponse) && taskListResponse.length > 0) {
            let allTasks = taskListResponse.flatMap(section => section.tasks || []);
            
            await this.log('Đã lấy danh sách nhiệm vụ', 'info');
            
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
            console.log('[*] Tổng số nhiệm vụ:', allTasks.length);
            
            const notStartedTasks = allTasks.filter(task => task.status === "NOT_STARTED");
            await this.log(`Số lượng nhiệm vụ chưa bắt đầu: ${notStartedTasks.length}`, 'info');
            
            for (const task of notStartedTasks) {
              await this.log(`Bắt đầu nhiệm vụ: ${task.title} | ${task.id}`, 'info');
              
              const startResult = await this.startTask(task.id);
              if (startResult) {
                await this.log(`Đã bắt đầu nhiệm vụ: ${task.title}`, 'success');
              } else {
                continue;
              }
              
              await this.Countdown(3);
              
              const claimResult = await this.claimTask(task.id);
              if (claimResult && claimResult.status === "FINISHED") {
                await this.log(`Làm nhiệm vụ ${task.title.yellow}${`... trạng thái: thành công!`.green}`, 'success');
              } else {
                await this.log(`Không thể nhận phần thưởng cho nhiệm vụ: ${task.title.yellow}`, 'error');
              }
            }
          } else {
            await this.log('Không thể lấy danh sách nhiệm vụ hoặc danh sách nhiệm vụ trống', 'error');
          }
        }

        const dailyRewardResult = await this.checkDailyReward();
        if (dailyRewardResult) {
          await this.log('Đã nhận phần thưởng hàng ngày!', 'success');
        }

        const friendBalanceInfo = await this.checkBalanceFriend();
        if (friendBalanceInfo) {
          await this.log(`Số dư bạn bè: ${friendBalanceInfo.amountForClaim}`, 'info');
          if (friendBalanceInfo.amountForClaim > 0) {
            const claimFriendBalanceResult = await this.claimBalanceFriend();
            if (claimFriendBalanceResult) {
              await this.log('Đã nhận số dư bạn bè thành công!', 'success');
            }
          } else {
            await this.log('Không có số dư bạn bè để nhận!', 'info');
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
                  await this.Countdown(30);
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
        } else {
          await this.log('Không có vé chơi game', 'info');
        }

        await this.log(`Hoàn thành xử lý tài khoản ${userInfo.username}`, 'success');
        console.log(''); 
      }

      if (this.firstAccountEndTime) {
        const currentTime = DateTime.now();
        const timeLeft = this.firstAccountEndTime.diff(currentTime).as('seconds');

        if (timeLeft > 0) {
          await this.Countdown(timeLeft);
        } else {
          await this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'info');
          await this.Countdown(600);
        }
      } else {
        await this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'info');
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