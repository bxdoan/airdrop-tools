const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const { HttpsProxyAgent } = require('https-proxy-agent');

class GameBot {
  constructor() {
    this.queryId = null;
    this.token = null;
    this.userInfo = null;
    this.currentGameId = null;
    this.proxy = null;
    this.proxyAgent = null;
    this.firstAccountEndTime = null;
    this.listProxies = [];
    this.indexProxies = 0;
  }

  log(msg, type = 'info') {
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
  }

  async checkProxyIP(proxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: proxyAgent
      });
      if (response.status === 200) {
        return response.data.ip;
      } else {
        throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
    }
  }

  async headers(token = null) {
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'origin': 'https://telegram.blum.codes',
      'referer': 'https://telegram.blum.codes/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async makeRequest(method, url, data = null, customHeaders = {}) {
    const config = {
      method,
      url,
      headers: await this.headers(this.token),
      httpsAgent: this.proxyAgent,
    };

    if (data) {
      config.data = data;
    }

    Object.assign(config.headers, customHeaders);

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getNewToken() {
    const url = 'https://gateway.blum.codes/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP';
    const data = JSON.stringify({ query: this.queryId });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.makeRequest('POST', url, data);
        if (response.status === 200) {
          this.log('Đăng nhập thành công', 'success');
          this.token = response.data.token.refresh;
          return this.token;
        } else {
          this.log(JSON.stringify(response.data), 'warning');
          this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}`, 'warning');
        }
      } catch (error) {
        this.log(`Lấy token thất bại, thử lại lần thứ ${attempt}: ${error.message}`, 'error');
        this.log(error.toString(), 'error');
      }
    }
    this.log('Lấy token thất bại sau 3 lần thử.', 'error');
    return null;
  }

  async getUserInfo() {
    try {
      const response = await this.makeRequest('GET', 'https://gateway.blum.codes/v1/user/me');
      if (response.status === 200) {
        this.userInfo = response.data;
        return this.userInfo;
      } else {
        const result = response.data;
        if (result.message === 'Token is invalid') {
          this.log('Token không hợp lệ, đang lấy token mới...', 'warning');
          const newToken = await this.getNewToken();
          if (newToken) {
            this.log('Đã có token mới, thử lại...', 'info');
            return this.getUserInfo();
          } else {
            this.log('Lấy token mới thất bại.', 'error');
            return null;
          }
        } else {
          this.log('Không thể lấy thông tin người dùng', 'error');
          return null;
        }
      }
    } catch (error) {
      this.log(`Không thể lấy thông tin người dùng: ${error.message}`, 'error');
      return null;
    }
  }

  async getBalance() {
    try {
      const response = await this.makeRequest('GET', 'https://game-domain.blum.codes/api/v1/user/balance');
      return response.data;
    } catch (error) {
      this.log(`Không thể lấy thông tin số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async playGame() {
    const data = JSON.stringify({ game: 'example_game' });
    try {
      const response = await this.makeRequest('POST', 'https://game-domain.blum.codes/api/v1/game/play', data);
      if (response.status === 200) {
        this.currentGameId = response.data.gameId;
        return response.data;
      } else {
        this.log('Không thể chơi game', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể chơi game: ${error.message}`, 'error');
      return null;
    }
  }

  async claimGame(points) {
    if (!this.currentGameId) {
      this.log('Không có gameId hiện tại để claim.', 'warning');
      return null;
    }

    const data = JSON.stringify({ gameId: this.currentGameId, points: points });
    try {
      const response = await this.makeRequest('POST', 'https://game-domain.blum.codes/api/v1/game/claim', data);
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận phần thưởng game: ${error.message}`, 'error');
      this.log(error.toString(), 'error');
      return null;
    }
  }

  async claimBalance() {
    try {
      const response = await this.makeRequest('POST', 'https://game-domain.blum.codes/api/v1/farming/claim');
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận số dư: ${error.message}`, 'error');
      return null;
    }
  }

  async startFarming() {
    const data = JSON.stringify({ action: 'start_farming' });
    try {
      const response = await this.makeRequest('POST', 'https://game-domain.blum.codes/api/v1/farming/start', data);
      return response.data;
    } catch (error) {
      this.log(`Không thể bắt đầu farming: ${error.message}`, 'error');
      return null;
    }
  }

  async checkBalanceFriend() {
    try {
      const response = await this.makeRequest('GET', 'https://gateway.blum.codes/v1/friends/balance');
      return response.data;
    } catch (error) {
      this.log(`Không thể kiểm tra số dư bạn bè: ${error.message}`, 'error');
      return null;
    }
  }

  async claimBalanceFriend() {
    try {
      const response = await this.makeRequest('POST', 'https://gateway.blum.codes/v1/friends/claim');
      return response.data;
    } catch (error) {
      this.log(`Không thể nhận số dư bạn bè!`, 'error');
      return null;
    }
  }

  async checkDailyReward() {
    try {
      const response = await this.makeRequest('POST', 'https://game-domain.blum.codes/api/v1/daily-reward?offset=-420');
      return response.data;
    } catch (error) {
      this.log(`Bạn đã điểm danh rồi hoặc không thể điểm danh hàng ngày!`, 'error');
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
      const response = await this.makeRequest('GET', 'https://game-domain.blum.codes/api/v1/tasks');
      if (response.status === 200) {
        return response.data;
      } else {
        this.log('Không thể lấy danh sách nhiệm vụ', 'error');
        return [];
      }
    } catch (error) {
      this.log(`Không thể lấy danh sách nhiệm vụ: ${error.message}`, 'error');
      return [];
    }
  }
  
  async startTask(taskId) {
    try {
      const response = await this.makeRequest('POST', `https://game-domain.blum.codes/api/v1/tasks/${taskId}/start`);
      return response.data;
    } catch (error) {
//      this.log(`Không thể bắt đầu nhiệm vụ ${taskId}: ${error.message}`, 'error');
      return null;
    }
  }
  
  async claimTask(taskId) {
    try {
      const response = await this.makeRequest('POST', `https://game-domain.blum.codes/api/v1/tasks/${taskId}/claim`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  formatProxy(proxy) {
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

  getProxy() {
    const proxy = this.listProxies[this.indexProxies];
    this.indexProxies++;
    if (this.indexProxies >= this.listProxies.length) {
      this.indexProxies = 0;
    }
    return proxy;
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
    const url = `https://game-domain.blum.codes/api/v1/tribe/${tribeId}/join`;
    try {
      const response = await this.makeRequest('POST', url);
      if (response.status === 200) {
        this.log('Bạn đã gia nhập tribe thành công', 'success');
        return true;
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message === 'USER_ALREADY_IN_TRIBE') {
        this.log('Bạn đã gia nhập tribe rồi', 'warning');
      } else {
        this.log(`Không thể gia nhập tribe: ${error.message}`, 'error');
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
    const proxyFile = path.join(__dirname, './../data/proxy.txt');
    this.listProxies = fs.readFileSync(proxyFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    const nhiemvu = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
    const hoinhiemvu = nhiemvu.toLowerCase() === 'y';

    while (true) {
      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];
        this.proxy = this.formatProxy(this.getProxy());
        this.proxyAgent = new HttpsProxyAgent(this.proxy);

        let proxyIP;
        try {
          proxyIP = await this.checkProxyIP(this.proxy);
        } catch (error) {
          this.log(`Không thể sử dụng proxy ${this.proxy}: ${error.message}`, 'error');
          continue;
        }

        const token = await this.getNewToken();
        if (!token) {
          this.log('Không thể lấy token, bỏ qua tài khoản này', 'error');
          continue;
        }

        const userInfo = await this.getUserInfo();
        if (userInfo === null) {
          this.log('Không thể lấy thông tin người dùng, bỏ qua tài khoản này', 'error');
          continue;
        }

        this.log(`====== Tài khoản ${i + 1}/${queryIds.length} | ${userInfo.username.green} | ip: ${proxyIP} ==========`, 'success');
        
        const balanceInfo = await this.getBalance();
        if (balanceInfo) {
            this.log('Đang lấy thông tin....', 'info');
            this.log(`Số dư: ${balanceInfo.availableBalance}`, 'success');
            this.log(`Vé chơi game: ${balanceInfo.playPasses}`, 'success');

            const tribeId = 'b372af40-6e97-4782-b70d-4fc7ea435022';
            await this.joinTribe(tribeId);

            if (!balanceInfo.farming) {
                const farmingResult = await this.startFarming();
                if (farmingResult) {
                    this.log('Đã bắt đầu farming thành công!', 'success');
                }
            } else {
                const endTime = DateTime.fromMillis(balanceInfo.farming.endTime);
                const formattedEndTime = endTime.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy HH:mm:ss');
                this.log(`Thời gian hoàn thành farm: ${formattedEndTime} `, 'info');
                if (i === 0) {
                  this.firstAccountEndTime = endTime;
                }
                const currentTime = DateTime.now();
                if (currentTime > endTime) {
                    const claimBalanceResult = await this.claimBalance();
                    if (claimBalanceResult) {
                        this.log('Claim farm thành công!', 'success');
                    }

                    const farmingResult = await this.startFarming();
                    if (farmingResult) {
                        this.log('Đã bắt đầu farming thành công!', 'success');
                    }
                } else {
                    const timeLeft = endTime.diff(currentTime).toFormat('hh:mm:ss');
                    this.log(`Thời gian còn lại để farming: ${timeLeft} đã được $${balanceInfo.farming.balance}`, 'info');
                }
            }
        } else {
            this.log('Không thể lấy thông tin số dư', 'error');
        }
        if (hoinhiemvu) {
          const taskListResponse = await this.getTasks();

          if (taskListResponse && Array.isArray(taskListResponse) && taskListResponse.length > 0) {
            let allTasks = taskListResponse.flatMap(section => section.tasks || []);
            
            this.log('Đã lấy danh sách nhiệm vụ', 'info');

            const excludedTaskId = "5daf7250-76cc-4851-ac44-4c7fdcfe5994";
            allTasks = allTasks.filter(task => task.id !== excludedTaskId);
            console.log('[*] Tổng số nhiệm vụ:', allTasks.length);
            const notStartedTasks = allTasks.filter(task => task.status === "NOT_STARTED");
            this.log(`Số lượng nhiệm vụ chưa bắt đầu: ${notStartedTasks.length}`, 'info');
            for (const task of notStartedTasks) {
              this.log(`Bắt đầu nhiệm vụ: ${task.title}`, 'info');

              const startResult = await this.startTask(task.id);
              if (startResult) {
                this.log(`Đã bắt đầu nhiệm vụ: ${task.title}`, 'success');
              } else {
//                this.log(`Không thể bắt đầu nhiệm vụ: ${task.title}`, 'error');
                continue;
              }

              await this.Countdown(3);

              const claimResult = await this.claimTask(task.id);
              if (claimResult && claimResult.status === "FINISHED") {
                this.log(`Làm nhiệm vụ ${task.title.yellow}${`... trạng thái: thành công!`.green}`, 'success');
              } else {
                this.log(`Không thể nhận phần thưởng cho nhiệm vụ: ${task.title.yellow}`, 'error');
              }
            }
          } else {
            this.log('Không thể lấy danh sách nhiệm vụ hoặc danh sách nhiệm vụ trống', 'error');
          }
        }
        const dailyRewardResult = await this.checkDailyReward();
        if (dailyRewardResult) {
          this.log('Đã nhận phần thưởng hàng ngày!', 'success');
        }

        const friendBalanceInfo = await this.checkBalanceFriend();
        if (friendBalanceInfo) {
          this.log(`Số dư bạn bè: ${friendBalanceInfo.amountForClaim}`, 'info');
          if (friendBalanceInfo.amountForClaim > 0) {
            const claimFriendBalanceResult = await this.claimBalanceFriend();
            if (claimFriendBalanceResult) {
              this.log('Đã nhận số dư bạn bè thành công!', 'success');
            }
          } else {
            this.log('Không có số dư bạn bè để nhận!', 'info');
          }
        } else {
          this.log('Không thể kiểm tra số dư bạn bè!', 'error');
        }
        
        if (balanceInfo && balanceInfo.playPasses > 0) {
          for (let j = 0; j < balanceInfo.playPasses; j++) {
            let playAttempts = 0;
            const maxAttempts = 5; 
        
            while (playAttempts < maxAttempts) {
              try {
                const playResult = await this.playGame();
                if (playResult) {
                  this.log(`Bắt đầu chơi game lần thứ ${j + 1}...`, 'success');
                  await this.Countdown(30);
                  const claimGameResult = await this.claimGame(2000);
                  if (claimGameResult) {
                    this.log(`Đã nhận phần thưởng game lần thứ ${j + 1} thành công!`, 'success');
                  }
                  break; 
                } else {
                  throw new Error("Không thể bắt đầu trò chơi");
                }
              } catch (error) {
                playAttempts++;
                this.log(`Không thể chơi game lần thứ ${j + 1}, lần thử ${playAttempts}: ${error.message}`, 'warning');
                if (playAttempts < maxAttempts) {
                  this.log(`Đang thử lại sau 5 giây...`, 'info');
                  await this.Countdown(5); 
                } else {
                  this.log(`Đã thử ${maxAttempts} lần không thành công, bỏ qua lượt chơi này`, 'error');
                }
              }
            }
          }
        } else {
          this.log('Không có vé chơi game', 'info');
        }

        this.log(`==== Hoàn thành xử lý tài khoản ${i + 1} | ${userInfo.username.green} | ip: ${proxyIP} ======`, 'success');
        console.log('');
      }

      if (this.firstAccountEndTime) {
        const currentTime = DateTime.now();
        const timeLeft = this.firstAccountEndTime.diff(currentTime).as('seconds');

        if (timeLeft > 0) {
          await this.Countdown(timeLeft);
        } else {
          this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'info');
          await this.Countdown(600);
        }
      } else {
        this.log('Chờ 10 phút trước khi bắt đầu vòng mới...', 'info');
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