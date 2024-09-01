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
    this.userInfo = null;
    this.reference = null;
    this.telegram_id = null;
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

  async headers(token = null) {
    const headers = {
      'authority': 'bot.czpepe.lol',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'text/plain;charset=UTF-8',
      'origin': 'https://bot.czpepe.lol/',
      'referer': 'https://bot.czpepe.lol/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      'sec-ch-ua': `" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"`,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': `"Windows"`,
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'sec-fetch-site': 'same-origin',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getNewToken(proxy) {
    const url = 'https://bot.czpepe.lol/api/join/';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const headers = await this.headers();
        const config = {
          url,
          method: 'post',
          headers,
          data: this.queryId
        };
        const response = await this.requestWithProxy(config, proxy);
        if (response.status === 200) {
          this.userInfo = response.data;
          this.reference = response.data.reference;
          this.telegram_id = response.data.telegram_id;
          return this.userInfo;
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

  async Countdown(seconds) {
    for (let i = Math.floor(seconds); i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async getLeaderboard(proxy) {
    const url = `https://bot.czpepe.lol/api/leaderboard/?user_id=${this.telegram_id}`
    try {
      const headers = await this.headers();
      const config = {
        url,
        method: 'get',
        headers,
      }
      const response = await this.requestWithProxy(config, proxy);
      if (response.status === 200) {
        return response.data;
      } else {
        this.log('Không thể lấy bảng xếp hạng', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể lấy bảng xếp hạng: ${error.message}`, 'error');
      return null
    }
  }

  async getTasks(proxy) {
    const url = `https://bot.czpepe.lol/api/tasks/?user_id=${this.telegram_id}&reference=${this.reference}`
    try {
      const headers = await this.headers();
      const config = {
        url,
        method: 'post',
        headers,
      }
      const response = await this.requestWithProxy(config, proxy);
      if (response.status === 200) {
        return response.data;
      } else {
        this.log('Không thể lấy thông tin nhiệm vụ', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể lấy thông tin nhiệm vụ: ${error.message}`, 'error');
      return null;
    }
  }

  async getRewards() {
    try {
      const response = await axios.get(
          `https://bot.czpepe.lol/api/rewards/?user_id=${this.telegram_id}`,
          {headers: await this.headers(this.token)});
      if (response.status === 200) {
        return response.data;
      } else {
        this.log('Không thể lấy thông tin nhiệm vụ', 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể lấy thông tin nhiệm vụ: ${error.message}`, 'error');
      return null;
    }
  }

  async doTask(taskId, slug) {
    try {
      const response = await axios.post(
          `https://bot.czpepe.lol/api/tasks/verify/?task=${slug}&user_id=${this.telegram_id}&reference=${this.reference}`,
          {headers: await this.headers(this.token)}
      );
      if (response.status === 200) {
        return response.data;
      } else {
        this.log(`Không thể hoàn thành nhiệm vụ ${taskId}`, 'error');
        return null;
      }
    } catch (error) {
      this.log(`Không thể hoàn thành nhiệm vụ ${taskId}: ${error.message}`, 'error');
      return null;
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

  async requestWithProxy(config, proxy) {
      const agent = new HttpsProxyAgent(proxy);
      return axios({ ...config, httpsAgent: agent });
  }

  formatProxy(proxy) {
      // from ip:port:user:pass to http://user:pass@ip:port
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

  async main() {

    while (true) {
      const proxyFile = path.join(__dirname, './../data/proxy.txt');
      this.listProxies = fs.readFileSync(proxyFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);
        const dataFile = path.join(__dirname, './../data/czpepe.txt');
      const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];
        const proxy = this.formatProxy(this.getProxy());

        let proxyIP = '';
        try {
            proxyIP = await this.checkProxyIP(proxy);
        } catch (error) {
            console.error('Lỗi khi kiểm tra IP của proxy:', error);
        }

        const token = await this.getNewToken(proxy);
        if (!token) {
          this.log(`Không thể lấy token, bỏ qua tài khoản ${i + 1} này`, 'error');
          continue;
        }
        this.log(`========== Tài khoản ${i + 1} | ${this.userInfo.username} | ${proxyIP} =======`, 'success');

        const tasks = await this.getTasks(proxy);
        const leaderboard = await this.getLeaderboard(proxy);
        if (leaderboard) {
          this.log(`Xếp hạng: ${leaderboard.me.position} | Điểm: ${leaderboard.me.score}`, 'success');
        }

        if (tasks) {
          // count tasks have task.complete = false
          let count = 0;
          for (const task of tasks) {
            if (!task.complete) {
                count++;
            }
          }
          this.log(`Số nhiệm vụ chưa hoàn thành: ${count}`, 'success');

          // loop and doTask
          for (const task of tasks) {
            if (!task.complete) {
              const result = await this.doTask(task.id, task.slug);
              if (result) {
                this.log(`Làm nhiệm vụ ${task.id}: ${task.slug.yellow} được ${task.reward}`.green);
              }
            }
          }
        }

        this.log(`========== Tài khoản ${i + 1} | ${this.userInfo.username} thành công ==========`, 'success');
      }

      await this.Countdown(6400);

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