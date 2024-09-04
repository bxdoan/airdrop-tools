QUERY_GAME_CONFIG = """
query QUERY_GAME_CONFIG {
  telegramGameGetConfig {
    ...FragmentBossFightConfig
    __typename
  }
}

fragment FragmentBossFightConfig on TelegramGameConfigOutput {
  _id
  coinsAmount
  currentEnergy
  maxEnergy
  weaponLevel
  energyLimitLevel
  energyRechargeLevel
  tapBotLevel
  currentBoss {
    _id
    level
    currentHealth
    maxHealth
    __typename
  }
  freeBoosts {
    _id
    currentTurboAmount
    maxTurboAmount
    turboLastActivatedAt
    turboAmountLastRechargeDate
    currentRefillEnergyAmount
    maxRefillEnergyAmount
    refillEnergyLastActivatedAt
    refillEnergyAmountLastRechargeDate
    __typename
  }
  bonusLeaderDamageEndAt
  bonusLeaderDamageStartAt
  bonusLeaderDamageMultiplier
  nonce
  __typename
}
"""

# Tambahkan query-query lainnya dengan format yang sama

MUTATION_GAME_PROCESS_TAPS_BATCH = """
    mutation MutationGameProcessTapsBatch($payload: TelegramGameTapsBatchInput!) {
      telegramGameProcessTapsBatch(payload: $payload) {
        ...FragmentBossFightConfig
        __typename
      }
    }

    fragment FragmentBossFightConfig on TelegramGameConfigOutput {
      _id
      coinsAmount
      currentEnergy
      maxEnergy
      weaponLevel
      energyLimitLevel
      energyRechargeLevel
      tapBotLevel
      currentBoss {
        _id
        level
        currentHealth
        maxHealth
        __typename
      }
      freeBoosts {
        _id
        currentTurboAmount
        maxTurboAmount
        turboLastActivatedAt
        turboAmountLastRechargeDate
        currentRefillEnergyAmount
        maxRefillEnergyAmount
        refillEnergyLastActivatedAt
        refillEnergyAmountLastRechargeDate
        __typename
      }
      bonusLeaderDamageEndAt
      bonusLeaderDamageStartAt
      bonusLeaderDamageMultiplier
      nonce
      __typename
    }
    """
UPGRADE_QUERY = """
        mutation telegramGamePurchaseUpgrade($upgradeType: UpgradeType!) {
          telegramGamePurchaseUpgrade(type: $upgradeType) {
            ...FragmentBossFightConfig
            __typename
          }
        }
        fragment FragmentBossFightConfig on TelegramGameConfigOutput {
          _id
          coinsAmount
          currentEnergy
          maxEnergy
          weaponLevel
          energyLimitLevel
          energyRechargeLevel
          tapBotLevel
          currentBoss {
            _id
            level
            currentHealth
            maxHealth
            __typename
          }
          freeBoosts {
            _id
            currentTurboAmount
            maxTurboAmount
            turboLastActivatedAt
            turboAmountLastRechargeDate
            currentRefillEnergyAmount
            maxRefillEnergyAmount
            refillEnergyLastActivatedAt
            refillEnergyAmountLastRechargeDate
            __typename
          }
          bonusLeaderDamageEndAt
          bonusLeaderDamageStartAt
          bonusLeaderDamageMultiplier
          nonce
          __typename
        }
        """

QUERY_BOOSTER = """
            mutation telegramGameActivateBooster($boosterType: BoosterType!) {
              telegramGameActivateBooster(boosterType: $boosterType) {
                ...FragmentBossFightConfig
                __typename
              }
            }
            fragment FragmentBossFightConfig on TelegramGameConfigOutput {
              _id
              coinsAmount
              currentEnergy
              maxEnergy
              weaponLevel
              energyLimitLevel
              energyRechargeLevel
              tapBotLevel
              currentBoss {
                _id
                level
                currentHealth
                maxHealth
                __typename
              }
              freeBoosts {
                _id
                currentTurboAmount
                maxTurboAmount
                turboLastActivatedAt
                turboAmountLastRechargeDate
                currentRefillEnergyAmount
                maxRefillEnergyAmount
                refillEnergyLastActivatedAt
                refillEnergyAmountLastRechargeDate
                __typename
              }
              bonusLeaderDamageEndAt
              bonusLeaderDamageStartAt
              bonusLeaderDamageMultiplier
              nonce
              __typename
            }
            """

QUERY_NEXT_BOSS = """
        mutation telegramGameSetNextBoss {
          telegramGameSetNextBoss {
            ...FragmentBossFightConfig
            __typename
          }
        }
        fragment FragmentBossFightConfig on TelegramGameConfigOutput {
          _id
          coinsAmount
          currentEnergy
          maxEnergy
          weaponLevel
          energyLimitLevel
          energyRechargeLevel
          tapBotLevel
          currentBoss {
            _id
            level
            currentHealth
            maxHealth
            __typename
          }
          freeBoosts {
            _id
            currentTurboAmount
            maxTurboAmount
            turboLastActivatedAt
            turboAmountLastRechargeDate
            currentRefillEnergyAmount
            maxRefillEnergyAmount
            refillEnergyLastActivatedAt
            refillEnergyAmountLastRechargeDate
            __typename
          }
          bonusLeaderDamageEndAt
          bonusLeaderDamageStartAt
          bonusLeaderDamageMultiplier
          nonce
          __typename
        }
        """

QUERY_GET_TASK = """
        fragment FragmentCampaignTask on CampaignTaskOutput {
          id
          name
          description
          status
          type
          position
          buttonText
          coinsRewardAmount
          link
          userTaskId
          isRequired
          iconUrl
          __typename
        }

        query GetTasksList($campaignId: String!) {
          campaignTasks(campaignConfigId: $campaignId) {
            ...FragmentCampaignTask
            __typename
          }
        }
        """

QUERY_TASK_ID = """
                fragment FragmentCampaignTask on CampaignTaskOutput {
                  id
                  name
                  description
                  status
                  type
                  position
                  buttonText
                  coinsRewardAmount
                  link
                  userTaskId
                  isRequired
                  iconUrl
                  __typename
                }

                query GetTaskById($taskId: String!) {
                  campaignTaskGetConfig(taskId: $taskId) {
                    ...FragmentCampaignTask
                    __typename
                  }
                }
                """

QUERY_TASK_VERIF = """
                fragment FragmentCampaignTask on CampaignTaskOutput {
                  id
                  name
                  description
                  status
                  type
                  position
                  buttonText
                  coinsRewardAmount
                  link
                  userTaskId
                  isRequired
                  iconUrl
                  __typename
                }

                mutation CampaignTaskToVerification($userTaskId: String!) {
                  campaignTaskMoveToVerification(userTaskId: $userTaskId) {
                    ...FragmentCampaignTask
                    __typename
                  }
                }
                """

QUERY_TASK_COMPLETED = """
                fragment FragmentCampaignTask on CampaignTaskOutput {
                  id
                  name
                  description
                  status
                  type
                  position
                  buttonText
                  coinsRewardAmount
                  link
                  userTaskId
                  isRequired
                  iconUrl
                  __typename
                }

                mutation CampaignTaskCompleted($userTaskId: String!) {
                  campaignTaskMarkAsCompleted(userTaskId: $userTaskId) {
                    ...FragmentCampaignTask
                    __typename
                  }
                }
                """
QUERY_USER = """
        query QueryTelegramUserMe {
          telegramUserMe {
            firstName
            lastName
            telegramId
            username
            referralCode
            isDailyRewardClaimed
            referral {
              username
              lastName
              firstName
              bossLevel
              coinsAmount
              __typename
            }
            isReferralInitialJoinBonusAvailable
            league
            leagueIsOverTop10k
            leaguePosition
            _id
            __typename
          }
        }
        """

QUERY_LOGIN = """mutation MutationTelegramUserLogin($webAppData: TelegramWebAppDataInput!) {
            telegramUserLogin(webAppData: $webAppData) {
                access_token
                __typename
            }
        }"""