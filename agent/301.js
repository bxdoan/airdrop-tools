const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class AgentAPI {
    constructor() {
        this.baseURL = 'https://api.agent301.org';
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

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            const timestamp = new Date().toLocaleTimeString();
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
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
            return 'Unknown';
        } catch (error) {
            this.log(`Không đọc được dữ liệu: ${error.message}`, 'error');
            return 'Unknown';
        }
    }

    async getMe(authorization) {
        const url = `${this.baseURL}/getMe`;
        const payload = {"referrer_id": 376905749};
        
        try {
            const response = await axios.post(url, payload, { headers: this.headers(authorization) });
            return response.data;
        } catch (error) {
            this.log(`Lỗi lấy thông tin người dùng: ${error.message}`, 'error');
            throw error;
        }
    }

    async completeTask(authorization, taskType, taskTitle, currentCount = 0, maxCount = 1) {
        const url = `${this.baseURL}/completeTask`;
        const payload = { "type": taskType };
        
        try {
            const response = await axios.post(url, payload, { headers: this.headers(authorization) });
            const result = response.data.result;
            this.log(`Làm nhiệm vụ ${taskTitle.yellow} ${currentCount + 1}/${maxCount} thành công | Phần thưởng ${result.reward.toString().magenta} | Balance ${result.balance.toString().magenta}`, 'custom');
            return result;
        } catch (error) {
            this.log(`Làm nhiệm vụ ${taskTitle} không thành công: ${error.message}`, 'error');
        }
    }

    async processTasks(authorization, tasks) {
        const unclaimedTasks = tasks.filter(task => !task.is_claimed && !['nomis2', 'boost', 'invite_3_friends'].includes(task.type));
        
        if (unclaimedTasks.length === 0) {
            this.log("Không còn nhiệm vụ chưa hoàn thành.", 'warning');
            return;
        }
    
        for (const task of unclaimedTasks) {
            if (task.max_count) {
                const remainingCount = task.max_count - (task.count || 0);
                for (let i = 0; i < remainingCount; i++) {
                    await this.completeTask(authorization, task.type, task.title, i, remainingCount);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await this.completeTask(authorization, task.type, task.title);
            }
        }
    }    

    async spinWheel(authorization) {
        const url = `${this.baseURL}/wheel/spin`;
        const payload = {};
        
        try {
            const response = await axios.post(url, payload, { headers: this.headers(authorization) });
            const result = response.data.result;
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

    async spinAllTickets(authorization, initialTickets) {
        let tickets = initialTickets;
        while (tickets > 0) {
            try {
                const result = await this.spinWheel(authorization);
                tickets = result.tickets;
            } catch (error) {
                this.log(`Lỗi khi spin: ${error.message}`, 'error');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('Đã sử dụng hết tickets.', 'warning');
    }
    
    async wheelLoad(authorization) {
        const url = `${this.baseURL}/wheel/load`;
        const payload = {};
        
        try {
            const response = await axios.post(url, payload, { headers: this.headers(authorization) });
            return response.data.result;
        } catch (error) {
            this.log(`Lỗi khi load wheel: ${error.message}`, 'error');
        }
    }

    async wheelTask(authorization, type) {
        const url = `${this.baseURL}/wheel/task`;
        const payload = { type };
        
        try {
            const response = await axios.post(url, payload, { headers: this.headers(authorization) });
            return response.data.result;
        } catch (error) {
            this.log(`Lỗi khi thực hiện nhiệm vụ ${type}: ${error.message}`, 'error');
        }
    }

    async handleWheelTasks(authorization) {
        try {
            let wheelData = await this.wheelLoad(authorization);
            const currentTimestamp = Math.floor(Date.now() / 1000);

            if (currentTimestamp > wheelData.tasks.daily) {
                const dailyResult = await this.wheelTask(authorization, 'daily');
                const nextDaily = DateTime.fromSeconds(dailyResult.tasks.daily).toRelative();
                this.log(`Claim daily ticket thành công. Lần claim tiếp theo: ${nextDaily}`, 'success');
                wheelData = dailyResult;
            } else {
                const nextDaily = DateTime.fromSeconds(wheelData.tasks.daily).toRelative();
                this.log(`Thời gian claim daily ticket tiếp theo: ${nextDaily}`, 'info');
            }

            if (!wheelData.tasks.bird) {
                const birdResult = await this.wheelTask(authorization, 'bird');
                this.log('Làm nhiệm vụ ticket bird thành công', 'success');
                wheelData = birdResult;
            }

            let hourCount = wheelData.tasks.hour.count;
            while (hourCount < 5 && currentTimestamp > wheelData.tasks.hour.timestamp) {
                const hourResult = await this.wheelTask(authorization, 'hour');
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

    async main() {
        const dataFile = 'data.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < data.length; no++) {
                const authorization = data[no];
                const firstName = this.extractFirstName(authorization);

                try {
                    console.log(`========== Tài khoản ${no + 1} | ${firstName} ==========`.green);
                    const userInfo = await this.getMe(authorization);
                    this.log(`Balance: ${userInfo.result.balance.toString().white}`, 'success');
                    this.log(`Tickets: ${userInfo.result.tickets.toString().white}`, 'success');
                    
                    await this.processTasks(authorization, userInfo.result.tasks);
                    await this.handleWheelTasks(authorization);

                    if (userInfo.result.tickets > 0) {
                        this.log('Bắt đầu spin wheel...', 'info');
                        await this.spinAllTickets(authorization, userInfo.result.tickets);
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