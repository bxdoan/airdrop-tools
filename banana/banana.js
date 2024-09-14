const cloudscraper = require('cloudscraper');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { DateTime, Duration } = require('luxon');
const readline = require('readline');

class BananaBot {
    constructor() {
        this.base_url = 'https://interface.carv.io/banana';
        this.bananasOverOneUSDT = [];
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://banana.carv.io',
            'Referer': 'https://banana.carv.io/',
            'Sec-CH-UA': '"Not A;Brand";v="99", "Android";v="12"',
            'Sec-CH-UA-Mobile': '?1',
            'Sec-CH-UA-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.73 Mobile Safari/537.36',
            'X-App-ID': 'carv',
        };        
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async makeRequest(method, url, data = null) {
        const options = {
            method: method,
            uri: url,
            headers: this.headers,
            json: true
        };

        if (data) {
            options.body = data;
        }

        try {
            return await cloudscraper(options);
        } catch (error) {
            this.log(`Error in request: ${error.message}`);
            throw error;
        }
    }

    async login(queryId) {
        const loginPayload = {
            tgInfo: queryId,
            InviteCode: ""
        };

        try {
            const response = await this.makeRequest('POST', `${this.base_url}/login`, loginPayload);
            await this.sleep(1000);

            if (response.data && response.data.token) {
                return response.data.token;
            } else {
                this.log('Không tìm thấy token.');
                return null;
            }
        } catch (error) {
            this.log('Lỗi trong quá trình đăng nhập: ' + error.message);
            return null;
        }
    }

    async achieveQuest(questId) {
        const achievePayload = { quest_id: questId };
        try {
            return await this.makeRequest('POST', `${this.base_url}/achieve_quest`, achievePayload);
        } catch (error) {
            this.log('Lỗi khi làm nhiệm vụ: ' + error.message);
        }
    }

    async claimQuest(questId) {
        const claimPayload = { quest_id: questId };
        try {
            return await this.makeRequest('POST', `${this.base_url}/claim_quest`, claimPayload);
        } catch (error) {
            this.log('Lỗi khi claim nhiệm vụ: ' + error.message);
        }
    }

    async doClick(clickCount) {
        const clickPayload = { clickCount: clickCount };
        try {
            const response = await this.makeRequest('POST', `${this.base_url}/do_click`, clickPayload);
            return response;
        } catch (error) {
            this.log('Lỗi khi tap: ' + error.message);
            return null;
        }
    }

    async getLotteryInfo() {
        try {
            return await this.makeRequest('GET', `${this.base_url}/get_lottery_info`);
        } catch (error) {
            this.log('Lỗi khi lấy thông tin: ' + error.message);
        }
    }

    async claimLottery() {
        const claimPayload = { claimLotteryType: 1 };
        try {
            return await this.makeRequest('POST', `${this.base_url}/claim_lottery`, claimPayload);
        } catch (error) {
            this.log('Lỗi không thể harvest: ' + error.message);
        }
    }

    async doLottery() {
        try {
            return await this.makeRequest('POST', `${this.base_url}/do_lottery`);
        } catch (error) {
            this.log('Lỗi khi claim tap: ' + error.message);
        }
    }

    calculateRemainingTime(lotteryData) {
        const lastCountdownStartTime = lotteryData.last_countdown_start_time || 0;
        const countdownInterval = lotteryData.countdown_interval || 0;
        const countdownEnd = lotteryData.countdown_end || false;

        if (!countdownEnd) {
            const currentTime = DateTime.now();
            const lastCountdownStart = DateTime.fromMillis(lastCountdownStartTime);
            const elapsedTime = currentTime.diff(lastCountdownStart, 'minutes').as('minutes');
            const remainingTimeMinutes = Math.max(countdownInterval - elapsedTime, 0); 
            return remainingTimeMinutes;
        }
        return 0;
    }

    askUserChoice(prompt) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(prompt, (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === 'yes');
            });
        });
    }

    async equipBestBanana(currentEquipBananaId, accountIndex) {
        try {
            const response = await this.makeRequest('GET', `${this.base_url}/get_banana_list`);
            const bananas = response.data.banana_list;

            const eligibleBananas = bananas.filter(banana => banana.count >= 1);
            if (eligibleBananas.length > 0) {
                const bestBanana = eligibleBananas.reduce((prev, current) => {
                    return (prev.daily_peel_limit > current.daily_peel_limit) ? prev : current;
                });

                if (bestBanana.banana_id === currentEquipBananaId) {
                    this.log(colors.green(`Đang sử dụng quả chuối tốt nhất: ${colors.yellow(bestBanana.name)} | Price : ${colors.yellow(bestBanana.sell_exchange_peel)} Peels / ${colors.yellow(bestBanana.sell_exchange_usdt)} USDT.`));
                    
                    if (bestBanana.sell_exchange_usdt >= 0.1) {
                        this.log(colors.red(`Đã đạt mục tiêu! Giá trị USDT của chuối: ${colors.yellow(bestBanana.sell_exchange_usdt)} USDT`));

                        const filePath = path.join(__dirname, 'banana.txt');
                        const newBananaInfo = `Account ${accountIndex + 1}: ${bestBanana.name} - ${bestBanana.sell_exchange_usdt} USDT`;
                        
                        let fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').split('\n') : [];
                        
                        let updated = false;
                        for (let i = 0; i < fileContent.length; i++) {
                            if (fileContent[i].startsWith(`Account ${accountIndex + 1}:`)) {
                                const currentUSDT = parseFloat(fileContent[i].split(' - ')[1]);
                                if (bestBanana.sell_exchange_usdt > currentUSDT) {
                                    fileContent[i] = newBananaInfo;
                                }
                                updated = true;
                                break;
                            }
                        }
                        
                        if (!updated) {
                            fileContent.push(newBananaInfo);
                        }
                        
                        fs.writeFileSync(filePath, fileContent.join('\n'));
                    }
                    return;
                }

                const equipPayload = { bananaId: bestBanana.banana_id };
                const equipResponse = await this.makeRequest('POST', `${this.base_url}/do_equip`, equipPayload);
                if (equipResponse.code === 0) {
                    this.log(colors.green(`Đã Equip quả chuối tốt nhất: ${colors.yellow(bestBanana.name)} với ${bestBanana.daily_peel_limit} 🍌/ DAY`));
                } else {
                    this.log(colors.red('Sử dụng chuối thất bại!'));
                }
            } else {
                this.log(colors.red('Không có quả chuối nào được tìm thấy !'));
            }
        } catch (error) {
            this.log('Lỗi rồi: ' + error.message);
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async doSpeedup(maxSpeedups = 3) {
        let speedupsPerformed = 0;
        while (speedupsPerformed < maxSpeedups) {
            try {
                const response = await this.makeRequest('POST', `${this.base_url}/do_speedup`);
                if (response.code === 0) {
                    const speedupCount = response.data.speedup_count;
                    const lotteryInfo = response.data.lottery_info;
                    speedupsPerformed++;
                    this.log(colors.green(`Speedup thành công! Còn lại ${speedupCount} lần speedup. Đã thực hiện ${speedupsPerformed}/${maxSpeedups} lần.`));
    
                    if (lotteryInfo.countdown_end === true) {
                        this.log(colors.yellow('Countdown kết thúc. Đang claim lottery...'));
                        await this.claimLottery();
                    }
    
                    if (speedupCount === 0 || speedupsPerformed >= maxSpeedups) {
                        this.log(colors.yellow(`Đã hết lượt speedup hoặc đạt giới hạn ${maxSpeedups} lần.`));
                        return lotteryInfo;
                    }
                } else {
                    this.log(colors.red('Speedup thất bại!'));
                    return null;
                }
            } catch (error) {
                this.log('Lỗi khi thực hiện speedup: ' + error.message);
                return null;
            }
        }
    }

    async processAccount(queryId, doQuests, accountIndex) {
        let remainingTimeMinutes = Infinity;
        const token = await this.login(queryId);
        if (token) {
            this.headers['Authorization'] = token;
            this.headers['Cache-Control'] = 'no-cache';
            this.headers['Pragma'] = 'no-cache';
    
            try {
                const userInfoResponse = await this.makeRequest('GET', `${this.base_url}/get_user_info`);
                this.log(colors.green('Đăng nhập thành công !'));
                await this.sleep(1000);
                const userInfoData = userInfoResponse;
    
                const userInfo = userInfoData.data || {};
                const peel = userInfo.peel || 'N/A';
                const usdt = userInfo.usdt || 'N/A';
                const todayClickCount = userInfo.today_click_count || 0;
                const maxClickCount = userInfo.max_click_count || 0;
                const currentEquipBananaId = userInfo.equip_banana_id || 0;
                const speedup = userInfo.speedup_count || 0;
    
                this.log(colors.green(`Balance : ${colors.white(peel)}`));
                this.log(colors.green(`USDT : ${colors.white(usdt)}`));
                this.log(colors.green(`Speed Up : ${colors.white(speedup)}`));
                this.log(colors.green(`Hôm nay đã tap : ${colors.white(todayClickCount)} lần`));
    
                await this.equipBestBanana(currentEquipBananaId, accountIndex);

                try {
                    const lotteryInfoResponse = await this.getLotteryInfo();
                    await this.sleep(1000);
                    const lotteryInfoData = lotteryInfoResponse;
                    let remainLotteryCount = (lotteryInfoData.data || {}).remain_lottery_count || 0;
                    remainingTimeMinutes = this.calculateRemainingTime(lotteryInfoData.data || {});
    
                    if (remainingTimeMinutes <= 0) {
                        this.log(colors.yellow('Bắt đầu claim...'));
                        await this.claimLottery();
                        
                        const updatedLotteryInfoResponse = await this.getLotteryInfo();
                        await this.sleep(1000);
                        const updatedLotteryInfoData = updatedLotteryInfoResponse;
                        remainLotteryCount = (updatedLotteryInfoData.data || {}).remain_lottery_count || 0;
                        remainingTimeMinutes = this.calculateRemainingTime(updatedLotteryInfoData.data || {});
                    }
    
                    if (speedup > 0) {
                        const maxSpeedups = speedup > 3 ? 3 : speedup;
                        this.log(colors.yellow(`Thực hiện speedup tối đa ${maxSpeedups} lần...`));
                        const speedupLotteryInfo = await this.doSpeedup(maxSpeedups);
                        if (speedupLotteryInfo) {
                            remainingTimeMinutes = this.calculateRemainingTime(speedupLotteryInfo);
                        }
                    }
                    const remainingDuration = Duration.fromMillis(remainingTimeMinutes * 60 * 1000);
                    const remainingHours = Math.floor(remainingDuration.as('hours'));
                    const remainingMinutes = Math.floor(remainingDuration.as('minutes')) % 60;
                    const remainingSeconds = Math.floor(remainingDuration.as('seconds')) % 60;
    
                    this.log(colors.yellow(`Thời gian còn lại để nhận Banana: ${remainingHours} Giờ ${remainingMinutes} phút ${remainingSeconds} giây`));
    
                    this.log(colors.yellow(`Harvest Có Sẵn : ${colors.white(remainLotteryCount)}`));
                    if (remainLotteryCount > 0) {
                        this.log('Bắt đầu harvest...');
                        for (let i = 0; i < remainLotteryCount; i++) {
                            this.log(`Đang harvest lần thứ ${i + 1}/${remainLotteryCount}...`);
                            const doLotteryResponse = await this.doLottery();

                            if (doLotteryResponse.code === 0) {
                                const lotteryResult = doLotteryResponse.data || {};
                                const bananaName = lotteryResult.name || 'N/A';
                                const sellExchangePeel = lotteryResult.sell_exchange_peel || 'N/A';
                                const sellExchangeUsdt = lotteryResult.sell_exchange_usdt || 'N/A';

                                this.log(`Harvest thành công ${bananaName}`);
                                console.log(colors.yellow(`     - Banana Name : ${bananaName}`));
                                console.log(colors.yellow(`     - Peel Limit : ${lotteryResult.daily_peel_limit || 'N/A'}`));
                                console.log(colors.yellow(`     - Price : ${sellExchangePeel} Peel, ${sellExchangeUsdt} USDT`));
                                await this.sleep(1000);
                            } else {
                                this.log(colors.red(`Lỗi không mong muốn khi harvest lần thứ ${i + 1}.`));
                            }
                        }
                        this.log('Đã harvest tất cả.');
                    }
                } catch (error) {
                    this.log('Không lấy được lottery info: ' + error.message);
                }
    
                if (todayClickCount < maxClickCount) {
                    const clickCount = maxClickCount - todayClickCount;
                    if (clickCount > 0) {
                        this.log(colors.magenta(`Bạn có ${clickCount} lần tap...`));
                        
                        const parts = [];
                        let remaining = clickCount;
                        for (let i = 0; i < 9; i++) {
                            const part = Math.floor(Math.random() * (remaining / (10 - i))) * 2;
                            parts.push(part);
                            remaining -= part;
                        }
                        parts.push(remaining); 
                        
                        for (const part of parts) {
                            this.log(colors.magenta(`Đang tap ${part} lần...`));
                            const response = await this.doClick(part);
                            if (response && response.code === 0) {
                                const peel = response.data.peel || 0;
                                const speedup = response.data.speedup || 0;
                                this.log(colors.magenta(`Nhận được ${peel} Peel, ${speedup} Speedup...`));
                            } else {
                                this.log(colors.red(`Lỗi khi tap ${part} lần.`));
                            }
                            await this.sleep(1000);
                        }
                
                        const userInfoResponse = await this.makeRequest('GET', `${this.base_url}/get_user_info`);
                        const userInfo = userInfoResponse.data || {};
                        const updatedSpeedup = userInfo.speedup_count || 0;
                
                        if (updatedSpeedup > 0) {
                            this.log(colors.yellow(`Thực hiện speedup, bạn có ${updatedSpeedup} lần...`));
                            const speedupLotteryInfo = await this.doSpeedup();
                            if (speedupLotteryInfo) {
                                remainingTimeMinutes = this.calculateRemainingTime(speedupLotteryInfo);
                            }
                        }
                
                        const remainingDuration = Duration.fromMillis(remainingTimeMinutes * 60 * 1000);
                        const remainingHours = Math.floor(remainingDuration.as('hours'));
                        const remainingMinutes = Math.floor(remainingDuration.as('minutes')) % 60;
                        const remainingSeconds = Math.floor(remainingDuration.as('seconds')) % 60;
                
                        this.log(colors.yellow(`Thời gian còn lại để nhận Banana: ${remainingHours} Giờ ${remainingMinutes} phút ${remainingSeconds} giây`));
                    } else {
                        this.log(colors.red('Không thể tap, đã đạt giới hạn tối đa!'));
                    }
                } else {
                    this.log(colors.red('Không thể tap, đã đạt giới hạn tối đa!'));
                }        
                
                if (doQuests) {
                    try {
                        const questListResponse = await this.makeRequest('GET', `${this.base_url}/get_quest_list`);
                        await this.sleep(1000);
                        const questListData = questListResponse;
        
                        const questList = (questListData.data || {}).quest_list || [];
                        for (let i = 0; i < questList.length; i++) {
                            const quest = questList[i];
                            const questName = quest.quest_name || 'N/A';
                            let isAchieved = quest.is_achieved || false;
                            let isClaimed = quest.is_claimed || false;
                            const questId = quest.quest_id;
        
                            if (!isAchieved) {
                                await this.achieveQuest(questId);
                                await this.sleep(1000);
        
                                const updatedQuestListResponse = await this.makeRequest('GET', `${this.base_url}/get_quest_list`);
                                const updatedQuestListData = updatedQuestListResponse;
                                const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
                                isAchieved = updatedQuest.is_achieved || false;
                            }
        
                            if (isAchieved && !isClaimed) {
                                await this.claimQuest(questId);
                                await this.sleep(1000);
        
                                const updatedQuestListResponse = await this.makeRequest('GET', `${this.base_url}/get_quest_list`);
                                const updatedQuestListData = updatedQuestListResponse;
                                const updatedQuest = updatedQuestListData.data.quest_list.find(q => q.quest_id === questId);
                                isClaimed = updatedQuest.is_claimed || false;
                            }
        
                            const achievedStatus = isAchieved ? 'Hoàn thành' : 'Thất bại';
                            const claimedStatus = isClaimed ? 'Đã Claim' : 'Chưa Claim';
        
                            const questNameColor = colors.cyan;
                            const achievedColor = isAchieved ? colors.green : colors.red;
                            const claimedColor = isClaimed ? colors.green : colors.red;
        
                            if (!questName.toLowerCase().includes('bind')) {
                                this.log(`${colors.white(`Làm nhiệm vụ `)}${questNameColor(questName)} ${colors.blue('...')}Trạng thái : ${achievedColor(achievedStatus)} | ${claimedColor(claimedStatus)}`);
                            }
                        }
        
                        const progress = questListData.data.progress || '';
                        const isClaimedQuestLottery = questListData.data.is_claimed || false;
        
                        if (isClaimedQuestLottery) {
                            this.log(colors.yellow(`Claim quest có sẵn: ${progress}`));
                            const claimQuestLotteryResponse = await this.makeRequest('POST', `${this.base_url}/claim_quest_lottery`);
                            if (claimQuestLotteryResponse.code === 0) {
                                this.log(colors.green('Claim quest thành công!'));
                            } else {
                                this.log(colors.red('Claim quest thất bại!'));
                            }
                        }
        
                    } catch (error) {
                        this.log(colors.red('Lỗi khi lấy danh sách nhiệm vụ: ' + error.message));
                    }
                } else {
                    this.log(colors.yellow('Bỏ qua làm nhiệm vụ!'));
                }
    
            } catch (error) {
                this.log('Không thể tìm nạp thông tin người dùng và danh sách nhiệm vụ do thiếu mã thông báo.');
            }
            return remainingTimeMinutes;
        }
        return null;
    }    

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    async Countdown(seconds) {
        for (let i = Math.floor(seconds); i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }    

    async main() {
        const dataFile = path.join(__dirname, './../data/banana.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
        
        const doQuestsAnswer = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
        const doQuests = doQuestsAnswer.toLowerCase() === 'y';

        while (true) {
            let minRemainingTime = Infinity;

            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                const userDetail = data.user;
                
                if (queryId) {
                    console.log(`\n========== Tài khoản ${i + 1} | ${userDetail.first_name} ==========`);
                    const remainingTime = await this.processAccount(queryId, doQuests, i);

                    if (remainingTime !== null && remainingTime < minRemainingTime) {
                        minRemainingTime = remainingTime;
                    }
                }
                
                await this.sleep(1000); 
            }

            const remainingDuration = Duration.fromMillis(minRemainingTime * 60 * 1000);
            const remainingSeconds = remainingDuration.as('seconds');
            await this.Countdown(remainingSeconds > 0 ? remainingSeconds : 10 * 60);
        }
    }
}    

const bot = new BananaBot();
bot.main();