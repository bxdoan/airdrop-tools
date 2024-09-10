const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class MidasAPIClient {
    constructor() {
        this.ref = "ref_11353b3b-61e2-4a77-9255-8cd2aca7aad3"; //ref code
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://midas-tg-app.netlify.app",
            "Referer": "https://midas-tg-app.netlify.app/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, './../data/proxy.txt');
        return fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
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

    async makeRequest(method, url, options = {}, maxRetries = 5, retryDelay = 3000) {
        const proxyIndex = options.proxyIndex || 0;
        const proxy = this.formatProxy(this.proxies[proxyIndex]);
        const proxyAgent = new HttpsProxyAgent(proxy);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios({
                    method,
                    url,
                    ...options,
                    httpsAgent: proxyAgent
                });
                return { success: true, data: response.data, status: response.status };
            } catch (error) {
                if (attempt === maxRetries) {
                    return { 
                        success: false, 
                        error: error.response ? error.response.data : error.message,
                        status: error.response ? error.response.status : null
                    };
                }
                this.log(`Lỗi truy vấn, thử lại sau ${retryDelay / 1000} giây...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    async makeRequest2(method, url, options = {}, maxRetries = 1, retryDelay = 1000) {
        const proxyIndex = options.proxyIndex || 0;
        const proxy = this.proxies[proxyIndex];
        const proxyAgent = new HttpsProxyAgent(proxy);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios({
                    method,
                    url,
                    ...options,
                    httpsAgent: proxyAgent
                });
                return { success: true, data: response.data, status: response.status };
            } catch (error) {
                if (attempt === maxRetries) {
                    return { 
                        success: false, 
                        error: error.response ? error.response.data : error.message,
                        status: error.response ? error.response.status : null
                    };
                }
                this.log(`Lỗi truy vấn, thử lại sau ${retryDelay / 1000} giây...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
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

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục ...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    async register(initData, options = {}) {
        const url = "https://api-tg-app.midas.app/api/auth/register";
        const payload = {
            initData: initData,
            source: `${this.ref}`
        };
        const result = await this.makeRequest('post', url, {
            data: payload,
            headers: this.headers,
            ...options
        });

        if (result.success) {
            return { success: true, token: result.data };
        } else {
            return { success: false, error: result.error };
        }
    }

    async getStreak(token, options = {}) {
        const url = "https://api-tg-app.midas.app/api/streak";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest2('post', url, { headers, ...options });

        if (result.success) {
            return { success: true, data: result.data };
        } else {
            return { success: false, error: result.error };
        }
    }

    async getUserInfo(token, options = {}) {
        const url = "https://api-tg-app.midas.app/api/user";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest('get', url, { headers, ...options });

        if (result.success) {
            return { 
                success: true, 
                points: result.data.points,
                tickets: result.data.tickets
            };
        } else {
            return { success: false, error: result.error };
        }
    }

    async getAvailableTasks(token, options = {}) {
        const url = "https://api-tg-app.midas.app/api/tasks/available";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest2('get', url, { headers, ...options });

        if (result.success) {
            return { 
                success: true, 
                tasks: result.data.filter(task => !task.completed)
                    .map(task => ({
                        id: task.id,
                        name: task.name,
                        canBeClaimedAt: task.canBeClaimedAt,
                        waitTime: task.waitTime
                    }))
            };
        } else {
            return { success: false, error: result.error };
        }
    }

    async startTask(token, taskId, options = {}) {
        const url = `https://api-tg-app.midas.app/api/tasks/start/${taskId}`;
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest2('post', url, { headers, ...options });

        if (result.success) {
            return { success: true };
        } else {
            return { 
                success: false, 
                error: result.error,
                status: result.status
            };
        }
    }

    async handleTask(token, task, options = {}) {
        const startResult = await this.startTask(token, task.id, options);
        if (!startResult.success) {
            return { success: false, error: startResult.error };
        }

        if (task.waitTime) {
            this.log(`Chờ ${task.waitTime} giây để hoàn thành nhiệm vụ...`, 'info');
            await new Promise(resolve => setTimeout(resolve, task.waitTime * 1000));
        }

        const claimResult = await this.claimTask(token, task.id, options);
        return claimResult;
    }

    async claimTask(token, taskId, options = {}) {
        const url = `https://api-tg-app.midas.app/api/tasks/claim/${taskId}`;
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest2('post', url, { headers, ...options });

        if (result.success) {
            return { success: true, data: result.data };
        } else {
            return { success: false, error: result.error };
        }
    }

    async playGame(token, options = {}) {
        const url = "https://api-tg-app.midas.app/api/game/play";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest('post', url, { headers, ...options });

        if (result.success) {
            return { success: true, data: result.data };
        } else {
            return { 
                success: false, 
                error: result.error,
                status: result.status
            };
        }
    }

    async handleGamePlay(token, options = {}) {
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;

        while (true) {
            const userInfoResult = await this.getUserInfo(token, options);
            if (!userInfoResult.success) {
                this.log(`Không thể lấy thông tin người dùng: ${userInfoResult.error}`, 'error');
                return;
            }

            if (userInfoResult.tickets === 0) {
                this.log('Hết ticket, dừng tap.', 'info');
                return;
            }

            const playResult = await this.playGame(token, options);
            if (playResult.success) {
                this.log(`Tap thành công nhận được ${playResult.data.points} GM`, 'success');
                consecutiveErrors = 0; 
            } else {
                consecutiveErrors++;
                this.log(`Lỗi khi tap (Lần ${consecutiveErrors}):`, 'error');

                if (consecutiveErrors >= maxConsecutiveErrors) {
                    this.log(`Đã xảy ra ${maxConsecutiveErrors} lỗi liên tiếp. Dừng tap.`, 'error');
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    
    async visitUser(token, options = {}) {
        const url = "https://api-tg-app.midas.app/api/user/visited";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        const result = await this.makeRequest('patch', url, { headers, ...options });

        if (result.success) {
            this.log('Truy cập thành công', 'success');
            return { success: true, data: result.data };
        } else {
            return { success: false, error: result.error };
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
        const dataFile = './../data/midas.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initData = data[i];
                const proxyIndex = i % this.proxies.length;
                const userData = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0]));
                const userId = userData.id;
                const firstName = userData.first_name;
                const proxy = this.formatProxy(this.proxies[proxyIndex]);
                let proxyIP = 'Unknown';
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    this.log(`Không thể kiểm tra IP của proxy: ${error.message}`, 'warning');
                }

                console.log(`========== Tài khoản ${i + 1}/${data.length} | ${firstName.green} | ip: ${proxyIP} ==========`);
                
                this.log(`Đang xử lý tài khoản ${userId}...`, 'info');
                const registerResult = await this.register(initData, { proxyIndex: proxyIndex });
                if (registerResult.success) {
                    this.log('Đăng nhập thành công!', 'success');
                    const token = registerResult.token;
                    
                    const streakResult = await this.getStreak(token, { proxyIndex: proxyIndex });
                    if (streakResult.success) {
                        this.log(`Đã điểm danh ${streakResult.data.streakDaysCount} ngày!`, 'info');
                    } else {
                        this.log(`Hôm nay bạn đã điểm danh rồi!`, 'info');
                    }
                    await this.visitUser(token, { proxyIndex: proxyIndex });

                    const userInfoResult = await this.getUserInfo(token, { proxyIndex: proxyIndex });
                    if (userInfoResult.success) {
                        this.log(`Points: ${userInfoResult.points}`, 'success');
                        this.log(`Tickets: ${userInfoResult.tickets}`, 'success');

                        if (userInfoResult.tickets > 0) {
                            this.log('Bắt đầu tap...', 'info');
                            await this.handleGamePlay(token, { proxyIndex: proxyIndex });
                        }
                    } else {
                        this.log(`Không thể lấy thông tin người dùng: ${userInfoResult.error}`, 'error');
                    }

                    const availableTasksResult = await this.getAvailableTasks(token, { proxyIndex: proxyIndex });
                    if (availableTasksResult.success) {
                        this.log(`Số nhiệm vụ khả dụng: ${availableTasksResult.tasks.length}`, 'info');
                        
                        for (const task of availableTasksResult.tasks) {
                            const taskResult = await this.handleTask(token, task, { proxyIndex: proxyIndex });
                            if (taskResult.success) {
                                this.log(`Hoàn thành nhiệm vụ ${task.name} thành công`, 'success');
                            } else {
                                this.log(`Không thể hoàn thành nhiệm vụ ${task.name}`, 'error');
                            }
                        }
                    } else {
                        this.log(`Không thể lấy danh sách nhiệm vụ: ${availableTasksResult.error}`, 'error');
                    }
                } else {
                    this.log(`Đăng ký không thành công! ${registerResult.error}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(10 * 60);
        }
    }
}

const client = new MidasAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});