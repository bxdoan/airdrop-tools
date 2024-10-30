import os
import sys
import random
import time
import traceback
import requests
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto import Random
from colorama import *
from datetime import datetime
import json
import brotli

import cloudscraper

scraper = cloudscraper.create_scraper()

red = Fore.LIGHTRED_EX
yellow = Fore.LIGHTYELLOW_EX
green = Fore.LIGHTGREEN_EX
black = Fore.LIGHTBLACK_EX
blue = Fore.LIGHTBLUE_EX
white = Fore.LIGHTWHITE_EX
reset = Style.RESET_ALL

script_dir = os.path.dirname(os.path.realpath(__file__))

data_file = os.path.join(script_dir, "./../data/banana.txt")
config_file = os.path.join(script_dir, "config.json")
banana_file = os.path.join(script_dir, "banana.txt")

class Banana:
    def __init__(self):
        self.line = white + "~" * 50
        self.unique_entries = set()
        self.load_existing_entries()

        self.auto_equip_banana = (
                json.load(open(config_file, "r")).get("auto-equip-banana", "false").lower()
                == "true"
        )

        self.auto_do_task = (
                json.load(open(config_file, "r")).get("auto-do-task", "false").lower()
                == "true"
        )

        self.auto_claim_invite = (
                json.load(open(config_file, "r")).get("auto-claim-invite", "false").lower()
                == "true"
        )

        self.auto_claim_and_harvest = (
                json.load(open(config_file, "r"))
                .get("auto-claim-and-harvest", "false")
                .lower()
                == "true"
        )

        self.auto_click = (
                json.load(open(config_file, "r")).get("auto-click", "false").lower()
                == "true"
        )

        self.min_harvest_time = float('inf')

    def load_existing_entries(self):
        try:
            with open(banana_file, "r", encoding="utf-8") as f:
                for line in f:
                    self.unique_entries.add(line.strip())
        except FileNotFoundError:
            pass

    def write_unique_entry(self, entry):
        if entry not in self.unique_entries:
            try:
                with open(banana_file, "a", encoding="utf-8") as f:
                    f.write(entry + "\n")
                self.unique_entries.add(entry)
                return True
            except Exception as write_error:
                self.log(f"{red}Lỗi khi ghi vào file banana.txt: {str(write_error)}")
        return False

    def pad(self, s):
        BS = 16
        return s + (BS - len(s) % BS) * chr(BS - len(s) % BS)

    def SA(self, e=None):
        if e is None:
            e = int(time.time() * 1000)

        def encrypt(t, n):
            n = str(n).zfill(16)[:16]
            n = n.encode('utf-8')
            t = str(t).encode('utf-8')
            cipher = AES.new(n, AES.MODE_CBC, iv=n)
            padded = self.pad(t.decode('utf-8'))
            encrypted = cipher.encrypt(padded.encode('utf-8'))
            hex_str = ''.join([format(b, '02x') for b in encrypted])
            return hex_str

        wA = "https://interface.carv.io"
        xA = "JVQXFtvBnIMTMB9t"

        result = encrypt(str(e), xA)
        return result

    def headers(self, token):
        x_interceptor_id = self.SA()
        return {
            "Accept": "application/json, text/plain, */*",
            "Authorization": f"Bearer {token}",
            "Origin": "https://banana.carv.io",
            "Referer": "https://banana.carv.io/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "X-App-Id": "carv",
            "X-Interceptor-Id": x_interceptor_id
        }

    def do_lottery(self, token):
        url = "https://interface.carv.io/banana/do_lottery"
        headers = self.headers(token)
        data = {}
        response = scraper.post(url=url, headers=headers, json=data)
        return response

    def get_token(self, data):
        url = f"https://interface.carv.io/banana/login"
        x_interceptor_id = self.SA()
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://banana.carv.io",
            "Referer": "https://banana.carv.io/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "X-App-Id": "carv",
            "X-Interceptor-Id": x_interceptor_id
        }

        data = {"tgInfo": f"{data}"}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def user_info(self, token):
        url = f"https://interface.carv.io/banana/get_user_info"

        headers = self.headers(token=token)

        response = scraper.get(url=url, headers=headers)

        return response

    def banana_list(self, token, page_size=10):
        page_num = 1
        all_bananas = []

        while True:
            url = f"https://interface.carv.io/banana/get_banana_list/v2?page_num={page_num}&page_size={page_size}"
            headers = self.headers(token=token)
            response = scraper.get(url=url, headers=headers)

            if response.status_code != 200:
                self.log(f"{red}Không thể lấy danh sách chuối ở trang {page_num}: {response.status_code}")
                break

            data = response.json()
            if data["code"] != 0 or data["msg"] != "Success":
                self.log(f"{red}Lỗi khi lấy danh sách chuối ở trang {page_num}: {data['msg']}")
                break

            bananas = data["data"]["list"]
            if not bananas:
                break

            all_bananas.extend(bananas)
            page_num += 1
            if page_num > 99:
                break

        return all_bananas

    def equip_banana(self, token, banana_id):
        url = f"https://interface.carv.io/banana/do_equip"

        headers = self.headers(token=token)

        data = {"bananaId": banana_id}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def quest_list(self, token, page_num=1, page_size=500):
        url = f"https://interface.carv.io/banana/get_quest_list/v2?page_num={page_num}&page_size={page_size}"
        headers = self.headers(token=token)
        try:
            response = scraper.get(url=url, headers=headers)
            response.raise_for_status()
            quest_data = response.json()
            if quest_data["code"] == 0 and quest_data["msg"] == "Success":
                quests = quest_data["data"]["list"]
                return quest_data
            else:
                self.log(f"Error in quest_list: {quest_data['msg']}")
                return None
        except Exception as e:
            return None

    def achieve_quest(self, token, quest_id):
        url = f"https://interface.carv.io/banana/achieve_quest"

        headers = self.headers(token=token)

        data = {"quest_id": quest_id}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def claim_quest(self, token, quest_id):
        url = f"https://interface.carv.io/banana/claim_quest"

        headers = self.headers(token=token)

        data = {"quest_id": quest_id}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def claim_quest_lottery(self, token):
        url = f"https://interface.carv.io/banana/claim_quest_lottery"

        headers = self.headers(token=token)

        headers["Content-Type"] = "application/json"

        data = {}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def invite_list(self, token):
        url = f"https://interface.carv.io/banana/get_invite_list"

        headers = self.headers(token=token)

        response = scraper.get(url=url, headers=headers)

        return response

    def claim_invite(self, token):
        url = f"https://interface.carv.io/banana/claim_lottery"

        headers = self.headers(token=token)

        data = {"claimLotteryType": 2}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def lottery_info(self, token):
        url = f"https://interface.carv.io/banana/get_lottery_info"

        headers = self.headers(token=token)

        response = scraper.get(url=url, headers=headers)

        return response

    def claim_lottery(self, token):
        url = f"https://interface.carv.io/banana/claim_lottery"

        headers = self.headers(token=token)

        data = {"claimLotteryType": 1}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def claim_ads_income(self, token, ad_type):
        url = "https://interface.carv.io/banana/claim_ads_income"
        headers = self.headers(token=token)
        data = {"type": ad_type}
        response = scraper.post(url=url, headers=headers, data=data)
        return response

    def do_share(self, token, banana_id):
        url = "https://interface.carv.io/banana/do_share"
        headers = self.headers(token=token)
        data = {"banana_id": banana_id}
        response = scraper.post(url=url, headers=headers, data=data)
        return response

    def do_click(self, token, click_count):
        url = f"https://interface.carv.io/banana/do_click"

        headers = self.headers(token=token)

        data = {"clickCount": click_count}

        response = scraper.post(url=url, headers=headers, data=data)

        return response

    def log(self, msg):
        now = datetime.now().isoformat(" ").split(".")[0]
        print(f"{black}[{now}]{reset} {msg}{reset}")

    def do_speedup(self, token):
        url = "https://interface.carv.io/banana/do_speedup"
        headers = self.headers(token=token)
        data = {}
        response = scraper.post(url=url, headers=headers, json=data)
        return response

    def calculate_remaining_time(self, lottery_data):
        last_countdown_start_time = lottery_data.get('last_countdown_start_time', 0)
        countdown_interval = lottery_data.get('countdown_interval', 0)
        countdown_end = lottery_data.get('countdown_end', False)

        if not countdown_end:
            current_time = datetime.now()
            last_countdown_start = datetime.fromtimestamp(last_countdown_start_time / 1000)
            elapsed_time = (current_time - last_countdown_start).total_seconds() / 60
            remaining_time_minutes = max(countdown_interval - elapsed_time, 0)
            return remaining_time_minutes
        return 0

    def user_ads_info(self, token):
        url = "https://interface.carv.io/banana/user_ads_info"
        headers = self.headers(token=token)
        response = scraper.get(url=url, headers=headers)
        return response

    def claim_ads_income(self, token, ad_type):
        url = "https://interface.carv.io/banana/claim_ads_income"
        headers = self.headers(token=token)
        data = {"type": ad_type}
        response = scraper.post(url=url, headers=headers, data=data)
        return response

    def call_adsgram_api(self, tg_id):
        url = f"https://api.adsgram.ai/adv?blockId=2748&tg_id={tg_id}&tg_platform=tdesktop&platform=Win32&language=en&is_premium=true&chat_type=sender&chat_instance=-6089476818413932417"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Referer": "https://banana.carv.io/",
            "Origin": "https://banana.carv.io",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "*/*",
            "Cache-Control": "max-age=0",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128", "Microsoft Edge WebView2";v="128"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"'
        }
        response = scraper.get(url=url, headers=headers)
        return response

    def handle_ads(self, token, tg_id=None):
        self.log(f"{yellow}Kiểm tra và xem quảng cáo: {green}Đang thực hiện")
        try:
            ads_info = self.user_ads_info(token=token).json()
            if ads_info["code"] == 0 and ads_info["msg"] == "Success":
                data = ads_info["data"]
                if data["show_for_speedup"] or data["show_for_peels"]:
                    if tg_id:
                        self.log(f"{yellow}Đang gọi API adsgram...")
                        adsgram_response = self.call_adsgram_api(tg_id)

                        if adsgram_response.status_code == 200:
                            self.log(f"{green}Đã gọi API adsgram thành công")
                        else:
                            self.log(f"{red}Gọi API adsgram thất bại: {adsgram_response.status_code}")
                            self.log(f"{red}Response content: {adsgram_response.text[:500]}...")
                    else:
                        self.log(f"{yellow}Không có tg_id, bỏ qua việc gọi API adsgram")

                    wait_time = 1 + random.uniform(0.1, 0.5)
                    self.log(f"{yellow}Đang chờ {wait_time:.2f} giây trước khi claim quảng cáo...")
                    time.sleep(wait_time)

                    ad_type = 1 if data["show_for_speedup"] else 2

                    claim_response = self.claim_ads_income(token=token, ad_type=ad_type).json()
                    if claim_response["code"] == 0 and claim_response["msg"] == "Success":
                        income = claim_response["data"]["income"]
                        peels = claim_response["data"]["peels"]
                        speedup = claim_response["data"]["speedup"]
                        ad_type_str = "Speedup" if ad_type == 1 else "Peels"
                        self.log(f"{green}Xem quảng cáo {ad_type_str} thành công: nhận {white}{income} USDT - {peels} Peels - {speedup} Speedup")
                    else:
                        self.log(f"{red}Xem quảng cáo thất bại: {claim_response['msg']}")
                else:
                    self.log(f"{yellow}Không có quảng cáo khả dụng tại thời điểm này")
            else:
                self.log(f"{red}Không thể lấy thông tin quảng cáo: {ads_info['msg']}")
                self.log(f"{red}Full response: {json.dumps(ads_info, indent=2)}")
        except Exception as e:
            self.log(f"{red}Lỗi khi xử lý quảng cáo:")
            self.log(f"{red}{str(e)}")
            self.log(f"{red}Traceback:")
            self.log(f"{red}{traceback.format_exc()}")

    def main(self):
        while True:
            data = open(data_file, "r").read().splitlines()
            num_acc = len(data)
            self.log(self.line)
            self.log(f"{green}Tổng tài khoản: {white}{num_acc}")
            self.min_harvest_time = float('inf')

            for no, data in enumerate(data):
                self.log(self.line)
                self.log(f"{green}Tài khoản: {white}{no+1}/{num_acc}")

                # Get token
                try:
                    get_token = self.get_token(data=data).json()
                    token = get_token["data"]["token"]

                    # Get user info
                    get_user_info = self.user_info(token=token).json()
                    banana = get_user_info["data"]["banana_count"]
                    peel = get_user_info["data"]["peel"]
                    usdt = get_user_info["data"]["usdt"]
                    speedup = get_user_info["data"]["speedup_count"]
                    tg_id = get_user_info["data"]["user_id"]
                    equip_banana_name = get_user_info["data"]["equip_banana"]["name"]
                    equip_banana_peel_limit = get_user_info["data"]["equip_banana"][
                        "daily_peel_limit"
                    ]
                    equip_banana_peel_price = get_user_info["data"]["equip_banana"][
                        "sell_exchange_peel"
                    ]
                    equip_banana_usdt_price = get_user_info["data"]["equip_banana"][
                        "sell_exchange_usdt"
                    ]
                    self.log(
                        f"{green}Banana: {white}{banana} - {green}Peels: {white}{peel} - {green}USDT: {white}{usdt} - {green}SPEEDUP: {white}{speedup}"
                    )
                    self.log(
                        f"{green}Đang sử dụng: {white}{equip_banana_name} - {green}Daily Peel Limit: {white}{equip_banana_peel_limit} - {green}Peel Price: {white}{equip_banana_peel_price} - {green}USDT Price: {white}{equip_banana_usdt_price}"
                    )

                    if float(equip_banana_usdt_price) >= 1:
                        entry = f"Tài khoản {no+1} - {equip_banana_name} - USDT Price: {equip_banana_usdt_price}"
                        if self.write_unique_entry(entry):
                            self.log(f"{green}Đã ghi thông tin chuối có giá trị lớn hơn 1 vào file banana.txt")
                        else:
                            self.log(f"{yellow}Đã ghi thông tin chuối có giá trị lớn hơn 1 vào file banana.txt")

                    # xem ads
                    self.handle_ads(token, tg_id)

                    # Auto Click
                    if self.auto_click:
                        self.log(f"{yellow}Auto Tap: {green}ON")
                        get_user_info = self.user_info(token=token).json()
                        max_click_count = get_user_info["data"]["max_click_count"]
                        today_click_count = get_user_info["data"]["today_click_count"]
                        click_left = max_click_count - today_click_count

                        if click_left > 0:
                            sessions = 10
                            clicks_per_session = [0] * sessions

                            for _ in range(click_left):
                                session = random.randint(0, sessions - 1)
                                clicks_per_session[session] += 1

                            for session, clicks in enumerate(clicks_per_session, 1):
                                if clicks > 0:
                                    do_click = self.do_click(token=token, click_count=clicks).json()
                                    status = do_click["msg"]
                                    if status == "Success":
                                        peel_added = do_click["data"]["peel"]
                                        speedup = do_click["data"]["speedup"]
                                        self.log(
                                            f"{white}Tap thành công: nhận được {green}{peel_added} peels {white}và {green}{speedup} speedup"
                                        )
                                    else:
                                        self.log(f"{red}Tap thất bại trong phiên {session}")

                                    time.sleep(random.uniform(1, 5))
                        else:
                            self.log(f"{red}Đã đạt giới hạn tap ngày hôm nay")
                    else:
                        self.log(f"{yellow}Auto Tap: {red}OFF")

                    # Do task
                    if self.auto_do_task:
                        self.log(f"{yellow}Tự động thực hiện nhiệm vụ: {green}ON")
                        get_quest_list = self.quest_list(token=token)
                        if get_quest_list and "data" in get_quest_list and "list" in get_quest_list["data"]:
                            quest_list = get_quest_list["data"]["list"]

                            for quest in quest_list:
                                quest_id = quest.get("quest_id") or quest.get("id")
                                if quest_id is None:
                                    self.log(f"{red}Không tìm thấy quest_id cho nhiệm vụ: {quest}")
                                    continue

                                quest_name = quest.get("quest_name", "Unknown")
                                achieve_status = quest.get("is_achieved", False)
                                claim_status = quest.get("is_claimed", False)

                                if not achieve_status and not claim_status:
                                    try:
                                        achieve_quest = self.achieve_quest(token=token, quest_id=quest_id).json()
                                        if achieve_quest.get("code") == 0 and achieve_quest.get("msg") == "Success":
                                            self.log(f"{white}Hoàn thành nhiệm vụ {yellow}{quest_name}: {green}Thành công")
                                        else:
                                            self.log(f"{white}Hoàn thành nhiệm vụ {yellow}{quest_name}: {red}Thất bại - {achieve_quest.get('msg', 'Unknown error')}")

                                        claim_quest = self.claim_quest(token=token, quest_id=quest_id).json()
                                        if claim_quest.get("code") == 0 and claim_quest.get("msg") == "Success":
                                            self.log(f"{white}Nhận thưởng nhiệm vụ {yellow}{quest_name}: {green}Thành công")
                                        else:
                                            self.log(f"{white}Nhận thưởng nhiệm vụ {yellow}{quest_name}: {red}Thất bại - {claim_quest.get('msg', 'Unknown error')}")
                                    except Exception as e:
                                        self.log(f"{red}Lỗi khi xử lý nhiệm vụ {quest_name}:")
                                        self.log(f"{red}{str(e)}")
                                        self.log(f"{red}Traceback:")
                                        self.log(f"{red}{traceback.format_exc()}")
                                elif achieve_status and not claim_status:
                                    try:
                                        claim_quest = self.claim_quest(token=token, quest_id=quest_id).json()
                                        if claim_quest.get("code") == 0 and claim_quest.get("msg") == "Success":
                                            self.log(f"{white}Nhận thưởng nhiệm vụ {yellow}{quest_name}: {green}Thành công")
                                        else:
                                            self.log(f"{white}Nhận thưởng nhiệm vụ {yellow}{quest_name}: {red}Thất bại - {claim_quest.get('msg', 'Unknown error')}")
                                    except Exception as e:
                                        self.log(f"{red}Lỗi khi nhận thưởng nhiệm vụ {quest_name}:")
                                        self.log(f"{red}{str(e)}")
                                        self.log(f"{red}Traceback:")
                                        self.log(f"{red}{traceback.format_exc()}")
                                else:
                                    self.log(f"{white}Nhiệm vụ {yellow}{quest_name}: {green}Đã hoàn thành và nhận thưởng")

                            # Xử lý claim quest lottery
                            while True:
                                try:
                                    claim_quest_lottery = self.claim_quest_lottery(token=token).json()
                                    if claim_quest_lottery.get("code") == 0 and claim_quest_lottery.get("msg") == "Success":
                                        self.log(f"{white}Claim Quest Lottery: {green}Thành công")
                                    else:
                                        self.log(f"{yellow}Không còn Quest Lottery để claim")
                                        break
                                except Exception as e:
                                    self.log(f"{red}Lỗi khi claim Quest Lottery:")
                                    self.log(f"{red}{str(e)}")
                                    self.log(f"{red}Traceback:")
                                    self.log(f"{red}{traceback.format_exc()}")
                                    break
                        else:
                            self.log(f"{red}Không thể lấy danh sách nhiệm vụ hoặc danh sách trống")
                    else:
                        self.log(f"{yellow}Tự động thực hiện nhiệm vụ: {red}OFF")

                    # Claim invite
                    if self.auto_claim_invite:
                        self.log(f"{yellow}Auto Claim Invite: {green}ON")
                        get_invite_list = self.invite_list(token=token).json()
                        invite = get_invite_list["data"]
                        if invite is None:
                            self.log(f"{white}Claim Invite: {red}Không có bạn bè")
                        else:
                            self.log(f"{white}Claim Invite: {green}Có bạn bè")
                            claim_status = invite["claim"]
                            if claim_status:
                                claim_invite = self.claim_invite(token=token)
                                claim_invite_status = claim_invite["msg"]
                                if claim_invite_status == "Success":
                                    self.log(f"{white}Claim Invite: {green}Thành công")
                                else:
                                    self.log(f"{white}Claim Invite: {red}Thất bại")
                            else:
                                self.log(
                                    f"{white}Claim Invite: {red}No invite lottery to claim"
                                )
                    else:
                        self.log(f"{yellow}Auto Claim Invite: {red}OFF")

                    # Get lottery info
                    if self.auto_claim_and_harvest:
                        self.log(f"{yellow}Tự động thu hoạch chuối: {green}ON")
                        while True:
                            try:
                                get_lottery_info = self.lottery_info(token=token).json()
                                lottery_data = get_lottery_info.get("data", {})
                                lottery_status = lottery_data.get("countdown_end", False)
                                lottery_count = lottery_data.get("remain_lottery_count", 0)

                                remaining_time = self.calculate_remaining_time(lottery_data)
                                remaining_time_str = f"{int(remaining_time)} phút" if remaining_time > 0 else "0 phút"

                                self.log(f"{white}Thời gian còn lại để thu hoạch: {green}{remaining_time_str}")
                                self.min_harvest_time = min(self.min_harvest_time, remaining_time)
                                self.log(f"{white}Số lượng lottery còn lại: {green}{lottery_count}")

                                get_user_info = self.user_info(token=token).json()
                                speedup_count = get_user_info["data"]["speedup_count"]

                                while remaining_time > 60 and speedup_count > 0:
                                    self.log(f"{yellow}Sử dụng Speedup. Còn lại: {white}{speedup_count}")
                                    do_speedup_response = self.do_speedup(token=token).json()

                                    if do_speedup_response["code"] == 0 and do_speedup_response["msg"] == "Success":
                                        speedup_count = do_speedup_response["data"]["speedup_count"]
                                        new_lottery_info = do_speedup_response["data"]["lottery_info"]
                                        remaining_time = self.calculate_remaining_time(new_lottery_info)
                                        remaining_time_str = f"{int(remaining_time)} phút" if remaining_time > 0 else "0 phút"
                                        self.log(f"{green}Sử dụng Speedup thành công. Thời gian còn lại: {white}{remaining_time_str}")
                                    else:
                                        self.log(f"{red}Sử dụng Speedup thất bại: {do_speedup_response['msg']}")
                                        break

                                if speedup_count == 0:
                                    self.log(f"{yellow}Đã sử dụng hết Speedup")

                                if lottery_status:
                                    claim_lottery = self.claim_lottery(token=token).json()
                                    claim_status = claim_lottery.get("msg")
                                    if claim_status == "Success":
                                        self.log(f"{white}Claim Banana: {green}Thành công")
                                    else:
                                        self.log(f"{white}Claim Banana: {red}Thất bại")
                                        self.log(f"{red}Chi tiết lỗi: {claim_lottery}")

                                while lottery_count > 0:
                                    do_lottery_response = self.do_lottery(token=token)
                                    do_lottery = do_lottery_response.json()
                                    lottery_status = do_lottery.get('msg')
                                    if lottery_status == "Success":
                                        banana_data = do_lottery.get("data", {}).get("banana_info", {})
                                        banana_name = banana_data.get("name", "Unknown")
                                        usdt_value = banana_data.get("sell_exchange_usdt", 0)
                                        peel_value = banana_data.get("sell_exchange_peel", 0)
                                        banana_id = banana_data.get("banana_id")

                                        self.log(f"{white}Harvest Banana: {green}Thành công")
                                        self.log(f"{white}Nhận được: {green}{banana_name} - {usdt_value} USDT - {peel_value} Peel")

                                        ads_response = self.claim_ads_income(token=token, ad_type=2).json()
                                        if ads_response["code"] == 0 and ads_response["msg"] == "Success":
                                            income = ads_response["data"]["income"]
                                            peels = ads_response["data"]["peels"]
                                            speedup = ads_response["data"]["speedup"]
                                            self.log(f"{green}Xem quảng cáo thành công: nhận {white}{income} USDT - {peels} Peels - {speedup} Speedup")
                                        else:
                                            self.log(f"{red}Xem quảng cáo thất bại: {ads_response['msg']}")

                                        share_response = self.do_share(token=token, banana_id=banana_id).json()
                                        if share_response["code"] == 0 and share_response["msg"] == "Success":
                                            self.log(f"{green}Share chuối thành công!")
                                        else:
                                            self.log(f"{red}Share chuối thất bại: {share_response['msg']}")

                                        lottery_count -= 1
                                        self.log(f"{white}Số lượng chuối chưa harvest: {green}{lottery_count}")

                                        if lottery_count > 0:
                                            self.log(f"{yellow}Chờ 10 giây trước khi harvest chuối tiếp theo...")
                                            time.sleep(10)
                                    else:
                                        self.log(f"{white}Harvest Banana: {red}Thất bại")
                                        self.log(f"{red}Chi tiết lỗi: {do_lottery}")
                                        break

                                if lottery_count == 0:
                                    self.log(f"{white}Đã harvest hết tất cả chuối")
                                    break
                                else:
                                    self.log(f"{white}Claim and Harvest Banana: {yellow}Chưa đến thời gian thu hoạch")
                                    break

                            except json.JSONDecodeError as json_err:
                                self.log(f"{red}Lỗi khi phân tích JSON: {str(json_err)}")
                                self.log(f"Nội dung phản hồi: {json_err.doc}")
                            except Exception as e:
                                self.log(f"{red}Lỗi trong quá trình thu hoạch: {str(e)}")
                                self.log(f"Traceback: {traceback.format_exc()}")
                            break

                    else:
                        self.log(f"{yellow}Tự động thu hoạch chuối: {red}OFF")

                    # Equip banana
                    if self.auto_equip_banana:
                        self.log(f"{yellow}Sử dụng chuối tốt nhất: {green}ON")
                        try:
                            banana_list = self.banana_list(token=token)
                            if not banana_list:
                                self.log(f"{red}Không có chuối khả dụng để sử dụng")
                            else:
                                # Lọc ra các chuối có count > 0
                                available_bananas = [banana for banana in banana_list if banana["count"] > 0]
                                if not available_bananas:
                                    self.log(f"{red}Không có chuối nào có số lượng > 0.")
                                else:
                                    # Chọn chuối có giá trị cao nhất dựa trên tiêu chí của bạn
                                    # Ví dụ: chuối có sell_exchange_usdt cao nhất
                                    best_banana = max(available_bananas, key=lambda b: b["sell_exchange_usdt"])

                                    # Nếu tất cả sell_exchange_usdt đều bằng 0, chọn dựa trên daily_peel_limit
                                    if best_banana["sell_exchange_usdt"] == 0:
                                        best_banana = max(available_bananas, key=lambda b: b["daily_peel_limit"])

                                    banana_id = best_banana["banana_id"]
                                    banana_name = best_banana["name"]
                                    banana_peel_limit = best_banana["daily_peel_limit"]
                                    banana_peel_price = best_banana["sell_exchange_peel"]
                                    banana_usdt_price = best_banana["sell_exchange_usdt"]

                                    # Gọi hàm equip_banana để sử dụng chuối
                                    equip_banana_response = self.equip_banana(token=token, banana_id=banana_id).json()
                                    if equip_banana_response["code"] == 0 and equip_banana_response["msg"] == "Success":
                                        self.log(
                                            f"{green}Bạn đang dùng chuối tốt nhất: {white}{banana_name} - "
                                            f"{green}Daily Peel Limit: {white}{banana_peel_limit} - "
                                            f"{green}Peel Price: {white}{banana_peel_price} - "
                                            f"{green}USDT Price: {white}{banana_usdt_price}"
                                        )
                                    else:
                                        self.log(f"{white}Sử dụng chuối: {red}Thất bại - {equip_banana_response['msg']}")
                        except Exception as e:
                            self.log(f"{red}Lỗi khi sử dụng chuối tốt nhất: {str(e)}")
                            self.log(f"Traceback: {traceback.format_exc()}")
                    else:
                        self.log(f"{yellow}Sử dụng chuối tốt nhất: {red}OFF")


                except Exception as e:
                    self.log(f"{red}Lỗi không xác định:")
                    self.log(f"{red}Type: {type(e).__name__}")
                    self.log(f"{red}Error: {str(e)}")
                    self.log(f"{red}Traceback:")
                    self.log(f"{red}{traceback.format_exc()}")

            print()
            wait_time = max(1, int(self.min_harvest_time * 60))
            self.log(f"{yellow}Cần chờ {int(wait_time/60)} phút {wait_time%60} giây để tiếp tục!")
            time.sleep(wait_time)


if __name__ == "__main__":
    try:
        banana = Banana()
        banana.main()
    except KeyboardInterrupt:
        sys.exit()
