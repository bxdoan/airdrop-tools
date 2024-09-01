const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class Nomis {
    constructor() {
        this.currentAppInitData = '';
        this.listProxies = [];
        this.indexProxies = 0;
    }

    headers(includeAppInitData = true) {
        const baseHeaders = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Authorization": "Bearer 8e25d2673c5025dfcd36556e7ae1b330095f681165fe964181b13430ddeb385a0844815b104eff05f44920b07c073c41ff19b7d95e487a34aa9f109cab754303cd994286af4bd9f6fbb945204d2509d4420e3486a363f61685c279ae5b77562856d3eb947e5da44459089b403eb5c80ea6d544c5aa99d4221b7ae61b5b4cbb55",
            "Content-Type": "application/json",
            "Origin": "https://telegram.nomis.cc",
            "Referer": "https://telegram.nomis.cc/",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?1",
            "Sec-Ch-Ua-Platform": '"Android"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        };

        if (includeAppInitData) {
            baseHeaders["X-App-Init-Data"] = this.currentAppInitData;
        }

        return baseHeaders;
    }

    async requestWithProxy(config, proxy) {
        const agent = new HttpsProxyAgent(proxy);
        return axios({ ...config, httpsAgent: agent });
    }

    async auth(telegram_user_id, telegram_username, referrer, proxy) {
        const url = "https://cms-tg.nomis.cc/api/ton-twa-users/auth/";
        const headers = this.headers();
        const payload = {
            telegram_user_id,
            telegram_username,
            referrer
        };
        const config = {
            url,
            method: 'post',
            headers,
            data: payload
        };
        return this.requestWithProxy(config, proxy);
    }

    async getProfile(id, proxy) {
        const url = `https://cms-api.nomis.cc/api/users/farm-data?user_id=${id}`;
        const headers = this.headers(false);
        const config = {
            url,
            method: 'get',
            headers
        };
        return this.requestWithProxy(config, proxy);
    }

    async getTask(id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-tasks/by-groups?user_id=${id}`;
        const headers = this.headers();
        this.log(`${'Kiểm tra danh sách nhiệm vụ ...'.green}`);
        const config = {
            url,
            method: 'get',
            headers
        };
        return this.requestWithProxy(config, proxy);
    }

    async kiemtraTask(id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-tasks/by-groups?user_id=${id}&completed=true`;
        const headers = this.headers();
        const config = {
            url,
            method: 'get',
            headers
        };
        return this.requestWithProxy(config, proxy);
    }

    async claimTask(user_id, task_id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-user-tasks/verify`;
        const headers = this.headers();
        const payload = {
            task_id,
            user_id
        };
        const config = {
            url,
            method: 'post',
            headers,
            data: payload
        };
        return this.requestWithProxy(config, proxy);
    }

    async claimFarm(user_id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-users/claim-farm`;
        const headers = this.headers();
        const payload = { user_id };
        const config = {
            url,
            method: 'post',
            headers,
            data: payload
        };
        return this.requestWithProxy(config, proxy);
    }

    async startFarm(user_id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-users/start-farm`;
        const headers = this.headers();
        const payload = { user_id };
        const config = {
            url,
            method: 'post',
            headers,
            data: payload
        };
        return this.requestWithProxy(config, proxy);
    }

    async getReferralData(user_id, proxy) {
        const url = `https://cms-api.nomis.cc/api/users/referrals-data?user_id=${user_id}`;
        const headers = this.headers();
        const config = {
            url,
            method: 'get',
            headers
        };
        return this.requestWithProxy(config, proxy);
    }

    async claimReferral(user_id, proxy) {
        const url = `https://cms-tg.nomis.cc/api/ton-twa-users/claim-referral`;
        const headers = this.headers();
        const payload = { user_id };
        const config = {
            url,
            method: 'post',
            headers,
            data: payload
        };
        return this.requestWithProxy(config, proxy);
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
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
        let firstFarmCompleteTime = null;
    
        while (true) {
            const dataFile = path.join(__dirname, './../data/nomis.txt');
            const proxyFile = path.join(__dirname, './../data/proxy.txt');
            const data = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
            this.listProxies = fs.readFileSync(proxyFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);

            for (let no = 0; no < data.length; no++) {
                const appInitData = data[no];
                const proxy = this.formatProxy(this.getProxy());
                this.currentAppInitData = appInitData;

                const userMatch = appInitData.match(/user=%7B%22id%22%3A(\d+).*?%22username%22%3A%22(.*?)%22/);
                if (!userMatch) {
                    console.log(`Invalid app init data for entry ${no + 1}`);
                    continue;
                }

                const [, telegram_user_id, telegram_username] = userMatch;
                const referrer = "D0dA2sA2Vc"; // refcode
                let proxyIP = '';
                try {
                    proxyIP = await this.checkProxyIP(proxy);
                } catch (error) {
                    console.error('Lỗi khi kiểm tra IP của proxy:', error);
                }
                try {
                    const authResponse = await this.auth(telegram_user_id, telegram_username, referrer, proxy);
                    const profileData = authResponse.data;
                    if (profileData && profileData.id) {
                        const userId = profileData.id;
                        
                        console.log(`========== Tài khoản ${no + 1} | ${telegram_username.green} | IP: ${proxyIP} ==========`);
    
                        const farmDataResponse = await this.getProfile(userId, proxy);
                        const farmData = farmDataResponse.data;
                        const points = farmData.points / 1000;
                        const nextfarm = farmData.nextFarmClaimAt;
    
                        this.log(`${'Balance:'.green} ${points}`);
                        let claimFarmSuccess = false;
    
                        if (nextfarm) {
                            const nextFarmLocal = DateTime.fromISO(nextfarm, { zone: 'utc' }).setZone(DateTime.local().zoneName);
                            this.log(`${'Thời gian hoàn thành farm:'.green} ${nextFarmLocal.toLocaleString(DateTime.DATETIME_FULL)}`);
                            if (no === 0) {
                                firstFarmCompleteTime = nextFarmLocal;
                            }
                            const now = DateTime.local();
                            if (now > nextFarmLocal) {
                                try {
                                    await this.claimFarm(userId, proxy);
                                    this.log(`${'Claim farm thành công!'.green}`);
                                    claimFarmSuccess = true;
                                } catch (claimError) {
                                    console.log(claimError);
                                    this.log(`${'Lỗi khi claim farm!'.red}`);
                                }
                            }
                        } else {
                            claimFarmSuccess = true;
                        }
    
                        if (claimFarmSuccess) {
                            try {
                                await this.startFarm(userId, proxy);
                                this.log(`${'Start farm thành công!'.green}`);
                            } catch (startError) {
                                this.log(`${'Lỗi khi start farm!'.red}`);
                            }
                        }
    
                        try {
                            const getTaskResponse = await this.getTask(userId, proxy);
                            const tasks = getTaskResponse.data;
    
                            const kiemtraTaskResponse = await this.kiemtraTask(userId, proxy);
                            const completedTasks = kiemtraTaskResponse.data.flatMap(taskGroup => taskGroup.ton_twa_tasks);
    
                            const completedTaskIds = new Set(completedTasks.map(task => task.id));
    
                            const pendingTasks = tasks.flatMap(taskGroup => taskGroup.ton_twa_tasks)
                                .filter(task => 
                                    task.reward > 0 && 
                                    !completedTaskIds.has(task.id) &&
                                    !['telegramAuth', 'pumpersToken', 'pumpersTrade'].includes(task.handler)
                                );
    
                            for (const task of pendingTasks) {
                                const result = await this.claimTask(userId, task.id, proxy);
                                this.log(`${'Làm nhiệm vụ'.yellow} ${task.title.white}... ${'Trạng thái:'.white} ${'Hoàn thành'.green}`);
                            }
                        } catch (taskError) {
                            this.log(`${'Lỗi khi làm nhiệm vụ'.red}`);
                            console.log(taskError);
                        }

                        try {
                            const referralDataResponse = await this.getReferralData(userId, proxy);
                            const referralData = referralDataResponse.data;
                            if (referralData && referralData.claimAvailable > 0) {
                                if (referralData.nextReferralsClaimAt) {
                                    const nextReferralsClaimLocal = DateTime.fromISO(referralData.nextReferralsClaimAt, { zone: 'utc' }).setZone(DateTime.local().zoneName);
                                    this.log(`${'Thời gian claim referrals tiếp theo:'.green} ${nextReferralsClaimLocal.toLocaleString(DateTime.DATETIME_FULL)}`);
                        
                                    const now = DateTime.local();
                                    if (now > nextReferralsClaimLocal) {
                                        const claimResponse = await this.claimReferral(userId, proxy);
                                        if (claimResponse.data.result) {
                                            this.log(`${'Claim referrals thành công!'.green}`);
                                        } else {
                                            this.log(`${'Claim referrals thất bại!'.red}`);
                                        }
                                    }
                                } else {
                                    this.log(`${'Thời gian claim referrals tiếp theo: null. Thực hiện claim...'.green}`);
                                    const claimResponse = await this.claimReferral(userId, proxy);
                                    if (claimResponse.data.result) {
                                        this.log(`${'Claim referrals thành công!'.green}`);
                                    } else {
                                        this.log(`${'Claim referrals thất bại!'.red}`);
                                    }
                                }
                            } else {
                                this.log(`${'Không có claim referrals khả dụng'.yellow}`);
                            }
                        } catch (error) {
                            this.log(`${'Lỗi khi xử lý referrals'.red}`);
                        }
                    } else {
                        this.log(`${'Lỗi: Không tìm thấy ID người dùng'.red}`);
                    }
                } catch (error) {
                    this.log(`${'Lỗi khi xử lý tài khoản'.red}`);
                }
            }
    
            let waitTime;
            if (firstFarmCompleteTime) {
                const now = DateTime.local();
                const diff = firstFarmCompleteTime.diff(now, 'seconds').seconds;
                waitTime = Math.max(0, diff);
				} else {
                waitTime = 15 * 60; 
            }
            await this.waitWithCountdown(Math.floor(waitTime));
        }
    }    
}

if (require.main === module) {
    const dancay = new Nomis();
    dancay.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}