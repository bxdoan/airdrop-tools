const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const { DateTime } = require('luxon');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

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
        this.proxies = fs.readFileSync('./../data/proxy.txt', 'utf8').split('\n').filter(Boolean);
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

    log(msg) {
        console.log(`[*] ${msg}`);
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
            this.log(`HOLD coin thành công, nhận ${coins} sao`.green);
        } else if (result.detail && result.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(result.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            this.log(`HOLD coin không thành công, cần mời thêm ${result.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`.yellow);
        } else {
            this.log(`HOLD coin không thành công`.red);
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
                this.log(`Swipe coin thành công, nhận ${coins} sao`.green);
            } else {
                this.log(`Swipe coin không thành công`.red);
            }
            return result;
        } else if (getResponse.detail && getResponse.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(getResponse.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            this.log(`Swipe coin không thành công, cần mời thêm ${getResponse.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`.yellow);
        } else {
            this.log(`Không thể lấy thông tin swipe coin`.red);
        }
        return getResponse;
    }

    async getDailyTasks(token, proxy) {
        const tasks = await this.makeRequest('get', `${this.tasksUrl}?is_daily=false`, null, token, proxy);
        if (Array.isArray(tasks)) {
            this.log(`Danh sách nhiệm vụ:`.magenta);
            tasks.forEach(task => this.log(`- ${task.id}: ${task.title}`.cyan));
            return tasks.map(task => ({ id: task.id, title: task.title }));
        } else {
            this.log(`Không thể lấy danh sách nhiệm vụ`.red);
            return null;
        }
    }

    async completeTask(token, task, proxy) {
        const payload = { task_id: task.id };
        const result = await this.makeRequest('post', this.tasksUrl, payload, token, proxy);
        if (result.is_completed) {
            this.log(`Làm nhiệm vụ ${task.id}: ${task.title.yellow} .. trạng thái: thành công`.green);
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
                this.log(`Tìm câu đố Durov không thành công, cần mời thêm ${getResult.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`.yellow);
                return;
            }

            if (!getResult.success) {
                this.log('Durov GET request failed'.red);
                return;
            }

            const payloadData = await this.getDurovPayload();
            if (!payloadData) {
                this.log('Failed to fetch Durov payload'.red);
                return;
            }

            const today = DateTime.now().setZone('system');
            const payloadDate = DateTime.fromFormat(payloadData.date, 'dd/MM/yyyy');

            if (today.hasSame(payloadDate, 'day')) {
                const payload = payloadData.tasks[0];
                const postResult = await this.makeRequest('post', this.durovUrl, payload, token, proxy);

                if (postResult.correct && JSON.stringify(postResult.correct) === JSON.stringify(Object.values(payload))) {
                    this.log('Tìm câu đố Durov thành công'.green);
                } else {
                    this.log('Tìm câu đố Durov không thành công'.red);
                }
            } else if (today > payloadDate) {
                this.log('Chưa có combo Durov ngày mới, cần réo tên @hung96 để cập nhật combo'.yellow);
            } else {
                this.log('Payload date is in the future. Please check the date format.'.yellow);
            }
        } catch (error) {
            this.log(`Error in Durov task: ${error.message}`.red);
        }
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

    async main() {
        const dataFile = path.join(__dirname, './../data/major.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const init_data = data[i].trim();
                const proxyIndex = i % this.proxies.length;
                const proxy = this.formatProxy(this.proxies[proxyIndex]);

                let proxyIP = 'Unknown';
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    this.log(`Không thể kiểm tra IP của proxy: ${error.message}`.yellow);
                }

                try {
                    const authResult = await this.authenticate(init_data, proxy);
                    if (authResult) {
                        const { access_token, user } = authResult;
                        const { id, first_name } = user;

                        console.log(`========== Tài khoản ${i + 1} | ${first_name.green} | ip: ${proxyIP} ==========`);

                        const userInfo = await this.getUserInfo(id, access_token, proxy);
                        if (userInfo) {
                            this.log(`Số sao đang có: ${userInfo.rating.toString().white}`.green);
                        }

                        const streakInfo = await this.getStreak(access_token, proxy);
                        if (streakInfo) {
                            this.log(`Đã điểm danh ${streakInfo.streak} ngày!`.green);
                        }

                        const visitResult = await this.postVisit(access_token, proxy);
                        if (visitResult) {
                            if (visitResult.is_increased) {
                                this.log(`Điểm danh thành công ngày ${visitResult.streak}`.green);
                            } else {
                                this.log(`Đã điểm danh trước đó. Streak hiện tại: ${visitResult.streak}`.yellow);
                            }
                        }

                        const rouletteResult = await this.spinRoulette(access_token, proxy);
                        if (rouletteResult) {
                            if (rouletteResult.rating_award > 0) {
                                this.log(`Spin thành công, nhận được ${rouletteResult.rating_award} sao`.green);
                            } else if (rouletteResult.detail && rouletteResult.detail.blocked_until) {
                                const blockedTime = DateTime.fromSeconds(rouletteResult.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
                                this.log(`Spin không thành công, cần mời thêm ${rouletteResult.detail.need_invites} bạn hoặc chờ đến ${blockedTime}`.yellow);
                            } else {
                                this.log(`Kết quả spin không xác định`.red);
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
                        this.log(`Không đọc được dữ liệu tài khoản ${i + 1}`);
                    }
                } catch (error) {
                    this.log(`Lỗi xử lý tài khoản ${i + 1}: ${error.message}`.red);
                }

                if (i < data.length - 1) {
                    await this.waitWithCountdown(3);
                }
            }
            await this.waitWithCountdown(28850);
        }
    }
}

if (require.main === module) {
    const glados = new GLaDOS();
    glados.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}