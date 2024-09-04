import aiohttp
import asyncio
import json
import random
import string
import time
from datetime import datetime
from urllib.parse import unquote
from utils.headers import headers_set
from utils.query import QUERY_USER, QUERY_LOGIN, MUTATION_GAME_PROCESS_TAPS_BATCH
from utils.query import QUERY_GAME_CONFIG

url = "https://api-gw-tg.memefi.club/graphql"
HOME = "./../"
HOME_DATA = f"{HOME}/data/"

def generate_random_nonce(length=52):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def load_proxies(file_path='./../data/proxy.txt'):
    with open(file_path, 'r') as file:
        proxies = file.readlines()
    return [proxy.strip() for proxy in proxies]

async def check_proxy(proxy, proxy_check_results):
    if proxy in proxy_check_results:
        return proxy_check_results[proxy]

    async with aiohttp.ClientSession() as session:
        try:
            async with session.get('https://api.ipify.org', proxy=proxy, timeout=10) as response:
                if response.status == 200:
                    ip = await response.text()
                    proxy_check_results[proxy] = ip
                    return ip
                else:
                    proxy_check_results[proxy] = None
                    return None
        except aiohttp.ClientConnectorError:
            proxy_check_results[proxy] = None
            return None

async def fetch(account_line, proxy, proxy_check_results):
    proxy_ip = await check_proxy(proxy, proxy_check_results)
    if not proxy_ip:
        print(f"❌ Không thể sử dụng proxy {proxy}.")
        return None

    with open('./../data/memefi.txt', 'r') as file:
        lines = file.readlines()
        raw_data = lines[account_line - 1].strip()

    tg_web_data = unquote(unquote(raw_data))
    query_id = tg_web_data.split('query_id=', maxsplit=1)[1].split('&user', maxsplit=1)[0]
    user_data = tg_web_data.split('user=', maxsplit=1)[1].split('&auth_date', maxsplit=1)[0]
    auth_date = tg_web_data.split('auth_date=', maxsplit=1)[1].split('&hash', maxsplit=1)[0]
    hash_ = tg_web_data.split('hash=', maxsplit=1)[1].split('&', maxsplit=1)[0]

    user_data_dict = json.loads(unquote(user_data))

    url = 'https://api-gw-tg.memefi.club/graphql'
    headers = headers_set.copy()
    data = {
        "operationName": "MutationTelegramUserLogin",
        "variables": {
            "webAppData": {
                "auth_date": int(auth_date),
                "hash": hash_,
                "query_id": query_id,
                "checkDataString": f"auth_date={auth_date}\nquery_id={query_id}\nuser={unquote(user_data)}",
                "user": {
                    "id": user_data_dict["id"],
                    "allows_write_to_pm": user_data_dict["allows_write_to_pm"],
                    "first_name": user_data_dict["first_name"],
                    "last_name": user_data_dict["last_name"],
                    "username": user_data_dict.get("username", "Username không được đặt"),
                    "language_code": user_data_dict["language_code"],
                    "version": "7.2",
                    "platform": "ios"
                }
            }
        },
        "query": QUERY_LOGIN
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=data, proxy=proxy) as response:
            try:
                json_response = await response.json()
                if 'errors' in json_response:
                    return None
                else:
                    access_token = json_response['data']['telegramUserLogin']['access_token']
                    return access_token, proxy_ip
            except aiohttp.ContentTypeError:
                print("Không thể giải mã JSON")
                return None, None

async def check_user(index, proxy, proxy_check_results):
    result = await fetch(index + 1, proxy, proxy_check_results)
    if not result:
        return None, None

    access_token, proxy_ip = result

    url = "https://api-gw-tg.memefi.club/graphql"

    headers = headers_set.copy()  
    headers['Authorization'] = f'Bearer {access_token}'
    
    json_payload = {
        "operationName": "QueryTelegramUserMe",
        "variables": {},
        "query": QUERY_USER
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=json_payload, proxy=proxy) as response:
            if response.status == 200:
                response_data = await response.json()
                if 'errors' in response_data:
                    print(f"❌ Lỗi Query ID Sai")
                    return None, None
                else:
                    user_data = response_data['data']['telegramUserMe']
                    return user_data, proxy_ip
            else:
                print(response)
                print(f"❌ Lỗi với trạng thái {response.status}, thử lại...")
                return None, None

async def submit_taps(index, json_payload, proxy, proxy_check_results):
    result = await fetch(index + 1, proxy, proxy_check_results)
    if not result:
        return None

    access_token, _ = result

    url = "https://api-gw-tg.memefi.club/graphql"

    headers = headers_set.copy()  
    headers['Authorization'] = f'Bearer {access_token}'

    async with aiohttp.ClientSession() as session:
        while True:
            async with session.post(url, headers=headers, json=json_payload, proxy=proxy) as response:
                if response.status == 200:
                    response_data = await response.json()
                    if response_data.get("data") and response_data["data"].get("gameProcessTapsBatch"):
                        current_energy = response_data["data"]["gameProcessTapsBatch"]["currentEnergy"]
                        if current_energy < 10:
                            return response_data
                        else:
                            json_payload["variables"]["payload"]["nonce"] = generate_random_nonce()
                    else:
                        return response_data
                else:
                    return response

async def check_stat(index, headers, proxy, proxy_check_results):
    result = await fetch(index + 1, proxy, proxy_check_results)
    if not result:
        return None

    access_token, _ = result

    url = "https://api-gw-tg.memefi.club/graphql"

    headers = headers_set.copy() 
    headers['Authorization'] = f'Bearer {access_token}'
    
    json_payload = {
        "operationName": "QUERY_GAME_CONFIG",
        "variables": {},
        "query": QUERY_GAME_CONFIG
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=json_payload, proxy=proxy) as response:
            if response.status == 200:
                response_data = await response.json()
                if 'errors' in response_data:
                    return None
                else:
                    user_data = response_data['data']['telegramGameGetConfig']
                    return user_data
            else:
                print(response)
                print(f"❌ Lỗi với trạng thái {response.status}, thử lại...")
                return None
async def format_proxy(proxy):
    if proxy.startswith("http"):
        return proxy
    parts = proxy.split(":")
    if len(parts) == 2:
        return f"http://{proxy}"
    elif len(parts) == 4:
        return f"http://{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}"
    else:
        return proxy

async def main():
    print("Bắt đầu Memefi bot...")
    print("\r Lấy danh sách tài khoản hợp lệ...", end="", flush=True)
    proxies = load_proxies()
    proxy_check_results = {}

    while True:
        with open(f'{HOME_DATA}/memefi.txt', 'r') as file:
            lines = file.readlines()

        accounts = []
        for index, line in enumerate(lines):
            proxy = await format_proxy(proxies[index % len(proxies)])
            result, proxy_ip = await check_user(index, proxy, proxy_check_results)
            if result is not None:
                first_name = result.get('firstName', 'Unknown')
                last_name = result.get('lastName', 'Unknown')
                accounts.append((index, result, first_name, last_name, proxy_ip))
            else:
                print(f"❌ Tài khoản {index + 1}: Token không hợp lệ hoặc có lỗi xảy ra")

        print("\rDanh sách tài khoản:", flush=True)
        for index, _, first_name, last_name, proxy_ip in accounts:
            print(f"✅ [ Tài khoản {first_name} {last_name} ] | Proxy hoạt động. IP: {proxy_ip}")

        for index, result, first_name, last_name, proxy_ip in accounts:
            
            headers = {'Authorization': f'Bearer {result}'}
            stat_result = await check_stat(index, headers, proxies[index % len(proxies)], proxy_check_results)

            if stat_result is not None:
                user_data = stat_result
                output = (
                    f"[ Tài khoản {index + 1} - {first_name} {last_name} ]\n"
                    f"Balance 💎 {user_data['coinsAmount']} Năng lượng : {user_data['currentEnergy']} / {user_data['maxEnergy']}\n"
                )
                print(output, end="", flush=True)
                print("\rBắt đầu tap\n", end="", flush=True)

                while user_data['currentEnergy'] > 200:
                    total_tap = random.randint(100, 200)
                    tap_payload = {
                        "operationName": "MutationGameProcessTapsBatch",
                        "variables": {
                            "payload": {
                                "nonce": generate_random_nonce(),
                                "tapsCount": total_tap
                            }
                        },
                        "query": MUTATION_GAME_PROCESS_TAPS_BATCH
                    }
                
                    tap_result = await submit_taps(index, tap_payload, proxies[index % len(proxies)], proxy_check_results)
                    if tap_result is not None:
                        user_data = await check_stat(index, headers, proxies[index % len(proxies)], proxy_check_results)
                        print(f"\rĐang tap Memefi : Balance 💎 {user_data['coinsAmount']} Năng lượng : {user_data['currentEnergy']} / {user_data['maxEnergy']}\n")
                    else:
                        print(f"❌ Lỗi với trạng thái {tap_result}, thử lại...")
        print("=== [ TẤT CẢ TÀI KHOẢN ĐÃ ĐƯỢC XỬ LÝ ] ===")
    
        animate_energy_recharge(300)   
        
def animate_energy_recharge(duration):
    frames = ["|", "/", "-", "\\"]
    end_time = time.time() + duration
    while time.time() < end_time:
        remaining_time = int(end_time - time.time())
        for frame in frames:
            print(f"\rĐang nạp lại năng lượng {frame} - Còn lại {remaining_time} giây", end="", flush=True)
            time.sleep(0.25)
    print("\rNạp năng lượng hoàn thành.\n", flush=True)     

asyncio.run(main())
