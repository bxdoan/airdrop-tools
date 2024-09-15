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

    async makeRequest(method, url, payload, authorization, retries = 3) {
        const config = {
            method,
            url,
            data: payload,
            headers: this.headers(authorization)
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

    async getMe(authorization) {
        try {
            return await this.makeRequest('POST', `${this.baseURL}/getMe`, {"referrer_id": 376905749}, authorization);
        } catch (error) {
            this.log(`Lỗi lấy thông tin người dùng: ${error.message}`, 'error');
            throw error;
        }
    }

    async completeTask(authorization, taskType, taskTitle, currentCount = 0, maxCount = 1) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/completeTask`, { "type": taskType }, authorization);
            const result = response.result;
            this.log(`Làm nhiệm vụ ${taskTitle.yellow} ${currentCount + 1}/${maxCount} thành công | Phần thưởng ${result.reward.toString().magenta} | Balance ${result.balance.toString().magenta}`, 'custom');
            return result;
        } catch (error) {
            this.log(`Làm nhiệm vụ ${taskTitle} không thành công: ${error.message}`, 'error');
        }
    }

    async getTasks(authorization) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/getTasks`, {}, authorization);
            return response.result.data;
        } catch (error) {
            this.log(`Lỗi lấy danh sách nhiệm vụ: ${error.message}`, 'error');
            throw error;
        }
    }

    async processTasks(authorization) {
        try {
            const tasks = await this.getTasks(authorization);
            const unclaimedTasks = tasks.filter(task => !task.is_claimed && !['nomis2', 'boost', 'invite_3_friends'].includes(task.type));

            if (unclaimedTasks.length === 0) {
                this.log("Không còn nhiệm vụ chưa hoàn thành.", 'warning');
                return;
            }

            for (const task of unclaimedTasks) {
                const remainingCount = task.max_count ? task.max_count - (task.count || 0) : 1;
                for (let i = 0; i < remainingCount; i++) {
                    await this.completeTask(authorization, task.type, task.title, i, remainingCount);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            this.log(`Lỗi xử lý nhiệm vụ: ${error.message}`, 'error');
        }
    }

    async spinWheel(authorization) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/spin`, {}, authorization);
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

    async spinAllTickets(authorization, initialTickets) {
        let tickets = initialTickets;
        while (tickets > 0) {
            try {
                const result = await this.spinWheel(authorization);
                tickets = result.tickets;
            } catch (error) {
                this.log(`Lỗi khi spin: ${error.message}`, 'error');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('Đã sử dụng hết tickets.', 'warning');
    }

    async wheelLoad(authorization) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/load`, {}, authorization);
            return response.result;
        } catch (error) {
            this.log(`Lỗi khi load wheel: ${error.message}`, 'error');
            throw error;
        }
    }

    async wheelTask(authorization, type) {
        try {
            const response = await this.makeRequest('POST', `${this.baseURL}/wheel/task`, { type }, authorization);
            return response.result;
        } catch (error) {
            this.log(`Lỗi khi thực hiện nhiệm vụ ${type}: ${error.message}`, 'error');
            throw error;
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

                    await this.processTasks(authorization);
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