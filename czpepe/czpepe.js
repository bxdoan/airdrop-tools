const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class GameBot {
  constructor() {
    this.queryId = null;
    this.userInfo = null;
    this.reference = null;
    this.telegram_id = null;
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

  async getNewToken() {
    const url = 'https://bot.czpepe.lol/api/join/';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post(url, this.queryId, { headers: await this.headers() });
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

  async getLeaderboard() {
    try {
      const response = await axios.get(
          `https://bot.czpepe.lol/api/leaderboard/?user_id=${this.telegram_id}`,
          {headers: await this.headers(this.token)}
      );
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

  async getTasks() {
    try {
      const response = await axios.get(
          `https://bot.czpepe.lol/api/tasks/?user_id=${this.telegram_id}&reference=${this.reference}`,
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

  async main() {
    const dataFile = path.join(__dirname, './../data/czpepe.txt');
    const queryIds = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    const hoinhiemvu = 'y';

    while (true) {
      for (let i = 0; i < queryIds.length; i++) {
        this.queryId = queryIds[i];

        const token = await this.getNewToken();
        if (!token) {
          this.log('Không thể lấy token, bỏ qua tài khoản này', 'error');
          continue;
        }
        this.log(`========== Tài khoản ${i + 1} | ${this.userInfo.username} ==========`, 'success');

        const tasks = await this.getTasks();
        const leaderboard = await this.getLeaderboard();
        if (leaderboard) {
            this.log(`Xếp hạng: ${leaderboard.me.position} | Điểm: ${leaderboard.me.score}`, 'success');
        }
        const rewards = await this.getRewards();

        if (tasks) {
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

        await this.Countdown(86400);

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