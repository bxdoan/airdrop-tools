const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const { DateTime } = require('luxon');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

const maxThreads = 10; // Số luồng tối đa chạy đồng thời

class GLaDOS {
    constructor() {
        this.authUrl = 'https://major.glados.app/api/auth/tg/';
        this.userInfoUrl = 'https://major.glados.app/api/users/';
        this.streakUrl = 'https://major.glados.app/api/user-visits/streak/';
        this.visitUrl = 'https://major.glados.app/api/user-visits/visit/';
        this.rouletteUrl = 'https://major.glados.app/api/roulette/';
        this.holdCoinsUrl = 'https://major.glados.app/api/bonuses/coins/';
        this.tasksUrl = 'https://major.glados.app/api/tasks/';
        this.swipeCoinUrl = 'https://major.glados.app/api/swipe_coin/';
        this.durovUrl = 'https://major.bot/api/durov/';
        this.durovPayloadUrl = 'https://raw.githubusercontent.com/dancayairdrop/blum/main/durov.json';
        this.accountIndex = 0;
        this.proxyIP = null;
    }

    headers(token = null) {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://major.glados.app/reward',
            'Referer': 'https://major.glados.app/',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async randomDelay() {
        const delay = Math.floor(Math.random() * (1000 - 500 + 1)) + 500; // Random delay between 500ms and 1000ms
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const accountPrefix = `[Tài khoản ${this.accountIndex + 1}]`;
        let logMessage = '';

        switch(type) {
            case 'success':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
                break;
            case 'error':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
                break;
            case 'warning':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
                break;
            default:
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
        }

        console.log(`${timestamp} ${logMessage}`);
        await this.randomDelay();
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            process.stdout.write(`\r[*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
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

    async makeRequest(method, url, data = null, token = null, proxy) {
        const headers = this.headers(token);
        const proxyAgent = new HttpsProxyAgent(proxy);
        const config = {
            method,
            url,
            headers,
            httpsAgent: proxyAgent,
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                return error.response.data;
            }
            throw error;
        }
    }

    async authenticate(init_data, proxy) {
        const payload = { init_data };
        return this.makeRequest('post', this.authUrl, payload, null, proxy);
    }

    async getUserInfo(userId, token, proxy) {
        return this.makeRequest('get', `${this.userInfoUrl}${userId}/`, null, token, proxy);
    }

    async getStreak(token, proxy) {
        return this.makeRequest('get', this.streakUrl, null, token, proxy);
    }

    async postVisit(token, proxy) {
        return this.makeRequest('post', this.visitUrl, {}, token, proxy);
    }

    async spinRoulette(token, proxy) {
        return this.makeRequest('post', this.rouletteUrl, {}, token, proxy);
    }

    async holdCoins(token, proxy) {
        const coins = Math.floor(Math.random() * (950 - 900 + 1)) + 900;
        const payload = { coins };
        const result = await this.makeRequest('post', this.holdCoinsUrl, payload, token, proxy);
        if (result.success) {
            await this.log(`HOLD coin thành công, nhận ${coins} sao`, 'success');
        } else if (result.detail && result.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(result.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            await this.log(`HOLD coin không thành công, cần mời thêm ${result.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`, 'warning');
        } else {
            await this.log(`HOLD coin không thành công`, 'error');
        }
        return result;
    }

    async swipeCoin(token, proxy) {
        const getResponse = await this.makeRequest('get', this.swipeCoinUrl, null, token, proxy);
        if (getResponse.success) {
            const coins = Math.floor(Math.random() * (1300 - 1000 + 1)) + 1000;
            const payload = { coins };
            const result = await this.makeRequest('post', this.swipeCoinUrl, payload, token, proxy);
            if (result.success) {
                await this.log(`Swipe coin thành công, nhận ${coins} sao`, 'success');
            } else {
                await this.log(`Swipe coin không thành công`, 'error');
            }
            return result;
        } else if (getResponse.detail && getResponse.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(getResponse.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            await this.log(`Swipe coin không thành công, cần mời thêm ${getResponse.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`, 'warning');
        } else {
            await this.log(`Không thể lấy thông tin swipe coin`, 'error');
        }
        return getResponse;
    }

    async getDailyTasks(token, proxy) {
        const tasks = await this.makeRequest('get', `${this.tasksUrl}?is_daily=false`, null, token, proxy);
        if (Array.isArray(tasks)) {
            return tasks.map(task => ({ id: task.id, title: task.title }));
        } else {
            return null;
        }
    }

    async completeTask(token, task, proxy) {
        const payload = { task_id: task.id };
        const result = await this.makeRequest('post', this.tasksUrl, payload, token, proxy);
        if (result.is_completed) {
            await this.log(`Làm nhiệm vụ ${task.id}: ${task.title} .. trạng thái: thành công`, 'success');
        }
        return result;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getDurovPayload() {
        try {
            const response = await axios.get(this.durovPayloadUrl);
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async handleDurovTask(token, proxy) {
        try {
            const getResult = await this.makeRequest('get', this.durovUrl, null, token, proxy);

            if (getResult.detail && getResult.detail.blocked_until) {
                const blockedTime = DateTime.fromSeconds(getResult.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
                await this.log(`Tìm câu đố Durov không thành công, cần mời thêm ${getResult.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`, 'warning');
                return;
            }

            if (!getResult.success) {
                return;
            }

            const payloadData = await this.getDurovPayload();
            if (!payloadData) {
                return;
            }

            const today = DateTime.now().setZone('system');
            const payloadDate = DateTime.fromFormat(payloadData.date, 'dd/MM/yyyy');

            if (today.hasSame(payloadDate, 'day')) {
                const payload = payloadData.tasks[0];
                const postResult = await this.makeRequest('post', this.durovUrl, payload, token, proxy);

                if (postResult.correct && JSON.stringify(postResult.correct) === JSON.stringify(Object.values(payload))) {
                    await this.log('Tìm câu đố Durov thành công', 'success');
                } else {
                    await this.log('Tìm câu đố Durov không thành công', 'error');
                }
            } else if (today > payloadDate) {
                await this.log('Chưa có combo Durov ngày mới, cần réo tên @hung96 để cập nhật combo', 'warning');
            } else {
                await this.log('Payload date is in the future. Please check the date format.', 'warning');
            }
        } catch (error) {
            await this.log(`Lỗi rồi: ${error.message}`, 'error');
        }
    }

    async processAccount(accountData, proxy) {
        const { init_data, index } = accountData;
        this.accountIndex = index;
        try {
            this.proxyIP = await this.checkProxyIP(proxy);
        } catch (error) {
            await this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
        }

        try {
            const authResult = await this.authenticate(init_data, proxy);
            if (authResult) {
                const { access_token, user } = authResult;
                const { id, first_name } = user;

                await this.log(`Tài khoản ${first_name}`, 'info');

                const userInfo = await this.getUserInfo(id, access_token, proxy);
                if (userInfo) {
                    await this.log(`Số sao đang có: ${userInfo.rating}`, 'success');
                }

                const streakInfo = await this.getStreak(access_token, proxy);
                if (streakInfo) {
                    await this.log(`Đã điểm danh ${streakInfo.streak} ngày!`, 'success');
                }

                const visitResult = await this.postVisit(access_token, proxy);
                if (visitResult) {
                    if (visitResult.is_increased) {
                        await this.log(`Điểm danh thành công ngày ${visitResult.streak}`, 'success');
                    } else {
                        await this.log(`Đã điểm danh trước đó. Streak hiện tại: ${visitResult.streak}`, 'warning');
                    }
                }

                const rouletteResult = await this.spinRoulette(access_token, proxy);
                if (rouletteResult) {
                    if (rouletteResult.rating_award > 0) {
                        await this.log(`Spin thành công, nhận được ${rouletteResult.rating_award} sao`, 'success');
                    } else if (rouletteResult.detail && rouletteResult.detail.blocked_until) {
                        const blockedTime = DateTime.fromSeconds(rouletteResult.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
                        await this.log(`Spin không thành công, cần mời thêm ${rouletteResult.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`, 'warning');
                    } else {
                        await this.log(`Kết quả spin không xác định`, 'error');
                    }
                }

                await this.handleDurovTask(access_token, proxy);
                await this.holdCoins(access_token, proxy);
                await this.swipeCoin(access_token, proxy);

                const tasks = await this.getDailyTasks(access_token, proxy);
                if (tasks) {
                    for (const task of tasks) {
                        await this.completeTask(access_token, task, proxy);
                        await this.sleep(1000);
                    }
                }
            } else {
                await this.log(`Không đọc được dữ liệu tài khoản`, 'error');
            }
        } catch (error) {
            await this.log(`Lỗi xử lý tài khoản: ${error.message}`, 'error');
        }
    }

    async processBatch(batch, proxies) {
        return Promise.all(batch.map((account, index) => {
            return new Promise((resolve) => {
                const worker = new Worker(__filename, {
                    workerData: { account, proxy: proxies[index], index: account.index }
                });

                const timeout = setTimeout(() => {
                    worker.terminate();
                    this.log(`Tài khoản ${account.index + 1} bị timeout sau 10 phút`, 'error');
                    resolve();
                }, 10 * 60 * 1000);

                worker.on('message', (message) => {
                    if (message === 'done') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

                worker.on('error', (error) => {
                    this.log(`Lỗi luồng cho tài khoản ${account.index + 1}: ${error.message}`, 'error');
                    clearTimeout(timeout);
                    resolve();
                });

                worker.on('exit', (code) => {
                    if (code !== 0) {
                        this.log(`Luồng tài khoản ${account.index + 1} dừng với mã lỗi ${code}`, 'error');
                    }
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }));
    }

    async main() {
        const dataFile = './../data/major.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line, index) => ({ init_data: line.trim(), index }));

        while (true) {
            for (let i = 0; i < data.length; i += maxThreads) {
                const batch = data.slice(i, i + maxThreads);
                const batchProxies = this.proxies.slice(i, i + maxThreads);
                await this.processBatch(batch, batchProxies);

                if (i + maxThreads < data.length) {
                    await this.log('Đợi 3 giây trước khi xử lý luồng tiếp theo...', 'warning');
                    await this.sleep(3000);
                }
            }

            await console.log(`[*] Đã xử lý tất cả tài khoản. Nghỉ ${28850} giây trước khi bắt đầu lại...`);
            await this.waitWithCountdown(28850);
        }
    }
}

if (isMainThread) {
    const glados = new GLaDOS();
    glados.main().catch(async (err) => {
        await glados.log(`Lỗi rồi: ${err.message}`, 'error');
        process.exit(1);
    });
} else {
    const glados = new GLaDOS();
    glados.processAccount(workerData.account, workerData.proxy)
        .then(() => {
            parentPort.postMessage('done');
        })
        .catch(async (error) => {
            await glados.log(`Luồng bị lỗi: ${error.message}`, 'error');
            parentPort.postMessage('done');
        });
}