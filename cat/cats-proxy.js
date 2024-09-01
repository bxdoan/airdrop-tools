const fs = require('fs');
const axios = require('axios');
const { DateTime } = require('luxon');
const path = require('path');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class CatsAPI {
    constructor() {
        this.baseURL = 'https://cats-backend-cxblew-prod.up.railway.app';
        this.listProxies = [];
        this.indexProxies = 0;
    }

    headers(authorization) {
        return {
            'accept': '*/*',
            'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'authorization': `tma ${authorization}`,
            'content-type': 'application/json',
            'origin': 'https://cats-frontend.tgapps.store',
            'referer': 'https://cats-frontend.tgapps.store/',
            'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
        };
    }

    async makeRequest(method, url, data, headers, proxy) {
        const httpsAgent = new HttpsProxyAgent(proxy);
        return axios({
            method,
            url,
            data,
            headers,
            httpsAgent,
        });
    }

    async createUser(authorization, referralCode, proxy) {
        const url = `${this.baseURL}/user/create?referral_code=${referralCode}`;
        const headers = this.headers(authorization);
        return this.makeRequest('post', url, {}, headers, proxy);
    }

    async getUserInfo(authorization, proxy) {
        const url = `${this.baseURL}/user`;
        const headers = this.headers(authorization);
        return this.makeRequest('get', url, null, headers, proxy);
    }

    async getTasks(authorization, proxy) {
        const url = `${this.baseURL}/tasks/user?group=cats`;
        const headers = this.headers(authorization);
        return this.makeRequest('get', url, null, headers, proxy);
    }

    async completeTask(authorization, taskId, proxy) {
        const url = `${this.baseURL}/tasks/${taskId}/complete`;
        const headers = this.headers(authorization);
        return this.makeRequest('post', url, {}, headers, proxy);
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    formatProxy(proxy) {
        // from ip:port:user:pass to http://user:pass@ip:port
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

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async completeTasks(authorization, proxy) {
        try {
            const tasksResponse = await this.getTasks(authorization, proxy);
            const incompleteTasks = tasksResponse.data.tasks.filter(task => !task.completed);
            
            for (const task of incompleteTasks) {
                try {
                    const completeResponse = await this.completeTask(authorization, task.id, proxy);
                    if (completeResponse.data.success) {
                        this.log(`Làm nhiệm vụ "${task.title}" thành công`, 'success');
                    }
                } catch (error) {
//                    this.log(`Lỗi khi làm nhiệm vụ "${task.title}": ${error.message}`, 'error');
                }
            }
            this.log(`Đã làm hết các nhiệm vụ, có một số nhiệm vụ sẽ không làm được!`, 'success');
        } catch (error) {
            this.log(`Lỗi khi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
        }
    }

    async main() {
        const referralCode = 'iCkXghxaEvb_qo6M_CNEy'; // refcode

        while (true) {
            const dataFile = path.join(__dirname, './../data/cats.txt');
            const data = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);

            const proxyFile = path.join(__dirname, './../data/proxy.txt');
            this.listProxies = fs.readFileSync(proxyFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
            for (let no = 0; no < data.length; no++) {
                const authorization = data[no];
                const proxy = this.formatProxy(this.getProxy());

                let proxyIP = 'Unknown';
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
                    continue;
                }

                // try {
                //     const response = await this.createUser(authorization, referralCode, proxy);
                //     this.log('Tạo user thành công!', 'success');
                // } catch (error) {
                //     if (error.response && error.response.data && error.response.data.message.includes('already exist')) {
                //         this.log('Tài khoản đã được đăng ký', 'warning');
                //     } else {
                //         this.log(`Lỗi khi tạo user: ${error.message}`, 'error');
                //         continue;
                //     }
                // }

                try {
                    const userInfoResponse = await this.getUserInfo(authorization, proxy);
                    const userInfo = userInfoResponse.data;
                    console.log(`========== Tài khoản ${no + 1} | ${userInfo.firstName} | ip: ${proxyIP} ==========`.green);
                    this.log(`Balance: ${userInfo.totalRewards}`);
                    this.log(`Ref code: ${userInfo.referrerCode}`);

                    await this.completeTasks(authorization, proxy);
                } catch (error) {
                    this.log(`Lỗi khi xử lý tài khoản: ${error.message}`, 'error');
                }
            }

            await this.waitWithCountdown(15 * 60);
        }
    }
}

if (require.main === module) {
    const catsAPI = new CatsAPI();
    catsAPI.main().catch(err => {
        catsAPI.log(err.message, 'error');
        process.exit(1);
    });
}