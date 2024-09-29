const fs = require('fs');
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');
const path = require('path');

class Coub {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://coub.com",
            "Referer": "https://coub.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site"
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async makeRequest(method, url, headers, data = null) {
        let retryCount = 0;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const config = { headers, method };
                if (method.toUpperCase() === 'GET' && data) {
                    config.params = data;
                } else if (method.toUpperCase() === 'POST') {
                    config.data = data;
                }
                const response = await axios(url, config);
                if (response.status >= 200 && response.status < 300) {
                    return response.data;
                } else if (response.status >= 500) {
                    if (retryCount >= 3) {
                        this.log(`Status Code : ${response.status} | Server Down`, 'error');
                        return null;
                    }
                    retryCount++;
                } else {
                    this.log(`Status Code : ${response.status}`, 'warning');
                    break;
                }
            } catch (error) {
                console.log(error);
                this.log(`Error: ${error.message}`, 'error');
                if (retryCount >= 3) return null;
                retryCount++;
            }
        }
    }

    async getRewards(token, xTgAuth) {
        const headers = { 
            ...this.headers, 
            authorization: `Bearer ${token}`,
            "x-tg-authorization": xTgAuth
        };
        const url = "https://rewards.coub.com/api/v2/get_user_rewards";
        try {
            return await this.makeRequest('GET', url, headers);
        } catch (error) {
            this.log(`Không thể đọc được phần thưởng. Error: ${error.message}`, 'error');
            return null;
        }
    }

    async claimTask(token, xTgAuth, taskId, taskTitle) {
        const headers = { 
            ...this.headers, 
            authorization: `Bearer ${token}`,
            "x-tg-authorization": xTgAuth
        };
        const url = "https://rewards.coub.com/api/v2/complete_task";
        const params = { task_reward_id: taskId };
        try {
            const response = await this.makeRequest('GET', url, headers, params);
            if (response) {
                this.log(`Nhiệm vụ ${taskTitle} Hoàn thành`, 'success');
                return response;
            } else {
                this.log(`Nhiệm vụ ${taskTitle} Thất bại`, 'warning');
                return null;
            }
        } catch (error) {
            this.log(`Nhiệm vụ ${taskTitle} Không thể nhận thưởng | error: ${error.message}`, 'error');
            return null;
        }
    }

    loadTask() {
        try {
            return JSON.parse(fs.readFileSync('task.json', 'utf8'));
        } catch (error) {
            this.log(`Không thể đọc nhiệm vụ: ${error.message}`, 'error');
            return [];
        }
    }

    async main() {
        try {
            const tokenFile = path.join(__dirname, 'token.txt');
            const dataFile = path.join(__dirname, 'data.txt');
            
            if (!fs.existsSync(tokenFile) || !fs.existsSync(dataFile)) {
                throw new Error(`không tìm thấy file token.txt hoặc data.txt`);
            }
    
            const tokens = fs.readFileSync(tokenFile, 'utf8').split('\n').filter(Boolean);
            const data = fs.readFileSync(dataFile, 'utf8').split('\n').filter(Boolean);
    
            if (tokens.length === 0 || data.length === 0) {
                throw new Error('Không tìm thấy dữ liệu hợp lệ trong token.txt hoặc data.txt');
            }
            const tasks = this.loadTask();
            while (true) {
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i].trim();
                    const xTgAuth = data[i].trim();
    
                    this.log(`========== Tài khoản ${i + 1} ==========`, 'custom');
    
                    const listId = [];
                    const dataReward = await this.getRewards(token, xTgAuth);
                    if (dataReward) {
                        dataReward.forEach(data => {
                            const id = data.id || 0;
                            listId.push(id);
                        });
                    } else {
                        this.log(`Không thể lấy phần thưởng cho tài khoản ${i + 1}`, 'warning');
                    }
    
                    for (const task of tasks) {
                        const id = task.id;
                        if (listId.includes(id)) {
                            this.log(`${task.title} Hoàn thành...`, 'success');
                        } else {
                            this.log(`Làm nhiệm vụ ${task.title.yellow}`, 'info');
                            await this.claimTask(token, xTgAuth, task.id, task.title);
                        }
                    }
                }
    
                const delay = 24 * (3600 + Math.floor(Math.random() * 51));
                await this.countdown(delay);
            }
        } catch (error) {
            console.log(error);
            this.log(`Lỗi rồi: ${error.message}`, 'error');
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`, 'error');
            }
        }
    }
}

const coub = new Coub();
coub.main().catch(error => coub.log(`Unhandled error: ${error.message}`, 'error'));