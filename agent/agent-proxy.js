const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { DateTime } = require('luxon');

class AgentAPI {
    constructor() {
        this.baseURL = 'https://api.agent301.org';
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        try {
            return fs.readFileSync('./../data/proxy.txt', 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
        } catch (error) {
            this.log(`Lỗi khi đọc file proxy: ${error.message}`, 'error');
            return [];
        }
    }

    headers(authorization) {
        return {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Authorization': authorization,
            'Content-Type': 'application/json',
            'Origin': 'https://telegram.agent301.org',
            'Referer': 'https://telegram.agent301.org/',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logTypes = {
            success: msg => console.log(`[${timestamp}] [*] ${msg}`.green),
            custom: msg => console.log(`[${timestamp}] [*] ${msg}`),
            error: msg => console.log(`[${timestamp}] [!] ${msg}`.red),
            warning: msg => console.log(`[${timestamp}] [*] ${msg}`.yellow),
            info: msg => console.log(`[${timestamp}] [*] ${msg}`.blue)
        };
        (logTypes[type] || logTypes.info)(msg);
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${new Date().toLocaleTimeString()}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        console.log('');
    }

    extractFirstName(authorization) {
        try {
            const params = new URLSearchParams(authorization);
            const userString = params.get('user');
            if (userString) {
                const userObject = JSON.parse(decodeURIComponent(userString));
                return userObject.first_name;
            }
        } catch (error) {
            this.log(`Không đọc được dữ liệu: ${error.message}`, 'error');
        }
        return 'Unknown';
    }

    async makeRequest(method, url, payload, authorization, proxy, retries = 3) {
        const proxyAgent = new HttpsProxyAgent(proxy);
        const config = {
            method,
            url,
            data: payload,
            headers: this.headers(authorization),
            httpsAgent: proxyAgent
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios(config);
                return response.data;
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                this.log(`Lỗi request (lần thử ${attempt}/${retries}): ${error.message}. Đang thử lại...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async checkProxyIP(proxy) {
        try {
            const response = await this.makeRequest('GET', 'https://api.ipify.org?format=json', {}, '', proxy);
            return response.ip;
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async getMe(authorization, proxy) {
        try {
            return await this.makeRequest('POST', `${this.baseURL}/getMe`, {"referrer_id": 376905749}, authorization, proxy);
        } catch (error) {
            this.log(`Lỗi lấy thông tin người dùng: ${error.message}`, 'error');
            throw error;
        }
    }

    async completeTask(authorization, taskType, taskTitle, currentCount = 0, maxCount = 1, proxy) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/completeTask`, { "type": taskType }, authorization, proxy);
            const result = response.result;
            this.log(`Làm nhiệm vụ ${taskTitle.yellow} ${currentCount + 1}/${maxCount} thành công | Phần thưởng ${result.reward.toString().magenta} | Balance ${result.balance.toString().magenta}`, 'custom');
            return result;
        } catch (error) {
            this.log(`Làm nhiệm vụ ${taskTitle} không thành công: ${error.message}`, 'error');
        }
    }

    async getTasks(authorization, proxy) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/getTasks`, {}, authorization, proxy);
            return response.result.data;
        } catch (error) {
            this.log(`Lỗi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
            throw error;
        }
    }

    async processTasks(authorization, proxy) {
        try {
            const tasks = await this.getTasks(authorization, proxy);
            const unclaimedTasks = tasks.filter(task => !task.is_claimed && !['nomis2', 'boost', 'invite_3_friends'].includes(task.type));

            if (unclaimedTasks.length === 0) {
                this.log("Không còn nhiệm vụ chưa hoàn thành.", 'warning');
                return;
            }

            for (const task of unclaimedTasks) {
                const remainingCount = task.max_count ? task.max_count - (task.count || 0) : 1;
                for (let i = 0; i < remainingCount; i++) {
                    await this.completeTask(authorization, task.type, task.title, i, remainingCount, proxy);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            this.log(`Lỗi xử lý nhiệm vụ: ${error.message}`, 'error');
        }
    }

    async spinWheel(authorization, proxy) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/spin`, {}, authorization, proxy);
            const result = response.result;
            this.log(`Spin thành công: nhận được ${result.reward}`, 'success');
            this.log(`* Balance : ${result.balance}`);
            this.log(`* Toncoin : ${result.toncoin}`);
            this.log(`* Notcoin : ${result.notcoin}`);
            this.log(`* Tickets : ${result.tickets}`);
            return result;
        } catch (error) {
            this.log(`Lỗi khi spin: ${error.message}`, 'error');
            throw error;
        }
    }

    async spinAllTickets(authorization, initialTickets, proxy) {
        let tickets = initialTickets;
        while (tickets > 0) {
            try {
                const result = await this.spinWheel(authorization, proxy);
                tickets = result.tickets;
            } catch (error) {
                this.log(`Lỗi khi spin: ${error.message}`, 'error');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('Đã sử dụng hết tickets.', 'warning');
    }

    async wheelLoad(authorization, proxy) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/load`, {}, authorization, proxy);
            return response.result;
        } catch (error) {
            this.log(`Lỗi khi load wheel: ${error.message}`, 'error');
            throw error;
        }
    }

    async wheelTask(authorization, type, proxy) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/task`, { type }, authorization, proxy);
            return response.result;
        } catch (error) {
            this.log(`Lỗi khi thực hiện nhiệm vụ ${type}: ${error.message}`, 'error');
            throw error;
        }
    }

    async handleWheelTasks(authorization, proxy) {
        try {
            let wheelData = await this.wheelLoad(authorization, proxy);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            if (currentTimestamp > wheelData.tasks.daily) {
                const dailyResult = await this.wheelTask(authorization, 'daily', proxy);
                const nextDaily = DateTime.fromSeconds(dailyResult.tasks.daily).toRelative();
                this.log(`Claim daily ticket thành công. Lần claim tiếp theo: ${nextDaily}`, 'success');
                wheelData = dailyResult;
            } else {
                const nextDaily = DateTime.fromSeconds(wheelData.tasks.daily).toRelative();
                this.log(`Thời gian claim daily ticket tiếp theo: ${nextDaily}`, 'info');
            }

            if (!wheelData.tasks.bird) {
                const birdResult = await this.wheelTask(authorization, 'bird', proxy);
                this.log('Làm nhiệm vụ ticket bird thành công', 'success');
                wheelData = birdResult;
            }

            let hourCount = wheelData.tasks.hour.count;
            while (hourCount < 5 && currentTimestamp > wheelData.tasks.hour.timestamp) {
                const hourResult = await this.wheelTask(authorization, 'hour', proxy);
                hourCount = hourResult.tasks.hour.count;
                this.log(`Làm nhiệm vụ hour thành công. Lần thứ ${hourCount}/5`, 'success');
                wheelData = hourResult;
            }

            if (hourCount === 0 && currentTimestamp < wheelData.tasks.hour.timestamp) {
                const nextHour = DateTime.fromSeconds(wheelData.tasks.hour.timestamp).toRelative();
                this.log(`Thời gian xem video claim ticket tiếp theo: ${nextHour}`, 'info');
            }

            return wheelData;
        } catch (error) {
            this.log(`Lỗi khi xử lý wheel tasks: ${error.message}`, 'error');
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

    async main() {
        const dataFile = './../data/agent.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < data.length; no++) {
                const authorization = data[no];
                const proxyIndex = no % this.proxies.length;
                const proxy = this.formatProxy(this.proxies[proxyIndex]);
                const firstName = this.extractFirstName(authorization);

                try {
                    let proxyIP = 'Unknown';
                    try {
                        proxyIP = await this.checkProxyIP(proxy);
                    } catch (error) {
                        this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
                        continue;
                    }

                    console.log(`========== Tài khoản ${no + 1}/${data.length} | ${firstName} | ip: ${proxyIP} ==========`.green);
                    const userInfo = await this.getMe(authorization, proxy);
                    this.log(`Balance: ${userInfo.result.balance.toString().white}`, 'success');
                    this.log(`Tickets: ${userInfo.result.tickets.toString().white}`, 'success');

                    await this.processTasks(authorization, proxy);
                    await this.handleWheelTasks(authorization, proxy);

                    if (userInfo.result.tickets > 0) {
                        this.log('Bắt đầu spin wheel...', 'info');
                        await this.spinAllTickets(authorization, userInfo.result.tickets, proxy);
                    }
                } catch (error) {
                    this.log(`Lỗi xử lý tài khoản ${no + 1}: ${error.message}`, 'error');
                }
            }

            await this.waitWithCountdown(60 * 60);
        }
    }
}

if (require.main === module) {
    const agentAPI = new AgentAPI();
    agentAPI.main().catch(err => {
        agentAPI.log(err.message, 'error');
        process.exit(1);
    });
}